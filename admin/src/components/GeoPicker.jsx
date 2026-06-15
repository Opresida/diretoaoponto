// Seletor de zona/município em 2 abas (Manaus zonas / Interior municípios).
// Resolve para um stratumId. Usado no cadastro/link de gerente.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function GeoPicker({ value, onChange }) {
  const [geo, setGeo] = useState({ manaus: [], interior: [] });
  const [tab, setTab] = useState("manaus");

  useEffect(() => { api.geo().then(setGeo).catch(() => {}); }, []);

  const opts = tab === "manaus"
    ? geo.manaus.map((z) => ({ label: z.zone, stratumId: z.stratumId }))
    : geo.interior.map((m) => ({ label: m.municipality, stratumId: m.stratumId }));

  return (
    <div>
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-2">
        {[["manaus", "Manaus (zonas)"], ["interior", "Interior (municípios)"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)}
            className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${tab === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
        {opts.length === 0 && <span className="text-xs text-slate-500">Nenhuma opção (cadastre municípios na aba Municípios).</span>}
        {opts.map((o) => (
          <button key={o.stratumId} type="button" onClick={() => onChange(o.stratumId)}
            className={`px-2.5 py-1 rounded-lg text-xs border ${value === o.stratumId ? "border-primary bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-300"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
