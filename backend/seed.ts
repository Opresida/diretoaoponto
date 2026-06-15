// Seed — PROMPT §10 + §12 (hierarquia). Projeto "Onda Mar/2026".
//
// Popular:
//  • projeto "Onda Mar/2026" (1.200 entrevistas, ±3 p.p., 95%), TSE AM-05275/2026
//  • estratos de Manaus por zona:
//      Norte 204, Leste 298, Oeste 134, Centro-Oeste 67, Centro-Sul 86, Sul 87
//  • interior: 324 distribuídos nos 14 municípios
//  • cotas por estrato (sexo × faixa etária)
//  • candidatos Governo: David Almeida, Tadeu de Souza, Omar Aziz, Prof. Maria do Carmo
//  • candidatos Senado: Eduardo Braga, Cap. Alberto Neto, Marcelo Ramos,
//                       Plínio Valério, Marcos Rotta, Wilson Lima, Del. Costa e Silva
//  • hierarquia (§12): 1 admin → 2 gerentes → 3 entrevistadores por gerente
//                      (manager_id + created_by preenchidos) + 1 usuário por demais roles
//
// TODO: implementar inserts idempotentes (onConflictDoNothing) usando o `db`.
import { db } from "./src/db/index.js";

const ZONAS_MANAUS = [
  { zone: "Norte", target: 204 },
  { zone: "Leste", target: 298 },
  { zone: "Oeste", target: 134 },
  { zone: "Centro-Oeste", target: 67 },
  { zone: "Centro-Sul", target: 86 },
  { zone: "Sul", target: 87 },
];
const INTERIOR_TOTAL = 324; // distribuído nos 14 municípios

async function main() {
  void db;
  void ZONAS_MANAUS;
  void INTERIOR_TOTAL;
  console.log("seed: TODO — PROMPT §10 + §12");
}

main().then(() => process.exit(0));
