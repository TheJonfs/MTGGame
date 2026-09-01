/**
 * pnpm mirror-sim [--games N] [--seed S]
 *
 * S26 Part 4 (ADR-091): the Vault's instrument — each reference deck (journeyman, 20 life) against
 * its OWN copy piloted by the master profile, with and without the Black Lotus appended (the
 * Mirror's exact construction vs its control). The reflection's win rate says what the Vault asks;
 * the Lotus delta says what the prize is worth in the reflection's hands.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { DECKS } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";
import { deriveArchetype } from "./corolla.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "20"));
const seed0 = Number(arg("seed", "1"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));

const reference: { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[] = [
  ...catalog.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] },
];

console.log(`mirror-sim: ${games} games per cell — the deck (journeyman, 20) vs its reflection (master, 20), with the Lotus and without`);
for (const ref of reference) {
  const derived = deriveArchetype(ref.decklist, pool);
  const cells: string[] = [];
  for (const lotus of [true, false]) {
    let reflectionWins = 0, total = 0;
    const reflection = lotus ? [...ref.decklist.map((e) => ({ ...e })), { cardId: "black_lotus", count: 1 }] : ref.decklist.map((e) => ({ ...e }));
    for (let i = 0; i < games; i++) {
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      const seed = seed0 + i + (lotus ? 0 : 100_000);
      const spec: MatchSpec = {
        seed,
        players: [
          { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
          { name: "reflection", decklist: reflection, agent: "heuristic" },
        ],
        rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
        modifiers: [],
      };
      const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("journeyman", ref.archetype, reflection));
      const a1: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", derived, [...ref.decklist]));
      try {
        const r = await runMatch(spec, pool, [a0, a1]);
        if (r.winner === 1) reflectionWins += 1;
        total += 1;
      } catch (e) {
        console.log(`    ERROR ${ref.name} lotus=${lotus} seed ${seed}: ${(e as Error).message}`);
      }
    }
    cells.push(`${lotus ? "with Lotus" : "without"} ${((100 * reflectionWins) / Math.max(1, total)).toFixed(0)}%`);
  }
  console.log(`  ${ref.name} (${ref.archetype}; reflection reads ${derived}): reflection wins ${cells.join(" · ")}`);
}
