// Supervisão — PROMPT §5 (role supervisor+) + CA #5, #6, #7.
import { Router } from "express";
import { requireRole, teamScope } from "../middleware/rbac.js";

const router = Router();
router.use(requireRole("supervisor"), teamScope);

router.get("/queue", async (_req, res) => {
  // Fila priorizada (flags primeiro; short_duration no topo — CA #5).
  // Escopo por equipe quando manager (§12).
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (/checks/queue)" });
});

router.post("/:id/result", async (_req, res) => {
  // { result, reason? } — reprovação decrementa cota, status=rejected, dispara reposição (CA #6).
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (/checks/:id/result)" });
});

export default router;
