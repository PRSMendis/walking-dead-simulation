import { readFile } from "node:fs/promises";
import { runSimulation } from "./simulation.js";

const scenarioPath = process.argv[2] ?? "sample/scenario.json";

try {
  const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
  const result = runSimulation(scenario);
  printResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function printResult(result) {
  console.log(`Winner: ${result.winner}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Turns: ${result.turns}`);
  console.log(
    `Scores: Lab ${result.scores.Lab}, Precinct ${result.scores.Precinct}`,
  );
  console.log(
    `Survivors: Lab ${result.survivorsRemaining.Lab}, Precinct ${result.survivorsRemaining.Precinct}`,
  );
  console.log("");

  for (const turn of result.log) {
    console.log(`Turn ${turn.turn}`);
    for (const event of turn.events) {
      console.log(`  - ${event}`);
    }
    console.log(
      `  Summary: resources ${turn.summary.resourcesClaimed}/${turn.summary.resourcesTotal}, Lab ${turn.summary.scores.Lab}, Precinct ${turn.summary.scores.Precinct}`,
    );
    console.log("");
  }
}
