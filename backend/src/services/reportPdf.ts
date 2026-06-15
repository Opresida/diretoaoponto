// Renderização do PDF do relatório — pdfkit + QR.
// Linguagem visual inspirada nos PDFs do IDASAM (que funcionam bem):
//   • faixa colorida full-width no topo (timbre) + regra de acento
//   • barras de título de seção (fundo tênue + acento lateral + texto da marca)
//   • rodapé com regra + identificação + paginação
//   • bloco de autenticação/integridade: QR + campos + caixa de hash + link
// Adaptado à marca da plataforma (emerald) e ao engine pdfkit (server-side).
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ReportPayload } from "./reportService.js";

const BRAND = "#047857";       // emerald-700 (timbre)
const BRAND_DK = "#065f46";    // emerald-800
const INK = "#0f172a";
const MUTE = "#64748b";
const LINE = "#e2e8f0";
const TINT = "#ecfdf5";        // emerald-50 (fundo de seção/selo)
const WHITE = "#ffffff";
const FLAG_LABEL: Record<string, string> = {
  short_duration: "duração curta", gps_outside: "GPS fora",
  missing_photos: "sem fotos", hash_mismatch: "hash divergente",
};
const STATUS_LABEL: Record<string, string> = {
  synced: "Sincronizada", approved: "Aprovada", pending_check: "Em checagem",
};
const OPCOES = ["Branco/Nulo", "NS/NR"];

interface Rank { name: string; pct: number; votes?: number; color?: string | null }

interface RenderInput {
  payload: ReportPayload;
  contentHash: string;
  verifyUrl: string;
  txHash: string | null;
  chain: string;
  status: string;
}

