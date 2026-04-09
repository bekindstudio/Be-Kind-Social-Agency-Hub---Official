import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
const basePath = process.env.BASE_PATH || "/";
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8080";

export default defineConfig(async ({ mode }) => {
  // loadEnv reads .env* files. CI hosts (e.g. Vercel) inject vars only into process.env.
  const fileEnv = loadEnv(mode, import.meta.dirname, "");
  const str = (k: string) =>
    String(fileEnv[k] ?? process.env[k] ?? "");

  return {
    base: basePath,
    define: {
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(
        str("VITE_CLERK_PUBLISHABLE_KEY"),
      ),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(str("VITE_SUPABASE_URL")),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(str("VITE_SUPABASE_ANON_KEY")),
      "import.meta.env.VITE_CLERK_PROXY_URL": JSON.stringify(str("VITE_CLERK_PROXY_URL")),
      "import.meta.env.VITE_API_PROXY_TARGET": JSON.stringify(str("VITE_API_PROXY_TARGET")),
    },
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
          ]
        : []),
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
