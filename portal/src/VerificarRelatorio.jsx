// Verificação pública de RELATÓRIO selado. Consome GET /api/verify/report/:code.
// Espelha o estilo de Verificar.jsx (entrevista) — mesma linguagem visual.
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock, CheckCircle2, ExternalLink, ChevronDown, FileText } from "lucide-react";

const Check = ({ ok, children }) => (
  <div className={`check-row ${ok ? "check-ok" : "check-pending"}`}>
    {ok ? <CheckCircle2 size={18} /> : <Clock size={18} />}
    <span>{children}</span>
  </div>
);

export default function VerificarRelatorio({ code }) {
  const [r, setR] = useState(null);
  const [tec, setTec] = useState(false);

  useEffect(() => {
    fetch(`/api/verify/report/${code}`)
      .then((x) => x.json())
      .then(setR)
      .catch(() => setR({ status: "error" }));
  }, [code]);

  if (!r) return <div className="page"><div className="card" style={{ padding: 24, color: "#94a3b8" }}>Verificando…</div></div>;

  const dt = (s) => new Date(s).toLocaleString("pt-BR");
  const s = r.summary ?? {};

  return (
    <div className="page">
      <div className="card" style={{ padding: 24, maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {r.status === "integrity_failed"
            ? <ShieldAlert size={40} style={{ color: "#fb7185" }} />
            : <ShieldCheck size={40} style={{ color: "#34d399" }} />}
          <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Relatório de pesquisa</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#34d399" }}>{code}</div>
        </div>

        {(r.status === "not_found" || r.status === "error") && (
          <p style={{ fontSize: 14, color: "#cbd5e1", textAlign: "center" }}>
            Relatório não encontrado. Confira o código.
          </p>
        )}

        {(s.instituto || s.pesquisa) && (
          <div style={{ background: "rgba(15,23,42,0.5)", border: "1px solid #1e293b", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
              <FileText size={15} style={{ color: "#34d399" }} />{s.pesquisa ?? "—"}
            </div>
            {s.instituto && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{s.instituto}</div>}
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8 }}>
              {s.amostra != null && <>Amostra: <strong>{s.amostra}</strong> entrevistas</>}
              {s.margemErro != null && <> · margem ±{s.margemErro} p.p.</>}
            </div>
          </div>
        )}

        {r.status === "pending_anchor" && (
          <>
            <Check ok>Relatório emitido em {dt(r.generatedAt)}</Check>
            <Check ok={false}>Aguardando selo na blockchain (Base)</Check>
            <Check ok={false}>Verificação de integridade disponível após o selo</Check>
          </>
        )}

        {r.status === "sealed_valid" && (
          <>
            <Check ok>Relatório emitido em {dt(r.generatedAt)}</Check>
            <Check ok>Selado na blockchain (Base) em {dt(r.anchoredAt)}</Check>
            <Check ok>Conteúdo íntegro — nenhum número alterado desde a emissão</Check>
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
            A prova de integridade deste relatório <strong>falhou</strong>. Os dados foram alterados
            após a emissão. Não confie neste documento — contate o instituto.
          </div>
        )}

        <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 20 }}>
          Esta página confere a integridade dos números agregados. O voto individual é sigiloso.
        </p>
      </div>
    </div>
  );
}
