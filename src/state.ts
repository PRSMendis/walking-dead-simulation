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
import type {
  ActivationParticipant,
  Entity,
  Group,
  OccupiedCell,
  Position,
  Scenario,
  ScenarioEntityInput,
  ScoreByGroup,
  SimulationState,
  SurvivorEntity,
  TurnSummary,
  Winner,
} from "./types.js";

export function validateScenario(scenario: unknown): asserts scenario is Scenario {
  if (!scenario || typeof scenario !== "object") {
    throw new Error("Scenario must be an object.");
  }

  const candidate = scenario as Partial<Scenario>;
  const gridSize = candidate.gridSize;

  if (typeof gridSize !== "number" || !Number.isInteger(gridSize) || gridSize <= 0) {
    throw new Error("gridSize must be a positive integer.");
  }

  if (
    candidate.maxTurns !== undefined &&
    (!Number.isInteger(candidate.maxTurns) || candidate.maxTurns <= 0)
  ) {
    throw new Error("maxTurns must be a positive integer when provided.");
  }

  normalizeRules(candidate.rules);

  const collections: Array<[string, unknown]> = [
    ["walkers", candidate.walkers],
    ["labSurvivors", candidate.labSurvivors],
    ["precinctSurvivors", candidate.precinctSurvivors],
    ["resources", candidate.resources],
  ];

  for (const [name, collection] of collections) {
    if (!Array.isArray(collection)) {
      throw new Error(`${name} must be an array.`);
    }
  }

  const ids = new Set<string>();
  for (const [name, collection] of collections) {
    if (!Array.isArray(collection)) {
      throw new Error(`${name} must be an array.`);
    }

    for (const item of collection) {
      if (!item || typeof item !== "object") {
        throw new Error(`${name} entries must be objects.`);
      }

      const itemCandidate = item as Partial<ScenarioEntityInput>;

      if (typeof itemCandidate.id !== "string" || itemCandidate.id.trim() === "") {
        throw new Error(`${name} entries must have a non-empty string id.`);
      }

      if (ids.has(itemCandidate.id)) {
        throw new Error(`Duplicate id found: ${itemCandidate.id}.`);
      }
      ids.add(itemCandidate.id);

      assertPositionInBounds(
        { x: itemCandidate.x, y: itemCandidate.y },
        gridSize,
        itemCandidate.id,
      );
    }
  }
}

export function createInitialState(scenario: Scenario): SimulationState {
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

export function determineWinner(state: SimulationState): Winner {
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

export function compareEntities(
  a: Entity,
  b: Entity,
  activationOrder: ActivationParticipant[],
): number {
  const activationIndexes = new Map(
    activationOrder.map((participant, index) => [participant, index]),
  );
  const orderDelta =
    (activationIndexes.get(getActivationParticipant(a)) ?? Number.MAX_SAFE_INTEGER) -
    (activationIndexes.get(getActivationParticipant(b)) ?? Number.MAX_SAFE_INTEGER);
  return orderDelta || a.id.localeCompare(b.id);
}

export function occupiedCells(entities: Entity[]): IterableIterator<OccupiedCell> {
  const cells = new Map<string, OccupiedCell>();
  for (const entity of entities.filter((candidate) => candidate.alive)) {
    const key = positionKey(entity.position);
    const cell = cells.get(key) ?? { position: entity.position, entities: [] };
    cell.entities.push(entity);
    cells.set(key, cell);
  }
  return cells.values();
}

export function isComplete(state: SimulationState): boolean {
  return allResourcesClaimed(state) || noHumansRemain(state);
}

export function getEndReason(
  state: SimulationState,
  turn: number,
  maxTurns: number,
): string {
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

export function getScores(state: SimulationState): ScoreByGroup {
  return {
    [GROUPS.LAB]: state.resources.filter((resource) => resource.claimedBy === GROUPS.LAB)
      .length,
    [GROUPS.PRECINCT]: state.resources.filter(
      (resource) => resource.claimedBy === GROUPS.PRECINCT,
    ).length,
  };
}

export function getSurvivorsRemaining(state: SimulationState): ScoreByGroup {
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

export function buildSummary(state: SimulationState): TurnSummary {
  return {
    scores: getScores(state),
    survivorsRemaining: getSurvivorsRemaining(state),
    resourcesClaimed: state.resources.filter((resource) => resource.claimedBy !== null)
      .length,
    resourcesTotal: state.resources.length,
  };
}

function createSurvivor(survivor: ScenarioEntityInput, group: Group): SurvivorEntity {
  return {
    id: survivor.id,
    type: ENTITY_TYPES.SURVIVOR,
    group,
    position: { x: survivor.x, y: survivor.y },
    alive: true,
  };
}

function allResourcesClaimed(state: SimulationState): boolean {
  return state.resources.every((resource) => resource.claimedBy !== null);
}

function noHumansRemain(state: SimulationState): boolean {
  return !state.entities.some(
    (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
  );
}

function getActivationParticipant(entity: Entity): ActivationParticipant {
  if (entity.type === ENTITY_TYPES.WALKER) {
    return ACTIVATION_PARTICIPANTS.WALKER;
  }

  return entity.group;
}

function assertPositionInBounds(
  position: { x: unknown; y: unknown },
  gridSize: number,
  id: string,
): void {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    throw new Error(`${id} must have integer x and y coordinates.`);
  }

  const validatedPosition = position as Position;
  if (!isInBounds(validatedPosition, gridSize)) {
    throw new Error(`${id} position ${formatPosition(validatedPosition)} is outside the grid.`);
  }
}
