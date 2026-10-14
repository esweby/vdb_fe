import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests need a running database; they run in CI's db-test job.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
