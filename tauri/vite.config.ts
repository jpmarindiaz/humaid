import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwind()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Mapbox is ~1.5 MB unminified — keep it in its own chunk so the main
    // bundle stays light. The Alerts tab + AlertMap component lazy-load it.
    rollupOptions: {
      output: {
        manualChunks: {
          "mapbox-gl": ["mapbox-gl"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}));
