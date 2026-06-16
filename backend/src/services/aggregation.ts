// Apuração / agregação — PROMPT §5 (Apuração) + §6 (snapshot do WebSocket).
// Recortes: total | manaus | interior. Senado em base 100% (consolidada,
// soma 100%) e 200% (alcance sobre eleitores, soma ~200%).
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

export type Recorte = "total" | "manaus" | "interior";

export interface RankRow {
  name: string;
  color: string | null;
  votes: number;
  pct: number;
}

function regionParam(recorte: Recorte): "manaus" | "interior" | null {
  return recorte === "total" ? null : recorte;
}

// Filtro geográfico: zona (Manaus) ou município (interior) sobrepõem o recorte.
export interface GeoFilter {
  zone?: string;
  municipality?: string;
}
function geoWhere(recorte: Recorte, geo?: GeoFilter) {
  if (geo?.zone) return sql`s.zone = ${geo.zone}`;
  if (geo?.municipality) return sql`s.municipality = ${geo.municipality}`;
  const region = regionParam(recorte);
  return sql`(${region}::region_t IS NULL OR s.region = ${region}::region_t)`;
}

// ─── Governo ─────────────────────────────────────────────────────────
export async function apuracaoGoverno(scenario: string, recorte: Recorte, geo?: GeoFilter): Promise<RankRow[]> {
  const qcode = `gov_${scenario}`; // c1 → gov_c1 ; spont → gov_spont
  const r = await db.execute(sql`
    SELECT c.name, c.color, COUNT(*)::int AS votes,
           ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN strata s ON s.id = i.stratum_id
    JOIN candidates c ON c.id = a.candidate_id
    WHERE a.question_code = ${qcode}
      AND ${geoWhere(recorte, geo)}
    GROUP BY c.id, c.name, c.color
    ORDER BY votes DESC`);
  return r.rows.map(toRank);
}

// ─── Perguntas EXTRAS (não-voto: scale/single/multi por opção) ───────
// Distribuição por opção. multi (value_text "A, B") é dividido via unnest.
export interface ExtraRow { option: string; count: number; pct: number }
export async function apuracaoExtra(code: string, recorte: Recorte, geo?: GeoFilter): Promise<ExtraRow[]> {
  const r = await db.execute(sql`
    SELECT opt AS option, COUNT(*)::int AS count,
           ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN strata s ON s.id = i.stratum_id
    CROSS JOIN LATERAL unnest(string_to_array(a.value_text, ', ')) AS opt
    WHERE a.question_code = ${code} AND a.value_text IS NOT NULL AND a.value_text <> ''
      AND ${geoWhere(recorte, geo)}
    GROUP BY opt ORDER BY count DESC`);
  return r.rows.map((x) => ({ option: x.option as string, count: Number(x.count), pct: Number(x.pct) }));
}

// ─── Senado (2 votos) ────────────────────────────────────────────────
export async function apuracaoSenado(base: 100 | 200, recorte: Recorte, geo?: GeoFilter): Promise<RankRow[]> {
  const r = await db.execute(sql`
    SELECT c.name, c.color, COUNT(*)::int AS votes
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN strata s ON s.id = i.stratum_id
    JOIN candidates c ON c.id = a.candidate_id
    WHERE a.question_code IN ('sen_v1','sen_v2')
      AND ${geoWhere(recorte, geo)}
    GROUP BY c.id, c.name, c.color
    ORDER BY votes DESC`);

  const rows = r.rows.map((x) => ({
    name: x.name as string,
    color: (x.color as string) ?? null,
    votes: Number(x.votes),
  }));
  const totalVotes = rows.reduce((s, x) => s + x.votes, 0);

  // Eleitores (entrevistas com ao menos 1 voto de senado) p/ base 200%.
  const v = await db.execute(sql`
    SELECT COUNT(DISTINCT i.id)::int AS voters
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN strata s ON s.id = i.stratum_id
    WHERE a.question_code IN ('sen_v1','sen_v2')
      AND ${geoWhere(recorte, geo)}`);
  const voters = Number(v.rows[0]?.voters ?? 0);

  const denom = base === 100 ? totalVotes : voters;
  return rows.map((x) => ({
    ...x,
    pct: denom > 0 ? Math.round((1000 * x.votes) / denom) / 10 : 0,
  }));
}

