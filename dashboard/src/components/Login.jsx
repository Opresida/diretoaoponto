import { useState } from "react";
import { BarChart3, LogIn } from "lucide-react";
import { api, auth } from "../lib/api.js";

const ALLOWED = ["manager"]; // Dashboard é exclusivo do gerente (zona). Apuração geral fica no Admin.

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await api.login(email.trim().toLowerCase(), password);
      if (!ALLOWED.includes(r.user.role)) {
        setError("Acesso restrito a gerentes. (Apuração geral: painel do Admin.)");
        return;
      }
      auth.set(r.accessToken, r.user);
      onLogin(r.user);
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
        <BarChart3 size={36} className="text-emerald-400 mx-auto mb-2" />
        <h1 className="text-lg font-bold text-center">Direto ao Ponto</h1>
        <p className="text-xs text-slate-400 text-center mb-5">Apuração da sua zona · Gerente</p>
        <input className="input mb-3" type="email" placeholder="E-mail" value={email}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className="input mb-3" type="password" placeholder="Senha" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          <LogIn size={16} /> {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
