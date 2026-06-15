// Código de recibo determinístico — MESMA fórmula do backend (services/receipt.ts).
// Funciona OFFLINE (Web Crypto). Garante o mesmo código no app e no servidor (CA #14).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 chars (sem 0/O/1/I/L)

export async function receiptCode(clientUuid, year) {
  const data = new TextEncoder().encode(clientUuid);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return `DAP-${year}-${out.slice(0, 4)}-${out.slice(4)}`;
}
