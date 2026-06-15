// Fluxo blockchain completo: sync novo → anchor → verify (pending→sealed) →
// adultera 1 answer no banco → verify acusa integrity_failed (CA #10, #12).
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";
neonConfig.webSocketConstructor = ws;

const BASE = "http://localhost:3000";
const login = async (email) =>
  (await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha123" }),
  })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const ent = await login("ent1@diretoaoponto.org");
const admin = await login("admin@diretoaoponto.org");

const cu = crypto.randomUUID();
const now = new Date();
const start = new Date(now.getTime() - 160000);
const sync = await j(await fetch(`${BASE}/api/sync/interviews`, { method: "POST", headers: H(ent.accessToken),
  body: JSON.stringify({ interviews: [{
    clientUuid: cu,
    stratumId: "49a8b4d8-b67e-4822-90ee-1261bd64e256",
    quotaId: "c89328a7-34e7-463a-a2eb-a3f2ded8f28a",
    respondent: { sex: "F", age: 31 }, consentLgpd: true, consentPhoto: false,
    startedAt: start.toISOString(), endedAt: now.toISOString(),
    gpsStart: { lat: -3.1, lng: -60 }, gpsEnd: { lat: -3.1, lng: -60 }, photos: [],
    answers: [{ questionCode: "gov_c1", candidateName: "David Almeida" }],
  }] }) }));
const code = sync.results[0].receiptCode;
const interviewId = sync.results[0].id;
console.log(`sync novo → receipt=${code} id=${interviewId}`);

console.log(`verify (pré-âncora) → ${(await j(await fetch(`${BASE}/api/verify/${code}`))).status}`);

const anchorRes = await j(await fetch(`${BASE}/api/anchor/run`, { method: "POST", headers: H(admin.accessToken) }));
console.log(`anchor/run → anchored=${anchorRes.anchored} mode=${anchorRes.mode} root=${anchorRes.merkleRoot?.slice(0,18)}...`);

const sealed = await j(await fetch(`${BASE}/api/verify/${code}`));
console.log(`verify (pós-âncora) → ${sealed.status} | proof len=${sealed.technical?.merkleProof?.length}`);

// CA #10 — adultera 1 byte de uma answer diretamente no banco.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(
  `UPDATE answers SET value_text = 'ADULTERADO' WHERE interview_id = $1 AND question_code = 'gov_c1'`,
  [interviewId],
);
await pool.end();
const tampered = await j(await fetch(`${BASE}/api/verify/${code}`));
console.log(`CA#10 verify após adulterar answer → ${tampered.status} (esperado integrity_failed)`);
