// Bootstrap do servidor — wiring de rotas, WS e error handler.
import "dotenv/config";
import { corsOrigins } from "./config/env.js"; // PT-016: valida env no boot (side-effect) + allowlist CORS
import http from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import { attachApuracaoWs } from "./ws/apuracao.js";
import { reconcile } from "./services/cache.js";
import { startWorkers } from "./jobs/workers.js";

import authRoutes from "./routes/auth.js";
import fieldRoutes from "./routes/field.js";
import uploadRoutes from "./routes/uploads.js";
import syncRoutes from "./routes/sync.js";
import apuracaoRoutes from "./routes/apuracao.js";
import checksRoutes from "./routes/checks.js";
import interviewsRoutes from "./routes/interviews.js";
import verifyRoutes from "./routes/verify.js";
import usersRoutes, { teamRouter } from "./routes/users.js";
import anchorRoutes from "./routes/anchor.js";
import candidatesRoutes, { publicCandidatePhotoRouter } from "./routes/candidates.js";
import strataRoutes from "./routes/strata.js";
import municipalitiesRoutes from "./routes/municipalities.js";
import invitesRoutes, { publicInvitesRouter } from "./routes/invites.js";
import reportsRoutes from "./routes/reports.js";

const app = express();

// PT-006 — headers de segurança (HSTS, nosniff, X-Frame-Options, etc.).
app.use(helmet());
// PT-006 — CORS por allowlist. Em dev (sem CORS_ORIGINS) libera os apps locais.
const devOrigins = [5173, 5174, 5175, 5176, 5177].flatMap((p) => [
  `http://localhost:${p}`, `http://127.0.0.1:${p}`,
]);
const allowOrigins = corsOrigins.length ? corsOrigins : devOrigins;
app.use(cors({
  origin: (origin, cb) => {
    // requests sem Origin (curl/health/same-origin) passam; demais checam allowlist.
    if (!origin || allowOrigins.includes(origin)) return cb(null, true);
    cb(new Error("not_allowed_by_cors"));
  },
  credentials: false,
}));
app.use(express.json({ limit: "2mb" }));
// trust proxy: por padrão NÃO confia em X-Forwarded-For (seguro mesmo se exposto direto —
// evita spoof do IP que fura o rate-limit). Em prod atrás de N proxies, setar TRUST_PROXY=N.
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);

// PT-005 — rate-limit em superfícies de credencial (anti brute-force).
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_requests" },
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Público (sem auth)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/candidates", publicCandidatePhotoRouter); // só GET /:id/photo
app.use("/api/public/invites", authLimiter, publicInvitesRouter); // ler contexto + aceitar

// Protegido
app.use("/api/field", requireAuth, fieldRoutes);
app.use("/api/uploads", requireAuth, uploadRoutes);
app.use("/api/sync", requireAuth, syncRoutes);
app.use("/api/apuracao", requireAuth, apuracaoRoutes);
app.use("/api/checks", requireAuth, checksRoutes);
app.use("/api/interviews", requireAuth, interviewsRoutes);
app.use("/api/users", requireAuth, usersRoutes);
app.use("/api/team", requireAuth, teamRouter);
app.use("/api/anchor", requireAuth, anchorRoutes);
app.use("/api/candidates", requireAuth, candidatesRoutes);
app.use("/api/strata", requireAuth, strataRoutes);
app.use("/api/municipalities", requireAuth, municipalitiesRoutes);
app.use("/api/invites", requireAuth, invitesRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);

app.use(errorHandler);

const server = http.createServer(app);
attachApuracaoWs(server);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, async () => {
  console.log(`Direito ao Ponto API on :${port}`);
  // §6 — aquece o cache e reconcilia a cada 60s; inicia workers + cron.
  try {
    await reconcile();
    console.log("cache: reconcile inicial OK");
  } catch (e) {
    console.error("cache: reconcile inicial falhou —", (e as Error).message);
  }
  setInterval(() => {
    reconcile().catch((e) => console.error("cache: reconcile 60s falhou —", e.message));
  }, 60_000);
  await startWorkers().catch((e) => console.error("workers: falha ao iniciar —", e.message));
});
