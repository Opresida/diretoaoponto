import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// App de Campo (PWA offline-first). Proxy /api → backend :3000 em dev.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Direto ao Ponto — Campo",
        short_name: "DAP Campo",
        description: "App de campo do entrevistador",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        icons: [],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
