// Storage R2/S3 — presigned URLs. PROMPT §2 + §5 (/api/uploads/presign) + CA #7.
// Mídia NUNCA é pública: PUT via presign no upload; GET via presign (10 min) só p/ supervisor+.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? "pesquisa-midia";

// PT-021 — allowlist de prefixo de key (defesa em profundidade). Só keys no padrão
// esperado podem ser lidas; bloqueia leitura de objeto arbitrário caso uma key suja vaze.
const KEY_ALLOW = /^([0-9a-fA-F-]{36}\/(photo-[1-3]\.jpg|audio\.webm)|candidates\/[0-9a-fA-F-]{36}\.jpg|reports\/[A-Za-z0-9._-]+\.pdf)$/;
function assertSafeKey(key: string): void {
  if (!KEY_ALLOW.test(key)) throw new Error(`unsafe_storage_key: ${key}`);
}

/** PUT presign para o app subir foto/áudio direto no bucket. */
export async function presignPut(storageKey: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: storageKey }), { expiresIn });
}

/** GET presign p/ auditoria (supervisor+), expira em 10 min (CA #7). */
export async function presignGet(storageKey: string, expiresIn = 600): Promise<string> {
  assertSafeKey(storageKey);
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }), { expiresIn });
}

/** Convenção de keys — PROMPT §5. */
export function buildStorageKey(
  kind: "photo" | "audio",
  interviewClientUuid: string,
  seq?: number,
): string {
  return kind === "photo"
    ? `${interviewClientUuid}/photo-${seq}.jpg`
    : `${interviewClientUuid}/audio.webm`;
}

/** Key da foto de um candidato. */
export function buildCandidateKey(candidateId: string): string {
  return `candidates/${candidateId}.jpg`;
}

/** Baixa um objeto do bucket como Buffer (usado pelos jobs de pós-processamento). */
export async function getObject(key: string): Promise<Buffer> {
  assertSafeKey(key);
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await r.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/** Grava um objeto no bucket. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/** Metadados de um objeto (tamanho/tipo) — usado p/ verificar existência. */
export async function headObject(key: string): Promise<{ size: number; contentType?: string }> {
  const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return { size: r.ContentLength ?? 0, contentType: r.ContentType };
}
