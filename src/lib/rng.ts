/**
 * Deterministic pseudo-random number generation, shared by the invariant harness
 * and the property tests so a failing case is reproducible from its seed. Kept in
 * one place because a PRNG must be byte-identical everywhere it is used — two
 * copies that drift would make "same seed, same sequence" quietly false.
 */

/** mulberry32 — small, fast, good-enough distribution for seeded sequences. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
