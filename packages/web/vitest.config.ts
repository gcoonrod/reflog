import { defineConfig } from "vitest/config";
import path from "path";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
    include: ["../../tests/**/*.test.ts", "../../tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
    },
    reporters: process.env.CI
      ? ["default", "junit"]
      : ["default"],
    outputFile: process.env.CI
      ? { junit: "./test-results/junit.xml" }
      : undefined,
  },
});
