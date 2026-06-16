// Apuração ao vivo embutida no Admin (visão geral, todas as zonas).
// Reusa snapshot REST + WebSocket; sem header/logout próprios (o Admin provê).
import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Crown, AlertTriangle, CheckCircle2, MapPin, Pause, Play, Radio, Mic, Image as ImageIcon, X, Headphones } from "lucide-react";
import { api, auth } from "../lib/api.js";
import RecorteRegional from "./RecorteRegional.jsx";
import CandAvatar from "./CandAvatar.jsx";

const OPCOES = ["Branco/Nulo", "NS/NR"];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const hm = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function ApuracaoEmbed() {
  const [snapshot, setSnapshot] = useState(null);
  const [feed, setFeed] = useState([]);
  const [serie, setSerie] = useState([]);
  const [aoVivo, setAoVivo] = useState(true);
  const [wsOpen, setWsOpen] = useState(false);
  const [wsTick, setWsTick] = useState(0);
  const [photoByName, setPhotoByName] = useState({});
  const [mediaSel, setMediaSel] = useState(null); // entrevista selecionada no feed
  const [media, setMedia] = useState(null);
  const aoVivoRef = useRef(true);
  aoVivoRef.current = aoVivo;

  const abrirMidia = async (f) => {
    setMediaSel(f); setMedia(null);
    try { setMedia(await api.interviewMedia(f.id)); }
    catch (e) { setMedia({ error: e.body?.error || "erro" }); }
  };

  useEffect(() => {
    api.snapshot().then(setSnapshot).catch(() => {});
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
    ws.onmessage = (e) => {
      if (!aoVivoRef.current) return;
      let ev; try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type !== "interview:new") return;
      setSnapshot(ev.apuracao);
      setWsTick((t) => t + 1);
      setFeed((f) => [{ ...ev.interview, hora: hm() }, ...f].slice(0, 6));
      const realPct = {};
      (ev.apuracao.governo.total ?? []).filter((c) => !OPCOES.includes(c.name)).forEach((c) => { realPct[c.name] = c.pct; });
      setSerie((s) => [...s.slice(-23), { t: hm(), ...realPct }]);
    };
    return () => ws.close();
  }, []);

  if (!snapshot) return <div className="text-slate-400 text-sm">Carregando apuração…</div>;

  const govTotal = snapshot.governo?.total ?? [];
  const senTotal = snapshot.senado?.total ?? [];
  const progress = snapshot.progress ?? { done: 0, target: 0, manaus: { done: 0, target: 0 }, interior: { done: 0, target: 0 } };
  const cands = govTotal.filter((c) => !OPCOES.includes(c.name));
  const lider = cands[0];
  const vice = cands[1];
  const margem = lider && vice ? (lider.pct - vice.pct).toFixed(1) : "0.0";
  const empate = lider && vice && Math.abs(lider.pct - vice.pct) <= 3;
  const pctTotal = progress.target ? Math.round((progress.done / progress.target) * 100) : 0;
  const linhas = cands.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${wsOpen && aoVivo ? "text-emerald-300 border-emerald-700 bg-emerald-900/30" : "text-slate-400 border-slate-700 bg-slate-800"}`}>
          <span className={`rounded-full h-2 w-2 ${wsOpen && aoVivo ? "bg-emerald-400" : "bg-slate-500"}`} />
          {!wsOpen ? "OFFLINE" : aoVivo ? "AO VIVO" : "PAUSADO"} · {progress.done}/{progress.target} ({pctTotal}%)
        </span>
        <button onClick={() => setAoVivo((v) => !v)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
          {aoVivo ? <Pause size={13} /> : <Play size={13} />}{aoVivo ? "Pausar" : "Retomar"}
        </button>
      </div>

      {/* PLACAR */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 min-w-0 bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-700/60 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-600 flex items-center justify-center shrink-0"><Crown size={22} className="text-emerald-300" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-emerald-300 font-semibold">LIDERANDO · GOVERNO</div>
            <div className="text-xl font-bold truncate">{lider?.name ?? "—"}</div>
            <div className="text-xs text-slate-300 truncate">{lider ? `${lider.pct.toFixed(1)}% · ` : ""}{vice && <><span className="text-emerald-300">+{margem} p.p.</span> sobre {vice.name}</>}</div>
          </div>
          <div className="text-right shrink-0"><div className="text-2xl sm:text-3xl font-black text-emerald-300 tabular-nums">{lider ? lider.pct.toFixed(1) : "0.0"}%</div><div className="text-[10px] text-slate-400">{lider?.votes ?? 0} votos</div></div>
        </div>
        <div className={`min-w-0 rounded-2xl p-4 border flex flex-col justify-center ${empate ? "bg-amber-900/20 border-amber-700" : "bg-slate-900 border-slate-800"}`}>
          {empate
            ? <><div className="flex items-center gap-2 text-amber-300 text-xs font-semibold"><AlertTriangle size={14} />EMPATE TÉCNICO</div><div className="text-xs text-slate-300 mt-1">{margem} p.p. (dentro de ±3)</div></>
            : <><div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold"><CheckCircle2 size={14} />FORA DA MARGEM</div><div className="text-xs text-slate-300 mt-1">{margem} p.p. (supera ±3)</div></>}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <RecorteRegional governo={snapshot.governo} wsTick={wsTick} photoByName={photoByName} />

        {/* SENADO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3">Senado · 2 vagas</div>
          <div className="space-y-2.5">
            {senTotal.length === 0 && <div className="text-xs text-slate-500">Sem votos.</div>}
            {senTotal.map((c, i) => {
              const eleito = i < 2 && !OPCOES.includes(c.name);
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 min-w-0"><span className={`w-4 font-bold ${eleito ? "text-emerald-300" : "text-slate-500"}`}>{i + 1}º</span>{!OPCOES.includes(c.name) && <CandAvatar photo={photoByName[c.name]} color={c.color} size={20} />}<span className="truncate text-slate-300">{c.name}</span>{eleito && <span className="text-[10px] px-1 rounded bg-emerald-900/50 border border-emerald-700 text-emerald-300 shrink-0">VAGA</span>}</span>
                    <span className="tabular-nums font-bold shrink-0" style={{ color: c.color || "#94a3b8" }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(c.pct * 2, 100)}%`, background: c.color || "#64748b" }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEED */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm mb-3"><Radio size={15} className="text-emerald-400" /> Entrevistas finalizadas</div>
          <div className="space-y-2">
            {feed.length === 0 && <div className="text-xs text-slate-500">Aguardando campo…</div>}
            {feed.map((f) => (
              <button key={f.id} onClick={() => abrirMidia(f)} title="Ouvir áudio e ver fotos"
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-xs hover:border-emerald-700 hover:bg-emerald-900/10 transition-colors">
                <div className="flex justify-between text-slate-200 font-semibold"><span className="truncate">{f.interviewer ?? "—"}</span><span className="text-slate-500">{f.hora}</span></div>
                <div className="flex items-center gap-1 text-slate-400 mt-0.5"><MapPin size={10} />{f.area} · {f.profile}</div>
                <div className="flex justify-between items-center mt-0.5"><span>{fmt(f.durationSec ?? 0)}</span><span className="flex items-center gap-1.5">{f.flags?.length ? <span className="text-amber-300 flex items-center gap-1"><AlertTriangle size={10} />flag</span> : <CheckCircle2 size={12} className="text-emerald-400" />}<Headphones size={12} className="text-slate-500" /></span></div>
              </button>
            ))}
          </div>
        </div>

        {/* EVOLUÇÃO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:col-span-2">
          <div className="font-semibold text-sm mb-2">Evolução da parcial — Governo</div>
          {serie.length < 2 ? (
            <div className="h-[190px] flex items-center justify-center text-xs text-slate-500">Coletando série… (atualiza a cada entrevista)</div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={serie}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} width={32} domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} />
                {linhas.map((c) => <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color || "#64748b"} strokeWidth={2.5} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 text-xs mt-1">{linhas.map((c) => <span key={c.name} className="flex items-center gap-1.5"><span className="w-3 h-1 rounded inline-block" style={{ background: c.color || "#64748b" }} />{c.name}</span>)}</div>
        </div>

        {/* PROGRESSO */}
        <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3">Progresso da amostra</div>
          {[["Manaus", progress.manaus], ["Interior", progress.interior]].map(([nome, e]) => (
            <div key={nome} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{nome}</span><span className="text-slate-400">{e.done}/{e.target}</span></div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${e.target ? (e.done / e.target) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE MÍDIA (clique no feed) */}
      {mediaSel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setMediaSel(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{mediaSel.interviewer ?? "Entrevista"}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={11} />{mediaSel.area} · {fmt(mediaSel.durationSec ?? 0)} · {mediaSel.hora}</div>
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
