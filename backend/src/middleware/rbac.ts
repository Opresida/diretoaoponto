// RBAC + escopo de equipe — PROMPT §12 (hierarquia admin→gerente→entrevistador).
import type { Request, Response, NextFunction } from "express";

const RANK: Record<string, number> = {
  client: 0,
  interviewer: 1,
  supervisor: 2,
  statistician: 3,
  coordinator: 4,
  manager: 5,
  admin: 6,
};

/** Exige role mínima (ex.: requireRole("coordinator") cobre coordinator+). */
export function requireRole(min: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const have = RANK[req.user?.role ?? ""] ?? -1;
    if (have < (RANK[min] ?? 99)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

/** Exige uma das roles exatas. */
export function requireAnyRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user?.role ?? "")) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

/** Escopo de equipe — PROMPT §12. Gerente só enxerga a própria equipe. */
export function teamScope(req: Request, _res: Response, next: NextFunction): void {
  req.teamFilter = req.user?.role === "manager" ? { managerId: req.user.id } : {};
  next();
}
