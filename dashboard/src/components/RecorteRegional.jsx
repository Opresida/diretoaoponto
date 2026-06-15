// Recorte com drill-down — PROMPT §7 + F1. 2 abas: Manaus→zonas, Interior→municípios.
// "Todos" usa o snapshot (sem fetch); zona/município faz fetch sob demanda.
import { useEffect, useState } from "react";
import { Crown, MapPin } from "lucide-react";
import { api } from "../lib/api.js";

const OPCOES = ["Branco/Nulo", "NS/NR"];

export default function RecorteRegional({ governo, wsTick = 0 }) {
  const [geo, setGeo] = useState({ manaus: [], interior: [] });
  const [tab, setTab] = useState("manaus");
  const [sel, setSel] = useState(null); // {zone} | {municipality} | null (Todos)
  const [drill, setDrill] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.geo().then(setGeo).catch(() => {}); }, []);

  useEffect(() => {
    if (!sel) { setDrill(null); return; }
    setLoading(true);
    api.governo({ ...sel }).then((r) => setDrill(r.ranking)).catch(() => setDrill([])).finally(() => setLoading(false));
  }, [sel, wsTick]);

  const dados = sel ? (drill ?? []) : (governo?.[tab] ?? []);
  const chips = tab === "manaus"
    ? geo.manaus.map((z) => ({ key: z.zone, label: z.zone, sel: { zone: z.zone } }))
    : geo.interior.map((m) => ({ key: m.municipality, label: m.municipality, sel: { municipality: m.municipality } }));
  const selKey = sel?.zone ?? sel?.municipality ?? null;

  return (
    <div className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="font-semibold text-sm mb-2">Governo · Recorte regional</div>

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-2">
        {[["manaus", "Manaus"], ["interior", "Interior"]].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setSel(null); }}
            className={`flex-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${tab === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        <button onClick={() => setSel(null)}
          className={`px-2 py-0.5 rounded-lg text-[11px] border ${!sel ? "border-primary bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-400"}`}>
          {tab === "manaus" ? "Todas as zonas" : "Todos os municípios"}
        </button>
        {chips.map((c) => (
          <button key={c.key} onClick={() => setSel(c.sel)}
            className={`px-2 py-0.5 rounded-lg text-[11px] border ${selKey === c.key ? "border-primary bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-400"}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
        <MapPin size={11} />{selKey ?? (tab === "manaus" ? "Manaus (todas as zonas)" : "Interior (todos)")}{loading && " · carregando…"}
      </div>

      <div className="space-y-2.5">
        {dados.length === 0 && <div className="text-xs text-slate-500">Sem votos neste recorte ainda.</div>}
        {dados.map((c, i) => {
          const isCand = !OPCOES.includes(c.name);
          return (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-5 font-bold ${i === 0 && isCand ? "text-emerald-300" : "text-slate-500"}`}>{isCand ? `${i + 1}º` : "—"}</span>
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
  );
}
