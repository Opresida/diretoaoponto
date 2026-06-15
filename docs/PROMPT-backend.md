# PROMPT PARA ANTIGRAVITY — Backend da Plataforma de Pesquisa Eleitoral

> **Instrução para o agente:** Você vai construir o backend completo de uma plataforma de pesquisa eleitoral (coleta de campo + apuração em tempo real), integrado ao banco **Neon (PostgreSQL serverless)** já existente. O frontend (App de Campo do entrevistador + Dashboard de Apuração do coordenador) já existe em React e os trechos novos estão neste documento. Siga as especificações abaixo à risca. Gere código de produção: tipado, com validação Zod, tratamento de erros e migrations versionadas.

---

## 1. CONTEXTO DO SISTEMA

Plataforma para instituto de pesquisa eleitoral (modelo: pesquisa registrada TSE AM-05275/2026, 1.200 entrevistas, Manaus + 14 municípios do interior do Amazonas, amostragem PPT).

**Fluxo:** Entrevistador usa PWA offline-first → realiza entrevista (triagem de cota, consentimento LGPD, questionário com rotação de candidatos, gravação de áudio, GPS, **até 3 fotos do entrevistado** — exigência de auditoria do instituto) → sincroniza quando online → backend valida, grava no Neon, agrega votos → publica via WebSocket → Dashboard de Apuração atualiza em tempo real com **recorte Manaus × Interior**.

**Regras de negócio críticas:**
1. Sincronização **idempotente** (campo pode reenviar; `client_uuid` único evita duplicatas).
2. Cada entrevista pertence a um estrato com `region` (`manaus` | `interior`) — base do recorte da apuração.
3. Senado tem **2 votos por eleitor** (1º e 2º, não podem ser o mesmo candidato). Apuração em duas bases: consolidada (100%) e alcance (200%).
4. Máximo **3 fotos** por entrevista (constraint no banco + validação na API).
5. Fotos e áudios vão para object storage privado (R2/S3) via **presigned URL**; o banco guarda apenas a key. LGPD: consentimento registrado, retenção 5 anos, acesso restrito a `supervisor+`.
6. Flags antifraude: duração < 90s, GPS fora do polígono, fotos ausentes → entram na fila de checagem prioritária (mínimo 20% por entrevistador).
7. Parciais de apuração são **uso interno** — endpoint protegido por role `coordinator+`.
8. **Hierarquia de cadastro:** admin cria gerentes (`manager`); gerente cria **somente** entrevistadores (com `manager_id` = ele próprio) e só enxerga/gerencia a própria equipe. Detalhes na seção 12.
9. **Integridade blockchain:** cada entrevista gera hash SHA-256 **no dispositivo** antes do sync; o backend reconcilia e ancora lotes via Merkle root na rede **Base**. A blockchain SELA a estrutura antifraude existente — não a substitui. Detalhes na seção 13.

---

## 2. STACK OBRIGATÓRIA

- **Runtime:** Node.js 20+ · TypeScript
- **Framework:** Express
- **Banco:** Neon PostgreSQL — driver `@neondatabase/serverless` (Pool) + **Drizzle ORM** + drizzle-kit para migrations
- **Tempo real:** `ws` (WebSocket nativo)
- **Validação:** Zod
- **Storage:** Cloudflare R2 ou S3 (SDK `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- **Filas:** BullMQ + Redis (Upstash) para pós-processamento (transcodificação de áudio, watermark de fotos, recálculo de agregados)
- **Auth:** JWT (access 15min + refresh), bcrypt, RBAC por middleware

### Variáveis de ambiente (.env)
```env
DATABASE_URL=postgres://...@...neon.tech/pesquisa?sslmode=require
JWT_SECRET=
JWT_REFRESH_SECRET=
S3_ENDPOINT=
S3_BUCKET=pesquisa-midia
S3_ACCESS_KEY=
S3_SECRET_KEY=
REDIS_URL=
PORT=3000
```

---

## 3. SCHEMA SQL COMPLETO (Neon)

```sql
CREATE TYPE user_role AS ENUM ('admin','manager','coordinator','statistician','supervisor','interviewer','client');
CREATE TYPE region_t AS ENUM ('manaus','interior');
CREATE TYPE interview_status AS ENUM ('synced','approved','rejected','pending_check');
CREATE TYPE check_result AS ENUM ('approved','rejected');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  registration_code TEXT UNIQUE,          -- ex.: ENT-0147
  manager_id UUID REFERENCES users(id),   -- entrevistador → seu gerente (NOT NULL p/ role interviewer)
  created_by UUID REFERENCES users(id),   -- quem cadastrou (trilha da hierarquia)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_manager ON users(manager_id);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                      -- "Onda Mar/2026"
  tse_registration TEXT NOT NULL,          -- "AM-05275/2026"
  tse_registration_federal TEXT,           -- "BR-06624/2026"
  sample_size INT NOT NULL,                -- 1200
  margin_error NUMERIC(4,2) NOT NULL,      -- 3.00
  confidence NUMERIC(4,2) NOT NULL,        -- 95.00
  field_start DATE, field_end DATE,
  status TEXT NOT NULL DEFAULT 'field',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE strata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,                      -- "Manaus · Norte" | "Interior · Manacapuru"
  region region_t NOT NULL,
  zone TEXT,                               -- Norte/Leste/Oeste/Centro-Oeste/Centro-Sul/Sul
  municipality TEXT NOT NULL,
  target INT NOT NULL,
  census_polygon JSONB,                    -- GeoJSON do setor p/ validação de GPS
  UNIQUE(project_id, name)
);

CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  label TEXT NOT NULL,                     -- "Mulher · 25–44"
  sex CHAR(1) NOT NULL,                    -- F | M | X (qualquer)
  age_min INT NOT NULL, age_max INT NOT NULL,
  target INT NOT NULL,
  completed INT NOT NULL DEFAULT 0,
  UNIQUE(stratum_id, label)
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  interviewer_id UUID NOT NULL REFERENCES users(id),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  date DATE NOT NULL,
  UNIQUE(interviewer_id, stratum_id, date)
);

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  party TEXT,
  office TEXT NOT NULL,                    -- 'governor' | 'senator' | 'president' | ...
  color TEXT,                              -- hex p/ dashboard
  UNIQUE(name, office)
);

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid UUID UNIQUE NOT NULL,        -- gerado no app offline → idempotência
  project_id UUID NOT NULL REFERENCES projects(id),
  interviewer_id UUID NOT NULL REFERENCES users(id),
  stratum_id UUID NOT NULL REFERENCES strata(id),
  quota_id UUID NOT NULL REFERENCES quotas(id),
  respondent_sex CHAR(1) NOT NULL,
  respondent_age INT NOT NULL CHECK (respondent_age >= 16),
  consent_lgpd BOOLEAN NOT NULL,
  consent_photo BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_sec INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (ended_at - started_at))::INT) STORED,
  gps_start JSONB NOT NULL,                -- {lat,lng,accuracy}
  gps_end JSONB NOT NULL,
  audio_key TEXT,                          -- key no R2/S3
  status interview_status NOT NULL DEFAULT 'synced',
  fraud_flags JSONB NOT NULL DEFAULT '[]', -- ["short_duration","gps_outside","missing_photos"]
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interviews_project ON interviews(project_id, synced_at DESC);
CREATE INDEX idx_interviews_interviewer ON interviews(interviewer_id);

CREATE TABLE answers (
  id BIGSERIAL PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,             -- 'gov_spont','gov_c1','sen_v1','sen_v2','rejection_gov','know_omar','eval_wilson'
  candidate_id UUID REFERENCES candidates(id),
  value_text TEXT,                         -- p/ espontânea ou escalas
  UNIQUE(interview_id, question_code)
);
CREATE INDEX idx_answers_question ON answers(question_code, candidate_id);

CREATE TABLE interview_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  seq SMALLINT NOT NULL CHECK (seq BETWEEN 1 AND 3),   -- máx 3 fotos
  storage_key TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL,
  gps JSONB,
  UNIQUE(interview_id, seq)
);

CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES interviews(id),
  supervisor_id UUID REFERENCES users(id),
  method TEXT,                             -- 'in_loco' | 'audio'
  result check_result,
  reason TEXT,
  checked_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT, entity_id TEXT,
  meta JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. DRIZZLE — Conexão Neon

```ts
// src/db/index.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

Gere `src/db/schema.ts` em Drizzle espelhando fielmente o SQL acima e configure `drizzle.config.ts` com `dialect: "postgresql"` apontando para `DATABASE_URL`.

---

## 5. API — Contrato completo

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | renova access token |

### Campo (role: interviewer)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/field/package` | Pacote do dia: estrato designado, cotas restantes, questionário, polígono GPS |
| POST | `/api/uploads/presign` | `{kind:'photo'\|'audio', interviewClientUuid, seq?}` → `{uploadUrl, storageKey}` (PUT direto no R2/S3) |
| POST | `/api/sync/interviews` | **Batch idempotente** — corpo abaixo |

**Payload do sync (Zod):**
```ts
const SyncSchema = z.object({
  interviews: z.array(z.object({
    clientUuid: z.string().uuid(),
    stratumId: z.string().uuid(),
    quotaId: z.string().uuid(),
    respondent: z.object({ sex: z.enum(["F","M"]), age: z.number().int().min(16) }),
    consentLgpd: z.literal(true),
    consentPhoto: z.boolean(),
    startedAt: z.string().datetime(), endedAt: z.string().datetime(),
    gpsStart: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }),
    gpsEnd: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }),
    audioKey: z.string().optional(),
    photos: z.array(z.object({
      seq: z.number().int().min(1).max(3),
      storageKey: z.string(),
      takenAt: z.string().datetime(),
      gps: z.object({ lat: z.number(), lng: z.number() }).optional(),
    })).max(3),                                    // ← máximo 3 fotos
    answers: z.array(z.object({
      questionCode: z.string(),
      candidateName: z.string().optional(),
      valueText: z.string().optional(),
    })),
  })).min(1).max(50),
});
```

