import { useState } from "react";
import { Shield, LogOut, Vote, Users, LayoutDashboard, Radio, MapPin } from "lucide-react";
import { auth } from "./lib/api.js";
import Login from "./components/Login.jsx";
import Candidatos from "./components/Candidatos.jsx";
import Equipes from "./components/Equipes.jsx";
import VisaoGeral from "./components/VisaoGeral.jsx";
import ApuracaoEmbed from "./components/ApuracaoEmbed.jsx";
import Municipios from "./components/Municipios.jsx";

const TABS = [
  ["visao", "Visão geral", LayoutDashboard],
  ["apuracao", "Apuração", Radio],
  ["municipios", "Municípios", MapPin],
  ["candidatos", "Candidatos", Vote],
  ["equipes", "Equipes", Users],
];

export default function App() {
  const [user, setUser] = useState(auth.user?.role === "admin" ? auth.user : null);
  const [tab, setTab] = useState("visao");

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-4 max-w-5xl mx-auto overflow-x-hidden">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-emerald-400" />
          <div>
            <div className="font-bold leading-tight">Painel do Administrador</div>
            <div className="text-[11px] text-slate-400">Direto ao Ponto · {user.name}</div>
          </div>
        </div>
        <button onClick={() => { auth.clear(); setUser(null); }} className="text-slate-400 p-2"><LogOut size={18} /></button>
      </header>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map(([v, l, Icon]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${tab === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {tab === "visao" && <VisaoGeral />}
      {tab === "apuracao" && <ApuracaoEmbed />}
      {tab === "municipios" && <Municipios />}
      {tab === "candidatos" && <Candidatos />}
      {tab === "equipes" && <Equipes />}
    </div>
  );
}
