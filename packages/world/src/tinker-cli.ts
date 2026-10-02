/**
 * pnpm tinker --list open:warband [--format open] [--variants 24] [--games 20] [--seed 53] [--band 1.0] [--vs open:levy,open:coin]
 *
 * Post-S52 (Chris: "a little signal above the noise about candidate improvements"): a SINGLE-SWAP study of one list.
 * The list as written plays a gauntlet (by default the format's other Open lists, as written), G games each; then V
 * variants — each the list with ONE card swapped for another of the same role, in its colours, rated within the band
 * — play the same gauntlet on the SAME seeds. A swap's delta is the variant's win rate less the baseline's, with a
 * paired standard error (game by game on the same seed). The report ranks the swaps, splits each by opponent, and
 * averages by the card that came in and the card that went out. Saved to analysis/runs/tinker_<list>.json — a
 * candidate input to the rating, NOT fed to it (one matchup set, small samples: read the z, not the delta).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, manaValue, parseManaCost } from "@shandalar/cards";
import { runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { OPEN_MEANS, cardLegal, copyCap } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { WorldRng } from "./rng.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const format = CONSTRUCTED_FORMATS.find((f) => f.id === arg("format", "open"))!, rule = format.rule;
const library = authoredLists(ROOT);
const listKey = arg("list", "open:warband"), list = library.find((l) => l.key === listKey);
if (!list) throw new Error(`tinker: no list ${listKey}`);
const V = Number(arg("variants", "24")), G = Number(arg("games", "20")), seed0 = Number(arg("seed", "53")), BAND = Number(arg("band", "1.0"));
const vs = arg("vs", "") ? arg("vs", "").split(",") : Object.keys(OPEN_MEANS).filter((k) => k !== listKey);
const gauntlet = vs.map((k) => library.find((l) => l.key === k)!).filter(Boolean);
type Deck = { cardId: string; count: number }[];
const def = (id: string) => cards.get(id)!, rate = (id: string) => cardRating(def(id), rating), name = (id: string) => def(id).name;
const role = (id: string) => (def(id).types.includes("Land") ? "land" : def(id).types.includes("Creature") ? "creature" : "spell");
const free = (id: string) => manaValue(parseManaCost(def(id).manaCost)) === 0;
const colours = [...new Set(list.decklist.filter((e) => role(e.cardId) !== "land").flatMap((e) => cardColors(def(e.cardId))))];

// the variants: one swap each, distinct, seeded
const rng = new WorldRng(seed0);
const outs = list.decklist.filter((e) => role(e.cardId) !== "land" && !free(e.cardId)).map((e) => e.cardId).sort();
const ins = (out: string) => [...cards.values()].filter((d) => d.id !== out && !d.types.includes("Land") && !free(d.id) && role(d.id) === role(out) && cardLegal(d, rule) && cardColors(d).every((c) => colours.includes(c)) && Math.abs(rate(d.id) - rate(out)) <= BAND && (list.decklist.find((e) => e.cardId === d.id)?.count ?? 0) < copyCap(d.id, rule)).map((d) => d.id).sort();
const swaps: { out: string; in: string; deck: Deck }[] = [];
for (let guard = 0; swaps.length < V && guard < V * 40; guard++) {
  const out = outs[rng.int(outs.length)]!, pool = ins(out); if (!pool.length) continue;
  const into = pool[rng.int(pool.length)]!;
  if (swaps.some((s) => s.out === out && s.in === into)) continue;
  const deck = list.decklist.map((e) => ({ ...e })); const o = deck.find((e) => e.cardId === out)!; o.count -= 1;
  const i = deck.find((e) => e.cardId === into); if (i) i.count += 1; else deck.push({ cardId: into, count: 1 });
  const d = deck.filter((e) => e.count > 0);
  if (checkDeck(d, null, rule, cards).ok) swaps.push({ out, in: into, deck: d });
}

/** One deck through the gauntlet: a result per (opponent, game), on fixed seeds. */
async function play(deck: Deck): Promise<number[][]> {
  const out: number[][] = [];
  for (let o = 0; o < gauntlet.length; o++) {
    const opp = gauntlet[o]!, row: number[] = [];
    for (let g = 0; g < G; g++) {
      const seat = g % 2, seed = seed0 * 7919 + o * 104729 + g * 37;
      const [d0, d1] = seat === 0 ? [deck, opp.decklist] : [opp.decklist, deck];
      const [a0, a1] = seat === 0 ? [list!.archetype, opp.archetype] : [opp.archetype, list!.archetype];
      const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      let r;
      try { r = await runMatch(spec, cards, [new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", a0, d1)), new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", a1, d0))]); }
      catch (e) { throw new Error(`engine error against ${opp.key}, seed ${seed}, seat ${seat}: ${(e as Error).message}`); }
      row.push(r.winner === null ? 0.5 : r.winner === seat ? 1 : 0);
    }
    out.push(row);
  }
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const base = await play(list.decklist);
const baseWr = mean(base.flat());
const rows: { out: string; in: string; delta: number; se: number; z: number; n: number; byOpp: Record<string, number> }[] = [];
const errors: string[] = [];
for (const s of swaps) {
  let res: number[][];
  try { res = await play(s.deck); } catch (e) { errors.push(`${name(s.out)} → ${name(s.in)}: ${(e as Error).message}`); continue; } // an engine error is a finding: reported, the variant dropped
  const d = res.flat().map((x, i) => x - base.flat()[i]!), n = d.length, m = mean(d), sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1)), se = sd / Math.sqrt(n);
  rows.push({ out: s.out, in: s.in, delta: m, se, z: se > 0 ? m / se : 0, n, byOpp: Object.fromEntries(gauntlet.map((o, i) => [o.key, mean(res[i]!) - mean(base[i]!)])) });
}
rows.sort((a, b) => b.delta - a.delta);
const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}`;
const byCard = (side: "in" | "out") => { const m = new Map<string, number[]>(); for (const r of rows) m.set(r[side], [...(m.get(r[side]) ?? []), r.delta]); return [...m].map(([id, ds]) => ({ id, n: ds.length, delta: mean(ds) })).sort((a, b) => b.delta - a.delta); };
const swing = (r: (typeof rows)[number]) => { const e = Object.entries(r.byOpp).sort((a, b) => b[1] - a[1]); return `best vs ${e[0]![0].replace("open:", "")} ${pts(e[0]![1])}, worst vs ${e[e.length - 1]![0].replace("open:", "")} ${pts(e[e.length - 1]![1])}`; };
const L = [`# The tinker study — ${listKey} in ${format.name} (post-S52): ${rows.length} single swaps, each over ${gauntlet.length} opponents × ${G} games on the baseline's seeds\n`,
  `The list as written wins **${Math.round(baseWr * 100)}%** against this gauntlet (${base.flat().length} games). A swap's delta is in win-rate points; the standard error is paired, game by game. With ${base.flat().length} games a swap a delta under about ${(2 * mean(rows.map((r) => r.se)) * 100).toFixed(0)} points is noise (|z| < 2).\n`,
  `| out | in | delta | ± | z | the matchups it moved most |\n|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${name(r.out)} | ${name(r.in)} | ${pts(r.delta)} | ${(r.se * 100).toFixed(1)} | ${r.z.toFixed(1)} | ${swing(r)} |`),
  `\n## By the card that came in (mean over its swaps)\n\n${byCard("in").map((c) => `${name(c.id)} ${pts(c.delta)} (${c.n})`).join(" · ")}`,
  `\n## By the card that went out (a positive number says the list is better without a copy)\n\n${byCard("out").map((c) => `${name(c.id)} ${pts(c.delta)} (${c.n})`).join(" · ")}`,
  ...(errors.length ? [`\n## Engine errors (${errors.length}) — a variant the engine could not finish\n\n${errors.map((e) => `- ${e}`).join("\n")}`] : []),
  `\n## Read\n\n${rows.filter((r) => Math.abs(r.z) >= 2).length} of ${rows.length} swaps clear |z| ≥ 2 (about ${Math.round(rows.length * 0.05)} would by chance). ${rows.filter((r) => r.z >= 2).map((r) => `${name(r.out)} → ${name(r.in)} (${pts(r.delta)})`).join("; ") || "No swap is a clear improvement."}${rows.filter((r) => r.z <= -2).length ? ` Clearly worse: ${rows.filter((r) => r.z <= -2).map((r) => `${name(r.out)} → ${name(r.in)} (${pts(r.delta)})`).join("; ")}.` : ""}`,
];
const text = L.join("\n"); console.log(text);
mkdirSync(join(ROOT, "analysis/runs"), { recursive: true });
const slug = listKey.replace(/[^a-z0-9]+/gi, "_");
writeFileSync(join(ROOT, `analysis/runs/tinker_${slug}.md`), text + "\n");
writeFileSync(join(ROOT, `analysis/runs/tinker_${slug}.json`), JSON.stringify({ list: listKey, format: format.id, seed: seed0, games: G, gauntlet: gauntlet.map((g) => g.key), baseline: baseWr, swaps: rows }, null, 1));
