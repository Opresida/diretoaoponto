// Apuração — PROMPT §5 (role coordinator+). Uso interno (regra de negócio #7).
import { Router } from "express";
import { requireRole } from "../middleware/rbac.js";

const router = Router();
router.use(requireRole("coordinator"));

router.get("/governo", async (_req, res) => {
  // ?scenario=c1&recorte=total|manaus|interior  → services/aggregation.apuracaoGoverno
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (apuracao/governo)" });
});

router.get("/senado", async (_req, res) => {
  // ?base=100|200&recorte=...  → services/aggregation.apuracaoSenado
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (apuracao/senado)" });
});

router.get("/resumo", async (_req, res) => {
  // KPIs: total, por estrato, flags, checagem → services/aggregation.resumo
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (apuracao/resumo)" });
});

export default router;
