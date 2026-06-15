// Uploads — PROMPT §5. POST /api/uploads/presign.
import { Router } from "express";
import { z } from "zod";
import { requireAnyRole } from "../middleware/rbac.js";

const router = Router();

export const PresignSchema = z.object({
  kind: z.enum(["photo", "audio"]),
  interviewClientUuid: z.string().uuid(),
  seq: z.number().int().min(1).max(3).optional(),
});

router.post("/presign", requireAnyRole("interviewer"), async (_req, res) => {
  // TODO §5: monta storageKey e retorna { uploadUrl, storageKey } (services/storage.presignPut)
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (/uploads/presign)" });
});

export default router;
