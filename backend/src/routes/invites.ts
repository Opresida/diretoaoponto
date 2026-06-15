// Convites de cadastro (F3) — uso único. Gerente (admin gera) e entrevistador
// (gerente gera). Rotas autenticadas (criar/listar) + públicas (ler/aceitar).
import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { nextInterviewerCode } from "../services/usersService.js";

const PORTAL = () => process.env.PUBLIC_PORTAL_ORIGIN ?? "http://localhost:5174";
const inviteUrl = (token: string) => `${PORTAL()}/cadastro/${token}`;

// ─── Autenticado (criar / listar) ────────────────────────────────────
const router = Router();

router.post("/", requireRole("manager"), async (req, res, next) => {
  try {
    const me = req.user!;
    let role: "manager" | "interviewer";
    let stratumId: string | null = null;
    let managerId: string | null = null;

    if (me.role === "manager") {
      if (req.body.role && req.body.role !== "interviewer") {
        res.status(403).json({ error: "manager_can_only_create_interviewer" });
        return;
      }
      role = "interviewer";
      managerId = me.id;
    } else {
      // admin (requireRole manager também deixa admin passar)
      role = req.body.role;
      if (role === "manager") {
        stratumId = req.body.stratumId ?? null;
        if (!stratumId) { res.status(400).json({ error: "stratum_required" }); return; }
      } else if (role === "interviewer") {
        managerId = req.body.managerId ?? null;
        if (!managerId) { res.status(400).json({ error: "manager_required" }); return; }
      } else {
        res.status(400).json({ error: "invalid_role" }); return;
      }
    }

    const token = randomBytes(24).toString("base64url");
    const r = await db.execute(sql`
      INSERT INTO invites (token, role, stratum_id, manager_id, created_by, expires_at)
      VALUES (${token}, ${role}::user_role, ${stratumId}, ${managerId}, ${me.id}, now() + interval '7 days')
      RETURNING id, token, role, expires_at`);
    res.status(201).json({ ...r.rows[0], url: inviteUrl(token) });
  } catch (e) { next(e); }
});

router.get("/", requireRole("manager"), async (req, res, next) => {
  try {
    const me = req.user!;
    const scope = me.role === "manager" ? sql`WHERE i.created_by = ${me.id}` : sql``;
    const r = await db.execute(sql`
      SELECT i.id, i.token, i.role, i.expires_at, i.used_at,
             u.name AS used_by_name, s.name AS stratum_name, m.name AS manager_name,
             (i.used_at IS NOT NULL) AS used, (i.used_at IS NULL AND i.expires_at < now()) AS expired
      FROM invites i
      LEFT JOIN users u ON u.id = i.used_by
      LEFT JOIN strata s ON s.id = i.stratum_id
      LEFT JOIN users m ON m.id = i.manager_id
      ${scope}
      ORDER BY i.created_at DESC LIMIT 100`);
    res.json({ invites: r.rows.map((x) => ({ ...x, url: inviteUrl(x.token as string) })) });
  } catch (e) { next(e); }
});

export default router;

// ─── Público (ler contexto / aceitar) — montar antes do requireAuth ──
export const publicInvitesRouter = Router();

publicInvitesRouter.get("/:token", async (req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT i.role, i.used_at, i.expires_at, s.name AS stratum_name,
             m.name AS manager_name, ms.name AS manager_zone
      FROM invites i
      LEFT JOIN strata s ON s.id = i.stratum_id
      LEFT JOIN users m ON m.id = i.manager_id
      LEFT JOIN strata ms ON ms.id = m.stratum_id
      WHERE i.token = ${req.params.token} LIMIT 1`);
    const inv = r.rows[0] as any;
    if (!inv) { res.json({ valid: false, reason: "not_found" }); return; }
    if (inv.used_at) { res.json({ valid: false, reason: "used" }); return; }
    if (new Date(inv.expires_at) < new Date()) { res.json({ valid: false, reason: "expired" }); return; }
    const contextLabel = inv.role === "manager"
      ? `Gerente · ${inv.stratum_name ?? "zona"}`
      : `Entrevistador · equipe de ${inv.manager_name ?? "—"}${inv.manager_zone ? " (" + inv.manager_zone + ")" : ""}`;
    res.json({ valid: true, role: inv.role, contextLabel });
  } catch (e) { next(e); }
});

const AcceptSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

publicInvitesRouter.post("/:token/accept", async (req, res, next) => {
  try {
    const body = AcceptSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const out = await db.transaction(async (tx) => {
      const ir = await tx.execute(sql`
        SELECT id, role, stratum_id, manager_id, created_by FROM invites
        WHERE token = ${req.params.token} AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`);
      const inv = ir.rows[0] as
        | { id: string; role: string; stratum_id: string | null; manager_id: string | null; created_by: string }
        | undefined;
      if (!inv) return { invalid: true } as const;

      const role = inv.role;
      const stratumId = role === "manager" ? inv.stratum_id : null;
      const managerId = role === "interviewer" ? inv.manager_id : null;
      const regCode = role === "interviewer" ? await nextInterviewerCode(tx) : null;

      const ur = await tx.execute(sql`
        INSERT INTO users (name, email, password_hash, role, registration_code, manager_id, stratum_id, created_by)
        VALUES (${body.name}, ${body.email.toLowerCase()}, ${passwordHash}, ${role}::user_role, ${regCode}, ${managerId}, ${stratumId}, ${inv.created_by})
        RETURNING id`);
      const userId = ur.rows[0]!.id as string;

      const upd = await tx.execute(sql`
        UPDATE invites SET used_at = now(), used_by = ${userId} WHERE id = ${inv.id} AND used_at IS NULL RETURNING id`);
      if (upd.rows.length === 0) throw new Error("race"); // rollback

      return { ok: true, role } as const;
    });

    if ((out as any).invalid) { res.status(410).json({ error: "invite_invalid_or_used" }); return; }
    res.status(201).json(out);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "email_already_exists" }); return; }
    next(e);
  }
});
