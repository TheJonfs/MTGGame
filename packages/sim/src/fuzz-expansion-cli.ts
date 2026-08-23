/**
 * pnpm fuzz:expansion [--games N] [--seed S] [--agents random|heuristic]
 *
 * S17: fuzz the Expansion 1 beast decks (every new card in random / heuristic lines): each beast
 * deck vs each slice deck A–E, plus beast mirrors. Zero exceptions, every game terminates; exit 1
 * on any error. Reports W/L and mean turns per pairing.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "./slice-decks.js";
import { EXPANSION_DECKS } from "./expansion-decks.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "30"));
const seed0 = Number(arg("seed", "1"));
const agentKind = arg("agents", "random") as "random" | "heuristic";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;

type Side = { name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control" };
const beasts: Side[] = Object.entries(EXPANSION_DECKS).map(([k, v]) => ({ name: `beast:${k}`, decklist: v.decklist, archetype: v.archetype }));
const slices: Side[] = (Object.keys(DECKS) as DeckKey[]).map((k) => ({ name: `slice:${k}`, decklist: DECKS[k].decklist, archetype: DECK_ARCHETYPES[k] }));
const pairings: [Side, Side][] = [];
for (const b of beasts) for (const s of slices) pairings.push([b, s]);
for (const b of beasts) pairings.push([b, b]);

const agentFor = (seed: number, me: Side, them: Side): Agent =>
  agentKind === "random" ? new RandomAgent(seed) : new HeuristicAgent(seed, pool, difficultyProfile("journeyman", me.archetype, [...them.decklist]));

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
      players: [{ name: a.name, decklist: [...a.decklist], agent: agentKind }, { name: b.name, decklist: [...b.decklist], agent: agentKind }],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers: [],
    };
    try {
      const r = await runMatch(spec, pool, [agentFor(seed * 2 + 1, a, b), agentFor(seed * 2 + 2, b, a)]);
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
  for (const e of errors.slice(0, 3)) console.log(`    seed ${e.seed}: ${e.message.split("\n").slice(0, 5).join("\n      ")}`);
}
console.log(`\nFuzz (expansion): ${totalGames} games (${games} per pairing × ${pairings.length} pairings, ${agentKind}) in ${((Date.now() - started) / 1000).toFixed(1)}s — errors: ${totalErrors}`);
if (totalErrors > 0) process.exit(1);
