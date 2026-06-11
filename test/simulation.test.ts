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
  getParkMillerConstants,
  nextStepToward,
  runSimulation,
  validateScenario,
} from "../src/simulation.js";
import type {
  CombatRuleInput,
  Scenario,
  ScoreByGroup,
  SimulationResult,
  Winner,
} from "../src/simulation.js";

test("nextStepToward moves one cell and stays inside the grid", () => {
  assert.deepEqual(
    nextStepToward({
      from: { x: 0, y: 0 },
      target: { x: 3, y: 0 },
      gridSize: 4,
    }),
    {
      x: 1,
      y: 0,
    },
  );

  assert.deepEqual(
    nextStepToward({
      from: { x: 0, y: 0 },
      target: { x: 0, y: -1 },
      gridSize: 4,
    }),
    {
      x: 0,
      y: 0,
    },
  );
});

test("nextStepToward can use diagonal movement when configured", () => {
  assert.deepEqual(
    nextStepToward({
      from: { x: 0, y: 0 },
      target: { x: 2, y: 2 },
      gridSize: 4,
      movement: MOVEMENT_MODES.DIAGONAL,
    }),
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

test("multiple survivors across groups can claim resources in the same turn", () => {
  const result = runSimulation({
    gridSize: 5,
    maxTurns: 1,
    walkers: [],
    labSurvivors: [
      { id: "L1", x: 0, y: 0 },
      { id: "L2", x: 0, y: 4 },
    ],
    precinctSurvivors: [
      { id: "P1", x: 4, y: 0 },
      { id: "P2", x: 4, y: 4 },
    ],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 1, y: 4 },
      { id: "R3", x: 3, y: 0 },
      { id: "R4", x: 3, y: 4 },
    ],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.deepEqual(result.scores, {
    [GROUPS.LAB]: 2,
    [GROUPS.PRECINCT]: 2,
  });
  assert.deepEqual(
    result.resources.map((resource) => [resource.id, resource.claimedBy]),
    [
      ["R1", GROUPS.LAB],
      ["R2", GROUPS.LAB],
      ["R3", GROUPS.PRECINCT],
      ["R4", GROUPS.PRECINCT],
    ],
  );
  assert.match(
    result.log[0]!.events.join("\n"),
    /L1 claimed R1.*L2 claimed R2.*P1 claimed R3.*P2 claimed R4/s,
  );
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
  assert.equal(result.resources[0]!.claimedBy, null);
  assert.match(result.log[0]!.events[0]!, /W1 moved/);
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
    result.resources.find((resource) => resource.id === "R1")!.claimedBy,
    GROUPS.LAB,
  );
  assert.equal(
    result.resources.find((resource) => resource.id === "R2")!.claimedBy,
    GROUPS.PRECINCT,
  );
  assert.match(
    result.log[0]!.events.join("\n"),
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
    result.resources.find((resource) => resource.id === "R1")!.claimedBy,
    GROUPS.LAB,
  );
  assert.equal(
    result.resources.find((resource) => resource.id === "R2")!.claimedBy,
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
    result.log[0]!.events.join("\n"),
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

test("multiple survivors can each kill one walker in the same occupied cell", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 1,
    rules: {
      combat: {
        survivorKillWalkerChance: 1,
      },
    },
    walkers: [
      { id: "W1", x: 0, y: 0 },
      { id: "W2", x: 0, y: 0 },
    ],
    labSurvivors: [
      { id: "L1", x: 0, y: 0 },
      { id: "L2", x: 0, y: 0 },
    ],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 2, y: 2 }],
  });

  assert.equal(result.survivorsRemaining[GROUPS.LAB], 2);
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) killed W1.*L2 \(Lab\) killed W2/s,
  );
});

test("Lab and Precinct survivors do not kill each other by default", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 1,
    walkers: [],
    labSurvivors: [{ id: "L1", x: 1, y: 1 }],
    precinctSurvivors: [{ id: "P1", x: 1, y: 1 }],
    resources: [{ id: "R1", x: 2, y: 2 }],
  });

  assert.equal(result.survivorsRemaining[GROUPS.LAB], 1);
  assert.equal(result.survivorsRemaining[GROUPS.PRECINCT], 1);
  assert.doesNotMatch(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /was killed by [LP]1/,
  );
});

test("Lab and Precinct survivors can kill each other when configured", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 1,
    rules: {
      combat: {
        interGroupSurvivorKillChance: 1,
      },
    },
    walkers: [],
    labSurvivors: [{ id: "L1", x: 1, y: 1 }],
    precinctSurvivors: [{ id: "P1", x: 1, y: 1 }],
    resources: [{ id: "R1", x: 2, y: 2 }],
  });

  assert.equal(result.survivorsRemaining[GROUPS.LAB], 1);
  assert.equal(result.survivorsRemaining[GROUPS.PRECINCT], 0);
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /P1 \(Precinct\) was killed by L1/,
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
    result.resources.find((resource) => resource.id === "R1")!.claimedBy,
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

  const droppedResource = result.resources.find((resource) => resource.id === "R1")!;
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

