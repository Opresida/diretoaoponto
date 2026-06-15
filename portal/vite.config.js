import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Portal público de verificação. Proxy /api → backend :3000 em dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:3000" },
  },
});
