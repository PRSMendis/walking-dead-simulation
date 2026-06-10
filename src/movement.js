import {
  DIAGONAL_DIRECTIONS,
  ENTITY_TYPES,
  MOVEMENT_MODES,
  ORTHOGONAL_DIRECTIONS,
} from "./constants.js";

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

export function moveEntityToward(state, entity, targetPosition, events, targetId) {
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
    return false;
  }

  events.push(
    `${entity.id} moved from ${formatPosition(from)} to ${formatPosition(to)} toward ${targetId}.`,
  );
  return true;
}

export function findActivationTarget(state, entity) {
  if (entity.type === ENTITY_TYPES.SURVIVOR) {
    return findNearestTarget(
      entity.position,
      state.resources.filter((resource) => resource.claimedBy === null),
      state.rules.movement,
    );
  }

  return findNearestTarget(
    entity.position,
    state.entities.filter(
      (candidate) => candidate.type === ENTITY_TYPES.SURVIVOR && candidate.alive,
    ),
    state.rules.movement,
  );
}

export function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function positionKey(position) {
  return `${position.x},${position.y}`;
}

export function formatPosition(position) {
  return `(${position.x}, ${position.y})`;
}

export function isInBounds(position, gridSize) {
  return (
    position.x >= 0 &&
    position.x < gridSize &&
    position.y >= 0 &&
    position.y < gridSize
  );
}

export function comparePositions(a, b) {
  return a.y - b.y || a.x - b.x;
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
