// Teste rápido do broadcast do WebSocket (CA #4). Conecta como coordinator,
// dispara um sync e mede o tempo até receber o evento interview:new.
import WebSocket from "ws";

const BASE = "http://localhost:3000";

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha123" }),
  });
  return r.json();
}

const co = await login("coordinator@diretoaoponto.org");
const ent = await login("ent1@diretoaoponto.org");

const ws = new WebSocket(`ws://localhost:3000/ws/apuracao?token=${co.accessToken}`);

ws.on("open", async () => {
  console.log("WS conectado (coordinator).");
  const t0 = Date.now();
  const now = new Date();
  const start = new Date(now.getTime() - 150000);
  const cu = crypto.randomUUID();
  const r = await fetch(`${BASE}/api/sync/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ent.accessToken}` },
    body: JSON.stringify({
      interviews: [{
        clientUuid: cu,
        stratumId: "49a8b4d8-b67e-4822-90ee-1261bd64e256",
        quotaId: "c89328a7-34e7-463a-a2eb-a3f2ded8f28a",
        respondent: { sex: "F", age: 28 },
        consentLgpd: true, consentPhoto: false,
        startedAt: start.toISOString(), endedAt: now.toISOString(),
        gpsStart: { lat: -3.1, lng: -60 }, gpsEnd: { lat: -3.1, lng: -60 },
        photos: [],
        answers: [{ questionCode: "gov_c1", candidateName: "Tadeu de Souza" }],
      }],
    }),
  });
  await r.json();
  globalThis.__t0 = t0;
});

ws.on("message", (data) => {
  const dt = Date.now() - globalThis.__t0;
  const ev = JSON.parse(data.toString());
  console.log(`Evento '${ev.type}' recebido em ${dt}ms (CA #4: <500ms = ${dt < 500})`);
  console.log("  interview:", JSON.stringify(ev.interview));
  console.log("  governo.total:", JSON.stringify(ev.apuracao.governo.total));
  console.log("  progress:", JSON.stringify(ev.apuracao.progress));
  ws.close();
  process.exit(0);
});

ws.on("error", (e) => { console.error("WS error:", e.message); process.exit(1); });
setTimeout(() => { console.error("timeout — nenhum evento"); process.exit(1); }, 8000);
