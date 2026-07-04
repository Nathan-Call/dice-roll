/**
 * Proprietary dice randomizer.
 *
 * This module owns the single, swappable source of randomness for the whole
 * app. Everything rolls dice through `rollDie()`, which is built on the abstract
 * source contract (`async nextFloat`). Swap the source at runtime with
 * `setRandomSource('local' | 'atmospheric' | 'quantum')` and every future roll
 * uses the new source — no other code changes.
 */

import {
  createLocalSource,
  createAtmosphericSource,
  createQuantumSource,
} from "./randomSource.js";

/** Registry of built-in source factories, keyed by id. */
export const SOURCES = {
  local: createLocalSource,
  atmospheric: createAtmosphericSource,
  quantum: createQuantumSource,
};

/** The one place the active randomness source lives. */
let source = createLocalSource();

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
  // Let network sources warm their buffer before the first roll.
  source.prefetch?.();
  return source;
}

export function getRandomSource() {
  return source;
}

/**
 * A normalized snapshot of the active source for the UI indicator.
 * mode: 'local' (instant) | 'live' (serving fetched values) |
 *       'fetching' (buffer empty, request in flight) | 'fallback' (using local).
 */
export function getSourceStatus() {
  if (!source.status) {
    return { id: source.id, label: source.label, mode: "local", buffered: null };
  }
  const s = source.status();
  let mode;
  if (s.buffered > 0) mode = "live";
  else if (s.fetching) mode = "fetching";
  else mode = "fallback";
  return { id: source.id, label: source.label, mode, buffered: s.buffered };
}

/**
 * Draw an unbiased integer in [1, sides].
 *
 * `floor(x * sides)` is uniform for any well-distributed float in [0, 1),
 * regardless of the source's resolution (16-bit quantum values, 30-bit
 * atmospheric, 32-bit local), which a modulo/rejection scheme is not. The
 * `Math.min` guards the vanishingly rare case of x rounding up to 1.
 */
export async function randomInt(sides) {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`sides must be a positive integer, got ${sides}`);
  }
  const x = await source.nextFloat();
  return Math.min(sides - 1, Math.floor(x * sides)) + 1;
}

/** Roll a single die with the given number of sides. */
export function rollDie(sides) {
  return randomInt(sides);
}
