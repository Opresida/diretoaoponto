// Deck de apresentação (PDF landscape) do "Direto ao Ponto" — produto MAZARI Corp.
// Uso: node backend/scripts/gen-pitch-deck.mjs <saida.pdf>
import PDFDocument from "pdfkit";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");
const DECK = join(ASSETS, "deck");
const img = (n) => join(DECK, n);

// Marca
const BRAND = "#A81824", BRAND_DK = "#7A0C18", INK = "#1F2331", MUTE = "#6B7280";
const BG = "#FAF7F7", PAPER = "#FFFFFF", LINE = "#E7DCDC", OK = "#2E9E4F", TINT = "#FCF0F0";
const MZ_BG = "#080908", LIME = "#D2FF28", MZ_MUTE = "#9AA08F";

// size já é paisagem (842×595). NÃO usar layout:"landscape": com size array o pdfkit troca os eixos e o resultado vira retrato.
const doc = new PDFDocument({ size: [842, 595], margin: 0, bufferPages: true });
const chunks = []; doc.on("data", (c) => chunks.push(c));
const done = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));
const W = 842, H = 595, M = 52;
let first = true;
const logoLockup = img("../logo-lockup.png"), logoWhite = img("../logo-white.png");

function slide(bg = BG) { if (!first) doc.addPage(); first = false; doc.rect(0, 0, W, H).fill(bg); }
function chrome(num) {
  // topo: logo + faixa; rodapé: assinatura + página
  if (existsSync(logoLockup)) doc.image(logoLockup, M, 30, { height: 22 });
  doc.rect(M, H - 42, W - 2 * M, 1).fill(LINE);
  doc.fillColor(MUTE).font("Helvetica").fontSize(7.5).text("Direto ao Ponto · um produto MAZARI Corp · www.mazaricorp.com", M, H - 34, { lineBreak: false });
  doc.fillColor(MUTE).fontSize(7.5).text(`${num}`, W - M - 30, H - 34, { width: 30, align: "right", lineBreak: false });
  doc.fillColor(INK);
}
function kicker(t, x, y) { doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text(t.toUpperCase(), x, y, { characterSpacing: 2, lineBreak: false }); }
function bullets(items, x, y, w) {
  let yy = y;
  for (const it of items) {
    doc.circle(x + 3, yy + 6, 2.5).fill(BRAND);
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(it, x + 14, yy, { width: w - 14 });
    yy = doc.y + 9;
  }
  return yy;
}
// moldura de screenshot (tolerante a ausência)
function shot(path, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(PAPER, LINE);
  if (existsSync(path)) {
    doc.save(); doc.roundedRect(x + 4, y + 4, w - 8, h - 8, 6).clip();
    doc.image(path, x + 4, y + 4, { fit: [w - 8, h - 8], align: "center", valign: "center" });
    doc.restore();
  } else {
    doc.fillColor(MUTE).font("Helvetica-Oblique").fontSize(9).text("[tela]", x, y + h / 2 - 6, { width: w, align: "center" });
  }
}

// ═══ 1. CAPA ═══
slide(BG);
// faixa geométrica leve
doc.save(); doc.opacity(0.06); doc.polygon([W, 0], [W - 260, 0], [W, 260]).fill(BRAND);
doc.polygon([0, H], [240, H], [0, H - 230]).fill(BRAND); doc.opacity(1); doc.restore();
if (existsSync(logoLockup)) doc.image(logoLockup, M, 150, { height: 70 });
doc.fillColor(INK).font("Helvetica-Bold").fontSize(30).text("Pesquisa eleitoral com integridade verificável", M, 250, { width: W - 2 * M });
doc.fillColor(MUTE).font("Helvetica").fontSize(14).text("Da coleta ao resultado — cada etapa selada em blockchain.", M, doc.y + 8, { width: W * 0.8 });
doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(11).text("ELEIÇÕES 2026", M, doc.y + 18, { characterSpacing: 2 });
doc.fillColor(MUTE).font("Helvetica").fontSize(9).text("um produto MAZARI Corp · www.mazaricorp.com", M, H - 48, { lineBreak: false });