**Lógica do sync (transação por entrevista):**
1. `ON CONFLICT (client_uuid) DO NOTHING` → se já existe, retorna `duplicate: true`.
2. Valida regra do Senado: `sen_v1 !== sen_v2` (exceto Branco/Nulo/NS-NR).
3. Calcula `fraud_flags`: `duration_sec < 90` → `short_duration`; GPS fora do polígono do estrato → `gps_outside`; `consentPhoto=true` e `photos.length===0` → `missing_photos`.
4. Incrementa `quotas.completed` (com `WHERE completed < target`, senão rejeita por cota cheia).
5. Resolve `candidateName → candidate_id` (cria se espontânea inédita, marcada p/ pós-codificação).
6. Sorteia entrada na fila de checagem (garantir mínimo 20% por entrevistador; flags = prioridade).
7. **Publica no WebSocket** o evento de apuração (seção 6).
8. Enfileira jobs BullMQ: `photo:watermark` (timestamp+GPS na imagem), `audio:transcode`.

### Apuração (role: coordinator+)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/apuracao/governo?scenario=c1&recorte=total\|manaus\|interior` | Ranking ao vivo |
| GET | `/api/apuracao/senado?base=100\|200&recorte=...` | Consolidado 2 votos |
| GET | `/api/apuracao/resumo` | KPIs: total, por estrato, flags, checagem |

**Query do recorte (Governo, exemplo):**
```sql
SELECT c.name, c.color, COUNT(*) AS votes,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM answers a
JOIN interviews i ON i.id = a.interview_id AND i.status != 'rejected'
JOIN strata s ON s.id = i.stratum_id
JOIN candidates c ON c.id = a.candidate_id
WHERE a.question_code = 'gov_c1'
  AND ($1::region_t IS NULL OR s.region = $1)   -- recorte manaus/interior/total
GROUP BY c.id ORDER BY votes DESC;
```

### Supervisão (role: supervisor+)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/checks/queue` | Fila priorizada (flags primeiro) |
| GET | `/api/interviews/:id/media` | Presigned GETs de áudio + fotos (auditoria) |
| POST | `/api/checks/:id/result` | `{result, reason?}` → reprovação decrementa cota e dispara reposição |

---

## 6. WEBSOCKET — Apuração em tempo real

Endpoint: `wss://.../ws/apuracao?token=JWT` (valida role `coordinator+` no handshake).

A cada entrevista sincronizada com sucesso, broadcast:
```json
{
  "type": "interview:new",
  "interview": { "id": "E-2101", "interviewer": "Carlos M.", "area": "Cidade Nova",
                 "region": "manaus", "profile": "Mulher 25–44", "durationSec": 247,
                 "flags": [], "govVote": "David Almeida" },
  "apuracao": {
    "governo": {
      "total":   [ { "name": "David Almeida", "votes": 168, "pct": 32.4, "color": "#34d399" } ],
      "manaus":  [ ... ],
      "interior":[ ... ]
    },
    "senado": { "total": [ ... ], "manaus": [ ... ], "interior": [ ... ] },
    "progress": { "done": 521, "target": 1200, "manaus": {"done":402,"target":876}, "interior": {"done":119,"target":324} }
  }
}
```
Mantenha o agregado em cache (Redis) e recalcule incrementalmente — não rode a query completa a cada evento; faça full-refresh a cada 60s para reconciliar.

---

## 7. FRONTEND — CÓDIGO NOVO 1: Recorte Manaus × Interior (Dashboard)

Adicionar ao Dashboard de Apuração. Componente completo — consome o objeto `apuracao.governo` do WebSocket:

