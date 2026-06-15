// Job: recálculo/reconciliação de agregados — PROMPT §6 (full-refresh 60s).
// Reconcilia o cache incremental do WebSocket com a query completa.
// TODO: agendar (BullMQ repeatable / setInterval) e regravar snapshot no Redis.
export const RECONCILE_QUEUE = "aggregation:reconcile";
