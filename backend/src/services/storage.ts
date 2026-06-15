// Storage R2/S3 — presigned URLs. PROMPT §2 + §5 (/api/uploads/presign) + CA #7.
// Mídia NUNCA é pública: PUT via presign no upload; GET via presign (10 min) só p/ supervisor+.
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

/** PUT presign para o app subir foto/áudio direto no bucket. */
export async function presignPut(storageKey: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: storageKey }), { expiresIn });
}

/** GET presign p/ auditoria (supervisor+), expira em 10 min (CA #7). */
export async function presignGet(storageKey: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }), { expiresIn });
}

// TODO §5: buildStorageKey(kind, interviewClientUuid, seq?) — convenção de keys
//   ex.: `${projectId}/${interviewClientUuid}/photo-${seq}.jpg` | `.../audio.webm`
