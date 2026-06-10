import test from "node:test";
import assert from "node:assert/strict";
import {
  GROUPS,
  MOVEMENT_MODES,
  RESOURCE_OWNERSHIP,
  createInitialState,
  determineWinner,
  nextStepToward,
  runSimulation,
  validateScenario,
} from "../src/simulation.js";

test("nextStepToward moves one cell and stays inside the grid", () => {
  assert.deepEqual(nextStepToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 4), {
    x: 1,
    y: 0,
  });

  assert.deepEqual(nextStepToward({ x: 0, y: 0 }, { x: 0, y: -1 }, 4), {
    x: 0,
    y: 0,
  });
});

test("nextStepToward can use diagonal movement when configured", () => {
  assert.deepEqual(
    nextStepToward({ x: 0, y: 0 }, { x: 2, y: 2 }, 4, MOVEMENT_MODES.DIAGONAL),
    {
      x: 1,
      y: 1,
    },
  );
});

test("survivors claim resources for their group", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 1, y: 0 }],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.equal(result.winner, GROUPS.LAB);
  assert.equal(result.scores[GROUPS.LAB], 1);
  assert.equal(result.resources[0].claimedBy, GROUPS.LAB);
});

test("activation order can allow walkers to move before survivors", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    rules: {
      activationOrder: ["Walker", "Lab", "Precinct"],
    },
    walkers: [{ id: "W1", x: 1, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 1, y: 0 }],
  });

  assert.equal(result.reason, "No humans remain alive.");
  assert.equal(result.resources[0].claimedBy, null);
  assert.match(result.log[0].events[0], /W1 moved/);
});

test("walkers kill survivors occupying the same cell", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    walkers: [{ id: "W1", x: 1, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 2, y: 2 }],
  });

  assert.equal(result.reason, "No humans remain alive.");
  assert.equal(result.survivorsRemaining[GROUPS.LAB], 0);
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) was killed by W1/,
  );
});

test("claimed resources stay claimed by default if the claimant is later killed", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    walkers: [{ id: "W1", x: 2, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 2, y: 2 },
    ],
  });

  assert.equal(result.reason, "No humans remain alive.");
  assert.equal(
    result.resources.find((resource) => resource.id === "R1").claimedBy,
    GROUPS.LAB,
  );
});

test("claimed resources can be dropped when the claimant is killed", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    rules: {
      resourceOwnership: RESOURCE_OWNERSHIP.DROPPED_ON_DEATH,
    },
    walkers: [{ id: "W1", x: 2, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 2, y: 2 },
    ],
  });

  const droppedResource = result.resources.find((resource) => resource.id === "R1");
  assert.equal(result.reason, "No humans remain alive.");
  assert.equal(droppedResource.claimedBy, null);
  assert.deepEqual(droppedResource.position, { x: 1, y: 0 });
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /L1 dropped R1/,
  );
});

test("winner falls back to living survivors when resource score is tied", () => {
  const state = createInitialState({
    gridSize: 3,
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [
      { id: "P1", x: 1, y: 1 },
      { id: "P2", x: 2, y: 2 },
    ],
    resources: [],
  });

  assert.equal(determineWinner(state), GROUPS.PRECINCT);
});

test("scenario validation rejects out-of-bounds positions", () => {
  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        walkers: [{ id: "W1", x: 2, y: 0 }],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /outside the grid/,
  );
});

test("scenario validation rejects invalid rules", () => {
  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        rules: {
          movement: "teleport",
        },
        walkers: [],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /rules\.movement/,
  );
});

test("the sample scenario produces a coherent finished simulation", () => {
  const result = runSimulation({
    gridSize: 4,
    maxTurns: 10,
    walkers: [{ id: "W1", x: 1, y: 1 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [{ id: "P1", x: 3, y: 3 }],
    resources: [
      { id: "R1", x: 0, y: 1 },
      { id: "R2", x: 3, y: 2 },
    ],
  });

  assert.ok(["Lab", "Precinct", "Draw"].includes(result.winner));
  assert.ok(result.turns > 0);
  assert.ok(result.log.length > 0);
});
