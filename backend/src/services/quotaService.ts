// Cotas — PROMPT §5 (passo 4) + CA #6.
// Incrementa completed com WHERE completed < target (rejeita por cota cheia).
// Reprovação de checagem decrementa completed e dispara reposição.

export async function tryIncrementQuota(_quotaId: string): Promise<boolean> {
  // TODO §5.4: UPDATE quotas SET completed = completed + 1
  //            WHERE id = $1 AND completed < target RETURNING id;
  // retorna false se cota cheia.
  throw new Error("not implemented — PROMPT §5.4");
}

export async function decrementQuota(_quotaId: string): Promise<void> {
  // TODO CA #6: usado na reprovação de checagem.
  throw new Error("not implemented — PROMPT CA #6");
}
