import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration tests that need a live Postgres run under vitest.pg.config.ts.
    exclude: ["**/node_modules/**", "src/**/*.pgtest.ts"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // The pure, load-bearing core. Adapters and API routes are integration
      // territory (Postgres tests / Playwright), so they stay out of scope here.
      include: ["src/lib/domain/**/*.ts", "src/lib/outbox/relay.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/index.ts", "src/lib/domain/scenario.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
