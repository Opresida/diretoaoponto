// Auth JWT — PROMPT §2 (access 15min + refresh) + §5 (Auth).
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  role: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      teamFilter?: { managerId?: string };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  try {
    // PT-003 — algoritmo fixado (evita confusão de alg).
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

// PROMPT §2/§5 — access 15min + refresh.
export function signAccess(user: AuthUser): string {
  return jwt.sign(user, process.env.JWT_SECRET!, { algorithm: "HS256", expiresIn: "15m" });
}

export function signRefresh(payload: { id: string }): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { algorithm: "HS256", expiresIn: "30d" });
}

export function verifyRefresh(token: string): { id: string } {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!, { algorithms: ["HS256"] }) as { id: string };
}
