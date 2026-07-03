/**
 * Randomness sources.
 *
 * A "source" is any object implementing `nextFloat(): number` returning a value
 * in the half-open interval [0, 1). To plug in a new source of randomness
 * (hardware RNG, network beacon, seeded PRNG, etc.) you only need to implement
 * that one method and register the factory in `SOURCES` (see dice.js).
 *
 * Keeping the contract this small is deliberate: the rest of the app never
 * touches the source directly, so swapping it is a one-line change.
 */

const UINT32_MAX = 0x100000000; // 2^32

/** Cryptographically-secure source backed by the Web Crypto API (default). */
export function createCryptoSource() {
  const buffer = new Uint32Array(1);
  return {
    id: "crypto",
    label: "Crypto (CSPRNG)",
    description: "Web Crypto getRandomValues — cryptographically secure.",
    nextFloat() {
      crypto.getRandomValues(buffer);
      return buffer[0] / UINT32_MAX;
    },
  };
}

/** Convenience source backed by the engine's Math.random. */
export function createMathSource() {
  return {
    id: "math",
    label: "Math.random",
    description: "Fast, non-cryptographic PRNG built into the JS engine.",
    nextFloat: () => Math.random(),
  };
}

/**
 * Deterministic, reproducible source (mulberry32). Same seed -> same sequence,
 * which is handy for debugging, demos and reproducible rolls.
 */
export function createSeededSource(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return {
    id: "seeded",
    label: "Seeded (mulberry32)",
    description: "Deterministic PRNG — identical rolls for a given seed.",
    reseed(newSeed) {
      state = newSeed >>> 0;
    },
    nextFloat() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_MAX;
    },
  };
}