// ═══ 2. O QUE É ═══
slide(); chrome(2);
kicker("O que é", M, 90);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(26).text("Pesquisa de intenção de voto, ponta a ponta — e auditável.", M, 110, { width: W - 2 * M });
doc.fillColor(MUTE).font("Helvetica").fontSize(12).text("Uma plataforma completa para institutos de pesquisa: coleta em campo (offline), apuração em tempo real e verificação pública — com cada entrevista protegida por prova criptográfica ancorada na blockchain.", M, doc.y + 10, { width: W - 2 * M, lineGap: 3 });
const pills = [["Coleta offline-first", "App de campo + antifraude (GPS, áudio, foto, cota)"], ["Apuração ao vivo", "Ranking em tempo real, recorte Manaus × Interior"], ["Selo blockchain", "Hash na Base + recibo público verificável"]];
let px = M;
const pw = (W - 2 * M - 2 * 16) / 3;
for (const [t, d] of pills) {
  doc.roundedRect(px, 270, pw, 110, 10).fillAndStroke(PAPER, LINE);
  doc.rect(px, 270, pw, 4).fill(BRAND);
  doc.fillColor(BRAND_DK).font("Helvetica-Bold").fontSize(13).text(t, px + 14, 292, { width: pw - 28 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(9.5).text(d, px + 14, doc.y + 6, { width: pw - 28 });
  px += pw + 16;
}

// ═══ 3. O PROBLEMA ═══
slide(); chrome(3);
kicker("O problema", M, 90);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(26).text("Pesquisa eleitoral tem um problema de confiança.", M, 110, { width: W * 0.92 });
bullets([
  "Dados de campo fabricados — o clássico “pesquisador de boteco” que inventa entrevistas.",
  "Resultados como caixa-preta: ninguém fora do instituto consegue auditar.",
  "Contestação fácil por candidatos e desconfiança da imprensa e do eleitor.",
  "Sem trilha verificável, a credibilidade do instituto fica sempre em xeque.",
], M, 165, W * 0.62);
doc.roundedRect(W - M - 250, 165, 250, 150, 10).fillAndStroke(TINT, LINE);
doc.fillColor(BRAND_DK).font("Helvetica-Bold").fontSize(13).text("Mercado", W - M - 230, 185);
doc.fillColor(INK).font("Helvetica").fontSize(10).text("Centenas de pesquisas eleitorais por ciclo (municipais, estaduais, federais). Quem oferecer prova de integridade auditável sai na frente — no Amazonas e no Brasil.", W - M - 230, doc.y + 6, { width: 210, lineGap: 2 });

// ═══ 4. DIFERENCIAL BLOCKCHAIN ═══
slide(); chrome(4);
kicker("O diferencial · Blockchain (Base)", M, 84);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(23).text("Integridade verificável, da coleta ao resultado.", M, 104, { width: W * 0.5 - 8 });
bullets([
  "Cada entrevista vira um hash SHA-256 no próprio dispositivo.",
  "Os hashes formam uma Merkle root ancorada on-chain na Base.",
  "Gera um recibo público — qualquer um confere que o dado não mudou.",
  "A blockchain SELA; a veracidade vem do antifraude. Comunicação honesta.",
], M, doc.y + 16, W * 0.5);
shot(img("portal-verify.png"), W * 0.54, 95, W * 0.46 - M, H - 150);

// ═══ 5–10. FEATURES (texto + screenshot) ═══
function feature(num, kick, title, items, image, imgLeft = false) {
  slide(); chrome(num);
  const tx = imgLeft ? W * 0.5 + 14 : M;
  const tw = W * 0.5 - M - 14;
  const ix = imgLeft ? M : W * 0.5 + 14;
  kicker(kick, tx, 90);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(title, tx, 110, { width: tw });
  bullets(items, tx, doc.y + 12, tw);
  shot(image, ix, 100, W * 0.5 - M - 14, H - 160);
}
feature(5, "App de Campo", "Coleta offline-first, à prova de fraude.", [
  "Funciona sem internet — sincroniza quando conecta (offline-first).",
  "Antifraude embutido: GPS, áudio, até 3 fotos e duração mínima.",
  "Triagem por cota (sexo × faixa etária) — amostra sempre no alvo.",
  "Recibo com QR entregue ao entrevistado.",
], img("campo-questionario.png"), true);

feature(6, "Apuração ao vivo", "O resultado se formando em tempo real.", [
  "Ranking ao vivo via WebSocket, atualiza a cada entrevista.",
  "Recorte Manaus × Interior (zonas e municípios).",
  "Senado com 2 votos; bases 100% e 200%.",
  "Sigilo do voto preservado — nada liga uma pessoa ao seu voto.",
], img("admin-apuracao.png"));

feature(7, "Checagem & antifraude", "Auditoria humana onde importa.", [
  "Fila priorizada: entrevistas com flag no topo.",
  "Auditoria de no mínimo 20% por entrevistador.",
  "Ouvir o áudio e ver as fotos da coleta.",
  "Aprovar/Reprovar — reprovação devolve a cota (gera reposição).",
], img("admin-checagem.png"), true);

feature(8, "Questionário configurável", "Perguntas sob medida por região.", [
  "Defina perguntas por zona/município, em cascata.",
  "Núcleo de voto protegido — a apuração nunca quebra.",
  "Extras (escala, múltipla, aberta) com agregação automática.",
  "Tudo no painel, sem mexer em código.",
], img("admin-questionario.png"));

feature(9, "Relatório selado", "Um laudo que se prova sozinho.", [
  "PDF em papel timbrado com QR de verificação.",
  "Hash dos números ancorado na blockchain (Base).",
  "Qualquer um confere a autenticidade no portal.",
  "Lista completa de entrevistas (voto sigiloso).",
], img("report-pdf.png"), true);

feature(10, "Portal público & hierarquia", "Confiança aberta + controle interno.", [
  "Portal público: o cidadão confere o recibo da entrevista.",
  "Hierarquia admin → gerente → entrevistador (cada um só vê o seu).",
  "Dashboard do gerente espelha apenas a zona dele.",
  "LGPD: mídia privada, voto sigiloso, acesso por papel.",
], img("gerente-painel.png"));

// ═══ 11. IMPACTO ═══
slide(); chrome(11);
kicker("Impacto de mercado", M, 90);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(26).text("Credibilidade vira vantagem competitiva.", M, 110, { width: W - 2 * M });
const cards = [
  ["Prova pública", "1º instituto a entregar resultado com verificação criptográfica aberta."],
  ["Defesa jurídica", "Trilha auditável contra contestação de campanhas e impugnações."],
  ["Pronto p/ TSE & LGPD", "Registro, sigilo do voto e dados pessoais tratados por papel."],
  ["Escala", "Multi-zona, multi-município e multi-eleição, sem retrabalho."],
];
let cx = M; const cw = (W - 2 * M - 3 * 14) / 4;
for (const [t, d] of cards) {
  doc.roundedRect(cx, 270, cw, 130, 10).fillAndStroke(PAPER, LINE);
  doc.rect(cx, 270, cw, 4).fill(OK);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(t, cx + 12, 292, { width: cw - 24 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(9).text(d, cx + 12, doc.y + 6, { width: cw - 24, lineGap: 2 });
  cx += cw + 14;
}

// ═══ 12. COMO FUNCIONA ═══
slide(); chrome(12);
kicker("Como funciona", M, 90);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(24).text("Quatro passos, um selo no fim.", M, 110, { width: W - 2 * M });
const steps = [["1 · Coleta", "Entrevistador no campo (offline) com antifraude."], ["2 · Sela", "Hash SHA-256 → Merkle root ancorada na Base."], ["3 · Apura", "Resultado ao vivo, com recortes e sigilo do voto."], ["4 · Verifica", "Recibo público + relatório selado conferíveis."]];
let sx = M; const sw = (W - 2 * M - 3 * 24) / 4;
for (let i = 0; i < steps.length; i++) {
  const [t, d] = steps[i];
  doc.roundedRect(sx, 230, sw, 150, 10).fillAndStroke(PAPER, LINE);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(14).text(t, sx + 14, 252, { width: sw - 28 });
  doc.fillColor(MUTE).font("Helvetica").fontSize(10).text(d, sx + 14, doc.y + 8, { width: sw - 28, lineGap: 2 });
  if (i < 3) { doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(20).text("›", sx + sw + 6, 295, { lineBreak: false }); }
  sx += sw + 24;
}

// ═══ 13. FECHAMENTO MAZARI ═══
slide(MZ_BG);
doc.save(); doc.opacity(0.10); doc.polygon([W, H], [W - 300, H], [W, H - 280]).fill(LIME); doc.opacity(1); doc.restore();
if (existsSync(logoWhite)) doc.image(logoWhite, M, 150, { height: 64 });
doc.fillColor("#F4F6F1").font("Helvetica-Bold").fontSize(30).text("Um produto", M, 250, { lineBreak: false });
doc.fillColor(LIME).font("Helvetica-Bold").fontSize(30).text("MAZARI.", M + doc.widthOfString("Um produto") + 14, 250, { lineBreak: false });
doc.fillColor(MZ_MUTE).font("Helvetica").fontSize(13).text("Engenharia digital · Web3 · Security — feito por nós, do conceito ao deploy.", M, 300, { width: W * 0.7 });
doc.fillColor(LIME).font("Helvetica-Bold").fontSize(16).text("www.mazaricorp.com", M, 340);
doc.fillColor(MZ_MUTE).font("Helvetica").fontSize(9).text("Direto ao Ponto · Pesquisa eleitoral com integridade verificável · ELEIÇÕES 2026", M, H - 50, { lineBreak: false });

doc.end();
const buf = await done;
writeFileSync(process.argv[2] || "deck.pdf", buf);
console.log("deck:", process.argv[2], "·", buf.length, "bytes");
