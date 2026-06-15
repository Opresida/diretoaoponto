// Relatório selado — papel timbrado + QR + ancoragem na Base.
// Fluxo (POST /api/reports): coleta um snapshot dos números → calcula
// content_hash (sha256(canonicalize(payload)+salt)) → ancora o hash na Base
// (mesmo contrato AnchorRegistry.anchor(root,count=1)) → renderiza o PDF
// timbrado (com QR p/ /r/:code) → guarda os bytes no R2. O portal /r/:code
// recomputa o hash do payload e confere contra a âncora on-chain.
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { db } from "../db/index.js";
import { sha256Hex } from "./hash.js";
import { canonicalize } from "json-canonicalize";
import { apuracaoGoverno, apuracaoSenado, progressSnapshot } from "./aggregation.js";
import { putObject } from "./storage.js";
import { renderReportPdf } from "./reportPdf.js";

const ANCHOR_ABI = ["function anchor(bytes32 root, uint256 count) external"];

export function ageBand(age: number): string {
  if (age <= 24) return "16–24";
  if (age <= 44) return "25–44";
  if (age <= 59) return "45–59";
  return "60+";
}

function reportCode(): string {
  // REL-2026-XXXX (4 chars base32 sem ambíguos).
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(4);
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[b[i]! % ALPHABET.length];
  return `REL-2026-${s}`;
}

/** Margem de erro (95%, p=q=0,5) em pontos percentuais. */
function marginOfError(n: number): number {
  if (n <= 0) return 0;
  return Math.round(1.96 * Math.sqrt(0.25 / n) * 100 * 10) / 10;
}

export interface ReportPayload {
  code: string;
  generatedAt: string;
  ficha: {
    instituto: string;
    pesquisa: string;
    uf: string;
    amostraColetada: number;
    amostraPlanejada: number;
    manaus: { done: number; target: number };
    interior: { done: number; target: number };
    periodoInicio: string | null;
    periodoFim: string | null;
    margemErro: number;
    nivelConfianca: string;
    flagsTotal: number;
    areasEmCampo: number;
  };
  governo: { total: unknown[]; manaus: unknown[]; interior: unknown[] };
  senado: unknown[];
  entrevistas: Array<{
    recibo: string | null;
    regiao: string;
    area: string;
    perfil: string;
    duracaoSec: number;
    flags: string[];
    status: string;
    syncedAt: string;
  }>;
}

/** Monta o snapshot congelado do relatório a partir do estado atual do banco. */
export async function gatherReportData(): Promise<ReportPayload> {
  const proj = await db.execute(sql`
    SELECT id, name, sample_size FROM projects ORDER BY created_at LIMIT 1`);
  const project = proj.rows[0] as { id: string; name: string; sample_size: number } | undefined;

  const [govT, govM, govI, senT, progress] = await Promise.all([
    apuracaoGoverno("c1", "total"),
    apuracaoGoverno("c1", "manaus"),
    apuracaoGoverno("c1", "interior"),
    apuracaoSenado(100, "total"),
    progressSnapshot(),
  ]);

  // Ficha técnica + período + flags.
  const meta = await db.execute(sql`
    SELECT COUNT(*)::int AS n,
           MIN(synced_at) AS ini, MAX(synced_at) AS fim,
           COALESCE(SUM(jsonb_array_length(fraud_flags)),0)::int AS flags
    FROM interviews WHERE status <> 'rejected'`);
  const m = meta.rows[0] as { n: number; ini: string | null; fim: string | null; flags: number };

  const areas = await db.execute(sql`
    SELECT COUNT(DISTINCT i.stratum_id)::int AS areas
    FROM interviews i WHERE i.status <> 'rejected'`);

  // Lista completa de entrevistas (metadados — voto NÃO entra, é sigiloso).
  const list = await db.execute(sql`
    SELECT i.receipt_code, s.region,
           COALESCE(s.zone, s.municipality, s.name) AS area,
           i.respondent_sex, i.respondent_age, i.duration_sec, i.fraud_flags,
           i.status, i.synced_at
    FROM interviews i JOIN strata s ON s.id = i.stratum_id
    WHERE i.status <> 'rejected'
    ORDER BY i.synced_at ASC`);

  const entrevistas = list.rows.map((r) => ({
    recibo: (r.receipt_code as string) ?? null,
    regiao: r.region as string,
    area: r.area as string,
    perfil: `${r.respondent_sex === "M" ? "Homem" : "Mulher"} · ${ageBand(Number(r.respondent_age))}`,
    duracaoSec: Number(r.duration_sec ?? 0),
    flags: (r.fraud_flags as string[]) ?? [],
    status: r.status as string,
    syncedAt: r.synced_at as string,
  }));

  return {
    code: "", // preenchido em generateReport
    generatedAt: new Date().toISOString(),
    ficha: {
      instituto: process.env.REPORT_INSTITUTE ?? "Instituto Direto ao Ponto",
      pesquisa: project?.name ?? "Pesquisa de intenção de voto",
      uf: "Amazonas",
      amostraColetada: m.n,
      amostraPlanejada: Number(project?.sample_size ?? 0),
      manaus: progress.manaus,
      interior: progress.interior,
      periodoInicio: m.ini,
      periodoFim: m.fim,
      margemErro: marginOfError(m.n),
      nivelConfianca: "95%",
      flagsTotal: m.flags,
      areasEmCampo: Number(areas.rows[0]?.areas ?? 0),
    },
    governo: { total: govT, manaus: govM, interior: govI },
    senado: senT,
    entrevistas,
  };
}

