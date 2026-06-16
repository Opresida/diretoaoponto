// Cliente HTTP + token (supervisor/admin). Proxy /api → backend.
const TOKEN_KEY = "dap.chk.accessToken";
const USER_KEY = "dap.chk.user";

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
    // token expirado/inválido → encerra a sessão e volta pro login (evita tela presa em "Carregando…").
    if (r.status === 401 && needAuth) { auth.clear(); location.reload(); }
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw Object.assign(new Error(err.error || "request_failed"), { status: r.status, body: err });
  }
  return r.json();
}

export const api = {
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password }, needAuth: false }),
  queue: () => req("/checks/queue"),
  media: (interviewId) => req(`/interviews/${interviewId}/media`),
  result: (checkId, body) => req(`/checks/${checkId}/result`, { method: "POST", body }),
};
