// Relatório de Segurança em papel timbrado MAZARI Corp (dark + neon lime) + selo de segurança.
// Conteúdo: pentest SAST + re-teste adversarial da plataforma "Direto ao Ponto".
// Uso: node backend/scripts/gen-security-report.mjs <saida.pdf>
import PDFDocument from "pdfkit";
import { writeFileSync } from "node:fs";

// ── Marca MAZARI (tema dark padrão; --light = versão clara p/ impressão) ──
// Neon lime não sobrevive em papel branco → no claro usamos o verde-oliva da marca.
const THEMES = {
  dark:  { BG: "#080908", PANEL: "#111311", LIME: "#D2FF28", INK: "#F4F6F1", MUTE: "#9AA08F", LINE: "#262a22", OK: "#34d27b", WARN: "#FFC857" },
  light: { BG: "#FFFFFF", PANEL: "#F5F7EF", LIME: "#4F6B0A", INK: "#14160F", MUTE: "#5B6150", LINE: "#E3E7D6", OK: "#2E7D32", WARN: "#B7791F" },
};
const IS_LIGHT = process.argv.includes("--light");
const { BG, PANEL, LIME, INK, MUTE, LINE, OK, WARN } = IS_LIGHT ? THEMES.light : THEMES.dark;

// ── Dados do engajamento ──────────────────────────────────────────────
const R = {
  projeto: "Direto ao Ponto",
  subtitulo: "Plataforma de pesquisa eleitoral (intenção de voto)",
  tipo: "Pentest caixa-branca (SAST) + Re-teste adversarial",
  escopo: "Backend Node 20 · TypeScript · Express · Drizzle/Neon · WebSocket · R2 · JWT · ethers (Base) + 5 apps Vite/React",
  emissor: "MAZARI Cybersecurity",
  datas: "Auditoria 15/06/2026 · Correções + re-teste 16/06/2026",
  codigo: "MZR-SEC-2026-0001",
  resumoInicial: { critico: 1, alto: 7, medio: 8, baixo: 5, deps: 9 },
  corrigidos: [
    ["PT-001", "Sigilo do voto — voto individual exposto em canais ao vivo (WS + apuração)", "CRÍTICO", "Corrigido e verificado"],
    ["Hardening", "Sem helmet/CORS/rate-limit; JWT sem algoritmo fixo; sem validação de env no boot", "ALTO", "Corrigido e verificado"],
    ["PT-004", "Chave de mídia controlada pelo cliente (referência de objeto no bucket)", "ALTO", "Corrigido e verificado"],
    ["PT-007", "SSRF / open-redirect na foto pública de candidato", "ALTO", "Corrigido e verificado"],
    ["PT-008 (ws)", "CVE da biblioteca ws (divulgação de memória / DoS)", "ALTO", "Corrigido e verificado"],
    ["F-1", "trust proxy permitiria forjar IP e furar o rate-limit (achado no re-teste)", "MÉDIO", "Corrigido e verificado"],
  ],
  abertos: [
    ["PT-002", "Rotação de segredos + secret manager", "Pré-produção — operacional", "Nunca vazou publicamente; baixo risco hoje"],
    ["PT-008 (drizzle)", "Upgrade real do drizzle-orm (puxa driver Neon major)", "Agendado", "Não-explorável no uso atual (SQL 100% parametrizado)"],
    ["Fase 2", "senha-semente 'senha123' e supressão de célula mínima nos agregados", "Pré-produção", "Tratar antes de coletar dado real"],
  ],
  controlesOk: [
    "RBAC com isolamento por equipe (teamScope) — gerente não acessa outra equipe",
    "SQL 100% parametrizado (Drizzle) — sem injeção",
    "Mídia privada por presigned URL (TTL 10 min)",
    "Portal /verify não expõe voto, respostas nem PII",
    "Integridade verificável: hash SHA-256 + ancoragem Merkle na Base",
    "Sem backdoor/bypass de autenticação; error handler sem stack trace",
  ],
  auditProd: "1 aviso (drizzle-orm) — documentado como NÃO-EXPLORÁVEL no uso atual (VEX)",
  metodologia: "Análise estática caixa-branca de todo o código-fonte + simulação de cadeias de ataque. Re-teste adversarial independente tentou CONTORNAR cada correção (não apenas conferir). Não-destrutivo; nenhum dado real exfiltrado.",
};

const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
const done = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));

const PW = doc.page.width, PH = doc.page.height;
const L = 54, Rr = PW - 54, W = Rr - L;
const HEAD_H = 70;

