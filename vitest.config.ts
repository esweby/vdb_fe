import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "packages",
          include: [
            "packages/**/*.test.ts",
            "supabase/functions/**/*.test.ts",
          ],
          // Integration tests need a running database; they run in CI's db-test job.
          exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
        },
      },
      "apps/web",
    ],
  },
});
