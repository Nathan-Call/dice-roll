/**
 * Proprietary dice randomizer.
 *
 * This module owns the single, swappable source of randomness for the whole
 * app. Everything rolls dice through `rollDie()`, which is built on the
 * abstract source contract (`nextFloat`). Swap the source at runtime with
 * `setRandomSource('crypto' | 'math' | 'seeded')` and every future roll uses
 * the new source — no other code changes.
 */

import { createCryptoSource, createMathSource, createSeededSource } from "./randomSource.js";

/** Registry of built-in source factories, keyed by id. */
export const SOURCES = {
  crypto: createCryptoSource,
  math: createMathSource,
  seeded: createSeededSource,
};

/** The one place the active randomness source lives. */
let source = createCryptoSource();

/**
 * Swap the active randomness source.
 * @param {string|object} idOrSource  A registry id, or a custom source object.
 * @param  {...any} args               Extra args forwarded to the factory.
 * @returns the newly-active source.
 */
export function setRandomSource(idOrSource, ...args) {
  if (typeof idOrSource === "string") {
    const factory = SOURCES[idOrSource];
    if (!factory) throw new Error(`Unknown random source: "${idOrSource}"`);
    source = factory(...args);
  } else if (idOrSource && typeof idOrSource.nextFloat === "function") {
    source = idOrSource;
  } else {
    throw new Error("A random source must implement nextFloat().");
  }
  return source;
}

export function getRandomSource() {
  return source;
}

/**
 * Draw an unbiased integer in [1, sides].
 *
 * We rejection-sample the source so that any tiny bias from the top of the
 * float range is discarded, giving a clean uniform distribution over the faces
 * regardless of which source is plugged in.
 */
export function randomInt(sides) {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`sides must be a positive integer, got ${sides}`);
  }
  // Reject values that would land in a short, unevenly-sized final bucket.
  const limit = Math.floor(UINT_SPACE / sides) * sides;
  let scaled;
  do {
    scaled = Math.floor(source.nextFloat() * UINT_SPACE);
  } while (scaled >= limit);
  return (scaled % sides) + 1;
}

const UINT_SPACE = 0x100000000; // 2^32 sampling space for rejection sampling

/** Roll a single die with the given number of sides. */
export function rollDie(sides) {
  return randomInt(sides);
}
