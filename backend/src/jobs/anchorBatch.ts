// Job: ancoragem por Merkle root na Base — PROMPT §13.3 (cron a cada hora).
// 1 raiz por lote (nunca 1 tx por entrevista). Custo: centavos/dia na Base.
//
//  1. SELECT entrevistas com payload_hash e anchor_id IS NULL
//  2. tree = buildTree(hashes)  (services/merkle)
//  3. tx → contrato AnchorRegistry.anchor(root, count) na Base (ethers + ANCHOR_PRIVATE_KEY)
//  4. INSERT anchors (root, tx_hash, block_number, status='confirmed')
//  5. UPDATE cada entrevista: anchor_id + merkle_proof = proofHex(tree, hash)
//
// TODO: implementar com BullMQ repeatable (cron "0 * * * *") + ethers Contract.
export const ANCHOR_BATCH_QUEUE = "anchor:batch";
