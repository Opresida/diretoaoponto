import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";

export default function Triagem({ pkg, onDone, onCancel }) {
  const strata = (pkg?.strata ?? []).filter((s) => s.quotas.some((q) => Number(q.remaining) > 0));
  const [stratumId, setStratumId] = useState(strata[0]?.id ?? "");
  const stratum = strata.find((s) => s.id === stratumId);
  const quotas = (stratum?.quotas ?? []).filter((q) => Number(q.remaining) > 0);
  const [quotaId, setQuotaId] = useState("");
  const quota = quotas.find((q) => q.id === quotaId);
  const [age, setAge] = useState("");

  const ageOk = quota && Number(age) >= quota.age_min && Number(age) <= quota.age_max;

  return (
    <div className="min-h-full p-4 max-w-md mx-auto">
      <h2 className="text-base font-bold mb-1 flex items-center gap-2"><Users size={18} /> Triagem de cota</h2>
      <p className="text-xs text-slate-400 mb-4">Selecione o estrato e a cota que correspondem ao entrevistado.</p>

      <label className="text-xs text-slate-400">Estrato</label>
      <select className="input mt-1 mb-4" value={stratumId}
        onChange={(e) => { setStratumId(e.target.value); setQuotaId(""); setAge(""); }}>
        {strata.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <label className="text-xs text-slate-400">Cota (sexo · faixa etária)</label>
      <div className="grid grid-cols-2 gap-2 mt-1 mb-4">
        {quotas.map((q) => (
          <button key={q.id} onClick={() => { setQuotaId(q.id); setAge(String(q.age_min)); }}
            className={`p-2.5 rounded-el text-xs text-left border ${quotaId === q.id
              ? "border-primary bg-brand-50 text-brand-dark"
              : "border-slate-200 bg-surface-2 text-slate-700"}`}>
            <div className="font-semibold">{q.label}</div>
            <div className="text-[11px] text-slate-500">{q.remaining} restantes</div>
          </button>
        ))}
      </div>

      {quota && (
        <>
          <label className="text-xs text-slate-400">Idade do entrevistado ({quota.age_min}–{quota.age_max})</label>
          <input className="input mt-1 mb-1" type="number" inputMode="numeric" value={age}
            min={quota.age_min} max={quota.age_max} onChange={(e) => setAge(e.target.value)} />
          {!ageOk && age !== "" && <p className="text-[11px] text-rose-600 mb-2">Idade fora da faixa da cota.</p>}
          <p className="text-[11px] text-slate-500 mb-4">Sexo: {quota.sex === "F" ? "Feminino" : "Masculino"}</p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button className="btn-primary" disabled={!quota || !ageOk}
          onClick={() => onDone({ stratumId, quotaId, respondent: { sex: quota.sex, age: Number(age) } })}>
          Continuar <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
