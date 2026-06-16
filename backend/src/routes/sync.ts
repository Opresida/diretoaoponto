// POST /api/sync/interviews — batch idempotente. PROMPT §5 (Campo) + §13.2.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireAnyRole } from "../middleware/rbac.js";
import { computeFraudFlags } from "../services/fraudFlags.js";
import { tryIncrementQuota } from "../services/quotaService.js";
import { resolveCandidateId, questionToOffice, NON_CANDIDATE } from "../services/candidates.js";
import { shouldEnqueueCheck, enqueueCheck } from "../services/checkQueue.js";
import { recomputeHash, contentHash } from "../services/hash.js";
import { receiptCode } from "../services/receipt.js";
import { buildStorageKey } from "../services/storage.js";
import { getSnapshot, incrementForInterview } from "../services/cache.js";
import { broadcastApuracao } from "../ws/apuracao.js";
import { enqueue } from "../jobs/queue.js";
import { PHOTO_WATERMARK_QUEUE } from "../jobs/photoWatermark.js";
import { AUDIO_TRANSCODE_QUEUE } from "../jobs/audioTranscode.js";

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
        // §13.2 — integridade: hash do dispositivo + componentes p/ recálculo
        payloadHash: z.string().optional(),
        deviceHashedAt: z.string().datetime().optional(),
        photoHashes: z.array(z.string()).optional(),
        audioHash: z.string().nullable().optional(),
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

type SyncInterview = z.infer<typeof SyncSchema>["interviews"][number];

class RejectInterview extends Error {}

const router = Router();

router.post("/interviews", requireAnyRole("interviewer"), async (req, res, next) => {
  try {
    const body = SyncSchema.parse(req.body);
    const interviewerId = req.user!.id;
    const interviewerName = req.user!.name;
    const year = new Date(body.interviews[0]!.startedAt).getUTCFullYear();
    const results: unknown[] = [];
    let anyInserted = false;

    for (const it of body.interviews) {
      try {
        const out = await db.transaction((tx) =>
          processOne(tx, it, interviewerId, interviewerName, year),
        );
        results.push(out);
        if ((out as { status: string }).status === "inserted") {
          anyInserted = true;
          // 8. jobs de pós-processamento (no-op se sem Redis)
          if (it.photos.length) {
            void enqueue(PHOTO_WATERMARK_QUEUE, "watermark", {
              photos: it.photos.map((p) => ({ storageKey: p.storageKey, takenAt: p.takenAt, gps: p.gps })),
            });
          }
          if (it.audioKey) {
            void enqueue(AUDIO_TRANSCODE_QUEUE, "transcode", { audioKey: it.audioKey });
          }
          // 7. broadcast WebSocket (< 500ms — CA #4)
          void broadcastOne(out as BroadcastInterview);
        }
      } catch (e) {
        if (e instanceof RejectInterview) {
          results.push({ clientUuid: it.clientUuid, status: "rejected", reason: e.message });
        } else {
          throw e;
        }
      }
    }

    res.status(anyInserted ? 201 : 200).json({ results });
  } catch (e) {
    next(e);
  }
});

interface BroadcastInterview {
  status: string;
  id: string;
  interviewerName: string;
  area: string;
  region: string;
  profile: string;
  durationSec: number;
  flags: string[];
  govVote: string | null;
  senateNames: string[];
}

