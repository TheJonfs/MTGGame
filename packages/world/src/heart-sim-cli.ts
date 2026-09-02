/**
 * pnpm heart-sim [--games N] [--seed S] [--life L]
 *
 * S27 Part 5 (ADR-093): the guardian-sim pattern under ROTATING laws — the Manafleur's sixty
 * (master profile, the entrance, the default WBRUG sequence) at heartLife 30/35/40 against the
 * reference set (the five starters + slice C and D, journeyman at world life L, default 16).
 * Reports the Manafleur's kill rate per life, turns to the first bloom, laws faced per game, and
 * the flood/jam frequency (the Arzakon texture measured: games where the Manafleur never bloomed).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { HEART_DECK } from "@shandalar/sim/heart-deck";
import { DECKS } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "12"));
const seed0 = Number(arg("seed", "1"));
const refLife = Number(arg("life", "16"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const reference: { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[] = [
  ...catalog.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] },
];

console.log(`heart-sim: ${games} games × ${reference.length} references per life (the Manafleur master, entrance, WBRUG; reference journeyman at ${refLife})`);
for (const life of [30, 35, 40]) {
  let wins = 0, total = 0, bloomTurns = 0, bloomed = 0, lawsFaced = 0, jams = 0;
  for (const ref of reference) {
    for (let i = 0; i < games; i++) {
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      const seed = seed0 + i + life * 101;
      const spec: MatchSpec = {
        seed,
        players: [
          { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
          { name: HEART_DECK.name, decklist: [...HEART_DECK.decklist], agent: "heuristic" },
        ],
        rules: { startingLife: refLife, handSize: 7, mulligan: "london", maxTurns: 100 },
        modifiers: [{ type: "startingLife", player: 1, value: life }, { type: "signatureToHand", player: 1, cardId: "the_manafleur" }, { type: "lawSequence" }],
      };
      const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("journeyman", ref.archetype, [...HEART_DECK.decklist]));
      const a1: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", HEART_DECK.archetype, [...ref.decklist]));
      try {
        const r = await runMatch(spec, pool, [a0, a1]);
        total += 1;
        if (r.winner === 1) wins += 1;
        // The first bloom: the first RNG-free createLaw shows as a law token entering — read the log's ZONE_CHANGE-free proxy: SPELL_CAST of the Manafleur by seat 1.
        const casts = (r.log as { t: string; name?: string; payload?: { cardId?: string; controller?: number } }[]).filter((e) => e.t === "EVENT" && e.name === "SPELL_CAST" && e.payload?.cardId === "the_manafleur" && e.payload?.controller === 1);
        if (casts.length) { bloomed += 1; }
        else jams += 1;
        lawsFaced += (r.facts.spellsCast["the_manafleur"]?.[1] ?? 0);
        bloomTurns += r.turns;
      } catch (e) {
        console.log(`    ERROR life ${life} vs ${ref.name} seed ${seed}: ${(e as Error).message}`);
      }
    }
  }
  console.log(`  heartLife ${life}: kill rate ${((100 * wins) / Math.max(1, total)).toFixed(0)}% · the Manafleur cast in ${((100 * bloomed) / Math.max(1, total)).toFixed(0)}% of games (never cast = jam: ${((100 * jams) / Math.max(1, total)).toFixed(0)}%) · mean game length ${(bloomTurns / Math.max(1, total)).toFixed(1)} turns`);
}
