export const GROUPS = Object.freeze({
  LAB: "Lab",
  PRECINCT: "Precinct",
});

export const ENTITY_TYPES = Object.freeze({
  SURVIVOR: "survivor",
  WALKER: "walker",
});

export const MOVEMENT_MODES = Object.freeze({
  ORTHOGONAL: "orthogonal",
  DIAGONAL: "diagonal",
});

export const RESOURCE_OWNERSHIP = Object.freeze({
  CLAIMED_ON_TOUCH: "claimed-on-touch",
  DROPPED_ON_DEATH: "dropped-on-death",
});

export const ACTIVATION_PARTICIPANTS = Object.freeze({
  LAB: GROUPS.LAB,
  PRECINCT: GROUPS.PRECINCT,
  WALKER: "Walker",
});

export const INTERACTION_TIMING = Object.freeze({
  AFTER_EACH_STEP: "after-each-step",
  AFTER_ACTIVATION: "after-activation",
});

export const DEFAULT_MAX_TURNS = 100;
export const PARK_MILLER_MULTIPLIER = 16807;
export const PARK_MILLER_MODULUS = 2147483647;
export const PARK_MILLER_MAX_RANDOM_VALUE = PARK_MILLER_MODULUS - 1;

export const DEFAULT_RULES: Readonly<Rules> = Object.freeze({
  movement: MOVEMENT_MODES.ORTHOGONAL,
  activation: Object.freeze({
    labMoveSteps: 1,
    precinctMoveSteps: 1,
    walkerMoveSteps: 1,
    interactionTiming: INTERACTION_TIMING.AFTER_EACH_STEP,
  }),
  combat: Object.freeze({
    survivorKillWalkerChance: 0.5,
    interGroupSurvivorKillChance: 0,
    randomSeed: 1,
  }),
  activationOrder: [
    ACTIVATION_PARTICIPANTS.LAB,
    ACTIVATION_PARTICIPANTS.PRECINCT,
    ACTIVATION_PARTICIPANTS.WALKER,
  ] satisfies ActivationParticipant[],
  resourceOwnership: RESOURCE_OWNERSHIP.DROPPED_ON_DEATH,
});

export const ORTHOGONAL_DIRECTIONS: readonly Position[] = Object.freeze([
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]);

export const DIAGONAL_DIRECTIONS: readonly Position[] = Object.freeze([
  ...ORTHOGONAL_DIRECTIONS,
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
]);
import type {
  ActivationParticipant,
  Position,
  Rules,
} from "./types.js";
