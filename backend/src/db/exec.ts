// Executor mínimo aceito por serviços — satisfeito tanto pelo `db` quanto por
// uma transação Drizzle (tx). Permite reusar a mesma função dentro/fora de tx.
import type { SQL } from "drizzle-orm";

export interface Exec {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}
