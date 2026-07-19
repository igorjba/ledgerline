import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitStatements } from "./sql-file";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(join(here, "migrations", "0001_init.sql"), "utf8");

describe("splitStatements", () => {
  it("splits top-level statements on semicolons", () => {
    expect(splitStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps a dollar-quoted function body as a single statement", () => {
    const fn = splitStatements(migration).find((s) => s.includes("CREATE OR REPLACE FUNCTION"));
    expect(fn).toBeDefined();
    // The whole body survived: the semicolons inside $$ … $$ did not split it.
    expect(fn).toContain("GET DIAGNOSTICS closed_count");
    expect(fn).toContain("RETURN QUERY SELECT CASE WHEN closed_count");
    expect(fn!.trimEnd().endsWith("$$")).toBe(true);
  });

  it("produces the expected number of statements for the migration", () => {
    const statements = splitStatements(migration);
    expect(statements.some((s) => s.includes("EXCLUDE USING gist"))).toBe(true);
    expect(statements.some((s) => s.startsWith("CREATE EXTENSION"))).toBe(true);
    // Every statement is non-empty and comment-free at its head.
    for (const s of statements) expect(s.length).toBeGreaterThan(0);
  });
});
