// Recibo de verificação — PROMPT §14.3.
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Clock, Home } from "lucide-react";

export default function ReciboEntrevista({ code, portalUrl, synced, onDone }) {
  const url = `${portalUrl}/v/${code}`;
  const copiar = () => navigator.clipboard?.writeText(url);
  const compartilhar = () =>
    navigator.share?.({
      title: "Recibo da sua entrevista",
      text: `Sua entrevista foi registrada e será selada em blockchain. Verifique: ${url}`,
    });

  return (
    <div className="min-h-full p-4 max-w-md mx-auto flex flex-col">
      <div className="card p-5 text-center">
        <img src="/logo-white.png" alt="Direto ao Ponto" className="h-9 w-auto mx-auto mb-3" />
        <h2 className="text-base font-bold">Recibo de verificação</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Entregue ao entrevistado. Não contém respostas nem dados pessoais.
        </p>
        <div className="bg-white rounded-2xl p-4 inline-block">
          <QRCodeSVG value={url} size={148} level="M" />
        </div>
        <div className="font-mono text-lg font-bold tracking-wider text-emerald-300 mt-4">{code}</div>
        <div className="flex items-center justify-center gap-1 text-[11px] text-amber-300 mt-2">
          <Clock size={11} /> {synced ? "Selo blockchain em até 1 hora após a sincronização" : "Será enviada quando houver conexão"}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={copiar} className="btn-secondary"><Copy size={14} /> Copiar link</button>
          <button onClick={compartilhar} className="btn-primary"><Share2 size={14} /> Enviar</button>
        </div>
      </div>
      <button onClick={onDone} className="btn-secondary w-full mt-4"><Home size={15} /> Concluir</button>
    </div>
  );
}
