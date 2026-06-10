import {
  ACTIVATION_PARTICIPANTS,
  ENTITY_TYPES,
  GROUPS,
} from "./constants.js";
import {
  formatPosition,
  isInBounds,
  positionKey,
} from "./movement.js";
import { createSeededRandom } from "./random.js";
import { normalizeRules } from "./rules.js";

export function validateScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    throw new Error("Scenario must be an object.");
  }

  if (!Number.isInteger(scenario.gridSize) || scenario.gridSize <= 0) {
    throw new Error("gridSize must be a positive integer.");
  }

  if (
    scenario.maxTurns !== undefined &&
    (!Number.isInteger(scenario.maxTurns) || scenario.maxTurns <= 0)
  ) {
    throw new Error("maxTurns must be a positive integer when provided.");
  }

  normalizeRules(scenario.rules);

  const collections = [
    ["walkers", scenario.walkers],
    ["labSurvivors", scenario.labSurvivors],
    ["precinctSurvivors", scenario.precinctSurvivors],
    ["resources", scenario.resources],
  ];

  for (const [name, collection] of collections) {
    if (!Array.isArray(collection)) {
      throw new Error(`${name} must be an array.`);
    }
  }

  const ids = new Set();
  for (const [name, collection] of collections) {
    for (const item of collection) {
      if (!item || typeof item !== "object") {
        throw new Error(`${name} entries must be objects.`);
      }

      if (typeof item.id !== "string" || item.id.trim() === "") {
        throw new Error(`${name} entries must have a non-empty string id.`);
      }

      if (ids.has(item.id)) {
        throw new Error(`Duplicate id found: ${item.id}.`);
      }
      ids.add(item.id);

      assertPositionInBounds({ x: item.x, y: item.y }, scenario.gridSize, item.id);
    }
  }
}

export function createInitialState(scenario) {
  const rules = normalizeRules(scenario.rules);
  return {
    gridSize: scenario.gridSize,
    rules,
    random: createSeededRandom(rules.combat.randomSeed),
    entities: [
      ...scenario.labSurvivors.map((survivor) =>
        createSurvivor(survivor, GROUPS.LAB),
      ),
      ...scenario.precinctSurvivors.map((survivor) =>
        createSurvivor(survivor, GROUPS.PRECINCT),
      ),
      ...scenario.walkers.map((walker) => ({
        id: walker.id,
        type: ENTITY_TYPES.WALKER,
        position: { x: walker.x, y: walker.y },
        alive: true,
      })),
    ],
    resources: scenario.resources.map((resource) => ({
      id: resource.id,
      position: { x: resource.x, y: resource.y },
      claimedBy: null,
      claimedByEntityId: null,
    })),
  };
}

export function determineWinner(state) {
  const scores = getScores(state);
  if (scores[GROUPS.LAB] > scores[GROUPS.PRECINCT]) {
    return GROUPS.LAB;
  }
  if (scores[GROUPS.PRECINCT] > scores[GROUPS.LAB]) {
    return GROUPS.PRECINCT;
  }

  const survivors = getSurvivorsRemaining(state);
  if (survivors[GROUPS.LAB] > survivors[GROUPS.PRECINCT]) {
    return GROUPS.LAB;
  }
  if (survivors[GROUPS.PRECINCT] > survivors[GROUPS.LAB]) {
    return GROUPS.PRECINCT;
  }

  return "Draw";
}

export function compareEntities(a, b, activationOrder) {
  const activationIndexes = new Map(
    activationOrder.map((participant, index) => [participant, index]),
  );
  const orderDelta =
    activationIndexes.get(getActivationParticipant(a)) -
    activationIndexes.get(getActivationParticipant(b));
  return orderDelta || a.id.localeCompare(b.id);
}

export function occupiedCells(entities) {
  const cells = new Map();
  for (const entity of entities.filter((candidate) => candidate.alive)) {
    const key = positionKey(entity.position);
    const cell = cells.get(key) ?? { position: entity.position, entities: [] };
    cell.entities.push(entity);
    cells.set(key, cell);
  }
  return cells.values();
}

export function isComplete(state) {
  return allResourcesClaimed(state) || noHumansRemain(state);
}

export function getEndReason(state, turn, maxTurns) {
  if (allResourcesClaimed(state)) {
    return "All resources have been claimed.";
  }

  if (noHumansRemain(state)) {
    return "No humans remain alive.";
  }

  if (turn >= maxTurns) {
    return `Reached maxTurns (${maxTurns}).`;
  }

  return "Simulation stopped.";
}

export function getScores(state) {
  return {
    [GROUPS.LAB]: state.resources.filter((resource) => resource.claimedBy === GROUPS.LAB)
      .length,
    [GROUPS.PRECINCT]: state.resources.filter(
      (resource) => resource.claimedBy === GROUPS.PRECINCT,
    ).length,
  };
}

export function getSurvivorsRemaining(state) {
  return {
    [GROUPS.LAB]: state.entities.filter(
      (entity) =>
        entity.type === ENTITY_TYPES.SURVIVOR && entity.group === GROUPS.LAB && entity.alive,
    ).length,
    [GROUPS.PRECINCT]: state.entities.filter(
      (entity) =>
        entity.type === ENTITY_TYPES.SURVIVOR &&
        entity.group === GROUPS.PRECINCT &&
        entity.alive,
    ).length,
  };
}

export function buildSummary(state) {
  return {
    scores: getScores(state),
    survivorsRemaining: getSurvivorsRemaining(state),
    resourcesClaimed: state.resources.filter((resource) => resource.claimedBy !== null)
      .length,
    resourcesTotal: state.resources.length,
  };
}

function createSurvivor(survivor, group) {
  return {
    id: survivor.id,
    type: ENTITY_TYPES.SURVIVOR,
    group,
    position: { x: survivor.x, y: survivor.y },
    alive: true,
  };
}

function allResourcesClaimed(state) {
  return state.resources.every((resource) => resource.claimedBy !== null);
}

function noHumansRemain(state) {
  return !state.entities.some(
    (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
  );
}

function getActivationParticipant(entity) {
  if (entity.type === ENTITY_TYPES.WALKER) {
    return ACTIVATION_PARTICIPANTS.WALKER;
  }

  return entity.group;
}

function assertPositionInBounds(position, gridSize, id) {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    throw new Error(`${id} must have integer x and y coordinates.`);
  }

  if (!isInBounds(position, gridSize)) {
    throw new Error(`${id} position ${formatPosition(position)} is outside the grid.`);
  }
}
