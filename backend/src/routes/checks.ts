// Supervisão — PROMPT §5 (role supervisor+) + CA #5, #6.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole, teamScope } from "../middleware/rbac.js";
import { decrementQuota } from "../services/quotaService.js";
import { reconcile } from "../services/cache.js";

const router = Router();
router.use(requireRole("supervisor"), teamScope);

// GET /api/checks/queue — pendentes; short_duration no topo, depois demais
// flags, depois mais antigas (CA #5). Escopo por equipe quando manager (§12).
router.get("/queue", async (req, res, next) => {
  try {
    const me = req.user!;
    const scope = me.role === "manager" ? sql` AND u.manager_id = ${me.id}` : sql``;
    const r = await db.execute(sql`
      SELECT ch.id AS check_id, i.id AS interview_id, i.receipt_code, i.fraud_flags,
             i.duration_sec, i.synced_at, s.region, u.name AS interviewer, s.name AS stratum
      FROM checks ch
      JOIN interviews i ON i.id = ch.interview_id
      JOIN users u ON u.id = i.interviewer_id
      JOIN strata s ON s.id = i.stratum_id
      WHERE ch.result IS NULL${scope}
      ORDER BY (i.fraud_flags @> '["short_duration"]'::jsonb) DESC,
               jsonb_array_length(i.fraud_flags) DESC,
               i.synced_at ASC
      LIMIT 200`);
    res.json({ queue: r.rows });
  } catch (e) {
    next(e);
  }
});

const ResultSchema = z.object({
  result: z.enum(["approved", "rejected"]),
  reason: z.string().optional(),
  method: z.enum(["in_loco", "audio"]).optional(),
});

// POST /api/checks/:id/result — reprovação decrementa cota, status=rejected
// (sai da apuração) e dispara reposição (CA #6).
router.post("/:id/result", async (req, res, next) => {
  try {
    const body = ResultSchema.parse(req.body);
    const me = req.user!;
    const out = await db.transaction(async (tx) => {
      // Carrega a checagem + entrevista, respeitando escopo de equipe.
      const scope = me.role === "manager" ? sql` AND u.manager_id = ${me.id}` : sql``;
      const c = await tx.execute(sql`
        SELECT ch.id, i.id AS interview_id, i.quota_id, ch.result AS current_result
        FROM checks ch
        JOIN interviews i ON i.id = ch.interview_id
        JOIN users u ON u.id = i.interviewer_id
        WHERE ch.id = ${req.params.id}${scope} LIMIT 1`);
      if (!c.rows.length) return { notFound: true } as const;
      const row = c.rows[0] as { interview_id: string; quota_id: string; current_result: string | null };

      await tx.execute(sql`
        UPDATE checks SET supervisor_id = ${me.id}, result = ${body.result}::check_result,
               reason = ${body.reason ?? null}, method = ${body.method ?? null}, checked_at = now()
        WHERE id = ${req.params.id}`);

      if (body.result === "rejected") {
        await tx.execute(sql`UPDATE interviews SET status = 'rejected' WHERE id = ${row.interview_id}`);
        // Só decrementa se ainda não havia sido reprovada antes (idempotência).
        if (row.current_result !== "rejected") {
          await decrementQuota(tx, row.quota_id);
          await tx.execute(sql`
            INSERT INTO audit_log (user_id, action, entity, entity_id, meta)
            VALUES (${me.id}, 'reposition_triggered', 'interview', ${row.interview_id}, ${JSON.stringify({ quotaId: row.quota_id })}::jsonb)`);
        }
      } else {
        await tx.execute(sql`UPDATE interviews SET status = 'approved' WHERE id = ${row.interview_id}`);
      }
      return { notFound: false, interviewId: row.interview_id, result: body.result } as const;
    });

    if (out.notFound) {
      res.status(404).json({ error: "not_found_or_out_of_scope" });
      return;
    }
    // Reprovação muda a apuração (CA #6) → reconcilia o cache (§6).
    if (out.result === "rejected") void reconcile();
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
