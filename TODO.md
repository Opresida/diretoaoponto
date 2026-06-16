# TODO — Direito ao Ponto

Legenda: ✅ feito · 🟡 stub/parcial · ⬜ não iniciado. Refs = seção do PROMPT.

## Infra & base
- ✅ Estrutura de pastas do backend (§9)
- ✅ Schema Drizzle completo (§3 + §13.1 + §14.1)
- ✅ Migration SQL inicial `0000_init.sql` (coluna gerada `duration_sec`, FK anchor, §13/§14)
- ✅ Conexão Neon (`src/db/index.ts`, §4)
- ✅ `drizzle.config.ts`, `package.json`, `tsconfig.json`, `.env.example`
- ⬜ Provisionar banco Neon e aplicar migration
- ⬜ Provisionar bucket R2/S3 e Redis (Upstash)

## Auth & RBAC
- ✅ Middleware auth JWT (`requireAuth` + `signAccess`/`signRefresh`/`verifyRefresh`, §5)
- ✅ Middleware rbac (`requireRole`, `requireAnyRole`, `teamScope`, §12)
- ✅ `POST /api/auth/login` + `/refresh` (bcrypt) — testado
- ✅ `POST /api/users` + `GET /api/team` + `PATCH /api/users/:id/active` (§12) → CA #8, #9 testados

