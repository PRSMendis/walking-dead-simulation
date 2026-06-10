import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  GROUPS,
  INTERACTION_TIMING,
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
      combat: {
        survivorKillWalkerChance: 0,
      },
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

test("activation move steps can be configured per group and entity type", () => {
  const result = runSimulation({
    gridSize: 6,
    maxTurns: 1,
    rules: {
      activation: {
        labMoveSteps: 1,
        precinctMoveSteps: 2,
        walkerMoveSteps: 3,
      },
      resourceOwnership: RESOURCE_OWNERSHIP.CLAIMED_ON_TOUCH,
    },
    walkers: [{ id: "W1", x: 5, y: 5 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [{ id: "P1", x: 0, y: 5 }],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 2, y: 5 },
      { id: "R3", x: 5, y: 0 },
    ],
  });

  assert.equal(result.turns, 1);
  assert.equal(
    result.resources.find((resource) => resource.id === "R1").claimedBy,
    GROUPS.LAB,
  );
  assert.equal(
    result.resources.find((resource) => resource.id === "R2").claimedBy,
    GROUPS.PRECINCT,
  );
  assert.match(
    result.log[0].events.join("\n"),
    /W1 moved from \(5, 5\) to \(4, 5\).*W1 moved from \(4, 5\) to \(3, 5\).*W1 moved from \(3, 5\) to \(2, 5\)/s,
  );
});

test("survivorMoveSteps remains a backwards-compatible activation shortcut", () => {
  const result = runSimulation({
    gridSize: 5,
    maxTurns: 5,
    rules: {
      activation: {
        survivorMoveSteps: 2,
      },
    },
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [{ id: "P1", x: 0, y: 4 }],
    resources: [
      { id: "R1", x: 2, y: 0 },
      { id: "R2", x: 2, y: 4 },
    ],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.equal(result.turns, 1);
  assert.equal(
    result.resources.find((resource) => resource.id === "R1").claimedBy,
    GROUPS.LAB,
  );
  assert.equal(
    result.resources.find((resource) => resource.id === "R2").claimedBy,
    GROUPS.PRECINCT,
  );
});

test("interaction timing can resolve after the whole activation", () => {
  const result = runSimulation({
    gridSize: 4,
    maxTurns: 5,
    rules: {
      activation: {
        labMoveSteps: 2,
        interactionTiming: INTERACTION_TIMING.AFTER_ACTIVATION,
      },
    },
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 1, y: 0 }],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.equal(result.turns, 1);
  assert.match(
    result.log[0].events.join("\n"),
    /L1 moved from \(0, 0\) to \(1, 0\).*L1 stayed at \(1, 0\).*L1 claimed R1/s,
  );
});

test("walkers kill survivors occupying the same cell", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    rules: {
      combat: {
        survivorKillWalkerChance: 0,
      },
    },
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

test("survivors can kill walkers when combat chance succeeds", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 1,
    rules: {
      combat: {
        survivorKillWalkerChance: 1,
      },
    },
    walkers: [{ id: "W1", x: 0, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 2, y: 2 }],
  });

  assert.equal(result.survivorsRemaining[GROUPS.LAB], 1);
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) killed W1/,
  );
});

test("claimed resources can stay claimed if configured as claimed-on-touch", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    rules: {
      combat: {
        survivorKillWalkerChance: 0,
      },
      resourceOwnership: RESOURCE_OWNERSHIP.CLAIMED_ON_TOUCH,
    },
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

test("claimed resources are dropped by default when the claimant is killed", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 5,
    rules: {
      combat: {
        survivorKillWalkerChance: 0,
      },
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

  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        rules: {
          activation: {
            walkerMoveSteps: 0,
          },
        },
        walkers: [],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /rules\.activation\.walkerMoveSteps/,
  );

  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        rules: {
          activation: {
            precinctMoveSteps: 0,
          },
        },
        walkers: [],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /rules\.activation\.precinctMoveSteps/,
  );

  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        rules: {
          combat: {
            survivorKillWalkerChance: 1.5,
          },
        },
        walkers: [],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /rules\.combat\.survivorKillWalkerChance/,
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

test("all sample scenarios run successfully", async () => {
  const sampleDir = new URL("../sample", import.meta.url);
  const sampleFiles = (await readdir(sampleDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  assert.deepEqual(sampleFiles, [
    "diagonal-movement.json",
    "fast-walkers.json",
    "scenario.json",
    "walker-first.json",
  ]);

  for (const sampleFile of sampleFiles) {
    const samplePath = join(sampleDir.pathname, sampleFile);
    const scenario = JSON.parse(await readFile(samplePath, "utf8"));
    const result = runSimulation(scenario);

    assert.ok(
      ["Lab", "Precinct", "Draw"].includes(result.winner),
      `${sampleFile} should produce a valid winner`,
    );
    assert.ok(result.log.length > 0, `${sampleFile} should produce a turn log`);
  }
});
