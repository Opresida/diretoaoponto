// Mídia de auditoria — PROMPT §5 (supervisor+) + CA #7.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole, teamScope } from "../middleware/rbac.js";
import { presignGet } from "../services/storage.js";

const router = Router();

// GET /api/interviews — auditoria: lista TODAS as entrevistas (supervisor+),
// com filtros. Manager vê só a própria equipe (teamScope).
const ListSchema = z.object({
  status: z.enum(["synced", "approved", "rejected", "pending_check"]).optional(),
  region: z.enum(["manaus", "interior"]).optional(),
  municipality: z.string().optional(),
  zone: z.string().optional(),
  flagged: z.coerce.boolean().optional(),
  withMedia: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(100),
});

router.get("/", requireRole("supervisor"), teamScope, async (req, res, next) => {
  try {
    const q = ListSchema.parse(req.query);
    const me = req.user!;
    const conds = [sql`1=1`];
    if (q.status) conds.push(sql`i.status = ${q.status}::interview_status`);
    if (q.region) conds.push(sql`s.region = ${q.region}::region_t`);
    if (q.municipality) conds.push(sql`s.municipality = ${q.municipality}`);
    if (q.zone) conds.push(sql`s.zone = ${q.zone}`);
    if (q.flagged) conds.push(sql`jsonb_array_length(i.fraud_flags) > 0`);
    if (q.withMedia) conds.push(sql`(i.audio_key IS NOT NULL OR EXISTS (SELECT 1 FROM interview_photos p WHERE p.interview_id = i.id))`);
    if (me.role === "manager") conds.push(sql`u.manager_id = ${me.id}`);
    const where = sql.join(conds, sql` AND `);

    const r = await db.execute(sql`
      SELECT i.id, i.receipt_code, i.status, i.duration_sec, i.fraud_flags, i.synced_at,
             u.name AS interviewer, s.name AS stratum, s.region,
             (i.audio_key IS NOT NULL) AS has_audio,
             (SELECT COUNT(*) FROM interview_photos p WHERE p.interview_id = i.id)::int AS photo_count
      FROM interviews i
      JOIN users u ON u.id = i.interviewer_id
      JOIN strata s ON s.id = i.stratum_id
      WHERE ${where}
      ORDER BY i.synced_at DESC
      LIMIT ${q.limit}`);
    res.json({ interviews: r.rows });
  } catch (e) { next(e); }
});

router.get("/:id/media", requireRole("supervisor"), async (req, res, next) => {
  try {
    if (!process.env.S3_ACCESS_KEY) {
      res.status(501).json({ error: "storage_not_configured", ref: "PROMPT §2 (S3/R2)" });
      return;
    }
    const it = await db.execute(sql`
      SELECT i.audio_key, u.manager_id
      FROM interviews i JOIN users u ON u.id = i.interviewer_id
      WHERE i.id = ${req.params.id} LIMIT 1`);
    if (!it.rows.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    // Gerente só acessa mídia da própria equipe (supervisor+/admin veem tudo).
    const me = req.user!;
    if (me.role === "manager" && it.rows[0]!.manager_id !== me.id) {
      res.status(403).json({ error: "out_of_scope" });
      return;
    }
    const photos = await db.execute(sql`
      SELECT seq, storage_key FROM interview_photos WHERE interview_id = ${req.params.id} ORDER BY seq`);

    const audioKey = it.rows[0]!.audio_key as string | null;
    res.json({
      audio: audioKey ? await presignGet(audioKey, 600) : null, // expira 10 min (CA #7)
      photos: await Promise.all(
        photos.rows.map(async (p) => ({
          seq: p.seq,
          url: await presignGet(p.storage_key as string, 600),
        })),
      ),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
