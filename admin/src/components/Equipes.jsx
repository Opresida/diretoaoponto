import { useEffect, useState } from "react";
import { UserPlus, Users, Power, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../lib/api.js";

const ROLE_LABEL = {
  admin: "Admin", manager: "Gerente", coordinator: "Coordenador",
  statistician: "Estatístico", supervisor: "Supervisor", interviewer: "Entrevistador", client: "Cliente",
};

export default function Equipes() {
  const [users, setUsers] = useState([]);
  const [mgrForm, setMgrForm] = useState({ name: "", email: "", password: "" });
  const [entForm, setEntForm] = useState({ name: "", email: "", password: "", managerId: "" });
  const [open, setOpen] = useState({});
  const [msg, setMsg] = useState("");

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  useEffect(() => { load(); }, []);

  const managers = users.filter((u) => u.role === "manager");
  const interviewersOf = (mid) => users.filter((u) => u.role === "interviewer" && u.manager_id === mid);
  const others = users.filter((u) => !["manager", "interviewer"].includes(u.role));

  const createManager = async (e) => {
    e.preventDefault(); setMsg("");
    try {
      await api.createUser({ ...mgrForm, email: mgrForm.email.trim().toLowerCase(), role: "manager" });
      setMgrForm({ name: "", email: "", password: "" }); await load();
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
                  <span className="ml-auto text-xs text-slate-400">{team.length} entrevistador(es)</span>
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
