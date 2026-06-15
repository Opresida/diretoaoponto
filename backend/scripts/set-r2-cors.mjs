// Configura CORS no bucket R2 p/ permitir upload direto do navegador (presigned PUT).
import "dotenv/config";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
const Bucket = process.env.S3_BUCKET;

await s3.send(
  new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173", // vite preview
          ],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log("CORS aplicado ✅");
const cur = await s3.send(new GetBucketCorsCommand({ Bucket }));
console.log(JSON.stringify(cur.CORSRules, null, 2));
