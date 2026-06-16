# Relatório de Pentest (Caixa-Branca / SAST) — Direto ao Ponto

**Data:** 2026-06-15 · **Tipo:** SAST caixa-branca (código local, não-destrutivo) · **Alvo:** `backend/` (Node20+TS+Express+Drizzle/Neon+ws+R2+JWT+ethers) + 5 apps Vite/React.
**Autorização:** solicitada pelo dono (Humberto / MAZARI Holding), alvo localhost/código local.
**Motivação:** a plataforma vai operar com **dados sensíveis** — PII de eleitores (GPS, foto, áudio), **sigilo do voto** e LGPD.

> ⚠️ Este relatório **não contém valores de segredos**. Onde um segredo é citado, só o nome da variável aparece.

## Sumário executivo

| Severidade | Qtd |
|---|---|
| 🔴 Crítico | 1 |
| 🟠 Alto | 7 |
| 🟡 Médio | 8 |
| 🟢 Baixo | 5 |
| 📦 Dependências (npm audit) | 9 (4 high, 4 moderate, 1 low) |

**Top 3 urgentes:** `PT-001` (quebra do sigilo do voto), `PT-002` (segredos reais em texto claro no `.env` — rotacionar), `PT-005`/`PT-006` (sem rate-limit + sem CORS/Helmet).

**Veredito:** a base tem **fundações sólidas** (RBAC com teamScope bem aplicado, SQL 100% parametrizado, convites uso-único com CSPRNG, mídia privada por presigned URL com TTL 10min, sem backdoor/bypass, error handler não vaza stack). Os problemas são **corrigíveis e localizados** — mas **PT-001 precisa ser resolvido antes de coletar dados reais**, pois viola o sigilo do voto.

---

## 🔴 CRÍTICO

### PT-001 — Quebra do sigilo do voto: voto individual exposto (WS + REST)
**CVSS 8.1** · `backend/src/routes/sync.ts` (broadcast) + `backend/src/services/aggregation.ts` (`scopedApuracao.recent`)
O broadcast do WebSocket (`interview:new`) e o feed "recentes" do `/api/apuracao/scoped` enviam, **por entrevista**, o candidato escolhido (`govVote`/`gov_vote`) junto de `interviewer + area/zona + perfil (sexo·faixa) + timestamp`. Qualquer cliente conectado (piso = `statistician`) e qualquer gerente (na própria zona) consegue ligar **uma pessoa ao seu voto** — numa zona/cota pequena, o trio área+perfil+horário é impressão digital de um eleitor real.
**Impacto:** violação direta do voto secreto + LGPD (dado sensível). Para uma pesquisa eleitoral isso é o risco número 1.
**Correção:** remover `govVote`/`gov_vote` de **todo** payload por-entrevista (WS broadcast e `recent`). Esses canais devem trafegar só agregados + metadados não-voto (contador, perfil, duração, flags). O voto individual nunca deve sair de nenhuma API de leitura.

---

## 🟠 ALTO

### PT-002 — Segredos reais de produção em texto claro no `.env`
**CVSS 9.1 (mitigado)** · `backend/.env`
O arquivo contém credenciais **vivas** (DATABASE_URL/Neon, S3/R2 access+secret, REDIS/Upstash, JWT_SECRET, JWT_REFRESH_SECRET, HASH_SALT, ANCHOR_PRIVATE_KEY).
**Mitigações já presentes:** `.env` está no `.gitignore`, **nunca foi commitado** (histórico limpo), e a chave blockchain é carteira descartável de testnet. Por isso o risco *atual* é menor que o CVSS bruto.
**Risco residual:** vazamento local (backup/screenshare/malware) = comprometimento total (banco de votos+PII, mídia LGPD, forja de JWT admin, e com `HASH_SALT` vazado dá pra recalcular hashes válidos e burlar a detecção de adulteração).
**Correção:** (1) **rotacionar** todos esses segredos antes de qualquer ambiente compartilhado/produção; (2) em prod usar secret manager do provedor (não arquivo); (3) `ANCHOR_PRIVATE_KEY` de prod em KMS/HSM ou signer remoto.

### PT-003 — JWT sem algoritmo fixado (`algorithms`)
**CVSS 8.1** · `backend/src/middleware/auth.ts`, `backend/src/ws/apuracao.ts`
Nenhum `jwt.verify` passa `{ algorithms: ["HS256"] }` — anti-padrão que abre espaço a confusão de algoritmo.
**Correção:** fixar `algorithms: ["HS256"]` nos 3 pontos de verify + `algorithm:"HS256"` no sign + guard de boot que falha se `JWT_SECRET`/`JWT_REFRESH_SECRET`/`HASH_SALT` ausentes ou < 32 bytes.

