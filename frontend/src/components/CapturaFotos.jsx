// Captura de até 3 fotos — PROMPT §8. Watermark (timestamp+GPS) em canvas.
import { useState, useRef } from "react";
import { Camera, X, CheckCircle2, AlertTriangle, MapPin, Clock } from "lucide-react";

const MAX_FOTOS = 3;

export default function CapturaFotos({ gps, onConcluir, onPular }) {
  const [fotos, setFotos] = useState([]);
  const [consentFoto, setConsentFoto] = useState(null);
  const inputRef = useRef(null);

  const capturar = (e) => {
    const file = e.target.files?.[0];
    if (!file || fotos.length >= MAX_FOTOS) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const stamp = `${new Date().toLocaleString("pt-BR")} · ${gps?.lat?.toFixed(5) ?? "?"}, ${gps?.lng?.toFixed(5) ?? "?"}`;
        ctx.font = `${Math.max(14, img.width * 0.022)}px monospace`;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(0, img.height - img.width * 0.05, img.width, img.width * 0.05);
        ctx.fillStyle = "#fff";
        ctx.fillText(stamp, 12, img.height - img.width * 0.016);
        setFotos((f) => [...f, { dataUrl: cv.toDataURL("image/jpeg", 0.8), takenAt: new Date().toISOString(), gps }]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const remover = (i) => setFotos((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      {consentFoto === null && (
        <div className="card p-4 text-sm text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-100 mb-2">Leia para o entrevistado:</p>
          <p>
            "Por exigência de auditoria do instituto, precisamos registrar até 3 fotos suas
            durante a entrevista. As imagens são confidenciais, usadas apenas para comprovar
            a realização da entrevista, e serão eliminadas após o prazo legal. O(a) sr(a). autoriza?"
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => { setConsentFoto(false); onPular(); }} className="btn-secondary">Não autorizou</button>
            <button onClick={() => setConsentFoto(true)} className="btn-primary">Autorizou</button>
          </div>
        </div>
      )}

      {consentFoto && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) =>
              fotos[i] ? (
                <div key={i} className="relative aspect-[3/4] rounded-el overflow-hidden border border-emerald-700">
                  <img src={fotos[i].dataUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => remover(i)} className="absolute top-1 right-1 bg-rose-600 rounded-full p-1"><X size={12} /></button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-emerald-300 px-1 py-0.5 flex items-center gap-1">
                    <CheckCircle2 size={9} /> Foto {i + 1}
                  </div>
                </div>
              ) : (
                <button key={i} disabled={i !== fotos.length} onClick={() => inputRef.current?.click()}
                  className={`aspect-[3/4] rounded-el border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs ${
                    i === fotos.length ? "border-emerald-600 text-emerald-400 bg-emerald-900/10" : "border-slate-800 text-slate-600"}`}>
                  <Camera size={20} /> Foto {i + 1}
                </button>
              ),
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={capturar} className="hidden" />
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span className="flex items-center gap-1"><Clock size={11} />timestamp</span>
            <span className="flex items-center gap-1"><MapPin size={11} />GPS no carimbo</span>
            <span>{fotos.length}/{MAX_FOTOS}</span>
          </div>
          {fotos.length === 0 && (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2 flex gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Sem fotos, a entrevista recebe flag "missing_photos" e vai para checagem prioritária.
            </div>
          )}
          <button onClick={() => onConcluir(fotos)} disabled={fotos.length === 0}
            className="btn-primary w-full py-4">
            Concluir entrevista ({fotos.length} foto{fotos.length !== 1 ? "s" : ""})
          </button>
        </>
      )}
    </div>
  );
}
