import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// App de Checagem (supervisor). Proxy /api → backend :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5177,
    proxy: { "/api": "http://localhost:3000" },
  },
});