### PT-004 — Presigned/`storageKey` sem vínculo de posse (IDOR/overwrite no bucket)
**CVSS 8.1** · `backend/src/routes/uploads.ts`, `backend/src/routes/sync.ts` (`photos[].storageKey` é `z.string()` livre, gravado direto), `backend/src/services/storage.ts`
Um entrevistador autenticado pode (a) gerar PUT presign para o UUID de **outra** entrevista (key determinística → sobrescrever áudio/foto alheio antes do selo) e (b) no sync mandar uma `storageKey` apontando para **qualquer** objeto do bucket, que depois é servido por presigned GET na auditoria. Não há path traversal (key é UUID/objeto), mas é **referência de objeto não confiável** (adulteração da cadeia de custódia).
**Correção:** reconstruir a key no servidor a partir de `clientUuid+seq` (ignorar a enviada) ou validar `startsWith(\`${clientUuid}/\`)`; vincular o presign à posse do entrevistador; bloquear PUT em entrevista já sincronizada/selada; adicionar allowlist de prefixo em `storage.ts`.

### PT-005 — Sem rate-limit em login/refresh/convite (brute-force)
**CVSS 7.5** · `backend/src/server.ts`, `backend/src/routes/auth.ts`
Nenhum throttle em `/api/auth/login`, `/refresh`, `/api/public/invites/:token/accept`. Com e-mails previsíveis (`admin@…`) e senhas-semente fracas (ver PT-013), brute-force é trivial.
**Correção:** `express-rate-limit` (5–10 tentativas/IP+e-mail/15min) com store Redis (já há Upstash) nessas rotas; backoff/lockout por conta; subir bcrypt cost p/ 12.

### PT-006 — Sem CORS allowlist e sem Helmet
**CVSS 7.5** · `backend/src/server.ts`
Só há `express.json({limit:"2mb"})`. Faltam `helmet()` (HSTS, nosniff, X-Frame-Options/CSP) e `cors()` com allowlist das origens legítimas. Relevante p/ `/api/reports/:id/pdf` (inline) e `/api/candidates/:id/photo` (302).
**Correção:** `app.use(helmet())` + `cors({ origin: [PUBLIC_PORTAL_ORIGIN, <origens admin/campo>], credentials:false })`. Manter limite de 2mb (ou apertar `/sync` p/ ~1mb).

### PT-007 — SSRF + open redirect no proxy público de foto de candidato
**CVSS 7.2** · `backend/src/routes/candidates.ts` (`publicCandidatePhotoRouter` `GET /:id/photo`)
Rota **pública** faz `res.redirect(302, c.photo_url)` para URL absoluta arbitrária (validada só como `.url()`). Open redirect a partir de domínio confiável; vira SSRF se algum componente server-side buscar essa URL.
**Correção:** não redirecionar p/ URL externa arbitrária — proxiar com allowlist de host (https, sem ranges privados/link-local) ou exigir foto no R2 (`photo_key`) e remover o redirect.

### PT-008 — Dependências com CVE alto (drizzle-orm, ws via ethers)
**npm audit: 4 high / 4 moderate / 1 low**
- `drizzle-orm < 0.45.2` — **SQL injection via identificadores mal escapados** (GHSA-gpj5-g38j-94v9). *Exploração baixa neste código* (não usamos a API de identifier dinâmico; tudo é valor parametrizado), mas deve ser atualizado.
- `ws 8.0.0–8.20.1` (transitiva via `ethers`) — divulgação de memória + DoS por fragmentos.
**Correção:** atualizar `drizzle-orm` p/ ≥0.45.2 e revisar a cadeia `ethers`→`ws` (testar — são breaking). Rodar `npm audit` no CI.

---

## 🟡 MÉDIO

