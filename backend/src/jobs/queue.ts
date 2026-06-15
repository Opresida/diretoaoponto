// Enfileiramento BullMQ — PROMPT §5 (passo 8). Degrada graciosamente:
// sem REDIS_URL, vira no-op (permite rodar o backend sem Redis provisionado).
import { Queue } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL;
// `any` evita o choque de tipos entre o ioredis top-level e o que o BullMQ embute.
let connection: any = null;
const queues = new Map<string, Queue>();

function getQueue(name: string): Queue | null {
  if (!url) return null;
  connection ??= new IORedis(url, { maxRetriesPerRequest: null });
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection });
    queues.set(name, q);
  }
  return q;
}

/** Enfileira um job. Retorna false se Redis não está configurado. */
export async function enqueue(queueName: string, jobName: string, data: unknown): Promise<boolean> {
  const q = getQueue(queueName);
  if (!q) return false;
  await q.add(jobName, data);
  return true;
}
