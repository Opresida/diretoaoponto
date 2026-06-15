// Merkle helpers — PROMPT §13.3 / §13.4.
// Constrói a árvore, gera prova de inclusão e reverifica (usado no /verify).
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "ethers";

/** Folha = keccak256(payloadHash). Mantemos sortPairs p/ provas determinísticas. */
function leaf(payloadHash: string): Buffer {
  return Buffer.from(keccak256(Buffer.from(payloadHash, "hex")).slice(2), "hex");
}

export function buildTree(payloadHashes: string[]): MerkleTree {
  const leaves = payloadHashes.map(leaf);
  return new MerkleTree(leaves, (d: Buffer) => Buffer.from(keccak256(d).slice(2), "hex"), {
    sortPairs: true,
  });
}

export function rootHex(tree: MerkleTree): string {
  return tree.getHexRoot();
}

export function proofHex(tree: MerkleTree, payloadHash: string): string[] {
  return tree.getHexProof(leaf(payloadHash));
}

/** Reverificação em tempo real do /verify (§14.2). */
export function verifyProof(payloadHash: string, proof: string[], root: string): boolean {
  return MerkleTree.verify(
    proof,
    leaf(payloadHash),
    root,
    (d: Buffer) => Buffer.from(keccak256(d).slice(2), "hex"),
    { sortPairs: true },
  );
}

// TODO §13.2: recomputeHash(payload, salt) — recalcular SHA-256 canônico
// (json-canonicalize + HASH_SALT) e comparar com payload_hash do dispositivo.
