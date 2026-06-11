import {
  DIAGONAL_DIRECTIONS,
  ENTITY_TYPES,
  MOVEMENT_MODES,
  ORTHOGONAL_DIRECTIONS,
} from "./constants.js";
import type {
  Entity,
  MovementMode,
  Position,
  SimulationState,
  Target,
} from "./types.js";

export function nextStepToward(
  from: Position,
  target: Position,
  gridSize: number,
  movement: MovementMode = MOVEMENT_MODES.ORTHOGONAL,
): Position {
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

export function moveEntityToward(
  state: SimulationState,
  entity: Entity,
  targetPosition: Position,
  events: string[],
  targetId: string,
): boolean {
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

export function findActivationTarget(
  state: SimulationState,
  entity: Entity,
): Target | undefined {
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

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function formatPosition(position: Position): string {
  return `(${position.x}, ${position.y})`;
}

export function isInBounds(position: Position, gridSize: number): boolean {
  return (
    position.x >= 0 &&
    position.x < gridSize &&
    position.y >= 0 &&
    position.y < gridSize
  );
}

export function comparePositions(a: Position, b: Position): number {
  return a.y - b.y || a.x - b.x;
}

function findNearestTarget<TargetType extends Target>(
  from: Position,
  targets: TargetType[],
  movement: MovementMode,
): TargetType | undefined {
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

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function distanceForMovement(
  a: Position,
  b: Position,
  movement: MovementMode,
): number {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return chebyshevDistance(a, b);
  }

  return manhattanDistance(a, b);
}

function getDirections(movement: MovementMode): readonly Position[] {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return DIAGONAL_DIRECTIONS;
  }

  return ORTHOGONAL_DIRECTIONS;
}
