import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dashboard de Apuração. Proxy /api (REST) e /ws (WebSocket) → backend :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
