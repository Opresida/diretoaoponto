// Job BullMQ: audio:transcode — PROMPT §5 (passo 8).
// Verifica o áudio bruto no R2. A transcodificação real (p/ formato de
// auditoria) exige o binário ffmpeg no host — fica como passo seguinte; por
// ora confirma a existência/tamanho do objeto (pipeline ponta-a-ponta).
import type { Job } from "bullmq";
import { headObject } from "../services/storage.js";

export const AUDIO_TRANSCODE_QUEUE = "audio-transcode";

interface AudioJob {
  audioKey: string;
}

export async function processAudioTranscode(job: Job<AudioJob>): Promise<void> {
  try {
    const info = await headObject(job.data.audioKey);
    console.log(`[audio-transcode] OK ${job.data.audioKey} (${info.size} bytes, ${info.contentType ?? "?"})`);
    // TODO real: baixar, ffmpeg → opus/aac, regravar key processada.
  } catch {
    console.warn(`[audio-transcode] objeto não encontrado: ${job.data.audioKey}`);
  }
}
