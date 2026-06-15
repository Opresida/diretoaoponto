import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Painel do Admin Geral. Proxy /api → backend :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: { "/api": "http://localhost:3000" },
  },
});
