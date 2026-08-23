/**
 * pnpm fuzz:starters [--games N] [--seed S] [--agents random|heuristic]
 *
 * S16: the catalog starters are now the player's decks (slice decks A–E are
 * enemy infrastructure), so "fuzz before fixtures" covers starters × slice
 * decks (and starter mirrors): zero exceptions, every game terminates. The
 * one-drops (Llanowar Elves, Cathartic Adept) get their random-line coverage
 * here. Reports W/L and mean turns per pairing; exit 1 on any error.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { readFileSync } from "node:fs";
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "./slice-decks.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "50"));
const seed0 = Number(arg("seed", "1"));
const agentKind = arg("agents", "random") as "random" | "heuristic";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
// starters.json read directly (sim must not depend on world — world already imports sim's decks).
const catalog = JSON.parse(readFileSync(join(ROOT, "data/world/starters.json"), "utf8")) as { starters: { id: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control" }[] };

type Side = { name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control" };
const starters: Side[] = catalog.starters.map((s) => ({ name: `starter:${s.id}`, decklist: s.decklist, archetype: s.archetype }));
const slices: Side[] = (Object.keys(DECKS) as DeckKey[]).map((k) => ({ name: `slice:${k}`, decklist: DECKS[k].decklist, archetype: DECK_ARCHETYPES[k] }));
const pairings: [Side, Side][] = [];
for (const s of starters) for (const e of slices) pairings.push([s, e]);
for (let i = 0; i < starters.length; i++) for (let j = i; j < starters.length; j++) pairings.push([starters[i]!, starters[j]!]);

const agentFor = (kind: typeof agentKind, seed: number, me: Side, them: Side): Agent =>
  kind === "random" ? new RandomAgent(seed) : new HeuristicAgent(seed, pool, difficultyProfile("journeyman", me.archetype, [...them.decklist]));

let totalErrors = 0, totalGames = 0;
const started = Date.now();
for (const [a, b] of pairings) {
  const terminations: Record<string, number> = {};
  const wins = [0, 0, 0];
  let turns = 0, done = 0;
  const errors: { seed: number; message: string }[] = [];
  for (let i = 0; i < games; i++) {
    if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    const seed = seed0 + i;
    const spec: MatchSpec = {
      seed,
      players: [
        { name: a.name, decklist: [...a.decklist], agent: agentKind },
        { name: b.name, decklist: [...b.decklist], agent: agentKind },
      ],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers: [],
    };
    try {
      const r = await runMatch(spec, pool, [agentFor(agentKind, seed * 2 + 1, a, b), agentFor(agentKind, seed * 2 + 2, b, a)]);
      terminations[r.reason] = (terminations[r.reason] ?? 0) + 1;
      wins[r.winner ?? 2]! += 1;
      turns += r.turns;
      done += 1;
    } catch (e) {
      errors.push({ seed, message: (e as Error).stack ?? String(e) });
    }
    totalGames += 1;
  }
  totalErrors += errors.length;
  console.log(`  ${a.name} vs ${b.name}: ${JSON.stringify(terminations)}, wins ${wins[0]}-${wins[1]}-${wins[2]}, mean turns ${done ? (turns / done).toFixed(1) : "—"}${errors.length ? ` — ERRORS ${errors.length}` : ""}`);
  for (const e of errors.slice(0, 3)) console.log(`    seed ${e.seed}: ${e.message.split("\n").slice(0, 4).join("\n      ")}`);
}
console.log(`\nFuzz (starters): ${totalGames} games (${games} per pairing × ${pairings.length} pairings, ${agentKind}) in ${((Date.now() - started) / 1000).toFixed(1)}s — errors: ${totalErrors}`);
if (totalErrors > 0) process.exit(1);
