// Cotas — PROMPT §5 (passo 4) + CA #6.
import { sql } from "drizzle-orm";
import type { Exec } from "../db/exec.js";

// ─── Geração de cotas (compartilhado por seed e rota de municípios) ───
// Faixas etárias padrão: 2 sexos × 4 faixas = 8 cotas por estrato.
export const AGE_BANDS: Array<[number, number, string]> = [
  [16, 24, "16–24"],
  [25, 44, "25–44"],
  [45, 59, "45–59"],
  [60, 120, "60+"],
];

/** Distribui um total inteiro em n partes o mais iguais possível. */
export function splitTarget(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export interface QuotaRow {
  label: string;
  sex: "F" | "M";
  ageMin: number;
  ageMax: number;
  target: number;
}

/** Monta as 8 cotas (sexo × faixa) para um target, via splitTarget. */
export function buildQuotaRows(target: number): QuotaRow[] {
  const per = splitTarget(target, 2 * AGE_BANDS.length);
  const rows: QuotaRow[] = [];
  let k = 0;
  for (const [sex, label] of [["F", "Mulher"], ["M", "Homem"]] as const) {
    for (const [ageMin, ageMax, band] of AGE_BANDS) {
      rows.push({ label: `${label} · ${band}`, sex, ageMin, ageMax, target: per[k++]! });
    }
  }
  return rows;
}

/** Insere/atualiza as cotas de um estrato (não mexe em completed). */
export async function upsertQuotaRows(tx: Exec, stratumId: string, target: number): Promise<void> {
  for (const q of buildQuotaRows(target)) {
    await tx.execute(sql`
      INSERT INTO quotas (stratum_id, label, sex, age_min, age_max, target)
      VALUES (${stratumId}, ${q.label}, ${q.sex}, ${q.ageMin}, ${q.ageMax}, ${q.target})
      ON CONFLICT (stratum_id, label) DO UPDATE SET target = EXCLUDED.target`);
  }
}

/** Incrementa completed com WHERE completed < target. false = cota cheia. */
export async function tryIncrementQuota(tx: Exec, quotaId: string): Promise<boolean> {
  const r = await tx.execute(
    sql`UPDATE quotas SET completed = completed + 1
        WHERE id = ${quotaId} AND completed < target
        RETURNING id`,
  );
  return r.rows.length > 0;
}

/** Decrementa completed (reprovação de checagem) — CA #6. */
export async function decrementQuota(tx: Exec, quotaId: string): Promise<void> {
  await tx.execute(
    sql`UPDATE quotas SET completed = GREATEST(completed - 1, 0) WHERE id = ${quotaId}`,
  );
}