const fmtDur = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export async function renderReportPdf(input: RenderInput): Promise<Buffer> {
  const { payload, contentHash, verifyUrl, txHash, chain, status } = input;
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: BRAND_DK, light: WHITE },
  });
  const f = payload.ficha;

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const PW = doc.page.width, PH = doc.page.height;
  const L = 48, R = PW - 48, W = R - L;
  const HEADER_H = 76;

  // ─── Faixa timbrada (em toda página) ────────────────────────────────
  const header = () => {
    doc.rect(0, 0, PW, HEADER_H).fill(BRAND);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(18).text(f.instituto, L, 20, { lineBreak: false });
    doc.fillColor("#d1fae5").font("Helvetica").fontSize(8.5)
      .text("Pesquisa de opinião e intenção de voto", L, 44, { lineBreak: false });
    doc.fillColor("#a7f3d0").fontSize(7.5)
      .text("Integridade verificável da coleta ao resultado · ancoragem em blockchain (Base)", L, 56, { lineBreak: false });
    doc.rect(0, HEADER_H, PW, 2).fill(BRAND_DK);
    doc.fillColor(INK);
  };

  const newPage = (): number => { doc.addPage(); header(); return HEADER_H + 28; };

  // Barra de título de seção (estilo IDASAM).
  const section = (title: string, y: number): number => {
    doc.rect(L, y, W, 22).fill(TINT);
    doc.rect(L, y, 4, 22).fill(BRAND);
    doc.fillColor(BRAND_DK).font("Helvetica-Bold").fontSize(10.5).text(title, L + 14, y + 6, { lineBreak: false });
    doc.fillColor(INK);
    return y + 34;
  };

  const field = (label: string, value: string, y: number): number => {
    doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(9).text(label, L, y, { width: W * 0.38, lineBreak: false });
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(value, L + W * 0.38, y, { width: W * 0.62 });
    return Math.max(doc.y, y + 14) + 4;
  };

  // ═══ CAPA ═══════════════════════════════════════════════════════════
  header();
  let y = HEADER_H + 34;
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text("RELATÓRIO DE PESQUISA", L, y);
  y += 18;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(23).text(f.pesquisa, L, y, { width: W * 0.6 });
  let lyCol = doc.y + 6;
  doc.fillColor(MUTE).font("Helvetica").fontSize(11).text(`Intenção de voto · ${f.uf}`, L, lyCol, { width: W * 0.6 });
  lyCol = doc.y + 6;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(`Documento ${payload.code}`, L, lyCol, { width: W * 0.6 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(9.5).text(`Emitido em ${fmtDateTime(payload.generatedAt)}`, L, doc.y + 2, { width: W * 0.6 });

  // QR + selo (coluna direita)
  const qrSize = 150, qrX = R - qrSize, qrY = HEADER_H + 34;
  doc.roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 44, 8).fillAndStroke(WHITE, LINE);
  doc.image(qrPng, qrX, qrY, { width: qrSize });
  doc.fillColor(BRAND_DK).font("Helvetica-Bold").fontSize(8).text("VERIFIQUE A AUTENTICIDADE", qrX - 10, qrY + qrSize + 4, { width: qrSize + 20, align: "center" });
  doc.fillColor(MUTE).font("Helvetica").fontSize(7).text("Aponte a câmera para o QR", qrX - 10, doc.y + 1, { width: qrSize + 20, align: "center" });

  // Principal resultado
  y = Math.max(doc.y, qrY + qrSize + 44) + 16;
  const cands = (payload.governo.total as Rank[]).filter((c) => !OPCOES.includes(c.name));
  const lider = cands[0], vice = cands[1];
  doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(9).text("PRINCIPAL RESULTADO — GOVERNO DO ESTADO", L, y);
  y = doc.y + 4;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(lider ? `${lider.name} — ${lider.pct.toFixed(1)}%` : "Sem dados suficientes", L, y);
  y = doc.y + 2;
  if (lider && vice) {
    doc.fillColor(MUTE).font("Helvetica").fontSize(10)
      .text(`Vantagem de ${(lider.pct - vice.pct).toFixed(1)} p.p. sobre ${vice.name} (${vice.pct.toFixed(1)}%)`, L, y);
    y = doc.y;
  }
  doc.fillColor(MUTE).font("Helvetica").fontSize(9)
    .text(`Amostra coletada: ${f.amostraColetada} entrevistas · margem de erro ±${f.margemErro} p.p. (${f.nivelConfianca})`, L, doc.y + 4);

  // Bloco de integridade (estilo certificado IDASAM)
  y = doc.y + 18;
  const ok = status === "anchored";
  const boxH = txHash ? 108 : 84;
  doc.roundedRect(L, y, W, boxH, 8).fillAndStroke(ok ? TINT : "#f8fafc", ok ? "#a7f3d0" : LINE);
  doc.fillColor(ok ? BRAND_DK : MUTE).font("Helvetica-Bold").fontSize(11)
    .text(ok ? "DOCUMENTO ANCORADO NA BLOCKCHAIN (BASE)" : "SELO LOCAL — ancoragem on-chain pendente", L + 14, y + 12, { lineBreak: false });
  let by = y + 32;
  doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(8).text("Hash SHA-256 do conteúdo", L + 14, by);
  doc.fillColor(INK).font("Helvetica").fontSize(8).text(contentHash, L + 14, by + 11, { width: W - 28 });
  by += 28;
  if (txHash) {
    doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(8).text("Transação on-chain", L + 14, by);
    doc.fillColor(INK).font("Helvetica").fontSize(8).text(`${txHash}  ·  ${chain}`, L + 14, by + 11, { width: W - 28 });
    by += 26;
  }
  doc.fillColor(MUTE).font("Helvetica").fontSize(8).text(`Confira em ${verifyUrl}`, L + 14, y + boxH - 14, { width: W - 28, lineBreak: false });

  // ═══ FICHA TÉCNICA + RESULTADOS ═════════════════════════════════════
  y = newPage();
  y = section("Ficha técnica", y);
  y = field("Instituto responsável", f.instituto, y);
  y = field("Pesquisa", f.pesquisa, y);
  y = field("Unidade federativa", f.uf, y);
  y = field("Período de coleta", `${fmtDate(f.periodoInicio)} a ${fmtDate(f.periodoFim)}`, y);
  y = field("Amostra coletada", `${f.amostraColetada} de ${f.amostraPlanejada} planejadas`, y);
  y = field("Manaus · Interior", `${f.manaus.done}/${f.manaus.target}  ·  ${f.interior.done}/${f.interior.target}`, y);
  y = field("Áreas em campo", String(f.areasEmCampo), y);
  y = field("Margem de erro", `±${f.margemErro} pontos percentuais`, y);
  y = field("Nível de confiança", f.nivelConfianca, y);
  y = field("Ocorrências antifraude (flags)", String(f.flagsTotal), y);
  y = field("Código de verificação", payload.code, y);

  // Barras de resultado
  const bars = (title: string, rows: Rank[], scale: number, yy: number): number => {
    if (yy > PH - 150) yy = newPage();
    yy = section(title, yy);
    const max = Math.max(1, ...rows.map((r) => r.pct));
    for (const r of rows) {
      if (yy > PH - 60) yy = newPage();
      const isOpt = OPCOES.includes(r.name);
      doc.fillColor(isOpt ? MUTE : INK).font("Helvetica").fontSize(9.5).text(r.name, L, yy, { width: W * 0.6, lineBreak: false });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(`${r.pct.toFixed(1)}%`, R - 50, yy, { width: 50, align: "right", lineBreak: false });
      const barY = yy + 13, fillW = Math.max(2, (r.pct / max) * W * scale);
      doc.roundedRect(L, barY, W, 7, 3).fill("#f1f5f9");
      doc.roundedRect(L, barY, Math.min(fillW, W), 7, 3).fill(isOpt ? "#cbd5e1" : (r.color || BRAND));
      yy = barY + 16;
    }
    return yy + 6;
  };

  y = bars("Governo do Estado — total", payload.governo.total as Rank[], 1, y);
  y = bars("Senado — total (1ª intenção)", payload.senado as Rank[], 2, y);

  // ═══ ANEXO: LISTA COMPLETA ══════════════════════════════════════════
  y = newPage();
  y = section(`Anexo · Lista completa de entrevistas (${payload.entrevistas.length})`, y);
  doc.fillColor(MUTE).font("Helvetica").fontSize(8.5)
    .text("Metadados auditáveis de cada coleta. O voto é sigiloso e não é exibido individualmente.", L, y, { width: W });
  y = doc.y + 10;

  const cols = [
    { x: L, w: 92, label: "Recibo" },
    { x: L + 92, w: 56, label: "Região" },
    { x: L + 148, w: 92, label: "Área" },
    { x: L + 240, w: 104, label: "Perfil" },
    { x: L + 344, w: 40, label: "Dur." },
    { x: L + 384, w: R - (L + 384), label: "Situação" },
  ];
  const headRow = (yy: number): number => {
    doc.fillColor(BRAND_DK).font("Helvetica-Bold").fontSize(8);
    for (const c of cols) doc.text(c.label, c.x, yy, { width: c.w, lineBreak: false });
    yy += 12;
    doc.moveTo(L, yy).lineTo(R, yy).strokeColor(BRAND).lineWidth(0.8).stroke();
    return yy + 5;
  };
  y = headRow(y);

  let i = 0;
  for (const e of payload.entrevistas) {
    if (y > PH - 56) { y = newPage(); y = headRow(y); }
    if (i % 2 === 1) doc.rect(L, y - 2, W, 14).fill("#f8fafc");
    const sit = e.flags.length ? e.flags.map((x) => FLAG_LABEL[x] ?? x).join(", ") : (STATUS_LABEL[e.status] ?? e.status);
    doc.font("Helvetica").fontSize(8);
    doc.fillColor(INK).text(e.recibo ?? "—", cols[0]!.x, y, { width: cols[0]!.w, lineBreak: false });
    doc.text(e.regiao === "manaus" ? "Manaus" : "Interior", cols[1]!.x, y, { width: cols[1]!.w, lineBreak: false });
    doc.text(e.area, cols[2]!.x, y, { width: cols[2]!.w, lineBreak: false });
    doc.text(e.perfil, cols[3]!.x, y, { width: cols[3]!.w, lineBreak: false });
    doc.text(fmtDur(e.duracaoSec), cols[4]!.x, y, { width: cols[4]!.w, lineBreak: false });
    doc.fillColor(e.flags.length ? "#b45309" : MUTE).text(sit, cols[5]!.x, y, { width: cols[5]!.w, lineBreak: false });
    y += 14;
    i++;
  }

  // ─── Rodapé em todas as páginas ─────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(range.start + p);
    const fy = PH - 32;
    doc.moveTo(L, fy).lineTo(R, fy).strokeColor(LINE).lineWidth(1).stroke();
    doc.fillColor(MUTE).font("Helvetica").fontSize(7.5)
      .text(`${payload.code} · documento selado · ${f.instituto}`, L, fy + 7, { width: W * 0.75, lineBreak: false });
    doc.text(`Página ${p + 1} de ${range.count}`, R - 120, fy + 7, { width: 120, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
