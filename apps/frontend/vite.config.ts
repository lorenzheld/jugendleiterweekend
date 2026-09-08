import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      manifest: {
        name: "JLW 2026 – Player",
        short_name: "JLW Player",
        description: "Jugendleiter-Weekend 2026 – Player Client",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,mp3,ogg}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB per asset
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\//,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache" },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
