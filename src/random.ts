import {
  PARK_MILLER_MAX_RANDOM_VALUE,
  PARK_MILLER_MODULUS,
  PARK_MILLER_MULTIPLIER,
} from "./constants.js";

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
