// Cliente HTTP + token (coordinator+). Proxy /api → backend.
const TOKEN_KEY = "dap.dash.accessToken";
const USER_KEY = "dap.dash.user";

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
    throw Object.assign(new Error(err.error || "request_failed"), { status: r.status });
  }
  return r.json();
}

export const api = {
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password }, needAuth: false }),
  snapshot: () => req("/apuracao/snapshot"),
  resumo: () => req("/apuracao/resumo"),
};
