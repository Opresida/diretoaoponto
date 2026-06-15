// Mídia de auditoria — PROMPT §5 (supervisor+) + CA #7.
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { presignGet } from "../services/storage.js";

const router = Router();

router.get("/:id/media", requireRole("supervisor"), async (req, res, next) => {
  try {
    if (!process.env.S3_ACCESS_KEY) {
      res.status(501).json({ error: "storage_not_configured", ref: "PROMPT §2 (S3/R2)" });
      return;
    }
    const it = await db.execute(sql`SELECT audio_key FROM interviews WHERE id = ${req.params.id} LIMIT 1`);
    if (!it.rows.length) {
      res.status(404).json({ error: "not_found" });
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
