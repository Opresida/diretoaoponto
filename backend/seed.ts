// Seed — PROMPT §10 + §12. Projeto "Onda Mar/2026". Idempotente (pula se já existe).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./src/db/index.js";
import { projects, strata, quotas, candidates, users } from "./src/db/schema.js";

const TSE = "AM-05275/2026";
const PASSWORD = "senha123"; // DEV — trocar em produção

const ZONAS_MANAUS: Array<{ zone: string; target: number }> = [
  { zone: "Norte", target: 204 },
  { zone: "Leste", target: 298 },
  { zone: "Oeste", target: 134 },
  { zone: "Centro-Oeste", target: 67 },
  { zone: "Centro-Sul", target: 86 },
  { zone: "Sul", target: 87 },
];

const MUNICIPIOS_INTERIOR = [
  "Manacapuru", "Parintins", "Itacoatiara", "Coari", "Tabatinga", "Manicoré",
  "Tefé", "Maués", "Humaitá", "São Gabriel da Cachoeira", "Iranduba",
  "Presidente Figueiredo", "Borba", "Eirunepé",
];
const INTERIOR_TOTAL = 324;

const AGE_BANDS: Array<[number, number, string]> = [
  [16, 24, "16–24"],
  [25, 44, "25–44"],
  [45, 59, "45–59"],
  [60, 120, "60+"],
];

const CANDIDATOS_GOV = [
  { name: "David Almeida", party: "Avante", color: "#34d399" },
  { name: "Tadeu de Souza", party: "Avante", color: "#60a5fa" },
  { name: "Omar Aziz", party: "PSD", color: "#f59e0b" },
  { name: "Prof. Maria do Carmo", party: "PT", color: "#f472b6" },
];
const CANDIDATOS_SEN = [
  { name: "Eduardo Braga", party: "MDB", color: "#34d399" },
  { name: "Cap. Alberto Neto", party: "PL", color: "#60a5fa" },
  { name: "Marcelo Ramos", party: "PSD", color: "#f59e0b" },
  { name: "Plínio Valério", party: "PSDB", color: "#a78bfa" },
  { name: "Marcos Rotta", party: "PSD", color: "#fb7185" },
  { name: "Wilson Lima", party: "União", color: "#2dd4bf" },
  { name: "Del. Costa e Silva", party: "PL", color: "#facc15" },
];
const NAO_CANDIDATOS = [
  { name: "Branco/Nulo", party: null, color: "#64748b" },
  { name: "NS/NR", party: null, color: "#475569" },
];

/** Distribui um total inteiro em n partes o mais iguais possível. */
function split(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

async function main() {
  const exists = await db.execute(sql`SELECT id FROM projects WHERE tse_registration = ${TSE} LIMIT 1`);
  if (exists.rows.length) {
    console.log("seed: projeto já existe, nada a fazer.");
    return;
  }

  // 1. Projeto
  const [proj] = await db
    .insert(projects)
    .values({
      name: "Onda Mar/2026",
      tseRegistration: TSE,
      tseRegistrationFederal: "BR-06624/2026",
      sampleSize: 1200,
      marginError: "3.00",
      confidence: "95.00",
      status: "field",
    })
    .returning({ id: projects.id });
  const projectId = proj!.id;

  // 2. Estratos (Manaus por zona + interior por município)
  const stratRows = [
    ...ZONAS_MANAUS.map((z) => ({
      projectId,
      name: `Manaus · ${z.zone}`,
      region: "manaus" as const,
      zone: z.zone,
      municipality: "Manaus",
      target: z.target,
    })),
    ...MUNICIPIOS_INTERIOR.map((m, i) => ({
      projectId,
      name: `Interior · ${m}`,
      region: "interior" as const,
      zone: null,
      municipality: m,
      target: split(INTERIOR_TOTAL, MUNICIPIOS_INTERIOR.length)[i]!,
    })),
  ];
  const insertedStrata = await db
    .insert(strata)
    .values(stratRows)
    .returning({ id: strata.id, target: strata.target });

  // 3. Cotas por estrato (2 sexos × 4 faixas etárias)
  const quotaRows = insertedStrata.flatMap((s) => {
    const per = split(s.target, 2 * AGE_BANDS.length);
    const cells: typeof quotas.$inferInsert[] = [];
    let k = 0;
    for (const [sex, label] of [["F", "Mulher"], ["M", "Homem"]] as const) {
      for (const [ageMin, ageMax, band] of AGE_BANDS) {
        cells.push({
          stratumId: s.id,
          label: `${label} · ${band}`,
          sex,
          ageMin,
          ageMax,
          target: per[k++]!,
        });
      }
    }
    return cells;
  });
  await db.insert(quotas).values(quotaRows);

  // 4. Candidatos (Governo + Senado + Branco/Nulo + NS/NR p/ cada cargo)
  const candRows = [
    ...CANDIDATOS_GOV.map((c) => ({ ...c, office: "governor" })),
    ...NAO_CANDIDATOS.map((c) => ({ ...c, office: "governor" })),
    ...CANDIDATOS_SEN.map((c) => ({ ...c, office: "senator" })),
    ...NAO_CANDIDATOS.map((c) => ({ ...c, office: "senator" })),
  ];
  await db.insert(candidates).values(candRows).onConflictDoNothing();

  // 5. Hierarquia (§12): admin → 2 gerentes → 3 entrevistadores cada + 1 por demais roles
  const hash = await bcrypt.hash(PASSWORD, 10);
  const [admin] = await db
    .insert(users)
    .values({ name: "Admin Geral", email: "admin@diretoaoponto.org", passwordHash: hash, role: "admin" })
    .returning({ id: users.id });
  const adminId = admin!.id;

  for (const role of ["coordinator", "statistician", "supervisor", "client"] as const) {
    await db.insert(users).values({
      name: `${role[0]!.toUpperCase()}${role.slice(1)} Demo`,
      email: `${role}@diretoaoponto.org`,
      passwordHash: hash,
      role,
      createdBy: adminId,
    });
  }

  let entSeq = 1;
  for (let m = 1; m <= 2; m++) {
    const [mgr] = await db
      .insert(users)
      .values({
        name: `Gerente ${m}`,
        email: `gerente${m}@diretoaoponto.org`,
        passwordHash: hash,
        role: "manager",
        createdBy: adminId,
      })
      .returning({ id: users.id });
    const managerId = mgr!.id;
    for (let e = 1; e <= 3; e++) {
      const code = `ENT-${String(entSeq).padStart(4, "0")}`;
      await db.insert(users).values({
        name: `Entrevistador ${code}`,
        email: `ent${entSeq}@diretoaoponto.org`,
        passwordHash: hash,
        role: "interviewer",
        registrationCode: code,
        managerId,
        createdBy: managerId,
      });
      entSeq++;
    }
  }

  console.log("seed: OK — projeto, %d estratos, %d cotas, %d candidatos, %d entrevistadores.",
    insertedStrata.length, quotaRows.length, candRows.length, entSeq - 1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