```jsx
// src/components/RecorteRegional.jsx
import { useState } from "react";
import { Crown, MapPin } from "lucide-react";

export default function RecorteRegional({ apuracao }) {
  const [recorte, setRecorte] = useState("total"); // total | manaus | interior
  const abas = [["total","Amazonas"],["manaus","Manaus"],["interior","Interior"]];
  const dados = apuracao?.governo?.[recorte] ?? [];
  const candidatos = dados.filter(c => !["Branco/Nulo","NS/NR"].includes(c.name));

  // onde cada um lidera (comparação lado a lado)
  const liderM = apuracao?.governo?.manaus?.[0];
  const liderI = apuracao?.governo?.interior?.[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm">Governo · Recorte regional</span>
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {abas.map(([v,l]) => (
            <button key={v} onClick={() => setRecorte(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                recorte === v ? "bg-emerald-600 text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {dados.map((c, i) => {
          const isCand = !["Branco/Nulo","NS/NR"].includes(c.name);
          return (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5">
                  <span className={`w-5 font-bold ${i===0 && isCand ? "text-emerald-300":"text-slate-500"}`}>
                    {isCand ? `${i+1}º` : "—"}</span>
                  <span className={i===0 && isCand ? "text-emerald-200 font-semibold":"text-slate-300"}>{c.name}</span>
                  {i===0 && isCand && <Crown size={12} className="text-emerald-300" />}
                </span>
                <span className="tabular-nums font-bold" style={{color: c.color}}>{c.pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                     style={{width: `${c.pct}%`, background: c.color, opacity: isCand ? 1 : .5}} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Onde cada região aponta */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[["Manaus", liderM], ["Interior", liderI]].map(([rotulo, l]) => l && (
          <div key={rotulo} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-1 text-slate-400 mb-1"><MapPin size={11}/>{rotulo} — liderando</div>
            <div className="font-bold text-emerald-200">{l.name}</div>
            <div style={{color: l.color}} className="font-bold tabular-nums">{l.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
      {candidatos.length > 0 && Math.abs(candidatos[0].pct - (candidatos[1]?.pct ?? 0)) <= 3 && (
        <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2">
          ⚠ Empate técnico neste recorte (diferença dentro da margem de erro ±3 p.p.)
        </div>
      )}
    </div>
  );
}
```

---

## 8. FRONTEND — CÓDIGO NOVO 2: Captura de até 3 fotos (App de Campo)

Etapa inserida **entre o consentimento e o questionário** (a foto exige autorização específica). Componente completo:

