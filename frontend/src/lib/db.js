// Fila offline-first (IndexedDB via idb-keyval). Entrevistas finalizadas ficam
// aqui até sincronizar; o sync sobe fotos (presign+PUT) e faz o POST idempotente.
import { get, set } from "idb-keyval";
import { api } from "./api.js";

const KEY = "dap.pending";

export async function getPending() {
  return (await get(KEY)) ?? [];
}

export async function enqueue(interview) {
  const list = await getPending();
  list.push(interview);
  await set(KEY, list);
}

async function remove(clientUuid) {
  const list = await getPending();
  await set(KEY, list.filter((i) => i.clientUuid !== clientUuid));
}

async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

async function syncOne(it) {
  const photos = [];
  for (const p of it.photos ?? []) {
    const { uploadUrl, storageKey } = await api.presign("photo", it.clientUuid, p.seq);
    await fetch(uploadUrl, { method: "PUT", body: await dataUrlToBlob(p.dataUrl), headers: { "Content-Type": "image/jpeg" } });
    photos.push({ seq: p.seq, storageKey, takenAt: p.takenAt, gps: p.gps });
  }
  const payload = {
    clientUuid: it.clientUuid,
    stratumId: it.stratumId,
    quotaId: it.quotaId,
    respondent: it.respondent,
    consentLgpd: true,
    consentPhoto: it.consentPhoto,
    startedAt: it.startedAt,
    endedAt: it.endedAt,
    gpsStart: it.gpsStart,
    gpsEnd: it.gpsEnd,
    photos,
    answers: it.answers,
  };
  const res = await api.sync([payload]);
  return res.results[0];
}

/** Tenta sincronizar tudo. Retorna {synced, failed}. Remove os que entraram (inserted/duplicate). */
export async function syncPending() {
  const list = await getPending();
  let synced = 0;
  let failed = 0;
  for (const it of list) {
    try {
      const r = await syncOne(it);
      if (r.status === "inserted" || r.status === "duplicate") {
        await remove(it.clientUuid);
        synced++;
      } else {
        failed++; // rejected (cota cheia, etc.) — mantém p/ inspeção
      }
    } catch {
      failed++; // offline ou erro — mantém na fila
    }
  }
  return { synced, failed };
}
