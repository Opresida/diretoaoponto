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
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

// TODO §5: signAccess/signRefresh (15min/refresh) e verificação de refresh.
