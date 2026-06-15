// Verificação pública — PROMPT §13.4 + §14.2. SEM autenticação, rate-limited.
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { contentHash } from "../services/hash.js";
import { verifyProof } from "../services/merkle.js";

const router = Router();

// ─── Rate limit simples por IP (20 req/min) ──────────────────────────
const hits = new Map<string, { n: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now - slot.ts > 60_000) {
    hits.set(ip, { n: 1, ts: now });
    return false;
  }
  slot.n++;
  return slot.n > 20;
}

interface InterviewRow {
  id: string;
  client_uuid: string;
  started_at: string;
  ended_at: string;
  gps_start: { lat: number; lng: number };
  gps_end: { lat: number; lng: number };
  payload_hash: string | null;
  anchor_id: string | null;
  merkle_proof: string[] | null;
  synced_at: string;
}

async function loadByReceipt(code: string): Promise<InterviewRow | null> {
  const r = await db.execute(sql`
    SELECT id, client_uuid, started_at, ended_at, gps_start, gps_end,
           payload_hash, anchor_id, merkle_proof, synced_at
    FROM interviews WHERE receipt_code = ${code} LIMIT 1`);
  return (r.rows[0] as InterviewRow | undefined) ?? null;
}

async function loadById(id: string): Promise<InterviewRow | null> {
  const r = await db.execute(sql`
    SELECT id, client_uuid, started_at, ended_at, gps_start, gps_end,
           payload_hash, anchor_id, merkle_proof, synced_at
    FROM interviews WHERE id = ${id} LIMIT 1`);
  return (r.rows[0] as InterviewRow | undefined) ?? null;
}

/** Recalcula o hash de conteúdo a partir do estado ATUAL do banco (CA #10). */
async function recomputeContentHash(it: InterviewRow): Promise<string> {
  const ans = await db.execute(sql`
    SELECT a.question_code AS q, c.name AS c, a.value_text AS v
    FROM answers a LEFT JOIN candidates c ON c.id = a.candidate_id
    WHERE a.interview_id = ${it.id} ORDER BY a.question_code`);
  return contentHash(
    {
      clientUuid: it.client_uuid,
      startedAt: new Date(it.started_at).getTime(),
      endedAt: new Date(it.ended_at).getTime(),
      gpsStart: it.gps_start,
      gpsEnd: it.gps_end,
      answers: ans.rows.map((x) => ({
        q: x.q as string,
        c: (x.c as string) ?? null,
        v: (x.v as string) ?? null,
      })),
    },
    process.env.HASH_SALT ?? "",
  );
}

function explorerUrl(chain: string, txHash: string | null): string | null {
  if (!txHash) return null;
  const host = chain === "base-sepolia" ? "https://sepolia.basescan.org" : "https://basescan.org";
  return `${host}/tx/${txHash}`;
}

/** Núcleo da verificação — reverifica a prova de Merkle em tempo real. */
async function buildVerifyResponse(it: InterviewRow | null) {
  if (!it) return { status: "not_found" as const };
  if (!it.anchor_id) {
    return { status: "pending_anchor" as const, registeredAt: it.synced_at };
  }
  const a = await db.execute(sql`
    SELECT merkle_root, tx_hash, block_number, chain, anchored_at FROM anchors WHERE id = ${it.anchor_id} LIMIT 1`);
  const anchor = a.rows[0] as
    | { merkle_root: string; tx_hash: string | null; block_number: number | null; chain: string; anchored_at: string }
    | undefined;
  if (!anchor) return { status: "pending_anchor" as const, registeredAt: it.synced_at };

  // CA #10 — conteúdo do banco ainda gera o hash ancorado?
  const recomputed = await recomputeContentHash(it);
  const contentOk = recomputed === it.payload_hash;
  // Prova de inclusão na raiz registrada.
  const proofOk =
    !!it.payload_hash && !!it.merkle_proof && verifyProof(it.payload_hash, it.merkle_proof, anchor.merkle_root);

  if (!contentOk || !proofOk) {
    return {
      status: "integrity_failed" as const,
      registeredAt: it.synced_at,
      anchoredAt: anchor.anchored_at,
      txHash: anchor.tx_hash,
    };
  }
  return {
    status: "sealed_valid" as const,
    registeredAt: it.synced_at,
    anchoredAt: anchor.anchored_at,
    txHash: anchor.tx_hash,
    blockNumber: anchor.block_number,
    explorerUrl: explorerUrl(anchor.chain, anchor.tx_hash),
    technical: {
      payloadHash: it.payload_hash,
      merkleRoot: anchor.merkle_root,
      merkleProof: it.merkle_proof,
      contract: process.env.ANCHOR_CONTRACT_ADDRESS ?? null,
      chain: anchor.chain,
    },
  };
}

