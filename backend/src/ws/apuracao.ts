// WebSocket de apuração — PROMPT §6. wss://.../ws/apuracao?token=JWT
// Valida role coordinator+ no handshake. Broadcast a cada sync (evento interview:new).
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";

let wss: WebSocketServer | null = null;

const RANK: Record<string, number> = {
  statistician: 3,
  coordinator: 4,
  manager: 5,
  admin: 6,
};

export function attachApuracaoWs(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws/apuracao")) return;
    try {
      const token = new URL(req.url, "http://x").searchParams.get("token") ?? "";
      const user = jwt.verify(token, process.env.JWT_SECRET!) as { role: string };
      if ((RANK[user.role] ?? -1) < RANK.statistician!) throw new Error("forbidden");
      wss!.handleUpgrade(req, socket, head, (ws) => wss!.emit("connection", ws, req));
    } catch {
      socket.destroy();
    }
  });
}

/** Broadcast do evento de apuração (§6). Chamado pelo sync após gravar. */
export function broadcastApuracao(payload: unknown): void {
  if (!wss) return;
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

// TODO §6: cache do agregado em Redis + recálculo incremental;
//          full-refresh a cada 60s p/ reconciliar.
