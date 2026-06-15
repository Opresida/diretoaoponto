// Força o reconcile do cache de apuração agora (rebuild do Redis a partir do DB).
import "dotenv/config";
import { reconcile } from "../src/services/cache.js";

await reconcile();
console.log("reconcile OK");
process.exit(0);