```jsx
// src/components/CapturaFotos.jsx
import { useState, useRef } from "react";
import { Camera, X, CheckCircle2, AlertTriangle, MapPin, Clock } from "lucide-react";

const MAX_FOTOS = 3;

export default function CapturaFotos({ gps, onConcluir, onPular }) {
  const [fotos, setFotos] = useState([]);          // [{dataUrl, takenAt, gps}]
  const [consentFoto, setConsentFoto] = useState(null);
  const inputRef = useRef(null);

  const capturar = (e) => {
    const file = e.target.files?.[0];
    if (!file || fotos.length >= MAX_FOTOS) return;
    const reader = new FileReader();
    reader.onload = () => {
      // watermark (timestamp + GPS) desenhado em canvas
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const stamp = `${new Date().toLocaleString("pt-BR")} · ${gps?.lat?.toFixed(5)}, ${gps?.lng?.toFixed(5)}`;
        ctx.font = `${Math.max(14, img.width * 0.022)}px monospace`;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(0, img.height - img.width * 0.05, img.width, img.width * 0.05);
        ctx.fillStyle = "#fff";
        ctx.fillText(stamp, 12, img.height - img.width * 0.016);
        setFotos(f => [...f, { dataUrl: cv.toDataURL("image/jpeg", 0.8),
                               takenAt: new Date().toISOString(), gps }]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const remover = (i) => setFotos(f => f.filter((_, idx) => idx !== i));

  return (
    <div className="p-4 space-y-4">
      {consentFoto === null && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-100 mb-2">Leia para o entrevistado:</p>
          <p>"Por exigência de auditoria do instituto, precisamos registrar até 3 fotos
          suas durante a entrevista. As imagens são confidenciais, usadas apenas para
          comprovar a realização da entrevista, e serão eliminadas após o prazo legal.
          O(a) sr(a). autoriza?"</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => { setConsentFoto(false); onPular(); }}
              className="py-3 rounded-xl bg-slate-800 text-slate-300">Não autorizou</button>
            <button onClick={() => setConsentFoto(true)}
              className="py-3 rounded-xl bg-emerald-600 text-white font-semibold">Autorizou</button>
          </div>
        </div>
      )}

      {consentFoto && (<>
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2].map(i => fotos[i] ? (
            <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-emerald-700">
              <img src={fotos[i].dataUrl} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
              <button onClick={() => remover(i)}
                className="absolute top-1 right-1 bg-rose-600 rounded-full p-1"><X size={12}/></button>
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-emerald-300 px-1 py-0.5 flex items-center gap-1">
                <CheckCircle2 size={9}/> Foto {i+1}
              </div>
            </div>
          ) : (
            <button key={i} disabled={i !== fotos.length}
              onClick={() => inputRef.current?.click()}
              className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center
                justify-center gap-1 text-xs ${i === fotos.length
                ? "border-emerald-600 text-emerald-400 bg-emerald-900/10"
                : "border-slate-800 text-slate-600"}`}>
              <Camera size={20}/> Foto {i+1}
            </button>
          ))}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
               onChange={capturar} className="hidden" />
        <div className="text-xs text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock size={11}/>timestamp</span>
          <span className="flex items-center gap-1"><MapPin size={11}/>GPS no carimbo</span>
          <span>{fotos.length}/{MAX_FOTOS}</span>
        </div>
        {fotos.length === 0 && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded-lg p-2 flex gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5"/>
            Sem fotos, a entrevista recebe flag "missing_photos" e vai para checagem prioritária.
          </div>
        )}
        <button onClick={() => onConcluir(fotos)} disabled={fotos.length === 0}
          className={`w-full py-4 rounded-2xl font-semibold ${fotos.length
            ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-600"}`}>
          Continuar para o questionário ({fotos.length} foto{fotos.length !== 1 ? "s" : ""})
        </button>
      </>)}
    </div>
  );
}
```

**Integração no fluxo do app:** `consentimento → CapturaFotos → questionário → finalizar`. No `finalizar`, para cada foto: pedir presign (`POST /api/uploads/presign {kind:'photo', seq}`), `PUT` do blob na URL, e incluir `{seq, storageKey, takenAt, gps}` no payload do sync. Offline: guardar dataUrl no IndexedDB e subir na sincronização.

---

## 9. ESTRUTURA DE PASTAS ESPERADA

```
backend/
├── src/
│   ├── db/ (index.ts, schema.ts, migrations/)
│   ├── routes/ (auth.ts, field.ts, sync.ts, uploads.ts, apuracao.ts, checks.ts)
│   ├── ws/apuracao.ts
│   ├── jobs/ (photoWatermark.ts, audioTranscode.ts, reconcile.ts)
│   ├── middleware/ (auth.ts, rbac.ts, errors.ts)
│   ├── services/ (fraudFlags.ts, quotaService.ts, aggregation.ts, storage.ts)
│   └── server.ts
├── drizzle.config.ts
├── seed.ts            ← projeto AM-05275/2026, estratos (6 zonas + 14 municípios), cotas, candidatos
└── .env.example
```

## 10. SEED OBRIGATÓRIO

Popular: projeto "Onda Mar/2026" (1.200, ±3 p.p., 95%); estratos de Manaus por zona (Norte 204, Leste 298, Oeste 134, Centro-Oeste 67, Centro-Sul 86, Sul 87) e interior 324 distribuído nos 14 municípios; candidatos Governo (David Almeida, Tadeu de Souza, Omar Aziz, Prof. Maria do Carmo) e Senado (Eduardo Braga, Cap. Alberto Neto, Marcelo Ramos, Plínio Valério, Marcos Rotta, Wilson Lima, Del. Costa e Silva); 1 usuário por role para testes.

## 11. CRITÉRIOS DE ACEITE

1. `POST /api/sync/interviews` reenviado 2× com o mesmo `client_uuid` grava apenas 1 registro.
2. Entrevista com 4 fotos é rejeitada com erro 422.
3. `GET /api/apuracao/governo?recorte=interior` retorna apenas votos de estratos `region='interior'`.
4. Sync de entrevista válida dispara evento WebSocket em < 500ms com agregados dos 3 recortes.
5. Entrevista com `duration_sec < 90` aparece em `/api/checks/queue` no topo.
6. Reprovação de checagem decrementa `quotas.completed` e muda status para `rejected` (sai da apuração).
7. Fotos/áudios nunca são públicos: somente presigned GET com role `supervisor+`, expiração 10 min.
8. Gerente que tenta criar usuário com role ≠ `interviewer` recebe 403.
9. Gerente A não consegue listar, editar ou ver produção de entrevistadores do gerente B.
10. Alterar 1 byte de uma `answer` após o sync faz `GET /api/verify/:id` acusar divergência de hash.
11. Após o job de ancoragem, toda entrevista do lote possui `merkle_proof` válida contra a raiz registrada on-chain (verificável no block explorer da Base).

---

## 12. HIERARQUIA DE CADASTRO — admin → gerente → entrevistador

**Regras de RBAC:**

| Ação | admin | manager |
|---|---|---|
| Criar `manager` | ✔ | ✖ (403) |
| Criar `interviewer` | ✔ (qualquer equipe) | ✔ somente com `manager_id` = ele próprio |
| Listar/editar usuários | todos | apenas `WHERE manager_id = :self` |
| Ver produção/checagem | global | apenas da própria equipe |

**Endpoints:**
- `POST /api/users` — admin: qualquer role; manager: força `role='interviewer'` e `manager_id=req.user.id` (ignora valores enviados no body).
- `GET /api/team` — manager: lista própria equipe com produção do dia; admin: aceita `?managerId=` para auditar qualquer equipe.
- `PATCH /api/users/:id/active` — desativação respeita o mesmo escopo.

**Middleware de escopo (aplicar em TODAS as rotas de equipe, produção, checagem e fila):**
```ts
export function teamScope(req, _res, next) {
  req.teamFilter = req.user.role === "manager"
    ? { managerId: req.user.id }      // gerente: só a própria equipe
    : {};                              // admin/coordinator: global
  next();
}
```

A regra dos 20% de checagem passa a ser apurada **também por equipe**: o dashboard do gerente mostra taxa de checagem e reprovação dos seus entrevistadores, criando responsabilização em cascata.

**Seed atualizado:** 1 admin geral → 2 gerentes → 3 entrevistadores por gerente (com `manager_id` e `created_by` preenchidos).

---

## 13. MÓDULO DE INTEGRIDADE BLOCKCHAIN (Base)

**Princípio inegociável:** a blockchain prova que o dado **não foi alterado após a coleta** — ela não prova que o dado é verdadeiro. A veracidade vem do antifraude (GPS, áudio, fotos, duração, checagem 20%). Este módulo **lacra** essa estrutura ponta a ponta. Comunicação pública: "integridade verificável da coleta ao resultado", nunca "pesquisa infalível".

### 13.1 Alterações de schema
```sql
ALTER TABLE interviews
  ADD COLUMN payload_hash TEXT,            -- SHA-256 calculado NO DISPOSITIVO
  ADD COLUMN device_hashed_at TIMESTAMPTZ, -- momento do hash no app
  ADD COLUMN anchor_id UUID,
  ADD COLUMN merkle_proof JSONB;           -- prova de inclusão na raiz

