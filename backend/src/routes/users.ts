// Hierarquia de cadastro — PROMPT §12. admin → gerente → entrevistador.
import { Router } from "express";
import { z } from "zod";
import { requireRole, teamScope } from "../middleware/rbac.js";

const router = Router();

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([
    "admin",
    "manager",
    "coordinator",
    "statistician",
    "supervisor",
    "interviewer",
    "client",
  ]),
  managerId: z.string().uuid().optional(),
});

// POST /api/users — admin: qualquer role; manager: força role=interviewer e
// manager_id = req.user.id (ignora valores do body). CA #8.
router.post("/", requireRole("manager"), async (_req, res) => {
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §12 (POST /users)" });
});

// PATCH /api/users/:id/active — desativação respeita o mesmo escopo.
router.patch("/:id/active", requireRole("manager"), teamScope, async (_req, res) => {
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §12 (PATCH active)" });
});

export default router;

// ─── /api/team (router separado, montado no server) ──────────────────
export const teamRouter = Router();

// GET /api/team — manager: própria equipe + produção do dia; admin: ?managerId= p/ auditar.
// CA #9: gerente A não enxerga entrevistadores do gerente B.
teamRouter.get("/", requireRole("manager"), teamScope, async (_req, res) => {
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §12 (GET /team)" });
});
