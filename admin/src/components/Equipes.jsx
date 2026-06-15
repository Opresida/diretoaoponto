import { useEffect, useState } from "react";
import { UserPlus, Users, Power, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { api } from "../lib/api.js";
import GeoPicker from "./GeoPicker.jsx";

const ROLE_LABEL = {
  admin: "Admin", manager: "Gerente", coordinator: "Coordenador",
  statistician: "Estatístico", supervisor: "Supervisor", interviewer: "Entrevistador", client: "Cliente",
};

export default function Equipes() {
  const [users, setUsers] = useState([]);
  const [mgrForm, setMgrForm] = useState({ name: "", email: "", password: "", stratumId: "" });
  const [entForm, setEntForm] = useState({ name: "", email: "", password: "", managerId: "" });
  const [open, setOpen] = useState({});
  const [msg, setMsg] = useState("");
  const [linkStratumId, setLinkStratumId] = useState("");
  const [link, setLink] = useState("");

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  useEffect(() => { load(); }, []);

  const gerarLinkGerente = async () => {
    setMsg(""); setLink("");
    if (!linkStratumId) { setMsg("Selecione a zona/município para o link."); return; }
    try {
      const inv = await api.createInvite({ role: "manager", stratumId: linkStratumId });
      setLink(inv.url);
    } catch { setMsg("Erro ao gerar link."); }
  };

  const managers = users.filter((u) => u.role === "manager");
  const interviewersOf = (mid) => users.filter((u) => u.role === "interviewer" && u.manager_id === mid);
  const others = users.filter((u) => !["manager", "interviewer"].includes(u.role));

  const createManager = async (e) => {
    e.preventDefault(); setMsg("");
    if (!mgrForm.stratumId) { setMsg("Selecione a zona/município do gerente."); return; }
    try {
      await api.createUser({ ...mgrForm, email: mgrForm.email.trim().toLowerCase(), role: "manager" });
      setMgrForm({ name: "", email: "", password: "", stratumId: "" }); await load();
    } catch (e2) { setMsg(e2.body?.error === "email_or_code_already_exists" ? "E-mail já cadastrado." : "Erro ao criar gerente."); }
  };

  const createInterviewer = async (e) => {
    e.preventDefault(); setMsg("");
    if (!entForm.managerId) { setMsg("Selecione o gerente."); return; }
    try {
      await api.createUser({ name: entForm.name, email: entForm.email.trim().toLowerCase(), password: entForm.password, role: "interviewer", managerId: entForm.managerId });
      setEntForm({ name: "", email: "", password: "", managerId: entForm.managerId }); await load();
    } catch (e2) { setMsg(e2.body?.error === "email_or_code_already_exists" ? "E-mail já cadastrado." : "Erro ao criar entrevistador."); }
  };

  const toggle = async (u) => { await api.setActive(u.id, !u.active); await load(); };

  const UserRow = ({ u }) => (
    <div className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
      <span className={`w-2 h-2 rounded-full shrink-0 ${u.active ? "bg-emerald-400" : "bg-slate-600"}`} />
      <span className="font-medium truncate">{u.name}</span>
      {u.registration_code && <span className="text-xs text-slate-500">{u.registration_code}</span>}
      <span className="text-xs text-slate-500 truncate hidden sm:inline">{u.email}</span>
      <span className="ml-auto text-xs text-slate-400 shrink-0">{u.interviews ?? 0} entr.</span>
      <button onClick={() => toggle(u)} className={`p-1.5 shrink-0 ${u.active ? "text-emerald-400" : "text-slate-500"}`} title={u.active ? "Desativar" : "Ativar"}><Power size={14} /></button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* CRIAR GERENTE */}
        <form onSubmit={createManager} className="card p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><UserPlus size={15} /> Novo gerente</div>
          <div className="space-y-2">
            <input className="input" placeholder="Nome" value={mgrForm.name} onChange={(e) => setMgrForm({ ...mgrForm, name: e.target.value })} required />
            <input className="input" type="email" placeholder="E-mail" autoCapitalize="none" value={mgrForm.email} onChange={(e) => setMgrForm({ ...mgrForm, email: e.target.value })} required />
            <input className="input" type="password" placeholder="Senha (mín. 8)" value={mgrForm.password} onChange={(e) => setMgrForm({ ...mgrForm, password: e.target.value })} minLength={8} required />
            <div>
              <div className="label mb-1">Zona / município responsável</div>
              <GeoPicker value={mgrForm.stratumId} onChange={(stratumId) => setMgrForm({ ...mgrForm, stratumId })} />
            </div>
          </div>
          <button className="btn-primary mt-3"><UserPlus size={15} /> Criar gerente</button>
        </form>

        {/* CRIAR ENTREVISTADOR */}
        <form onSubmit={createInterviewer} className="card p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><UserPlus size={15} /> Novo entrevistador</div>
          <div className="space-y-2">
            <input className="input" placeholder="Nome" value={entForm.name} onChange={(e) => setEntForm({ ...entForm, name: e.target.value })} required />
            <input className="input" type="email" placeholder="E-mail" autoCapitalize="none" value={entForm.email} onChange={(e) => setEntForm({ ...entForm, email: e.target.value })} required />
            <input className="input" type="password" placeholder="Senha (mín. 8)" value={entForm.password} onChange={(e) => setEntForm({ ...entForm, password: e.target.value })} minLength={8} required />
            <select className="input" value={entForm.managerId} onChange={(e) => setEntForm({ ...entForm, managerId: e.target.value })} required>
              <option value="">— Gerente responsável —</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button className="btn-primary mt-3"><UserPlus size={15} /> Criar entrevistador</button>
        </form>
      </div>
      {msg && <p className="text-xs text-rose-400">{msg}</p>}

      {/* LINK DE CADASTRO DE GERENTE (uso único) */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-1 flex items-center gap-2"><MapPin size={15} /> Gerar link de cadastro de gerente</div>
        <p className="text-xs text-slate-500 mb-3">Crie um link de uso único: a pessoa abre, escolhe a senha e vira gerente da zona selecionada.</p>
        <GeoPicker value={linkStratumId} onChange={setLinkStratumId} />
        <button onClick={gerarLinkGerente} className="btn-primary mt-3">Gerar link</button>
        {link && (
          <div className="mt-3 flex items-center gap-2 bg-surface-2/60 border border-slate-700 rounded-el p-2.5">
            <input className="input text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button onClick={() => navigator.clipboard?.writeText(link)} className="btn-secondary px-3 py-2 text-xs">Copiar</button>
          </div>
        )}
      </div>

      {/* GERENTES + EQUIPES */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Users size={15} /> Gerentes e equipes</div>
        <div className="space-y-2">
          {managers.length === 0 && <div className="text-xs text-slate-500">Nenhum gerente ainda.</div>}
          {managers.map((m) => {
            const team = interviewersOf(m.id);
            const isOpen = open[m.id];
            return (
              <div key={m.id} className="border border-slate-800 rounded-el overflow-hidden">
                <button onClick={() => setOpen({ ...open, [m.id]: !isOpen })} className="w-full flex items-center gap-2 p-2.5 bg-surface-2/40 text-sm">
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className={`w-2 h-2 rounded-full ${m.active ? "bg-emerald-400" : "bg-slate-600"}`} />
                  <span className="font-semibold">{m.name}</span>
                  {m.stratum_name
                    ? <span className="text-[11px] text-emerald-300 flex items-center gap-0.5"><MapPin size={10} />{m.stratum_name}</span>
                    : <span className="text-[11px] text-amber-400">sem zona</span>}
                  <span className="ml-auto text-xs text-slate-400">{team.length} entrev.</span>
                  <span onClick={(e) => { e.stopPropagation(); toggle(m); }} className={`p-1 ${m.active ? "text-emerald-400" : "text-slate-500"}`}><Power size={14} /></span>
                </button>
                {isOpen && (
                  <div className="p-2 space-y-2">
                    {team.length === 0 && <div className="text-xs text-slate-500 px-1">Sem entrevistadores.</div>}
                    {team.map((u) => <UserRow key={u.id} u={u} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* OUTROS USUÁRIOS */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-3">Outros usuários</div>
        <div className="space-y-2">
          {others.map((u) => (
            <div key={u.id} className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${u.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              <span className="font-medium truncate">{u.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{ROLE_LABEL[u.role]}</span>
              <span className="text-xs text-slate-500 truncate hidden sm:inline">{u.email}</span>
              <button onClick={() => toggle(u)} className={`ml-auto p-1.5 shrink-0 ${u.active ? "text-emerald-400" : "text-slate-500"}`}><Power size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