test("winner is decided by resource score before survivor count", () => {
  const result = runSimulation({
    gridSize: 5,
    maxTurns: 10,
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [
      { id: "P1", x: 4, y: 4 },
      { id: "P2", x: 4, y: 3 },
    ],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 2, y: 0 },
      { id: "R3", x: 3, y: 0 },
    ],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.equal(result.winner, GROUPS.LAB);
  assert.equal(result.scores[GROUPS.LAB], 3);
  assert.equal(result.survivorsRemaining[GROUPS.PRECINCT], 2);
});

test("larger mixed scenario handles multiple survivors, walkers, and resources", () => {
  const result = runSimulation({
    gridSize: 6,
    maxTurns: 4,
    rules: {
      combat: {
        survivorKillWalkerChance: 1,
        interGroupSurvivorKillChance: 0,
        randomSeed: 1,
      },
    },
    walkers: [
      { id: "W1", x: 2, y: 0 },
      { id: "W2", x: 3, y: 5 },
    ],
    labSurvivors: [
      { id: "L1", x: 0, y: 0 },
      { id: "L2", x: 0, y: 5 },
    ],
    precinctSurvivors: [
      { id: "P1", x: 5, y: 0 },
      { id: "P2", x: 5, y: 5 },
    ],
    resources: [
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 1, y: 5 },
      { id: "R3", x: 4, y: 0 },
      { id: "R4", x: 4, y: 5 },
      { id: "R5", x: 3, y: 3 },
    ],
  });

  assert.equal(result.reason, "All resources have been claimed.");
  assert.equal(result.winner, GROUPS.PRECINCT);
  assert.equal(result.turns, 4);
  assert.deepEqual(result.scores, {
    [GROUPS.LAB]: 2,
    [GROUPS.PRECINCT]: 3,
  });
  assert.deepEqual(result.survivorsRemaining, {
    [GROUPS.LAB]: 2,
    [GROUPS.PRECINCT]: 2,
  });
  assert.equal(
    result.resources.find((resource) => resource.id === "R5")!.claimedByEntityId,
    "P2",
  );
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) killed W1.*P2 \(Precinct\) killed W2.*P2 claimed R5/s,
  );
});

test("simulation reports maxTurns when the turn guard stops the run", () => {
  const result = runSimulation({
    gridSize: 6,
    maxTurns: 1,
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [{ id: "R1", x: 5, y: 5 }],
  });

  assert.equal(result.reason, "Reached maxTurns (1).");
  assert.equal(result.winner, GROUPS.LAB);
  assert.equal(result.scores[GROUPS.LAB], 0);
});

test("resources dropped in inter-group combat can be claimed by the survivor on that cell", () => {
  const result = runSimulation({
    gridSize: 3,
    maxTurns: 1,
    rules: {
      combat: {
        interGroupSurvivorKillChance: 1,
      },
    },
    walkers: [],
    labSurvivors: [{ id: "L1", x: 0, y: 1 }],
    precinctSurvivors: [{ id: "P1", x: 1, y: 1 }],
    resources: [
      { id: "R1", x: 1, y: 1 },
      { id: "R2", x: 2, y: 1 },
    ],
  });

  const resource = result.resources.find((candidate) => candidate.id === "R1")!;
  assert.equal(resource.claimedBy, GROUPS.LAB);
  assert.deepEqual(resource.position, { x: 1, y: 1 });
  assert.match(
    result.log.flatMap((turn) => turn.events).join("\n"),
    /P1 dropped R1.*L1 claimed R1/s,
  );
});

