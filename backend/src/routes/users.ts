// Hierarquia de cadastro — PROMPT §12. admin → gerente → entrevistador.
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole, teamScope } from "../middleware/rbac.js";

const router = Router();

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z
    .enum(["admin", "manager", "coordinator", "statistician", "supervisor", "interviewer", "client"])
    .optional(),
  managerId: z.string().uuid().optional(),
  stratumId: z.string().uuid().optional(), // zona do gerente
  registrationCode: z.string().optional(),
});

async function nextInterviewerCode(): Promise<string> {
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE role = 'interviewer'`);
  return `ENT-${String(Number(r.rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

// GET /api/users — admin: lista todos os usuários (com gerente e produção).
router.get("/", requireRole("admin"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.role, u.registration_code, u.active, u.manager_id, u.stratum_id,
             m.name AS manager_name, s.name AS stratum_name,
             (SELECT COUNT(*) FROM interviews i WHERE i.interviewer_id = u.id AND i.status <> 'rejected')::int AS interviews
      FROM users u
      LEFT JOIN users m ON m.id = u.manager_id
      LEFT JOIN strata s ON s.id = u.stratum_id
      ORDER BY u.role, u.name`);
    res.json({ users: r.rows });
  } catch (e) { next(e); }
});

// POST /api/users — admin: qualquer role; manager: só interviewer da própria equipe.
router.post("/", requireRole("manager"), async (req, res, next) => {
  try {
    const body = CreateUserSchema.parse(req.body);
    const me = req.user!;

    let role = body.role ?? "interviewer";
    let managerId = body.managerId ?? null;

    if (me.role === "manager") {
      // CA #8: gerente tentando criar role != interviewer → 403.
      if (body.role && body.role !== "interviewer") {
        res.status(403).json({ error: "manager_can_only_create_interviewer" });
        return;
      }
      role = "interviewer";
      managerId = me.id; // força a própria equipe (ignora body)
    }

    if (role === "interviewer" && !managerId) {
      res.status(400).json({ error: "interviewer_requires_manager_id" });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const regCode = role === "interviewer" ? body.registrationCode ?? (await nextInterviewerCode()) : body.registrationCode ?? null;

    const stratumId = role === "manager" ? body.stratumId ?? null : null;
    const r = await db.execute(sql`
      INSERT INTO users (name, email, password_hash, role, registration_code, manager_id, stratum_id, created_by)
      VALUES (${body.name}, ${body.email}, ${passwordHash}, ${role}::user_role, ${regCode}, ${managerId}, ${stratumId}, ${me.id})
      RETURNING id, name, email, role, registration_code, manager_id, stratum_id, created_by, active, created_at`);
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "email_or_code_already_exists" });
      return;
    }
    next(e);
  }
});

// PATCH /api/users/:id/active — desativação respeita o escopo (§12).
router.patch("/:id/active", requireRole("manager"), teamScope, async (req, res, next) => {
  try {
    const active = z.object({ active: z.boolean() }).parse(req.body).active;
    const me = req.user!;
    const scope = me.role === "manager" ? sql` AND manager_id = ${me.id}` : sql``;
    const r = await db.execute(sql`
      UPDATE users SET active = ${active} WHERE id = ${req.params.id}${scope}
      RETURNING id, active`);
    if (!r.rows.length) {
      res.status(404).json({ error: "not_found_or_out_of_scope" });
      return;
    }
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;

// ─── /api/team (router separado, montado no server) ──────────────────
export const teamRouter = Router();

// GET /api/team — manager: própria equipe + produção do dia; admin: ?managerId=
// p/ auditar qualquer equipe (CA #9: gerente A não vê equipe do gerente B).
teamRouter.get("/", requireRole("manager"), teamScope, async (req, res, next) => {
  try {
    const me = req.user!;
    const managerId =
      me.role === "manager" ? me.id : (req.query.managerId as string | undefined) ?? null;
    const scope = managerId ? sql`WHERE u.manager_id = ${managerId}` : sql`WHERE u.role = 'interviewer'`;

    const r = await db.execute(sql`
      SELECT u.id, u.name, u.registration_code, u.active, u.manager_id,
             COUNT(i.id) FILTER (WHERE i.synced_at::date = now()::date AND i.status <> 'rejected')::int AS today,
             COUNT(i.id) FILTER (WHERE i.status <> 'rejected')::int AS total,
             COUNT(ch.id)::int AS checks,
             COUNT(ch.id) FILTER (WHERE ch.result = 'rejected')::int AS rejected
      FROM users u
      LEFT JOIN interviews i ON i.interviewer_id = u.id
      LEFT JOIN checks ch ON ch.interview_id = i.id
      ${scope}
      GROUP BY u.id, u.name, u.registration_code, u.active, u.manager_id
      ORDER BY u.registration_code NULLS LAST, u.name`);

    const team = r.rows.map((x) => {
      const total = Number(x.total);
      const checks = Number(x.checks);
      return {
        ...x,
        today: Number(x.today),
        total,
        checks,
        rejected: Number(x.rejected),
        checkRate: total > 0 ? Math.round((1000 * checks) / total) / 10 : 0,
      };
    });
    res.json({ managerId, team });
  } catch (e) {
    next(e);
  }
});
