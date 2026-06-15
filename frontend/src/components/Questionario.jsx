// Questionário em PASSOS (wizard) com rotação de candidatos — PROMPT §1/§5.
import { useMemo, useState } from "react";
import { CheckCircle2, ArrowRight, ArrowLeft, User } from "lucide-react";

// Avatar do candidato (foto p/ o entrevistado associar nome×rosto, §F2).
function CandAvatar({ c }) {
  const [err, setErr] = useState(false);
  if (c.photo && !err) {
    return <img src={c.photo} alt="" onError={() => setErr(true)} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200" />;
  }
  return (
    <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center border border-slate-200" style={{ background: (c.color || "#A81824") + "1f" }}>
      <User size={16} style={{ color: c.color || "#A81824" }} />
    </span>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const REQUIRED = ["gov_c1", "sen_v1", "sen_v2"];

export default function Questionario({ pkg, onDone, onCancel }) {
  const questionnaire = pkg?.questionnaire ?? [];
  const candidates = pkg?.candidates ?? {};
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);

  // Ordem de rotação fixada por entrevista (reais embaralhados; opções ao fim).
  const ordered = useMemo(() => {
    const map = {};
    for (const q of questionnaire) {
      if (!q.office) continue;
      const list = candidates[q.office] ?? [];
      const real = list.filter((c) => !c.isOption);
      const opts = list.filter((c) => c.isOption);
      map[q.code] = [...(q.rotate ? shuffle(real) : real), ...opts];
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (code, value) => setAnswers((a) => ({ ...a, [code]: value }));
  const toggleMulti = (code, name) =>
    setAnswers((a) => {
      const cur = a[code] ?? [];
      return { ...a, [code]: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] };
    });

  const total = questionnaire.length;
  const q = questionnaire[step];
  const val = answers[q.code];
  const v1 = answers.sen_v1;
  const senDup = q.code === "sen_v2" && val && v1 && val === v1 && !["Branco/Nulo", "NS/NR"].includes(val);
  const answered = q.type === "multi" ? (val ?? []).length > 0 : val != null && val !== "";
  const canAdvance = (!REQUIRED.includes(q.code) || answered) && !senDup;
  const isLast = step === total - 1;

  const buildAnswers = () => {
    const out = [];
    for (const qq of questionnaire) {
      const value = answers[qq.code];
      if (value == null || (Array.isArray(value) && value.length === 0) || value === "") continue;
      if (qq.type === "single") out.push({ questionCode: qq.code, candidateName: value });
      else if (qq.type === "multi") out.push({ questionCode: qq.code, valueText: value.join(", ") });
      else out.push({ questionCode: qq.code, valueText: value });
    }
    return out;
  };

  const next = () => (isLast ? onDone(buildAnswers()) : setStep((s) => s + 1));
  const back = () => (step === 0 ? onCancel() : setStep((s) => s - 1));

  return (
    <div className="min-h-full p-4 max-w-md mx-auto flex flex-col">
      {/* Progresso */}
      <div className="mb-4">
        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
          <span>Pergunta {step + 1} de {total}</span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="card p-4 flex-1">
        <div className="text-base font-semibold mb-4">{q.label}</div>

        {q.type === "open" && (
          <input className="input" placeholder="Resposta espontânea…" autoFocus
            value={val ?? ""} onChange={(e) => set(q.code, e.target.value)} />
        )}

        {q.type === "single" && (
          <div className="space-y-2">
            {(ordered[q.code] ?? []).map((c) => (
              <button key={c.name} onClick={() => set(q.code, c.name)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-el text-sm text-left border ${
                  val === c.name ? "border-primary bg-brand-50 text-brand-dark font-medium" : "border-slate-200 text-slate-700"}`}>
                <CandAvatar c={c} />
                {c.name}
                {val === c.name && <CheckCircle2 size={16} className="ml-auto text-primary" />}
              </button>
            ))}
          </div>
        )}

        {q.type === "multi" && (
          <div className="space-y-2">
            {(ordered[q.code] ?? []).map((c) => {
              const on = (val ?? []).includes(c.name);
              return (
                <button key={c.name} onClick={() => toggleMulti(q.code, c.name)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-el text-sm text-left border ${
                    on ? "border-rose-400 bg-rose-50 text-rose-700 font-medium" : "border-slate-200 text-slate-700"}`}>
                  <CandAvatar c={c} />
                  {c.name}
                  {on && <CheckCircle2 size={16} className="ml-auto text-rose-500" />}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "scale" && (
          <div className="flex flex-wrap gap-2">
            {q.scale.map((opt) => (
              <button key={opt} onClick={() => set(q.code, opt)}
                className={`px-3.5 py-2 rounded-el text-sm border ${
                  val === opt ? "border-primary bg-brand-50 text-brand-dark font-medium" : "border-slate-200 text-slate-700"}`}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {senDup && <p className="text-xs text-rose-600 mt-3">O 2º voto deve ser diferente do 1º.</p>}
        {REQUIRED.includes(q.code) && !answered && (
          <p className="text-[11px] text-slate-500 mt-3">Esta pergunta é obrigatória.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={back} className="btn-secondary">
          <ArrowLeft size={16} /> {step === 0 ? "Cancelar" : "Voltar"}
        </button>
        <button onClick={next} disabled={!canAdvance} className="btn-primary">
          {isLast ? "Finalizar" : "Avançar"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
