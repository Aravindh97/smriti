/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the build works under any GitHub Pages path (/<repo>/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  test: { environment: "jsdom" },
});
