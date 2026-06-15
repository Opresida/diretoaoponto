// Cotas — PROMPT §5 (passo 4) + CA #6.
import { sql } from "drizzle-orm";
import type { Exec } from "../db/exec.js";

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
