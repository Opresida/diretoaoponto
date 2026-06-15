// E2E mídia: presign → upload JPEG → sync → worker watermark → /media (CA #7).
import "dotenv/config";
import sharp from "sharp";

const BASE = "http://localhost:3000";
const login = async (email) =>
  (await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha123" }),
  })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const ent = await login("ent1@diretoaoponto.org");
const sup = await login("supervisor@diretoaoponto.org");
const cu = crypto.randomUUID();

// 1. presign foto
const pre = await j(await fetch(`${BASE}/api/uploads/presign`, { method: "POST", headers: H(ent.accessToken),
  body: JSON.stringify({ kind: "photo", interviewClientUuid: cu, seq: 1 }) }));
console.log("presign →", pre.storageKey);

// 2. gera um JPEG real (retângulo) e faz upload via presigned PUT
const jpg = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 30, g: 41, b: 59 } } }).jpeg().toBuffer();
let r = await fetch(pre.uploadUrl, { method: "PUT", body: jpg, headers: { "Content-Type": "image/jpeg" } });
console.log("upload JPEG →", r.status, `(${jpg.length} bytes originais)`);

// 3. sync com a foto
const now = new Date(); const start = new Date(now.getTime() - 150000);
const sync = await j(await fetch(`${BASE}/api/sync/interviews`, { method: "POST", headers: H(ent.accessToken),
  body: JSON.stringify({ interviews: [{
    clientUuid: cu, stratumId: "49a8b4d8-b67e-4822-90ee-1261bd64e256", quotaId: "c89328a7-34e7-463a-a2eb-a3f2ded8f28a",
    respondent: { sex: "F", age: 34 }, consentLgpd: true, consentPhoto: true,
    startedAt: start.toISOString(), endedAt: now.toISOString(),
    gpsStart: { lat: -3.101, lng: -60.025 }, gpsEnd: { lat: -3.101, lng: -60.025 },
    photos: [{ seq: 1, storageKey: pre.storageKey, takenAt: now.toISOString(), gps: { lat: -3.101, lng: -60.025 } }],
    answers: [{ questionCode: "gov_c1", candidateName: "David Almeida" }],
  }] }) }));
const id = sync.results[0].id;
console.log("sync →", sync.results[0].status, "id", id);

// 4. espera o worker carimbar
await new Promise((res) => setTimeout(res, 4000));

// 5. supervisor pega a mídia (presigned GET) e baixa
const media = await j(await fetch(`${BASE}/api/interviews/${id}/media`, { headers: H(sup.accessToken) }));
console.log("media →", JSON.stringify({ photos: media.photos?.length, audio: media.audio }));
const dl = await fetch(media.photos[0].url);
const buf = Buffer.from(await dl.arrayBuffer());
const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
console.log(`download foto → ${dl.status} | JPEG válido: ${isJpeg ? "✅" : "❌"} | ${buf.length} bytes (carimbada, != ${jpg.length})`);
