// Espelho read-only do questionário da zona do gerente (gerais + da zona).
// Núcleo de voto = só lista (já está na apuração); extras = resumo agregado da zona.
import { useEffect, useState } from "react";
import { Lock, BarChart3 } from "lucide-react";
import { api } from "../lib/api.js";

const TYPE_LABEL = { scale: "Escala", single: "Única", multi: "Múltipla", open: "Aberta" };

export default function ManagerQuestionario({ stratum }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agg, setAgg] = useState({});

  useEffect(() => {
    if (!stratum?.id) return;
    api.listQuestions(stratum.id).then((r) => setList(r.questions ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [stratum?.id]);

  const toggleAgg = async (q) => {
    if (agg[q.code]) { setAgg((a) => { const n = { ...a }; delete n[q.code]; return n; }); return; }
    try {
      const r = await api.apuracaoExtra({ code: q.code, zone: stratum.zone, municipality: stratum.municipality });
      setAgg((a) => ({ ...a, [q.code]: r.distribution ?? [] }));
    } catch { /* ignore */ }
  };

  return (
    <div className="card p-4">
      <div className="font-semibold text-sm mb-1">Questionário desta zona</div>
      <p className="text-[11px] text-slate-500 mb-3">Perguntas aplicadas aqui (gerais + da sua zona). As de voto alimentam a apuração; nas extras você vê o resumo das respostas da sua zona.</p>
      {loading && <div className="text-xs text-slate-500">Carregando…</div>}
      {!loading && list.length === 0 && <div className="text-xs text-slate-500">Nenhuma pergunta configurada.</div>}
      <div className="space-y-2">
        {list.map((q) => (
          <div key={q.id} className="bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 shrink-0">{TYPE_LABEL[q.type] ?? q.type}</span>
              <span className="flex-1 min-w-0 truncate">{q.label}</span>
              {q.is_core
                ? <Lock size={13} className="text-amber-400 shrink-0" title="Pergunta de voto (na apuração)" />
                : q.type !== "open" && <button onClick={() => toggleAgg(q)} className="text-slate-400 p-1 shrink-0" title="Ver respostas"><BarChart3 size={15} /></button>}
            </div>
            {agg[q.code] && (
              <div className="mt-2 border-t border-slate-800 pt-2 space-y-1.5">
                {agg[q.code].length === 0 && <div className="text-[11px] text-slate-500">Sem respostas ainda.</div>}
                {agg[q.code].map((d) => (
                  <div key={d.option}>
                    <div className="flex justify-between text-[11px] mb-0.5"><span className="text-slate-300">{d.option}</span><span className="text-slate-400">{d.pct}% ({d.count})</span></div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${d.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
