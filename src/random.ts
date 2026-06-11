import {
  PARK_MILLER_MAX_RANDOM_VALUE,
  PARK_MILLER_MODULUS,
  PARK_MILLER_MULTIPLIER,
} from "./constants.js";
import type { ParkMillerConstants } from "./types.js";

/**
 * Returns the named constants used by the Park-Miller minimal standard
 * pseudo-random number generator.
 *
 * The generator advances state with `(state * multiplier) % modulus`, then
 * scales that state into the `[0, 1)` range using `maxRandomValue`.
 */
export function getParkMillerConstants(): ParkMillerConstants {
  return {
    multiplier: PARK_MILLER_MULTIPLIER,
    modulus: PARK_MILLER_MODULUS,
    maxRandomValue: PARK_MILLER_MAX_RANDOM_VALUE,
  };
}

export function createSeededRandom(seed: number): () => number {
  let state = Math.abs(seed) || 1;

  return () => {
    state = nextParkMillerState(state);
    return (state - 1) / PARK_MILLER_MAX_RANDOM_VALUE;
  };
}

function nextParkMillerState(state: number): number {
  return (state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
}
