// Uploads — PROMPT §5 + F2 (foto de candidato). POST /api/uploads/presign.
import { Router } from "express";
import { z } from "zod";
import { presignPut, buildStorageKey, buildCandidateKey } from "../services/storage.js";

const RANK: Record<string, number> = {
  interviewer: 1, supervisor: 2, statistician: 3, coordinator: 4, manager: 5, admin: 6,
};

const router = Router();

export const PresignSchema = z.object({
  kind: z.enum(["photo", "audio", "candidate"]),
  interviewClientUuid: z.string().uuid().optional(), // photo/audio
  seq: z.number().int().min(1).max(3).optional(), // photo
  candidateId: z.string().uuid().optional(), // candidate
});

router.post("/presign", async (req, res, next) => {
  try {
    if (!process.env.S3_ACCESS_KEY) {
      res.status(501).json({ error: "storage_not_configured", ref: "PROMPT §2 (S3/R2)" });
      return;
    }
    const body = PresignSchema.parse(req.body);
    const role = req.user!.role;

    if (body.kind === "candidate") {
      if (role !== "admin") { res.status(403).json({ error: "forbidden" }); return; }
      if (!body.candidateId) { res.status(422).json({ error: "candidateId_required" }); return; }
      const storageKey = buildCandidateKey(body.candidateId);
      res.json({ uploadUrl: await presignPut(storageKey), storageKey });
      return;
    }

    // photo/audio — entrevistador+.
    if ((RANK[role] ?? 0) < 1) { res.status(403).json({ error: "forbidden" }); return; }
    if (!body.interviewClientUuid) { res.status(422).json({ error: "interviewClientUuid_required" }); return; }
    if (body.kind === "photo" && !body.seq) { res.status(422).json({ error: "seq_required_for_photo" }); return; }
    const storageKey = buildStorageKey(body.kind, body.interviewClientUuid, body.seq);
    res.json({ uploadUrl: await presignPut(storageKey), storageKey });
  } catch (e) {
    next(e);
  }
});

export default router;
