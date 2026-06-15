import { useEffect, useState } from "react";
import { Users, AlertTriangle, ClipboardCheck, BarChart3, ExternalLink, MapPin } from "lucide-react";
import { api } from "../lib/api.js";

const Kpi = ({ icon, label, value, sub }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">{icon}{label}</div>
    <div className="text-2xl font-bold tabular-nums">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

export default function VisaoGeral() {
  const [r, setR] = useState(null);
  useEffect(() => { api.resumo().then(setR).catch(() => {}); }, []);
  if (!r) return <div className="text-slate-400 text-sm">Carregando…</div>;

  const pct = r.target ? Math.round((r.total / r.target) * 100) : 0;
  const flagsTotal = (r.flags ?? []).reduce((a, f) => a + Number(f.count), 0);
  const chk = r.checagem ?? {};
  const porRegiao = (reg) => (r.porEstrato ?? []).filter((e) => e.region === reg);
  const somaReg = (reg) => porRegiao(reg).reduce((a, e) => ({ done: a.done + Number(e.done), target: a.target + Number(e.target) }), { done: 0, target: 0 });
  const manaus = somaReg("manaus");
  const interior = somaReg("interior");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<BarChart3 size={13} />} label="Coletadas" value={`${r.total}`} sub={`de ${r.target} (${pct}%)`} />
        <Kpi icon={<MapPin size={13} />} label="Manaus" value={`${manaus.done}`} sub={`de ${manaus.target}`} />
        <Kpi icon={<MapPin size={13} />} label="Interior" value={`${interior.done}`} sub={`de ${interior.target}`} />
        <Kpi icon={<AlertTriangle size={13} />} label="Flags" value={`${flagsTotal}`} sub="p/ checagem" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* CHECAGEM */}
        <div className="card p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><ClipboardCheck size={15} /> Checagem</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-surface-2/40 rounded-el p-2.5"><div className="text-xs text-slate-400">Na fila</div><div className="text-lg font-bold">{chk.pending ?? 0}</div></div>
            <div className="bg-surface-2/40 rounded-el p-2.5"><div className="text-xs text-slate-400">Total</div><div className="text-lg font-bold">{chk.total ?? 0}</div></div>
            <div className="bg-emerald-900/15 border border-emerald-800 rounded-el p-2.5"><div className="text-xs text-emerald-300">Aprovadas</div><div className="text-lg font-bold text-emerald-300">{chk.approved ?? 0}</div></div>
            <div className="bg-rose-900/15 border border-rose-800 rounded-el p-2.5"><div className="text-xs text-rose-300">Reprovadas</div><div className="text-lg font-bold text-rose-300">{chk.rejected ?? 0}</div></div>
          </div>
        </div>

        {/* FLAGS DETALHE */}
        <div className="card p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-400" /> Flags por tipo</div>
          <div className="space-y-2 text-sm">
            {(r.flags ?? []).length === 0 && <div className="text-xs text-slate-500">Nenhuma flag.</div>}
            {(r.flags ?? []).map((f) => (
              <div key={f.flag} className="flex justify-between bg-surface-2/40 rounded-el p-2"><span className="text-slate-300">{f.flag}</span><span className="font-bold tabular-nums">{f.count}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* PROGRESSO POR ESTRATO */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-3">Progresso por estrato</div>
        <div className="space-y-2">
          {(r.porEstrato ?? []).map((e) => {
            const p = e.target ? Math.round((Number(e.done) / Number(e.target)) * 100) : 0;
            return (
              <div key={e.name}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{e.name}</span><span className="text-slate-400">{e.done}/{e.target}</span></div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${p}%` }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ATALHOS */}
      <div className="grid sm:grid-cols-2 gap-3">
        <a href="http://localhost:5175" target="_blank" rel="noreferrer" className="card p-4 flex items-center gap-3 hover:brightness-110">
          <BarChart3 size={20} className="text-emerald-400" />
          <div><div className="font-semibold text-sm">Dashboard de Apuração</div><div className="text-xs text-slate-500">placar ao vivo (coordenação)</div></div>
          <ExternalLink size={14} className="ml-auto text-slate-500" />
        </a>
        <a href="http://localhost:5174" target="_blank" rel="noreferrer" className="card p-4 flex items-center gap-3 hover:brightness-110">
          <Users size={20} className="text-emerald-400" />
          <div><div className="font-semibold text-sm">Portal de Verificação</div><div className="text-xs text-slate-500">consulta pública de recibos</div></div>
          <ExternalLink size={14} className="ml-auto text-slate-500" />
        </a>
      </div>
    </div>
  );
}
