// Portal público de verificação — PROMPT §14.4. Consome GET /api/verify/:code.
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock, CheckCircle2, ExternalLink, ChevronDown } from "lucide-react";

const Check = ({ ok, children }) => (
  <div className={`check-row ${ok ? "check-ok" : "check-pending"}`}>
    {ok ? <CheckCircle2 size={18} /> : <Clock size={18} />}
    <span>{children}</span>
  </div>
);

export default function Verificar({ code }) {
  const [r, setR] = useState(null);
  const [tec, setTec] = useState(false);

  useEffect(() => {
    fetch(`/api/verify/${code}`)
      .then((x) => x.json())
      .then(setR)
      .catch(() => setR({ status: "error" }));
  }, [code]);

  if (!r) return <div className="page"><div className="card" style={{ padding: 24, color: "#94a3b8" }}>Verificando…</div></div>;

  const dt = (s) => new Date(s).toLocaleString("pt-BR");

  return (
    <div className="page">
      <div className="card" style={{ padding: 24, maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {r.status === "integrity_failed"
            ? <ShieldAlert size={40} style={{ color: "#fb7185" }} />
            : <ShieldCheck size={40} style={{ color: "#34d399" }} />}
          <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Verificação de entrevista</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#34d399" }}>{code}</div>
        </div>

        {(r.status === "not_found" || r.status === "error") && (
          <p style={{ fontSize: 14, color: "#cbd5e1", textAlign: "center" }}>
            Código não encontrado. Confira a digitação.
          </p>
        )}

        {r.status === "pending_anchor" && (
          <>
            <Check ok>Entrevista registrada em {dt(r.registeredAt)}</Check>
            <Check ok={false}>Aguardando selo blockchain — concluído em até 1 hora</Check>
            <Check ok={false}>Verificação de integridade disponível após o selo</Check>
          </>
        )}

        {r.status === "sealed_valid" && (
          <>
            <Check ok>Entrevista registrada em {dt(r.registeredAt)}</Check>
            <Check ok>Selada na blockchain em {dt(r.anchoredAt)}</Check>
            <Check ok>Conteúdo íntegro — nenhuma alteração desde a coleta</Check>
            {r.explorerUrl && (
              <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="btn-secondary" style={{ width: "100%", marginTop: 16 }}>
                Ver transação na Base <ExternalLink size={13} />
              </a>
            )}
            <button onClick={() => setTec((t) => !t)} className="tec-toggle">
              Modo auditor <ChevronDown size={13} className={tec ? "rotate-180" : ""} />
            </button>
            {tec && <pre className="tec-box">{JSON.stringify(r.technical, null, 2)}</pre>}
          </>
        )}

        {r.status === "integrity_failed" && (
          <div className="alert-fail">
            A prova de integridade desta entrevista <strong>falhou</strong>. O registro foi alterado
            após o selo ou há inconsistência nos dados. O instituto foi notificado automaticamente.
          </div>
        )}

        <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 20 }}>
          Esta página não exibe respostas nem dados pessoais. O voto é sigiloso.
        </p>
      </div>
    </div>
  );
}
