// Apuração — PROMPT §5 (role coordinator+). Uso interno (regra de negócio #7).
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import {
  apuracaoGoverno,
  apuracaoSenado,
  resumo,
  scopedApuracao,
  type Recorte,
} from "../services/aggregation.js";
import { getSnapshot } from "../services/cache.js";

const router = Router();
router.use(requireRole("coordinator"));

// Apuração de UMA zona — dashboard do gerente (própria zona) ou coordinator+
// com ?stratumId. PROMPT: cada gerente vê exclusivamente a zona dele.
router.get("/scoped", async (req, res, next) => {
  try {
    let stratumId: string | undefined;
    if (req.user!.role === "manager") {
      const u = await db.execute(sql`SELECT stratum_id FROM users WHERE id = ${req.user!.id} LIMIT 1`);
      stratumId = (u.rows[0]?.stratum_id as string) ?? undefined;
      if (!stratumId) { res.json({ stratum: null }); return; }
    } else {
      stratumId = req.query.stratumId as string | undefined;
      if (!stratumId) { res.status(400).json({ error: "stratumId_required" }); return; }
    }
    res.json(await scopedApuracao(stratumId));
  } catch (e) { next(e); }
});

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
