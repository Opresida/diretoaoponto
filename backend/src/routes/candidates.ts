// Gestão de candidatos — tela do Admin. Listagem p/ coordinator+, mutações admin.
// Foto (F2): photo_key (R2) ou photo_url (externa); servida por /:id/photo (público).
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireRole } from "../middleware/rbac.js";
import { presignGet } from "../services/storage.js";

const router = Router();

// PT-007 — só aceita/segue URL de foto externa que seja https + domínio real (FQDN).
// Bloqueia IPs literais (privados/loopback/link-local/metadata 169.254.169.254), IPv6 e localhost
// → mata SSRF e open-redirect a partir da rota pública /:id/photo.
export function isSafePublicImageUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.includes(":") || raw.includes("[")) return false;          // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;             // IPv4 literal
  if (!host.includes(".")) return false;                              // exige FQDN
  return true;
}

const CandidateSchema = z.object({
  name: z.string().min(1),
  party: z.string().nullable().optional(),
  office: z.string().min(1), // governor | senator | president | ...
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  photoKey: z.string().nullable().optional(),
  photoUrl: z.string().url().refine(isSafePublicImageUrl, { message: "photo_url_inseguro (use https + domínio público)" }).nullable().optional(),
});

// GET /api/candidates — lista (com nº de votos + flag de foto), statistician+.
router.get("/", requireRole("statistician"), async (_req, res, next) => {
  try {
    const r = await db.execute(sql`
      SELECT c.id, c.name, c.party, c.office, c.color,
             (c.photo_key IS NOT NULL OR c.photo_url IS NOT NULL) AS has_photo,
             (SELECT COUNT(*) FROM answers a WHERE a.candidate_id = c.id)::int AS votos
      FROM candidates c ORDER BY c.office, c.name`);
    const candidates = r.rows.map((c) => ({
      ...c,
      photo: c.has_photo ? `/api/candidates/${c.id}/photo` : null,
    }));
    res.json({ candidates });
  } catch (e) { next(e); }
});

// POST /api/candidates — admin.
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const b = CandidateSchema.parse(req.body);
    const r = await db.execute(sql`
      INSERT INTO candidates (name, party, office, color, photo_key, photo_url)
      VALUES (${b.name}, ${b.party ?? null}, ${b.office}, ${b.color ?? null}, ${b.photoKey ?? null}, ${b.photoUrl ?? null})
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
        color = ${b.color === undefined ? sql`color` : b.color},
        photo_key = ${b.photoKey === undefined ? sql`photo_key` : b.photoKey},
        photo_url = ${b.photoUrl === undefined ? sql`photo_url` : b.photoUrl}
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

// ─── Rota PÚBLICA da foto (montar antes do requireAuth) ──────────────
// GET /api/candidates/:id/photo → 302 p/ presigned GET (R2) ou URL externa.
export const publicCandidatePhotoRouter = Router();
publicCandidatePhotoRouter.get("/:id/photo", async (req, res, next) => {
  try {
    const r = await db.execute(sql`SELECT photo_key, photo_url FROM candidates WHERE id = ${req.params.id} LIMIT 1`);
    const c = r.rows[0] as { photo_key: string | null; photo_url: string | null } | undefined;
    if (!c) { res.status(404).end(); return; }
    res.setHeader("Cache-Control", "private, max-age=300");
    if (c.photo_key && process.env.S3_ACCESS_KEY) {
      res.redirect(302, await presignGet(c.photo_key, 600));
      return;
    }
    if (c.photo_url && isSafePublicImageUrl(c.photo_url)) { res.redirect(302, c.photo_url); return; }
    res.status(404).end();
  } catch (e) { next(e); }
});
