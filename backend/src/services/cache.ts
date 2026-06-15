// Cache incremental de apuração — PROMPT §6.
// Mantém o agregado em Redis (HINCRBY por voto) e o /sync lê daqui (rápido),
// sem reconsultar o Neon inteiro a cada evento. `reconcile()` recalcula o
// agregado completo do banco (full-refresh a cada 60s) p/ corrigir qualquer
// deriva. Sem Redis, cai no cálculo direto do banco (snapshotForBroadcast).
import { getRedis } from "../redis.js";
import {
  apuracaoGoverno,
  apuracaoSenado,
  progressSnapshot,
  snapshotForBroadcast,
  type Recorte,
  type RankRow,
} from "./aggregation.js";

const GOV = (r: Recorte) => `dap:agg:gov:${r}`;
const SEN = (r: Recorte) => `dap:agg:sen:${r}`;
const COLORS = "dap:agg:colors";
const PROGRESS = "dap:agg:progress";
const RECORTES: Recorte[] = ["total", "manaus", "interior"];

export interface IncrementInput {
  region: "manaus" | "interior";
  govCandidate: string | null; // candidato do gov_c1
  senate: string[]; // candidatos de sen_v1 + sen_v2
}

/** Incrementa o agregado a cada entrevista inserida (§6). No-op sem Redis. */
export async function incrementForInterview(input: IncrementInput): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const pipe = redis.pipeline();
  if (input.govCandidate) {
    pipe.hincrby(GOV("total"), input.govCandidate, 1);
    pipe.hincrby(GOV(input.region), input.govCandidate, 1);
  }
  for (const name of input.senate) {
    pipe.hincrby(SEN("total"), name, 1);
    pipe.hincrby(SEN(input.region), name, 1);
  }
  pipe.hincrby(PROGRESS, "done", 1);
  pipe.hincrby(PROGRESS, `${input.region}_done`, 1);
  await pipe.exec();
}

function rankFromHash(h: Record<string, string>, colors: Record<string, string>): RankRow[] {
  const rows = Object.entries(h).map(([name, v]) => ({
    name,
    votes: Number(v),
    color: colors[name] ?? null,
    pct: 0,
  }));
  const total = rows.reduce((s, r) => s + r.votes, 0);
  for (const r of rows) r.pct = total > 0 ? Math.round((1000 * r.votes) / total) / 10 : 0;
  rows.sort((a, b) => b.votes - a.votes);
  return rows;
}

/** Snapshot p/ broadcast (§6). Lê o cache num ÚNICO pipeline (1 round-trip);
 *  sem Redis, calcula do banco. */
export async function getSnapshot(): Promise<unknown> {
  const redis = getRedis();
  if (!redis) return snapshotForBroadcast();

  // Ordem: COLORS, GOV[total,manaus,interior], SEN[...], PROGRESS — 8 hgetall, 1 RTT.
  const pipe = redis.pipeline();
  pipe.hgetall(COLORS);
  for (const rc of RECORTES) pipe.hgetall(GOV(rc));
  for (const rc of RECORTES) pipe.hgetall(SEN(rc));
  pipe.hgetall(PROGRESS);
  const res = (await pipe.exec()) ?? [];
  const val = (i: number) => (res[i]?.[1] ?? {}) as Record<string, string>;

  const colors = val(0);
  const governo: Record<string, RankRow[]> = {};
  const senado: Record<string, RankRow[]> = {};
  RECORTES.forEach((rc, i) => {
    governo[rc] = rankFromHash(val(1 + i), colors);
    senado[rc] = rankFromHash(val(4 + i), colors);
  });
  const p = val(7);
  const num = (k: string) => Number(p[k] ?? 0);

  return {
    governo,
    senado,
    progress: {
      done: num("done"),
      target: num("total_target"),
      manaus: { done: num("manaus_done"), target: num("manaus_target") },
      interior: { done: num("interior_done"), target: num("interior_target") },
    },
  };
}

/** Full-refresh: recalcula tudo do banco e sobrescreve o cache (§6). */
export async function reconcile(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const pipe = redis.pipeline();
  const colors: Record<string, string> = {};

  for (const rc of RECORTES) {
    const gov = await apuracaoGoverno("c1", rc);
    pipe.del(GOV(rc));
    if (gov.length) pipe.hset(GOV(rc), Object.fromEntries(gov.map((r) => [r.name, r.votes])));
    for (const r of gov) if (r.color) colors[r.name] = r.color;

    const sen = await apuracaoSenado(100, rc);
    pipe.del(SEN(rc));
    if (sen.length) pipe.hset(SEN(rc), Object.fromEntries(sen.map((r) => [r.name, r.votes])));
    for (const r of sen) if (r.color) colors[r.name] = r.color;
  }
  if (Object.keys(colors).length) pipe.hset(COLORS, colors);

  const prog = await progressSnapshot();
  pipe.del(PROGRESS);
  pipe.hset(PROGRESS, {
    done: prog.done,
    total_target: prog.target,
    manaus_done: prog.manaus.done,
    manaus_target: prog.manaus.target,
    interior_done: prog.interior.done,
    interior_target: prog.interior.target,
  });

  await pipe.exec();
}
