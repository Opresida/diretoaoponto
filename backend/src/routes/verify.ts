// Verificação pública — PROMPT §13.4 + §14.2. SEM autenticação, rate-limited.
import { Router } from "express";

const router = Router();

// GET /api/verify/:code — recibo (§14.2). Estados:
//   not_found | pending_anchor | sealed_valid | integrity_failed
// Reverifica a prova de Merkle em tempo real (services/merkle.verifyProof).
// Retorna SOMENTE dados não pessoais (CA #13).
router.get("/:code", async (_req, res) => {
  // TODO: rate-limit 20 req/min/IP; localizar por receipt_code.
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §14.2" });
});

// GET /api/verify/id/:interviewId — modo auditor por id (§13.4):
//   { payloadHash, merkleProof, merkleRoot, txHash, blockNumber, explorerUrl }
router.get("/id/:interviewId", async (_req, res) => {
  res.status(501).json({ error: "not_implemented", ref: "PROMPT §13.4" });
});

export default router;
