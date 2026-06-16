// Questionário configurável (§F4). Admin gerencia; manager/coordinator leem (espelho).
// Núcleo de voto (is_core) é protegido: só rótulo/ordem editáveis, nunca apagar/recodificar.
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const CHOICE = new Set(["single", "multi", "scale"]);

function slug(s: string): string {
  return (
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "pergunta"
  );
}

async function activeProjectId(): Promise<string | null> {
  const r = await db.execute(sql`SELECT id FROM projects ORDER BY created_at LIMIT 1`);
  return (r.rows[0]?.id as string) ?? null;
}

function strataArray(ids?: string[] | null) {
  return ids && ids.length
    ? sql`ARRAY[${sql.join(ids.map((s) => sql`${s}`), sql`, `)}]::uuid[]`
    : sql`NULL`;
}

// GET /api/questions[?stratum=<id>] — lista (statistician+). Com ?stratum, devolve
// só as que valem naquele estrato (gerais + escopadas a ele) — usado pelo gerente.
router.get("/", requireRole("statistician"), async (req, res, next) => {
  try {
    const pid = await activeProjectId();
    if (!pid) { res.json({ questions: [] }); return; }
    const stratum = typeof req.query.stratum === "string" ? req.query.stratum : null;
    const scope = stratum
      ? sql`AND (stratum_ids IS NULL OR ${stratum}::uuid = ANY(stratum_ids))`
      : sql``;
    const r = await db.execute(sql`
      SELECT id, code, type, label, office, options, rotate, seq, stratum_ids, is_core, active
      FROM questions WHERE project_id = ${pid} ${scope} ORDER BY seq, id`);
    res.json({ questions: r.rows });
  } catch (e) { next(e); }
});

const CreateSchema = z.object({
  type: z.enum(["open", "single", "multi", "scale"]),
  label: z.string().min(1),
  options: z.array(z.string().min(1)).optional(),
  rotate: z.boolean().optional(),
  seq: z.number().int().optional(),
  stratumIds: z.array(z.string().uuid()).optional(),
});

// POST /api/questions — cria pergunta EXTRA (admin). Núcleo nunca é criado aqui.
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const b = CreateSchema.parse(req.body);
    if (CHOICE.has(b.type) && (!b.options || b.options.length < 2)) {
      res.status(422).json({ error: "options_required", message: "Tipos de escolha precisam de ≥2 opções." });
      return;
    }
    const pid = await activeProjectId();
    if (!pid) { res.status(404).json({ error: "no_active_project" }); return; }

    // code único x_<slug> dentro do projeto.
    let code = `x_${slug(b.label)}`;
    const exists = await db.execute(sql`SELECT 1 FROM questions WHERE project_id = ${pid} AND code = ${code} LIMIT 1`);
    if (exists.rows.length) code = `${code}_${randomBytes(2).toString("hex")}`;

    const options = CHOICE.has(b.type) ? JSON.stringify(b.options) : null;
    const r = await db.execute(sql`
      INSERT INTO questions (project_id, code, type, label, office, options, rotate, seq, stratum_ids, is_core)
      VALUES (${pid}, ${code}, ${b.type}, ${b.label}, NULL, ${options}::jsonb,
              ${b.rotate ?? false}, ${b.seq ?? 100}, ${strataArray(b.stratumIds)}, false)
      RETURNING id, code, type, label, office, options, rotate, seq, stratum_ids, is_core, active`);
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

const PatchSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["open", "single", "multi", "scale"]).optional(),
  options: z.array(z.string().min(1)).optional(),
  rotate: z.boolean().optional(),
  seq: z.number().int().optional(),
  stratumIds: z.array(z.string().uuid()).nullable().optional(),
  active: z.boolean().optional(),
});

// PATCH /api/questions/:id — admin. Núcleo: só label/seq. Extra: tudo (menos code/office).
router.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const b = PatchSchema.parse(req.body);
    const cur = await db.execute(sql`SELECT id, is_core, type FROM questions WHERE id = ${req.params.id} LIMIT 1`);
    const row = cur.rows[0] as { is_core: boolean; type: string } | undefined;
    if (!row) { res.status(404).json({ error: "not_found" }); return; }

    if (row.is_core) {
      // Núcleo protegido: só rótulo e ordem.
      await db.execute(sql`
        UPDATE questions SET
          label = COALESCE(${b.label ?? null}, label),
          seq = COALESCE(${b.seq ?? null}, seq),
          updated_at = now()
        WHERE id = ${req.params.id}`);
    } else {
      const newType = b.type ?? row.type;
      if (CHOICE.has(newType) && b.options !== undefined && b.options.length < 2) {
        res.status(422).json({ error: "options_required" }); return;
      }
      const optExpr = b.options !== undefined ? sql`${JSON.stringify(b.options)}::jsonb` : sql`options`;
      const stratExpr = b.stratumIds !== undefined ? strataArray(b.stratumIds) : sql`stratum_ids`;
      await db.execute(sql`
        UPDATE questions SET
          label = COALESCE(${b.label ?? null}, label),
          type = COALESCE(${b.type ?? null}, type),
          options = ${optExpr},
          rotate = COALESCE(${b.rotate ?? null}, rotate),
          seq = COALESCE(${b.seq ?? null}, seq),
          stratum_ids = ${stratExpr},
          active = COALESCE(${b.active ?? null}, active),
          updated_at = now()
        WHERE id = ${req.params.id}`);
    }
    const r = await db.execute(sql`
      SELECT id, code, type, label, office, options, rotate, seq, stratum_ids, is_core, active
      FROM questions WHERE id = ${req.params.id}`);
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/questions/:id — admin. Núcleo NÃO pode ser apagado (quebraria a apuração).
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const cur = await db.execute(sql`SELECT is_core FROM questions WHERE id = ${req.params.id} LIMIT 1`);
    const row = cur.rows[0] as { is_core: boolean } | undefined;
    if (!row) { res.status(404).json({ error: "not_found" }); return; }
    if (row.is_core) { res.status(409).json({ error: "core_protected", message: "Pergunta de voto não pode ser excluída." }); return; }
    await db.execute(sql`DELETE FROM questions WHERE id = ${req.params.id}`);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

const ReorderSchema = z.object({ order: z.array(z.object({ id: z.string().uuid(), seq: z.number().int() })).min(1) });

// POST /api/questions/reorder — admin. Atualiza seq em lote.
router.post("/reorder", requireRole("admin"), async (req, res, next) => {
  try {
    const b = ReorderSchema.parse(req.body);
    await db.transaction(async (tx) => {
      for (const it of b.order) {
        await tx.execute(sql`UPDATE questions SET seq = ${it.seq}, updated_at = now() WHERE id = ${it.id}`);
      }
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
