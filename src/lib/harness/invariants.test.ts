import { describe, expect, it } from "vitest";
import { runSequences } from "./invariants";

describe("the invariant harness finds no counterexamples", () => {
  it("keeps the ledger at zero across hundreds of scrambled sequences", () => {
    const result = runSequences(1, 400);
    expect(result.sequences).toBe(400);
    expect(result.checks).toBeGreaterThan(0);
    expect(result.counterexamples).toBe(0);
  });

  it("is deterministic for a given seed range", () => {
    expect(runSequences(7, 50)).toEqual(runSequences(7, 50));
  });
});
