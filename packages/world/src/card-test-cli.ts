/**
 * pnpm card-test --variants base,v1,v2,… [--hosts 200] [--opponents 5] [--games 4] [--seed 60] --shard i/n [--tag name]
 * pnpm card-test --report <shard.json …> [--tag name]
 *
 * Post-S53 (Chris: "a single-card playtest system") — how strong is a card, or a variant of one? The SWAP IN PLACE:
 *  - HOST decks: Sealed pools built by the Limited builder in their best pair that holds red (`forcePair`), so every
 *    host can cast a red card; each host's SLOT is its lowest-rated nonland card played as a single copy.
 *  - Every VARIANT goes into that same slot, at the same place in the list — so the library is the same shuffle and a
 *    game in which the test card is never drawn plays out (nearly) the same in every variant.
 *  - The host plays a fixed GAUNTLET of opponents (other Sealed decks, every colour), the same opponents and the same
 *    game seeds for every variant. Opponents are tagged by whether they gain life (a `gainLife` effect or lifelink).
 * A VARIANT is `id`, or `id~field=value~…` over an existing card — `cost={1}{R}`, `pt=2/2`, `kw=menace` (keywords
 * replaced; `kw=` clears them), or `~copy` (an identical card under a new id: the null). Variants live only in this
 * tool's card map, never in data/cards. The first variant is the baseline.
 * Per variant: the hosts' win rate; the PAIRED change against the baseline (per game, then per host — the standard
 * error is across hosts); the card's lift (the result when it was seen in hand, less its host's mean in that variant)
 * and its cast-when-drawn rate and mean turn cast; the split by lifegain opponents.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { rollSealedPool, type ConvocationPackData, type PackColor } from "./packs.js";
import { buildLimitedDeck, pairScores } from "./limited-builder.js";
import { cardRating, limitedView, type CardRatingTable } from "./rating.js";
import type { Decklist } from "./state.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const base = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = limitedView(read("card-rating.json") as CardRatingTable);
const set = data.sets.find((s) => s.id === arg("set", "plane"))!, recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe))!;
const TAG = arg("tag", "card_test");

/** A variant's card: an existing def with fields overridden, under the spec as its id. */
export function variantDef(spec: string, cards: Map<string, CardDef>): CardDef {
  const [id, ...mods] = spec.split("~");
  const d = cards.get(id!); if (!d) throw new Error(`card-test: no card ${id}`);
  if (!mods.length) return d;
  const out: CardDef = { ...d, id: spec };
  for (const m of mods) {
    if (m === "copy") continue;
    const [k, v = ""] = m.split("=");
    if (k === "cost") out.manaCost = v;
    else if (k === "pt") { const [p = 0, t = 0] = v.split("/").map(Number); (out as { power?: number }).power = p; (out as { toughness?: number }).toughness = t; }
    else if (k === "kw") (out as { keywords?: string[] }).keywords = v ? v.split("+") : [];
    else throw new Error(`card-test: unknown modifier ${m}`);
  }
  return out;
}
const gainsLife = (deck: Decklist, cards: Map<string, CardDef>) => deck.some((e) => { const d = cards.get(e.cardId)!; return (d.keywords ?? []).includes("lifelink") || JSON.stringify(d.abilities ?? []).includes('"gainLife"'); });

/** The host's seat, watched: the test card seen and cast; and (S53, for the Rage Cobra) the opponent's life gained, in
 * all and while the test card was on the host's battlefield — read off the life totals between the host's decisions
 * (OBSERVED: a gain and a larger loss between two decisions net out unseen). */
class Watch implements Agent {
  seen = false; cast = false; castTurn = 0; oppGained = 0; fed = 0; feeds = 0;
  private oppLife: number | null = null;
  constructor(private inner: Agent, private readonly target: string) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    if (view.hand.some((h) => h.cardId === this.target)) this.seen = true;
    const opp = 1 - view.you, life = view.life[opp]!;
    if (this.oppLife !== null && life > this.oppLife) {
      const d = life - this.oppLife; this.oppGained += d;
      if (view.battlefield.some((o) => o.cardId === this.target && o.controller === view.you)) { this.fed += d; this.feeds += 1; }
    }
    this.oppLife = life;
    const a = await this.inner.chooseAction(view, req);
    if (!this.cast && a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === this.target) { this.cast = true; this.castTurn = view.turn; }
    return a;
  }
}

