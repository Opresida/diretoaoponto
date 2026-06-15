// Relatórios selados — gerar sob demanda, baixar PDF, copiar link de verificação.
import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Download, Link2, ExternalLink, Loader2, Plus, RefreshCw, Check } from "lucide-react";
import { api } from "../lib/api.js";

const dt = (s) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const explorer = (chain, tx) =>
  tx ? `${chain === "base-sepolia" ? "https://sepolia.basescan.org" : "https://basescan.org"}/tx/${tx}` : null;

export default function Relatorios() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  const load = async () => {
    setLoading(true);
    try { setList((await api.listReports()).reports ?? []); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const gerar = async () => {
    setGen(true); setErr("");
    try { await api.generateReport(); await load(); }
    catch { setErr("Falha ao gerar o relatório. Tente novamente."); }
    finally { setGen(false); }
  };

  const copiar = async (code) => {
    try { await navigator.clipboard.writeText(api.reportVerifyUrl(code)); setCopied(code); setTimeout(() => setCopied(""), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2"><FileText size={16} className="text-emerald-400" /> Relatórios selados</div>
          <p className="text-xs text-slate-400 mt-1">Cada relatório congela os números, sela o hash na blockchain (Base) e gera o PDF timbrado com QR de verificação.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} className="btn-secondary px-2.5 py-2"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          <button onClick={gerar} disabled={gen} className="btn-primary px-3 py-2 disabled:opacity-60">
            {gen ? <><Loader2 size={15} className="animate-spin" /> Gerando e selando…</> : <><Plus size={15} /> Gerar relatório</>}
          </button>
        </div>
      </div>

      {err && <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-700 rounded-lg p-2">{err}</div>}
      {gen && <div className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700 rounded-lg p-2 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Ancorando na Base… isso leva alguns segundos.</div>}

      <div className="card p-4">
        <div className="text-sm font-semibold mb-3">Histórico <span className="text-slate-500 font-normal">({list.length})</span></div>
        {loading && <div className="text-xs text-slate-500">Carregando…</div>}
        {!loading && list.length === 0 && <div className="text-xs text-slate-500">Nenhum relatório gerado ainda. Clique em "Gerar relatório".</div>}
        <div className="space-y-2">
          {list.map((r) => {
            const ok = r.status === "anchored";
            const url = explorer(r.chain, r.tx_hash);
            return (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="font-mono">{r.code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ok ? "text-emerald-300 border-emerald-700 bg-emerald-900/20" : "text-amber-300 border-amber-700 bg-amber-900/20"}`}>
                        {ok ? "Ancorado na Base" : "Selo local"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{dt(r.generated_at)} · {r.amostra ?? 0} entrevistas{r.block_number ? ` · bloco #${r.block_number}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {url && <a href={url} target="_blank" rel="noreferrer" className="btn-secondary px-2 py-1.5 text-xs" title="Ver na BaseScan"><ExternalLink size={13} /></a>}
                    <button onClick={() => copiar(r.code)} className="btn-secondary px-2 py-1.5 text-xs" title="Copiar link de verificação">
                      {copied === r.code ? <Check size={13} className="text-emerald-400" /> : <Link2 size={13} />}
                    </button>
                    <button onClick={() => api.downloadReportPdf(r.id, r.code)} className="btn-primary px-2.5 py-1.5 text-xs"><Download size={13} /> PDF</button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck size={12} className={ok ? "text-emerald-400" : "text-slate-500"} />
                  <span className="font-mono truncate">{r.content_hash}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
