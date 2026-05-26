import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/** Paste da dashboard a volte include spazi/newline: normalizza prima che Vite legga le VITE_. */
for (const key of Object.keys(process.env)) {
  if (key.startsWith("VITE_")) {
    const v = process.env[key];
    if (v !== undefined) process.env[key] = v.trim();
  }
}

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
const basePath = process.env.BASE_PATH || "/";
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8080";

export default defineConfig(() => {
  return {
    base: basePath,
    envDir: path.resolve(import.meta.dirname),
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        output: {
          // Estrae i vendor pesanti dal bundle principale (index.js) per un
          // caricamento iniziale più leggero. Le librerie di export (html2pdf,
          // jspdf, xlsx, html2canvas) restano chunk separati lazy via import().
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("/react-dom/") ||
              id.includes("/scheduler/") ||
              /node_modules\/react\//.test(id) ||
              id.includes("react/jsx-runtime")
            ) return "react-vendor";
            if (id.includes("@tanstack")) return "tanstack";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("date-fns")) return "date-fns";
          },
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
