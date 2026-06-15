// Bootstrap do servidor — wiring de rotas, WS e error handler.
import "dotenv/config";
import http from "http";
import express from "express";

import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import { attachApuracaoWs } from "./ws/apuracao.js";

import authRoutes from "./routes/auth.js";
import fieldRoutes from "./routes/field.js";
import uploadRoutes from "./routes/uploads.js";
import syncRoutes from "./routes/sync.js";
import apuracaoRoutes from "./routes/apuracao.js";
import checksRoutes from "./routes/checks.js";
import interviewsRoutes from "./routes/interviews.js";
import verifyRoutes from "./routes/verify.js";
import usersRoutes, { teamRouter } from "./routes/users.js";

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

app.use(errorHandler);

const server = http.createServer(app);
attachApuracaoWs(server);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Direito ao Ponto API on :${port}`));
