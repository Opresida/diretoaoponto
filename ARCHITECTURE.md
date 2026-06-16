# ARCHITECTURE — Direito ao Ponto

## Visão geral do fluxo

```
App de Campo (PWA offline)
  triagem cota → consentimento LGPD → CapturaFotos (≤3) → questionário (rotação)
  → áudio + GPS → hash SHA-256 NO DISPOSITIVO (§13.2) → recibo (§14)
        │  (offline: IndexedDB)
        ▼ quando online
  POST /api/uploads/presign  → PUT fotos/áudio direto no R2/S3
  POST /api/sync/interviews  → batch idempotente (client_uuid único)
        │
        ▼  backend (transação por entrevista)
  valida → fraud_flags → cota → resolve candidatos → recalcula hash → receipt_code
        │
        ├── broadcast WebSocket  → Dashboard de Apuração (recorte Manaus×Interior)
        ├── BullMQ: photo:watermark, audio:transcode
        └── (cron horário) anchor:batch → Merkle root → contrato AnchorRegistry (Base)
                                                              │
  Portal público /v/:code  ◄── GET /api/verify/:code (reverifica prova de Merkle)
```

## Camadas (backend)

| Pasta | Responsabilidade |
|---|---|
| `src/db` | Conexão Neon + schema Drizzle + migrations |
| `src/routes` | Contrato HTTP (auth, field, uploads, sync, apuracao, checks, interviews, users/team, verify) |
| `src/ws` | WebSocket de apuração (handshake coordinator+) |
| `src/services` | Regras: fraudFlags, quotaService, aggregation, storage, merkle, receipt |
| `src/jobs` | BullMQ: photoWatermark, audioTranscode, reconcile, anchorBatch |
| `src/middleware` | auth (JWT), rbac (roles + teamScope), errors |
| `contracts` | `AnchorRegistry.sol` (Base) |

## Decisões-chave

