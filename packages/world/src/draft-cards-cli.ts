/**
 * pnpm draft-cards [--pods 300] [--games 4] [--seed 53] --shard i/n [--out …]     play: pods drafted and played, each game's sightings
 * pnpm draft-cards --report [--sealed sealed53] <shard.json …>                     the per-card report (→ analysis/runs/draft_cards.md)
 *
 * Post-S52 (Chris: black's draft decks lose 46% while its Sealed decks are level, at every crowding): the per-card
 * test. Pods draft on the pick rule (world/drafter.ts), the builder makes each seat's deck, the pod plays a
 * round-robin (master both, 20 life), and every game records what each side saw in hand and cast — the rating run's
 * shape. Per card: how early it is taken (its mean pick), how often a pick makes the deck, the drafted decks holding
 * it, and its LIFT in draft games (the result when it was seen in hand, less its deck's own mean — the rating's
 * lift) set beside its lift in a Sealed run on the same pilot. A card taken early whose draft lift is low is a card
 * the rating oversells to a drafter.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, type CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { packTier, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck } from "./limited-builder.js";
import { cardRating, limitedView, type CardRatingTable } from "./rating.js";
import { runDraft } from "./drafter.js";
import type { RatingGame } from "./rating-run-cli.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = limitedView(JSON.parse(readFileSync(join(ROOT, arg("rating", "data/convocation/card-rating.json")), "utf8")) as CardRatingTable); // post-S52: a Limited sim reads the Limited score (a table without one reads as before)
const set = data.sets.find((s) => s.id === arg("set", "plane"))!, recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe))!;
const pilotVersion = (): number => Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1])));

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

interface SeatRecord { key: string; colors: string[]; picks: string[]; deck: string[] }

async function play(): Promise<void> {
  const PODS = Number(arg("pods", "300")), G = Number(arg("games", "4")), seed0 = Number(arg("seed", "53"));
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const seats: SeatRecord[] = [], games: RatingGame[] = [];
  for (let p = 0; p < PODS; p++) {
    if (p % sn !== si) continue;
    const d = runDraft(set, recipe, data, cards, rating, seed0 * 1000 + p, 8, 3, true);
    const builds = d.picks.map((x) => buildLimitedDeck(x, rating, cards));
    const key = (s: number) => `pod:${p}:${s}`;
    builds.forEach((b, s) => seats.push({ key: key(s), colors: b.colors, picks: d.picks[s]!, deck: b.deck.flatMap((e) => Array<string>(e.count).fill(e.cardId)) }));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) for (let g = 0; g < G; g++) {
      const seatA = g % 2, seed = seed0 + p * 100003 + i * 1009 + j * 37 + g;
      const [d0, d1] = seatA === 0 ? [builds[i]!.deck, builds[j]!.deck] : [builds[j]!.deck, builds[i]!.deck];
      const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const t0 = new Tracker(new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1))), t1 = new Tracker(new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0)));
      const r = await runMatch(spec, cards, [t0, t1]);
      const tA = seatA === 0 ? t0 : t1, tB = seatA === 0 ? t1 : t0;
      games.push({ a: key(i), b: key(j), winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", reason: r.reason, turns: r.turns, seenA: [...tA.seen], usedA: [...tA.used], seenB: [...tB.seen], usedB: [...tB.used] });
    }
  }
  const out = arg("out", join(ROOT, `analysis/runs/draftcards_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ pods: PODS, games: G, seed: seed0, set: set.id, recipe: recipe.id, pilotVersion: pilotVersion(), shard: `${si}/${sn}`, seats, results: games }));
}

type Side = [string, number, string[], string[]];
const sides = (g: RatingGame): Side[] => [[g.a, g.winner === "a" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenA, g.usedA], [g.b, g.winner === "b" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenB, g.usedB]];
/** A card's lift over a run: the result when seen in hand less its deck's own mean, with its standard error. */
function lifts(games: RatingGame[]): Record<string, { n: number; d: number; d2: number; used: number }> {
  const rec: Record<string, { n: number; w: number }> = {};
  for (const g of games) for (const [k, r] of sides(g)) { const x = (rec[k] ??= { n: 0, w: 0 }); x.n += 1; x.w += r; }
  const out: Record<string, { n: number; d: number; d2: number; used: number }> = {};
  for (const g of games) for (const [k, r, s, u] of sides(g)) for (const c of s) { const x = (out[c] ??= { n: 0, d: 0, d2: 0, used: 0 }); const v = r - rec[k]!.w / rec[k]!.n; x.n += 1; x.d += v; x.d2 += v * v; if (u.includes(c)) x.used += 1; }
  return out;
}

