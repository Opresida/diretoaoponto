-- F2 — Foto do candidato (upload no R2 OU URL externa).
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_key TEXT;  -- key no R2 (candidates/{id}.jpg)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_url TEXT;  -- URL externa colada
-- Leitura: photo_key (presigned GET) > photo_url > null.
