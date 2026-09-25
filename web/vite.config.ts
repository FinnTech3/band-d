import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/band-d/",
  plugins: [react()],
  build: { target: "es2020", assetsInlineLimit: 0 },
  test: { include: ["src/**/*.test.ts"] },
});
