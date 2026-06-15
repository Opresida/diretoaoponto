// Recálculo do hash do dispositivo — PROMPT §13.2.
// O hash nasce no app (Web Crypto, offline) ANTES de tocar o servidor:
//   payloadHash = sha256(canonicalize(payload) + HASH_SALT)
// O backend recalcula a partir do payload recebido e compara; divergência
// → fraud_flags += 'hash_mismatch' (adulteração em trânsito ou app modificado).
import { createHash } from "crypto";
import { canonicalize } from "json-canonicalize";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface DevicePayload {
  clientUuid: string;
  answers: Array<{ questionCode: string; candidateName?: string; valueText?: string }>;
  gpsStart: { lat: number; lng: number; accuracy?: number };
  gpsEnd: { lat: number; lng: number; accuracy?: number };
  startedAt: string;
  endedAt: string;
  photoHashes: string[];
  audioHash: string | null;
}

/** Recalcula o hash do dispositivo (§13.2) — usado p/ detectar adulteração
 *  EM TRÂNSITO (flag hash_mismatch). Deve casar byte-a-byte com o app. */
export function recomputeHash(payload: DevicePayload, salt: string): string {
  return sha256Hex(canonicalize(payload) + salt);
}

// ─── Hash de conteúdo (leaf ancorado + reverificação) ────────────────
// Diferente do hash do dispositivo: é computado a partir SOMENTE de campos
// que persistimos e conseguimos reconstruir do banco. É ESTE hash que vira
// folha da Merkle e que o /verify recalcula contra o banco — permitindo
// detectar adulteração PÓS-sync (CA #10). Normalizado (epoch ms, answers
// ordenadas) p/ ser determinístico independente de fuso/ordem de inserção.
export interface ContentInput {
  clientUuid: string;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  gpsStart: { lat: number; lng: number };
  gpsEnd: { lat: number; lng: number };
  answers: Array<{ q: string; c: string | null; v: string | null }>;
}

export function contentHash(input: ContentInput, salt: string): string {
  const norm = {
    clientUuid: input.clientUuid,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    gpsStart: { lat: input.gpsStart.lat, lng: input.gpsStart.lng },
    gpsEnd: { lat: input.gpsEnd.lat, lng: input.gpsEnd.lng },
    answers: [...input.answers].sort((a, b) => a.q.localeCompare(b.q)),
  };
  return sha256Hex(canonicalize(norm) + salt);
}