CREATE TABLE anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  merkle_root TEXT NOT NULL,
  interview_count INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  chain TEXT NOT NULL DEFAULT 'base',
  tx_hash TEXT,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | failed
  anchored_at TIMESTAMPTZ
);
ALTER TABLE interviews ADD CONSTRAINT fk_anchor FOREIGN KEY (anchor_id) REFERENCES anchors(id);
```

### 13.2 Hash no dispositivo (App de Campo) — janela zero de adulteração
O hash nasce no app, na finalização da entrevista, **antes** de qualquer contato com o servidor:
```ts
// no app, ao finalizar a entrevista (Web Crypto API, funciona offline)
import { canonicalize } from "json-canonicalize"; // JSON canônico = hash determinístico

const payload = {
  clientUuid, answers, gpsStart, gpsEnd, startedAt, endedAt,
  photoHashes: await Promise.all(photos.map(p => sha256(p.blob))),
  audioHash: audioBlob ? await sha256(audioBlob) : null,
};
const payloadHash = await sha256(canonicalize(payload) + PROJECT_SALT);
// payloadHash + deviceHashedAt entram no corpo do sync
```
**No backend (dentro da transação do sync):** recalcular o hash a partir do payload recebido e comparar com o enviado. Divergência → `fraud_flags += 'hash_mismatch'` e entrevista vai para checagem prioritária (indica adulteração em trânsito ou app modificado).

### 13.3 Ancoragem por Merkle root (job BullMQ, cron a cada hora)
Nunca 1 transação por entrevista — 1 raiz por lote (custo: centavos/dia na Base):
```ts
// src/jobs/anchorBatch.ts
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "ethers";

// 1. SELECT entrevistas com payload_hash e anchor_id IS NULL
// 2. tree = new MerkleTree(hashes, keccak256, { sortPairs: true })
// 3. tx → contrato AnchorRegistry na Base: anchor(root, count)
// 4. INSERT anchors (root, tx_hash, block_number, status='confirmed')
// 5. UPDATE cada entrevista: anchor_id + merkle_proof = tree.getHexProof(hash)
```
Contrato mínimo `contracts/AnchorRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AnchorRegistry {
    event Anchored(bytes32 indexed root, uint256 count, uint256 timestamp);
    address public immutable institute;
    constructor() { institute = msg.sender; }
    function anchor(bytes32 root, uint256 count) external {
        require(msg.sender == institute, "unauthorized");
        emit Anchored(root, count, block.timestamp);
    }
}
```

### 13.4 Verificação pública
- `GET /api/verify/:interviewId` (público, sem dados pessoais) → `{ payloadHash, merkleProof, merkleRoot, txHash, blockNumber, explorerUrl }` — qualquer auditor reconstrói a prova off-chain.
- **Portal de verificação** (página pública simples): cola-se o ID do recibo da entrevista → o sistema mostra a prova de inclusão e o link da transação no explorer da Base. O recibo com o ID pode ser entregue ao entrevistado ao final ("sua entrevista está selada e auditável").

### 13.5 LGPD
On-chain vai **apenas a raiz de Merkle** — nenhum dado, nenhum hash individual de campo pessoal isolado. O `payload_hash` usa salt por projeto (`HASH_SALT`), impedindo ataques de dicionário. A eliminação de dados off-chain (direito do titular) não quebra a âncora: o hash órfão não revela nada.

### 13.6 Variáveis de ambiente adicionais
```env
BASE_RPC_URL=https://mainnet.base.org
ANCHOR_PRIVATE_KEY=
ANCHOR_CONTRACT_ADDRESS=
HASH_SALT=
```

**Estrutura de pastas — acrescentar:** `src/jobs/anchorBatch.ts`, `src/routes/verify.ts`, `src/services/merkle.ts`, `contracts/AnchorRegistry.sol`.

---

## 14. RECIBO DE VERIFICAÇÃO — Especificação completa (front + back)

### 14.1 Geração do código (backend + app)

Código curto, legível e sem dado pessoal, derivado do `client_uuid` (determinístico → funciona **offline** no app e o backend chega ao mesmo código):

```ts
// src/services/receipt.ts — mesma função no app e no backend
import { createHash } from "crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // base32 sem 0/O/1/I/L (anti-confusão)

