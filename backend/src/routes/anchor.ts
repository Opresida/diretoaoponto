// Operação de ancoragem — PROMPT §13.3. Disparo manual (admin) enquanto o
// cron BullMQ não está ativo (sem Redis). POST /api/anchor/run.
import { Router } from "express";
import { requireRole } from "../middleware/rbac.js";
import { runAnchorBatch } from "../services/anchor.js";

const router = Router();

router.post("/run", requireRole("admin"), async (_req, res, next) => {
  try {
    res.json(await runAnchorBatch());
  } catch (e) {
    next(e);
  }
});

export default router;
