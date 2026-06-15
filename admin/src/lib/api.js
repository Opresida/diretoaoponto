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
  presignCandidate: (candidateId) => req("/uploads/presign", { method: "POST", body: { kind: "candidate", candidateId } }),
  // Usuários / equipes
  listUsers: () => req("/users"),
  createUser: (u) => req("/users", { method: "POST", body: u }),
  setActive: (id, active) => req(`/users/${id}/active`, { method: "PATCH", body: { active } }),
  createInvite: (body) => req("/invites", { method: "POST", body }),
  // Municípios
  listMunicipalities: () => req("/municipalities"),
  updateMunicipality: (id, body) => req(`/municipalities/${id}`, { method: "PATCH", body }),
  // Dados / apuração
  resumo: () => req("/apuracao/resumo"),
  snapshot: () => req("/apuracao/snapshot"),
  listStrata: () => req("/strata"),
  geo: () => req("/apuracao/geo"),
  listInterviews: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
    return req(`/interviews?${qs}`);
  },
  interviewMedia: (id) => req(`/interviews/${id}/media`),
  // Relatórios selados
  listReports: () => req("/reports"),
  generateReport: () => req("/reports", { method: "POST" }),
  reportVerifyUrl: (code) => `${location.origin.replace(/:\d+$/, ":5174")}/r/${code}`,
  downloadReportPdf: async (id, code) => {
    const r = await fetch(`/api/reports/${id}/pdf`, { headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {} });
    if (!r.ok) throw new Error("pdf_failed");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${code}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  governo: ({ recorte = "total", zone, municipality, scenario = "c1" } = {}) => {
    const q = new URLSearchParams({ recorte, scenario });
    if (zone) q.set("zone", zone);
    if (municipality) q.set("municipality", municipality);
    return req(`/apuracao/governo?${q}`);
  },
};
