// Mídia de auditoria — PROMPT §5 (supervisor+) + CA #7.
import { Router } from "express";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.get("/:id/media", requireRole("supervisor"), async (_req, res) => {
  // Presigned GETs de áudio + fotos, expiração 10 min (services/storage.presignGet).
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (/interviews/:id/media)" });
});

export default router;
