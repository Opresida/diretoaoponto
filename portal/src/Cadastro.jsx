// Cadastro por convite (F3) — página pública /cadastro/:token.
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, UserPlus, CheckCircle2 } from "lucide-react";

export default function Cadastro({ token }) {
  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/invites/${token}`).then((r) => r.json()).then(setCtx).catch(() => setCtx({ valid: false }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/public/invites/${token}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email.trim().toLowerCase() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error === "email_already_exists" ? "E-mail já cadastrado." : data.error === "invite_invalid_or_used" ? "Convite inválido ou já usado." : "Erro ao cadastrar.");
        return;
      }
      setDone(data.role);
    } catch { setErr("Erro de conexão."); } finally { setBusy(false); }
  };

  if (!ctx) return <div className="page"><div className="card" style={{ padding: 24, color: "#94a3b8" }}>Carregando…</div></div>;

  if (!ctx.valid) {
    const reason = ctx.reason === "used" ? "Este convite já foi utilizado." : ctx.reason === "expired" ? "Este convite expirou." : "Convite não encontrado.";
    return (
      <div className="page"><div className="card" style={{ padding: 24, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <ShieldAlert size={40} style={{ color: "#fb7185" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Cadastro indisponível</h1>
        <p style={{ fontSize: 14, color: "#cbd5e1", marginTop: 6 }}>{reason}</p>
      </div></div>
    );
  }

  if (done) {
    const appUrl = done === "manager" ? "http://localhost:5175" : "http://localhost:5173";
    const appLabel = done === "manager" ? "Painel de Apuração" : "App de Campo";
    return (
      <div className="page"><div className="card" style={{ padding: 24, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <CheckCircle2 size={40} style={{ color: "#34d399" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Cadastro concluído!</h1>
        <p style={{ fontSize: 14, color: "#cbd5e1", marginTop: 6, marginBottom: 16 }}>Sua conta foi criada. Agora é só entrar no {appLabel} com seu e-mail e senha.</p>
        <a href={appUrl} className="btn-primary" style={{ width: "100%" }}>Ir para o {appLabel}</a>
      </div></div>
    );
  }

  return (
    <div className="page">
      <form onSubmit={submit} className="card" style={{ padding: 24, maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <ShieldCheck size={40} style={{ color: "#34d399" }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Cadastro por convite</h1>
          <div style={{ fontSize: 13, color: "#34d399", marginTop: 4 }}>{ctx.contextLabel}</div>
        </div>
        <input className="input" style={{ textAlign: "left", marginBottom: 10 }} placeholder="Seu nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" style={{ textAlign: "left", marginBottom: 10 }} type="email" placeholder="E-mail" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" style={{ textAlign: "left", marginBottom: 10 }} type="password" placeholder="Crie uma senha (mín. 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {err && <p style={{ fontSize: 12, color: "#fb7185", marginBottom: 10 }}>{err}</p>}
        <button className="btn-primary" style={{ width: "100%" }} disabled={busy}><UserPlus size={15} /> {busy ? "Cadastrando…" : "Concluir cadastro"}</button>
        <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 14 }}>Convite de uso único.</p>
      </form>
    </div>
  );
}