1. **Idempotência por `client_uuid`** — reenvio de sync não duplica (CA #1).
2. **Recorte regional** é dimensão de primeira classe: `strata.region` ∈ {manaus, interior}.
3. **Senado = 2 votos** (sen_v1 ≠ sen_v2); apuração em base 100% (consolidada) e 200% (alcance).
4. **Mídia nunca pública** — só presigned URL; banco guarda apenas a key; GET de auditoria expira em 10 min, role supervisor+.
5. **Hierarquia** admin → manager → interviewer com `teamScope` (gerente só vê a própria equipe).
6. **Blockchain SELA, não prova veracidade** — hash nasce no dispositivo; ancoragem por Merkle root em lote (1 tx/lote). On-chain vai só a raiz (LGPD).
7. **Recibo determinístico** — `receiptCode(client_uuid, year)` idêntico no app (offline) e no backend (CA #14). Bug do §14.1 corrigido (`% 32` num alfabeto de 31 chars gerava `undefined`; agora `% ALPHABET.length`) — **a cópia do app precisa do mesmo fix**.
8. **Dois hashes, dois propósitos** (decisão sobre §13.2/§13.3):
   - *Hash de dispositivo* (`recomputeHash`, §13.2): recalculado a partir do payload recebido e comparado ao enviado → flag `hash_mismatch` (adulteração **em trânsito** / app modificado). Exige `photoHashes`/`audioHash` no payload.
   - *Hash de conteúdo* (`contentHash`): computado server-side só sobre campos persistidos e reconstruíveis do banco (normalizado: epoch ms, answers ordenadas). É **este** que vira folha da Merkle e que o `/verify` recalcula contra o banco — permitindo detectar adulteração **pós-sync** (CA #10). O hash de dispositivo cru não é reconstruível do banco (não guardamos blobs), por isso não serve de folha verificável.
9. **Ancoragem com fallback local** — `runAnchorBatch` faz a tx on-chain na Base quando há `ANCHOR_PRIVATE_KEY`+`ANCHOR_CONTRACT_ADDRESS`; senão grava a âncora em modo `local` (raiz + provas, sem tx). `/verify` reconstrói a prova igual nos dois modos; só o link do explorer (CA #11) depende do deploy real.
10. **Questionário configurável por estrato** (migration `0005_questions.sql` + `questions` no schema) — cascata **aditiva** via coluna `stratum_ids uuid[]` (`null` = global; senão herda nos estratos listados). O app de campo recebe as perguntas montadas pelo backend (`field.ts`, query `q.stratum_ids && ARRAY[...]::uuid[]`). `is_core` marca o **núcleo de voto** (protegido: tentativa de remover → 409). Extras (escala/múltipla/aberta) são agregados em `services/aggregation.ts::apuracaoExtra` (`unnest(string_to_array(...))`), expostos no Admin (builder `Questionarios.jsx`) e espelhados read-only no Dashboard do gerente.

## Frontend (já especificado no PROMPT — fora deste scaffold)

- `RecorteRegional.jsx` (§7) — Dashboard, consome `apuracao.governo` do WS.
- `CapturaFotos.jsx` (§8) — App, entre consentimento e questionário.
- `ReciboEntrevista.jsx` (§14.3) — tela de recibo com QR.
- `Verificar.jsx` (§14.4) — portal público `/v/:code`.
- `tailwind.config.js` + CSS por app — **identidade oficial** (2026-06-15): paleta carmim `#A81824` (substitui o slate+emerald do §14.5). Tema híbrido: **portal claro** (público); **campo/admin/gerente/checagem escuros** com acento carmim. `emerald` é remapeado p/ carmim no Tailwind (recolore estados ativos sem editar componente a componente). Assets de marca em `*/public/` (logo + favicon + ícones PWA), gerados por `backend/scripts/gen-brand-assets.mjs` (sharp) a partir de `backend/assets/logo-src.png`.

## Materiais comerciais (fora do produto)

Material de marketing — **não** altera o produto; assinado como produto **MAZARI Corp** (www.mazaricorp.com).

- **Deck PDF (paisagem)** — `backend/scripts/gen-pitch-deck.mjs` (pdfkit, A4 landscape `[842,595]`; truque `margins.bottom = 0` p/ não gerar páginas em branco). Embute prints reais (dados mockados) de `backend/assets/deck/*.png`. Saída em `docs/Apresentacao-DiretoAoPonto-MAZARI.pdf` (gitignored, regenerável).
- **Vídeo animado 9:16** — estúdio **Remotion** standalone em `C:\Users\user\remotion-studio` (`src/dap/`): cenas + componentes (BlockchainChain, PanZoom, contadores, carimbo), narração **ElevenLabs "Brian"** (`public/dap/audio/`, geradas por `_gen_eleven.py`) + trilha/SFX sintetizados (`sfx/_gen_sfx.py`). Composições `DiretoAoPonto` (~2m28s) e `DiretoAoPonto-Social` (~43s). Roteiro-prompt: `remotion-studio/ROTEIRO-direto-ao-ponto.md`. **Repo local separado, sem remote.**

## Segurança

Pentest SAST (caixa-branca) em 2026-06-15 — relatório completo em [`docs/SECURITY-AUDIT-2026-06-15.md`](docs/SECURITY-AUDIT-2026-06-15.md) e consolidado em `docs/security-findings.json`.

**Controles OK (verificados):** RBAC com `teamScope` (gerente isolado à própria equipe), SQL 100% parametrizado (Drizzle), convites uso-único CSPRNG, mídia privada por presigned URL (TTL 10min), `/verify` não vaza voto/PII, WS autenticado, error handler sem stack trace, sem backdoor/bypass, `.env` gitignored (nunca commitado).

**A corrigir antes de coletar dados reais (ver TODO):** 🔴 **PT-001** — o voto individual vaza no broadcast WS e no `scopedApuracao.recent` (sigilo do voto). 🟠 rotacionar segredos, hardening de boot (helmet+CORS+rate-limit+JWT alg+env guard), vínculo de posse no upload, SSRF do proxy de foto, upgrade de deps (drizzle/ws). Princípio: **nenhuma API de leitura pode retornar o voto individual**; agregados com supressão de célula mínima.
