import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    // mobile/ has its own test runner (jest-expo).
    exclude: ["**/node_modules/**", "mobile/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/helpers/server-only.ts"),
    },
  },
});
