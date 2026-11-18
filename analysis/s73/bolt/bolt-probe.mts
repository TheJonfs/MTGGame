/**
 * S73 Part 2 — the Bolt probe (handoff concern 56: Lightning Bolt fell 2.29 → 1.44 in Limited on 8,960 sightings).
 *   npx tsx analysis/s73/bolt/bolt-probe.mts --shard i/n --out file.json      then      --report file…
 * The sealed176 run's pools (seed 176), built on the live table; a pool that rolled a Lightning Bolt is built with it
 * played. Every such deck meets its ten
 * next neighbours, four games each, twice on the same seeds:
 *   base  — the pilot as it is;
 *   eager — the same pilot, except that when it PASSES with a Bolt in hand that would kill an opposing creature of
 *           power two or more, the Bolt is cast at the largest such creature instead.
 * The base arm records every turn a kill was on offer and the Bolt stayed in hand, the board then, which hold gate
 * (book 88's face hold, book 160's `burnhold`) was answering, and where the Bolts that were cast went. The eager arm is
 * the causal read: if not holding wins more games, the holds are too patient for a forty-card board. A probe, not a
 * rule (ADR-167): it lives outside packages/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { rollSealedPool, type ConvocationPackData } from "../../../packages/world/src/packs.ts";
import { buildForcedDeck, buildLimitedDeck } from "../../../packages/world/src/limited-builder.ts";
import { limitedView, type CardRatingTable } from "../../../packages/world/src/rating.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const BOLT = "lightning_bolt", DMG = 3;

interface Hold { turn: number; mine: boolean; step: string; killPower: number; theirPower: number; myLife: number; theirLife: number; hand: number; gate: string }
interface Rec { arm: "base" | "eager"; deck: number; opp: number; g: number; won: number; turns: number; saw: boolean; casts: { turn: number; at: "creature" | "face" | "own"; power: number; theirLife: number; forced: boolean }[]; holds: Hold[]; inHandAtEnd: boolean }

class Probe implements Agent {
  rec: Rec; private castThisTurn = -1; private lastHand = false;
  constructor(private inner: HeuristicAgent, private eager: boolean, rec: Rec) { this.rec = rec; }
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you, opp = (1 - me) as 0 | 1;
    const bolts = view.hand.filter((c) => c.cardId === BOLT);
    this.lastHand = bolts.length > 0; if (bolts.length) this.rec.saw = true;
    let a = await this.inner.chooseAction(view, req);
    const kills = req.actions.filter((x) => x.type === "castSpell" && bolts.some((b) => b.objectId === x.objectId) && x.targets.length === 1 && x.targets[0]!.kind === "object").map((x) => ({ x, o: view.battlefield.find((b) => b.id === (x as { targets: { id: string }[] }).targets[0]!.id)! }))
      .filter(({ o }) => o && o.controller === opp && o.power !== null && o.toughness !== null && o.toughness - o.damage <= DMG).sort((p, q) => (q.o.power ?? 0) - (p.o.power ?? 0));
    const best = kills[0];
    let forced = false;
    if (this.eager && best && (best.o.power ?? 0) >= 2 && a.type === "pass") { a = best.x; forced = true; }
    if (a.type === "castSpell" && bolts.some((b) => b.objectId === a.objectId)) {
      const t = (a as { targets: { kind: string; id?: string; player?: number }[] }).targets[0]!;
      const o = t.kind === "object" ? view.battlefield.find((b) => b.id === t.id) : undefined;
      this.rec.casts.push({ turn: view.turn, at: o ? (o.controller === opp ? "creature" : "own") : (t.player === opp ? "face" : "own"), power: o?.power ?? 0, theirLife: view.life[opp], forced });
      this.castThisTurn = view.turn;
    } else if (best && a.type === "pass" && this.castThisTurn !== view.turn && !this.rec.holds.some((h) => h.turn === view.turn)) {
      const theirPower = view.battlefield.filter((b) => b.controller === opp && b.power !== null).reduce((n, b) => n + Math.max(0, b.power ?? 0), 0);
      const gate = this.inner.burnHoldGated(view, best.x) ? "burnhold (book 160)" : "the scorer";
      this.rec.holds.push({ turn: view.turn, mine: view.activePlayer === me, step: view.step, killPower: best.o.power ?? 0, theirPower, myLife: view.life[me], theirLife: view.life[opp], hand: view.hand.length, gate });
    }
    return a;
  }
  end(): void { this.rec.inHandAtEnd = this.lastHand; }
}

async function run(): Promise<void> {
  const cards = loadCardPool(ROOT + "data/cards").cards;
  const read = (f: string) => JSON.parse(readFileSync(ROOT + "data/convocation/" + f, "utf8"));
  const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
  const set = data.sets.find((s) => s.id === "plane")!, recipe = data.recipes.find((r) => r.id === "classic")!;
  const rating = limitedView(read("card-rating.json") as CardRatingTable);
  const N = 200, seed0 = 176, OPPS = Number(arg("opponents", "10")), G = Number(arg("games", "4"));
  // The live table rates the Bolt 1.44 and the builder then plays it in 4 decks of 200 (the first pass of this probe:
  // 160 games). So every pool that ROLLED a Bolt is built with it played (buildForcedDeck — the forced-inclusion build).
  const decks = Array.from({ length: N }, (_, i) => { const pool = rollSealedPool(set, recipe, cards, data.power, seed0 * 100003 + i, 6).flat(); return ((pool.includes(BOLT) ? buildForcedDeck(pool, BOLT, rating, cards) : null) ?? buildLimitedDeck(pool, rating, cards)).deck; });
  const boltDecks = decks.map((d, i) => (d.some((e) => e.cardId === BOLT) ? i : -1)).filter((i) => i >= 0);
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const out: Rec[] = [];
  for (let k = 0; k < boltDecks.length; k++) {
    if (k % sn !== si) continue;
    const ia = boltDecks[k]!;
    for (let d = 1; d <= OPPS; d++) for (let g = 0; g < G; g++) for (const arm of ["base", "eager"] as const) {
      const ib = (ia + d) % N, seatA = g % 2, seed = 73000 + ia * 1009 + d * 37 + g;
      const A = decks[ia]!, B = decks[ib]!, [d0, d1] = seatA === 0 ? [A, B] : [B, A];
      const spec = { seed, players: [{ name: "a", decklist: d0, agent: "h" }, { name: "b", decklist: d1, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
      const h0 = new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", d1)), h1 = new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", "midrange", d0));
      const rec: Rec = { arm, deck: ia, opp: ib, g, won: 0, turns: 0, saw: false, casts: [], holds: [], inHandAtEnd: false };
      const probe = new Probe(seatA === 0 ? h0 : h1, arm === "eager", rec);
      const r = await runMatch(spec, cards, seatA === 0 ? [probe, h1] : [h0, probe]);
      probe.end(); rec.won = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0; rec.turns = r.turns; out.push(rec);
    }
  }
  writeFileSync(arg("out", "bolt.json"), JSON.stringify({ boltDecks: boltDecks.length, results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const decksN = (JSON.parse(readFileSync(files[0]!, "utf8")) as { boltDecks: number }).boltDecks;
  const base = all.filter((r) => r.arm === "base"), eager = all.filter((r) => r.arm === "eager");
  const key = (r: Rec) => `${r.deck}|${r.opp}|${r.g}`, eBy = new Map(eager.map((r) => [key(r), r]));
  const pct = (w: number, n: number) => (n ? (100 * w) / n : 0).toFixed(1);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const L: string[] = [];
  L.push(`# The Bolt probe — ${decksN} of 200 Sealed pools rolled a Lightning Bolt and were built with it played; ${base.length} games an arm\n`);
  const sawB = base.filter((r) => r.saw);
  L.push(`## The base arm (the pilot as it is)\n`);
  L.push(`- Games with a Bolt in hand at some point: ${sawB.length} of ${base.length}. The deck won ${pct(sawB.reduce((n, r) => n + r.won, 0), sawB.length)}% of them, and ${pct(base.filter((r) => !r.saw).reduce((n, r) => n + r.won, 0), base.length - sawB.length)}% of the games without one.`);
  const casts = base.flatMap((r) => r.casts);
  L.push(`- Bolts cast: ${casts.length} — ${casts.filter((c) => c.at === "creature").length} at a creature (mean power ${mean(casts.filter((c) => c.at === "creature").map((c) => c.power)).toFixed(1)}), ${casts.filter((c) => c.at === "face").length} at the face (their life then: mean ${mean(casts.filter((c) => c.at === "face").map((c) => c.theirLife)).toFixed(1)}), ${casts.filter((c) => c.at === "own").length} at our own side.`);
  const holds = base.flatMap((r) => r.holds.map((h) => ({ ...h, r })));
  const gamesHeld = base.filter((r) => r.holds.length);
  L.push(`- **Turns a kill was on offer and the Bolt stayed in hand**: ${holds.length}, in ${gamesHeld.length} games (${pct(gamesHeld.length, sawB.length)}% of the games that saw a Bolt). Mean ${mean(gamesHeld.map((r) => r.holds.length)).toFixed(1)} such turns in those games.`);
  const byGate: Record<string, number> = {}; for (const h of holds) byGate[h.gate] = (byGate[h.gate] ?? 0) + 1;
  L.push(`- What was answering: ${Object.entries(byGate).map(([g, n]) => `${g} ${n}`).join(", ")}.`);
  L.push(`- The board at a hold: the creature the Bolt would kill had mean power ${mean(holds.map((h) => h.killPower)).toFixed(1)}; their board's power ${mean(holds.map((h) => h.theirPower)).toFixed(1)}; our life ${mean(holds.map((h) => h.myLife)).toFixed(1)}; ${pct(holds.filter((h) => h.mine).length, holds.length)}% in our own turn.`);
  L.push(`\n| the creature's power | holds | of them in games lost |\n|---|---|---|`);
  for (const p of [0, 1, 2, 3, 4]) { const hs = holds.filter((h) => (p === 4 ? h.killPower >= 4 : h.killPower === p)); L.push(`| ${p === 4 ? "4+" : p} | ${hs.length} | ${pct(hs.filter((h) => h.r.won === 0).length, hs.length)}% |`); }
  const lostHolding = base.filter((r) => r.won === 0 && r.inHandAtEnd), lostHoldingKill = lostHolding.filter((r) => r.holds.some((h) => h.killPower >= 2));
  const lost = base.filter((r) => r.won === 0);
  L.push(`\n- **Lost with a Bolt still in hand**: ${lostHolding.length} of ${lost.length} losses (${pct(lostHolding.length, lost.length)}%). In ${lostHoldingKill.length} of those a kill on a creature of power two or more had been on offer.`);
  L.push(`\n## The eager arm (a pass with a kill on offer becomes the Bolt, power two or more)\n`);
  const pairs = base.map((b) => [b, eBy.get(key(b))!] as const).filter(([, e]) => e);
  const d = pairs.map(([b, e]) => e.won - b.won), m = mean(d), sd = Math.sqrt(d.reduce((n, x) => n + (x - m) ** 2, 0) / (d.length - 1));
  L.push(`- Paired over ${pairs.length} games: base ${pct(pairs.reduce((n, [b]) => n + b.won, 0), pairs.length)}%, eager ${pct(pairs.reduce((n, [, e]) => n + e.won, 0), pairs.length)}%, **${(100 * m >= 0 ? "+" : "") + (100 * m).toFixed(1)} ± ${(196 * sd / Math.sqrt(d.length)).toFixed(1)}**.`);
  const changed = pairs.filter(([, e]) => e.casts.some((c) => c.forced));
  const dc = changed.map(([b, e]) => e.won - b.won), mc = mean(dc), sc = Math.sqrt(dc.reduce((n, x) => n + (x - mc) ** 2, 0) / Math.max(1, dc.length - 1));
  L.push(`- The override fired in ${changed.length} games (${eager.flatMap((r) => r.casts).filter((c) => c.forced).length} Bolts). In those games: base ${pct(changed.reduce((n, [b]) => n + b.won, 0), changed.length)}%, eager ${pct(changed.reduce((n, [, e]) => n + e.won, 0), changed.length)}%, ${(100 * mc >= 0 ? "+" : "") + (100 * mc).toFixed(1)} ± ${(196 * sc / Math.sqrt(Math.max(1, dc.length))).toFixed(1)}.`);
  const fc = eager.flatMap((r) => r.casts).filter((c) => c.forced);
  L.push(`- The forced Bolts hit creatures of mean power ${mean(fc.map((c) => c.power)).toFixed(1)}.`);
  console.log(L.join("\n"));
}

if (process.argv.includes("--report")) report(); else await run();
