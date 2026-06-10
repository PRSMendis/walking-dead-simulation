# Ailo Walking Dead Simulation

A deterministic turn-based simulation for the Ailo coding exercise.

## Requirements

- Node.js 18 or newer
- No npm install is required

## Run

Run the bundled sample scenario:

```sh
npm start
```

Run one of the alternate sample scenarios:

```sh
npm run run -- sample/diagonal-movement.json
npm run run -- sample/fast-walkers.json
npm run run -- sample/walker-first.json
```

Run a custom scenario:

```sh
npm run run -- path/to/scenario.json
```

## Test

```sh
npm test
```

## Input Format

```json
{
  "gridSize": 6,
  "maxTurns": 30,
  "rules": {
    "movement": "orthogonal",
    "activation": {
      "labMoveSteps": 1,
      "precinctMoveSteps": 1,
      "walkerMoveSteps": 1,
      "interactionTiming": "after-each-step"
    },
    "combat": {
      "survivorKillWalkerChance": 0.5,
      "interGroupSurvivorKillChance": 0,
      "randomSeed": 1
    },
    "activationOrder": ["Lab", "Precinct", "Walker"],
    "resourceOwnership": "dropped-on-death"
  },
  "walkers": [{ "id": "W1", "x": 2, "y": 2 }],
  "labSurvivors": [{ "id": "L1", "x": 0, "y": 0 }],
  "precinctSurvivors": [{ "id": "P1", "x": 5, "y": 5 }],
  "resources": [{ "id": "R1", "x": 1, "y": 0 }]
}
```

## Design Decisions

The brief intentionally leaves movement, activation order, and interactions open. This implementation favours deterministic rules so that runs are reproducible and easy to test.

- The grid uses zero-indexed `(x, y)` coordinates.
- Rules are configurable through the optional `rules` object.
- An activation is an entity's opportunity to act during a turn.
- By default, activation means moving one step toward a target, then resolving interactions.
- Activation behaviour can be changed with `rules.activation`.
- By default, living Lab survivors activate first, then Precinct survivors, then walkers.
- Activation order can be changed with `rules.activationOrder`.
- Entities within the same activation participant move by ID.
- Survivors move one cell toward the nearest unclaimed resource.
- Walkers move one cell toward the nearest living human.
- Ties are resolved by reading order: top to bottom, then left to right, then ID.
- Movement defaults to orthogonal only, but diagonal movement can be enabled with `rules.movement`.
- Entities cannot move outside the grid.
- A survivor claims an unclaimed resource by occupying its cell while alive.
- Claimed resources stay claimed by default, but `rules.resourceOwnership` can make them drop when the claimant dies.
- A survivor sharing a cell with a walker has a configurable chance to kill that walker.
- If the survivor fails the combat roll, a walker kills them.
- Lab and Precinct survivors do not fight by default, but inter-group survivor combat can be enabled.
- Walkers do not interact with other walkers.

The simulation ends when all resources have been claimed, no humans remain alive, or `maxTurns` is reached.

## Rules

The `rules` object is optional. If omitted, the simulation uses the default values shown below.

```json
{
  "rules": {
    "movement": "orthogonal",
    "activation": {
      "labMoveSteps": 1,
      "precinctMoveSteps": 1,
      "walkerMoveSteps": 1,
      "interactionTiming": "after-each-step"
    },
    "combat": {
      "survivorKillWalkerChance": 0.5,
      "interGroupSurvivorKillChance": 0,
      "randomSeed": 1
    },
    "activationOrder": ["Lab", "Precinct", "Walker"],
    "resourceOwnership": "dropped-on-death"
  }
}
```

Supported `movement` values:

- `orthogonal` - entities move up, right, down, or left, using Manhattan distance.
- `diagonal` - entities can also move diagonally, using Chebyshev distance.

Supported `activation` values:

- `labMoveSteps` - positive integer for how many movement steps a Lab survivor can take per activation.
- `precinctMoveSteps` - positive integer for how many movement steps a Precinct survivor can take per activation.
- `walkerMoveSteps` - positive integer for how many movement steps a walker can take per activation.
- `interactionTiming` - either `after-each-step` or `after-activation`.

`survivorMoveSteps` is also accepted as a backwards-compatible shortcut that sets both `labMoveSteps` and `precinctMoveSteps` when those group-specific values are omitted.

Supported `combat` values:

- `survivorKillWalkerChance` - number from `0` to `1`. `0.5` means a survivor has roughly a 50% chance to kill one walker when sharing a cell.
- `interGroupSurvivorKillChance` - number from `0` to `1`. `0` means Lab and Precinct survivors do not attack each other; higher values allow them to kill opposing survivors when sharing a cell.
- `randomSeed` - integer seed used for reproducible combat rolls.

Supported `activationOrder` values:

- An array containing exactly `Lab`, `Precinct`, and `Walker`.
- For example, `["Walker", "Lab", "Precinct"]` makes walkers act before humans.

Supported `resourceOwnership` values:

- `claimed-on-touch` - once claimed, a resource stays with that group even if the claimant later dies.
- `dropped-on-death` - if the claimant dies, the resource becomes unclaimed again at the death cell.

`dropped-on-death` is the default because it is the more realistic model: resources behave like physical items carried by survivors. `claimed-on-touch` remains available for simpler scoring where a claim is treated as an immediate group-level success.

## Winner

The winner is the group with the most claimed resources. If resource counts are tied, the group with more living survivors wins. If both are still tied, the result is a draw.

## Project Structure

- `src/simulation.js` - core simulation engine
- `src/cli.js` - command-line entry point
- `sample/scenario.json` - runnable sample input
- `sample/diagonal-movement.json` - sample showing diagonal movement
- `sample/fast-walkers.json` - sample showing different Lab, Precinct, and walker activation speeds
- `sample/walker-first.json` - sample showing walkers activating before survivors
- `test/simulation.test.js` - focused behaviour tests
- `assumptions` - explicit assumptions made by the implementation
- `design-decisions` - rationale for the configurable rules and trade-offs

## AI Usage Note

AI was useful for quickly exploring possible rule sets, but the implementation intentionally chooses deterministic behaviour over randomness. That choice keeps the simulation testable, explainable, and easier to evolve during a follow-up interview.
