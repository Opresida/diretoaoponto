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
- 🟡 Middleware auth JWT (`requireAuth`) — falta sign/refresh (§5)
- ✅ Middleware rbac (`requireRole`, `requireAnyRole`, `teamScope`, §12)
- ⬜ `POST /api/auth/login` + `/refresh` (bcrypt)
- ⬜ `POST /api/users` + `GET /api/team` + `PATCH /api/users/:id/active` (§12) → CA #8, #9

## Coleta de campo
- ⬜ `GET /api/field/package` (estrato, cotas, questionário, polígono)
- ⬜ `POST /api/uploads/presign` (services/storage pronto)
- ✅ Zod `SyncSchema` (§5)
- ⬜ Lógica do sync (10 passos: idempotência, senado, flags, cota, candidatos, hash, recibo, WS, jobs)
- ⬜ `computeFraudFlags` (point-in-polygon p/ gps_outside)
- ⬜ `tryIncrementQuota` / `decrementQuota`

## Apuração
- ⬜ `apuracaoGoverno` / `apuracaoSenado` / `resumo` (recortes total/manaus/interior; senado 100/200)
- 🟡 WebSocket handshake + broadcast (`src/ws/apuracao.ts`) — falta cache Redis + reconcile 60s (§6)

## Supervisão
- ⬜ `GET /api/checks/queue` (flags primeiro, short_duration no topo → CA #5)
- ⬜ `POST /api/checks/:id/result` (reprovação decrementa cota + reposição → CA #6)
- ⬜ `GET /api/interviews/:id/media` (presigned GET 10min, supervisor+ → CA #7)

## Integridade blockchain (Base)
- ✅ `AnchorRegistry.sol` (§13.3)
- ✅ Helpers Merkle (`buildTree`/`proofHex`/`verifyProof`)
- ✅ `receiptCode` determinístico (§14.1)
- ⬜ Recalc de hash no sync (`recomputeHash` + HASH_SALT → flag `hash_mismatch`, §13.2)
- ⬜ Job `anchorBatch` (cron horário, ethers, INSERT anchors + UPDATE merkle_proof, §13.3)
- ⬜ Deploy do contrato na Base + setar `ANCHOR_CONTRACT_ADDRESS`
- ⬜ `GET /api/verify/:code` + `/id/:interviewId` (4 estados, reverificação real, §14.2/§13.4)

## Filas
- ⬜ Configurar Queues/Workers BullMQ (photo:watermark, audio:transcode, reconcile, anchor:batch)

## Seed
- 🟡 `seed.ts` — esqueleto; falta inserir projeto/estratos/cotas/candidatos/hierarquia (§10, §12)

## Frontend (especificado, fora deste scaffold)
- ⬜ `RecorteRegional.jsx` (§7) · `CapturaFotos.jsx` (§8) · `ReciboEntrevista.jsx` (§14.3) · `Verificar.jsx` (§14.4) · design tokens (§14.5)

## Critérios de aceite (§11 + §14.5) — checklist de validação final
1–14: ver `docs/PROMPT-backend.md`. Nenhum validado ainda (lógica pendente).
