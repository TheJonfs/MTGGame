/**
 * pnpm sealed-sim [--pools 200] [--games 10] [--opponents 20] [--seed 48] [--set plane] [--recipe classic] [--shard i/n]
 * pnpm sealed-sim --report [files…]      (default: analysis/runs/sealed_shard*.json)
 *
 * S48 (Part 2): the Sealed sim — N pools (six packs each) → N decks by the Limited builder → each deck against
 * `opponents` others (a circulant: i meets i+1 … i+opponents/2), `games` a pairing, master both, 20 life, seats
 * alternating. Per game and seat the cards seen in hand and cast — the rating run's shape, so `pnpm rating:build
 * --sealed` reads the shards as the rating's first update (decks no author built: a card's lift here is free of the
 * authored lists' confound). The report: the builder's own checks, the pair chosen per pool and how each pair fared,
 * the curve, the deck win rates.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { rollSealedPool, packColors, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck, pairScores, LIMITED_TARGETS, type LimitedBuild } from "./limited-builder.js";
import { WorldRng } from "./rng.js";
import type { PackColor } from "./packs.js";
import { isBasic } from "./legality.js";
import { limitedView, type CardRatingTable } from "./rating.js";
import type { RatingGame } from "./rating-run-cli.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const N = Number(arg("pools", "200")), G = Number(arg("games", "10")), OPP = Number(arg("opponents", "20")), seed0 = Number(arg("seed", "48"));
const set = data.sets.find((s) => s.id === arg("set", "plane"))!, recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe))!;
const ratingFile = arg("rating", "data/convocation/card-rating.json");
const rating = limitedView(JSON.parse(readFileSync(join(ROOT, ratingFile), "utf8")) as CardRatingTable); // post-S52: a Limited sim reads the Limited score (a table without one reads as before)

// S49 (rating noise): `--noise 0.4 --noise-share 0.33` — that share of the decks is built with Gaussian noise on each
// card's rating (seeded per deck), so cards the rating under-rates get played and gather evidence.
const NOISE = Number(arg("noise", "0")), NOISE_SHARE = Number(arg("noise-share", "0.3333"));
const gauss = (rng: WorldRng) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng.float()))) * Math.cos(2 * Math.PI * rng.float());
const noisy = (i: number) => NOISE > 0 && i % Math.round(1 / NOISE_SHARE) === 0;
const PACKS = Number(arg("packs", "6")); // post-S52: 3 = a draft seat's card count (is black's Sealed strength depth?)
const VARY = Number(arg("vary", "0"));
const poolOf = (i: number) => rollSealedPool(set, recipe, cards, data.power, seed0 * 100003 + i, PACKS).flat();
const builds: { pool: string[]; build: LimitedBuild; noisy: boolean }[] = Array.from({ length: N }, (_, i) => {
  const pool = poolOf(i);
  const vary = VARY ? { pairChoice: { seed: seed0 * 6007 + i, top: VARY } } : {}; // S53 (ADR-154): --vary 3
  if (!noisy(i)) return { pool, build: buildLimitedDeck(pool, rating, cards, vary), noisy: false };
  const rng = new WorldRng(seed0 * 7919 + i);
  return { pool, build: buildLimitedDeck(pool, rating, cards, { ...vary, noise: () => NOISE * gauss(rng) }), noisy: true };
});
const key = (i: number) => `pool:${i}`;
/** S51 (ADR-150): the pilot's version — the highest book of shame at the time of the run. A rating pools only runs
 * played on the current pilot. */
export const pilotVersion = (): number => Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1])));

class Tracker implements Agent {
  seen = new Set<string>(); used = new Set<string>();
  constructor(private inner: Agent) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    for (const c of view.hand) this.seen.add(c.cardId);
    const a = await this.inner.chooseAction(view, req);
    if (a.type === "castSpell" || a.type === "playLand") { const c = view.hand.find((h) => h.objectId === a.objectId)?.cardId; if (c) this.used.add(c); }
    return a;
  }
}