export function receiptCode(clientUuid: string, year: number): string {
  const h = createHash("sha256").update(clientUuid).digest();
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[h[i] % 32];
  return `DAP-${year}-${out.slice(0, 4)}-${out.slice(4)}`;   // DAP-2026-7K3M-9XQ2
}
```

Schema: `ALTER TABLE interviews ADD COLUMN receipt_code TEXT UNIQUE;` — preenchido no sync (backend recalcula a partir do `client_uuid`; colisão, embora improvável, resolve com sufixo incremental).

### 14.2 Endpoint público de verificação

`GET /api/verify/:code` — **sem autenticação**, rate-limited (20 req/min/IP), retorna SOMENTE dados não pessoais:

```ts
// Estados possíveis (campo "status"):
type VerifyResponse =
  | { status: "not_found" }
  | { status: "pending_anchor";              // sincronizada, aguardando job de ancoragem
      registeredAt: string }                  // ex.: "2026-03-03T14:27:00-04:00"
  | { status: "sealed_valid";                 // os 3 checks verdes
      registeredAt: string,
      anchoredAt: string,
      txHash: string, blockNumber: number,
      explorerUrl: string,                    // https://basescan.org/tx/...
      technical: {                            // modo auditor
        payloadHash: string,
        merkleRoot: string,
        merkleProof: string[],
        contract: string, chain: "base"
      } }
  | { status: "integrity_failed";             // prova de Merkle não fecha → alerta público
      registeredAt: string, anchoredAt: string, txHash: string };
```

**Lógica:** localizar entrevista por `receipt_code` → se `anchor_id IS NULL` → `pending_anchor` → senão, **reverificar em tempo real**: reconstruir a prova (`merkle_proof` + `payload_hash`) contra a `merkle_root` da âncora. Prova válida → `sealed_valid`; inválida → `integrity_failed` (e alerta interno crítico para o admin).

### 14.3 Tela do recibo no App de Campo (após finalizar)

Dependência: `qrcode.react`. Componente completo:

```jsx
// src/components/ReciboEntrevista.jsx
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, Copy, Share2, Clock } from "lucide-react";

export default function ReciboEntrevista({ code, portalUrl }) {
  const url = `${portalUrl}/v/${code}`;
  const copiar = () => navigator.clipboard?.writeText(url);
  const compartilhar = () => navigator.share?.({
    title: "Recibo da sua entrevista",
    text: `Sua entrevista foi registrada e será selada em blockchain. Verifique: ${url}`,
  });

  return (
    <div className="card p-5 text-center">
      <ShieldCheck size={32} className="text-emerald-400 mx-auto mb-2" />
      <h2 className="text-base font-bold text-slate-100">Recibo de verificação</h2>
      <p className="text-xs text-slate-400 mt-1 mb-4">
        Entregue ao entrevistado. Não contém respostas nem dados pessoais.
      </p>
      <div className="bg-white rounded-2xl p-4 inline-block">
        <QRCodeSVG value={url} size={148} level="M" />
      </div>
      <div className="font-mono text-lg font-bold tracking-wider text-emerald-300 mt-4">{code}</div>
      <div className="flex items-center justify-center gap-1 text-[11px] text-amber-300 mt-2">
        <Clock size={11} /> Selo blockchain em até 1 hora após a sincronização
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={copiar} className="btn-secondary"><Copy size={14} /> Copiar link</button>
        <button onClick={compartilhar} className="btn-primary"><Share2 size={14} /> Enviar</button>
      </div>
    </div>
  );
}
```

### 14.4 Portal público de verificação (página `/v/:code`)

```jsx
// portal/src/pages/Verificar.jsx
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock, CheckCircle2, ExternalLink, ChevronDown } from "lucide-react";

const Check = ({ ok, children }) => (
  <div className={`check-row ${ok ? "check-ok" : "check-pending"}`}>
    {ok ? <CheckCircle2 size={18} /> : <Clock size={18} />}<span>{children}</span>
  </div>
);

