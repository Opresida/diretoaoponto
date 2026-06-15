// Campo — PROMPT §5 (role interviewer). GET /api/field/package.
// Pacote do dia: estrato designado, cotas restantes, candidatos (p/ rotação),
// questionário e polígono de GPS.
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireAnyRole } from "../middleware/rbac.js";

const router = Router();

// Questionário (estrutura fixa; os candidatos vêm do banco p/ rotação).
const QUESTIONNAIRE = [
  { code: "gov_spont", office: "governor", type: "open", label: "Se a eleição para governador fosse hoje, em quem você votaria? (espontânea)" },
  { code: "gov_c1", office: "governor", type: "single", rotate: true, label: "E entre estes nomes, em quem votaria para governador?" },
  { code: "rejection_gov", office: "governor", type: "multi", rotate: true, label: "Em qual(is) destes você NÃO votaria de jeito nenhum?" },
  { code: "sen_v1", office: "senator", type: "single", rotate: true, label: "Para senador você tem 2 votos. Primeiro voto:" },
  { code: "sen_v2", office: "senator", type: "single", rotate: true, label: "Segundo voto para senador (diferente do primeiro):" },
  { code: "eval_wilson", type: "scale", label: "Como você avalia o atual governo?", scale: ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo", "NS/NR"] },
  { code: "know_omar", type: "scale", label: "Você conhece o candidato Omar Aziz?", scale: ["Conhece bem", "Conhece de nome", "Não conhece"] },
];

router.get("/package", requireAnyRole("interviewer"), async (req, res, next) => {
  try {
    const me = req.user!;

    const proj = await db.execute(sql`
      SELECT id, name, tse_registration, margin_error, confidence, status
      FROM projects ORDER BY created_at LIMIT 1`);
    const project = proj.rows[0];
    if (!project) {
      res.status(404).json({ error: "no_active_project" });
      return;
    }

    // Escopo do pacote: 1) assignment do dia; 2) zona do gerente do entrevistador;
    // 3) fallback = todos os estratos do projeto (entrevistador sem gerente/zona).
    const assigned = await db.execute(sql`
      SELECT s.id FROM assignments a
      JOIN strata s ON s.id = a.stratum_id
      WHERE a.interviewer_id = ${me.id} AND a.date = now()::date`);
    let scopeIds = assigned.rows.map((r) => r.id as string);
    if (!scopeIds.length) {
      const mz = await db.execute(sql`
        SELECT m.stratum_id FROM users u JOIN users m ON m.id = u.manager_id WHERE u.id = ${me.id} LIMIT 1`);
      const mgrStratum = mz.rows[0]?.stratum_id as string | undefined;
      if (mgrStratum) scopeIds = [mgrStratum];
    }

    const strataRows = await db.execute(
      scopeIds.length
        ? sql`SELECT id, name, region, zone, municipality, target, census_polygon
              FROM strata WHERE id IN (${sql.join(scopeIds.map((id) => sql`${id}`), sql`, `)}) ORDER BY name`
        : sql`SELECT id, name, region, zone, municipality, target, census_polygon
              FROM strata WHERE project_id = ${project.id} ORDER BY region, name`,
    );

    // Cotas (com restante) de todos os estratos do pacote.
    const stratIds = strataRows.rows.map((s) => s.id as string);
    const quotaRows = stratIds.length
      ? (await db.execute(sql`
          SELECT id, stratum_id, label, sex, age_min, age_max, target, completed,
                 GREATEST(target - completed, 0) AS remaining
          FROM quotas WHERE stratum_id IN (${sql.join(stratIds.map((id) => sql`${id}`), sql`, `)}) ORDER BY label`)).rows
      : [];

    const strata = strataRows.rows.map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region,
      zone: s.zone,
      municipality: s.municipality,
      target: s.target,
      censusPolygon: s.census_polygon,
      quotas: quotaRows.filter((q) => q.stratum_id === s.id),
    }));

    // Candidatos p/ rotação, agrupados por cargo (com foto quando houver).
    const cands = await db.execute(sql`
      SELECT id, name, party, office, color,
             (photo_key IS NOT NULL OR photo_url IS NOT NULL) AS has_photo
      FROM candidates ORDER BY office, name`);
    const candidates: Record<string, unknown[]> = {};
    for (const c of cands.rows) {
      (candidates[c.office as string] ??= []).push({
        name: c.name,
        party: c.party,
        color: c.color,
        photo: c.has_photo ? `/api/candidates/${c.id}/photo` : null,
        isOption: ["Branco/Nulo", "NS/NR"].includes(c.name as string),
      });
    }

    res.json({
      project,
      assigned: assigned.rows.length > 0,
      strata,
      candidates,
      questionnaire: QUESTIONNAIRE,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
