import {
  DEFAULT_MAX_TURNS,
  ENTITY_TYPES,
  GROUPS,
  INTERACTION_TIMING,
} from "./constants.js";
import { resolveInteractions } from "./interactions.js";
import {
  findActivationTarget,
  moveEntityToward,
} from "./movement.js";
import { cloneRules } from "./rules.js";
import {
  buildSummary,
  compareEntities,
  createInitialState,
  determineWinner,
  getEndReason,
  getScores,
  getSurvivorsRemaining,
  isComplete,
  validateScenario,
} from "./state.js";
import type {
  Entity,
  Scenario,
  SimulationResult,
  SimulationState,
  TurnLog,
} from "./types.js";

export function runSimulation(scenario: Scenario): SimulationResult {
  validateScenario(scenario);

  const state = createInitialState(scenario);
  const maxTurns = scenario.maxTurns ?? DEFAULT_MAX_TURNS;
  const log: TurnLog[] = [];

  const initialEvents: string[] = [];
  resolveInteractions(state, initialEvents);
  if (initialEvents.length > 0) {
    log.push({
      turn: 0,
      events: initialEvents,
      summary: buildSummary(state),
    });
  }

  let turn = 0;
  while (!isComplete(state) && turn < maxTurns) {
    turn += 1;
    const events: string[] = [];
    const activationOrder = getActivationOrder(state);

    for (const entityId of activationOrder) {
      const entity = state.entities.find((candidate) => candidate.id === entityId);
      if (!entity?.alive) {
        continue;
      }

      activateEntity(state, entity, events);

      if (isComplete(state)) {
        break;
      }
    }

    log.push({
      turn,
      events,
      summary: buildSummary(state),
    });
  }

  return {
    winner: determineWinner(state),
    reason: getEndReason(state, turn, maxTurns),
    turns: turn,
    scores: getScores(state),
    survivorsRemaining: getSurvivorsRemaining(state),
    resources: state.resources.map((resource) => ({
      id: resource.id,
      position: { ...resource.position },
      claimedBy: resource.claimedBy,
      claimedByEntityId: resource.claimedByEntityId,
    })),
    rules: cloneRules(state.rules),
    log,
  };
}

function activateEntity(
  state: SimulationState,
  entity: Entity,
  events: string[],
): void {
  const moveSteps = getMoveStepsForEntity(state, entity);

  for (let step = 0; step < moveSteps; step += 1) {
    const target = findActivationTarget(state, entity);

    if (!target) {
      events.push(getNoTargetEvent(entity));
      break;
    }

    const moved = moveEntityToward(
      state,
      entity,
      target.position,
      events,
      target.id,
    );

    if (
      state.rules.activation.interactionTiming ===
      INTERACTION_TIMING.AFTER_EACH_STEP
    ) {
      resolveInteractions(state, events, entity.id);
    }

    if (!entity.alive || isComplete(state) || !moved) {
      break;
    }
  }

  if (
    entity.alive &&
    state.rules.activation.interactionTiming ===
      INTERACTION_TIMING.AFTER_ACTIVATION
  ) {
    resolveInteractions(state, events, entity.id);
  }
}

function getActivationOrder(state: SimulationState): string[] {
  return state.entities
    .filter((entity) => entity.alive)
    .sort((a, b) => compareEntities(a, b, state.rules.activationOrder))
    .map((entity) => entity.id);
}

function getMoveStepsForEntity(state: SimulationState, entity: Entity): number {
  if (entity.type === ENTITY_TYPES.WALKER) {
    return state.rules.activation.walkerMoveSteps;
  }

  if (entity.group === GROUPS.LAB) {
    return state.rules.activation.labMoveSteps;
  }

  return state.rules.activation.precinctMoveSteps;
}

function getNoTargetEvent(entity: Entity): string {
  if (entity.type === ENTITY_TYPES.WALKER) {
    return `${entity.id} had no living humans to pursue.`;
  }

  return `${entity.id} had no unclaimed resources to pursue.`;
}