// ─── Lógica do sync (transação por entrevista) — PROMPT §5 ────────────
async function processOne(
  tx: any,
  it: SyncInterview,
  interviewerId: string,
  interviewerName: string,
  year: number,
) {
  // 1. Idempotência — client_uuid único.
  const dup = await tx.execute(
    sql`SELECT id, receipt_code FROM interviews WHERE client_uuid = ${it.clientUuid} LIMIT 1`,
  );
  if (dup.rows.length) {
    return {
      clientUuid: it.clientUuid,
      status: "duplicate" as const,
      receiptCode: dup.rows[0].receipt_code,
    };
  }

  // 2. Regra do Senado: sen_v1 !== sen_v2 (exceto Branco/Nulo/NS-NR).
  const sv1 = it.answers.find((a) => a.questionCode === "sen_v1")?.candidateName;
  const sv2 = it.answers.find((a) => a.questionCode === "sen_v2")?.candidateName;
  if (sv1 && sv2 && sv1 === sv2 && !NON_CANDIDATE.has(sv1)) {
    throw new RejectInterview("senado_duplicate_vote");
  }

  // Contexto do estrato (region, polígono, project) e perfil da cota.
  const st = await tx.execute(
    sql`SELECT project_id, region, zone, municipality, census_polygon FROM strata WHERE id = ${it.stratumId} LIMIT 1`,
  );
  if (!st.rows.length) throw new RejectInterview("stratum_not_found");
  const stratum = st.rows[0];
  const qz = await tx.execute(sql`SELECT label FROM quotas WHERE id = ${it.quotaId} LIMIT 1`);
  if (!qz.rows.length) throw new RejectInterview("quota_not_found");
  const profile = qz.rows[0].label as string;

  // 3. fraud_flags (inclui hash_mismatch — §13.2).
  const durationSec = Math.max(
    0,
    Math.floor((Date.parse(it.endedAt) - Date.parse(it.startedAt)) / 1000),
  );
  let hashMismatch = false;
  if (it.payloadHash && process.env.HASH_SALT) {
    const recomputed = recomputeHash(
      {
        clientUuid: it.clientUuid,
        answers: it.answers,
        gpsStart: it.gpsStart,
        gpsEnd: it.gpsEnd,
        startedAt: it.startedAt,
        endedAt: it.endedAt,
        photoHashes: it.photoHashes ?? [],
        audioHash: it.audioHash ?? null,
      },
      process.env.HASH_SALT,
    );
    hashMismatch = recomputed !== it.payloadHash;
  }
  const flags = computeFraudFlags({
    durationSec,
    consentPhoto: it.consentPhoto,
    photoCount: it.photos.length,
    gpsStart: it.gpsStart,
    censusPolygon: stratum.census_polygon ?? null,
    hashMismatch,
  });

  // Hash de conteúdo reconstruível → folha ancorada + base do /verify (§13/§14).
  const serverHash = contentHash(
    {
      clientUuid: it.clientUuid,
      startedAt: Date.parse(it.startedAt),
      endedAt: Date.parse(it.endedAt),
      gpsStart: it.gpsStart,
      gpsEnd: it.gpsEnd,
      answers: it.answers.map((a) => ({
        q: a.questionCode,
        c: a.candidateName ?? null,
        v: a.valueText ?? null,
      })),
    },
    process.env.HASH_SALT ?? "",
  );

  // 4. Cota — incrementa com WHERE completed < target; senão rejeita.
  const quotaOk = await tryIncrementQuota(tx, it.quotaId);
  if (!quotaOk) throw new RejectInterview("quota_full");

  // 6. Decisão de checagem (flags = prioridade; senão garante 20%).
  const enqueueChk = await shouldEnqueueCheck(tx, interviewerId, flags.length > 0);
  const status = enqueueChk ? "pending_check" : "synced";

  // Insere a entrevista.
  const code = receiptCode(it.clientUuid, year);
  const ins = await tx.execute(sql`
    INSERT INTO interviews (
      client_uuid, project_id, interviewer_id, stratum_id, quota_id,
      respondent_sex, respondent_age, consent_lgpd, consent_photo,
      started_at, ended_at, gps_start, gps_end, audio_key,
      status, fraud_flags, payload_hash, device_hashed_at, receipt_code
    ) VALUES (
      ${it.clientUuid}, ${stratum.project_id}, ${interviewerId}, ${it.stratumId}, ${it.quotaId},
      ${it.respondent.sex}, ${it.respondent.age}, ${it.consentLgpd}, ${it.consentPhoto},
      ${it.startedAt}, ${it.endedAt}, ${JSON.stringify(it.gpsStart)}::jsonb, ${JSON.stringify(it.gpsEnd)}::jsonb, ${it.audioKey ? buildStorageKey("audio", it.clientUuid) : null},
      ${status}::interview_status, ${JSON.stringify(flags)}::jsonb, ${serverHash}, ${it.deviceHashedAt ?? null}, ${code}
    ) RETURNING id`);
  const interviewId = ins.rows[0].id as string;

  // 5. Respostas + resolução de candidatos (cria espontânea inédita).
  let govVote: string | null = null;
  const senateNames: string[] = [];
  for (const a of it.answers) {
    let candidateId: string | null = null;
    const office = questionToOffice(a.questionCode);
    if (a.candidateName && office) {
      candidateId = await resolveCandidateId(tx, a.candidateName, office);
    }
    if (a.questionCode === "gov_c1" && a.candidateName) govVote = a.candidateName;
    if ((a.questionCode === "sen_v1" || a.questionCode === "sen_v2") && a.candidateName) {
      senateNames.push(a.candidateName);
    }
    await tx.execute(sql`
      INSERT INTO answers (interview_id, question_code, candidate_id, value_text)
      VALUES (${interviewId}, ${a.questionCode}, ${candidateId}, ${a.valueText ?? null})
      ON CONFLICT (interview_id, question_code) DO NOTHING`);
  }

  // Fotos. PT-004: a storage_key é RECONSTRUÍDA no servidor a partir do clientUuid+seq
  // (ignora a enviada pelo cliente) — fecha injeção de referência de objeto no bucket.
  for (const p of it.photos) {
    const photoKey = buildStorageKey("photo", it.clientUuid, p.seq);
    await tx.execute(sql`
      INSERT INTO interview_photos (interview_id, seq, storage_key, taken_at, gps)
      VALUES (${interviewId}, ${p.seq}, ${photoKey}, ${p.takenAt}, ${p.gps ? JSON.stringify(p.gps) : null}::jsonb)
      ON CONFLICT (interview_id, seq) DO NOTHING`);
  }

  // 6. Entrada na fila de checagem.
  if (enqueueChk) await enqueueCheck(tx, interviewId);

  return {
    clientUuid: it.clientUuid,
    status: "inserted" as const,
    receiptCode: code,
    flags,
    id: interviewId,
    interviewerName,
    area: (stratum.zone as string) ?? (stratum.municipality as string),
    region: stratum.region as string,
    profile,
    durationSec,
    govVote,
    senateNames,
  };
}

// 7. Broadcast — incrementa o cache (§6) e publica o snapshot dos 3 recortes.
async function broadcastOne(out: BroadcastInterview): Promise<void> {
  await incrementForInterview({
    region: out.region as "manaus" | "interior",
    govCandidate: out.govVote,
    senate: out.senateNames,
  });
  const apuracao = await getSnapshot();
  broadcastApuracao({
    type: "interview:new",
    interview: {
      id: out.id,
      interviewer: out.interviewerName,
      area: out.area,
      region: out.region,
      profile: out.profile,
      durationSec: out.durationSec,
      flags: out.flags,
      // sigilo do voto: o voto individual NUNCA é transmitido (só entra no agregado acima).
    },
    apuracao,
  });
}

export default router;
