import { Plus, RefreshCw, LogOut, Wifi, WifiOff, MapPin, CheckCircle2 } from "lucide-react";

export default function Home({ user, pkg, pending, online, syncing, onStart, onSync, onLogout }) {
  const strata = pkg?.strata ?? [];
  const totalRemaining = strata.reduce(
    (s, st) => s + st.quotas.reduce((a, q) => a + Number(q.remaining), 0),
    0,
  );

  return (
    <div className="min-h-full p-4 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold">{user?.name}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            {online ? <Wifi size={11} className="text-primary-light" /> : <WifiOff size={11} className="text-amber-400" />}
            {online ? "online" : "offline"}
          </div>
        </div>
        <button onClick={onLogout} className="text-slate-400 p-2"><LogOut size={18} /></button>
      </header>

      {pending > 0 && (
        <button onClick={onSync} disabled={!online || syncing}
          className="w-full mb-4 bg-amber-900/20 border border-amber-700 rounded-el p-3 flex items-center justify-between text-sm">
          <span className="text-amber-300">{pending} entrevista(s) pendente(s) de envio</span>
          <span className="flex items-center gap-1 text-amber-200 font-semibold">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Enviando" : "Sincronizar"}
          </span>
        </button>
      )}
      {pending === 0 && (
        <div className="w-full mb-4 bg-emerald-900/10 border border-emerald-800 rounded-el p-3 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 size={15} /> Tudo sincronizado
        </div>
      )}

      <div className="card p-4 mb-4">
        <div className="text-xs text-slate-400 mb-1">{pkg?.project?.name}</div>
        <div className="text-sm font-semibold mb-3">
          {pkg?.assigned ? "Estrato designado de hoje" : "Estratos disponíveis"}
        </div>
        <div className="space-y-2 max-h-60 overflow-auto">
          {strata.map((st) => {
            const rem = st.quotas.reduce((a, q) => a + Number(q.remaining), 0);
            return (
              <div key={st.id} className="bg-surface-2/60 border border-slate-700 rounded-el p-2.5 text-xs">
                <div className="flex items-center gap-1 font-semibold">
                  <MapPin size={11} className="text-primary-light" /> {st.name}
                </div>
                <div className="text-slate-400 mt-0.5">{rem} entrevistas restantes ({st.region})</div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={onStart} disabled={totalRemaining === 0}
        className="btn-primary w-full py-4 text-base">
        <Plus size={18} /> Nova entrevista
      </button>
      <p className="text-center text-[11px] text-slate-500 mt-2">{totalRemaining} cotas em aberto no total</p>
    </div>
  );
}
