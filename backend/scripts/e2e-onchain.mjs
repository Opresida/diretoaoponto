// Ancoragem ON-CHAIN real na Base Sepolia (CA #11): sync → anchor/run → verify.
const BASE = "http://127.0.0.1:3000";
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
const now = new Date(); const start = new Date(now.getTime() - 145000);
const sync = await j(await fetch(`${BASE}/api/sync/interviews`, { method: "POST", headers: H(ent.accessToken),
  body: JSON.stringify({ interviews: [{
    clientUuid: cu, stratumId: "49a8b4d8-b67e-4822-90ee-1261bd64e256", quotaId: "c89328a7-34e7-463a-a2eb-a3f2ded8f28a",
    respondent: { sex: "F", age: 27 }, consentLgpd: true, consentPhoto: false,
    startedAt: start.toISOString(), endedAt: now.toISOString(),
    gpsStart: { lat: -3.1, lng: -60 }, gpsEnd: { lat: -3.1, lng: -60 }, photos: [],
    answers: [{ questionCode: "gov_c1", candidateName: "David Almeida" }],
  }] }) }));
const code = sync.results[0].receiptCode;
console.log("sync →", sync.results[0].status, "| receipt", code);

console.log("\nancorando on-chain (pode levar alguns segundos)...");
const anchorRes = await j(await fetch(`${BASE}/api/anchor/run`, { method: "POST", headers: H(admin.accessToken) }));
console.log("anchor/run →", JSON.stringify(anchorRes));

const v = await j(await fetch(`${BASE}/api/verify/${code}`));
console.log("\nverify →", v.status);
console.log("  txHash:", v.txHash);
console.log("  blockNumber:", v.blockNumber);
console.log("  explorerUrl:", v.explorerUrl);
console.log("  chain:", v.technical?.chain, "| merkleRoot:", v.technical?.merkleRoot?.slice(0, 20) + "...");
