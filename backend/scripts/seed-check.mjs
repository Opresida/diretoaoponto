// Cria uma entrevista "flagada" (duração curta) com foto + áudio → cai na fila
// de checagem com mídia pra demonstrar a tela do supervisor.
import "dotenv/config";
import sharp from "sharp";

const BASE = "http://127.0.0.1:3000";
const login = async (e) => (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "senha123" }) })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const ent = await login("ent1@diretoaoponto.org");
const pkg = await j(await fetch(`${BASE}/api/field/package`, { headers: H(ent.accessToken) }));
const st = pkg.strata[0];
const quota = st.quotas.find((q) => Number(q.remaining) > 0) ?? st.quotas[0];
const cu = crypto.randomUUID();
const now = new Date();
const start = new Date(now.getTime() - 30000); // 30s → flag short_duration

// foto
const jpg = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 16, g: 90, b: 60 } } }).jpeg().toBuffer();
const p1 = await j(await fetch(`${BASE}/api/uploads/presign`, { method: "POST", headers: H(ent.accessToken), body: JSON.stringify({ kind: "photo", interviewClientUuid: cu, seq: 1 }) }));
await fetch(p1.uploadUrl, { method: "PUT", body: jpg, headers: { "Content-Type": "image/jpeg" } });
// áudio
const pa = await j(await fetch(`${BASE}/api/uploads/presign`, { method: "POST", headers: H(ent.accessToken), body: JSON.stringify({ kind: "audio", interviewClientUuid: cu }) }));
await fetch(pa.uploadUrl, { method: "PUT", body: Buffer.from("AUDIO-DEMO-" + cu), headers: { "Content-Type": "audio/webm" } });

const sync = await j(await fetch(`${BASE}/api/sync/interviews`, { method: "POST", headers: H(ent.accessToken), body: JSON.stringify({ interviews: [{
  clientUuid: cu, stratumId: st.id, quotaId: quota.id, respondent: { sex: quota.sex, age: quota.age_min },
  consentLgpd: true, consentPhoto: true, startedAt: start.toISOString(), endedAt: now.toISOString(),
  gpsStart: { lat: -3.1, lng: -60 }, gpsEnd: { lat: -3.1, lng: -60 },
  photos: [{ seq: 1, storageKey: p1.storageKey, takenAt: now.toISOString(), gps: { lat: -3.1, lng: -60 } }],
  audioKey: pa.storageKey,
  answers: [{ questionCode: "gov_c1", candidateName: "David Almeida" }],
}] }) }));
console.log("entrevista flagada criada:", sync.results[0].status, "flags:", JSON.stringify(sync.results[0].flags));
