import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "../lib/api.js";

const OFFICES = [
  ["governor", "Governador"],
  ["senator", "Senador"],
  ["president", "Presidente"],
];
const officeLabel = (o) => OFFICES.find(([v]) => v === o)?.[1] ?? o;

export default function Candidatos() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", party: "", office: "governor", color: "#34d399" });
  const [editing, setEditing] = useState(null); // {id, name, party, color}
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.listCandidates().then((r) => setList(r.candidates)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api.createCandidate({ name: form.name.trim(), party: form.party.trim() || null, office: form.office, color: form.color });
      setForm({ name: "", party: "", office: form.office, color: form.color });
      await load();
    } catch (e2) {
      setErr(e2.body?.error === "candidate_already_exists" ? "Já existe candidato com esse nome nesse cargo." : "Erro ao criar.");
    } finally { setBusy(false); }
  };

  const remove = async (c) => {
    setErr("");
    try { await api.deleteCandidate(c.id); await load(); }
    catch (e2) { setErr(e2.body?.message || "Não foi possível excluir."); }
  };

  const saveEdit = async () => {
    setErr("");
    try {
      await api.updateCandidate(editing.id, { name: editing.name.trim(), party: editing.party?.trim() || null, color: editing.color });
      setEditing(null); await load();
    } catch { setErr("Erro ao salvar."); }
  };

  const byOffice = (o) => list.filter((c) => c.office === o);

  return (
    <div className="space-y-4">
      {/* FORM ADD */}
      <form onSubmit={add} className="card p-4">
        <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Plus size={15} /> Novo candidato</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><div className="label mb-1">Nome</div><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><div className="label mb-1">Partido (opcional)</div><input className="input" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></div>
          <div><div className="label mb-1">Cargo</div>
            <select className="input" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })}>
              {OFFICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><div className="label mb-1">Cor</div>
            <div className="flex gap-2 items-center">
              <input type="color" className="h-10 w-12 rounded-lg bg-transparent border border-slate-700" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
        </div>
        {err && <p className="text-xs text-rose-400 mt-2">{err}</p>}
        <button className="btn-primary mt-3" disabled={busy}><Plus size={15} /> Adicionar</button>
      </form>

      {/* LISTA POR CARGO */}
      {OFFICES.map(([o, label]) => (
        <div key={o} className="card p-4">
          <div className="font-semibold text-sm mb-3">{label} <span className="text-slate-500 font-normal">({byOffice(o).length})</span></div>
          <div className="space-y-2">
            {byOffice(o).length === 0 && <div className="text-xs text-slate-500">Nenhum candidato.</div>}
            {byOffice(o).map((c) => editing?.id === c.id ? (
              <div key={c.id} className="flex flex-wrap items-center gap-2 bg-surface-2/60 border border-slate-700 rounded-el p-2">
                <input type="color" className="h-8 w-10 rounded bg-transparent border border-slate-700" value={editing.color || "#64748b"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                <input className="input flex-1 min-w-[120px]" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <input className="input w-24" placeholder="Partido" value={editing.party ?? ""} onChange={(e) => setEditing({ ...editing, party: e.target.value })} />
                <button onClick={saveEdit} className="btn-primary px-2 py-2"><Check size={15} /></button>
                <button onClick={() => setEditing(null)} className="btn-secondary px-2 py-2"><X size={15} /></button>
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color || "#64748b" }} />
                <span className="font-medium truncate">{c.name}</span>
                {c.party && <span className="text-xs text-slate-500">· {c.party}</span>}
                <span className="ml-auto text-xs text-slate-400 shrink-0">{c.votos} votos</span>
                <button onClick={() => setEditing({ id: c.id, name: c.name, party: c.party, color: c.color })} className="text-slate-400 p-1.5 shrink-0"><Pencil size={14} /></button>
                <button onClick={() => remove(c)} className="text-rose-400 p-1.5 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
