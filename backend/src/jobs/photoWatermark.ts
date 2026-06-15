// Job BullMQ: photo:watermark — PROMPT §5 (passo 8) + §8.
// Re-aplica carimbo autoritativo (timestamp + GPS) server-side e regrava a key
// no R2. O app já carimba client-side (§8); este passo é a versão de auditoria.
import type { Job } from "bullmq";
import sharp from "sharp";
import { getObject, putObject } from "../services/storage.js";

export const PHOTO_WATERMARK_QUEUE = "photo-watermark";

interface PhotoJob {
  photos: Array<{ storageKey: string; takenAt: string; gps?: { lat: number; lng: number } }>;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

export async function processPhotoWatermark(job: Job<PhotoJob>): Promise<void> {
  for (const p of job.data.photos ?? []) {
    const buf = await getObject(p.storageKey);
    const img = sharp(buf);
    const meta = await img.metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 600;
    const fontSize = Math.max(14, Math.round(w * 0.022));
    const gps = p.gps ? `${p.gps.lat.toFixed(5)}, ${p.gps.lng.toFixed(5)}` : "sem GPS";
    const stamp = esc(`${new Date(p.takenAt).toLocaleString("pt-BR")} · ${gps}`);
    const barH = Math.round(fontSize * 1.8);
    const svg = Buffer.from(
      `<svg width="${w}" height="${h}">
        <rect x="0" y="${h - barH}" width="${w}" height="${barH}" fill="rgba(0,0,0,0.55)"/>
        <text x="12" y="${h - Math.round(fontSize * 0.6)}" font-family="monospace" font-size="${fontSize}" fill="#ffffff">${stamp}</text>
      </svg>`,
    );
    const out = await img.composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 80 }).toBuffer();
    await putObject(p.storageKey, out, "image/jpeg");
    console.log(`[photo-watermark] carimbada ${p.storageKey} (${out.length} bytes)`);
  }
}
