-- F1 — Catálogo de municípios (cadastrar = vira área de pesquisa).
CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  region region_t NOT NULL,                  -- manaus (só Manaus) | interior
  in_research BOOLEAN NOT NULL DEFAULT false,
  target INT,                                -- null até entrar na pesquisa
  stratum_id UUID REFERENCES strata(id),     -- estrato gerado quando in_research
  UNIQUE(project_id, name)
);

ALTER TABLE strata ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

-- Seed dos 62 municípios + backfill: ver seed.ts (MUN_62) para instalação nova.
-- Em bases já populadas, os 62 são inseridos e os estratos existentes linkados
-- por nome, marcando in_research nos municípios do interior já amostrados.
