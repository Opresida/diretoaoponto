// Municípios — catálogo dos 62 do AM. Cadastrar (in_research) = vira área de
// pesquisa: cria estrato interior + cotas. PROMPT/F1.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { upsertQuotaRows } from "../services/quotaService.js";

const router = Router();

// GET /api/municipalities — lista com status e progresso (coordinator+).
router.get("/", requireRole("coordinator"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT m.id, m.name, m.region, m.in_research, m.target, m.stratum_id,
             COALESCE((SELECT COUNT(*) FROM interviews i WHERE i.stratum_id = m.stratum_id AND i.status <> 'rejected'), 0)::int AS done
      FROM municipalities m ORDER BY m.region DESC, m.name`);
    res.json({ municipalities: r.rows });
  } catch (e) { next(e); }
});

const PatchSchema = z.object({
  inResearch: z.boolean().optional(),
  target: z.number().int().min(1).max(100000).optional(),
});

// PATCH /api/municipalities/:id — admin. Ciclo de vida do estrato/cotas.
router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const body = PatchSchema.parse(req.body);
    const out = await db.transaction(async (tx) => {
      const mr = await tx.execute(sql`SELECT id, project_id, name, region, in_research, target, stratum_id FROM municipalities WHERE id = ${req.params.id} LIMIT 1`);
      const m = mr.rows[0] as
        | { id: string; project_id: string; name: string; region: string; in_research: boolean; target: number | null; stratum_id: string | null }
        | undefined;
      if (!m) return { notFound: true } as const;
      if (m.region === "manaus") return { manausBlocked: true } as const; // Manaus = zonas fixas

      const desired = body.inResearch ?? m.in_research;

      if (desired) {
        const t = body.target ?? m.target;
        if (!t) return { needTarget: true } as const;
        let stratumId = m.stratum_id;
        if (!stratumId) {
          const ins = await tx.execute(sql`
            INSERT INTO strata (project_id, name, region, zone, municipality, municipality_id, target)
            VALUES (${m.project_id}, ${"Interior · " + m.name}, 'interior', NULL, ${m.name}, ${m.id}, ${t})
            RETURNING id`);
          stratumId = ins.rows[0]!.id as string;
        } else {
          await tx.execute(sql`UPDATE strata SET target = ${t} WHERE id = ${stratumId}`);
        }
        await upsertQuotaRows(tx, stratumId, t);
        await tx.execute(sql`UPDATE municipalities SET in_research = true, target = ${t}, stratum_id = ${stratumId} WHERE id = ${m.id}`);
        return { ok: true, inResearch: true, stratumId, target: t } as const;
      }

      // Desligar.
      if (m.stratum_id) {
        const c = await tx.execute(sql`SELECT COUNT(*)::int AS n FROM interviews WHERE stratum_id = ${m.stratum_id}`);
        const hasData = Number(c.rows[0]?.n ?? 0) > 0;
        if (!hasData) {
          await tx.execute(sql`DELETE FROM assignments WHERE stratum_id = ${m.stratum_id}`);
          await tx.execute(sql`DELETE FROM quotas WHERE stratum_id = ${m.stratum_id}`);
          await tx.execute(sql`UPDATE municipalities SET in_research = false, target = NULL, stratum_id = NULL WHERE id = ${m.id}`);
          await tx.execute(sql`DELETE FROM strata WHERE id = ${m.stratum_id}`);
          return { ok: true, inResearch: false, removed: true } as const;
        }
        // Tem entrevistas → soft (mantém estrato/dados na apuração).
        await tx.execute(sql`UPDATE municipalities SET in_research = false WHERE id = ${m.id}`);
        return { ok: true, inResearch: false, softArchived: true } as const;
      }
      await tx.execute(sql`UPDATE municipalities SET in_research = false WHERE id = ${m.id}`);
      return { ok: true, inResearch: false } as const;
    });

    if ((out as any).notFound) { res.status(404).json({ error: "not_found" }); return; }
    if ((out as any).manausBlocked) { res.status(400).json({ error: "manaus_managed_by_zones" }); return; }
    if ((out as any).needTarget) { res.status(400).json({ error: "target_required" }); return; }
    res.json(out);
  } catch (e) { next(e); }
});

export default router;
