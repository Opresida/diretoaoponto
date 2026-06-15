// E2E convites (F3): admin→gerente, gerente→entrevistador, escopo no campo, uso único.
const BASE = "http://127.0.0.1:3000";
const login = async (email, password = "senha123") =>
  (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json());
const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });
const j = (r) => r.json();
const ts = Date.now();

const admin = await login("admin@diretoaoponto.org");
const geo = await j(await fetch(`${BASE}/api/apuracao/geo`, { headers: H(admin.accessToken) }));
const zona = geo.manaus.find((z) => z.zone === "Norte"); // Manaus · Norte
console.log("zona p/ gerente:", zona.zone, zona.stratumId);

// 1. Admin cria convite de gerente.
const invMgr = await j(await fetch(`${BASE}/api/invites`, { method: "POST", headers: H(admin.accessToken), body: JSON.stringify({ role: "manager", stratumId: zona.stratumId }) }));
console.log("convite gerente:", invMgr.url);

// 2. Contexto público + 3. aceite.
const ctxMgr = await j(await fetch(`${BASE}/api/public/invites/${invMgr.token}`));
console.log("contexto:", ctxMgr.contextLabel, "| valid:", ctxMgr.valid);
const mgrEmail = `ger.norte.${ts}@diretoaoponto.org`;
const accMgr = await j(await fetch(`${BASE}/api/public/invites/${invMgr.token}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Gerente Norte", email: mgrEmail, password: "senha123" }) }));
console.log("aceite gerente:", JSON.stringify(accMgr));

// 4. Reuso do mesmo link → 410.
const reuse = await fetch(`${BASE}/api/public/invites/${invMgr.token}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "X", email: `x${ts}@d.org`, password: "senha123" }) });
console.log("reuso do link →", reuse.status, "(esperado 410)");

// 5. Novo gerente cria convite de entrevistador.
const ger = await login(mgrEmail);
const invEnt = await j(await fetch(`${BASE}/api/invites`, { method: "POST", headers: H(ger.accessToken), body: JSON.stringify({}) }));
const ctxEnt = await j(await fetch(`${BASE}/api/public/invites/${invEnt.token}`));
console.log("convite entrevistador → contexto:", ctxEnt.contextLabel);

// 6. Aceite entrevistador.
const entEmail = `ent.norte.${ts}@diretoaoponto.org`;
const accEnt = await j(await fetch(`${BASE}/api/public/invites/${invEnt.token}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Entrevistador Norte", email: entEmail, password: "senha123" }) }));
console.log("aceite entrevistador:", JSON.stringify(accEnt));

// 7. Entrevistador loga no campo → package escopado à zona do gerente (Norte).
const ent = await login(entEmail);
const pkg = await j(await fetch(`${BASE}/api/field/package`, { headers: H(ent.accessToken) }));
console.log("field/package → estratos:", pkg.strata.map((s) => s.name).join(", "), "| assigned:", pkg.assigned);
