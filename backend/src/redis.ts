// Conexão Redis compartilhada (cache de apuração + BullMQ). Null sem REDIS_URL.
import IORedis from "ioredis";

const url = process.env.REDIS_URL;
let client: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!url) return null;
  if (!client) client = new IORedis(url, { maxRetriesPerRequest: null });
  return client;
}
