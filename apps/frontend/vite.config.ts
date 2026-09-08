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
        // Epic 7: Extended caching for ~200 MB of assets
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}",
          "**/*.{mp3,ogg,wav,m4a}", // Audio files
          "**/*.{json,geojson}", // Map tiles and data
        ],
        // Allow larger individual assets (up to 50 MB per file)
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        
        // Runtime caching strategies
        runtimeCaching: [
          // API calls: Network-first (fresh data preferred)
          {
            urlPattern: /\/api\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
            },
          },
          // Map tiles: Cache-first (static, rarely change)
          {
            urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          // Audio: Cache-first (large, static files)
          {
            urlPattern: /\.(mp3|ogg|wav|m4a)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "audio-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          // Fonts: Cache-first
          {
            urlPattern: /\.(woff|woff2|ttf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // `ws: true` is required so that vite proxies WebSocket upgrade requests
      // for the /api/v1/geo/ws endpoint during development.
      "/api": { target: "http://localhost:3000", changeOrigin: true, ws: true },
    },
  },
});
