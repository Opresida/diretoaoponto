-- 0005_questions.sql — questionário configurável por estrato (cascata aditiva).
-- Aditiva: não altera tabelas existentes. Núcleo de voto protegido (is_core).
CREATE TABLE IF NOT EXISTS questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,                 -- 'gov_c1'… (núcleo) | 'x_<slug>' (extra)
  type         TEXT NOT NULL,                 -- open|single|multi|scale
  label        TEXT NOT NULL,
  office       TEXT,                          -- governor|senator|president (núcleo); null nas extras
  options      JSONB,                         -- opções fixas das extras single/multi/scale
  rotate       BOOLEAN NOT NULL DEFAULT false,
  seq          INT NOT NULL DEFAULT 100,
  stratum_ids  UUID[],                        -- null/vazio = GERAL (todos); senão só nesses estratos
  is_core      BOOLEAN NOT NULL DEFAULT false,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT questions_project_code_uq UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS questions_project_idx ON questions (project_id, seq);

-- Semente: núcleo (a partir do QUESTIONNAIRE atual) + 2 extras globais. Idempotente.
INSERT INTO questions (project_id, code, type, label, office, options, rotate, seq, is_core)
SELECT p.id, v.code, v.type, v.label, v.office, v.options, v.rotate, v.seq, v.is_core
FROM projects p
CROSS JOIN (VALUES
  ('gov_spont','open','Se a eleição para governador fosse hoje, em quem você votaria? (espontânea)','governor',NULL::jsonb,false,10,true),
  ('gov_c1','single','E entre estes nomes, em quem votaria para governador?','governor',NULL::jsonb,true,20,true),
  ('rejection_gov','multi','Em qual(is) destes você NÃO votaria de jeito nenhum?','governor',NULL::jsonb,true,30,true),
  ('sen_v1','single','Para senador você tem 2 votos. Primeiro voto:','senator',NULL::jsonb,true,40,true),
  ('sen_v2','single','Segundo voto para senador (diferente do primeiro):','senator',NULL::jsonb,true,50,true),
  ('eval_wilson','scale','Como você avalia o atual governo?',NULL,'["Ótimo","Bom","Regular","Ruim","Péssimo","NS/NR"]'::jsonb,false,60,false),
  ('know_omar','scale','Você conhece o candidato Omar Aziz?',NULL,'["Conhece bem","Conhece de nome","Não conhece"]'::jsonb,false,70,false)
) AS v(code, type, label, office, options, rotate, seq, is_core)
ON CONFLICT (project_id, code) DO NOTHING;
