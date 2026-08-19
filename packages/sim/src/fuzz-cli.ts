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

const games = arg("games", 100); // per pairing
const seed = arg("seed", 1);
const saveIdx = process.argv.indexOf("--save");
const saveDir = saveIdx !== -1 ? process.argv[saveIdx + 1] : undefined;
const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

const started = Date.now();
const report = await fuzz(cardsDir, games, seed, (pairing, i) => {
  if (i % 250 === 0) process.stderr.write(`  ${pairing}: ${i}/${games}\n`);
}, saveDir);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\nFuzz: ${report.totalGames} games (${games} per pairing) in ${elapsed}s, seeds ${seed}..${seed + games - 1}`);
for (const p of report.pairings) {
  console.log(`  ${p.pairing}: ${JSON.stringify(p.terminations)}, mean turns ${p.meanTurns.toFixed(1)}`);
}
if (report.totalErrors > 0) {
  console.log(`\nERRORS (${report.totalErrors}):`);
  for (const p of report.pairings) {
    for (const e of p.errors.slice(0, 5)) {
      console.log(`  [${p.pairing}] seed ${e.seed}: ${e.message.split("\n").slice(0, 4).join("\n    ")}`);
    }
  }
  process.exit(1);
} else {
  console.log(`Errors: none`);
}
