# PROJECT_CONTEXT — Direito ao Ponto

| | |
|---|---|
| **Nome** | Direito ao Ponto |
| **Tipo** | Plataforma de pesquisa eleitoral (intenção de voto) |
| **Vínculo** | Projeto próprio / standalone (ecossistema MAZARI Holding) |
| **Local** | `C:\Users\user\diretoaoponto` |
| **Repo oficial** | https://github.com/Opresida/diretoaoponto.git |
| **Briefing** | `docs/PROMPT-backend.md` |
| **Cadastrado em** | 2026-06-15 |

## Stack
Backend: Node 20 · TypeScript · Express · Drizzle ORM + Neon (`@neondatabase/serverless`) · `ws` · Zod · S3/R2 · BullMQ + Redis · JWT/bcrypt · ethers + merkletreejs (Base).
Frontend (já existe em React, snippets no PROMPT): App de Campo (PWA) + Dashboard de Apuração + Portal público de verificação.

## Como rodar (backend)
```bash
cd backend && cp .env.example .env   # preencher segredos
npm install && npm run db:migrate && npm run seed && npm run dev   # API :3000
```
NÃO abrir browser embutido (Humberto usa ANTIGRAVITY) — apenas informar a URL.

## Integrações externas a provisionar
- **Neon** — banco `diretoaoponto` (`DATABASE_URL`).
- **R2/S3** — bucket `pesquisa-midia` (mídia privada).
- **Redis/Upstash** — filas BullMQ.
- **Base** — deploy de `AnchorRegistry.sol`, `ANCHOR_PRIVATE_KEY` + `ANCHOR_CONTRACT_ADDRESS`.

## Estado
Backend + 5 apps funcionais e testados (sync/apuração/checagem/convites/relatório selado/ancoragem on-chain). Identidade oficial aplicada (carmim + logo + timbre, 2026-06-15). Pentest SAST concluído — backlog de correções (1 crítico) em [TODO.md](TODO.md) e `docs/SECURITY-AUDIT-2026-06-15.md`. Atualizar este arquivo e o TODO após cada funcionalidade aprovada.
