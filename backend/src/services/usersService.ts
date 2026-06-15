// Helpers de usuários compartilhados (rota /users e accept de convite).
import { sql } from "drizzle-orm";
import type { Exec } from "../db/exec.js";

/** Próximo código de entrevistador (ENT-0001, ...). */
export async function nextInterviewerCode(exec: Exec): Promise<string> {
  const r = await exec.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE role = 'interviewer'`);
  return `ENT-${String(Number(r.rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}