- **PT-009 — De-anonimização por célula pequena** (`aggregation.ts`): agregados por zona/cota retornam contagem crua sem supressão de célula mínima; `votes=1` numa zona pequena identifica o eleitor. → suprimir/bucketizar contagens `< 5`.
- **PT-010 — Anexo do relatório re-identifica** (`reportPdf.ts`/`reportService.ts`): a "lista completa de entrevistas" no PDF traz recibo+área+perfil+timestamp (quase-identificador). PDF é admin-only (bom), mas se sair do círculo + canal de voto = re-identificação. → coarsen/aggregate por cota com supressão, ou marcar confidencial.
- **PT-011 — Recibo determinístico/linkável** (`receipt.ts`): `sha256(clientUuid)` sem salt; mesmo `clientUuid` é prefixo da key de mídia → recibo↔mídia mutuamente deriváveis. → HMAC com `HASH_SALT` e desacoplar key de mídia do `clientUuid`.
- **PT-012 — Refresh token sem rotação/revogação** (`auth.ts`): refresh de 30d não rotaciona nem tem denylist/`jti`; sem logout; mudança de papel só vale após expirar o access (15min). (Positivo: `/refresh` relê `active` do banco.) → `jti` + rotação + `token_version` por usuário; revalidar papel no banco em mutações sensíveis.
- **PT-013 — Senha-semente `senha123` p/ todas as contas** (`seed.ts`): admin incluso, e-mails previsíveis. → senha aleatória por conta (ou `SEED_ADMIN_PASSWORD` via env), bloquear seed fora de dev, forçar reset no 1º login.
- **PT-014 — Convite (admin) sem validação de input** (`invites.ts`): POST sem Zod; `managerId`/`stratumId` aceitos sem checar existência/escopo. → schema Zod (`.uuid()`, enum) + validar que `managerId` é manager e `stratumId` é do projeto ativo.
- **PT-015 — Enumeração de usuário por timing no login** (`auth.ts`): e-mail inexistente retorna sem rodar `bcrypt.compare` (corpo é uniforme, mas o tempo vaza). → comparar sempre contra hash dummy.
- **PT-016 — Sem validação de env no boot** (`auth.ts`): `process.env.JWT_SECRET!` falha por-request, não no boot. → validar env (Zod) na inicialização.

## 🟢 BAIXO

- **PT-017 — Política de senha fraca** (`min(8)`, sem complexidade) — `users.ts`/`invites.ts`. → ≥12 / zxcvbn / rejeitar senhas vazadas p/ contas com acesso a PII.
- **PT-018 — Race no código do entrevistador** (`usersService.ts`): `ENT-XXXX` via COUNT (TOCTOU) → conflito raro vira erro confuso. → sequência no banco ou retry no `23505`.
- **PT-019 — `scenario` sem enum** (`apuracao.ts`/`aggregation.ts`): não é injeção (parametrizado), só input livre. → `z.enum([...])`.
- **PT-020 — Rate-limit do `/verify` in-memory** (`verify.ts`): `Map` por-IP, não distribuído, sem `trust proxy`, cresce sem limpeza. → `express-rate-limit` + store Redis + `trust proxy`.
- **PT-021 — Sem allowlist de prefixo em `storage.ts`** (defensivo): `presignGet`/`getObject` aceitam key arbitrária do banco. → regex de prefixo permitido.

---

## ✅ Controles que estão OK (verificados)

- **RBAC com teamScope bem aplicado** — gerente **não** acessa entrevistas/mídia/checagem/relatórios de outra equipe (IDOR fechado nos pontos checados).
- **Sem escalonamento de privilégio** — gerente não cria admin; não existe rota para um usuário mudar o próprio papel/equipe; `managerId` é forçado a `me.id` p/ gerente.
- **Convites uso-único race-safe** — `randomBytes(24)` (192 bits CSPRNG), `FOR UPDATE` + `UPDATE ... WHERE used_at IS NULL`, expiração 7d, papel vindo da linha do convite (não do body).
- **SQL 100% parametrizado** (Drizzle tagged templates) — sem `sql.raw`/concatenação; filtros dinâmicos seguros.
- **Mídia privada** — nunca pública; só presigned GET com TTL 600s; `/interviews/:id/media` com scope de equipe.
- **WebSocket autenticado** no handshake (JWT, piso `statistician`) — o problema é o *conteúdo* (PT-001), não a auth.
- **`/api/verify` não vaza** voto/PII/GPS — resposta é objeto explícito só com status/integridade.
- **Sem backdoor/bypass de auth**, sem `NODE_ENV`-skip, sem token hardcoded; **error handler não vaza stack**; **nenhum segredo em `console.log`**; **idempotência do sync** robusta (UUID único + transação atômica).

---

## Plano de remediação priorizado

1. **PT-001** — tirar o voto individual do WS e do `recent` (antes de coletar dados reais). *Quick win, alto impacto.*
2. **PT-002** — rotacionar segredos + plano de secret manager p/ prod.
3. **PT-005 + PT-006 + PT-003** — helmet + CORS + rate-limit + fixar algoritmo JWT + guard de env (pacote "hardening de boot", ~1 PR).
4. **PT-004** — vincular `storageKey` à posse / reconstruir no servidor.
5. **PT-007** — matar SSRF/redirect da foto pública.
6. **PT-008** — atualizar deps (drizzle/ws) com teste de regressão.
7. **PT-009/010/011** — privacidade estatística (supressão de célula, anexo, recibo salgado).
8. Restante (médio/baixo) conforme capacidade.

_Findings consolidados em `docs/security-findings.json`._
