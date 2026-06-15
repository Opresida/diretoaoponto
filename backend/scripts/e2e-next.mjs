// Testes E2E dos novos módulos: users/team (§12), supervisão (§5), verify/anchor (§13/§14).
const BASE = "http://localhost:3000";
const login = async (email) =>
  (await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha123" }),
  })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();

const admin = await login("admin@diretoaoponto.org");
const ger1 = await login("gerente1@diretoaoponto.org");
const ger2 = await login("gerente2@diretoaoponto.org");
const sup = await login("supervisor@diretoaoponto.org");
const coord = await login("coordinator@diretoaoponto.org");

console.log("\n=== §12 HIERARQUIA ===");
// CA #8: gerente tentando criar coordinator → 403
let r = await fetch(`${BASE}/api/users`, { method: "POST", headers: H(ger1.accessToken),
  body: JSON.stringify({ name: "X", email: "x1@d.org", password: "senha123", role: "coordinator" }) });
console.log(`CA#8 gerente cria coordinator → HTTP ${r.status} (esperado 403)`);

// gerente cria interviewer (role/manager forçados)
r = await fetch(`${BASE}/api/users`, { method: "POST", headers: H(ger1.accessToken),
  body: JSON.stringify({ name: "Novo Ent G1", email: `ent_g1_${Date.now()}@d.org`, password: "senha123", role: "interviewer" }) });
let created = await j(r);
console.log(`gerente cria interviewer → HTTP ${r.status}, role=${created.role}, manager_id==gerente1? ${created.manager_id === ger1.user.id}`);

// CA #9: gerente1 lista equipe (só a própria); gerente2 não vê os de gerente1
const t1 = await j(await fetch(`${BASE}/api/team`, { headers: H(ger1.accessToken) }));
const t2 = await j(await fetch(`${BASE}/api/team`, { headers: H(ger2.accessToken) }));
const t1ids = new Set(t1.team.map((m) => m.id));
const overlap = t2.team.filter((m) => t1ids.has(m.id)).length;
console.log(`CA#9 equipe g1=${t1.team.length}, g2=${t2.team.length}, sobreposição=${overlap} (esperado 0)`);
// admin audita equipe do gerente1
const tAdmin = await j(await fetch(`${BASE}/api/team?managerId=${ger1.user.id}`, { headers: H(admin.accessToken) }));
console.log(`admin audita equipe g1 → ${tAdmin.team.length} membros`);

console.log("\n=== §5 SUPERVISÃO ===");
const queue = await j(await fetch(`${BASE}/api/checks/queue`, { headers: H(sup.accessToken) }));
console.log(`fila de checagem: ${queue.queue.length} itens`);
console.log(`CA#5 topo da fila flags=${JSON.stringify(queue.queue[0]?.fraud_flags)} dur=${queue.queue[0]?.duration_sec}s (short_duration deve vir primeiro)`);

// apuração antes da reprovação
const govBefore = await j(await fetch(`${BASE}/api/apuracao/governo?recorte=total`, { headers: H(coord.accessToken) }));
const omarBefore = govBefore.ranking.find((c) => c.name === "Omar Aziz")?.votes ?? 0;
// reprovar o item short_duration (Omar Aziz) → CA #6
const shortItem = queue.queue.find((q) => JSON.stringify(q.fraud_flags).includes("short_duration"));
if (shortItem) {
  const rr = await j(await fetch(`${BASE}/api/checks/${shortItem.check_id}/result`, { method: "POST", headers: H(sup.accessToken),
    body: JSON.stringify({ result: "rejected", reason: "duração suspeita", method: "audio" }) }));
  console.log(`reprovação → ${JSON.stringify(rr)}`);
}
const govAfter = await j(await fetch(`${BASE}/api/apuracao/governo?recorte=total`, { headers: H(coord.accessToken) }));
const omarAfter = govAfter.ranking.find((c) => c.name === "Omar Aziz")?.votes ?? 0;
console.log(`CA#6 Omar Aziz votos antes=${omarBefore} depois=${omarAfter} (rejeitada sai da apuração)`);

console.log("\n=== §13/§14 BLOCKCHAIN + VERIFY ===");
// pega um receipt de uma entrevista válida (a primeira)
const probe = await j(await fetch(`${BASE}/api/verify/DAP-2026-YR47-GPRP`));
console.log(`verify antes da âncora → status=${probe.status}`);
// roda ancoragem (admin)
const anchorRes = await j(await fetch(`${BASE}/api/anchor/run`, { method: "POST", headers: H(admin.accessToken) }));
console.log(`anchor/run → ${JSON.stringify(anchorRes)}`);
// verify depois
const after = await j(await fetch(`${BASE}/api/verify/DAP-2026-YR47-GPRP`));
console.log(`verify após âncora → status=${after.status}, merkleRoot=${after.technical?.merkleRoot?.slice(0, 18)}...`);