function bgPage() {
  doc.rect(0, 0, PW, PH).fill(BG);
}
function header() {
  doc.rect(0, 0, PW, HEAD_H).fill(BG);
  doc.fillColor(LIME).font("Helvetica-Bold").fontSize(22).text("MAZARI.", L, 22, { lineBreak: false, characterSpacing: 1 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(7.5).text("CYBERSECURITY", L + 104, 31, { lineBreak: false, characterSpacing: 3 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(7.5)
    .text("RELATÓRIO CONFIDENCIAL", Rr - 160, 31, { width: 160, align: "right", lineBreak: false, characterSpacing: 1.5 });
  doc.rect(L, HEAD_H - 6, W, 1.5).fill(LIME);
  doc.fillColor(INK);
}
function newPage() { doc.addPage(); bgPage(); header(); return HEAD_H + 22; }

function section(title, y) {
  doc.rect(L, y, 4, 15).fill(LIME);
  doc.fillColor(LIME).font("Helvetica-Bold").fontSize(11).text(title.toUpperCase(), L + 12, y + 1, { lineBreak: false, characterSpacing: 0.5 });
  doc.fillColor(INK);
  return y + 26;
}

// ── Selo de segurança (carimbo) ───────────────────────────────────────
function drawSeal(cx, cy, r) {
  doc.save();
  doc.lineWidth(2.5).strokeColor(LIME).circle(cx, cy, r).stroke();
  doc.lineWidth(0.8).strokeColor(LIME).opacity(0.55).circle(cx, cy, r - 7).stroke();
  doc.opacity(1);
  // checkmark
  doc.lineWidth(4).strokeColor(LIME)
    .moveTo(cx - 16, cy - 2).lineTo(cx - 5, cy + 10).lineTo(cx + 18, cy - 16).stroke();
  doc.fillColor(LIME).font("Helvetica-Bold").fontSize(8.5)
    .text("SEGURANÇA", cx - r, cy - r + 12, { width: 2 * r, align: "center", lineBreak: false, characterSpacing: 1 });
  doc.fillColor(LIME).font("Helvetica-Bold").fontSize(9.5)
    .text("VERIFICADA", cx - r, cy + 20, { width: 2 * r, align: "center", lineBreak: false, characterSpacing: 1 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(5.6)
    .text("MAZARI CYBERSECURITY", cx - r, cy + 33, { width: 2 * r, align: "center", lineBreak: false, characterSpacing: 1 });
  doc.restore();
}

// ═══ CAPA ═════════════════════════════════════════════════════════════
bgPage();
header();
let y = HEAD_H + 40;
doc.fillColor(LIME).font("Helvetica-Bold").fontSize(9).text("RELATÓRIO DE SEGURANÇA", L, y, { characterSpacing: 2 });
y += 22;
doc.fillColor(INK).font("Helvetica-Bold").fontSize(30).text(R.projeto, L, y, { width: W * 0.62 });
y = doc.y + 4;
doc.fillColor(MUTE).font("Helvetica").fontSize(11).text(R.subtitulo, L, y, { width: W * 0.62 });
y = doc.y + 16;
doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(R.tipo, L, y, { width: W * 0.62 });
doc.fillColor(MUTE).font("Helvetica").fontSize(9).text(R.datas, L, doc.y + 3, { width: W * 0.62 });
doc.fillColor(MUTE).fontSize(9).text(`Documento ${R.codigo}`, L, doc.y + 3, { width: W * 0.62 });

// selo no canto superior direito da capa
drawSeal(Rr - 78, HEAD_H + 96, 60);

// veredito (caixa destaque)
y = Math.max(doc.y, HEAD_H + 170) + 18;
doc.roundedRect(L, y, W, 80, 10).fill(PANEL);
doc.roundedRect(L, y, 4, 80, 2).fill(LIME);
doc.fillColor(LIME).font("Helvetica-Bold").fontSize(10).text("VEREDITO", L + 16, y + 12, { characterSpacing: 1 });
doc.fillColor(INK).font("Helvetica-Bold").fontSize(13)
  .text("Itens corrigidos confirmados por re-auditoria adversarial.", L + 16, y + 28, { width: W - 32 });
doc.fillColor(MUTE).font("Helvetica").fontSize(9)
  .text("As 6 correções desta rodada foram re-testadas tentando-se contorná-las — todas resistiram. Risco de produção em dependências caiu de 9 para 1 (documentado).", L + 16, doc.y + 4, { width: W - 32 });

// bloco de emissão (sem hash — a autenticação SHA-256 é gerada pelo autenticador MAZARI)
y += 96;
doc.roundedRect(L, y, W, 58, 10).fillAndStroke(BG, LINE);
doc.fillColor(LIME).font("Helvetica-Bold").fontSize(8.5).text("EMISSÃO", L + 16, y + 12, { characterSpacing: 1 });
doc.fillColor(INK).font("Helvetica").fontSize(9.5)
  .text("Nayara Dayane · Diretora Geral · MAZARI Corp — Manaus/AM", L + 16, y + 26, { lineBreak: false });
doc.fillColor(MUTE).font("Helvetica").fontSize(7.5)
  .text(`Documento ${R.codigo} · autenticação SHA-256 e validação em mazaricorp.com/validar`, L + 16, y + 42, { lineBreak: false });

// ═══ PÁGINA 2 — sumário + corrigidos ══════════════════════════════════
y = newPage();
y = section("Sumário executivo", y);
doc.fillColor(INK).font("Helvetica").fontSize(9.5)
  .text(`A auditoria inicial (15/06) identificou ${R.resumoInicial.critico} crítico, ${R.resumoInicial.alto} altos, ${R.resumoInicial.medio} médios e ${R.resumoInicial.baixo} baixos, além de ${R.resumoInicial.deps} avisos de dependências. Em 16/06 corrigimos o pacote prioritário e submetemos cada correção a um re-teste adversarial independente.`, L, y, { width: W });
y = doc.y + 14;
y = section("Correções desta rodada (re-verificadas)", y);
const c1 = L, c2 = L + 70, c3 = L + 330, c4 = Rr - 96;
doc.fillColor(MUTE).font("Helvetica-Bold").fontSize(7.5);
doc.text("ID", c1, y, { lineBreak: false }); doc.text("ACHADO", c2, y, { lineBreak: false });
doc.text("SEV.", c3, y, { lineBreak: false }); doc.text("STATUS", c4, y, { width: 96, lineBreak: false });
y += 11; doc.moveTo(L, y).lineTo(Rr, y).strokeColor(LINE).lineWidth(1).stroke(); y += 6;
for (const [id, ach, sev, st] of R.corrigidos) {
  const h = Math.max(22, doc.heightOfString(ach, { width: c3 - c2 - 8, fontSize: 8.5 }) + 8);
  doc.fillColor(LIME).font("Helvetica-Bold").fontSize(8.5).text(id, c1, y, { width: c2 - c1 - 4 });
  doc.fillColor(INK).font("Helvetica").fontSize(8.5).text(ach, c2, y, { width: c3 - c2 - 8 });
  doc.fillColor(MUTE).fontSize(8).text(sev, c3, y, { width: c4 - c3 - 4, lineBreak: false });
  doc.fillColor(OK).font("Helvetica-Bold").fontSize(7.8).text("✓ " + st, c4, y, { width: 96 });
  y += h; doc.moveTo(L, y - 4).lineTo(Rr, y - 4).strokeColor(LINE).opacity(0.5).lineWidth(0.5).stroke(); doc.opacity(1);
}
y += 8;
y = section("Auditoria de dependências (produção)", y);
doc.fillColor(INK).font("Helvetica").fontSize(9).text(R.auditProd, L, y, { width: W });

// ═══ PÁGINA 3 — em aberto + controles + metodologia ═══════════════════
y = newPage();
y = section("Itens em aberto (checklist pré-produção)", y);
doc.fillColor(MUTE).font("Helvetica").fontSize(8.5).text("Nenhum é buraco aberto hoje — são portões a fechar antes de operar com dado real de eleitor.", L, y, { width: W });
y = doc.y + 8;
for (const [id, ach, cls, nota] of R.abertos) {
  doc.fillColor(WARN).font("Helvetica-Bold").fontSize(8.5).text("• " + id, L, y, { width: 80, lineBreak: false });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5).text(ach, L + 84, y, { width: W - 84 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(8).text(`${cls} — ${nota}`, L + 84, doc.y + 1, { width: W - 84 });
  y = doc.y + 8;
}
y += 6;
y = section("Controles verificados (OK)", y);
for (const ctl of R.controlesOk) {
  doc.fillColor(OK).font("Helvetica-Bold").fontSize(9).text("✓", L, y, { width: 14, lineBreak: false });
  doc.fillColor(INK).font("Helvetica").fontSize(9).text(ctl, L + 16, y, { width: W - 16 });
  y = doc.y + 5;
}
y += 8;
y = section("Metodologia", y);
doc.fillColor(MUTE).font("Helvetica").fontSize(8.5).text(R.metodologia, L, y, { width: W });
y = doc.y + 10;
doc.fillColor(INK).font("Helvetica").fontSize(8.5).text("Escopo: ", L, y, { continued: true, lineBreak: false })
  .fillColor(MUTE).text(R.escopo, { width: W });
doc.fillColor(MUTE).font("Helvetica-Oblique").fontSize(8).text(
  "Aviso: integridade verificável NÃO significa pesquisa infalível. A blockchain sela os dados contra adulteração; a veracidade vem do antifraude (GPS, áudio, fotos, checagem). Este relatório atesta as correções de segurança verificadas, não a ausência total de risco.",
  L, doc.y + 14, { width: W });

// ── Rodapé em todas as páginas ────────────────────────────────────────
const range = doc.bufferedPageRange();
for (let p = 0; p < range.count; p++) {
  doc.switchToPage(range.start + p);
  doc.page.margins.bottom = 0; // evita o pdfkit auto-criar página ao escrever no rodapé
  const fy = PH - 36;
  doc.rect(L, fy, W, 1).fill(LINE);
  doc.fillColor(MUTE).font("Helvetica").fontSize(7)
    .text(`MAZARI Corp · Cybersecurity · ${R.codigo} · CONFIDENCIAL`, L, fy + 7, { width: W * 0.75, lineBreak: false });
  doc.text(`Página ${p + 1} de ${range.count}`, Rr - 120, fy + 7, { width: 120, align: "right", lineBreak: false });
}

doc.end();
const buf = await done;
const out = process.argv.find((a) => a.endsWith(".pdf")) || "relatorio-seguranca-mazari.pdf";
writeFileSync(out, buf);
console.log("PDF:", out, IS_LIGHT ? "(claro)" : "(dark)");
