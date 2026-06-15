// Dashboard do GERENTE — exclusivo da zona dele. Reusa /api/apuracao/scoped e
// reescuta o WebSocket apenas para saber quando recarregar a própria zona.
import { useEffect, useRef, useState } from "react";
import { Crown, AlertTriangle, CheckCircle2, MapPin, Radio, LogOut, Users, WifiOff, Mic, Image as ImageIcon, X, Headphones } from "lucide-react";
import { api, auth } from "../lib/api.js";
import CandAvatar from "./CandAvatar.jsx";
import ManagerEquipe from "./ManagerEquipe.jsx";

const OPCOES = ["Branco/Nulo", "NS/NR"];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ManagerDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [wsOpen, setWsOpen] = useState(false);
  const [photoByName, setPhotoByName] = useState({});
  const [view, setView] = useState("painel");
  const [mediaSel, setMediaSel] = useState(null);
  const [media, setMedia] = useState(null);
  const reloadTimer = useRef(null);

  const abrirMidia = async (f) => {
    setMediaSel(f); setMedia(null);
    try { setMedia(await api.interviewMedia(f.id)); }
    catch (e) { setMedia({ error: e.body?.error || (e.status === 403 ? "fora da sua equipe" : "erro") }); }
  };

  const load = () => api.scoped().then(setData).catch(() => {});
  useEffect(() => {
    load();
    api.listCandidates().then((r) => {
      const map = {};
      for (const c of r.candidates) if (c.photo) map[c.name] = c.photo;
      setPhotoByName(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/apuracao?token=${auth.token}`);
    ws.onopen = () => setWsOpen(true);
    ws.onclose = () => setWsOpen(false);
    ws.onerror = () => setWsOpen(false);
    ws.onmessage = () => {
      // Recarrega a própria zona (debounce simples) a cada nova entrevista.
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 400);
    };
    return () => { ws.close(); clearTimeout(reloadTimer.current); };
  }, []);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando sua zona…</div>;

  if (!data.stratum) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <MapPin size={40} className="text-slate-500 mb-3" />
        <h1 className="text-lg font-bold">Nenhuma zona atribuída</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">Peça ao administrador para vincular você a uma zona/município.</p>
        <button onClick={onLogout} className="btn-primary mt-5"><LogOut size={15} /> Sair</button>
      </div>
    );
  }

  const s = data.stratum;
  const governo = data.governo ?? [];
  const senado = data.senado ?? [];
  const cands = governo.filter((c) => !OPCOES.includes(c.name));
  const lider = cands[0];
  const prog = data.progress ?? { done: 0, target: 0 };
  const pct = prog.target ? Math.round((prog.done / prog.target) * 100) : 0;
  const flagsTotal = (data.flags ?? []).reduce((a, f) => a + Number(f.count), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-4 max-w-6xl mx-auto overflow-x-hidden">
      <header className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo-white.png" alt="Direto ao Ponto" className="h-6 w-auto shrink-0" />
          <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-1.5"><MapPin size={16} className="text-emerald-400" />{s.name}</h1>
            <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${wsOpen ? "text-emerald-300 border-emerald-700 bg-emerald-900/30" : "text-slate-400 border-slate-700 bg-slate-800"}`}>
              <span className={`rounded-full h-2 w-2 ${wsOpen ? "bg-emerald-400" : "bg-slate-500"}`} />{wsOpen ? "AO VIVO" : "OFFLINE"}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Minha zona · {user?.name} · parciais não ponderadas</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
            {[["painel", "Painel"], ["equipe", "Equipe"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${view === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>{l}</button>
            ))}
          </div>
          <button onClick={onLogout} className="text-slate-400 p-2"><LogOut size={18} /></button>
        </div>
      </header>

      {view === "equipe" ? <ManagerEquipe /> : (<>
      {/* PROGRESSO DA ZONA */}
      <div className="min-w-0 bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-700/60 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-emerald-300 font-semibold">PROGRESSO DA ZONA</span>
          <span className="text-sm text-slate-300 tabular-nums">{prog.done}/{prog.target} ({pct}%)</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {lider && <div className="text-xs text-slate-400 mt-2">Liderando aqui: <span className="text-emerald-200 font-semibold">{lider.name}</span> ({lider.pct.toFixed(1)}%)</div>}
      </div>

      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {/* GOVERNO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3">Governo · sua zona</div>
          <div className="space-y-2.5">
            {governo.length === 0 && <div className="text-xs text-slate-500">Sem votos ainda.</div>}
            {governo.map((c, i) => {
              const isCand = !OPCOES.includes(c.name);
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-4 font-bold ${i === 0 && isCand ? "text-emerald-300" : "text-slate-500"}`}>{isCand ? `${i + 1}º` : "—"}</span>
                      {isCand && <CandAvatar photo={photoByName[c.name]} color={c.color} size={20} />}
                      <span className={`truncate ${i === 0 && isCand ? "text-emerald-200 font-semibold" : "text-slate-300"}`}>{c.name}</span>
                      {i === 0 && isCand && <Crown size={12} className="text-emerald-300 shrink-0" />}
                    </span>
                    <span className="tabular-nums font-bold shrink-0" style={{ color: c.color || "#94a3b8" }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, background: c.color || "#64748b", opacity: isCand ? 1 : 0.5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SENADO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3">Senado · sua zona</div>
          <div className="space-y-2.5">
            {senado.length === 0 && <div className="text-xs text-slate-500">Sem votos ainda.</div>}
            {senado.map((c, i) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 min-w-0"><span className="w-4 font-bold text-slate-500">{i + 1}º</span>{!OPCOES.includes(c.name) && <CandAvatar photo={photoByName[c.name]} color={c.color} size={20} />}<span className="truncate text-slate-300">{c.name}</span></span>
                  <span className="tabular-nums font-bold shrink-0" style={{ color: c.color || "#94a3b8" }}>{c.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(c.pct * 2, 100)}%`, background: c.color || "#64748b" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COTAS DA ZONA */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Users size={15} /> Cotas da zona</div>
          <div className="space-y-2">
            {(data.quotas ?? []).map((q) => {
              const p = q.target ? Math.round((Number(q.completed) / Number(q.target)) * 100) : 0;
              return (
                <div key={q.label}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{q.label}</span><span className="text-slate-400">{q.completed}/{q.target}</span></div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${p}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEED + FLAGS */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm flex items-center gap-2"><Radio size={15} className="text-emerald-400" /> Recentes</span>
            <span className="text-xs text-amber-300 flex items-center gap-1"><AlertTriangle size={12} />{flagsTotal} flags</span>
          </div>
          <div className="space-y-2">
            {(data.recent ?? []).length === 0 && <div className="text-xs text-slate-500">Aguardando campo…</div>}
            {(data.recent ?? []).map((f) => (
              <button key={f.id} onClick={() => abrirMidia(f)} title="Ouvir áudio e ver fotos"
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-xs hover:border-emerald-700 hover:bg-emerald-900/10 transition-colors">
                <div className="flex justify-between text-slate-200 font-semibold"><span className="truncate">{f.interviewer}</span>
                  <span className="flex items-center gap-1.5 shrink-0">{(f.fraud_flags?.length ?? 0) > 0 ? <span className="text-amber-300 flex items-center gap-1"><AlertTriangle size={10} />flag</span> : <CheckCircle2 size={12} className="text-emerald-400" />}<Headphones size={12} className="text-slate-500" /></span>
                </div>
                <div className="text-slate-400 mt-0.5">{f.profile} · Gov: <span className="text-emerald-300">{f.gov_vote ?? "—"}</span> · {fmt(f.duration_sec ?? 0)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-600 mt-4">⚠ Parcial não ponderada · uso interno · somente a sua zona.</div>
      </>)}

      {/* MODAL DE MÍDIA (clique no feed) */}
      {mediaSel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setMediaSel(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{mediaSel.interviewer ?? "Entrevista"}</div>
                <div className="text-xs text-slate-400">{mediaSel.profile} · {fmt(mediaSel.duration_sec ?? 0)}</div>
              </div>
              <button onClick={() => setMediaSel(null)} className="text-slate-400 p-1 shrink-0"><X size={18} /></button>
            </div>
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
                        <a key={p.seq} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[3/4] rounded-lg overflow-hidden border border-slate-700">
                          <img src={p.url} alt={`Foto ${p.seq}`} className="w-full h-full object-cover" />
                        </a>))}</div>
                    : <div className="text-xs text-slate-500">Sem fotos.</div>}
                </div>
                <p className="text-[11px] text-slate-500">Somente auditoria · o voto é sigiloso (não exibido).</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
