import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Preload the three faces the first screen is set in, so text does not reflow
// when they arrive after the fallback.
const FIRST_SCREEN_FONTS = [
  "ibm-plex-sans-latin-400-normal",
  "ibm-plex-sans-condensed-latin-600-normal",
  "ibm-plex-sans-condensed-latin-700-normal",
];

function preloadFonts(): Plugin {
  return {
    name: "preload-fonts",
    transformIndexHtml(_html, ctx) {
      if (!ctx.bundle) return [];
      return Object.keys(ctx.bundle)
        .filter((f) => f.endsWith(".woff2") && FIRST_SCREEN_FONTS.some((n) => f.includes(`${n}-`)))
        .map((f) => ({
          tag: "link",
          attrs: { rel: "preload", href: `/band-d/${f}`, as: "font", type: "font/woff2", crossorigin: "" },
          injectTo: "head" as const,
        }));
    },
  };
}

export default defineConfig({
  base: "/band-d/",
  plugins: [react(), preloadFonts()],
  build: { target: "es2020", assetsInlineLimit: 0 },
  test: { include: ["src/**/*.test.ts"] },
});
