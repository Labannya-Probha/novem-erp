import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          exceljs: ["exceljs"],
          lucide: ["lucide-react"],
        },
      },
    },
  },

  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{vitest,}.test.{js,jsx,ts,tsx}", "src/**/*.test.{js,jsx,ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      "src/lib/noShowAutomation.test.js",  // uses node:test, not vitest — run via `node --test`
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.{js,ts}"],
      exclude: ["src/lib/**/*.test.{js,ts}", "node_modules"],
    },
  },
});