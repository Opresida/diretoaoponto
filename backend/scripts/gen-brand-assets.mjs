// Gera os assets de marca do "Direto ao Ponto" a partir da logo oficial (logo-src.png).
// Saídas em backend/assets/ (lockup + white + mark) e nas public/ dos apps (ícones/PWA).
// Uso: node backend/scripts/gen-brand-assets.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, copyFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");           // diretoaoponto/
const ASSETS = join(__dirname, "..", "assets");     // backend/assets/
const SRC = join(ASSETS, "logo-src.png");
const BRAND = "#A81824";

mkdirSync(ASSETS, { recursive: true });

// Recolore todos os pixels opacos para branco, preservando o canal alfa (knockout).
async function toWhite(inputBuf) {
  const img = sharp(inputBuf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = data[i + 3];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  // 1) Lockup full (trim das bordas transparentes)
  const lockup = await sharp(SRC).trim().png().toBuffer();
  await sharp(lockup).toFile(join(ASSETS, "logo-lockup.png"));
  const meta = await sharp(lockup).metadata();
  console.log("lockup:", meta.width, "x", meta.height);

  // 2) Lockup branco (knockout) — p/ faixa carmim do PDF / cabeçalhos escuros
  const lockupWhite = await toWhite(lockup);
  await sharp(lockupWhite).toFile(join(ASSETS, "logo-white.png"));

  // 3) Ícone quadrado: lockup branco (knockout) centralizado sobre fundo carmim
  async function squareIcon(size, pad = 0.16) {
    const innerW = Math.round(size * (1 - pad * 2));
    const innerH = Math.round(size * (1 - pad * 2));
    const sym = await sharp(lockupWhite)
      .resize(innerW, innerH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
      .composite([{ input: sym, gravity: "centre" }])
      .png()
      .toBuffer();
  }

  const icon192 = await squareIcon(192);
  const icon512 = await squareIcon(512);
  const apple = await squareIcon(180, 0.14);
  const favicon = await squareIcon(48, 0.12);

  // 5) Distribui: app de campo (PWA completo) + demais apps (favicon + lockup)
  const APPS = ["frontend", "portal", "admin", "dashboard", "checagem"];
  for (const app of APPS) {
    const pub = join(ROOT, app, "public");
    mkdirSync(pub, { recursive: true });
    await sharp(favicon).toFile(join(pub, "favicon.png"));
    await sharp(icon192).toFile(join(pub, "icon-192.png"));
    await sharp(icon512).toFile(join(pub, "icon-512.png"));
    await sharp(apple).toFile(join(pub, "apple-touch-icon.png"));
    copyFileSync(join(ASSETS, "logo-lockup.png"), join(pub, "logo-lockup.png"));
    copyFileSync(join(ASSETS, "logo-white.png"), join(pub, "logo-white.png"));
  }
  console.log("assets distribuídos para:", APPS.join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
