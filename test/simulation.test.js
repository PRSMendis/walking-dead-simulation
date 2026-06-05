import test from "node:test";
import assert from "node:assert/strict";
import {
  GROUPS,
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
