// PT-016 — validação de ambiente no boot (falha-rápido em vez de erro por-request).
// Importar no TOPO de server.ts. Valida os segredos críticos de segurança.
import { z } from "zod";

const schema = z.object({
  // Críticos (segurança) — sem default, validados com tamanho mínimo.
  DATABASE_URL: z.string().min(1, "DATABASE_URL ausente"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter ≥32 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET deve ter ≥32 caracteres"),
  HASH_SALT: z.string().min(16, "HASH_SALT deve ter ≥16 caracteres"),

  // Operacionais — opcionais (integrações podem estar desligadas em dev).
  PORT: z.coerce.number().int().positive().optional(),
  NODE_ENV: z.string().optional(),
  CORS_ORIGINS: z.string().optional(), // CSV de origens permitidas (prod)
  PUBLIC_PORTAL_ORIGIN: z.string().url().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  WORKERS: z.string().optional(),
  BASE_RPC_URL: z.string().optional(),
  ANCHOR_CHAIN: z.string().optional(),
  ANCHOR_PRIVATE_KEY: z.string().optional(),
  ANCHOR_CONTRACT_ADDRESS: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`\n[ENV] Configuração inválida — corrija o .env antes de subir:\n${msg}\n`);
  // Falha-rápido: não sobe o servidor com segredos faltando/fracos.
  process.exit(1);
}

// Reforço extra: access ≠ refresh (chaves devem ser distintas).
if (parsed.data.JWT_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  console.error("\n[ENV] JWT_SECRET e JWT_REFRESH_SECRET não podem ser iguais.\n");
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins: string[] = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
