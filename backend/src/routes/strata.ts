// Estratos (zonas/municípios) — usado pelo Admin p/ atribuir zona a gerentes.
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.get("/", requireRole("coordinator"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT id, name, region, zone, municipality, target FROM strata ORDER BY region, name`);
    res.json({ strata: r.rows });
  } catch (e) { next(e); }
});

export default router;
