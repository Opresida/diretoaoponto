// Recorte Manaus × Interior (Governo) — PROMPT §7. Consome governo {total,manaus,interior}.
import { useState } from "react";
import { Crown, MapPin } from "lucide-react";

const OPCOES = ["Branco/Nulo", "NS/NR"];

export default function RecorteRegional({ governo }) {
  const [recorte, setRecorte] = useState("total");
  const abas = [["total", "Amazonas"], ["manaus", "Manaus"], ["interior", "Interior"]];
  const dados = governo?.[recorte] ?? [];
  const candidatos = dados.filter((c) => !OPCOES.includes(c.name));

  const liderM = governo?.manaus?.filter((c) => !OPCOES.includes(c.name))[0];
  const liderI = governo?.interior?.filter((c) => !OPCOES.includes(c.name))[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm">Governo · Recorte regional</span>
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {abas.map(([v, l]) => (
            <button key={v} onClick={() => setRecorte(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${recorte === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {dados.length === 0 && <div className="text-xs text-slate-500">Sem votos neste recorte ainda.</div>}
        {dados.map((c, i) => {
          const isCand = !OPCOES.includes(c.name);
          return (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5">
                  <span className={`w-5 font-bold ${i === 0 && isCand ? "text-emerald-300" : "text-slate-500"}`}>{isCand ? `${i + 1}º` : "—"}</span>
                  <span className={i === 0 && isCand ? "text-emerald-200 font-semibold" : "text-slate-300"}>{c.name}</span>
                  {i === 0 && isCand && <Crown size={12} className="text-emerald-300" />}
                </span>
                <span className="tabular-nums font-bold" style={{ color: c.color || "#94a3b8" }}>{c.pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, background: c.color || "#64748b", opacity: isCand ? 1 : 0.5 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {[["Manaus", liderM], ["Interior", liderI]].map(([rotulo, l]) =>
          l ? (
            <div key={rotulo} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
              <div className="flex items-center gap-1 text-slate-400 mb-1"><MapPin size={11} />{rotulo} · liderando</div>
              <div className="font-bold text-emerald-200">{l.name}</div>
              <div style={{ color: l.color || "#94a3b8" }} className="font-bold tabular-nums">{l.pct.toFixed(1)}%</div>
            </div>
          ) : (
            <div key={rotulo} className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 text-slate-500">
              <div className="flex items-center gap-1 mb-1"><MapPin size={11} />{rotulo}</div>
              <div>sem dados</div>
            </div>
          ),
        )}
      </div>

      {candidatos.length > 1 && Math.abs(candidatos[0].pct - (candidatos[1]?.pct ?? 0)) <= 3 && (
        <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2">
          ⚠ Empate técnico neste recorte (diferença dentro da margem de erro ±3 p.p.)
        </div>
      )}
    </div>
  );
}
