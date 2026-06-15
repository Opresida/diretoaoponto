// Resolução candidateName → candidate_id — PROMPT §5 (passo 5).
// Cria candidato se for espontânea inédita (pós-codificação). Branco/Nulo e
// NS/NR também são candidatos (entram no ranking, filtrados no front).
import { sql } from "drizzle-orm";
import type { Exec } from "../db/exec.js";

export const NON_CANDIDATE = new Set(["Branco/Nulo", "NS/NR"]);

/** Deriva o cargo a partir do prefixo do question_code. */
export function questionToOffice(questionCode: string): string | null {
  if (questionCode.startsWith("gov_") || questionCode === "rejection_gov") return "governor";
  if (questionCode.startsWith("sen_")) return "senator";
  if (questionCode.startsWith("pres_")) return "president";
  return null; // pergunta de escala/avaliação → sem candidato (só value_text)
}

/** Retorna o id do candidato, criando-o se necessário (idempotente). */
export async function resolveCandidateId(
  tx: Exec,
  name: string,
  office: string,
): Promise<string> {
  const color = NON_CANDIDATE.has(name) ? "#64748b" : null; // slate p/ branco/nulo/ns-nr
  const r = await tx.execute(
    sql`INSERT INTO candidates (name, office, color)
        VALUES (${name}, ${office}, ${color})
        ON CONFLICT (name, office) DO UPDATE SET name = EXCLUDED.name
        RETURNING id`,
  );
  return r.rows[0]!.id as string;
}
