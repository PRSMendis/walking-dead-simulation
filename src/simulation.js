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

const DEFAULT_MAX_TURNS = 100;

const DEFAULT_RULES = Object.freeze({
  movement: MOVEMENT_MODES.ORTHOGONAL,
  activationOrder: Object.freeze([
    ACTIVATION_PARTICIPANTS.LAB,
    ACTIVATION_PARTICIPANTS.PRECINCT,
    ACTIVATION_PARTICIPANTS.WALKER,
  ]),
  resourceOwnership: RESOURCE_OWNERSHIP.CLAIMED_ON_TOUCH,
});

const ORTHOGONAL_DIRECTIONS = Object.freeze([
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]);

const DIAGONAL_DIRECTIONS = Object.freeze([
  ...ORTHOGONAL_DIRECTIONS,
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
]);

export function runSimulation(scenario) {
  validateScenario(scenario);

  const state = createInitialState(scenario);
  const maxTurns = scenario.maxTurns ?? DEFAULT_MAX_TURNS;
  const log = [];

  const initialEvents = [];
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
    const events = [];
    const activationOrder = getActivationOrder(state);

    for (const entityId of activationOrder) {
      const entity = state.entities.find((candidate) => candidate.id === entityId);
      if (!entity?.alive) {
        continue;
      }

      activateEntity(state, entity, events);
      resolveInteractions(state, events, entity.id);

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
    rules: { ...state.rules, activationOrder: [...state.rules.activationOrder] },
    log,
  };
}

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
  return {
    gridSize: scenario.gridSize,
    rules: normalizeRules(scenario.rules),
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

export function nextStepToward(
  from,
  target,
  gridSize,
  movement = MOVEMENT_MODES.ORTHOGONAL,
) {
  if (positionsEqual(from, target)) {
    return { ...from };
  }

  const candidates = getDirections(movement).map((direction) => ({
    x: from.x + direction.x,
    y: from.y + direction.y,
  })).filter((position) => isInBounds(position, gridSize));

  candidates.sort((a, b) => {
    const distanceDelta =
      distanceForMovement(a, target, movement) -
      distanceForMovement(b, target, movement);
    return distanceDelta || comparePositions(a, b);
  });

  const best = candidates[0];
  if (
    !best ||
    distanceForMovement(best, target, movement) >=
      distanceForMovement(from, target, movement)
  ) {
    return { ...from };
  }

  return best;
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

function createSurvivor(survivor, group) {
  return {
    id: survivor.id,
    type: ENTITY_TYPES.SURVIVOR,
    group,
    position: { x: survivor.x, y: survivor.y },
    alive: true,
  };
}

function activateEntity(state, entity, events) {
  if (entity.type === ENTITY_TYPES.SURVIVOR) {
    activateSurvivor(state, entity, events);
    return;
  }

  activateWalker(state, entity, events);
}

function activateSurvivor(state, survivor, events) {
  const target = findNearestTarget(
    survivor.position,
    state.resources.filter((resource) => resource.claimedBy === null),
    state.rules.movement,
  );

  if (!target) {
    events.push(`${survivor.id} had no unclaimed resources to pursue.`);
    return;
  }

  moveEntityToward(state, survivor, target.position, events, target.id);
}

function activateWalker(state, walker, events) {
  const target = findNearestTarget(
    walker.position,
    state.entities.filter(
      (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
    ),
    state.rules.movement,
  );

  if (!target) {
    events.push(`${walker.id} had no living humans to pursue.`);
    return;
  }

  moveEntityToward(state, walker, target.position, events, target.id);
}

function moveEntityToward(state, entity, targetPosition, events, targetId) {
  const from = { ...entity.position };
  const to = nextStepToward(
    from,
    targetPosition,
    state.gridSize,
    state.rules.movement,
  );
  entity.position = to;

  if (positionsEqual(from, to)) {
    events.push(`${entity.id} stayed at ${formatPosition(to)} near ${targetId}.`);
    return;
  }

  events.push(
    `${entity.id} moved from ${formatPosition(from)} to ${formatPosition(to)} toward ${targetId}.`,
  );
}

function resolveInteractions(state, events, actorId = null) {
  for (const cell of occupiedCells(state.entities)) {
    const walkers = cell.entities.filter(
      (entity) => entity.type === ENTITY_TYPES.WALKER && entity.alive,
    );
    const survivors = cell.entities.filter(
      (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
    );

    if (walkers.length > 0 && survivors.length > 0) {
      for (const survivor of survivors) {
        killSurvivor(state, survivor, walkers, events);
      }
    }
  }

  for (const resource of state.resources) {
    if (resource.claimedBy !== null) {
      continue;
    }

    const survivorsAtResource = state.entities
      .filter(
        (entity) =>
          entity.type === ENTITY_TYPES.SURVIVOR &&
          entity.alive &&
          positionsEqual(entity.position, resource.position),
      )
      .sort((a, b) => compareEntities(a, b, state.rules.activationOrder));

    if (survivorsAtResource.length === 0) {
      continue;
    }

    const actor = survivorsAtResource.find((survivor) => survivor.id === actorId);
    const claimant = actor ?? survivorsAtResource[0];
    resource.claimedBy = claimant.group;
    resource.claimedByEntityId = claimant.id;
    events.push(
      `${claimant.id} claimed ${resource.id} for ${claimant.group} at ${formatPosition(resource.position)}.`,
    );
  }
}

function getActivationOrder(state) {
  return state.entities
    .filter((entity) => entity.alive)
    .sort((a, b) => compareEntities(a, b, state.rules.activationOrder))
    .map((entity) => entity.id);
}

function compareEntities(a, b, activationOrder) {
  const activationIndexes = new Map(
    activationOrder.map((participant, index) => [participant, index]),
  );
  const orderDelta =
    activationIndexes.get(getActivationParticipant(a)) -
    activationIndexes.get(getActivationParticipant(b));
  return orderDelta || a.id.localeCompare(b.id);
}

function findNearestTarget(from, targets, movement) {
  return [...targets].sort((a, b) => {
    const distanceDelta =
      distanceForMovement(from, a.position, movement) -
      distanceForMovement(from, b.position, movement);
    return (
      distanceDelta ||
      comparePositions(a.position, b.position) ||
      a.id.localeCompare(b.id)
    );
  })[0];
}

function killSurvivor(state, survivor, walkers, events) {
  survivor.alive = false;
  events.push(
    `${survivor.id} (${survivor.group}) was killed by ${walkers.map((walker) => walker.id).join(", ")} at ${formatPosition(survivor.position)}.`,
  );

  if (state.rules.resourceOwnership !== RESOURCE_OWNERSHIP.DROPPED_ON_DEATH) {
    return;
  }

  for (const resource of state.resources) {
    if (resource.claimedByEntityId !== survivor.id) {
      continue;
    }

    resource.claimedBy = null;
    resource.claimedByEntityId = null;
    resource.position = { ...survivor.position };
    events.push(
      `${survivor.id} dropped ${resource.id}; it is now unclaimed at ${formatPosition(resource.position)}.`,
    );
  }
}

function occupiedCells(entities) {
  const cells = new Map();
  for (const entity of entities.filter((candidate) => candidate.alive)) {
    const key = positionKey(entity.position);
    const cell = cells.get(key) ?? { position: entity.position, entities: [] };
    cell.entities.push(entity);
    cells.set(key, cell);
  }
  return cells.values();
}

function isComplete(state) {
  return allResourcesClaimed(state) || noHumansRemain(state);
}

function getEndReason(state, turn, maxTurns) {
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

function allResourcesClaimed(state) {
  return state.resources.every((resource) => resource.claimedBy !== null);
}

function noHumansRemain(state) {
  return !state.entities.some(
    (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
  );
}

function getScores(state) {
  return {
    [GROUPS.LAB]: state.resources.filter((resource) => resource.claimedBy === GROUPS.LAB)
      .length,
    [GROUPS.PRECINCT]: state.resources.filter(
      (resource) => resource.claimedBy === GROUPS.PRECINCT,
    ).length,
  };
}

function getSurvivorsRemaining(state) {
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

function buildSummary(state) {
  return {
    scores: getScores(state),
    survivorsRemaining: getSurvivorsRemaining(state),
    resourcesClaimed: state.resources.filter((resource) => resource.claimedBy !== null)
      .length,
    resourcesTotal: state.resources.length,
  };
}

function normalizeRules(rules = {}) {
  if (rules === undefined) {
    return {
      ...DEFAULT_RULES,
      activationOrder: [...DEFAULT_RULES.activationOrder],
    };
  }

  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    throw new Error("rules must be an object when provided.");
  }

  const normalized = {
    movement: rules.movement ?? DEFAULT_RULES.movement,
    activationOrder: rules.activationOrder ?? [...DEFAULT_RULES.activationOrder],
    resourceOwnership: rules.resourceOwnership ?? DEFAULT_RULES.resourceOwnership,
  };

  validateMovementRule(normalized.movement);
  validateActivationOrder(normalized.activationOrder);
  validateResourceOwnership(normalized.resourceOwnership);

  return {
    ...normalized,
    activationOrder: [...normalized.activationOrder],
  };
}

function validateMovementRule(movement) {
  if (!Object.values(MOVEMENT_MODES).includes(movement)) {
    throw new Error(
      `rules.movement must be one of: ${Object.values(MOVEMENT_MODES).join(", ")}.`,
    );
  }
}

function validateActivationOrder(activationOrder) {
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

function validateResourceOwnership(resourceOwnership) {
  if (!Object.values(RESOURCE_OWNERSHIP).includes(resourceOwnership)) {
    throw new Error(
      `rules.resourceOwnership must be one of: ${Object.values(RESOURCE_OWNERSHIP).join(", ")}.`,
    );
  }
}

function assertPositionInBounds(position, gridSize, id) {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    throw new Error(`${id} must have integer x and y coordinates.`);
  }

  if (!isInBounds(position, gridSize)) {
    throw new Error(`${id} position ${formatPosition(position)} is outside the grid.`);
  }
}

function isInBounds(position, gridSize) {
  return (
    position.x >= 0 &&
    position.x < gridSize &&
    position.y >= 0 &&
    position.y < gridSize
  );
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function distanceForMovement(a, b, movement) {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return chebyshevDistance(a, b);
  }

  return manhattanDistance(a, b);
}

function getDirections(movement) {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return DIAGONAL_DIRECTIONS;
  }

  return ORTHOGONAL_DIRECTIONS;
}

function getActivationParticipant(entity) {
  if (entity.type === ENTITY_TYPES.WALKER) {
    return ACTIVATION_PARTICIPANTS.WALKER;
  }

  return entity.group;
}

function comparePositions(a, b) {
  return a.y - b.y || a.x - b.x;
}

function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function formatPosition(position) {
  return `(${position.x}, ${position.y})`;
}
