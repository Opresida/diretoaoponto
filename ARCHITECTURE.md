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

## Frontend (já especificado no PROMPT — fora deste scaffold)

- `RecorteRegional.jsx` (§7) — Dashboard, consome `apuracao.governo` do WS.
- `CapturaFotos.jsx` (§8) — App, entre consentimento e questionário.
- `ReciboEntrevista.jsx` (§14.3) — tela de recibo com QR.
- `Verificar.jsx` (§14.4) — portal público `/v/:code`.
- `tokens.css` + `tailwind.config.js` (§14.5) — design system unificado (dark slate + emerald).