export function computeReportHash(payload: ReportPayload): string {
  // Hash sobre o payload SEM o code (o code identifica, não faz parte do conteúdo selado).
  const { code: _omit, ...sealable } = payload;
  return sha256Hex(canonicalize(sealable) + (process.env.HASH_SALT ?? ""));
}

/** Ancora o hash do relatório na Base (ou selo local sem chaves). */
async function anchorReportHash(contentHash: string): Promise<{
  chain: string; txHash: string | null; blockNumber: number | null; status: string;
}> {
  const pk = process.env.ANCHOR_PRIVATE_KEY;
  const addr = process.env.ANCHOR_CONTRACT_ADDRESS;
  const rpc = process.env.BASE_RPC_URL;
  const chain = process.env.ANCHOR_CHAIN ?? "base";
  if (pk && addr && rpc) {
    const provider = new JsonRpcProvider(rpc);
    const wallet = new Wallet(pk, provider);
    const contract = new Contract(addr, ANCHOR_ABI, wallet);
    const root = "0x" + contentHash; // bytes32
    const tx = await contract.getFunction("anchor")(root, 1);
    const receipt = await tx.wait();
    return { chain, txHash: tx.hash, blockNumber: receipt?.blockNumber ?? null, status: "anchored" };
  }
  return { chain, txHash: null, blockNumber: null, status: "local" };
}

export interface GeneratedReport {
  id: string; code: string; contentHash: string; status: string;
  txHash: string | null; chain: string | null;
}

/** Gera um relatório completo: snapshot → hash → âncora → PDF → R2 → DB. */
export async function generateReport(userId: string): Promise<GeneratedReport> {
  const payload = await gatherReportData();
  payload.code = reportCode();
  const contentHash = computeReportHash(payload);

  const projRow = await db.execute(sql`SELECT id FROM projects ORDER BY created_at LIMIT 1`);
  const projectId = projRow.rows[0]!.id as string;

  // 1. Grava já (status anchoring) p/ ter id.
  const ins = await db.execute(sql`
    INSERT INTO reports (project_id, code, content_hash, payload, generated_by, status)
    VALUES (${projectId}, ${payload.code}, ${contentHash}, ${JSON.stringify(payload)}::jsonb, ${userId}, 'anchoring')
    RETURNING id`);
  const id = ins.rows[0]!.id as string;

  // 2. Ancora na Base (ou selo local).
  const anchor = await anchorReportHash(contentHash);
  await db.execute(sql`
    UPDATE reports SET chain = ${anchor.chain}, tx_hash = ${anchor.txHash},
      block_number = ${anchor.blockNumber}, anchored_at = now(), status = ${anchor.status}
    WHERE id = ${id}`);

  // 3. Renderiza o PDF (QR aponta ao portal /r/:code) e guarda no R2.
  const verifyUrl = `${process.env.PUBLIC_PORTAL_ORIGIN ?? "http://localhost:5174"}/r/${payload.code}`;
  try {
    const pdf = await renderReportPdf({
      payload, contentHash, verifyUrl,
      txHash: anchor.txHash, chain: anchor.chain, status: anchor.status,
    });
    const pdfKey = `reports/${payload.code}.pdf`;
    await putObject(pdfKey, pdf, "application/pdf");
    await db.execute(sql`UPDATE reports SET pdf_key = ${pdfKey} WHERE id = ${id}`);
  } catch (e) {
    // PDF é re-gerável a partir do payload; não falha a geração inteira.
    console.error("[reports] falha ao gerar/subir PDF:", (e as Error).message);
  }

  return { id, code: payload.code, contentHash, status: anchor.status, txHash: anchor.txHash, chain: anchor.chain };
}
