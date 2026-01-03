import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig(async ({ command }) => {
  // Critical: NEVER load Replit-only plugins during `vite build` (Render won't have devDependencies).
  const isServe = command === "serve";
  const replitId = String(process.env.REPL_ID || "").trim();
  const isReplit = isServe && replitId.length > 0;

  return {
    plugins: [
      react(),
      tailwindcss(),
      metaImagesPlugin(),
      ...(isReplit
        ? [
            await import("@replit/vite-plugin-runtime-error-modal").then((m) => (m as any).default()),
            await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
            await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
