// Gestor de questionário (§F4). Núcleo de voto é protegido (só rótulo/ordem).
// Extras: criar/editar/escopar por estrato (cascata) + ver respostas agregadas.
import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, ChevronUp, ChevronDown, Lock, BarChart3, Pencil } from "lucide-react";
import { api } from "../lib/api.js";

const TYPES = [
  ["scale", "Escala", "uma opção (ex.: Ótimo→Péssimo)"],
  ["single", "Única", "uma opção entre as listadas"],
  ["multi", "Múltipla", "marca várias opções"],
  ["open", "Aberta", "texto livre"],
];
const TYPE_LABEL = { scale: "Escala", single: "Única", multi: "Múltipla", open: "Aberta" };
const needsOptions = (t) => t === "scale" || t === "single" || t === "multi";

export default function Questionarios() {
  const [list, setList] = useState([]);
  const [geo, setGeo] = useState({ manaus: [], interior: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ label: "", type: "scale", options: [], stratumIds: [] });
  const [optIn, setOptIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [agg, setAgg] = useState({}); // code -> distribution[]

  const load = async () => {
    setLoading(true);
    try { setList((await api.listQuestions()).questions ?? []); } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); api.geo().then(setGeo).catch(() => {}); }, []);

  const strataOpts = [
    ...(geo.manaus ?? []).map((z) => ({ id: z.stratumId, label: `Manaus · ${z.zone}` })),
    ...(geo.interior ?? []).map((m) => ({ id: m.stratumId, label: `Interior · ${m.municipality}` })),
  ];
  const scopeLabel = (ids) => {
    if (!ids || !ids.length) return "Geral (todos)";
    return ids.map((id) => strataOpts.find((s) => s.id === id)?.label ?? "estrato").join(", ");
  };

  const addOpt = () => { const v = optIn.trim(); if (v && !form.options.includes(v)) setForm((f) => ({ ...f, options: [...f.options, v] })); setOptIn(""); };
  const toggleStrat = (id) => setForm((f) => ({ ...f, stratumIds: f.stratumIds.includes(id) ? f.stratumIds.filter((x) => x !== id) : [...f.stratumIds, id] }));

  const create = async (e) => {
    e.preventDefault(); setErr("");
    if (!form.label.trim()) { setErr("Informe o enunciado da pergunta."); return; }
    if (needsOptions(form.type) && form.options.length < 2) { setErr("Adicione ao menos 2 opções."); return; }
    setBusy(true);
    try {
      await api.createQuestion({
        label: form.label.trim(), type: form.type,
        options: needsOptions(form.type) ? form.options : undefined,
        stratumIds: form.stratumIds.length ? form.stratumIds : undefined,
      });
      setForm({ label: "", type: "scale", options: [], stratumIds: [] }); setOptIn("");
      await load();
    } catch { setErr("Falha ao criar a pergunta."); } finally { setBusy(false); }
  };

  const saveLabel = async (id) => { if (editLabel.trim()) await api.updateQuestion(id, { label: editLabel.trim() }); setEditId(null); await load(); };
  const remove = async (q) => {
    if (!window.confirm(`Excluir a pergunta "${q.label}"?`)) return;
    try { await api.deleteQuestion(q.id); await load(); } catch { setErr("Esta pergunta não pode ser excluída (núcleo de voto)."); }
  };
  const move = async (q, dir) => {
    const extras = list.filter((x) => !x.is_core);
    const idx = extras.findIndex((x) => x.id === q.id);
    const j = dir < 0 ? idx - 1 : idx + 1;
    if (j < 0 || j >= extras.length) return;
    const a = extras[idx], b = extras[j];
    await api.reorderQuestions([{ id: a.id, seq: b.seq }, { id: b.id, seq: a.seq }]);
    await load();
  };
  const toggleAgg = async (q) => {
    if (agg[q.code]) { setAgg((a) => { const n = { ...a }; delete n[q.code]; return n; }); return; }
    try { const r = await api.apuracaoExtra({ code: q.code }); setAgg((a) => ({ ...a, [q.code]: r.distribution ?? [] })); } catch { /* ignore */ }
  };

  const core = list.filter((q) => q.is_core);
  const extras = list.filter((q) => !q.is_core);

  const LabelCell = ({ q }) => editId === q.id ? (
    <span className="flex items-center gap-1 flex-1 min-w-0">
      <input className="input py-1.5" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
      <button onClick={() => saveLabel(q.id)} className="btn-primary px-2 py-1.5"><Check size={14} /></button>
      <button onClick={() => setEditId(null)} className="btn-secondary px-2 py-1.5"><X size={14} /></button>
    </span>
  ) : (
    <span className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="truncate">{q.label}</span>
      <button onClick={() => { setEditId(q.id); setEditLabel(q.label); }} className="text-slate-400 p-1 shrink-0" title="Editar rótulo"><Pencil size={13} /></button>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* NOVA PERGUNTA (extra) */}
      <form onSubmit={create} className="card p-4">
        <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Plus size={15} /> Nova pergunta (extra)</div>
        <input className="input mb-2" placeholder="Enunciado da pergunta" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {TYPES.map(([t, l, d]) => (
            <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
              className={`p-2 rounded-el text-xs text-left border ${form.type === t ? "border-primary bg-emerald-900/20 text-emerald-200" : "border-slate-700 bg-surface-2/40 text-slate-300"}`}>
              <div className="font-semibold">{l}</div><div className="text-[10px] text-slate-400 leading-tight">{d}</div>
            </button>
          ))}
        </div>

        {needsOptions(form.type) && (
          <div className="mb-2">
            <div className="text-[11px] text-slate-400 mb-1">Opções</div>
            <div className="flex gap-2 mb-1.5">
              <input className="input py-1.5" placeholder="Digite uma opção e Adicionar" value={optIn}
                onChange={(e) => setOptIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpt(); } }} />
              <button type="button" onClick={addOpt} className="btn-secondary px-3 py-1.5 shrink-0">Adicionar</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.options.map((o) => (
                <span key={o} className="text-xs px-2 py-1 rounded-lg bg-surface-2/60 border border-slate-700 flex items-center gap-1">
                  {o}<button type="button" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((x) => x !== o) }))} className="text-slate-400"><X size={12} /></button>
                </span>
              ))}
              {form.options.length === 0 && <span className="text-[11px] text-slate-500">Nenhuma opção ainda.</span>}
            </div>
          </div>
        )}

        {/* ESCOPO (cascata) */}
        <div className="mb-2">
          <div className="text-[11px] text-slate-400 mb-1">Onde esta pergunta aparece <span className="text-slate-500">(sem seleção = geral, todos os estratos)</span></div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
            {strataOpts.length === 0 && <span className="text-[11px] text-slate-500">Cadastre municípios na aba Municípios para escopar por estrato.</span>}
            {strataOpts.map((s) => (
              <button type="button" key={s.id} onClick={() => toggleStrat(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs border ${form.stratumIds.includes(s.id) ? "border-primary bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-300"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-xs text-rose-400 mb-2">{err}</p>}
        <button className="btn-primary" disabled={busy}><Plus size={15} /> {busy ? "Criando…" : "Criar pergunta"}</button>
      </form>

      {/* NÚCLEO (voto) */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-1 flex items-center gap-2"><Lock size={14} className="text-amber-400" /> Núcleo de voto <span className="text-slate-500 font-normal">(protegido)</span></div>
        <p className="text-[11px] text-slate-500 mb-3">Alimentam a apuração — só o rótulo é editável (código/tipo travados; não podem ser excluídas).</p>
        {loading && <div className="text-xs text-slate-500">Carregando…</div>}
        <div className="space-y-2">
          {core.map((q) => (
            <div key={q.id} className="flex items-center gap-2 bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 shrink-0">{TYPE_LABEL[q.type]}{q.office ? ` · ${q.office === "governor" ? "gov" : q.office === "senator" ? "sen" : q.office}` : ""}</span>
              <LabelCell q={q} />
            </div>
          ))}
        </div>
      </div>

      {/* EXTRAS */}
      <div className="card p-4">
        <div className="font-semibold text-sm mb-3 flex items-center justify-between">
          <span>Perguntas extras <span className="text-slate-500 font-normal">({extras.length})</span></span>
        </div>
        {!loading && extras.length === 0 && <div className="text-xs text-slate-500">Nenhuma pergunta extra. Crie acima.</div>}
        <div className="space-y-2">
          {extras.map((q, i) => (
            <div key={q.id} className="bg-surface-2/40 border border-slate-800 rounded-el p-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 shrink-0">{TYPE_LABEL[q.type]}</span>
                <LabelCell q={q} />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => move(q, -1)} disabled={i === 0} className="text-slate-400 p-1 disabled:opacity-30" title="Subir"><ChevronUp size={15} /></button>
                  <button onClick={() => move(q, 1)} disabled={i === extras.length - 1} className="text-slate-400 p-1 disabled:opacity-30" title="Descer"><ChevronDown size={15} /></button>
                  <button onClick={() => toggleAgg(q)} className="text-slate-400 p-1" title="Ver respostas"><BarChart3 size={15} /></button>
                  <button onClick={() => remove(q)} className="text-rose-400 p-1" title="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                <span>Escopo: {scopeLabel(q.stratum_ids)}</span>
                {q.options?.length ? <span>Opções: {q.options.join(" · ")}</span> : null}
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
    </div>
  );
}
