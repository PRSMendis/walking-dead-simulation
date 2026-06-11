import {
  ACTIVATION_PARTICIPANTS,
  DEFAULT_RULES,
  INTERACTION_TIMING,
  MOVEMENT_MODES,
  RESOURCE_OWNERSHIP,
} from "./constants.js";
import type {
  ActivationParticipant,
  ActivationRuleInput,
  ActivationRules,
  CombatRuleInput,
  CombatRules,
  InteractionTiming,
  MovementMode,
  PartialRules,
  ResourceOwnership,
  Rules,
} from "./types.js";

export function normalizeRules(rules: PartialRules | undefined = {}): Rules {
  if (rules === undefined) {
    return {
      ...DEFAULT_RULES,
      activation: { ...DEFAULT_RULES.activation },
      combat: { ...DEFAULT_RULES.combat },
      activationOrder: [...DEFAULT_RULES.activationOrder],
    };
  }

  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    throw new Error("rules must be an object when provided.");
  }

  const normalized = {
    movement: rules.movement ?? DEFAULT_RULES.movement,
    activation: normalizeActivationRule(rules.activation),
    combat: normalizeCombatRule(rules.combat),
    activationOrder: rules.activationOrder ?? [...DEFAULT_RULES.activationOrder],
    resourceOwnership: rules.resourceOwnership ?? DEFAULT_RULES.resourceOwnership,
  };

  validateMovementRule(normalized.movement);
  validateActivationRule(normalized.activation);
  validateCombatRule(normalized.combat);
  validateActivationOrder(normalized.activationOrder);
  validateResourceOwnership(normalized.resourceOwnership);

  return cloneRules(normalized);
}

export function cloneRules(rules: Rules): Rules {
  return {
    movement: rules.movement,
    activation: { ...rules.activation },
    combat: { ...rules.combat },
    activationOrder: [...rules.activationOrder],
    resourceOwnership: rules.resourceOwnership,
  };
}

function normalizeActivationRule(
  activation: ActivationRuleInput | undefined = {},
): ActivationRules {
  if (activation === undefined) {
    return { ...DEFAULT_RULES.activation };
  }

  if (!activation || typeof activation !== "object" || Array.isArray(activation)) {
    throw new Error("rules.activation must be an object when provided.");
  }

  return {
    labMoveSteps:
      activation.labMoveSteps ??
      activation.survivorMoveSteps ??
      DEFAULT_RULES.activation.labMoveSteps,
    precinctMoveSteps:
      activation.precinctMoveSteps ??
      activation.survivorMoveSteps ??
      DEFAULT_RULES.activation.precinctMoveSteps,
    walkerMoveSteps:
      activation.walkerMoveSteps ?? DEFAULT_RULES.activation.walkerMoveSteps,
    interactionTiming:
      activation.interactionTiming ?? DEFAULT_RULES.activation.interactionTiming,
  };
}

function normalizeCombatRule(combat: CombatRuleInput | undefined = {}): CombatRules {
  if (combat === undefined) {
    return { ...DEFAULT_RULES.combat };
  }

  if (!combat || typeof combat !== "object" || Array.isArray(combat)) {
    throw new Error("rules.combat must be an object when provided.");
  }

  return {
    survivorKillWalkerChance:
      combat.survivorKillWalkerChance ??
      DEFAULT_RULES.combat.survivorKillWalkerChance,
    interGroupSurvivorKillChance:
      combat.interGroupSurvivorKillChance ??
      DEFAULT_RULES.combat.interGroupSurvivorKillChance,
    randomSeed: combat.randomSeed ?? DEFAULT_RULES.combat.randomSeed,
  };
}

function validateMovementRule(movement: MovementMode): void {
  if (!Object.values(MOVEMENT_MODES).includes(movement)) {
    throw new Error(
      `rules.movement must be one of: ${Object.values(MOVEMENT_MODES).join(", ")}.`,
    );
  }
}

function validateActivationRule(activation: ActivationRules): void {
  validatePositiveIntegerRule(
    activation.labMoveSteps,
    "rules.activation.labMoveSteps",
  );
  validatePositiveIntegerRule(
    activation.precinctMoveSteps,
    "rules.activation.precinctMoveSteps",
  );
  validatePositiveIntegerRule(
    activation.walkerMoveSteps,
    "rules.activation.walkerMoveSteps",
  );

  if (!Object.values(INTERACTION_TIMING).includes(activation.interactionTiming)) {
    throw new Error(
      `rules.activation.interactionTiming must be one of: ${Object.values(INTERACTION_TIMING).join(", ")}.`,
    );
  }
}

function validateCombatRule(combat: CombatRules): void {
  if (
    typeof combat.survivorKillWalkerChance !== "number" ||
    combat.survivorKillWalkerChance < 0 ||
    combat.survivorKillWalkerChance > 1
  ) {
    throw new Error("rules.combat.survivorKillWalkerChance must be between 0 and 1.");
  }

  if (
    typeof combat.interGroupSurvivorKillChance !== "number" ||
    combat.interGroupSurvivorKillChance < 0 ||
    combat.interGroupSurvivorKillChance > 1
  ) {
    throw new Error("rules.combat.interGroupSurvivorKillChance must be between 0 and 1.");
  }

  if (!Number.isInteger(combat.randomSeed)) {
    throw new Error("rules.combat.randomSeed must be an integer.");
  }
}

function validatePositiveIntegerRule(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function validateActivationOrder(activationOrder: ActivationParticipant[]): void {
  const validParticipants = Object.values(ACTIVATION_PARTICIPANTS);

  if (!Array.isArray(activationOrder)) {
    throw new Error("rules.activationOrder must be an array.");
  }

  if (activationOrder.length !== validParticipants.length) {
    throw new Error(
      `rules.activationOrder must include exactly: ${validParticipants.join(", ")}.`,
    );
  }

  const seen = new Set();
  for (const participant of activationOrder) {
    if (!validParticipants.includes(participant)) {
      throw new Error(
        `rules.activationOrder contains unknown participant: ${participant}.`,
      );
    }

    if (seen.has(participant)) {
      throw new Error(
        `rules.activationOrder contains duplicate participant: ${participant}.`,
      );
    }
    seen.add(participant);
  }
}

function validateResourceOwnership(resourceOwnership: ResourceOwnership): void {
  if (!Object.values(RESOURCE_OWNERSHIP).includes(resourceOwnership)) {
    throw new Error(
      `rules.resourceOwnership must be one of: ${Object.values(RESOURCE_OWNERSHIP).join(", ")}.`,
    );
  }
}
