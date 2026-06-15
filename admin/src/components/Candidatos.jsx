import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Camera, User } from "lucide-react";
import { api } from "../lib/api.js";

const OFFICES = [
  ["governor", "Governador"],
  ["senator", "Senador"],
  ["president", "Presidente"],
];

// Sobe a foto: presign (candidate) → PUT no R2 → PATCH photoKey.
async function uploadPhoto(candidateId, file) {
  const { uploadUrl, storageKey } = await api.presignCandidate(candidateId);
  await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
  await api.updateCandidate(candidateId, { photoKey: storageKey });
}

function Avatar({ c, bust }) {
  const [err, setErr] = useState(false);
  if (c.photo && !err) {
    return <img src={`${c.photo}?t=${bust}`} alt={c.name} onError={() => setErr(true)} className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-700" />;
  }
  return <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center border border-slate-700" style={{ background: (c.color || "#334155") + "33" }}><User size={13} style={{ color: c.color || "#64748b" }} /></span>;
}

export default function Candidatos() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", party: "", office: "governor", color: "#34d399", photoUrl: "" });
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [bust, setBust] = useState(0);
  const fileForId = useRef(null);
  const rowFileInput = useRef(null);

  const load = () => api.listCandidates().then((r) => setList(r.candidates)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const created = await api.createCandidate({
        name: form.name.trim(), party: form.party.trim() || null, office: form.office, color: form.color,
        photoUrl: form.photoUrl.trim() || null,
      });
      setForm({ name: "", party: "", office: form.office, color: form.color, photoUrl: "" });
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
      await api.updateCandidate(editing.id, {
        name: editing.name.trim(), party: editing.party?.trim() || null, color: editing.color,
        photoUrl: editing.photoUrl?.trim() || null,
      });
      setEditing(null); await load(); setBust((b) => b + 1);
    } catch { setErr("Erro ao salvar."); }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !fileForId.current) return;
    setBusy(true); setErr("");
    try { await uploadPhoto(fileForId.current, file); await load(); setBust((b) => b + 1); }
    catch { setErr("Erro ao subir a foto."); }
    finally { setBusy(false); fileForId.current = null; }
  };

  const byOffice = (o) => list.filter((c) => c.office === o);

  return (
    <div className="space-y-4">
      <input ref={rowFileInput} type="file" accept="image/*" className="hidden" onChange={onPickFile} />

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
          <div className="sm:col-span-2"><div className="label mb-1">Foto por URL (opcional — ou suba o arquivo na lista depois de criar)</div>
            <input className="input" placeholder="https://…/foto.jpg" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
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
                <input className="input w-40" placeholder="Foto URL" value={editing.photoUrl ?? ""} onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })} />
                <button onClick={saveEdit} className="btn-primary px-2 py-2"><Check size={15} /></button>
                <button onClick={() => setEditing(null)} className="btn-secondary px-2 py-2"><X size={15} /></button>
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
                <Avatar c={c} bust={bust} />
                <span className="font-medium truncate">{c.name}</span>
                {c.party && <span className="text-xs text-slate-500">· {c.party}</span>}
                <span className="ml-auto text-xs text-slate-400 shrink-0">{c.votos} votos</span>
                <button onClick={() => { fileForId.current = c.id; rowFileInput.current?.click(); }} disabled={busy} className="text-slate-400 p-1.5 shrink-0" title="Subir foto"><Camera size={14} /></button>
                <button onClick={() => setEditing({ id: c.id, name: c.name, party: c.party, color: c.color, photoUrl: "" })} className="text-slate-400 p-1.5 shrink-0"><Pencil size={14} /></button>
                <button onClick={() => remove(c)} className="text-rose-400 p-1.5 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
