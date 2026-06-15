// E2E foto de candidato: upload R2 (David) + URL externa (Tadeu) → servir → field.
import "dotenv/config";
import sharp from "sharp";

const BASE = "http://127.0.0.1:3000";
const login = async (email) =>
  (await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha123" }),
  })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const admin = await login("admin@diretoaoponto.org");
const ent = await login("ent1@diretoaoponto.org");

const cands = (await j(await fetch(`${BASE}/api/candidates`, { headers: H(admin.accessToken) }))).candidates;
const david = cands.find((c) => c.name === "David Almeida");
const tadeu = cands.find((c) => c.name === "Tadeu de Souza");

// 1. Upload R2 p/ David: presign candidate → PUT jpeg → PATCH photoKey
const jpg = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 52, g: 211, b: 153 } } }).jpeg().toBuffer();
const pre = await j(await fetch(`${BASE}/api/uploads/presign`, { method: "POST", headers: H(admin.accessToken), body: JSON.stringify({ kind: "candidate", candidateId: david.id }) }));
await fetch(pre.uploadUrl, { method: "PUT", body: jpg, headers: { "Content-Type": "image/jpeg" } });
await fetch(`${BASE}/api/candidates/${david.id}`, { method: "PATCH", headers: H(admin.accessToken), body: JSON.stringify({ photoKey: pre.storageKey }) });
console.log("David: upload R2 →", pre.storageKey);

// 2. URL externa p/ Tadeu
await fetch(`${BASE}/api/candidates/${tadeu.id}`, { method: "PATCH", headers: H(admin.accessToken), body: JSON.stringify({ photoUrl: "https://placehold.co/200x200/png" }) });
console.log("Tadeu: photo_url setada");

// 3. Rota pública /photo (sem auth) — deve 302
const r1 = await fetch(`${BASE}/api/candidates/${david.id}/photo`, { redirect: "manual" });
const r2 = await fetch(`${BASE}/api/candidates/${tadeu.id}/photo`, { redirect: "manual" });
console.log("David /photo →", r1.status, "Location:", (r1.headers.get("location") || "").slice(0, 50) + "…");
console.log("Tadeu /photo →", r2.status, "Location:", r2.headers.get("location"));

// 4. field/package traz photo
const pkg = await j(await fetch(`${BASE}/api/field/package`, { headers: H(ent.accessToken) }));
const govPhotos = (pkg.candidates.governor || []).filter((c) => c.photo).map((c) => c.name);
console.log("field/package governor com foto:", JSON.stringify(govPhotos));
