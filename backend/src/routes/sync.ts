// POST /api/sync/interviews — batch idempotente. PROMPT §5 (Campo) + §13.2.
import { Router } from "express";
import { z } from "zod";
import { requireAnyRole } from "../middleware/rbac.js";

export const SyncSchema = z.object({
  interviews: z
    .array(
      z.object({
        clientUuid: z.string().uuid(),
        stratumId: z.string().uuid(),
        quotaId: z.string().uuid(),
        respondent: z.object({ sex: z.enum(["F", "M"]), age: z.number().int().min(16) }),
        consentLgpd: z.literal(true),
        consentPhoto: z.boolean(),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
        gpsStart: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }),
        gpsEnd: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }),
        audioKey: z.string().optional(),
        photos: z
          .array(
            z.object({
              seq: z.number().int().min(1).max(3),
              storageKey: z.string(),
              takenAt: z.string().datetime(),
              gps: z.object({ lat: z.number(), lng: z.number() }).optional(),
            }),
          )
          .max(3), // máximo 3 fotos (CA #2 → 4 fotos = 422)
        // §13.2 — hash calculado no dispositivo
        payloadHash: z.string().optional(),
        deviceHashedAt: z.string().datetime().optional(),
        answers: z.array(
          z.object({
            questionCode: z.string(),
            candidateName: z.string().optional(),
            valueText: z.string().optional(),
          }),
        ),
      }),
    )
    .min(1)
    .max(50),
});

const router = Router();

router.post("/interviews", requireAnyRole("interviewer"), async (_req, res) => {
  // TODO §5 (lógica do sync — transação por entrevista):
  //  1. ON CONFLICT (client_uuid) DO NOTHING → duplicate:true
  //  2. valida Senado sen_v1 !== sen_v2 (exceto Branco/Nulo/NS-NR)
  //  3. computeFraudFlags (services/fraudFlags)
  //  4. tryIncrementQuota (services/quotaService) — rejeita se cota cheia
  //  5. resolve candidateName → candidate_id (cria espontânea inédita)
  //  6. sorteia entrada na fila de checagem (mín 20% por entrevistador; flags = prioridade)
  //  7. recalcula hash (§13.2) → hash_mismatch
  //  8. grava receipt_code (services/receipt)
  //  9. publica no WebSocket (ws/apuracao) em < 500ms (CA #4)
  // 10. enfileira BullMQ: photo:watermark, audio:transcode
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 + §13.2" });
});

export default router;
