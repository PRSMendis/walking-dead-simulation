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
  "walkers": [{ "id": "W1", "x": 2, "y": 2 }],
  "labSurvivors": [{ "id": "L1", "x": 0, "y": 0 }],
  "precinctSurvivors": [{ "id": "P1", "x": 5, "y": 5 }],
  "resources": [{ "id": "R1", "x": 1, "y": 0 }]
}
```

## Design Decisions

The brief intentionally leaves movement, activation order, and interactions open. This implementation favours deterministic rules so that runs are reproducible and easy to test.

- The grid uses zero-indexed `(x, y)` coordinates.
- Every turn, living survivors activate first, followed by living walkers.
- Entities are ordered by type and then ID within each phase.
- Survivors move one cell toward the nearest unclaimed resource.
- Walkers move one cell toward the nearest living human.
- Ties are resolved by reading order: top to bottom, then left to right, then ID.
- Entities cannot move outside the grid.
- A survivor claims an unclaimed resource by occupying its cell while alive.
- A walker kills any survivor sharing its cell.
- Lab and Precinct survivors do not fight each other. They are competing for resources, not directly attacking.
- Walkers do not interact with other walkers.

The simulation ends when all resources have been claimed, no humans remain alive, or `maxTurns` is reached.

## Winner

The winner is the group with the most claimed resources. If resource counts are tied, the group with more living survivors wins. If both are still tied, the result is a draw.

## Project Structure

- `src/simulation.js` - core simulation engine
- `src/cli.js` - command-line entry point
- `sample/scenario.json` - runnable sample input
- `test/simulation.test.js` - focused behaviour tests

## AI Usage Note

AI was useful for quickly exploring possible rule sets, but the implementation intentionally chooses deterministic behaviour over randomness. That choice keeps the simulation testable, explainable, and easier to evolve during a follow-up interview.
