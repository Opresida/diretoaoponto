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
// Leitura da apuração: coordenação/estatística (estatístico = analista de dados).
router.use(requireRole("statistician"));

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
const geoOf = (req: { query: Record<string, unknown> }) => {
  const zone = req.query.zone ? String(req.query.zone) : undefined;
  const municipality = req.query.municipality ? String(req.query.municipality) : undefined;
  return zone || municipality ? { zone, municipality } : undefined;
};

router.get("/governo", async (req, res, next) => {
  try {
    const recorte = RecorteSchema.parse(req.query.recorte ?? "total") as Recorte;
    const scenario = z.string().default("c1").parse(req.query.scenario ?? "c1");
    const geo = geoOf(req);
    res.json({ scenario, recorte, geo, ranking: await apuracaoGoverno(scenario, recorte, geo) });
  } catch (e) {
    next(e);
  }
});

router.get("/senado", async (req, res, next) => {
  try {
    const recorte = RecorteSchema.parse(req.query.recorte ?? "total") as Recorte;
    const base = z.coerce.number().pipe(z.union([z.literal(100), z.literal(200)])).default(100)
      .parse(req.query.base ?? 100) as 100 | 200;
    const geo = geoOf(req);
    res.json({ base, recorte, geo, ranking: await apuracaoSenado(base, recorte, geo) });
  } catch (e) {
    next(e);
  }
});

// GET /api/apuracao/geo — opções do filtro: zonas de Manaus + municípios em pesquisa.
router.get("/geo", async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT zone, municipality, region, id AS stratum_id
      FROM strata WHERE region = 'manaus' OR municipality_id IN (SELECT id FROM municipalities WHERE in_research)
      ORDER BY region, zone, municipality`);
    const manaus = r.rows.filter((x) => x.region === "manaus").map((x) => ({ zone: x.zone, stratumId: x.stratum_id }));
    const interior = r.rows.filter((x) => x.region === "interior").map((x) => ({ municipality: x.municipality, stratumId: x.stratum_id }));
    res.json({ manaus, interior });
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
