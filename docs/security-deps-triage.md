# Triagem de dependências (VEX) — Direto ao Ponto

Registro de **exploitability** dos avisos do `npm audit`: o que foi corrigido, o que não
se aplica ao nosso uso e por quê. É o "bilhete assinado" — o scanner aponta a falha
*teórica* da lib; aqui dizemos como ela se comporta **no nosso código**.

> Sinal honesto de produção: `npm run audit` (= `npm audit --omit=dev`) — mostra só o que
> realmente sobe pro servidor. Ferramentas de build/dev não contam (não são deployadas).

Última revisão: 2026-06-16.

| Pacote | Aviso | Onde | Veredito | Ação |
|---|---|---|---|---|
| **ws** (8.0.0–8.20.1) | mem disclosure + DoS (GHSA-58qx, GHSA-96hv) | runtime (direta + via ethers) | **CORRIGIDO** | `ws` direta → `^8.21.0` + `overrides: {"ws":"$ws"}` força a cópia de dentro do `ethers` p/ 8.21.0. `npm ls ws` = só 8.21.0. |
| **drizzle-orm** (<0.45.2) | SQL injection via **identificadores** mal escapados (GHSA-gpj5-g38j-94v9) | runtime (produção) | **NÃO EXPLORÁVEL** no nosso uso | Mantido 0.31.x **por ora**; upgrade real agendado (ver abaixo). |
| **solc / tmp** | path traversal no `tmp` (GHSA-52f5, GHSA-ph9p) | **dev-only** (compila o `AnchorRegistry.sol`) | **NÃO SOBE** | Fora do bundle de produção; roda só em `scripts/deploy-anchor.mjs`, local, com input nosso. |
| **esbuild / outros dev** | avisos diversos | **dev-only** (`tsx`, `drizzle-kit`) | **NÃO SOBE** | Ferramentas de build; não fazem parte do runtime. |

## Justificativa — drizzle-orm (por que não explorável aqui)
A falha (GHSA-gpj5-g38j-94v9) ocorre quando o **nome de identificador** (coluna/tabela)
é montado a partir de input do usuário via API de identifier dinâmico do Drizzle.
No nosso código **todo SQL é parametrizado** com tagged template (`sql\`... ${valor} ...\``),
onde `${}` entra sempre como **valor bind**, nunca como identificador. Não usamos
`sql.identifier(userInput)` nem concatenação de nomes de coluna/tabela com input.
Conferido no pentest SAST de 2026-06-15 (`SECURITY-AUDIT-2026-06-15.md`, seção "SQL").
→ Exploração no nosso contexto: **nula**. O upgrade é higiene/futuro, não buraco aberto.

## Upgrade real do Drizzle (agendado — não é "fix de uma linha")
`drizzle-orm@0.45.2` exige `@neondatabase/serverless ≥0.10` (temos 0.9.5). Ou seja, puxa
**dois majors** (`drizzle-orm` 0.31→0.45 **e** o driver `@neondatabase/serverless` 0.9→1.x),
mexendo na **camada de conexão do banco** (`src/db/index.ts` usa `Pool` + `neon-serverless`
+ `neonConfig.webSocketConstructor`). Exige:
1. `npm i drizzle-orm@latest @neondatabase/serverless@latest drizzle-kit@latest`
2. revisar release notes (API de `Pool`/`drizzle`/migrações),
3. `npm run typecheck && npm run build`,
4. **smoke real contra o Neon** (boot + 1 sync + 1 apuração + 1 anchor),
5. re-rodar `npm run audit` (esperado: 0 high).
Tratar como tarefa dedicada e testada (ver `TODO.md` → PT-008).

## Como auditar
- `npm run audit` — sinal de produção (o que importa).
- `npm audit` — completo (inclui dev; use só pra revisar a tabela acima).
- Quando houver CI: gate com `audit-ci` + allowlist citando estes advisory IDs.
