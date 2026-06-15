import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Crown, AlertTriangle, CheckCircle2, MapPin, Pause, Play, Radio, ShieldCheck, LogOut, WifiOff } from "lucide-react";
import { api, auth } from "../lib/api.js";
import RecorteRegional from "./RecorteRegional.jsx";

const OPCOES = ["Branco/Nulo", "NS/NR"];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const hm = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Dashboard({ user, onLogout }) {
  const [snapshot, setSnapshot] = useState(null);
  const [feed, setFeed] = useState([]);
  const [flagsTotal, setFlagsTotal] = useState(0);
  const [serie, setSerie] = useState([]);
  const [aoVivo, setAoVivo] = useState(true);
  const [wsOpen, setWsOpen] = useState(false);
  const aoVivoRef = useRef(true);
  aoVivoRef.current = aoVivo;

  // Estado inicial (REST) + flags do resumo.
  useEffect(() => {
    api.snapshot().then(setSnapshot).catch(() => {});
    api.resumo().then((r) => {
      const sum = (r.flags ?? []).reduce((a, f) => a + Number(f.count), 0);
      setFlagsTotal(sum);
    }).catch(() => {});
  }, []);

  // WebSocket ao vivo.
  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/apuracao?token=${auth.token}`);
    ws.onopen = () => setWsOpen(true);
    ws.onclose = () => setWsOpen(false);
    ws.onerror = () => setWsOpen(false);
    ws.onmessage = (e) => {
      if (!aoVivoRef.current) return;
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type !== "interview:new") return;
      setSnapshot(ev.apuracao);
      const it = ev.interview;
      setFeed((f) => [{ ...it, hora: hm() }, ...f].slice(0, 6));
      if (it.flags?.length) setFlagsTotal((n) => n + 1);
      const realPct = {};
      (ev.apuracao.governo.total ?? []).filter((c) => !OPCOES.includes(c.name)).forEach((c) => { realPct[c.name] = c.pct; });
      setSerie((s) => [...s.slice(-23), { t: hm(), ...realPct }]);
    };
    return () => ws.close();
  }, []);

  if (!snapshot) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando apuração…</div>;
  }

  const govTotal = snapshot.governo?.total ?? [];
  const senTotal = snapshot.senado?.total ?? [];
  const progress = snapshot.progress ?? { done: 0, target: 0, manaus: { done: 0, target: 0 }, interior: { done: 0, target: 0 } };
  const candidatosGov = govTotal.filter((c) => !OPCOES.includes(c.name));
  const lider = candidatosGov[0];
  const vice = candidatosGov[1];
  const margem = lider && vice ? (lider.pct - vice.pct).toFixed(1) : "0.0";
  const empate = lider && vice && Math.abs(lider.pct - vice.pct) <= 3;
  const pctTotal = progress.target ? Math.round((progress.done / progress.target) * 100) : 0;
  const linhas = candidatosGov.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-4 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold">Apuração em Tempo Real</h1>
            <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${wsOpen && aoVivo ? "text-emerald-300 border-emerald-700 bg-emerald-900/30" : "text-slate-400 border-slate-700 bg-slate-800"}`}>
              <span className="relative flex h-2 w-2">
                {wsOpen && aoVivo && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative rounded-full h-2 w-2 ${wsOpen && aoVivo ? "bg-emerald-400" : "bg-slate-500"}`} />
              </span>
              {!wsOpen ? "OFFLINE" : aoVivo ? "AO VIVO" : "PAUSADO"}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            AM-05275/2026 · {progress.done}/{progress.target} entrevistas ({pctTotal}%) · Parciais não ponderadas
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAoVivo((v) => !v)} className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
            {aoVivo ? <Pause size={14} /> : <Play size={14} />}{aoVivo ? "Pausar" : "Retomar"}
          </button>
          <span className="text-xs text-slate-400 hidden sm:block">{user?.name}</span>
          <button onClick={onLogout} className="text-slate-400 p-2"><LogOut size={16} /></button>
        </div>
      </div>

      {/* PLACAR LÍDER */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2 bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-700/60 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-emerald-500/20 border border-emerald-600 flex items-center justify-center shrink-0">
            <Crown className="text-emerald-300 w-6 h-6 sm:w-[26px] sm:h-[26px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-emerald-300 font-semibold tracking-wide">LIDERANDO · GOVERNO</div>
            <div className="text-xl sm:text-2xl font-bold truncate">{lider?.name ?? "—"}</div>
            <div className="text-xs sm:text-sm text-slate-300 truncate">
              {lider ? `${lider.pct.toFixed(1)}% · ` : ""}
              {vice && <><span className="text-emerald-300">+{margem} p.p.</span> sobre {vice.name}</>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl sm:text-4xl font-black text-emerald-300 tabular-nums">{lider ? lider.pct.toFixed(1) : "0.0"}%</div>
            <div className="text-[10px] sm:text-xs text-slate-400">{lider?.votes ?? 0} votos</div>
          </div>
        </div>
        <div className={`rounded-2xl p-4 border flex flex-col justify-center ${empate ? "bg-amber-900/20 border-amber-700" : "bg-slate-900 border-slate-800"}`}>
          {empate ? (
            <>
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold"><AlertTriangle size={14} />EMPATE TÉCNICO</div>
              <div className="text-sm text-slate-300 mt-1">Diferença de {margem} p.p. dentro da margem de erro (±3 p.p.)</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold"><CheckCircle2 size={14} />LIDERANÇA FORA DA MARGEM</div>
              <div className="text-sm text-slate-300 mt-1">Diferença de {margem} p.p. supera a margem de erro (±3 p.p.)</div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* RECORTE REGIONAL (governo) */}
        <RecorteRegional governo={snapshot.governo} />

        {/* RANKING SENADO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="font-semibold text-sm mb-3">Senado · 2 vagas <span className="text-slate-500 font-normal">(consolidado 1º+2º)</span></div>
          <div className="space-y-3">
            {senTotal.length === 0 && <div className="text-xs text-slate-500">Sem votos ainda.</div>}
            {senTotal.map((c, i) => {
              const eleito = i < 2 && !OPCOES.includes(c.name);
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-5 text-center font-bold ${eleito ? "text-emerald-300" : "text-slate-500"}`}>{i + 1}º</span>
                      <span className={eleito ? "text-emerald-200 font-semibold" : "text-slate-300"}>{c.name}</span>
                      {eleito && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-700 text-emerald-300">VAGA</span>}
                    </span>
                    <span className="tabular-nums font-bold" style={{ color: c.color || "#94a3b8" }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(c.pct * 2, 100)}%`, background: c.color || "#64748b" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEED */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm mb-3"><Radio size={15} className="text-emerald-400" /> Entrevistas finalizadas</div>
          <div className="space-y-2">
            {feed.length === 0 && <div className="text-xs text-slate-500">Aguardando campo…</div>}
            {feed.map((f, i) => (
              <div key={f.id} className={`rounded-xl border p-2.5 text-xs transition-all ${i === 0 ? "border-emerald-600 bg-emerald-900/15" : "border-slate-800 bg-slate-800/40"}`}>
                <div className="flex justify-between text-slate-200 font-semibold">
                  <span className="truncate">{f.interviewer ?? "—"}</span><span className="text-slate-500">{f.hora}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 mt-0.5"><MapPin size={10} />{f.area} · {f.profile}</div>
                <div className="flex justify-between mt-0.5">
                  <span>Gov: <span className="text-emerald-300">{f.govVote ?? "—"}</span> · {fmt(f.durationSec ?? 0)}</span>
                  {f.flags?.length ? <span className="text-amber-300 flex items-center gap-1"><AlertTriangle size={10} />flag</span> : <CheckCircle2 size={12} className="text-emerald-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EVOLUÇÃO DOS LÍDERES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:col-span-2">
          <div className="font-semibold text-sm mb-2">Evolução da parcial — Governo</div>
          {serie.length < 2 ? (
            <div className="h-[190px] flex items-center justify-center text-xs text-slate-500">Coletando pontos da série… (atualiza a cada entrevista)</div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={serie}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} width={32} domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} />
                {linhas.map((c) => (
                  <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color || "#64748b"} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-4 text-xs mt-1">
            {linhas.map((c) => (
              <span key={c.name} className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded inline-block" style={{ background: c.color || "#64748b" }} />{c.name}
              </span>
            ))}
          </div>
        </div>

        {/* PROGRESSO + FLAGS */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="font-semibold text-sm mb-3">Progresso da amostra</div>
            {[["Manaus (6 zonas)", progress.manaus], ["Interior (14 municípios)", progress.interior]].map(([nome, e]) => (
              <div key={nome} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{nome}</span><span className="text-slate-400">{e.done}/{e.target}</span></div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${e.target ? (e.done / e.target) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <div><div className="font-bold">{flagsTotal} flags</div><div className="text-xs text-slate-500">priorizadas p/ checagem</div></div>
            {wsOpen ? <ShieldCheck size={18} className="text-emerald-400 ml-auto" /> : <WifiOff size={18} className="text-slate-500 ml-auto" />}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-600 mt-4">
        ⚠ Parciais de campo NÃO ponderadas — uso interno exclusivo. Resultado oficial somente após fechamento da base, ponderação e registro TSE.
      </div>
    </div>
  );
}
