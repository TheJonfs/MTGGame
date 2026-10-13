/**
 * pnpm rating:format --format peasant [--games 40] [--variants 6] [--swaps 8] [--vs 8] [--noise-games 10] [--seed 62] [--write]
 *
 * S62 (Part 3; ADR-153's table grows a column per Constructed format): a format's own card score, by the S51 method
 * on that format's games. Two runs, each game recording the cards a seat SAW in hand:
 *  1. the SEEDS — the format's field, every pairing, `--games` each;
 *  2. the NOISE — `--variants` copies of every seed with `--swaps` nonland cards replaced at random by cards legal in
 *     the format and inside the list's colours (so cards no seed plays are seen), each against `--vs` other decks.
 * The score is `computeLimitedRating`'s — per card, the result of the games it was seen in less its own deck's rate,
 * shrunk to its tier's mean by its sample (empirical Bayes) and put on the Limited scale over the format's legal
 * cards. `--write` adds it to data/convocation/card-rating.json as each row's `<format>` number (and a `run.<format>`
 * record); without it the table is printed and nothing is changed. Readers take it through `formatView`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, type CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "@shandalar/sim/open-decks";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { isBasic } from "./legality.js";
import { computeLimitedRating, type RatingGameLike } from "./rating-compute.js";
import { WorldRng } from "./rng.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const formatId = arg("format", "peasant"), format = CONSTRUCTED_FORMATS.find((f) => f.id === formatId), field = FORMAT_FIELD[formatId];
if (!format || !field) throw new Error(`rating:format — no field format ${formatId}`);
const G = Number(arg("games", "40")), V = Number(arg("variants", "6")), S = Number(arg("swaps", "8")), VS = Number(arg("vs", "8")), NG = Number(arg("noise-games", "10")), seed0 = Number(arg("seed", "62"));
type Deck = { id: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: { cardId: string; count: number }[] };
const legal = [...pool.values()].filter((d) => !isBasic(d.id) && cardLegal(d, format.rule));
const seeds: Deck[] = Object.values(field).map((l) => ({ id: l.key, archetype: l.archetype, decklist: l.decklist }));

class Seen implements Agent {
  seen = new Set<string>(); used = new Set<string>();
  constructor(private inner: Agent) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    for (const c of view.hand) this.seen.add(c.cardId);
    const a = await this.inner.chooseAction(view, req);
    if (a.type === "castSpell" || a.type === "playLand") { const c = view.hand.find((h) => h.objectId === a.objectId)?.cardId; if (c) this.used.add(c); }
    return a;
  }
}
async function play(A: Deck, B: Deck, seed: number, seatA: 0 | 1): Promise<RatingGameLike> {
  const [d0, d1] = seatA === 0 ? [A, B] : [B, A];
  const spec = { seed, players: [{ name: d0.id, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.id, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
  const t0 = new Seen(new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("master", d0.archetype, [...d1.decklist], [...d0.decklist]))), t1 = new Seen(new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", d1.archetype, [...d0.decklist], [...d1.decklist])));
  const r = await runMatch(spec, pool, [t0, t1]);
  const [tA, tB] = seatA === 0 ? [t0, t1] : [t1, t0];
  return { a: A.id, b: B.id, winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", seenA: [...tA.seen], usedA: [...tA.used], seenB: [...tB.seen], usedB: [...tB.used] };
}
/** A seed with `S` of its nonland copies replaced by random legal nonland cards inside its colours (four of a card at most). */
function variant(seed: Deck, n: number, rng: WorldRng): Deck {
  const def = (id: string) => pool.get(id)!;
  const colours = new Set(seed.decklist.filter((e) => !def(e.cardId).types.includes("Land")).flatMap((e) => cardColors(def(e.cardId))));
  const candidates = legal.filter((d: CardDef) => !d.types.includes("Land") && cardColors(d).every((c) => colours.has(c)));
  const cards = seed.decklist.flatMap((e) => Array.from({ length: e.count }, () => e.cardId));
  for (let k = 0; k < S; k++) {
    const spots = cards.map((id, i) => ({ id, i })).filter((x) => !def(x.id).types.includes("Land"));
    const out = spots[rng.int(spots.length)]!, into = candidates[rng.int(candidates.length)]!;
    if (cards.filter((id) => id === into.id).length >= 4) continue;
    cards[out.i] = into.id;
  }
  const decklist: { cardId: string; count: number }[] = [];
  for (const id of cards) { const e = decklist.find((x) => x.cardId === id); if (e) e.count += 1; else decklist.push({ cardId: id, count: 1 }); }
  return { id: `${seed.id}~${n}`, archetype: seed.archetype, decklist };
}

