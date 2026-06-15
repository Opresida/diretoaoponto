// Uploads — PROMPT §5. POST /api/uploads/presign.
import { Router } from "express";
import { z } from "zod";
import { requireAnyRole } from "../middleware/rbac.js";
import { presignPut, buildStorageKey } from "../services/storage.js";

const router = Router();

export const PresignSchema = z.object({
  kind: z.enum(["photo", "audio"]),
  interviewClientUuid: z.string().uuid(),
  seq: z.number().int().min(1).max(3).optional(),
});

router.post("/presign", requireAnyRole("interviewer"), async (req, res, next) => {
  try {
    if (!process.env.S3_ACCESS_KEY) {
      res.status(501).json({ error: "storage_not_configured", ref: "PROMPT §2 (S3/R2)" });
      return;
    }
    const body = PresignSchema.parse(req.body);
    if (body.kind === "photo" && !body.seq) {
      res.status(422).json({ error: "seq_required_for_photo" });
      return;
    }
    const storageKey = buildStorageKey(body.kind, body.interviewClientUuid, body.seq);
    res.json({ uploadUrl: await presignPut(storageKey), storageKey });
  } catch (e) {
    next(e);
  }
});

export default router;