export default function Verificar({ code }) {
  const [r, setR] = useState(null);
  const [tec, setTec] = useState(false);
  useEffect(() => { fetch(`/api/verify/${code}`).then(x => x.json()).then(setR); }, [code]);

  if (!r) return <div className="page"><div className="card p-6 text-slate-400">Verificando…</div></div>;

  const dt = (s) => new Date(s).toLocaleString("pt-BR");

  return (
    <div className="page">
      <div className="card p-6 max-w-md w-full">
        <div className="text-center mb-5">
          {r.status === "integrity_failed"
            ? <ShieldAlert size={40} className="text-rose-400 mx-auto" />
            : <ShieldCheck size={40} className="text-emerald-400 mx-auto" />}
          <h1 className="text-lg font-bold mt-2">Verificação de entrevista</h1>
          <div className="font-mono text-sm text-emerald-300 mt-1">{code}</div>
        </div>

        {r.status === "not_found" && (
          <p className="text-sm text-slate-300 text-center">Código não encontrado. Confira a digitação.</p>
        )}

        {r.status === "pending_anchor" && (<>
          <Check ok>Sua entrevista foi registrada em {dt(r.registeredAt)}</Check>
          <Check ok={false}>Aguardando selo blockchain — concluído em até 1 hora</Check>
          <Check ok={false}>Verificação de integridade disponível após o selo</Check>
        </>)}

        {r.status === "sealed_valid" && (<>
          <Check ok>Sua entrevista foi registrada em {dt(r.registeredAt)}</Check>
          <Check ok>Selada na blockchain em {dt(r.anchoredAt)}</Check>
          <Check ok>Conteúdo íntegro — nenhuma alteração desde a coleta</Check>
          <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full mt-4">
            Ver transação na Base <ExternalLink size={13} />
          </a>
          <button onClick={() => setTec(t => !t)} className="tec-toggle">
            Modo auditor <ChevronDown size={13} className={tec ? "rotate-180" : ""} />
          </button>
          {tec && (
            <pre className="tec-box">{JSON.stringify(r.technical, null, 2)}</pre>
          )}
        </>)}

        {r.status === "integrity_failed" && (
          <div className="alert-fail">
            A prova de integridade desta entrevista <strong>falhou</strong>. O registro foi
            alterado após o selo ou há inconsistência nos dados. O instituto foi notificado
            automaticamente.
          </div>
        )}

        <p className="text-[11px] text-slate-500 text-center mt-5">
          Esta página não exibe respostas nem dados pessoais. O voto é sigiloso.
        </p>
      </div>
    </div>
  );
}
```

### 14.5 Design system unificado (CSS) — usar em App, Dashboard e Portal

```css
/* styles/tokens.css — fonte única de verdade visual */
:root {
  --bg:        #020617;   /* slate-950 */
  --surface:   #0f172a;   /* slate-900 */
  --surface-2: #1e293b;   /* slate-800 */
  --border:    #1e293b;
  --text:      #f1f5f9;   /* slate-100 */
  --muted:     #94a3b8;   /* slate-400 */
  --primary:   #10b981;   /* emerald-500 */
  --primary-2: #34d399;   /* emerald-400 */
  --warn:      #fbbf24;   /* amber-400 */
  --danger:    #fb7185;   /* rose-400 */
  --radius:    16px;
  --radius-lg: 20px;
  --font: ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", monospace;
}

body { background: var(--bg); color: var(--text); font-family: var(--font); }

.page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.btn-primary, .btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 16px; border-radius: var(--radius);
  font-size: 13px; font-weight: 600; transition: filter .15s;
}
.btn-primary   { background: var(--primary); color: #fff; }
.btn-secondary { background: var(--surface-2); color: var(--text); border: 1px solid #334155; }
.btn-primary:hover, .btn-secondary:hover { filter: brightness(1.12); }

.check-row {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px; border-radius: var(--radius); font-size: 14px; margin-bottom: 8px;
}
.check-ok      { background: rgba(16,185,129,.10); border: 1px solid rgba(16,185,129,.45); color: #d1fae5; }
.check-ok svg  { color: var(--primary-2); flex-shrink: 0; margin-top: 1px; }
.check-pending { background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.35); color: #fde68a; }
.check-pending svg { color: var(--warn); flex-shrink: 0; margin-top: 1px; }

.alert-fail {
  background: rgba(251,113,133,.10); border: 1px solid rgba(251,113,133,.5);
  color: #fecdd3; border-radius: var(--radius); padding: 14px; font-size: 14px; line-height: 1.5;
}

.tec-toggle {
  display: flex; align-items: center; gap: 4px; margin: 14px auto 0;
  font-size: 12px; color: var(--muted);
}
.tec-toggle svg { transition: transform .2s; }
.tec-box {
  margin-top: 10px; padding: 12px; border-radius: var(--radius);
  background: #020617; border: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 11px; color: var(--primary-2);
  overflow-x: auto; max-height: 260px;
}
```

```js
// tailwind.config.js — espelha os tokens (App e Dashboard usam Tailwind)
export default {
  theme: { extend: {
    colors: {
      bg: "#020617", surface: "#0f172a", "surface-2": "#1e293b",
      primary: { DEFAULT: "#10b981", light: "#34d399" },
      warn: "#fbbf24", danger: "#fb7185",
    },
    borderRadius: { card: "20px", el: "16px" },
  }},
};
```

**Critérios de aceite adicionais:**
12. `GET /api/verify/:code` de entrevista recém-sincronizada retorna `pending_anchor`; após o job, `sealed_valid` com prova reconstruível.
13. A resposta pública nunca contém respostas, nome, fotos, áudio, GPS exato ou perfil do entrevistado.
14. O mesmo `client_uuid` gera o mesmo `receipt_code` no app (offline) e no backend.