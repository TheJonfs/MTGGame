/**
 * pnpm draft-sim [--pods 50] [--games 2] [--seed 49] [--set plane] [--recipe classic]
 * pnpm draft-sim --pick-order [--set plane]       the top sixty of the set by rating (→ data/convocation/pick-order-<set>.md)
 *
 * S49 (Part 3): the drafter's data. Pods of eight draft three packs on the pick rule (world/drafter.ts), the Limited
 * builder makes each seat's deck from its 45 picks, and the pod plays a round-robin (master both, 20 life). The
 * report: how many seats land on each colour and pair (do they fight over one colour?), when a seat's colours
 * settle, and the pod's win-rate spread.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors } from "@shandalar/cards";
import { runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { PACK_TIERS, packTier, resolveSet, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck } from "./limited-builder.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { runDraft } from "./drafter.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = JSON.parse(readFileSync(join(ROOT, arg("rating", "data/convocation/card-rating.json")), "utf8")) as CardRatingTable;
const set = data.sets.find((s) => s.id === arg("set", "plane"))!, recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe))!;
const pct = (x: number) => `${Math.round(x * 100)}%`, mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

if (process.argv.includes("--pick-order")) {
  const tiers = resolveSet(set, cards, data.power);
  const ids = PACK_TIERS.flatMap((t) => tiers[t]).sort((a, b) => cardRating(cards.get(b)!, rating) - cardRating(cards.get(a)!, rating) || a.localeCompare(b));
  const row = (id: string, i: number) => { const d = cards.get(id)!; return `| ${i + 1} | ${d.name} | ${cardColors(d).join("") || (d.types.includes("Land") ? "land" : "—")} | ${packTier(d)}${d.prizeOnly ? " (legend)" : ""} | ${d.manaCost || "—"} | ${cardRating(d, rating).toFixed(2)} |`; };
  const top = ids.slice(0, 60), share: Record<string, number> = {};
  for (const id of top) for (const c of cardColors(cards.get(id)!)) share[c] = (share[c] ?? 0) + 1;
  const text = [`# The pick order — ${set.name}, by the card rating (v${(rating as { version?: number }).version ?? "?"}): the top sixty of ${ids.length}`, `\nWhat an AI seat takes first, before its colours weigh in. Colours among the sixty: ${["W", "U", "B", "R", "G"].map((c) => `${c} ${share[c] ?? 0}`).join(" · ")} (a gold card counts to each).\n`, `| # | card | colour | tier | cost | rating |\n|---|---|---|---|---|---|`, ...top.map(row)].join("\n");
  writeFileSync(join(ROOT, `data/convocation/pick-order-${set.id}.md`), text + "\n");
  console.log(text);
} else {
  const PODS = Number(arg("pods", "50")), G = Number(arg("games", "2")), seed0 = Number(arg("seed", "49"));
  const colourSeats: Record<string, number> = {}, pairSeats: Record<string, number> = {}, perPodMax: number[] = [], spread: number[] = [], sd: number[] = [], settled: number[] = [], blackPerPod: number[] = [], ratings: number[] = [], rates: number[] = [];
  const colourWins: Record<string, number[]> = {};
  let games = 0, splash = 0;
  for (let p = 0; p < PODS; p++) {
    const d = runDraft(set, recipe, data, cards, rating, seed0 * 1000 + p);
    const builds = d.picks.map((x) => buildLimitedDeck(x, rating, cards));
    settled.push(...d.settledAt);
    const w = builds.map(() => 0), n = builds.map(() => 0);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) for (let g = 0; g < G; g++) {
      const seatA = g % 2, seed = seed0 + p * 100003 + i * 1009 + j * 37 + g;
      const [d0, d1] = seatA === 0 ? [builds[i]!.deck, builds[j]!.deck] : [builds[j]!.deck, builds[i]!.deck];
      const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const r = await runMatch(spec, cards, [new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1)), new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0))]);
      const a = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0;
      w[i]! += a; w[j]! += 1 - a; n[i]! += 1; n[j]! += 1; games += 1;
    }
    const wr = w.map((x, i) => x / n[i]!);
    const counts: Record<string, number> = {};
    builds.forEach((b, i) => { const k = b.colors.join(""); pairSeats[k] = (pairSeats[k] ?? 0) + 1; if (b.splash) splash += 1; for (const c of b.colors) { colourSeats[c] = (colourSeats[c] ?? 0) + 1; counts[c] = (counts[c] ?? 0) + 1; (colourWins[c] ??= []).push(wr[i]!); } ratings.push(b.rating); rates.push(wr[i]!); });
    perPodMax.push(Math.max(...Object.values(counts))); blackPerPod.push(counts.B ?? 0);
    spread.push(Math.max(...wr) - Math.min(...wr)); sd.push(Math.sqrt(mean(wr.map((x) => (x - 0.5) ** 2))));
  }
  const seats = PODS * 8, hist = (xs: number[]) => { const h: Record<number, number> = {}; for (const x of xs) h[x] = (h[x] ?? 0) + 1; return Object.entries(h).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `${k} × ${v}`).join(", "); };
  const L = [`# The draft sim (S49 Part 3) — ${PODS} pods of eight, three ${recipe.name} packs from ${set.name}, ${games} games (a round-robin a pod, ${G} games a pairing), master both\n`,
    `## Where the seats land\n\nSeats on each colour (of ${seats}; even would be ${pct(0.4)}): ${["W", "U", "B", "R", "G"].map((c) => `${c} ${colourSeats[c] ?? 0} (${pct((colourSeats[c] ?? 0) / seats)})`).join(" · ")}.`,
    `A colour's seats win: ${["W", "U", "B", "R", "G"].map((c) => `${c} ${colourWins[c] ? pct(mean(colourWins[c]!)) : "—"}`).join(" · ")}.`,
    `\n| pair | seats | share |\n|---|---|---|\n${Object.entries(pairSeats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} | ${pct(v / seats)} |`).join("\n")}`,
    `\n## Do they fight over one colour?\n\nSeats on black per pod (of eight): ${hist(blackPerPod)}. The most-drafted colour in a pod is shared by: ${hist(perPodMax)} seats. (Two colours each, eight seats: an even pod has 3.2 seats a colour.)`,
    `A seat's two colours last change at pick ${mean(settled).toFixed(1)} on average (of 45); ${pct(settled.filter((x) => x <= 8).length / settled.length)} of seats are settled by the cut at pick 8; ${pct(settled.filter((x) => x > 15).length / settled.length)} change after the first pack. Splashing decks: ${splash} of ${seats}.`,
    `\n## The pod's spread\n\nBest seat minus worst seat, win rate: mean ${pct(mean(spread))} (a pod's seven-opponent round-robin). Standard deviation of a seat's win rate within its pod: ${(mean(sd) * 100).toFixed(1)} points. A drafted deck's mean card rating: ${mean(ratings).toFixed(2)}.`,
  ];
  const text = L.join("\n"); console.log(text);
  mkdirSync(join(ROOT, "analysis/runs"), { recursive: true }); writeFileSync(join(ROOT, "analysis/runs/draft_sim.md"), text + "\n");
}
