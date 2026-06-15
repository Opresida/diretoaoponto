// Apuração — PROMPT §5 (role coordinator+). Uso interno (regra de negócio #7).
import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/rbac.js";
import {
  apuracaoGoverno,
  apuracaoSenado,
  resumo,
  type Recorte,
} from "../services/aggregation.js";
import { getSnapshot } from "../services/cache.js";

const router = Router();
router.use(requireRole("coordinator"));

// Snapshot completo (governo/senado/progress nos 3 recortes) — estado inicial
// do Dashboard, mesmo formato do broadcast do WebSocket (§6).
router.get("/snapshot", async (_req, res, next) => {
  try {
    res.json(await getSnapshot());
  } catch (e) {
    next(e);
  }
});

const RecorteSchema = z.enum(["total", "manaus", "interior"]).default("total");

router.get("/governo", async (req, res, next) => {
  try {
    const recorte = RecorteSchema.parse(req.query.recorte ?? "total") as Recorte;
    const scenario = z.string().default("c1").parse(req.query.scenario ?? "c1");
    res.json({ scenario, recorte, ranking: await apuracaoGoverno(scenario, recorte) });
  } catch (e) {
    next(e);
  }
});

router.get("/senado", async (req, res, next) => {
  try {
    const recorte = RecorteSchema.parse(req.query.recorte ?? "total") as Recorte;
    const base = z.coerce.number().pipe(z.union([z.literal(100), z.literal(200)])).default(100)
      .parse(req.query.base ?? 100) as 100 | 200;
    res.json({ base, recorte, ranking: await apuracaoSenado(base, recorte) });
  } catch (e) {
    next(e);
  }
});

router.get("/resumo", async (_req, res, next) => {
  try {
    res.json(await resumo());
  } catch (e) {
    next(e);
  }
});

export default router;
