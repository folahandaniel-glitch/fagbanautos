import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "next/headers": path.resolve(import.meta.dirname, "tests/stubs/next-headers.ts"),
    },
  },
});