test("seeded combat makes repeated simulations reproducible", () => {
  const scenario = {
    gridSize: 4,
    maxTurns: 4,
    rules: {
      combat: {
        survivorKillWalkerChance: 0.5,
        interGroupSurvivorKillChance: 0.5,
        randomSeed: 42,
      },
    },
    walkers: [{ id: "W1", x: 1, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [{ id: "P1", x: 0, y: 1 }],
    resources: [{ id: "R1", x: 3, y: 3 }],
  };

  assert.deepEqual(runSimulation(scenario), runSimulation(scenario));
});

test("Park-Miller constants are exposed with descriptive names", () => {
  assert.deepEqual(getParkMillerConstants(), {
    multiplier: 16807,
    modulus: 2147483647,
    maxRandomValue: 2147483646,
  });
});

test("different random seeds can produce different combat outcomes", () => {
  const buildScenario = (randomSeed: number): Scenario => ({
    gridSize: 2,
    maxTurns: 1,
    rules: {
      combat: {
        survivorKillWalkerChance: 0.5,
        randomSeed,
      },
    },
    walkers: [{ id: "W1", x: 0, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [],
  });

  const survivorWins = runSimulation(buildScenario(1));
  const walkerWins = runSimulation(buildScenario(100000));

  assert.equal(survivorWins.survivorsRemaining[GROUPS.LAB], 1);
  assert.equal(walkerWins.survivorsRemaining[GROUPS.LAB], 0);
  assert.match(
    survivorWins.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) killed W1/,
  );
  assert.match(
    walkerWins.log.flatMap((turn) => turn.events).join("\n"),
    /L1 \(Lab\) was killed by W1/,
  );
});

test("omitting randomSeed uses the documented default seed", () => {
  const buildScenario = (combat: CombatRuleInput): Scenario => ({
    gridSize: 2,
    maxTurns: 1,
    rules: {
      combat,
    },
    walkers: [{ id: "W1", x: 0, y: 0 }],
    labSurvivors: [{ id: "L1", x: 0, y: 0 }],
    precinctSurvivors: [],
    resources: [],
  });

  assert.deepEqual(
    runSimulation(buildScenario({ survivorKillWalkerChance: 0.5 })),
    runSimulation(
      buildScenario({
        survivorKillWalkerChance: 0.5,
        randomSeed: 1,
      }),
    ),
  );
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

  assert.throws(
    () =>
      validateScenario({
        gridSize: 2,
        rules: {
          combat: {
            interGroupSurvivorKillChance: -0.1,
          },
        },
        walkers: [],
        labSurvivors: [],
        precinctSurvivors: [],
        resources: [],
      }),
    /rules\.combat\.interGroupSurvivorKillChance/,
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
  const sampleDir = join(process.cwd(), "sample");
  const sampleFiles = (await readdir(sampleDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  assert.deepEqual(sampleFiles, [
    "chaos-human-conflict.json",
    "diagonal-movement.json",
    "fast-walkers.json",
    "lab-advantage.json",
    "lab-narrow-win.json",
    "max-turn-stalemate.json",
    "precinct-advantage.json",
    "precinct-narrow-win.json",
    "scenario.json",
    "walker-first.json",
    "walker-overrun.json",
  ]);

  const expectedOutcomes: Record<string, {
    winner: Winner;
    reason: string;
    scores: ScoreByGroup;
  }> = {
    "chaos-human-conflict.json": {
      winner: GROUPS.LAB,
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 2, [GROUPS.PRECINCT]: 0 },
    },
    "diagonal-movement.json": {
      winner: "Draw",
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 1, [GROUPS.PRECINCT]: 1 },
    },
    "fast-walkers.json": {
      winner: "Draw",
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 1, [GROUPS.PRECINCT]: 1 },
    },
    "lab-advantage.json": {
      winner: GROUPS.LAB,
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 3, [GROUPS.PRECINCT]: 0 },
    },
    "lab-narrow-win.json": {
      winner: GROUPS.LAB,
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 2, [GROUPS.PRECINCT]: 1 },
    },
    "max-turn-stalemate.json": {
      winner: "Draw",
      reason: "Reached maxTurns (1).",
      scores: { [GROUPS.LAB]: 0, [GROUPS.PRECINCT]: 0 },
    },
    "precinct-advantage.json": {
      winner: GROUPS.PRECINCT,
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 0, [GROUPS.PRECINCT]: 3 },
    },
    "precinct-narrow-win.json": {
      winner: GROUPS.PRECINCT,
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 1, [GROUPS.PRECINCT]: 2 },
    },
    "scenario.json": {
      winner: "Draw",
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 2, [GROUPS.PRECINCT]: 2 },
    },
    "walker-first.json": {
      winner: "Draw",
      reason: "All resources have been claimed.",
      scores: { [GROUPS.LAB]: 1, [GROUPS.PRECINCT]: 1 },
    },
    "walker-overrun.json": {
      winner: "Draw",
      reason: "No humans remain alive.",
      scores: { [GROUPS.LAB]: 0, [GROUPS.PRECINCT]: 0 },
    },
  };

  const observedWinners = new Set<Winner>();
  const observedReasons = new Set<string>();

  for (const sampleFile of sampleFiles) {
    const samplePath = join(sampleDir, sampleFile);
    const scenario = JSON.parse(await readFile(samplePath, "utf8")) as Scenario;
    const result = runSimulation(scenario);
    const expected = expectedOutcomes[sampleFile];

    observedWinners.add(result.winner);
    observedReasons.add(result.reason);
    assert.equal(result.winner, expected.winner, `${sampleFile} winner`);
    assert.equal(result.reason, expected.reason, `${sampleFile} reason`);
    assert.deepEqual(result.scores, expected.scores, `${sampleFile} scores`);
    assert.ok(result.log.length > 0, `${sampleFile} should produce a turn log`);
  }

  assert.deepEqual(
    [...observedWinners].sort(),
    ["Draw", GROUPS.LAB, GROUPS.PRECINCT].sort(),
  );
  assert.deepEqual(
    [...observedReasons].sort(),
    [
      "All resources have been claimed.",
      "No humans remain alive.",
      "Reached maxTurns (1).",
    ].sort(),
  );
});
