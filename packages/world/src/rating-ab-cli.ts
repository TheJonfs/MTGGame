/**
 * pnpm rating-ab --draft <A prefix> <B prefix> [--pods 100] [--games 2] --shard i/n      drafted decks, head to head
 * pnpm rating-ab --sealed <A rating.json> <B rating.json> [--pools 200] [--games 4] [--seed 49] --shard i/n
 * pnpm rating-ab --constructed <A rating.json> <B rating.json> [--format open] [--decks 200] [--games 4] [--seed 53] --shard i/n
 * pnpm rating-ab --variation [--format open] [--decks 200] [--games 4] [--seed 53] --shard i/n   the S52 noise (A) against the plan rules (B), one rating
 * pnpm rating-ab --report <shard.json …>
 *
 * Post-S52 (Chris: a Limited score apart from the Constructed one): does a rating build BETTER decks? Within one run
 * every seat reads the same rating, so a pod's mean is 50% by construction. Here the two ratings' decks meet:
 *  - DRAFT: two `draft-cards` runs on the same seed (the same packs), drafted under A and under B; every B seat of a
 *    pod plays every A seat of that pod (the same seat too — the same packs, read two ways);
 *  - SEALED: the same pools, built under A and under B; pool i's B deck plays pool i+1…i+k's A decks and pool i's own.
 *  - CONSTRUCTED: the select-and-repair builder on the same seeds (the same source list and tinker roll) under A's
 *    `rating` and B's — the Constructed score, read raw; deck i under B plays decks i…i+k under A.
 * Master both, 20 life, seats alternating. The report: B's decks' win rate against A's, with its standard error.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { rollSealedPool, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck } from "./limited-builder.js";
import { limitedView, type CardRatingTable } from "./rating.js";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { buildConstructedDeck, tuneVariation } from "./constructed-builder.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const set = data.sets.find((s) => s.id === arg("set", "plane"))!, recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe))!;
const G = Number(arg("games", "2")), [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
type Deck = { cardId: string; count: number }[];
interface Seat { deck: Deck; colors: string }
interface Result { a: string; b: string; colorsA: string; colorsB: string; bScore: number }

const toDeck = (ids: string[]): Deck => { const m = new Map<string, number>(); for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1); return [...m].map(([cardId, count]) => ({ cardId, count })); };
async function meet(A: Seat, B: Seat, seed0: number): Promise<number> {
  let b = 0;
  for (let g = 0; g < G; g++) {
    const bFirst = g % 2, seed = seed0 + g * 37;
    const [d0, d1] = bFirst === 0 ? [B.deck, A.deck] : [A.deck, B.deck];
    const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
    const r = await runMatch(spec, cards, [new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1)), new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0))]);
    b += r.winner === null ? 0.5 : r.winner === bFirst ? 1 : 0;
  }
  return b / G;
}

async function draft(): Promise<void> {
  const [pa, pb] = process.argv.slice(process.argv.indexOf("--draft") + 1, process.argv.indexOf("--draft") + 3) as [string, string];
  const seatsOf = (pre: string) => { const m = new Map<string, Seat>(); for (const f of readdirSync(join(ROOT, "analysis/runs")).filter((x) => new RegExp(`^${pre}_shard\\d+\\.json$`).test(x))) for (const s of (JSON.parse(readFileSync(join(ROOT, "analysis/runs", f), "utf8")) as { seats: { key: string; colors: string[]; deck: string[] }[] }).seats) m.set(s.key, { deck: toDeck(s.deck), colors: s.colors.join("") }); return m; };
  const A = seatsOf(pa), B = seatsOf(pb), PODS = Number(arg("pods", "100"));
  const out: Result[] = [];
  for (let p = 0; p < PODS; p++) {
    if (p % sn !== si) continue;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const a = A.get(`pod:${p}:${j}`), b = B.get(`pod:${p}:${i}`); if (!a || !b) continue;
      out.push({ a: `pod:${p}:${j}`, b: `pod:${p}:${i}`, colorsA: a.colors, colorsB: b.colors, bScore: await meet(a, b, 5400000 + p * 1009 + i * 97 + j * 13) });
    }
  }
  save(out, { mode: "draft", a: pa, b: pb });
}

async function sealed(): Promise<void> {
  const [fa, fb] = process.argv.slice(process.argv.indexOf("--sealed") + 1, process.argv.indexOf("--sealed") + 3) as [string, string];
  const ra = limitedView(JSON.parse(readFileSync(join(ROOT, fa), "utf8")) as CardRatingTable), rb = limitedView(JSON.parse(readFileSync(join(ROOT, fb), "utf8")) as CardRatingTable);
  const N = Number(arg("pools", "200")), K = Number(arg("opponents", "4")), seed0 = Number(arg("seed", "49"));
  const pools = Array.from({ length: N }, (_, i) => rollSealedPool(set, recipe, cards, data.power, seed0 * 100003 + i).flat());
  const seat = (pool: string[], r: CardRatingTable): Seat => { const b = buildLimitedDeck(pool, r, cards); return { deck: b.deck, colors: b.colors.join("") }; };
  const A = pools.map((p) => seat(p, ra)), B = pools.map((p) => seat(p, rb));
  const out: Result[] = [];
  let k = 0;
  for (let i = 0; i < N; i++) for (let d = 0; d <= K; d++) {
    if (k++ % sn !== si) continue;
    const j = (i + d) % N;
    out.push({ a: `pool:${j}`, b: `pool:${i}`, colorsA: A[j]!.colors, colorsB: B[i]!.colors, bScore: await meet(A[j]!, B[i]!, seed0 * 1000 + i * 1009 + d * 37) });
  }
  save(out, { mode: "sealed", a: fa, b: fb });
}

async function constructed(variation = false): Promise<void> {
  const [fa, fb] = variation ? ["data/convocation/card-rating.json", "data/convocation/card-rating.json"] : process.argv.slice(process.argv.indexOf("--constructed") + 1, process.argv.indexOf("--constructed") + 3) as [string, string];
  const ra = JSON.parse(readFileSync(join(ROOT, fa), "utf8")) as CardRatingTable, rb = JSON.parse(readFileSync(join(ROOT, fb), "utf8")) as CardRatingTable;
  const format = CONSTRUCTED_FORMATS.find((f) => f.id === arg("format", "open"))!, library = authoredLists(ROOT);
  const N = Number(arg("decks", "200")), K = Number(arg("opponents", "4")), seed0 = Number(arg("seed", "53"));
  let swapsMade = 0;
  const seat = (k: number, r: CardRatingTable): Seat & { list: string } => { const b = buildConstructedDeck(format, r, seed0 * 100003 + k, library, cards); swapsMade += b.swaps.length; return { deck: b.deck, colors: b.from, list: b.from }; };
  if (variation) tuneVariation({ plan: 0 });
  const A = Array.from({ length: N }, (_, k) => seat(k, ra)); const swapsA = swapsMade; swapsMade = 0;
  if (variation) tuneVariation({ plan: 1 });
  const B = Array.from({ length: N }, (_, k) => seat(k, rb)); const swapsB = swapsMade;
  const key = (d: Deck) => JSON.stringify([...d].sort((x, y) => x.cardId.localeCompare(y.cardId)));
  const same = A.filter((a, k) => key(a.deck) === key(B[k]!.deck)).length;
  const out: Result[] = [];
  let k = 0;
  for (let i = 0; i < N; i++) for (let d = 0; d <= K; d++) {
    if (k++ % sn !== si) continue;
    const j = (i + d) % N;
    out.push({ a: `deck:${j}`, b: `deck:${i}`, colorsA: A[j]!.colors, colorsB: B[i]!.colors, bScore: await meet(A[j]!, B[i]!, seed0 * 1000 + i * 1009 + d * 37) });
  }
  const distinct = (xs: Seat[]) => new Set(xs.map((x) => key(x.deck))).size;
  save(out, { mode: `${variation ? "variation" : "constructed"}-${format.id}`, a: variation ? "the S52 noise" : fa, b: variation ? "the plan rules" : fb, identical: `${same} of ${N}`, variety: `distinct decks A ${distinct(A)} · B ${distinct(B)} of ${N}; swaps made A ${swapsA} · B ${swapsB}` });
}

function save(results: Result[], meta: Record<string, string>): void {
  const out = arg("out", join(ROOT, `analysis/runs/ab_${meta.mode}_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ ...meta, games: G, shard: `${si}/${sn}`, results }));
}

function report(): void {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as { mode: string; a: string; b: string; games: number; identical?: string; variety?: string; results: Result[] });
  const rs = runs.flatMap((r) => r.results);
  const m = rs.reduce((n, r) => n + r.bScore, 0) / rs.length, sd = Math.sqrt(rs.reduce((n, r) => n + (r.bScore - m) ** 2, 0) / rs.length);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const L = [`# Rating A/B (post-S52) — ${runs[0]!.mode}: B (${runs[0]!.b}) against A (${runs[0]!.a}), ${rs.length} meetings × ${runs[0]!.games} games`, ``, `**B's decks win ${pct(m)}** (± ${(100 * sd / Math.sqrt(rs.length)).toFixed(1)} points, one standard error over meetings).`, ``];
  if (runs[0]!.identical) L.push(`Decks identical both ways: ${runs[0]!.identical}.${runs[0]!.variety ? ` Variety: ${runs[0]!.variety}.` : ""}`);
  const same = rs.filter((r) => r.a === r.b);
  if (same.length) { const s = same.reduce((n, r) => n + r.bScore, 0) / same.length; L.push(`The same packs or pool read two ways (B's deck against A's from the same seat): B wins ${pct(s)} over ${same.length} meetings.`); }
  const share = (key: "colorsA" | "colorsB", c: string) => { const seen = new Map<string, string>(); for (const r of rs) seen.set(key === "colorsA" ? r.a : r.b, r[key]); const xs = [...seen.values()]; return xs.filter((x) => x.includes(c)).length / xs.length; };
  if (runs[0]!.mode.startsWith("constructed") || runs[0]!.mode.startsWith("variation")) { // by source list — B's decks from it against A's field, beside A's decks from it against B's field
    const lists0 = [...new Set(rs.map((r) => r.colorsB))].sort();
    L.push(``, `| source list | B's decks from it (vs A's field) | A's decks from it (vs B's field) | B − A | meetings |`, `|---|---|---|---|---|`);
    for (const l of lists0) { const b = rs.filter((r) => r.colorsB === l).map((r) => r.bScore), a = rs.filter((r) => r.colorsA === l).map((r) => 1 - r.bScore); const mb = b.reduce((n, x) => n + x, 0) / b.length, ma = a.reduce((n, x) => n + x, 0) / a.length; L.push(`| ${l} | ${pct(mb)} | ${pct(ma)} | ${((mb - ma) * 100).toFixed(1)} | ${b.length} |`); }
    const text0 = L.join("\n"); writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", `ab_${runs[0]!.mode}`)}.md`), text0 + "\n"); console.log(text0); return;
  }
  L.push(``, `| colour | A's decks on it | B's decks on it | B's decks on it win (against A) |`, `|---|---|---|---|`);
  for (const c of ["W", "U", "B", "R", "G"]) { const on = rs.filter((r) => r.colorsB.includes(c)); L.push(`| ${c} | ${pct(share("colorsA", c))} | ${pct(share("colorsB", c))} | ${on.length ? pct(on.reduce((n, r) => n + r.bScore, 0) / on.length) : "—"} |`); }
  const text = L.join("\n");
  writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", `ab_${runs[0]!.mode}`)}.md`), text + "\n");
  console.log(text);
}

if (process.argv.includes("--report")) report(); else if (process.argv.includes("--draft")) await draft(); else if (process.argv.includes("--sealed")) await sealed(); else if (process.argv.includes("--constructed")) await constructed(); else if (process.argv.includes("--variation")) await constructed(true); else throw new Error("rating-ab: --draft, --sealed or --report");
