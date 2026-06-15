import { ShieldCheck, ArrowRight } from "lucide-react";

export default function ConsentLGPD({ onAgree, onCancel }) {
  return (
    <div className="min-h-full p-4 max-w-md mx-auto flex flex-col">
      <h2 className="text-base font-bold mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary-light" /> Consentimento (LGPD)
      </h2>
      <div className="card p-4 text-sm text-slate-600 leading-relaxed mb-4">
        <p className="font-semibold text-slate-900 mb-2">Leia para o entrevistado:</p>
        <p>
          "Esta é uma pesquisa de opinião registrada no TSE. Suas respostas são
          confidenciais e o voto é sigiloso. Os dados são tratados conforme a LGPD,
          usados apenas para fins estatísticos, com retenção pelo prazo legal e acesso
          restrito. O(a) sr(a). concorda em participar?"
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button onClick={onCancel} className="btn-secondary">Não concorda</button>
        <button onClick={onAgree} className="btn-primary">Concorda <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}
