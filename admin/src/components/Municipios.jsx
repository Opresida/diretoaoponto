// Aba Municípios — catálogo dos 62 do AM. Admin liga/desliga a pesquisa e
// define a meta (cadastrar = vira área de pesquisa: cria estrato + cotas).
import { useEffect, useState } from "react";
import { MapPin, Check, X, Power } from "lucide-react";
import { api } from "../lib/api.js";

export default function Municipios() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null); // {id, target}
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.listMunicipalities().then((r) => setList(r.municipalities)).catch(() => {});
  useEffect(() => { load(); }, []);

  const interior = list.filter((m) => m.region === "interior");
  const inResearch = interior.filter((m) => m.in_research);
  const fora = interior.filter((m) => !m.in_research);

  const ligar = async (m, target) => {
    setBusy(true); setMsg("");
    try {
      await api.updateMunicipality(m.id, { inResearch: true, target: Number(target) });
      setEdit(null); await load();
    } catch { setMsg("Erro ao salvar."); } finally { setBusy(false); }
  };

  const desligar = async (m) => {
    if (Number(m.done) > 0 && !confirm(`${m.name} já tem ${m.done} entrevista(s). Remover da pesquisa mantém o histórico mas para a coleta. Confirmar?`)) return;
    setBusy(true); setMsg("");
    try { await api.updateMunicipality(m.id, { inResearch: false }); await load(); }
    catch { setMsg("Erro ao remover."); } finally { setBusy(false); }
  };

  const Row = ({ m }) => {
    const editing = edit?.id === m.id;
    return (
      <div className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
        <MapPin size={13} className={m.in_research ? "text-emerald-400 shrink-0" : "text-slate-600 shrink-0"} />
        <span className="font-medium truncate">{m.name}</span>
        {m.in_research && <span className="text-xs text-slate-400 shrink-0">{m.done}/{m.target}</span>}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <input type="number" min="1" defaultValue={m.target ?? 24} className="input w-20 py-1" id={`t-${m.id}`} />
              <button onClick={() => ligar(m, document.getElementById(`t-${m.id}`).value)} disabled={busy} className="btn-primary px-2 py-1.5"><Check size={14} /></button>
              <button onClick={() => setEdit(null)} className="btn-secondary px-2 py-1.5"><X size={14} /></button>
            </>
          ) : m.in_research ? (
            <>
              <button onClick={() => setEdit({ id: m.id })} className="text-xs text-slate-400 px-2 py-1 border border-slate-700 rounded-lg">Meta</button>
              <button onClick={() => desligar(m)} className="text-rose-400 p-1.5" title="Remover da pesquisa"><Power size={14} /></button>
            </>
          ) : (
            <button onClick={() => setEdit({ id: m.id })} className="btn-primary px-2.5 py-1 text-xs">+ Pesquisar</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-rose-400">{msg}</p>}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-1">Manaus</div>
        <p className="text-xs text-slate-500 mb-3">Manaus é organizada por <b>zonas</b> (6) — geridas como estratos fixos, não por este cadastro.</p>
        <div className="text-xs text-slate-400">Capital · {list.filter((m) => m.region === "manaus").length === 1 ? "no catálogo" : "—"}</div>
      </div>

      <div className="card p-4">
        <div className="font-semibold text-sm mb-3">Interior · na pesquisa <span className="text-slate-500 font-normal">({inResearch.length})</span></div>
        <div className="grid gap-2 lg:grid-cols-2">
          {inResearch.length === 0 && <div className="text-xs text-slate-500">Nenhum município na pesquisa.</div>}
          {inResearch.map((m) => <Row key={m.id} m={m} />)}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-semibold text-sm mb-3">Interior · fora da pesquisa <span className="text-slate-500 font-normal">({fora.length})</span></div>
        <div className="grid gap-2 lg:grid-cols-2 max-h-96 overflow-auto">
          {fora.map((m) => <Row key={m.id} m={m} />)}
        </div>
      </div>
    </div>
  );
}
