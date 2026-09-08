import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
