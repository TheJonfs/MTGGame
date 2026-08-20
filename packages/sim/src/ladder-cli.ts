/**
 * pnpm ladder (ADR-049): challenger vs baseline over all 10 pairings, both
 * seatings reported separately. Defaults: heuristic vs sane and heuristic vs
 * random at 1,000 games/cell (the handoff numbers); --games for quicker runs.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatLadder, runLadder } from "./ladder.js";
import type { AgentKind } from "./fuzz.js";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v)) throw new Error(`Bad --${name}`);
  return v;
}
function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const games = arg("games", 1000);
const seed = arg("seed", 1);
const challenger = (argOf("challenger") ?? "heuristic") as AgentKind;
const baselines = (argOf("baselines") ?? "sane,random").split(",") as AgentKind[];
const cellArg = argOf("cell"); // e.g. --cell A,B (S9 rider: single-cell tuning loop)
const mirrorsOnly = process.argv.includes("--mirrors");
const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

for (const baseline of baselines) {
  const started = Date.now();
  const options = {
    ...(cellArg ? { cell: cellArg.split(",") as [never, never] } : {}),
    ...(mirrorsOnly ? { mirrorsOnly: true } : {}),
  };
  const report = await runLadder(cardsDir, challenger, baseline, games, seed, (cell, i) => {
    if (i % 250 === 0) process.stderr.write(`  ${cell}: ${i}/${games}\n`);
  }, options);
  console.log(formatLadder(report));
  console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
}
