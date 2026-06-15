// Equipe do gerente (F3) — lista entrevistadores, cria direto ou por link de
// uso único; liga/desliga. O backend força manager_id = o próprio gerente.
import { useEffect, useState } from "react";
import { UserPlus, Power, Link2, Copy } from "lucide-react";
import { api } from "../lib/api.js";

export default function ManagerEquipe() {
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.team().then((r) => setTeam(r.team ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const criar = async (e) => {
    e.preventDefault(); setMsg(""); setBusy(true);
    try {
      await api.createUser({ name: form.name, email: form.email.trim().toLowerCase(), password: form.password, role: "interviewer" });
      setForm({ name: "", email: "", password: "" }); await load();
    } catch (e2) { setMsg(e2.body?.error === "email_or_code_already_exists" ? "E-mail já cadastrado." : "Erro ao criar."); }
    finally { setBusy(false); }
  };

  const gerarLink = async () => {
    setMsg(""); setLink("");
    try { const inv = await api.createInvite({}); setLink(inv.url); }
    catch { setMsg("Erro ao gerar link."); }
  };

  const toggle = async (u) => { await api.setActive(u.id, !u.active); await load(); };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* CRIAR DIRETO */}
        <form onSubmit={criar} className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><UserPlus size={15} /> Novo entrevistador</div>
          <div className="space-y-2">
            <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" type="email" placeholder="E-mail" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="input" type="password" placeholder="Senha (mín. 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn-primary mt-3" disabled={busy}><UserPlus size={15} /> Criar</button>
        </form>

        {/* LINK DE USO ÚNICO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Link2 size={15} /> Convite por link</div>
          <p className="text-xs text-slate-500 mb-3">Gere um link de uso único — o entrevistador abre, cria a senha e já entra na sua zona.</p>
          <button onClick={gerarLink} className="btn-primary">Gerar link</button>
          {link && (
            <div className="mt-3 flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-2">
              <input className="input text-xs flex-1 min-w-0" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button onClick={() => navigator.clipboard?.writeText(link)} className="btn-secondary px-2 py-2 shrink-0"><Copy size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {msg && <p className="text-xs text-rose-400">{msg}</p>}

      {/* LISTA DA EQUIPE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="font-semibold text-sm mb-3">Minha equipe <span className="text-slate-500 font-normal">({team.length})</span></div>
        <div className="space-y-2">
          {team.length === 0 && <div className="text-xs text-slate-500">Nenhum entrevistador ainda.</div>}
          {team.map((u) => (
            <div key={u.id} className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${u.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              <span className="font-medium truncate">{u.name}</span>
              {u.registration_code && <span className="text-xs text-slate-500">{u.registration_code}</span>}
              <span className="ml-auto text-xs text-slate-400 shrink-0">{u.today ?? 0} hoje · {u.total ?? 0} total</span>
              <button onClick={() => toggle(u)} className={`p-1.5 shrink-0 ${u.active ? "text-emerald-400" : "text-slate-500"}`} title={u.active ? "Desativar" : "Ativar"}><Power size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
