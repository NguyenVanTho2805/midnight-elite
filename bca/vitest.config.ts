import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 },
});
