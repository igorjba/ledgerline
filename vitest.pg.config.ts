import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/*
 * Integration suite that runs against a real Postgres (the CI `db` job spins one
 * up with btree_gist installed; locally, point DATABASE_URL at any Postgres 15+).
 * Kept separate from the unit config so `npm test` never needs a database — the
 * pure core is proven without one — while these prove the schema itself: that the
 * EXCLUDE gist constraint is what rejects an overlapping bitemporal assertion.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.pgtest.ts"],
    // A shared database — never let two suites migrate/seed it at once.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
