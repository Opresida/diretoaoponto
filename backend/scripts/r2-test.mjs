// Testa o R2 de ponta a ponta: PUT (presign) → upload → GET (presign) → download.
import "dotenv/config";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
const Bucket = process.env.S3_BUCKET;
const Key = `test/hello-${Date.now()}.txt`;
const body = "Direito ao Ponto — teste de storage R2 ✅";

// 1. presign PUT e upload
const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key }), { expiresIn: 300 });
let r = await fetch(putUrl, { method: "PUT", body });
console.log("upload (presigned PUT):", r.status, r.status === 200 ? "✅" : "❌");

// 2. presign GET e download
const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
r = await fetch(getUrl);
const txt = await r.text();
console.log("download (presigned GET):", r.status, "| conteúdo confere:", txt === body ? "✅" : "❌");

// 3. confirma que NÃO é público (sem assinatura → 401/403)
const publicUrl = `${process.env.S3_ENDPOINT}/${Bucket}/${Key}`;
r = await fetch(publicUrl);
console.log("acesso público (deve falhar):", r.status, [401, 403].includes(r.status) ? "✅ privado" : "⚠️ verificar");

// limpa
await s3.send(new DeleteObjectCommand({ Bucket, Key }));
console.log("objeto de teste removido.");
