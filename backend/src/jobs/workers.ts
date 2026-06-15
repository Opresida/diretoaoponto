// Workers BullMQ + cron de ancoragem — PROMPT §5 (passo 8) + §13.3.
// Inicia os consumidores das filas e agenda o anchorBatch horário.
// No-op sem Redis (ou com WORKERS=off, p/ poupar quota do Upstash free).
import { Queue, Worker } from "bullmq";
import { getRedis } from "../redis.js";
import { PHOTO_WATERMARK_QUEUE, processPhotoWatermark } from "./photoWatermark.js";
import { AUDIO_TRANSCODE_QUEUE, processAudioTranscode } from "./audioTranscode.js";
import { ANCHOR_BATCH_QUEUE, runAnchorBatch } from "./anchorBatch.js";

export async function startWorkers(): Promise<void> {
  if (process.env.WORKERS === "off") {
    console.log("workers: desativados (WORKERS=off)");
    return;
  }
  const conn = getRedis();
  if (!conn) {
    console.log("workers: Redis ausente — filas em modo no-op");
    return;
  }
  const connection = conn as any; // evita choque de tipos ioredis top-level vs bullmq

  new Worker(PHOTO_WATERMARK_QUEUE, processPhotoWatermark, { connection });
  new Worker(AUDIO_TRANSCODE_QUEUE, processAudioTranscode, { connection });
  new Worker(ANCHOR_BATCH_QUEUE, async () => runAnchorBatch(), { connection });

  // Cron horário de ancoragem (§13.3).
  const anchorQueue = new Queue(ANCHOR_BATCH_QUEUE, { connection });
  await anchorQueue.add(
    "run",
    {},
    { repeat: { pattern: "0 * * * *" }, jobId: "anchor-cron", removeOnComplete: true, removeOnFail: 50 },
  );

  console.log("workers: photo/audio/anchor ativos + cron de ancoragem (0 * * * *)");
}