async function run(): Promise<void> {
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const pairs: [number, number][] = [];
  for (let i = 0; i < N; i++) for (let d = 1; d <= OPP / 2; d++) pairs.push([i, (i + d) % N]);
  const games: RatingGame[] = [];
  for (let p = 0; p < pairs.length; p++) {
    if (p % sn !== si) continue;
    const [ia, ib] = pairs[p]!, A = builds[ia]!.build.deck, B = builds[ib]!.build.deck;
    for (let g = 0; g < G; g++) {
      const seatA = g % 2, seed = seed0 + p * 1009 + g * 37;
      const [d0, d1] = seatA === 0 ? [A, B] : [B, A];
      const spec = { seed, players: [{ name: "a", decklist: d0, agent: "heuristic:master" }, { name: "b", decklist: d1, agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const t0 = new Tracker(new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1))), t1 = new Tracker(new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0)));
      const r = await runMatch(spec, cards, [t0, t1]);
      const tA = seatA === 0 ? t0 : t1, tB = seatA === 0 ? t1 : t0;
      games.push({ a: key(ia), b: key(ib), winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", reason: r.reason, turns: r.turns, seenA: [...tA.seen], usedA: [...tA.used], seenB: [...tB.seen], usedB: [...tB.used] });
    }
  }
  const out = arg("out", join(ROOT, `analysis/runs/sealed_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ pools: N, games: G, opponents: OPP, seed: seed0, set: set.id, recipe: recipe.id, rating: ratingFile, noise: NOISE, pilotVersion: pilotVersion(), shard: `${si}/${sn}`, results: games }));
}

// ---------- S49 Part 1: the forced-pair experiment ----------
const ALL_PAIRS: [PackColor, PackColor][] = []; { const C: PackColor[] = ["W", "U", "B", "R", "G"]; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) ALL_PAIRS.push([C[i]!, C[j]!]); }
// S50: `--pairs WR,UR,BR,RG` runs the experiment for those pairs only.
const ONLY_PAIRS = arg("pairs", "").split(",").filter(Boolean);
const PAIRS = ONLY_PAIRS.length ? ALL_PAIRS.filter((p) => ONLY_PAIRS.includes(p.join(""))) : ALL_PAIRS;
const PER_PAIR = Number(arg("per-pair", "40")), FIELD = 40;
/** For each pair, the first PER_PAIR pools (from a stream past the field's) in which the pair is at least third by the
 * builder's own score; the deck forced into that pair, and the deck the builder would choose from the same pool. */
function forcedBuilds(): { pair: string; pool: number; rank: number; forced: LimitedBuild; chosen: LimitedBuild }[] {
  const out: { pair: string; pool: number; rank: number; forced: LimitedBuild; chosen: LimitedBuild }[] = [];
  const need = new Map(PAIRS.map((p) => [p.join(""), PER_PAIR]));
  for (let i = 100000; [...need.values()].some((n) => n > 0) && i < 140000; i++) {
    const pool = poolOf(i), scores = pairScores(pool, rating, cards);
    scores.slice(0, 3).forEach((s, rank) => {
      const k = s.pair.join(""); if ((need.get(k) ?? 0) <= 0) return;
      need.set(k, need.get(k)! - 1);
      out.push({ pair: k, pool: i, rank: rank + 1, forced: buildLimitedDeck(pool, rating, cards, { forcePair: s.pair }), chosen: buildLimitedDeck(pool, rating, cards) });
    });
  }
  return out;
}
async function runForced(): Promise<void> {
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const fb = forcedBuilds();
  const field = builds.slice(0, FIELD).map((b) => b.build.deck);
  const games: { deck: number; kind: "forced" | "chosen"; opp: number; win: number }[] = [];
  let job = 0;
  for (let d = 0; d < fb.length; d++) for (const kind of ["forced", "chosen"] as const) {
    if (kind === "chosen" && fb[d]!.chosen.colors.join("") === fb[d]!.pair && JSON.stringify(fb[d]!.chosen.deck) === JSON.stringify(fb[d]!.forced.deck)) continue; // the same deck: its forced games stand for both
    for (let o = 0; o < OPP; o++) {
      if (job++ % sn !== si) continue;
      const opp = (d * 7 + o) % FIELD, A = fb[d]![kind].deck, Bd = field[opp]!;
      for (let g = 0; g < G; g++) {
        const seatA = g % 2, seed = seed0 + d * 7919 + o * 104729 + g * 37; // the same seeds for forced and chosen
        const [d0, d1] = seatA === 0 ? [A, Bd] : [Bd, A];
        const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
        const r = await runMatch(spec, cards, [new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1)), new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0))]);
        games.push({ deck: d, kind, opp, win: r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0 });
      }
    }
  }
  writeFileSync(arg("out", join(ROOT, `analysis/runs/${arg("tag", "forced")}_shard${si}.json`)), JSON.stringify({ results: games }));
}
function reportForced(): void {
  const tag = arg("tag", "forced");
  const files = readdirSync(join(ROOT, "analysis/runs")).filter((f) => new RegExp(`^${tag}_shard\\d+\\.json$`).test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
  const games = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: { deck: number; kind: "forced" | "chosen"; opp: number; win: number }[] }).results);
  const fb = forcedBuilds();
  const acc = fb.map(() => ({ forced: { n: 0, w: 0 }, chosen: { n: 0, w: 0 } }));
  for (const g of games) { const x = acc[g.deck]![g.kind]; x.n += 1; x.w += g.win; }
  const wr = (d: number, kind: "forced" | "chosen") => { const same = acc[d]!.chosen.n === 0; const x = kind === "chosen" && same ? acc[d]!.forced : acc[d]![kind]; return x.n ? x.w / x.n : NaN; };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length), pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const L: string[] = [`# The forced-pair experiment (S49 Part 1) — ${games.length} games; each deck against twenty of the field's forty chosen decks, ${G} games a pairing, master both\n`, `For each pair: ${PER_PAIR} pools in which the pair is at least third by the builder's own score. FORCED is the best deck the builder makes in that pair; CHOSEN is the deck the builder would pick from the same pool, on the same seeds.\n`, `| pair | decks | pair was 1st / 2nd / 3rd | forced | chosen (same pools) | forced − chosen | forced, where the pair was 1st | forced, where 2nd or 3rd | creatures | avg MV | mean rating |`, `|---|---|---|---|---|---|---|---|---|---|---|`];
  const rows: { pair: string; f: number }[] = [];
  for (const p of PAIRS.map((x) => x.join(""))) {
    const ds = fb.map((b, i) => [b, i] as const).filter(([b]) => b.pair === p);
    const f = mean(ds.map(([, i]) => wr(i, "forced"))), c = mean(ds.map(([, i]) => wr(i, "chosen")));
    const first = ds.filter(([b]) => b.rank === 1), rest = ds.filter(([b]) => b.rank > 1);
    rows.push({ pair: p, f });
    L.push(`| ${p} | ${ds.length} | ${[1, 2, 3].map((r) => ds.filter(([b]) => b.rank === r).length).join(" / ")} | **${pct(f)}** | ${pct(c)} | ${((f - c) * 100 >= 0 ? "+" : "") + ((f - c) * 100).toFixed(1)} | ${first.length ? pct(mean(first.map(([, i]) => wr(i, "forced")))) : "—"} | ${rest.length ? pct(mean(rest.map(([, i]) => wr(i, "forced")))) : "—"} | ${mean(ds.map(([b]) => b.forced.creatures)).toFixed(1)} | ${mean(ds.map(([b]) => b.forced.avgMv)).toFixed(2)} | ${mean(ds.map(([b]) => b.forced.rating)).toFixed(2)} |`);
  }
  const byColor = (c: string) => mean(rows.filter((r) => r.pair.includes(c)).map((r) => r.f));
  L.push(`\nA colour's forced win rate (the mean of its four pairs): ${["W", "U", "B", "R", "G"].map((c) => `${c} ${pct(byColor(c))}`).join(" · ")}.`);
  const text = L.join("\n"); console.log(text); writeFileSync(join(ROOT, `analysis/runs/${arg("tag", "forced")}_pairs.md`), text + "\n");
}

function report(): void {
  const given = process.argv.slice(2).filter((a) => a.endsWith(".json") && !a.includes("card-rating"));
  const files = given.length ? given : readdirSync(join(ROOT, "analysis/runs")).filter((f) => /^sealed_shard\d+\.json$/.test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
  const games: RatingGame[] = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: RatingGame[] }).results);
  const rec: Record<string, { n: number; w: number; turns: number }> = {};
  let decked = 0, draws = 0;
  for (const g of games) {
    for (const [k, r] of [[g.a, g.winner === "a" ? 1 : g.winner === "draw" ? 0.5 : 0], [g.b, g.winner === "b" ? 1 : g.winner === "draw" ? 0.5 : 0]] as [string, number][]) { const x = (rec[k] ??= { n: 0, w: 0, turns: 0 }); x.n += 1; x.w += r; x.turns += g.turns; }
    if (g.reason === "DECKED") decked += 1; if (g.winner === "draw") draws += 1;
  }
  const wr = (i: number) => (rec[key(i)] ? rec[key(i)]!.w / rec[key(i)]!.n : NaN);
  const L: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  L.push(`# The Sealed sim (S48) — ${N} pools (${set.name}, ${PACKS === 6 ? "six" : PACKS} ${recipe.name} packs), ${games.length} games, master both, 20 life\n`);
  // the builder's checks
  const fixers = (b: { pool: string[]; build: LimitedBuild }) => b.pool.filter((id) => { const d = cards.get(id)!; return d.types.includes("Land") && (JSON.stringify(d.abilities ?? []).includes('"basicLand"') || (b.build.splash !== null && packColors(d).includes(b.build.splash) && packColors(d).some((c) => b.build.colors.includes(c)))); }).length;
  const size = (b: LimitedBuild) => b.deck.reduce((n, e) => n + e.count, 0);
  const under40 = builds.filter((b) => size(b.build) < 40).length, over40 = builds.filter((b) => size(b.build) > 40).length, fewLands = builds.filter((b) => b.build.lands < 15).length, badSplash = builds.filter((b) => b.build.splash && fixers(b) < LIMITED_TARGETS.fixersForSplash).length;
  L.push(`## The builder's checks\n\n- decks under forty: **${under40}**; over forty: ${over40}\n- decks with fewer than fifteen lands: **${fewLands}**\n- three-colour decks without two fixing sources: **${badSplash}**`);
  L.push(`- short of 23 spells: ${builds.filter((b) => b.build.spells < 23).length}; under 13 creatures: ${builds.filter((b) => b.build.creatures < LIMITED_TARGETS.creatures).length}; under five two-drops: ${builds.filter((b) => b.build.curve[0]! + b.build.curve[1]! + b.build.curve[2]! < LIMITED_TARGETS.twoDrops).length}; under four three-drops: ${builds.filter((b) => b.build.curve[3]! < LIMITED_TARGETS.threeDrops).length}`);
  const landHist: Record<number, number> = {}; for (const b of builds) landHist[b.build.lands] = (landHist[b.build.lands] ?? 0) + 1;
  L.push(`- lands: ${Object.entries(landHist).map(([k, n]) => `${k} × ${n}`).join(", ")}; splashing: ${builds.filter((b) => b.build.splash).length} of ${N}`);
  // pairs
  const byPair: Record<string, number[]> = {};
  builds.forEach((b, i) => (byPair[b.build.colors.join("")] ??= []).push(i));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  L.push(`\n## The pair chosen per pool, and how it fared\n\n| pair | pools | share | mean win rate |\n|---|---|---|---|`);
  for (const [p, is] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) L.push(`| ${p} | ${is.length} | ${pct(is.length / N)} | ${pct(mean(is.map(wr).filter((x) => !Number.isNaN(x))))} |`);
  const colorShare: Record<string, number> = {}; for (const b of builds) for (const c of b.build.colors) colorShare[c] = (colorShare[c] ?? 0) + 1;
  L.push(`\nA colour's share of decks: ${["W", "U", "B", "R", "G"].map((c) => `${c} ${pct((colorShare[c] ?? 0) / N)}`).join(" · ")} (even would be 40% each).`);
  L.push(`A colour's decks win: ${["W", "U", "B", "R", "G"].map((c) => `${c} ${pct(mean(builds.map((b, i) => [b, wr(i)] as const).filter(([b, x]) => b.build.colors.includes(c as PackColor) && !Number.isNaN(x)).map(([, x]) => x)))}`).join(" · ")}.`);
  const sp = builds.map((b, i) => [b.build.splash !== null, wr(i)] as const).filter(([, x]) => !Number.isNaN(x));
  L.push(`Splashing decks win ${pct(mean(sp.filter(([s]) => s).map(([, x]) => x)))}; two-colour decks ${pct(mean(sp.filter(([s]) => !s).map(([, x]) => x)))}.`);
  // curve
  const curve = [0, 0, 0, 0, 0, 0, 0, 0]; for (const b of builds) b.build.curve.forEach((n, i) => (curve[i]! += n));
  L.push(`\n## The curve (nonland cards per deck, by mana value)\n\n| ${["0", "1", "2", "3", "4", "5", "6", "7+"].join(" | ")} | avg MV | creatures |\n|${"---|".repeat(10)}\n| ${curve.map((n) => (n / N).toFixed(1)).join(" | ")} | ${mean(builds.map((b) => b.build.avgMv)).toFixed(2)} | ${mean(builds.map((b) => b.build.creatures)).toFixed(1)} |`);
  // win rates
  const rates = builds.map((_, i) => wr(i)).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  const q = (p: number) => rates[Math.min(rates.length - 1, Math.floor(p * rates.length))]!;
  L.push(`\n## The decks' win rates\n\nlowest ${pct(rates[0]!)} · 10th percentile ${pct(q(0.1))} · median ${pct(q(0.5))} · 90th ${pct(q(0.9))} · highest ${pct(rates[rates.length - 1]!)}. Games per deck: ${Math.round(mean(Object.values(rec).map((x) => x.n)))}; mean turns ${(games.reduce((n, g) => n + g.turns, 0) / games.length).toFixed(1)}; by decking ${pct(decked / games.length)}; drawn ${draws}.`);
  const corr = (() => { const xs = builds.map((b) => b.build.rating), ys = builds.map((_, i) => wr(i)); const mx = mean(xs), my = mean(ys); const c = xs.reduce((n, x, i) => n + (x - mx) * (ys[i]! - my), 0), sx = Math.sqrt(xs.reduce((n, x) => n + (x - mx) ** 2, 0)), sy = Math.sqrt(ys.reduce((n, y) => n + (y - my) ** 2, 0)); return c / (sx * sy); })();
  L.push(`A deck's mean card rating against its win rate: r = ${corr.toFixed(2)} (the rating's first check — does a deck the rating likes win?).`);
  const text = L.join("\n");
  console.log(text);
  writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", "sealed_sim")}.md`), text + "\n");
  void isBasic;
}

if (process.argv.includes("--forced-report")) reportForced(); else if (process.argv.includes("--forced")) await runForced(); else if (process.argv.includes("--report")) report(); else await run();
