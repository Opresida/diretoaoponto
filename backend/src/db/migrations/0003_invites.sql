-- F3 — Convites de cadastro (uso único): gerente (admin gera) e entrevistador
-- (gerente gera). Uso único garantido por UPDATE ... WHERE used_at IS NULL.
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,                 -- 'manager' | 'interviewer'
  stratum_id UUID REFERENCES strata(id),   -- zona do gerente (invite de gerente)
  manager_id UUID REFERENCES users(id),    -- gerente dono (invite de entrevistador)
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
