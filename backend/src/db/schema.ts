// Drizzle schema — espelha o SQL do PROMPT §3, com as colunas de
// integridade blockchain (§13) e o receipt_code (§14) já incorporados.
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  bigserial,
  boolean,
  numeric,
  date,
  char,
  timestamp,
  jsonb,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── ENUMs ───────────────────────────────────────────────────────────
export const userRole = pgEnum("user_role", [
  "admin",
  "manager",
  "coordinator",
  "statistician",
  "supervisor",
  "interviewer",
  "client",
]);
export const regionT = pgEnum("region_t", ["manaus", "interior"]);
export const interviewStatus = pgEnum("interview_status", [
  "synced",
  "approved",
  "rejected",
  "pending_check",
]);
export const checkResultEnum = pgEnum("check_result", ["approved", "rejected"]);

// ─── users ───────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    registrationCode: text("registration_code").unique(), // ex.: ENT-0147
    managerId: uuid("manager_id"), // entrevistador → seu gerente (NOT NULL p/ interviewer, enforçado na API)
    stratumId: uuid("stratum_id"), // zona/município que o gerente representa (apenas managers)
    createdBy: uuid("created_by"), // quem cadastrou (trilha da hierarquia)
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    managerIdx: index("idx_users_manager").on(t.managerId),
  }),
);

// ─── projects ────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Onda Mar/2026"
  tseRegistration: text("tse_registration").notNull(), // "AM-05275/2026"
  tseRegistrationFederal: text("tse_registration_federal"), // "BR-06624/2026"
  sampleSize: integer("sample_size").notNull(), // 1200
  marginError: numeric("margin_error", { precision: 4, scale: 2 }).notNull(), // 3.00
  confidence: numeric("confidence", { precision: 4, scale: 2 }).notNull(), // 95.00
  fieldStart: date("field_start"),
  fieldEnd: date("field_end"),
  status: text("status").notNull().default("field"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── strata ──────────────────────────────────────────────────────────
export const strata = pgTable(
  "strata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    name: text("name").notNull(), // "Manaus · Norte" | "Interior · Manacapuru"
    region: regionT("region").notNull(),
    zone: text("zone"), // Norte/Leste/Oeste/Centro-Oeste/Centro-Sul/Sul
    municipality: text("municipality").notNull(),
    municipalityId: uuid("municipality_id"), // catálogo de municípios (interior); Manaus/zonas = null
    target: integer("target").notNull(),
    censusPolygon: jsonb("census_polygon"), // GeoJSON p/ validação de GPS
  },
  (t) => ({
    uq: unique("strata_project_name_uq").on(t.projectId, t.name),
  }),
);

// ─── municipalities (catálogo dos 62 do AM; cadastrar = vira área de pesquisa) ─
export const municipalities = pgTable(
  "municipalities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    name: text("name").notNull(),
    region: regionT("region").notNull(), // manaus (só Manaus) | interior
    inResearch: boolean("in_research").notNull().default(false),
    target: integer("target"), // null até entrar na pesquisa
    stratumId: uuid("stratum_id").references(() => strata.id), // estrato gerado quando in_research
  },
  (t) => ({
    uq: unique("municipalities_project_name_uq").on(t.projectId, t.name),
  }),
);

// ─── quotas ──────────────────────────────────────────────────────────
export const quotas = pgTable(
  "quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stratumId: uuid("stratum_id").notNull().references(() => strata.id),
    label: text("label").notNull(), // "Mulher · 25–44"
    sex: char("sex", { length: 1 }).notNull(), // F | M | X
    ageMin: integer("age_min").notNull(),
    ageMax: integer("age_max").notNull(),
    target: integer("target").notNull(),
    completed: integer("completed").notNull().default(0),
  },
  (t) => ({
    uq: unique("quotas_stratum_label_uq").on(t.stratumId, t.label),
  }),
);

// ─── assignments ─────────────────────────────────────────────────────
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    interviewerId: uuid("interviewer_id").notNull().references(() => users.id),
    stratumId: uuid("stratum_id").notNull().references(() => strata.id),
    date: date("date").notNull(),
  },
  (t) => ({
    uq: unique("assignments_uq").on(t.interviewerId, t.stratumId, t.date),
  }),
);

// ─── candidates ──────────────────────────────────────────────────────
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    party: text("party"),
    office: text("office").notNull(), // 'governor' | 'senator' | 'president' | ...
    color: text("color"), // hex p/ dashboard
    photoKey: text("photo_key"), // R2: candidates/{id}.jpg
    photoUrl: text("photo_url"), // URL externa
  },
  (t) => ({
    uq: unique("candidates_name_office_uq").on(t.name, t.office),
  }),
);

