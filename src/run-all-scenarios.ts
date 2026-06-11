import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runSimulation } from "./simulation.js";
import type {
  Scenario,
  SimulationResult,
} from "./simulation.js";

const sampleDirectory = "sample";

try {
  await runAllScenarios();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function runAllScenarios(): Promise<void> {
  const scenarioFiles = await findScenarioFiles({ directory: sampleDirectory });

  if (scenarioFiles.length === 0) {
    console.log(`No scenario files found in ${sampleDirectory}.`);
    return;
  }

  for (const fileName of scenarioFiles) {
    const scenario = await readScenario({
      filePath: join(sampleDirectory, fileName),
    });
    const result = runSimulation(scenario);

    printScenarioSummary({ fileName, result });
  }
}

async function findScenarioFiles({
  directory,
}: {
  directory: string;
}): Promise<string[]> {
  const entries = await readdir(directory);

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .sort((first, second) => first.localeCompare(second));
}

async function readScenario({
  filePath,
}: {
  filePath: string;
}): Promise<Scenario> {
  return JSON.parse(await readFile(filePath, "utf8")) as Scenario;
}

function printScenarioSummary({
  fileName,
  result,
}: {
  fileName: string;
  result: SimulationResult;
}): void {
  console.log(fileName);
  console.log(`  Winner: ${result.winner}`);
  console.log(`  Reason: ${result.reason}`);
  console.log(`  Turns: ${result.turns}`);
  console.log(
    `  Scores: Lab ${result.scores.Lab}, Precinct ${result.scores.Precinct}`,
  );
  console.log(
    `  Survivors: Lab ${result.survivorsRemaining.Lab}, Precinct ${result.survivorsRemaining.Precinct}`,
  );
  console.log("");
}