// ─── Resumo (KPIs) ───────────────────────────────────────────────────
export async function resumo(): Promise<unknown> {
  const proj = await db.execute(sql`SELECT id, name, sample_size FROM projects ORDER BY created_at LIMIT 1`);
  const project = proj.rows[0] ?? null;

  const tot = await db.execute(sql`SELECT COUNT(*)::int AS done FROM interviews WHERE status <> 'rejected'`);
  const porEstrato = await db.execute(sql`
    SELECT s.name, s.region, s.target,
           COUNT(i.id) FILTER (WHERE i.status <> 'rejected')::int AS done
    FROM strata s LEFT JOIN interviews i ON i.stratum_id = s.id
    GROUP BY s.id, s.name, s.region, s.target
    ORDER BY s.region, s.name`);
  const flags = await db.execute(sql`
    SELECT f AS flag, COUNT(*)::int AS count
    FROM interviews i, jsonb_array_elements_text(i.fraud_flags) f
    WHERE i.status <> 'rejected'
    GROUP BY f ORDER BY count DESC`);
  const checagem = await db.execute(sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE result IS NULL)::int AS pending,
           COUNT(*) FILTER (WHERE result = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE result = 'rejected')::int AS rejected
    FROM checks`);

  return {
    project,
    total: Number(tot.rows[0]?.done ?? 0),
    target: project ? Number((project as Record<string, unknown>).sample_size) : null,
    porEstrato: porEstrato.rows,
    flags: flags.rows,
    checagem: checagem.rows[0] ?? null,
  };
}

// ─── Snapshot p/ broadcast (§6) ──────────────────────────────────────
export async function snapshotForBroadcast(): Promise<unknown> {
  const recortes: Recorte[] = ["total", "manaus", "interior"];
  const [govT, govM, govI] = await Promise.all(recortes.map((r) => apuracaoGoverno("c1", r)));
  const [senT, senM, senI] = await Promise.all(recortes.map((r) => apuracaoSenado(100, r)));
  const progress = await progressSnapshot();
  return {
    governo: { total: govT, manaus: govM, interior: govI },
    senado: { total: senT, manaus: senM, interior: senI },
    progress,
  };
}

export async function progressSnapshot() {
  // Queries separadas: somar target sobre o JOIN com interviews infla o alvo
  // (conta o target 1x por entrevista do estrato).
  const tgt = await db.execute(sql`
    SELECT region, SUM(target)::int AS target FROM strata GROUP BY region`);
  const dn = await db.execute(sql`
    SELECT s.region, COUNT(i.id)::int AS done
    FROM interviews i JOIN strata s ON s.id = i.stratum_id
    WHERE i.status <> 'rejected'
    GROUP BY s.region`);

  const byRegion: Record<string, { done: number; target: number }> = {};
  for (const row of tgt.rows) {
    byRegion[row.region as string] = { done: 0, target: Number(row.target) };
  }
  let done = 0;
  for (const row of dn.rows) {
    const region = row.region as string;
    (byRegion[region] ??= { done: 0, target: 0 }).done = Number(row.done);
    done += Number(row.done);
  }
  const proj = await db.execute(sql`SELECT sample_size FROM projects ORDER BY created_at LIMIT 1`);
  return {
    done,
    target: Number(proj.rows[0]?.sample_size ?? 0),
    manaus: byRegion.manaus ?? { done: 0, target: 0 },
    interior: byRegion.interior ?? { done: 0, target: 0 },
  };
}

// ─── Apuração de UMA zona (estrato) — dashboard do gerente ───────────
export async function scopedApuracao(stratumId: string): Promise<unknown> {
  const gov = await db.execute(sql`
    SELECT c.name, c.color, COUNT(*)::int AS votes,
           ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN candidates c ON c.id = a.candidate_id
    WHERE a.question_code = 'gov_c1' AND i.stratum_id = ${stratumId}
    GROUP BY c.id, c.name, c.color ORDER BY votes DESC`);

  const senRows = await db.execute(sql`
    SELECT c.name, c.color, COUNT(*)::int AS votes
    FROM answers a
    JOIN interviews i ON i.id = a.interview_id AND i.status <> 'rejected'
    JOIN candidates c ON c.id = a.candidate_id
    WHERE a.question_code IN ('sen_v1','sen_v2') AND i.stratum_id = ${stratumId}
    GROUP BY c.id, c.name, c.color ORDER BY votes DESC`);
  const senSum = senRows.rows.reduce((s, r) => s + Number(r.votes), 0);
  const senado = senRows.rows.map((r) => ({
    name: r.name as string, color: (r.color as string) ?? null, votes: Number(r.votes),
    pct: senSum > 0 ? Math.round((1000 * Number(r.votes)) / senSum) / 10 : 0,
  }));

  const st = await db.execute(sql`SELECT id, name, region, zone, municipality, target FROM strata WHERE id = ${stratumId} LIMIT 1`);
  const stratum = st.rows[0] ?? null;
  const dn = await db.execute(sql`SELECT COUNT(*)::int AS done FROM interviews WHERE stratum_id = ${stratumId} AND status <> 'rejected'`);
  const quotas = await db.execute(sql`
    SELECT label, sex, age_min, age_max, completed, target, GREATEST(target - completed, 0) AS remaining
    FROM quotas WHERE stratum_id = ${stratumId} ORDER BY label`);
  const flags = await db.execute(sql`
    SELECT f AS flag, COUNT(*)::int AS count
    FROM interviews i, jsonb_array_elements_text(i.fraud_flags) f
    WHERE i.stratum_id = ${stratumId} AND i.status <> 'rejected'
    GROUP BY f ORDER BY count DESC`);
  // sigilo do voto: o "recentes" NÃO retorna o voto individual (só metadados não-voto).
  const recent = await db.execute(sql`
    SELECT i.id, u.name AS interviewer, q.label AS profile, i.duration_sec, i.fraud_flags, i.synced_at
    FROM interviews i JOIN users u ON u.id = i.interviewer_id JOIN quotas q ON q.id = i.quota_id
    WHERE i.stratum_id = ${stratumId} AND i.status <> 'rejected'
    ORDER BY i.synced_at DESC LIMIT 8`);

  return {
    stratum,
    progress: { done: Number(dn.rows[0]?.done ?? 0), target: stratum ? Number((stratum as Record<string, unknown>).target) : 0 },
    governo: gov.rows.map(toRank),
    senado,
    quotas: quotas.rows,
    flags: flags.rows,
    recent: recent.rows,
  };
}

function toRank(x: Record<string, unknown>): RankRow {
  return {
    name: x.name as string,
    color: (x.color as string) ?? null,
    votes: Number(x.votes),
    pct: Number(x.pct ?? 0),
  };
}