// ─── Verificação de RELATÓRIO selado (§13) ───────────────────────────
import { sha256Hex } from "../services/hash.js";
import { canonicalize } from "json-canonicalize";

async function buildReportVerify(code: string) {
  const r = await db.execute(sql`
    SELECT code, content_hash, payload, status, chain, tx_hash, block_number,
           anchored_at, generated_at
    FROM reports WHERE code = ${code} LIMIT 1`);
  const rep = r.rows[0] as
    | { code: string; content_hash: string; payload: any; status: string; chain: string | null;
        tx_hash: string | null; block_number: number | null; anchored_at: string | null; generated_at: string }
    | undefined;
  if (!rep) return { status: "not_found" as const };

  // Recomputa o hash do payload congelado e confere contra o que foi selado.
  const { code: _c, ...sealable } = rep.payload ?? {};
  const recomputed = sha256Hex(canonicalize(sealable) + (process.env.HASH_SALT ?? ""));
  const contentOk = recomputed === rep.content_hash;

  const summary = {
    instituto: rep.payload?.ficha?.instituto ?? null,
    pesquisa: rep.payload?.ficha?.pesquisa ?? null,
    amostra: rep.payload?.ficha?.amostraColetada ?? null,
    margemErro: rep.payload?.ficha?.margemErro ?? null,
    entrevistas: rep.payload?.entrevistas?.length ?? 0,
  };

  if (!contentOk) {
    return { status: "integrity_failed" as const, code: rep.code, generatedAt: rep.generated_at, summary };
  }
  if (rep.status !== "anchored" || !rep.tx_hash) {
    return { status: "pending_anchor" as const, code: rep.code, generatedAt: rep.generated_at, summary };
  }
  return {
    status: "sealed_valid" as const,
    code: rep.code,
    generatedAt: rep.generated_at,
    anchoredAt: rep.anchored_at,
    txHash: rep.tx_hash,
    blockNumber: rep.block_number,
    explorerUrl: explorerUrl(rep.chain ?? "base", rep.tx_hash),
    summary,
    technical: {
      contentHash: rep.content_hash,
      chain: rep.chain,
      contract: process.env.ANCHOR_CONTRACT_ADDRESS ?? null,
    },
  };
}

// GET /api/verify/report/:code — verificação pública de relatório selado.
router.get("/report/:code", async (req, res, next) => {
  try {
    const ip = req.ip ?? "unknown";
    if (rateLimited(ip)) { res.status(429).json({ error: "rate_limited" }); return; }
    res.json(await buildReportVerify(req.params.code));
  } catch (e) { next(e); }
});

// GET /api/verify/id/:interviewId — modo auditor por id (§13.4).
router.get("/id/:interviewId", async (req, res, next) => {
  try {
    res.json(await buildVerifyResponse(await loadById(req.params.interviewId)));
  } catch (e) {
    next(e);
  }
});

// GET /api/verify/:code — recibo público (§14.2).
router.get("/:code", async (req, res, next) => {
  try {
    const ip = req.ip ?? "unknown";
    if (rateLimited(ip)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    res.json(await buildVerifyResponse(await loadByReceipt(req.params.code)));
  } catch (e) {
    next(e);
  }
});

export default router;