## Coleta de campo
- ⬜ `GET /api/field/package` (estrato, cotas, questionário, polígono)
- ✅ `POST /api/uploads/presign` — testado (presign PUT no R2)
- ✅ Zod `SyncSchema` (§5)
- ✅ Lógica do sync — 10 passos (idempotência, senado, flags, cota, candidatos, hash, recibo, WS, jobs) — testado ponta-a-ponta
- ✅ `computeFraudFlags` (point-in-polygon p/ gps_outside)
- ✅ `tryIncrementQuota` / `decrementQuota`
- ✅ `receiptCode` — corrigido bug do §14.1 (`% 32` com alfabeto de 31 chars → `undefined`; agora `% ALPHABET.length`). **App precisa do mesmo fix (CA #14).**
- 🟡 Hash §13.2 implementado, mas exige `photoHashes`/`audioHash` no payload do app p/ casar byte-a-byte

## Apuração
- ✅ `apuracaoGoverno` / `apuracaoSenado` / `resumo` (recortes total/manaus/interior; senado 100/200) — testado
- ✅ WebSocket handshake (coordinator+) + broadcast `interview:new` — testado
- ✅ Cache Redis incremental (HINCRBY por voto) + reconcile inicial + a cada 60s + pós-reprovação (§6) — `services/cache.ts`
- ✅ `getSnapshot` em pipeline único (1 RTT) — leitura quente ~157ms (dentro do <500ms do CA #4)
- 🟡 CA #4 end-to-end ~3s **rodando do Brasil** (escrita no Neon us-east-1, ~10 RTTs sequenciais). Resolve com deploy co-localizado (us-east-1) e/ou batch dos inserts do sync — otimização futura
- ✅ Bug corrigido: `progress.target` inflava por SUM(target) sobre JOIN com interviews

## Supervisão
- ✅ `GET /api/checks/queue` (flags primeiro, short_duration no topo → CA #5) testado
- ✅ `POST /api/checks/:id/result` (reprovação decrementa cota + status rejected + reposição → CA #6) testado
- ✅ `GET /api/interviews/:id/media` (presigned GET 10min, supervisor+ → CA #7) — testado com R2 real

## Integridade blockchain (Base)
- ✅ `AnchorRegistry.sol` (§13.3)
- ✅ Helpers Merkle (`buildTree`/`proofHex`/`verifyProof`)
- ✅ `receiptCode` determinístico (§14.1, bug do `% 32` corrigido)
- ✅ Recalc de hash no sync — hash de dispositivo (in-transit, `hash_mismatch`) + hash de conteúdo reconstruível (folha ancorada/`/verify`); decisão de design documentada em ARCHITECTURE
- ✅ `anchorBatch` (`services/anchor.ts`, ethers, INSERT anchors + UPDATE merkle_proof) + `POST /api/anchor/run` (admin); fallback "selo local" quando sem chave/contrato
- ✅ **CA #11 on-chain testado na Base Sepolia** — contrato `AnchorRegistry` em `0xF7B49f5AAc1cf026bD8cEe6C3082207A5083C435`; tx real, `verify` → sealed_valid c/ link `sepolia.basescan.org`. Deploy via `scripts/deploy-anchor.mjs` (solc+ethers)
- ⬜ Migrar p/ Base **mainnet** quando for produção (trocar `BASE_RPC_URL`/`ANCHOR_CHAIN`/redeploy + chave financiada com ETH real)
- ⬜ Agendar `anchorBatch` como cron BullMQ horário (depende de Redis)
- ✅ `GET /api/verify/:code` + `/id/:interviewId` (4 estados, reverificação real, rate-limit) — CA #10/#12 testados

## Filas
- ✅ Redis provisionado (Upstash, us-east-1) — `REDIS_URL` em `.env`, conexão testada
- ✅ Workers BullMQ ativos: `photo-watermark`, `audio-transcode`, `anchor-batch` (`src/jobs/workers.ts`) — processamento confirmado nos logs
- ✅ Cron horário de ancoragem (BullMQ repeatable `0 * * * *`) agendado no boot
- ✅ R2 provisionado (bucket `pesquisa-midia`, privado) — `S3_*` em `.env`, upload/download testado
- ✅ Worker `photo-watermark` REAL (sharp: baixa do R2, carimba timestamp+GPS, regrava) — testado
- 🟡 Worker `audio-transcode`: verifica objeto no R2 (passthrough); transcodificação real precisa de ffmpeg no host
- ℹ️ Gate `WORKERS=off` p/ poupar quota Upstash free

## Seed
- 🟡 `seed.ts` — esqueleto; falta inserir projeto/estratos/cotas/candidatos/hierarquia (§10, §12)

## Frontend
- ✅ **App de Campo (PWA)** em `/frontend` (Vite+React+Tailwind, design tokens §14.5) — login → triagem de cota → consentimento LGPD → CapturaFotos (§8) → questionário c/ rotação → recibo (§14.3); fila offline (IndexedDB) + auto-sync; recibo determinístico igual ao backend. Build OK + integração via proxy testada.
- ✅ Dashboard de Apuração em `/dashboard` (Vite+React+Tailwind+recharts) — login coordinator+, snapshot inicial via REST + WebSocket ao vivo, placar líder + empate técnico, RecorteRegional §7 (Manaus×Interior), ranking Senado (2 vagas), feed de entrevistas, evolução (chart), progresso por região, flags. Endpoint `GET /api/apuracao/snapshot` adicionado. Testado.
- ✅ Portal de Verificação público (§14.4) em `/portal` (Vite+React, rota `/v/:code`) — testado contra /api/verify real
- ℹ️ R2 precisa de **CORS** liberando a origem do app (feito p/ localhost:5173/4173 via painel; em prod, adicionar domínio real em AllowedOrigins). Script: `backend/scripts/set-r2-cors.mjs` (requer token admin)
- ✅ Painel do Admin em `/admin`: abas Visão geral, **Apuração** (dashboard completo embutido), Candidatos (CRUD), Equipes (criar gerente **com zona/estrato**, criar entrevistador, equipes c/ zona, ativar/desativar). Backend: `/api/candidates` (CRUD), `GET /api/users`, `GET /api/strata`.
- ✅ **Gerente vinculado a uma zona/estrato** (`users.stratum_id`) + **Dashboard do Gerente** (`/dashboard` detecta role → `ManagerDashboard` escopado): vê só a zona dele (governo/senado/cotas/recentes/flags via `GET /api/apuracao/scoped`, ao vivo). Verificado via Playwright.
- 🟡 Áudio/GPS: GPS capturado; gravação de áudio ainda não (app v1 sem áudio)
- ✅ **Ícones PWA + favicon** gerados (sharp) a partir da logo oficial; manifest configurado (vite-plugin-pwa)
- ✅ **Rebrand identidade oficial** (2026-06-15) — paleta carmim `#A81824` + logo nos cabeçalhos/login + timbre do PDF. Tema: **portal claro** (público); **campo/admin/gerente/checagem escuros** com acento carmim. `emerald` remapeado p/ carmim nos Tailwind configs. Assets via `backend/scripts/gen-brand-assets.mjs`.
- ✅ **Relatório selado** (aba Admin "Relatórios") — snapshot + hash + ancoragem na Base + PDF timbrado + verificação pública `/r/:code`.

## Questionário configurável (commit `b0410f1`)
- ✅ Tabela `questions` (migration `0005_questions.sql` + schema) aplicada no Neon (7 linhas: 5 núcleo + 2 extras)
- ✅ Cascata **aditiva** por estrato (`stratum_ids uuid[]`, `null` = global) — `field.ts` monta o pacote do app a partir do banco
- ✅ **Núcleo de voto protegido** (`is_core`) — remoção bloqueada (409); a apuração nunca quebra
- ✅ Extras (escala/múltipla/aberta) com **agregação automática** (`services/aggregation.ts::apuracaoExtra`)
- ✅ Builder no Admin (`Questionarios.jsx`) + espelho read-only no Dashboard do gerente (`ManagerQuestionario.jsx`)
- ✅ App de campo (`Questionario.jsx`) consome o pacote dinâmico; verificado ponta-a-ponta (cascata, 409, extras)

## Materiais comerciais (produto MAZARI Corp · www.mazaricorp.com)
- ✅ **Deck PDF** (paisagem) `docs/Apresentacao-DiretoAoPonto-MAZARI.pdf` — gerador `backend/scripts/gen-pitch-deck.mjs` (gitignored, regenerável)
- ✅ **Vídeo animado 9:16** — estúdio Remotion em `C:\Users\user\remotion-studio` (voz ElevenLabs "Brian" + trilha/SFX): completo (~2m28s) + corte social (~43s). Roteiro: `remotion-studio/ROTEIRO-direto-ao-ponto.md`
- ⬜ (opcional) dar **remote/GitHub** ao `remotion-studio` p/ versionar o vídeo; revogar/rotacionar a API key da ElevenLabs usada na geração

## Segurança (pentest SAST 2026-06-15) — ⚠️ corrigir antes de dados reais
Relatório completo: `docs/SECURITY-AUDIT-2026-06-15.md` · consolidado: `docs/security-findings.json`. Placar: 1 crítico, 7 altos, 8 médios, 5 baixos + 9 deps.
- 🔴 ✅ **PT-001** (commit `b26c6a2`) — voto individual removido do broadcast WS e do `scopedApuracao.recent` + feeds admin/dashboard.
- 🟠 ⬜ **PT-002** — rotacionar segredos do `.env` + secret manager em prod (estão em claro, mas nunca commitados; `ANCHOR_PRIVATE_KEY` em KMS). *(operacional, com Humberto)*
- 🟠 ✅ **PT-003/005/006/016** (commit `a273e9a`) — `helmet()` + CORS allowlist + `express-rate-limit` (login/refresh/convite) + `algorithms:['HS256']` no JWT + `src/config/env.ts` valida no boot. *(rate-limit store Redis em prod = Fase 2)*
- 🟠 ✅ **PT-004 + PT-021** (commit `6ca7640`) — `storageKey`/`audioKey` reconstruídas no servidor (sync) + allowlist de prefixo em `storage.ts`. *(residual: tabela de posse p/ bloquear PUT overwrite = Fase 2)*
- 🟠 ✅ **PT-007** (commit `f8e5fb7`) — SSRF/open-redirect morto em `/candidates/:id/photo` (`isSafePublicImageUrl`: só https+FQDN).
- 🟠 🟡 **PT-008** — `ws` CORRIGIDA (override `$ws`→8.21.0, inclui a de dentro do ethers); dev-only (`solc/tmp/esbuild`) não sobe (`npm run audit` = prod-only). **Resta** o upgrade real `drizzle-orm 0.31→0.45` (puxa `@neondatabase/serverless` 0.9→1.x = 2 majors na camada de banco) — agendado, com smoke contra Neon. Triagem/VEX: `docs/security-deps-triage.md` (drizzle = não-explorável no nosso uso).
- 🟡 ⬜ **PT-009/010/011** — privacidade estatística: supressão de célula mínima nos agregados, coarsen do anexo do relatório, recibo salgado (HMAC `HASH_SALT`).
- 🟡 ⬜ **PT-012/013/014/015** — rotação/revogação do refresh token; matar `senha123` do seed; Zod no convite admin; login constant-time.
- 🟢 ⬜ **PT-017→021** — política de senha, race do código ENT-, `scenario` enum, rate-limit do `/verify` em Redis, allowlist de prefixo em `storage.ts`.

## Critérios de aceite (§11 + §14.5) — checklist de validação final
1–14: ver `docs/PROMPT-backend.md`. Maioria validada (ver itens ✅ acima); CA #11 on-chain confirmado na Base Sepolia.
