// Relatórios selados — geração sob demanda (admin). PROMPT §13 (integridade).
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { generateReport, gatherReportData, computeReportHash } from "../services/reportService.js";
import { renderReportPdf } from "../services/reportPdf.js";
import { getObject } from "../services/storage.js";

const router = Router();

// POST /api/reports — gera um novo relatório (snapshot → hash → âncora → PDF).
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const r = await generateReport(req.user!.id);
    res.status(201).json(r);
  } catch (e) { next(e); }
});

// GET /api/reports — lista relatórios gerados (admin).
router.get("/", requireRole("admin"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT id, code, content_hash, status, chain, tx_hash, block_number,
             anchored_at, generated_at, (pdf_key IS NOT NULL) AS has_pdf,
             payload->'ficha'->>'amostraColetada' AS amostra
      FROM reports ORDER BY generated_at DESC LIMIT 100`);
    res.json({ reports: r.rows });
  } catch (e) { next(e); }
});

// GET /api/reports/:id/pdf — baixa o PDF (do R2; regenera do payload se faltar).
router.get("/:id/pdf", requireRole("admin"), async (req, res, next) => {
  try {
    const row = await db.execute(sql`
      SELECT code, content_hash, payload, pdf_key, tx_hash, chain, status
      FROM reports WHERE id = ${req.params.id} LIMIT 1`);
    const rep = row.rows[0] as
      | { code: string; content_hash: string; payload: any; pdf_key: string | null; tx_hash: string | null; chain: string | null; status: string }
      | undefined;
    if (!rep) { res.status(404).json({ error: "not_found" }); return; }

    let pdf: Buffer;
    if (rep.pdf_key && process.env.S3_ACCESS_KEY) {
      pdf = await getObject(rep.pdf_key);
    } else {
      const verifyUrl = `${process.env.PUBLIC_PORTAL_ORIGIN ?? "http://localhost:5174"}/r/${rep.code}`;
      pdf = await renderReportPdf({
        payload: rep.payload, contentHash: rep.content_hash, verifyUrl,
        txHash: rep.tx_hash, chain: rep.chain ?? "base", status: rep.status,
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${rep.code}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// GET /api/reports/preview — números atuais sem gerar/selar (pré-visualização).
router.get("/preview", requireRole("admin"), async (_req, res, next) => {
  try {
    const payload = await gatherReportData();
    res.json({ contentHashPreview: computeReportHash(payload), ficha: payload.ficha, governo: payload.governo, count: payload.entrevistas.length });
  } catch (e) { next(e); }
});

export default router;
