// Auth — PROMPT §5. POST /api/auth/login, POST /api/auth/refresh.
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { signAccess, signRefresh, verifyRefresh } from "../middleware/auth.js";

const router = Router();

export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

async function findActiveUserByEmail(email: string) {
  const r = await db.execute(
    sql`SELECT id, name, email, role, password_hash, active FROM users WHERE email = ${email} LIMIT 1`,
  );
  return r.rows[0] ?? null;
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const u = await findActiveUserByEmail(email);
    if (!u || u.active !== true) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const ok = await bcrypt.compare(password, u.password_hash as string);
    if (!ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const user = { id: u.id as string, role: u.role as string, name: u.name as string };
    res.json({
      accessToken: signAccess(user),
      refreshToken: signRefresh({ id: user.id }),
      user: { ...user, email: u.email },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
    const { id } = verifyRefresh(token);
    const r = await db.execute(
      sql`SELECT id, name, role, active FROM users WHERE id = ${id} LIMIT 1`,
    );
    const u = r.rows[0];
    if (!u || u.active !== true) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    const user = { id: u.id as string, role: u.role as string, name: u.name as string };
    res.json({ accessToken: signAccess(user) });
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
});

export default router;
