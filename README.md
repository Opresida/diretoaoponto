# Direto ao Ponto

Plataforma de **pesquisa eleitoral de intenção de voto** — coleta de campo offline-first + apuração em tempo real, com **integridade verificável da coleta ao resultado** (selo blockchain na rede Base).

> Modelo de referência: pesquisa registrada TSE AM-05275/2026 · 1.200 entrevistas · Manaus + 14 municípios do interior do Amazonas · amostragem PPT.

## Componentes

- **App de Campo (PWA offline-first)** — entrevistador: triagem de cota → consentimento LGPD → captura de até 3 fotos → questionário com rotação de candidatos → áudio + GPS → sync idempotente.
- **Dashboard de Apuração** — coordenador: ranking ao vivo via WebSocket, com recorte **Manaus × Interior**.
- **Backend** (esta etapa) — Neon (Postgres serverless) + Drizzle + Express + WebSocket + storage R2/S3 + filas BullMQ + módulo de integridade blockchain (Base) + portal público de verificação.

## Stack

Node 20 · TypeScript · Express · Drizzle ORM (`@neondatabase/serverless`) · `ws` · Zod · `@aws-sdk/client-s3` · BullMQ + Redis · JWT/bcrypt (RBAC) · ethers + merkletreejs (Base).

## Status

🟡 **Scaffold base** — estrutura de pastas, schema Drizzle completo, migration SQL inicial, contrato `AnchorRegistry.sol`, helpers de recibo/merkle/storage e stubs de rotas/serviços/jobs com TODO apontando a seção do PROMPT. **Lógica de negócio ainda não implementada.** Ver [TODO.md](TODO.md).

## Rodar (backend)

```bash
cd backend
cp .env.example .env   # preencher DATABASE_URL, JWT_*, S3_*, REDIS_URL, BASE_*
npm install
npm run db:migrate     # aplica migrations no Neon
npm run seed           # popula projeto/estratos/cotas/candidatos/usuários (§10, §12)
npm run dev            # API em http://localhost:3000
```

Especificação completa: `docs/PROMPT-backend.md` (cópia do briefing original).
