// Gestão de candidatos — tela do Admin. Listagem p/ coordinator+, mutações admin.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const CandidateSchema = z.object({
  name: z.string().min(1),
  party: z.string().nullable().optional(),
  office: z.string().min(1), // governor | senator | president | ...
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

// GET /api/candidates — lista (com nº de votos), coordinator+.
router.get("/", requireRole("coordinator"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT c.id, c.name, c.party, c.office, c.color,
             (SELECT COUNT(*) FROM answers a WHERE a.candidate_id = c.id)::int AS votos
      FROM candidates c ORDER BY c.office, c.name`);
    res.json({ candidates: r.rows });
  } catch (e) { next(e); }
});

// POST /api/candidates — admin.
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const b = CandidateSchema.parse(req.body);
    const r = await db.execute(sql`
      INSERT INTO candidates (name, party, office, color)
      VALUES (${b.name}, ${b.party ?? null}, ${b.office}, ${b.color ?? null})
      RETURNING id, name, party, office, color`);
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "candidate_already_exists" }); return; }
    next(e);
  }
});

// PATCH /api/candidates/:id — admin.
router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const b = CandidateSchema.partial().parse(req.body);
    const r = await db.execute(sql`
      UPDATE candidates SET
        name = COALESCE(${b.name ?? null}, name),
        party = ${b.party === undefined ? sql`party` : b.party},
        office = COALESCE(${b.office ?? null}, office),
        color = ${b.color === undefined ? sql`color` : b.color}
      WHERE id = ${req.params.id}
      RETURNING id, name, party, office, color`);
    if (!r.rows.length) { res.status(404).json({ error: "not_found" }); return; }
    res.json(r.rows[0]);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "candidate_already_exists" }); return; }
    next(e);
  }
});

// DELETE /api/candidates/:id — admin. Bloqueia se já tem votos (FK).
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM candidates WHERE id = ${req.params.id}`);
    res.json({ deleted: true });
  } catch (e: any) {
    if (e?.code === "23503") {
      res.status(409).json({ error: "candidate_has_votes", message: "Candidato já possui votos; não pode ser excluído." });
      return;
    }
    next(e);
  }
});

export default router;
