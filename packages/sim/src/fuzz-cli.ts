import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fuzz } from "./fuzz.js";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v)) throw new Error(`Bad --${name}`);
  return v;
}

const games = arg("games", 100);
const seed = arg("seed", 1);
const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

const started = Date.now();
const report = await fuzz(cardsDir, games, seed, (i) => {
  if (i % 100 === 0) process.stderr.write(`  ${i}/${games}\n`);
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\nFuzz: ${report.games} games in ${elapsed}s (seeds ${seed}..${seed + games - 1})`);
console.log(`Terminations:`, report.terminations);
console.log(`Mean turns: ${report.meanTurns.toFixed(1)}`);
if (report.errors.length > 0) {
  console.log(`\nERRORS (${report.errors.length}):`);
  for (const e of report.errors.slice(0, 10)) {
    console.log(`  seed ${e.seed}: ${e.message.split("\n").slice(0, 4).join("\n    ")}`);
  }
  process.exit(1);
} else {
  console.log(`Errors: none`);
}
