// Aba Checagem do Admin — fila priorizada + áudio/fotos + aprovar/reprovar.
// Reusa /checks/queue, /interviews/:id/media e /checks/:id/result (admin = supervisor+).
import { useEffect, useState } from "react";
import { AlertTriangle, MapPin, Clock, RefreshCw, Check, X, Image as ImageIcon } from "lucide-react";
import { api } from "../lib/api.js";

const fmt = (s) => `${String(Math.floor((s ?? 0) / 60)).padStart(2, "0")}:${String((s ?? 0) % 60).padStart(2, "0")}`;
const FLAG_LABEL = { short_duration: "duração curta", gps_outside: "GPS fora", missing_photos: "sem fotos", hash_mismatch: "hash divergente" };

export default function Checagem() {
  const [queue, setQueue] = useState([]);
  const [sel, setSel] = useState(null);
  const [media, setMedia] = useState(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("audio");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try { setQueue((await api.checksQueue()).queue ?? []); } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const open = async (item) => {
    setSel(item); setMedia(null); setReason(""); setMethod("audio"); setMsg("");
    try { setMedia(await api.interviewMedia(item.interview_id)); }
    catch (e) { setMedia({ error: e.body?.error || "erro" }); }
  };

  const decide = async (result) => {
    if (!sel) return;
    setBusy(true); setMsg("");
    try {
      await api.checkResult(sel.check_id, { result, reason: reason.trim() || undefined, method });
      setSel(null); setMedia(null); await load();
    } catch { setMsg("Erro ao registrar a decisão."); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* FILA */}
      <div className="card p-3 min-w-0">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="font-semibold text-sm">Fila priorizada <span className="text-slate-500 font-normal">({queue.length})</span></div>
          <button onClick={load} className="btn-secondary px-2 py-1.5" title="Atualizar"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
        {loading && <div className="text-xs text-slate-500 px-1">Carregando…</div>}
        {!loading && queue.length === 0 && <div className="text-xs text-slate-500 px-1">Nenhuma entrevista na fila. 🎉</div>}
        <div className="space-y-2 max-h-[70vh] overflow-auto">
          {queue.map((q) => {
            const flags = q.fraud_flags ?? [];
            const active = sel?.check_id === q.check_id;
            return (
              <button key={q.check_id} onClick={() => open(q)}
                className={`w-full text-left rounded-el border p-2.5 text-xs ${active ? "border-primary bg-emerald-900/20" : flags.length ? "border-amber-800 bg-amber-900/10" : "border-slate-800 bg-surface-2/40"}`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold truncate">{q.interviewer}</span>
                  <span className="flex items-center gap-1 text-slate-400 shrink-0"><Clock size={11} />{fmt(q.duration_sec)}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 mt-0.5"><MapPin size={10} />{q.stratum}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {flags.length === 0 && <span className="text-[10px] text-slate-500">amostragem (20%)</span>}
                  {flags.map((f) => (
                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-300 flex items-center gap-0.5"><AlertTriangle size={9} />{FLAG_LABEL[f] ?? f}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DETALHE */}
      <div className="card p-4 min-w-0">
        {!sel ? (
          <div className="text-sm text-slate-500 flex items-center justify-center h-40">Selecione uma entrevista na fila para checar.</div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <div className="font-bold">{sel.interviewer}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={11} />{sel.stratum} · {fmt(sel.duration_sec)} · {sel.receipt_code}</div>
              </div>
            </div>

            {/* MÍDIA */}
            {!media && <div className="text-xs text-slate-500">Carregando mídia…</div>}
            {media?.error && <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2">Mídia indisponível ({media.error}).</div>}
            {media && !media.error && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Áudio da entrevista</div>
                  {media.audio
                    ? <audio controls src={media.audio} className="w-full" />
                    : <div className="text-xs text-slate-500">Sem áudio.</div>}
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

            {/* DECISÃO */}
            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Método</div>
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="audio">Áudio</option>
                    <option value="in_loco">In loco</option>
                  </select>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Motivo (se reprovar)</div>
                  <input className="input" placeholder="opcional" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </div>
              {msg && <p className="text-xs text-rose-400 mb-2">{msg}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => decide("rejected")} disabled={busy} className="btn-danger"><X size={15} /> Reprovar</button>
                <button onClick={() => decide("approved")} disabled={busy} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: "#2E9E4F", color: "#fff" }}><Check size={15} /> Aprovar</button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Reprovar tira a entrevista da apuração e devolve a cota (gera reposição).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
