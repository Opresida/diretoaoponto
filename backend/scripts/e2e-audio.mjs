// E2E do áudio: replica o que o app faz (presign audio → PUT → sync c/ audioKey)
// e confirma que o supervisor recupera o áudio por link assinado (CA #7).
const BASE = "http://127.0.0.1:3000";
const login = async (email) => (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const ent = await login("ent1@diretoaoponto.org");
const pkg = await j(await fetch(`${BASE}/api/field/package`, { headers: H(ent.accessToken) }));
const st = pkg.strata[0];
const quota = st.quotas[0];
const cu = crypto.randomUUID();

// 1. presign do áudio + PUT (blob webm de teste).
const pre = await j(await fetch(`${BASE}/api/uploads/presign`, { method: "POST", headers: H(ent.accessToken), body: JSON.stringify({ kind: "audio", interviewClientUuid: cu }) }));
console.log("presign audio → key:", pre.storageKey);
const audio = Buffer.from("WEBM-AUDIO-DE-TESTE-" + cu);
let r = await fetch(pre.uploadUrl, { method: "PUT", body: audio, headers: { "Content-Type": "audio/webm" } });
console.log("upload áudio →", r.status, `(${audio.length} bytes)`);

// 2. sync da entrevista COM audioKey.
const now = new Date(); const start = new Date(now.getTime() - 150000);
const sync = await j(await fetch(`${BASE}/api/sync/interviews`, { method: "POST", headers: H(ent.accessToken), body: JSON.stringify({ interviews: [{
  clientUuid: cu, stratumId: st.id, quotaId: quota.id, respondent: { sex: quota.sex, age: quota.age_min },
  consentLgpd: true, consentPhoto: false, startedAt: start.toISOString(), endedAt: now.toISOString(),
  gpsStart: { lat: -3.1, lng: -60 }, gpsEnd: { lat: -3.1, lng: -60 }, photos: [], audioKey: pre.storageKey,
  answers: [{ questionCode: "gov_c1", candidateName: "David Almeida" }],
}] }) }));
const id = sync.results[0].id;
console.log("sync →", sync.results[0].status, "id", id);

// 3. Supervisor recupera a mídia (áudio por link assinado) e baixa.
const sup = await login("supervisor@diretoaoponto.org");
const media = await j(await fetch(`${BASE}/api/interviews/${id}/media`, { headers: H(sup.accessToken) }));
console.log("media.audio presente:", !!media.audio);
const dl = await fetch(media.audio);
const got = Buffer.from(await dl.arrayBuffer());
console.log(`download áudio → ${dl.status} | bytes conferem: ${got.equals(audio) ? "✅" : "❌"}`);
