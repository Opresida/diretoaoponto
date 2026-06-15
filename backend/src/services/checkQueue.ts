// Fila de checagem — PROMPT §5 (passo 6) + regra de negócio #6.
// Flags = prioridade (sempre entra). Sem flags: sorteio garantindo mínimo de
// 20% das entrevistas de cada entrevistador na fila de checagem.
import { sql } from "drizzle-orm";
import type { Exec } from "../db/exec.js";

const MIN_RATE = 0.2;

/**
 * Decide se a entrevista atual (ainda não inserida) deve entrar na checagem,
 * mantendo a taxa do entrevistador >= 20%. `hasFlags` força a entrada.
 */
export async function shouldEnqueueCheck(
  tx: Exec,
  interviewerId: string,
  hasFlags: boolean,
): Promise<boolean> {
  if (hasFlags) return true;
  const r = await tx.execute(
    sql`SELECT COUNT(*)::int AS total, COUNT(c.id)::int AS checked
        FROM interviews i
        LEFT JOIN checks c ON c.interview_id = i.id
        WHERE i.interviewer_id = ${interviewerId}`,
  );
  const total = Number(r.rows[0]?.total ?? 0);
  const checked = Number(r.rows[0]?.checked ?? 0);
  // Considerando a entrevista atual como nova (total + 1).
  return checked / (total + 1) < MIN_RATE;
}

/** Cria a entrada (pendente) na fila de checagem. */
export async function enqueueCheck(tx: Exec, interviewId: string): Promise<void> {
  await tx.execute(
    sql`INSERT INTO checks (interview_id) VALUES (${interviewId})
        ON CONFLICT (interview_id) DO NOTHING`,
  );
}