interface Game { h: number; o: number; g: number; v: number; r: number; seen: boolean; cast: boolean; turn: number; lifegainOpp: boolean; /** observed: the opponent's life gained in the game, and while the test card was out */ oppGained?: number; fed?: number; feeds?: number }

async function play(): Promise<void> {
  const variants = arg("variants", "").split(",").filter(Boolean);
  if (variants.length < 2) throw new Error("card-test: --variants base,other,… (two or more)");
  const cards = new Map(base); for (const v of variants) cards.set(v, variantDef(v, base));
  const HOSTS = Number(arg("hosts", "200")), K = Number(arg("opponents", "5")), G = Number(arg("games", "4")), seed0 = Number(arg("seed", "60"));
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const pool = (seed: number) => rollSealedPool(set, recipe, base, data.power, seed).flat();
  // the gauntlet: forty Sealed decks of every colour, the builder's best pair
  const gauntlet = Array.from({ length: 40 }, (_, i) => buildLimitedDeck(pool(seed0 * 7001 + i), rating, base).deck);
  const games: Game[] = [];
  const t0 = Date.now();
  for (let h = 0; h < HOSTS; h++) {
    if (h % sn !== si) continue;
    const p = pool(seed0 * 1009 + h);
    const red = pairScores(p, rating, base).find((x) => x.pair.includes("R" as PackColor))!.pair;
    const deck = buildLimitedDeck(p, rating, base, { forcePair: red }).deck;
    const slot = deck.map((e, i) => ({ e, i })).filter(({ e }) => e.count === 1 && !base.get(e.cardId)!.types.includes("Land") && !variants.some((v) => v.split("~")[0] === e.cardId)).sort((a, b) => cardRating(base.get(a.e.cardId)!, rating) - cardRating(base.get(b.e.cardId)!, rating) || a.e.cardId.localeCompare(b.e.cardId))[0];
    if (!slot) continue;
    if (deck.some((e) => variants.some((v) => v.split("~")[0] === e.cardId))) continue; // a host that already plays a tested card would count its own copy
    for (let k = 0; k < K; k++) {
      const o = (h * 7 + k * 13) % gauntlet.length, opp = gauntlet[o]!, lifegainOpp = gainsLife(opp, base);
      for (let g = 0; g < G; g++) {
        const seat = g % 2, seed = seed0 * 100_000 + h * 997 + k * 31 + g;
        for (let v = 0; v < variants.length; v++) {
          const mine = deck.map((e, i) => (i === slot.i ? { cardId: variants[v]!, count: 1 } : { ...e }));
          const [d0, d1] = seat === 0 ? [mine, opp] : [opp, mine];
          const spec = { seed, players: [{ name: "host", decklist: d0, agent: "h" }, { name: "opp", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
          const a0 = new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1)), a1 = new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0));
          const w = new Watch(seat === 0 ? a0 : a1, variants[v]!);
          const r = await runMatch(spec, cards, seat === 0 ? [w, a1] : [a0, w]);
          games.push({ h, o, g: k * G + g, v, r: r.winner === null ? 0.5 : r.winner === seat ? 1 : 0, seen: w.seen, cast: w.cast, turn: w.castTurn, lifegainOpp, oppGained: w.oppGained, fed: w.fed, feeds: w.feeds });
        }
      }
    }
  }
  const out = arg("out", join(ROOT, `analysis/runs/${TAG}_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ variants, hosts: HOSTS, opponents: K, games: G, seed: seed0, seconds: Math.round((Date.now() - t0) / 1000), results: games }));
}

function report(): void {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as { variants: string[]; results: Game[] });
  const variants = runs[0]!.variants, games = runs.flatMap((r) => r.results);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const se = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1) / Math.max(1, xs.length)); };
  const pts = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
  const key = (x: Game) => `${x.h}:${x.o}:${x.g}`;
  const by = variants.map((_, v) => new Map(games.filter((x) => x.v === v).map((x) => [key(x), x])));
  const hosts = [...new Set(games.map((x) => x.h))];
  const L: string[] = [`# Card test — ${variants.length} variants in ${hosts.length} host decks, ${by[0]!.size} games each (${TAG})\n`, `Baseline: \`${variants[0]}\`. The paired change is per game (the same host, opponent and seed), averaged per host; ± is one standard error across hosts. **Diverged**: games in which the test card was drawn in neither version yet the result differs — the pairing's leak.\n`];
  L.push(`| variant | win rate | paired change | when drawn (either side) | diverged | lift | cast when drawn | mean game turn cast (both players' turns) | the opponent gained life (that game) | gained none |\n|---|---|---|---|---|---|---|---|---|---|`);
  const feeding: string[] = [];
  for (let v = 0; v < variants.length; v++) {
    const xs = [...by[v]!.values()];
    const hostMean = new Map(hosts.map((h) => [h, mean(xs.filter((x) => x.h === h).map((x) => x.r))]));
    const perHost = hosts.map((h) => mean(xs.filter((x) => x.h === h).map((x) => x.r - by[0]!.get(key(x))!.r)));
    const drawn = xs.filter((x) => x.seen || by[0]!.get(key(x))!.seen);
    const perHostDrawn = hosts.map((h) => drawn.filter((x) => x.h === h)).filter((d) => d.length).map((d) => mean(d.map((x) => x.r - by[0]!.get(key(x))!.r)));
    const undrawn = xs.filter((x) => !x.seen && !by[0]!.get(key(x))!.seen), diverged = undrawn.filter((x) => x.r !== by[0]!.get(key(x))!.r).length;
    const seen = xs.filter((x) => x.seen), lift = mean(seen.map((x) => x.r - hostMean.get(x.h)!));
    const liftSe = se(seen.map((x) => x.r - hostMean.get(x.h)!));
    // the split: did the opponent gain life in the baseline's game (the same game, so the pairing holds)
    const split = (lg: boolean) => { const ys = hosts.map((h) => xs.filter((x) => x.h === h && ((by[0]!.get(key(x))!.oppGained ?? 0) > 0) === lg)).filter((d) => d.length).map((d) => mean(d.map((x) => x.r - by[0]!.get(key(x))!.r))); return ys.length ? `${pts(mean(ys))} ± ${(se(ys) * 100).toFixed(1)}` : "—"; };
    const castGames = xs.filter((x) => x.cast), fedGames = castGames.filter((x) => (x.fed ?? 0) > 0);
    feeding.push(`| \`${variants[v]}\` | ${castGames.length} | ${castGames.length ? Math.round((fedGames.length / castGames.length) * 100) : 0}% | ${mean(castGames.map((x) => x.feeds ?? 0)).toFixed(2)} | ${mean(castGames.map((x) => x.fed ?? 0)).toFixed(2)} | ${fedGames.length ? mean(fedGames.map((x) => x.fed ?? 0)).toFixed(1) : "—"} |`);
    L.push(`| \`${variants[v]}\` | ${(mean(xs.map((x) => x.r)) * 100).toFixed(1)}% | ${v === 0 ? "—" : `**${pts(mean(perHost))} ± ${(se(perHost) * 100).toFixed(1)}**`} | ${v === 0 ? "—" : `${pts(mean(perHostDrawn))} ± ${(se(perHostDrawn) * 100).toFixed(1)}`} | ${v === 0 ? "—" : `${diverged} of ${undrawn.length}`} | ${pts(lift)} ± ${(liftSe * 100).toFixed(1)} | ${seen.length ? Math.round((xs.filter((x) => x.cast).length / seen.length) * 100) : 0}% | ${mean(xs.filter((x) => x.cast).map((x) => x.turn)).toFixed(1)} | ${v === 0 ? "—" : split(true)} | ${v === 0 ? "—" : split(false)} |`);
  }
  L.push(`\nDrawn in a game: ${Math.round((mean([...by[0]!.values()].map((x) => (x.seen ? 1 : 0)))) * 100)}% of the baseline's games. The opponent gained life (observed) in ${Math.round(mean([...by[0]!.values()].map((x) => ((x.oppGained ?? 0) > 0 ? 1 : 0))) * 100)}% of the baseline's games; its deck held a life-gain card in ${Math.round(mean([...by[0]!.values()].map((x) => (x.lifegainOpp ? 1 : 0))) * 100)}%.`);
  L.push(`\n## While the test card was out (observed, in the games it was cast)\n\n| variant | games cast | the opponent gained life while it was out | gains seen a game | life gained a game | life gained, when any |\n|---|---|---|---|---|---|`, ...feeding);
  const text = L.join("\n");
  writeFileSync(join(ROOT, `analysis/runs/${TAG}.md`), text + "\n");
  console.log(text);
}

if (process.argv.includes("--report")) report(); else await play();