// ─── interviews ──────────────────────────────────────────────────────
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientUuid: uuid("client_uuid").notNull().unique(), // idempotência (gerado offline)
    projectId: uuid("project_id").notNull().references(() => projects.id),
    interviewerId: uuid("interviewer_id").notNull().references(() => users.id),
    stratumId: uuid("stratum_id").notNull().references(() => strata.id),
    quotaId: uuid("quota_id").notNull().references(() => quotas.id),
    respondentSex: char("respondent_sex", { length: 1 }).notNull(),
    respondentAge: integer("respondent_age").notNull(),
    consentLgpd: boolean("consent_lgpd").notNull(),
    consentPhoto: boolean("consent_photo").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    // duration_sec é GENERATED ALWAYS no banco — ver migration 0000. Aqui só leitura.
    durationSec: integer("duration_sec"),
    gpsStart: jsonb("gps_start").notNull(), // {lat,lng,accuracy}
    gpsEnd: jsonb("gps_end").notNull(),
    audioKey: text("audio_key"),
    status: interviewStatus("status").notNull().default("synced"),
    fraudFlags: jsonb("fraud_flags").notNull().default(sql`'[]'::jsonb`),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    // ── §13 integridade blockchain ──
    payloadHash: text("payload_hash"), // SHA-256 calculado NO DISPOSITIVO
    deviceHashedAt: timestamp("device_hashed_at", { withTimezone: true }),
    anchorId: uuid("anchor_id").references(() => anchors.id),
    merkleProof: jsonb("merkle_proof"),
    // ── §14 recibo de verificação ──
    receiptCode: text("receipt_code").unique(),
  },
  (t) => ({
    projectIdx: index("idx_interviews_project").on(t.projectId, t.syncedAt.desc()),
    interviewerIdx: index("idx_interviews_interviewer").on(t.interviewerId),
    ageChk: check("interviews_age_chk", sql`${t.respondentAge} >= 16`),
  }),
);

// ─── answers ─────────────────────────────────────────────────────────
export const answers = pgTable(
  "answers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    questionCode: text("question_code").notNull(), // 'gov_spont','gov_c1','sen_v1','sen_v2',...
    candidateId: uuid("candidate_id").references(() => candidates.id),
    valueText: text("value_text"),
  },
  (t) => ({
    uq: unique("answers_interview_question_uq").on(t.interviewId, t.questionCode),
    questionIdx: index("idx_answers_question").on(t.questionCode, t.candidateId),
  }),
);

// ─── interview_photos ────────────────────────────────────────────────
export const interviewPhotos = pgTable(
  "interview_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    seq: smallint("seq").notNull(), // máx 3 (CHECK 1..3)
    storageKey: text("storage_key").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    gps: jsonb("gps"),
  },
  (t) => ({
    uq: unique("interview_photos_seq_uq").on(t.interviewId, t.seq),
    seqChk: check("interview_photos_seq_chk", sql`${t.seq} BETWEEN 1 AND 3`),
  }),
);

// ─── checks ──────────────────────────────────────────────────────────
export const checks = pgTable("checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id").notNull().unique().references(() => interviews.id),
  supervisorId: uuid("supervisor_id").references(() => users.id),
  method: text("method"), // 'in_loco' | 'audio'
  result: checkResultEnum("result"),
  reason: text("reason"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
});

// ─── audit_log ───────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  meta: jsonb("meta"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── invites (F3 — cadastro por link de uso único) ───────────────────
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  role: userRole("role").notNull(), // manager | interviewer
  stratumId: uuid("stratum_id").references(() => strata.id),
  managerId: uuid("manager_id").references(() => users.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── anchors (§13.1) ─────────────────────────────────────────────────
export const anchors = pgTable("anchors", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  merkleRoot: text("merkle_root").notNull(),
  interviewCount: integer("interview_count").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  chain: text("chain").notNull().default("base"),
  txHash: text("tx_hash"),
  blockNumber: bigserial("block_number", { mode: "number" }),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  anchoredAt: timestamp("anchored_at", { withTimezone: true }),
});

// ─── reports (relatório selado: papel timbrado + QR + ancoragem na Base) ──
// Cada relatório congela os números num snapshot (payload), calcula um
// content_hash e ancora esse hash na Base. O QR do PDF aponta ao portal
// /r/:code, que recomputa o hash do payload e confere contra a âncora on-chain.
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  code: text("code").notNull().unique(), // REL-2026-XXXX
  contentHash: text("content_hash").notNull(),
  payload: jsonb("payload").notNull(), // snapshot congelado (ficha + resultados + lista)
  pdfKey: text("pdf_key"), // R2: bytes exatos do PDF gerado
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  chain: text("chain"),
  txHash: text("tx_hash"),
  blockNumber: bigserial("block_number", { mode: "number" }),
  anchoredAt: timestamp("anchored_at", { withTimezone: true }),
  status: text("status").notNull().default("anchoring"), // anchoring | anchored | local | failed
});
