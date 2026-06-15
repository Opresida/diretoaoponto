// Job: ancoragem por Merkle root na Base — PROMPT §13.3 (cron a cada hora).
// A lógica vive em services/anchor.ts (reusável por rota admin e por cron).
// Para agendar via BullMQ: registrar um repeatable job (cron "0 * * * *") que
// chama runAnchorBatch(). Sem Redis, dispare manualmente por POST /api/anchor/run.
export { runAnchorBatch } from "../services/anchor.js";
export const ANCHOR_BATCH_QUEUE = "anchor-batch";
