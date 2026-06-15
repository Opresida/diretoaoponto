// Auth — PROMPT §5. POST /api/auth/login, POST /api/auth/refresh.
import { Router } from "express";
import { z } from "zod";

const router = Router();

export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (_req, res) => {
  // TODO §5: valida credenciais (bcrypt), retorna { accessToken, refreshToken, user }
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (login)" });
});

router.post("/refresh", async (_req, res) => {
  // TODO §5: valida refresh token e emite novo access token (15min)
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §5 (refresh)" });
});

export default router;
