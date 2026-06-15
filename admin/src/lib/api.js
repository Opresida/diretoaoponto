// Cliente HTTP + token (admin). Proxy /api → backend.
const TOKEN_KEY = "dap.admin.accessToken";
const USER_KEY = "dap.admin.user";

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; },
  set(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

async function req(path, { method = "GET", body, needAuth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (needAuth && auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const r = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw Object.assign(new Error(err.error || "request_failed"), { status: r.status, body: err });
  }
  return r.json();
}

export const api = {
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password }, needAuth: false }),
  // Candidatos
  listCandidates: () => req("/candidates"),
  createCandidate: (c) => req("/candidates", { method: "POST", body: c }),
  updateCandidate: (id, c) => req(`/candidates/${id}`, { method: "PATCH", body: c }),
  deleteCandidate: (id) => req(`/candidates/${id}`, { method: "DELETE" }),
  // Usuários / equipes
  listUsers: () => req("/users"),
  createUser: (u) => req("/users", { method: "POST", body: u }),
  setActive: (id, active) => req(`/users/${id}/active`, { method: "PATCH", body: { active } }),
  // Dados
  resumo: () => req("/apuracao/resumo"),
  snapshot: () => req("/apuracao/snapshot"),
  listStrata: () => req("/strata"),
};
