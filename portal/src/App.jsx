import { useState } from "react";
import { Search } from "lucide-react";
import Verificar from "./Verificar.jsx";
import VerificarRelatorio from "./VerificarRelatorio.jsx";
import Cadastro from "./Cadastro.jsx";

export default function App() {
  const v = window.location.pathname.match(/^\/v\/(.+)$/);
  if (v) return <Verificar code={decodeURIComponent(v[1])} />;
  const rep = window.location.pathname.match(/^\/r\/(.+)$/);
  if (rep) return <VerificarRelatorio code={decodeURIComponent(rep[1])} />;
  const c = window.location.pathname.match(/^\/cadastro\/(.+)$/);
  if (c) return <Cadastro token={decodeURIComponent(c[1])} />;

  return <Home />;
}

function Home() {
  const [code, setCode] = useState("");
  const go = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) window.location.href = `/v/${encodeURIComponent(c)}`;
  };
  return (
    <div className="page">
      <form onSubmit={go} className="card" style={{ padding: 24, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <img src="/logo-lockup.png" alt="Direto ao Ponto" style={{ height: 40, width: "auto", display: "block", margin: "0 auto 8px" }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Verificação de entrevista</h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, marginBottom: 20 }}>
          Digite o código do recibo (ex.: DAP-2026-XXXX-XXXX) para verificar a integridade.
        </p>
        <input className="input" placeholder="DAP-2026-…" value={code}
          onChange={(e) => setCode(e.target.value)} autoFocus />
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }}>
          <Search size={15} /> Verificar
        </button>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 20 }}>
          Esta página não exibe respostas nem dados pessoais. O voto é sigiloso.
        </p>
      </form>
    </div>
  );
}
