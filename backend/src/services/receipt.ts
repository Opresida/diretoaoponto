// Código de recibo determinístico — PROMPT §14.1.
// MESMA função no app (offline) e no backend → ambos chegam ao mesmo código.
import { createHash } from "crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // base32 sem 0/O/1/I/L (anti-confusão)

export function receiptCode(clientUuid: string, year: number): string {
  const h = createHash("sha256").update(clientUuid).digest();
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[h[i]! % 32];
  return `DAP-${year}-${out.slice(0, 4)}-${out.slice(4)}`; // DAP-2026-7K3M-9XQ2
}
