// Campo — PROMPT §5 (role interviewer). GET /api/field/package.
import { Router } from "express";
import { requireAnyRole } from "../middleware/rbac.js";

const router = Router();

router.get("/package", requireAnyRole("interviewer"), async (_req, res) => {
  // TODO §5: pacote do dia — estrato designado, cotas restantes, questionário, polígono GPS.
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (/field/package)" });
});

export default router;
