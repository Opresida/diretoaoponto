// Apuração / agregação — PROMPT §5 (Apuração) + §6 (cache incremental).
// Recortes: total | manaus | interior. Senado em base 100% e 200% (2 votos).
// Mantém agregado em cache (Redis), recalcula incrementalmente e faz
// full-refresh a cada 60s p/ reconciliar (§6).

export type Recorte = "total" | "manaus" | "interior";

export interface RankRow {
  name: string;
  color: string | null;
  votes: number;
  pct: number;
}

export async function apuracaoGoverno(_scenario: string, _recorte: Recorte): Promise<RankRow[]> {
  // TODO §5: query do recorte (gov_c1 etc.) filtrando s.region quando recorte != total.
  throw new Error("not implemented — PROMPT §5 (Apuração Governo)");
}

export async function apuracaoSenado(_base: 100 | 200, _recorte: Recorte): Promise<RankRow[]> {
  // TODO §5: consolidar sen_v1 + sen_v2; base 100 = consolidada, 200 = alcance.
  throw new Error("not implemented — PROMPT §5 (Apuração Senado)");
}

export async function resumo(): Promise<unknown> {
  // TODO §5: KPIs total, por estrato, flags, checagem.
  throw new Error("not implemented — PROMPT §5 (/api/apuracao/resumo)");
}

export async function snapshotForBroadcast(): Promise<unknown> {
  // TODO §6: monta o objeto `apuracao` (governo/senado/progress nos 3 recortes)
  //          a partir do cache incremental p/ o broadcast do WebSocket.
  throw new Error("not implemented — PROMPT §6");
}