const seedRun: RatingGameLike[] = [], noiseRun: RatingGameLike[] = [];
let p = 0;
for (let i = 0; i < seeds.length; i++) for (let j = i + 1; j < seeds.length; j++) { p += 1; for (let g = 0; g < G; g++) seedRun.push(await play(seeds[i]!, seeds[j]!, seed0 + p * 1009 + g * 37, (g % 2) as 0 | 1)); }
console.error(`seeds: ${seedRun.length} games`);
const rng = new WorldRng(seed0 * 7919 + 1);
const variants = seeds.flatMap((s) => Array.from({ length: V }, (_, n) => variant(s, n, rng)));
const everyone = [...seeds, ...variants];
let q = 0;
for (const v of variants) for (let k = 0; k < VS; k++) {
  let o = everyone[rng.int(everyone.length)]!; if (o.id === v.id) o = everyone[(everyone.indexOf(o) + 1) % everyone.length]!;
  q += 1; for (let g = 0; g < NG; g++) noiseRun.push(await play(v, o, seed0 + 500_000 + q * 1013 + g * 41, (g % 2) as 0 | 1));
}
console.error(`noise: ${noiseRun.length} games over ${variants.length} variant decks`);
const out = computeLimitedRating([seedRun, noiseRun], legal, legal.map((d) => d.id));
const rows = legal.filter((d) => !d.types.includes("Land")).map((d) => ({ d, r: out.cards[d.id]! })).sort((a, b) => b.r.limited - a.r.limited);
const q5 = (xs: number[]) => [0.1, 0.25, 0.5, 0.75, 0.9].map((f) => [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))]!.toFixed(2)).join(" / ");
console.log(`# The ${format.name} score — ${out.games} games (${seedRun.length} among the ${seeds.length} seeds, ${noiseRun.length} with ${variants.length} noise decks); ${rows.filter((x) => x.r.limitedSeen >= 100).length} of ${rows.length} nonland cards seen a hundred times or more`);
console.log(`percentiles 10/25/50/75/90: ${q5(rows.map((x) => x.r.limited))} (tau ${out.tau}; tier means ${JSON.stringify(out.tierMeans)})`);
console.log(`top 25: ${rows.slice(0, 25).map((x) => `${x.d.name} ${x.r.limited.toFixed(2)} (${x.r.limitedSeen})`).join("; ")}`);
console.log(`bottom 15: ${rows.slice(-15).map((x) => `${x.d.name} ${x.r.limited.toFixed(2)} (${x.r.limitedSeen})`).join("; ")}`);
if (process.argv.includes("--write")) {
  const file = join(ROOT, "data/convocation/card-rating.json"), table = JSON.parse(readFileSync(file, "utf8")) as { cards: Record<string, Record<string, unknown>>; run: Record<string, unknown> };
  for (const d of legal) {
    const r = out.cards[d.id]!; const row = (table.cards[d.id] ??= { rating: d.shopTier === 1 ? 1 : 1.5, prior: d.shopTier === 1 ? 1 : 1.5, lists: 0, seen: 0, presence: null, lift: null, castWhenDrawn: null });
    row[formatId] = r.limited; row[`${formatId}Seen`] = r.limitedSeen;
  }
  table.run[formatId] = { when: new Date().toISOString().slice(0, 10), games: out.games, seeds: seeds.length, variants: variants.length, swaps: S, tierMeans: out.tierMeans, tau: out.tau, scale: out.scale };
  writeFileSync(file, JSON.stringify(table, null, 1) + "\n");
  console.log(`written: each legal card's \`${formatId}\` score in ${file}`);
}
