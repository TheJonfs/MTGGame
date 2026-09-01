/**
 * pnpm petal-sim [--games N] [--seed S] [--life L]
 *
 * S26 Part 4 (ADR-091): guardian-sim's pattern for the Corolla — each still-pair deck (master
 * profile) under its chamber's RETURNED law (the lord's partisan law on the boss's side, exactly
 * as petalDuelSpec builds it) at the petal-boss life (knob; Chris: 30 to start) against the
 * reference set — the five starters + slice C and D (journeyman pilots at world life L, default
 * 16: an endgame traveller's). Reports each petal's KILL RATE, with and without the law, so the
 * law's own weight reads beside the deck's.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
import { DECKS } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";
import { defaultKnobs } from "./knobs.js";
import { petalLawModifier, petalLawName, PETAL_ORDER } from "./corolla.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "20"));
const seed0 = Number(arg("seed", "1"));
const refLife = Number(arg("life", "16"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const knobs = defaultKnobs();
const def = catalog.corolla!;
const bossLife = knobs.petalBossLife > 0 ? knobs.petalBossLife : (def.bossLife ?? 30);

const reference: { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[] = [
  ...catalog.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] },
];

console.log(`petal-sim: ${games} games × ${reference.length} references per petal (boss master at ${bossLife} life; reference journeyman at ${refLife}); law on the boss's side vs lawless`);
for (const color of PETAL_ORDER) {
  const petal = def.petals.find((p) => p.color === color)!;
  const boss = COROLLA_DECKS[petal.boss.key]!;
  const law = petalLawModifier(catalog, color);
  const cells: string[] = [];
  for (const variant of [{ name: "law", mods: law ? [law] : [] }, { name: "lawless", mods: [] as Modifier[] }]) {
    let bossWins = 0, total = 0;
    for (const ref of reference) {
      for (let i = 0; i < games; i++) {
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        const seed = seed0 + i + (variant.name === "law" ? 0 : 100_000);
        const spec: MatchSpec = {
          seed,
          players: [
            { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
            { name: boss.name, decklist: [...boss.decklist], agent: "heuristic" },
          ],
          rules: { startingLife: refLife, handSize: 7, mulligan: "london", maxTurns: 100 },
          modifiers: [{ type: "startingLife", player: 1, value: bossLife }, ...variant.mods],
        };
        const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("journeyman", ref.archetype, [...boss.decklist]));
        const a1: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", boss.archetype, [...ref.decklist]));
        try {
          const r = await runMatch(spec, pool, [a0, a1]);
          if (r.winner === 1) bossWins += 1;
          total += 1;
        } catch (e) {
          console.log(`    ERROR ${color} ${variant.name} vs ${ref.name} seed ${seed}: ${(e as Error).message}`);
        }
      }
    }
    cells.push(`${variant.name} ${((100 * bossWins) / Math.max(1, total)).toFixed(0)}%`);
  }
  console.log(`  ${petalLawName(catalog, color) ?? color} petal (${color}) — ${boss.name} [${boss.pair}]: kill rate ${cells.join(" · ")}`);
}