function report(): void {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as { pilotVersion: number; seats: SeatRecord[]; results: RatingGame[] });
  const seats = runs.flatMap((r) => r.seats), games = runs.flatMap((r) => r.results);
  const pilots = [...new Set(runs.map((r) => r.pilotVersion))];
  const sealedPrefix = arg("sealed", "sealed53");
  const sealedFiles = readdirSync(join(ROOT, "analysis/runs")).filter((f) => new RegExp(`^${sealedPrefix}_shard\\d+\\.json$`).test(f)).map((f) => join(ROOT, "analysis/runs", f));
  const sealedRun = sealedFiles.map((f) => JSON.parse(readFileSync(f, "utf8")) as { pilotVersion?: number; results: RatingGame[] });
  const sealedGames = sealedRun.flatMap((r) => r.results);
  const dl = lifts(games), sl = lifts(sealedGames);
  // the seats' results
  const seatRec: Record<string, { n: number; w: number }> = {};
  for (const g of games) for (const [k, r] of sides(g)) { const x = (seatRec[k] ??= { n: 0, w: 0 }); x.n += 1; x.w += r; }
  const wr = (k: string) => seatRec[k]!.w / seatRec[k]!.n;
  // per card: picks and pick numbers, decks
  const pk: Record<string, { picks: number; pickSum: number; inDeck: number; deckWr: number }> = {};
  for (const s of seats) {
    s.picks.forEach((id, i) => { const x = (pk[id] ??= { picks: 0, pickSum: 0, inDeck: 0, deckWr: 0 }); x.picks += 1; x.pickSum += i + 1; });
    for (const id of new Set(s.deck)) { const x = pk[id]; if (x) { x.inDeck += 1; x.deckWr += wr(s.key); } }
  }
  const colourOf = (d: CardDef) => (d.types.includes("Land") ? "land" : cardColors(d).join("") || "—");
  const pts = (x: number | null) => (x === null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lift = (t: typeof dl, id: string) => (t[id] && t[id]!.n ? t[id]!.d / t[id]!.n : null);
  const se = (t: typeof dl, id: string) => { const x = t[id]; if (!x || x.n < 2) return null; const m = x.d / x.n; return Math.sqrt(Math.max(0, x.d2 / x.n - m * m) / x.n); };
  const ids = Object.keys(pk).filter((id) => !cards.get(id)!.types.includes("Land") || true);
  const row = (id: string) => {
    const d = cards.get(id)!, x = pk[id]!;
    return { id, name: d.name, colour: colourOf(d), tier: packTier(d) ?? "—", rating: cardRating(d, rating), adp: x.pickSum / x.picks, picks: x.picks, deckRate: x.inDeck / x.picks, deckWr: x.inDeck ? x.deckWr / x.inDeck : NaN, dLift: lift(dl, id), dSe: se(dl, id), dN: dl[id]?.n ?? 0, sLift: lift(sl, id), sN: sl[id]?.n ?? 0, cast: dl[id] ? dl[id]!.used / dl[id]!.n : null };
  };
  const rows = ids.map(row);
  const L: string[] = [];
  L.push(`# The draft's cards (post-S52) — ${seats.length / 8} pods, ${games.length} games (pilot ${pilots.join(", ")}); Sealed beside it: ${sealedPrefix}, ${sealedGames.length} games (pilot ${[...new Set(sealedRun.map((r) => r.pilotVersion))].join(", ")})\n`);
  L.push(`Generated by \`pnpm draft-cards --report\`. **Mean pick**: the pick (1–45) at which the card is taken, over every copy taken. **Deck**: the share of picks that make the seat's forty. **Decks win**: the seats holding it in their forty. **Lift** (points): the result when seen in hand less the deck's own mean — the rating's lift — in draft games and in the Sealed run; ± is one standard error.\n`);
  // per colour
  const colours = ["W", "U", "B", "R", "G"];
  L.push(`## By colour — the cards a seat plays\n\n| colour | seats | seats win | mono cards | their mean pick | mean draft lift | mean Sealed lift | rating against draft lift, r |\n|---|---|---|---|---|---|---|---|`);
  const corr = (xs: number[], ys: number[]) => { const n = xs.length; if (n < 3) return NaN; const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let c = 0, sx = 0, sy = 0; xs.forEach((x, i) => { c += (x - mx) * (ys[i]! - my); sx += (x - mx) ** 2; sy += (ys[i]! - my) ** 2; }); return c / Math.sqrt(sx * sy); };
  const wmean = (rs: typeof rows, f: (r: (typeof rows)[number]) => number | null, w: (r: (typeof rows)[number]) => number) => { let a = 0, b = 0; for (const r of rs) { const v = f(r); if (v === null) continue; a += v * w(r); b += w(r); } return b ? a / b : null; };
  for (const c of colours) {
    const cs = seats.filter((s) => s.colors.includes(c)), mono = rows.filter((r) => r.colour === c && r.dN >= 50);
    L.push(`| ${c} | ${cs.length} | ${pct(cs.reduce((n, s) => n + wr(s.key), 0) / cs.length)} | ${mono.length} | ${(mono.reduce((n, r) => n + r.adp, 0) / mono.length).toFixed(1)} | ${pts(wmean(mono, (r) => r.dLift, (r) => r.dN))} | ${pts(wmean(mono, (r) => r.sLift, (r) => r.sN))} | ${corr(mono.map((r) => r.rating), mono.map((r) => r.dLift!)).toFixed(2)} |`);
  }
  const head = `| card | colour | tier | rating | mean pick | taken | deck | decks win | draft lift | seen | cast | Sealed lift | seen |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|`;
  const line = (r: (typeof rows)[number]) => `| ${r.name} | ${r.colour} | ${r.tier} | ${r.rating.toFixed(2)} | ${r.adp.toFixed(1)} | ${r.picks} | ${pct(r.deckRate)} | ${Number.isNaN(r.deckWr) ? "—" : pct(r.deckWr)} | ${pts(r.dLift)}${r.dSe !== null ? ` ±${(r.dSe * 100).toFixed(1)}` : ""} | ${r.dN} | ${r.cast === null ? "—" : pct(r.cast)} | ${pts(r.sLift)} | ${r.sN} |`;
  // the gap: the draft's lift against the Sealed lift (both measured), the largest drops
  const both = rows.filter((r) => r.dN >= 150 && r.sN >= 150 && r.colour !== "land");
  L.push(`\n## The largest gaps — draft lift less Sealed lift (seen 150+ times in each; the twenty-five that fall furthest)\n\n${head}`);
  for (const r of [...both].sort((a, b) => a.dLift! - a.sLift! - (b.dLift! - b.sLift!)).slice(0, 25)) L.push(line(r));
  L.push(`\n## Taken early, lifting little — the mean pick before 12, the draft lift below zero\n\n${head}`);
  for (const r of rows.filter((r) => r.adp < 12 && r.dLift !== null && r.dLift < 0 && r.dN >= 100).sort((a, b) => a.adp - b.adp)) L.push(line(r));
  for (const c of colours) {
    L.push(`\n## ${c} — every card, by mean pick\n\n${head}`);
    for (const r of rows.filter((r) => r.colour.includes(c)).sort((a, b) => a.adp - b.adp)) L.push(line(r));
  }
  L.push(`\n## Lands and colourless, by mean pick\n\n${head}`);
  for (const r of rows.filter((r) => r.colour === "land" || r.colour === "—").sort((a, b) => a.adp - b.adp)) L.push(line(r));
  const text = L.join("\n");
  writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", "draft_cards")}.md`), text + "\n");
  console.log(text.split("\n").slice(0, 30).join("\n"));
}

if (process.argv.includes("--report")) report(); else await play();
