// Preview do PDF do relatório com dados fictícios (sem ancorar on-chain). Dev helper.
// Uso: npx tsx scripts/preview-report.mjs <saida.pdf>
import { renderReportPdf } from "../src/services/reportPdf.ts";
import { writeFileSync } from "node:fs";

const mk = (name, pct, color = null) => ({ name, pct, votes: Math.round(pct * 12), color });
const payload = {
  code: "REL-2026-DEMO",
  generatedAt: new Date("2026-06-15T18:00:00Z").toISOString(),
  ficha: {
    instituto: "Direto ao Ponto Pesquisas",
    pesquisa: "Pesquisa eleitoral — Governo do Amazonas, Senado e Presidência",
    uf: "AM",
    amostraColetada: 1200, amostraPlanejada: 1200,
    manaus: { done: 720, target: 720 }, interior: { done: 480, target: 480 },
    periodoInicio: "2026-02-27", periodoFim: "2026-03-03",
    margemErro: 3, nivelConfianca: "95%", flagsTotal: 47, areasEmCampo: 14,
  },
  governo: {
    total: [mk("Ana Ribeiro", 38.4), mk("Carlos Tavares", 27.1), mk("Mauro Lima", 14.2), mk("Júlia Nunes", 6.3), mk("Branco/Nulo", 8.0), mk("NS/NR", 6.0)],
    manaus: [], interior: [],
  },
  senado: [mk("Pedro Sá", 31.0), mk("Rita Alencar", 22.5), mk("Bruno Dias", 18.0), mk("Branco/Nulo", 16.5), mk("NS/NR", 12.0)],
  entrevistas: Array.from({ length: 64 }, (_, i) => ({
    recibo: `DAP-2026-${String(1000 + i)}`,
    regiao: i % 3 === 0 ? "interior" : "manaus",
    area: i % 3 === 0 ? "Parintins" : `Zona ${(i % 8) + 1}`,
    perfil: `${i % 2 ? "F" : "M"} · ${25 + (i % 40)} anos`,
    duracaoSec: 300 + (i * 7) % 600,
    flags: i % 9 === 0 ? ["short_duration"] : i % 13 === 0 ? ["missing_photos", "gps_outside"] : [],
    status: i % 5 === 0 ? "pending_check" : "synced",
    syncedAt: new Date().toISOString(),
  })),
};

const buf = await renderReportPdf({
  payload,
  contentHash: "9f3a1c2e7b40d8a6f1e5c0b9a8d7e6f5c4b3a2918273645566778899aabbccdd",
  verifyUrl: "http://localhost:5174/r/REL-2026-DEMO",
  txHash: "0x7a3ad5b91c2e4f6a8b0d1e2f3a4b5c6d7e8f9012345678abcdef0123456789ab",
  chain: "base-sepolia",
  status: "anchored",
});
writeFileSync(process.argv[2] || "preview-relatorio.pdf", buf);
console.log("PDF gerado:", process.argv[2]);
