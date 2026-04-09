import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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

function requireClerkPublishableKeyForCiBuild(): Plugin {
  return {
    name: "require-clerk-publishable-key-ci",
    configResolved(resolved) {
      if (resolved.command !== "build") return;
      if (process.env.VITE_AUTH_DISABLED === "true" || process.env.VITE_AUTH_DISABLED === "1") {
        return;
      }
      const key = (process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").trim();
      if (key) return;
      if (process.env.VERCEL === "1" || process.env.CI === "true") {
        throw new Error(
          "[agency-portal] VITE_CLERK_PUBLISHABLE_KEY è vuota durante il build. " +
            "Su Vercel: Project → Settings → Environment Variables, aggiungi VITE_CLERK_PUBLISHABLE_KEY " +
            "(stesso valore della Publishable key in Clerk), ambienti Production/Preview, poi Redeploy.",
        );
      }
    },
  };
}

export default defineConfig(async () => {
  return {
    base: basePath,
    envDir: path.resolve(import.meta.dirname),
    plugins: [
      requireClerkPublishableKeyForCiBuild(),
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
