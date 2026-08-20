/**
 * S7 handoff stats (brief Part 1): sane-vs-random win rates per deck,
 * sane-vs-sane termination/turn stats vs the random baseline, and
 * casts-per-game of the ≥5-mana cards under each agent — the coverage-gap
 * number. Reproduce with: pnpm agent-stats [--games N] [--seed S]
 *
 * Counts SPELL_CAST events from in-memory match logs; nothing is saved.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runPairingMatch, type AgentPair } from "./fuzz.js";
import { DECKS, PAIRINGS, type DeckKey } from "./slice-decks.js";

const BIG_SPELLS = [
  "siege_gang_commander",
  "pelakka_wurm",
  "serra_angel",
  "drana_kalastria_bloodchief",
  "wrath_of_god",
] as const;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  if (!Number.isFinite(v)) throw new Error(`Bad --${name}`);
  return v;
}

const games = arg("games", 1000);
const seed = arg("seed", 1);
const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(cardsDir);

interface Tally {
  games: number;
  wins: [number, number, number];
  turns: number;
  terminations: Record<string, number>;
  /** cardId -> total casts (both seats). */
  casts: Record<string, number>;
  /** cardId -> casts by seat. */
  castsBySeat: Record<string, [number, number]>;
}

async function runBlock(a: DeckKey, b: DeckKey, agents: AgentPair, startSeed: number): Promise<Tally> {
  const t: Tally = { games: 0, wins: [0, 0, 0], turns: 0, terminations: {}, casts: {}, castsBySeat: {} };
  for (let i = 0; i < games; i++) {
    const r = await runPairingMatch(pool.cards, startSeed + i, a, b, agents);
    t.games += 1;
    t.wins[r.winner ?? 2] += 1;
    t.turns += r.turns;
    t.terminations[r.reason] = (t.terminations[r.reason] ?? 0) + 1;
    for (const e of r.log) {
      if (e.t === "EVENT" && e.name === "SPELL_CAST") {
        const p = e.payload as { cardId: string; controller: 0 | 1 };
        if ((BIG_SPELLS as readonly string[]).includes(p.cardId)) {
          t.casts[p.cardId] = (t.casts[p.cardId] ?? 0) + 1;
          const bySeat = (t.castsBySeat[p.cardId] ??= [0, 0]);
          bySeat[p.controller] += 1;
        }
      }
    }
  }
  return t;
}

const pct = (n: number, d: number) => ((100 * n) / d).toFixed(1) + "%";

// ---- 1. sane-vs-random per-deck win rates (both seatings, so every deck gets sane games)
console.log(`\n== sane vs random, ${games} games/pairing/seating, seeds ${seed}.. ==\n`);
const deckSane: Record<string, { wins: number; games: number }> = {};
for (const [a, b] of PAIRINGS) {
  for (const [agents, saneSeat] of [
    [["sane", "random"], 0],
    [["random", "sane"], 1],
  ] as [AgentPair, 0 | 1][]) {
    const t = await runBlock(a, b, agents, seed + saneSeat * 100_000);
    const saneDeck = saneSeat === 0 ? a : b;
    const d = (deckSane[saneDeck] ??= { wins: 0, games: 0 });
    d.wins += t.wins[saneSeat];
    d.games += t.games;
    console.log(
      `  ${a}-${b} ${agents.join(",")}: sane(${saneDeck}) wins ${pct(t.wins[saneSeat], t.games)}, mean turns ${(t.turns / t.games).toFixed(1)}`,
    );
  }
}
console.log(`\n  per-deck sane win rate vs random (aggregated over its 8 pairing/seating blocks):`);
for (const k of Object.keys(DECKS) as DeckKey[]) {
  const d = deckSane[k]!;
  console.log(`    ${k} (${DECKS[k].name}): ${pct(d.wins, d.games)} over ${d.games} games`);
}

// ---- 2 + 3. uniform-agent blocks: termination/turn stats and big-spell casts
for (const kind of ["random", "sane"] as const) {
  console.log(`\n== ${kind} vs ${kind}, ${games} games/pairing ==\n`);
  const casts: Record<string, number> = {};
  let totalGames = 0;
  for (const [a, b] of PAIRINGS) {
    const t = await runBlock(a, b, [kind, kind], seed + 200_000);
    totalGames += t.games;
    for (const [c, n] of Object.entries(t.casts)) casts[c] = (casts[c] ?? 0) + n;
    console.log(
      `  ${a}-${b}: ${JSON.stringify(t.terminations)}, wins ${t.wins.join("-")}, mean turns ${(t.turns / t.games).toFixed(1)}`,
    );
  }
  console.log(`\n  ≥5-mana casts per game (${totalGames} games; each card is in one deck, 4 of 10 pairings):`);
  for (const c of BIG_SPELLS) {
    console.log(`    ${c}: ${((casts[c] ?? 0) / totalGames).toFixed(3)}`);
  }
}
