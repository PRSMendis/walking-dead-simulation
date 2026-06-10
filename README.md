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
    "activationOrder": ["Lab", "Precinct", "Walker"],
    "resourceOwnership": "claimed-on-touch"
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
- A walker kills any survivor sharing its cell.
- Lab and Precinct survivors do not fight each other. They are competing for resources, not directly attacking.
- Walkers do not interact with other walkers.

The simulation ends when all resources have been claimed, no humans remain alive, or `maxTurns` is reached.

## Rules

The `rules` object is optional. If omitted, the simulation uses the default values shown below.

```json
{
  "rules": {
    "movement": "orthogonal",
    "activationOrder": ["Lab", "Precinct", "Walker"],
    "resourceOwnership": "claimed-on-touch"
  }
}
```

Supported `movement` values:

- `orthogonal` - entities move up, right, down, or left, using Manhattan distance.
- `diagonal` - entities can also move diagonally, using Chebyshev distance.

Supported `activationOrder` values:

- An array containing exactly `Lab`, `Precinct`, and `Walker`.
- For example, `["Walker", "Lab", "Precinct"]` makes walkers act before humans.

Supported `resourceOwnership` values:

- `claimed-on-touch` - once claimed, a resource stays with that group even if the claimant later dies.
- `dropped-on-death` - if the claimant dies, the resource becomes unclaimed again at the death cell.

## Winner

The winner is the group with the most claimed resources. If resource counts are tied, the group with more living survivors wins. If both are still tied, the result is a draw.

## Project Structure

- `src/simulation.js` - core simulation engine
- `src/cli.js` - command-line entry point
- `sample/scenario.json` - runnable sample input
- `test/simulation.test.js` - focused behaviour tests
- `assumptions` - explicit assumptions made by the implementation
- `design-decisions` - rationale for the configurable rules and trade-offs

## AI Usage Note

AI was useful for quickly exploring possible rule sets, but the implementation intentionally chooses deterministic behaviour over randomness. That choice keeps the simulation testable, explainable, and easier to evolve during a follow-up interview.
