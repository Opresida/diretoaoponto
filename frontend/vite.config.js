import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// App de Campo (PWA offline-first). Proxy /api → backend :3000 em dev.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "logo-lockup.png"],
      manifest: {
        name: "Direto ao Ponto — Campo",
        short_name: "Direto ao Ponto",
        description: "App de campo do entrevistador",
        theme_color: "#A81824",
        background_color: "#FAF7F7",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
