-- 0004_reports.sql — relatório selado (papel timbrado + QR + ancoragem na Base).
-- Aditiva: não altera tabelas existentes. Deploy sem downtime.
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  code          TEXT NOT NULL UNIQUE,            -- REL-2026-XXXX
  content_hash  TEXT NOT NULL,                   -- sha256(canonicalize(payload)+salt)
  payload       JSONB NOT NULL,                  -- snapshot congelado (ficha+resultados+lista)
  pdf_key       TEXT,                            -- R2: bytes exatos do PDF
  generated_by  UUID NOT NULL REFERENCES users(id),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  chain         TEXT,
  tx_hash       TEXT,
  block_number  BIGINT,
  anchored_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'anchoring' -- anchoring | anchored | local | failed
);

CREATE INDEX IF NOT EXISTS reports_project_idx ON reports (project_id, generated_at DESC);
