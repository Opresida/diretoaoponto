-- Migration inicial — Direito ao Ponto. PROMPT §3 + §13.1 + §14.1.
-- Esta versão SQL é a fonte canônica para as features que o Drizzle não
-- expressa diretamente (coluna GENERATED, FK self-referencial). Após o
-- primeiro `drizzle-kit generate`, reconcilie os snapshots.

CREATE TYPE user_role AS ENUM ('admin','manager','coordinator','statistician','supervisor','interviewer','client');
CREATE TYPE region_t AS ENUM ('manaus','interior');
CREATE TYPE interview_status AS ENUM ('synced','approved','rejected','pending_check');
CREATE TYPE check_result AS ENUM ('approved','rejected');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  registration_code TEXT UNIQUE,
  manager_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_manager ON users(manager_id);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tse_registration TEXT NOT NULL,
  tse_registration_federal TEXT,
  sample_size INT NOT NULL,
  margin_error NUMERIC(4,2) NOT NULL,
  confidence NUMERIC(4,2) NOT NULL,
  field_start DATE, field_end DATE,
  status TEXT NOT NULL DEFAULT 'field',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE strata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  region region_t NOT NULL,
  zone TEXT,
  municipality TEXT NOT NULL,
  target INT NOT NULL,
  census_polygon JSONB,
  UNIQUE(project_id, name)
);

CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  label TEXT NOT NULL,
  sex CHAR(1) NOT NULL,
  age_min INT NOT NULL, age_max INT NOT NULL,
  target INT NOT NULL,
  completed INT NOT NULL DEFAULT 0,
  UNIQUE(stratum_id, label)
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  interviewer_id UUID NOT NULL REFERENCES users(id),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  date DATE NOT NULL,
  UNIQUE(interviewer_id, stratum_id, date)
);

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  party TEXT,
  office TEXT NOT NULL,
  color TEXT,
  UNIQUE(name, office)
);

-- anchors antes de interviews por causa da FK anchor_id (§13.1)
CREATE TABLE anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  merkle_root TEXT NOT NULL,
  interview_count INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  chain TEXT NOT NULL DEFAULT 'base',
  tx_hash TEXT,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  anchored_at TIMESTAMPTZ
);

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid UUID UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  interviewer_id UUID NOT NULL REFERENCES users(id),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  quota_id UUID NOT NULL REFERENCES quotas(id),
  respondent_sex CHAR(1) NOT NULL,
  respondent_age INT NOT NULL CHECK (respondent_age >= 16),
  consent_lgpd BOOLEAN NOT NULL,
  consent_photo BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_sec INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (ended_at - started_at))::INT) STORED,
  gps_start JSONB NOT NULL,
  gps_end JSONB NOT NULL,
  audio_key TEXT,
  status interview_status NOT NULL DEFAULT 'synced',
  fraud_flags JSONB NOT NULL DEFAULT '[]',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- §13 integridade blockchain
  payload_hash TEXT,
  device_hashed_at TIMESTAMPTZ,
  anchor_id UUID REFERENCES anchors(id),
  merkle_proof JSONB,
  -- §14 recibo
  receipt_code TEXT UNIQUE
);
CREATE INDEX idx_interviews_project ON interviews(project_id, synced_at DESC);
CREATE INDEX idx_interviews_interviewer ON interviews(interviewer_id);

CREATE TABLE answers (
  id BIGSERIAL PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id),
  value_text TEXT,
  UNIQUE(interview_id, question_code)
);
CREATE INDEX idx_answers_question ON answers(question_code, candidate_id);

CREATE TABLE interview_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  seq SMALLINT NOT NULL CHECK (seq BETWEEN 1 AND 3),
  storage_key TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL,
  gps JSONB,
  UNIQUE(interview_id, seq)
);

CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES interviews(id),
  supervisor_id UUID REFERENCES users(id),
  method TEXT,
  result check_result,
  reason TEXT,
  checked_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT, entity_id TEXT,
  meta JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
