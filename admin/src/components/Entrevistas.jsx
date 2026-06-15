// Auditoria — lista TODAS as entrevistas e abre áudio + fotos de qualquer uma.
import { useEffect, useState } from "react";
import { MapPin, Clock, AlertTriangle, Mic, Image as ImageIcon, RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";

const fmt = (s) => `${String(Math.floor((s ?? 0) / 60)).padStart(2, "0")}:${String((s ?? 0) % 60).padStart(2, "0")}`;
const STATUS = { synced: ["Sincronizada", "text-slate-300 border-slate-700"], approved: ["Aprovada", "text-ok border-[#2E9E4F]/50 bg-[#2E9E4F]/15"], rejected: ["Reprovada", "text-rose-300 border-rose-700 bg-rose-900/20"], pending_check: ["Em checagem", "text-amber-300 border-amber-700 bg-amber-900/20"] };
const FLAG_LABEL = { short_duration: "duração curta", gps_outside: "GPS fora", missing_photos: "sem fotos", hash_mismatch: "hash divergente" };

export default function Entrevistas() {
  const [list, setList] = useState([]);
  const [filters, setFilters] = useState({ status: "", region: "", flagged: false, withMedia: false });
  const [sel, setSel] = useState(null);
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { ...filters, flagged: filters.flagged || undefined, withMedia: filters.withMedia || undefined };
      setList((await api.listInterviews(params)).interviews ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const open = async (it) => {
    setSel(it); setMedia(null);
    try { setMedia(await api.interviewMedia(it.id)); }
    catch (e) { setMedia({ error: e.body?.error || "erro" }); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      {/* LISTA + FILTROS */}
      <div className="card p-4 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">Entrevistas <span className="text-slate-500 font-normal">({list.length})</span></div>
          <button onClick={load} className="btn-secondary px-2 py-1.5"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <select className="input w-auto py-1.5" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos status</option>
            <option value="synced">Sincronizada</option>
            <option value="pending_check">Em checagem</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Reprovada</option>
          </select>
          <select className="input w-auto py-1.5" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}>
            <option value="">Todas regiões</option>
            <option value="manaus">Manaus</option>
            <option value="interior">Interior</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={filters.flagged} onChange={(e) => setFilters({ ...filters, flagged: e.target.checked })} /> só com flag</label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={filters.withMedia} onChange={(e) => setFilters({ ...filters, withMedia: e.target.checked })} /> só com mídia</label>
        </div>
        <div className="space-y-2 max-h-[68vh] overflow-auto">
          {loading && <div className="text-xs text-slate-500">Carregando…</div>}
          {!loading && list.length === 0 && <div className="text-xs text-slate-500">Nenhuma entrevista com esses filtros.</div>}
          {list.map((it) => {
            const flags = it.fraud_flags ?? [];
            const [label, cls] = STATUS[it.status] ?? [it.status, "text-slate-300 border-slate-700"];
            return (
              <button key={it.id} onClick={() => open(it)}
                className={`w-full text-left rounded-el border p-2.5 text-xs ${sel?.id === it.id ? "border-primary bg-emerald-900/20" : "border-slate-800 bg-surface-2/40"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{it.interviewer}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${cls}`}>{label}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1 truncate"><MapPin size={10} />{it.stratum}</span>
                  <span className="flex items-center gap-1 shrink-0"><Clock size={10} />{fmt(it.duration_sec)}</span>
                  {it.has_audio && <Mic size={11} className="text-emerald-400 shrink-0" />}
                  {it.photo_count > 0 && <span className="flex items-center gap-0.5 shrink-0"><ImageIcon size={10} />{it.photo_count}</span>}
                </div>
                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {flags.map((f) => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-300 flex items-center gap-0.5"><AlertTriangle size={9} />{FLAG_LABEL[f] ?? f}</span>)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DETALHE / MÍDIA */}
      <div className="card p-4 min-w-0">
        {!sel ? (
          <div className="text-sm text-slate-500 flex items-center justify-center h-40">Selecione uma entrevista para ouvir o áudio e ver as fotos.</div>
        ) : (
          <div>
            <div className="font-bold">{sel.interviewer}</div>
            <div className="text-xs text-slate-400 mb-3 flex items-center gap-1"><MapPin size={11} />{sel.stratum} · {fmt(sel.duration_sec)} · {sel.receipt_code}</div>
            {!media && <div className="text-xs text-slate-500">Carregando mídia…</div>}
            {media?.error && <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2">Mídia indisponível ({media.error}).</div>}
            {media && !media.error && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Mic size={12} />Áudio</div>
                  {media.audio ? <audio controls src={media.audio} className="w-full" /> : <div className="text-xs text-slate-500">Sem áudio.</div>}
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><ImageIcon size={12} />Fotos ({media.photos?.length ?? 0})</div>
                  {media.photos?.length
                    ? <div className="grid grid-cols-3 gap-2">{media.photos.map((p) => (
                        <a key={p.seq} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[3/4] rounded-el overflow-hidden border border-slate-700">
                          <img src={p.url} alt={`Foto ${p.seq}`} className="w-full h-full object-cover" />
                        </a>))}</div>
                    : <div className="text-xs text-slate-500">Sem fotos.</div>}
                </div>
                <p className="text-[11px] text-slate-500">Somente auditoria · o voto é sigiloso (não exibido).</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
