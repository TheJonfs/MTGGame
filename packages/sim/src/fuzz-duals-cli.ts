/**
 * pnpm fuzz:duals [--games N] [--seed S] [--agents random|heuristic]
 *
 * S20 (ADR-004 second amendment): fuzz the payment SOLVER before fixtures — synthetic two-color
 * decks whose mana bases lean on ABU duals (and, once A9 lands, shocklands via --shocks). Every
 * colored cast in these games exercises pip-to-producer assignment; random lines also hit the
 * deliberate per-color tapForMana actions. Zero exceptions, every game terminates; exit 1 on any
 * error. The decks are sim infrastructure only — no catalog or player-facing use.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "150"));
const seed0 = Number(arg("seed", "1"));
const agentKind = arg("agents", "random") as "random" | "heuristic";
const useShocks = process.argv.includes("--shocks");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;

type Entry = [string, number];
const d = (pairs: Entry[]) => pairs.map(([cardId, count]) => ({ cardId, count }));

// Deliberately dual-heavy mana bases: double-pip costs both sides so the solver's colored
// matching (not just the totals) decides castability every turn.
const WU = {
  name: useShocks ? "fuzz:WU-shocks" : "fuzz:WU-duals",
  archetype: "midrange" as const,
  decklist: d([
    [useShocks ? "hallowed_fountain" : "tundra", 4], ["plains", 4], ["island", 4],
    ["savannah_lions", 3], ["suntail_hawk", 2], ["raise_the_alarm", 2], ["pacifism", 2],
    ["man_o_war", 3], ["wind_drake", 2], ["counterspell", 2], ["essence_scatter", 2],
  ]),
};
const BR = {
  name: useShocks ? "fuzz:BR-shocks" : "fuzz:BR-duals",
  archetype: "aggro" as const,
  decklist: d([
    [useShocks ? "blood_crypt" : "badlands", 4], ["swamp", 4], ["mountain", 4],
    ["typhoid_rats", 2], ["child_of_night", 3], ["doom_blade", 2], ["hymn_to_tourach", 2],
    ["raging_goblin", 2], ["boggart_brute", 2], ["shock", 2], ["lightning_bolt", 1], ["hordeling_outburst", 2],
  ]),
};
for (const deck of [WU, BR]) {
  const n = deck.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 30) throw new Error(`${deck.name}: ${n} cards`);
}

type Side = { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] };
const useGuardians = process.argv.includes("--guardians");
const pairings: [Side, Side][] = [[WU, BR], [BR, WU], [WU, WU], [BR, BR]];
if (useGuardians) {
  // S20 Part 2: the five guardian decks (fuzz coverage of Reya/Arcanis/Drakuseth/Titania + the
  // enabler lands BEFORE fixtures) vs slice C/D and each pairing's mirror.
  const { GUARDIAN_DECKS } = await import("./guardian-decks.js");
  const { DECKS } = await import("./slice-decks.js");
  pairings.length = 0;
  for (const [k, g] of Object.entries(GUARDIAN_DECKS)) {
    const side: Side = { name: `guardian:${k}`, archetype: g.archetype, decklist: g.decklist };
    pairings.push([side, { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] }]);
    pairings.push([side, { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] }]);
    pairings.push([side, side]);
  }
}
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
console.log(`\nFuzz (duals${useShocks ? "+shocks" : ""}): ${totalGames} games (${games} per pairing × ${pairings.length} pairings, ${agentKind}) in ${((Date.now() - started) / 1000).toFixed(1)}s — errors: ${totalErrors}`);
if (totalErrors > 0) process.exit(1);
