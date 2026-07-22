import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // cli.ts is a thin process.exit()-driven entry point exercised via the
      // subprocess-based integration tests in test/cli.test.ts, not unit
      // coverage; its actual logic lives in cli-lib.ts, which is covered.
      // index.ts is a pure re-export barrel and types.ts is type-only
      // (erased at compile time) -- neither has runtime logic to invoke,
      // so 0% "function coverage" on them is structural, not a real gap.
      exclude: ["src/cli.ts", "src/index.ts", "src/types.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 100,
        branches: 85,
      },
    },
  },
});
