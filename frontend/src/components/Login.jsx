import { useState } from "react";
import { LogIn } from "lucide-react";
import { api, auth } from "../lib/api.js";

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
      if (r.user.role !== "interviewer") {
        setError("Este app é exclusivo para entrevistadores.");
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
    <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm">
        <img src="/logo-white.png" alt="Direto ao Ponto" className="h-12 w-auto mx-auto mb-3" />
        <p className="text-xs text-slate-400 text-center mb-5">App de Campo · Entrevistador</p>
        <input className="input mb-3" type="email" placeholder="E-mail" value={email}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email"
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
