/**
 * pnpm weight-search (S11 Part 3, ADR-060.3): coordinate-descent search over
 * the declared evaluator constants; objective = aggregate mirror win rate vs
 * journeyman. Search and verification use DISJOINT seed ranges (held-out).
 *
 *   pnpm weight-search [--games 80] [--sweeps 3] [--seed 11000000]
 *                      [--verify-games 300] [--verify-seed 21000000] [--step 1.4]
 *
 * Prints the found vector as JSON — paste into MASTER_CONSTANTS
 * (packages/agents/src/evaluator.ts) after verification holds up.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { coordinateDescent, mirrorObjective } from "./weight-search.js";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v)) throw new Error(`Bad --${name}`);
  return v;
}

const gamesPerCell = arg("games", 80);
const sweeps = arg("sweeps", 3);
const searchSeed = arg("seed", 11_000_000);
const verifyGames = arg("verify-games", 300);
const verifySeed = arg("verify-seed", 21_000_000);
const stepFactor = arg("step", 1.4);
const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(cardsDir);

const started = Date.now();
const result = await coordinateDescent(pool.cards, {
  gamesPerCell,
  sweeps,
  searchSeed,
  stepFactor,
  onLog: (line) => console.log(line),
});

console.log(`\nsearch done in ${((Date.now() - started) / 1000).toFixed(0)}s, ${result.evaluations} evaluations`);
console.log(`search-seed rate: ${(100 * result.searchRate).toFixed(2)}%`);
console.log(`moves: ${result.history.length}`);
for (const h of result.history) console.log(`  ${h.param}: ${h.from} -> ${h.to}`);

console.log(`\nverifying on held-out seeds (${verifyGames}/cell, seed ${verifySeed})…`);
const verify = await mirrorObjective(pool.cards, result.constants, verifyGames, verifySeed);
console.log(`held-out rate: ${(100 * verify.rate).toFixed(2)}%`);
for (const [cell, r] of Object.entries(verify.perCell)) console.log(`  ${cell}: ${(100 * r).toFixed(1)}%`);

console.log(`\nfound constants (paste as MASTER_CONSTANTS if verified):`);
console.log(JSON.stringify(result.constants, null, 2));
