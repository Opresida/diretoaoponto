// Ancoragem por Merkle root — PROMPT §13.3. Uma raiz por lote (nunca 1 tx por
// entrevista). Sem ANCHOR_PRIVATE_KEY/ANCHOR_CONTRACT_ADDRESS, opera em "selo
// local" (calcula raiz + provas e grava a âncora sem tx on-chain) — permite
// testar o /verify (CA #12) antes do deploy do contrato na Base (CA #11).
import { sql } from "drizzle-orm";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { db } from "../db/index.js";
import { buildTree, rootHex, proofHex } from "./merkle.js";

const ABI = ["function anchor(bytes32 root, uint256 count) external"];

export interface AnchorResult {
  anchored: number;
  anchorId: string | null;
  merkleRoot: string | null;
  txHash: string | null;
  mode: "onchain" | "local" | "noop";
}

export async function runAnchorBatch(): Promise<AnchorResult> {
  // 1. Entrevistas com hash e ainda não ancoradas (exclui rejeitadas).
  const pend = await db.execute(sql`
    SELECT id, payload_hash, project_id, synced_at
    FROM interviews
    WHERE payload_hash IS NOT NULL AND anchor_id IS NULL AND status <> 'rejected'
    ORDER BY synced_at ASC`);
  const rows = pend.rows as Array<{ id: string; payload_hash: string; project_id: string; synced_at: string }>;
  if (rows.length === 0) {
    return { anchored: 0, anchorId: null, merkleRoot: null, txHash: null, mode: "noop" };
  }

  // 2. Árvore de Merkle (folha = payload_hash).
  const hashes = rows.map((r) => r.payload_hash);
  const tree = buildTree(hashes);
  const root = rootHex(tree);
  const projectId = rows[0]!.project_id;
  const periodStart = rows[0]!.synced_at;
  const periodEnd = rows[rows.length - 1]!.synced_at;

  // 3. Tx on-chain (Base) ou selo local.
  const pk = process.env.ANCHOR_PRIVATE_KEY;
  const contractAddr = process.env.ANCHOR_CONTRACT_ADDRESS;
  let txHash: string | null = null;
  let blockNumber: number | null = null;
  let status = "local";
  const chain = process.env.ANCHOR_CHAIN ?? "base";
  if (pk && contractAddr && process.env.BASE_RPC_URL) {
    const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
    const wallet = new Wallet(pk, provider);
    const contract = new Contract(contractAddr, ABI, wallet);
    const tx = await contract.getFunction("anchor")(root, rows.length);
    const receipt = await tx.wait();
    txHash = tx.hash;
    blockNumber = receipt?.blockNumber ?? null;
    status = "confirmed";
  }

  // 4. Grava âncora.
  const ins = await db.execute(sql`
    INSERT INTO anchors (project_id, merkle_root, interview_count, period_start, period_end, chain, tx_hash, block_number, status, anchored_at)
    VALUES (${projectId}, ${root}, ${rows.length}, ${periodStart}, ${periodEnd}, ${chain}, ${txHash}, ${blockNumber}, ${status}, now())
    RETURNING id`);
  const anchorId = ins.rows[0]!.id as string;

  // 5. Atualiza cada entrevista com anchor_id + prova de inclusão.
  for (const r of rows) {
    const proof = proofHex(tree, r.payload_hash);
    await db.execute(sql`
      UPDATE interviews SET anchor_id = ${anchorId}, merkle_proof = ${JSON.stringify(proof)}::jsonb
      WHERE id = ${r.id}`);
  }

  return {
    anchored: rows.length,
    anchorId,
    merkleRoot: root,
    txHash,
    mode: status === "confirmed" ? "onchain" : "local",
  };
}
