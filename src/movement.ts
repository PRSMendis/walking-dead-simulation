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

export function nextStepToward({
  from,
  target,
  gridSize,
  movement = MOVEMENT_MODES.ORTHOGONAL,
}: {
  from: Position;
  target: Position;
  gridSize: number;
  movement?: MovementMode;
}): Position {
  if (positionsEqual({ first: from, second: target })) {
    return { ...from };
  }

  const candidates = getDirections(movement).map((direction) => ({
    x: from.x + direction.x,
    y: from.y + direction.y,
  })).filter((position) => isInBounds({ position, gridSize }));

  candidates.sort((a, b) => {
    const distanceDelta =
      distanceForMovement({ first: a, second: target, movement }) -
      distanceForMovement({ first: b, second: target, movement });
    return distanceDelta || comparePositions({ first: a, second: b });
  });

  const best = candidates[0];
  if (
    !best ||
    distanceForMovement({ first: best, second: target, movement }) >=
      distanceForMovement({ first: from, second: target, movement })
  ) {
    return { ...from };
  }

  return best;
}

export function moveEntityToward({
  state,
  entity,
  targetPosition,
  events,
  targetId,
}: {
  state: SimulationState;
  entity: Entity;
  targetPosition: Position;
  events: string[];
  targetId: string;
}): boolean {
  const from = { ...entity.position };
  const to = nextStepToward({
    from,
    target: targetPosition,
    gridSize: state.gridSize,
    movement: state.rules.movement,
  });
  entity.position = to;

  if (positionsEqual({ first: from, second: to })) {
    events.push(`${entity.id} stayed at ${formatPosition(to)} near ${targetId}.`);
    return false;
  }

  events.push(
    `${entity.id} moved from ${formatPosition(from)} to ${formatPosition(to)} toward ${targetId}.`,
  );
  return true;
}

export function findActivationTarget({
  state,
  entity,
}: {
  state: SimulationState;
  entity: Entity;
}): Target | undefined {
  if (entity.type === ENTITY_TYPES.SURVIVOR) {
    return findNearestTarget({
      from: entity.position,
      targets: state.resources.filter((resource) => resource.claimedBy === null),
      movement: state.rules.movement,
    });
  }

  return findNearestTarget({
    from: entity.position,
    targets: state.entities.filter(
      (candidate) => candidate.type === ENTITY_TYPES.SURVIVOR && candidate.alive,
    ),
    movement: state.rules.movement,
  });
}

export function positionsEqual({
  first,
  second,
}: {
  first: Position;
  second: Position;
}): boolean {
  return first.x === second.x && first.y === second.y;
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function formatPosition(position: Position): string {
  return `(${position.x}, ${position.y})`;
}

export function isInBounds({
  position,
  gridSize,
}: {
  position: Position;
  gridSize: number;
}): boolean {
  return (
    position.x >= 0 &&
    position.x < gridSize &&
    position.y >= 0 &&
    position.y < gridSize
  );
}

export function comparePositions({
  first,
  second,
}: {
  first: Position;
  second: Position;
}): number {
  return first.y - second.y || first.x - second.x;
}

function findNearestTarget<TargetType extends Target>({
  from,
  targets,
  movement,
}: {
  from: Position;
  targets: TargetType[];
  movement: MovementMode;
}): TargetType | undefined {
  return [...targets].sort((a, b) => {
    const distanceDelta =
      distanceForMovement({ first: from, second: a.position, movement }) -
      distanceForMovement({ first: from, second: b.position, movement });
    return (
      distanceDelta ||
      comparePositions({ first: a.position, second: b.position }) ||
      a.id.localeCompare(b.id)
    );
  })[0];
}

function manhattanDistance({
  first,
  second,
}: {
  first: Position;
  second: Position;
}): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function chebyshevDistance({
  first,
  second,
}: {
  first: Position;
  second: Position;
}): number {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function distanceForMovement({
  first,
  second,
  movement,
}: {
  first: Position;
  second: Position;
  movement: MovementMode;
}): number {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return chebyshevDistance({ first, second });
  }

  return manhattanDistance({ first, second });
}

function getDirections(movement: MovementMode): readonly Position[] {
  if (movement === MOVEMENT_MODES.DIAGONAL) {
    return DIAGONAL_DIRECTIONS;
  }

  return ORTHOGONAL_DIRECTIONS;
}
