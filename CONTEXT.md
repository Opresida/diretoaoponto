# CONTEXT — Direito ao Ponto

## O que é
Plataforma de pesquisa eleitoral de intenção de voto, para instituto de pesquisa. Dois apps (Campo + Apuração) sobre um backend Neon, com diferencial de **integridade verificável** ancorada em blockchain (Base) — comunicação pública sempre como *"integridade verificável da coleta ao resultado"*, **nunca** "pesquisa infalível".

## Por que existe
A blockchain prova que o dado **não foi alterado após a coleta**; a veracidade vem do antifraude (GPS, áudio, até 3 fotos, duração mínima, checagem ≥20%). A âncora apenas lacra essa estrutura ponta a ponta, gerando um recibo público auditável entregue ao entrevistado.

## Regras de negócio críticas (resumo — detalhe no PROMPT)
1. Sync idempotente por `client_uuid`.
2. `region` (manaus|interior) é a base do recorte da apuração.
3. Senado: 2 votos (1º ≠ 2º); bases 100% e 200%.
4. Máx 3 fotos (constraint no banco + API).
5. Mídia em storage privado (presigned URL); banco guarda só a key; LGPD: retenção 5 anos, acesso supervisor+.
6. Flags antifraude (< 90s, GPS fora, fotos ausentes) → fila de checagem (mín 20%/entrevistador).
7. Parciais = uso interno (coordinator+).
8. Hierarquia admin → gerente → entrevistador (gerente só cria/vê a própria equipe).
9. Hash SHA-256 no dispositivo → Merkle root ancorado na Base.

## Stack & decisões
Node 20 + TS + Express + Drizzle/Neon + ws + Zod + S3/R2 + BullMQ/Redis + JWT/bcrypt + ethers/merkletreejs. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

## Estado atual
Scaffold base do backend criado (estrutura, schema, migration, contrato, helpers, stubs). Lógica de negócio pendente — ver [TODO.md](TODO.md). Repo oficial: https://github.com/Opresida/diretoaoponto.git

## Convenções
- Briefing canônico: `docs/PROMPT-backend.md`. Em dúvida de comportamento, ele manda.
- Stubs retornam HTTP 501 com `{ ref: "PROMPT §..." }` apontando a seção a implementar.
- Cada arquivo de stub tem comentário `// TODO §X` com o que falta.
