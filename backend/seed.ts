// Seed — PROMPT §10 + §12. Projeto "Onda Mar/2026". Idempotente (pula se já existe).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./src/db/index.js";
import { projects, strata, quotas, candidates, users, municipalities } from "./src/db/schema.js";
import { buildQuotaRows, splitTarget } from "./src/services/quotaService.js";

const TSE = "AM-05275/2026";
const PASSWORD = "senha123"; // DEV — trocar em produção

// 62 municípios do Amazonas (Manaus = manaus; demais = interior).
const MUN_62: Array<{ name: string; region: "manaus" | "interior" }> = [
  "Alvarães","Amaturá","Anamã","Anori","Apuí","Atalaia do Norte","Autazes","Barcelos","Barreirinha",
  "Benjamin Constant","Beruri","Boa Vista do Ramos","Boca do Acre","Borba","Caapiranga","Canutama",
  "Carauari","Careiro","Careiro da Várzea","Coari","Codajás","Eirunepé","Envira","Fonte Boa","Guajará",
  "Humaitá","Ipixuna","Iranduba","Itacoatiara","Itamarati","Itapiranga","Japurá","Juruá","Jutaí","Lábrea",
  "Manacapuru","Manaquiri","Manicoré","Maraã","Maués","Nhamundá","Nova Olinda do Norte","Novo Airão",
  "Novo Aripuanã","Parintins","Pauini","Presidente Figueiredo","Rio Preto da Eva","Santa Isabel do Rio Negro",
  "Santo Antônio do Içá","São Gabriel da Cachoeira","São Paulo de Olivença","São Sebastião do Uatumã","Silves",
  "Tabatinga","Tapauá","Tefé","Tonantins","Uarini","Urucará","Urucurituba",
].map((name): { name: string; region: "manaus" | "interior" } => ({ name, region: "interior" }))
  .concat([{ name: "Manaus", region: "manaus" }]);

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

// MUNICIPIOS_INTERIOR (14 amostrados) usa splitTarget de quotaService.
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
      target: splitTarget(INTERIOR_TOTAL, MUNICIPIOS_INTERIOR.length)[i]!,
    })),
  ];
  const insertedStrata = await db
    .insert(strata)
    .values(stratRows)
    .returning({ id: strata.id, target: strata.target });

  // 3. Cotas por estrato (2 sexos × 4 faixas) — buildQuotaRows compartilhado.
  const quotaRows = insertedStrata.flatMap((s) =>
    buildQuotaRows(s.target).map((q) => ({
      stratumId: s.id,
      label: q.label,
      sex: q.sex,
      ageMin: q.ageMin,
      ageMax: q.ageMax,
      target: q.target,
    })),
  );
  await db.insert(quotas).values(quotaRows);

  // 3b. Catálogo dos 62 municípios + backfill (in_research nos 14 amostrados).
  await db.insert(municipalities).values(MUN_62.map((m) => ({ projectId, name: m.name, region: m.region })));
  await db.execute(sql`UPDATE strata s SET municipality_id = m.id FROM municipalities m WHERE m.project_id = s.project_id AND m.name = s.municipality AND s.municipality_id IS NULL`);
  await db.execute(sql`UPDATE municipalities m SET in_research = true, target = s.target, stratum_id = s.id FROM strata s WHERE s.municipality_id = m.id AND m.region = 'interior'`);

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

  // Papéis com função/UI: supervisor (checagem) + client. Coordenador/estatístico
  // removidos (sem app dedicado — apuração geral fica no Admin).
  for (const role of ["supervisor", "client"] as const) {
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
