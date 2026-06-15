// Bootstrap do servidor — wiring de rotas, WS e error handler.
import "dotenv/config";
import http from "http";
import express from "express";

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
import candidatesRoutes from "./routes/candidates.js";
import strataRoutes from "./routes/strata.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Público (sem auth)
app.use("/api/auth", authRoutes);
app.use("/api/verify", verifyRoutes);

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
