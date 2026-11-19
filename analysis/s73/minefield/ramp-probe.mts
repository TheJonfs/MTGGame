/**
 * S73a Part 6 — the Minefield's ramp (S73 Part 4's lead: the AI casts Wood Elves and Wall of Blossoms about half as
 * often a game as Chris).   npx tsx analysis/s73/minefield/ramp-probe.mts --vs marducontrol --games 120 --out f.json
 *                           npx tsx analysis/s73/minefield/ramp-probe.mts --report f.json …
 * The Open's Minefield, game ones, the pilot as it is. For every turn of its own in which a Wood Elves or a Wall of
 * Blossoms was in hand and castable at some priority and was not cast that turn: the decision that settled it (the
 * first non-land action taken with the card castable, else the pass), and what the scorer priced the ramp cast, the
 * action taken and the pass at. A probe, not a rule (ADR-167): it lives outside packages/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { FORMAT_DECKS } from "../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const RAMP = ["wood_elves", "wall_of_blossoms"];
interface Dec { card: string; took: string; tookKind: string; pRamp: number | null; pTook: number | null; pPass: number | null; dead: boolean; hold: boolean; lands: number; untapped: number }
interface Uncast { turn: number; cards: string[]; decisive: Dec; castsThisTurn: string[]; landsInPlay: number }
interface Rec { opp: string; g: number; won: number; turns: number; myTurns: number; casts: Record<string, number>; castTurns: { card: string; turn: number }[]; castableTurns: number; inHandTurns: number; neverCastable: number; neverCastableLands: number[]; uncast: Uncast[] }
const fin = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

class Probe implements Agent {
  private turn = -1; private castable = new Set<string>(); private cast = new Set<string>(); private decs: Dec[] = []; private casts: string[] = []; private lands = 0;
  private inHand = new Set<string>();
  constructor(private inner: HeuristicAgent, public rec: Rec, private defs: ReadonlyMap<string, { types: readonly string[] }>) {}
  private flush(): void {
    if (this.turn >= 0) {
      this.rec.myTurns += 1;
      const un = [...this.castable].filter((c) => !this.cast.has(c));
      if (this.castable.size) this.rec.castableTurns += 1;
      if (this.inHand.size) this.rec.inHandTurns += 1;
      if (this.inHand.size && !this.castable.size) { this.rec.neverCastable += 1; this.rec.neverCastableLands.push(this.lands); }
      if (un.length) {
        const ds = this.decs.filter((d) => un.includes(d.card));
        const decisive = ds.find((d) => d.tookKind !== "playLand" && d.tookKind !== "pass") ?? ds[ds.length - 1];
        if (decisive) this.rec.uncast.push({ turn: this.turn, cards: un, decisive, castsThisTurn: this.casts, landsInPlay: this.lands });
      }
    }
    this.castable = new Set(); this.inHand = new Set(); this.cast = new Set(); this.decs = []; this.casts = [];
  }
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you;
    const a = await this.inner.chooseAction(view, req);
    if (view.activePlayer !== me) return a;
    if (view.turn !== this.turn) { this.flush(); this.turn = view.turn; }
    if (req.purpose !== "priority") return a;
    const idOf = (x: Action) => { const o = (x as { objectId?: string }).objectId; return view.hand.find((h) => h.objectId === o)?.cardId ?? view.battlefield.find((b) => b.id === o)?.cardId ?? x.type; };
    const ramps = req.actions.filter((x) => x.type === "castSpell" && RAMP.includes(idOf(x)));
    const mine = view.battlefield.filter((b) => b.controller === me && this.defs.get(b.cardId)?.types.includes("Land"));
    for (const h of view.hand) if (RAMP.includes(h.cardId)) this.inHand.add(h.cardId);
    this.lands = mine.length;
    if (a.type === "castSpell") { this.casts.push(idOf(a)); if (RAMP.includes(idOf(a))) { this.cast.add(idOf(a)); this.rec.casts[idOf(a)] = (this.rec.casts[idOf(a)] ?? 0) + 1; this.rec.castTurns.push({ card: idOf(a), turn: view.turn }); } }
    for (const r of ramps) {
      const c = idOf(r); this.castable.add(c);
      if (a === r || (a.type === "castSpell" && idOf(a) === c)) continue;
      const pass = req.actions.find((x) => x.type === "pass");
      this.decs.push({ card: c, took: idOf(a), tookKind: a.type, pRamp: fin(this.inner.scorePriorityAction(view, r)), pTook: a.type === "tapForMana" ? null : fin(this.inner.scorePriorityAction(view, a)), pPass: pass ? fin(this.inner.scorePriorityAction(view, pass)) : null, dead: this.inner.cardIsDead(view, r), hold: this.inner.holdActive(view), lands: mine.length, untapped: mine.filter((b) => !b.tapped).length });
    }
    return a;
  }
  end(): void { this.flush(); }
}

async function run(): Promise<void> {
  const cards = loadCardPool(ROOT + "data/cards").cards, D = FORMAT_DECKS.open!;
  const A = D.minefield!, G = Number(arg("games", "120"));
  const opps = arg("vs", "marducontrol") === "field" ? Object.keys(D).filter((k) => k !== "minefield" && !D[k]!.archived) : arg("vs", "marducontrol").split(",");
  const out: Rec[] = [];
  for (const [oi, ok] of opps.entries()) for (let g = 0; g < G; g++) {
    const B = D[ok]!, seatA = g % 2, seed = 91 + oi * 1009 + g * 37, [d0, d1] = seatA === 0 ? [A, B] : [B, A];
    const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
    const h = (s: number, d: typeof A, o: typeof A) => new HeuristicAgent(s, cards, difficultyProfile("master", d.archetype, [...o.decklist], [...d.decklist]));
    const h0 = h(seed * 2 + 1, d0, d1), h1 = h(seed * 2 + 2, d1, d0);
    const rec: Rec = { opp: ok, g, won: 0, turns: 0, myTurns: 0, casts: {}, castTurns: [], castableTurns: 0, inHandTurns: 0, neverCastable: 0, neverCastableLands: [], uncast: [] };
    const probe = new Probe(seatA === 0 ? h0 : h1, rec, cards);
    const r = await runMatch(spec, cards, seatA === 0 ? [probe, h1] : [h0, probe]);
    probe.end(); rec.won = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0; rec.turns = r.turns; out.push(rec);
  }
  writeFileSync(arg("out", "ramp.json"), JSON.stringify({ results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const L: string[] = [], n = all.length, mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  L.push(`# The Minefield's ramp — ${n} game ones (${[...new Set(all.map((r) => r.opp))].join(", ")}); the Minefield won ${(100 * mean(all.map((r) => r.won))).toFixed(1)}%\n`);
  for (const c of RAMP) L.push(`- ${c}: cast ${(all.reduce((s, r) => s + (r.casts[c] ?? 0), 0) / n).toFixed(2)} a game; first cast on the Minefield's own turn ${mean(all.map((r) => r.castTurns.find((t) => t.card === c)).filter(Boolean).map((t) => Math.ceil(t!.turn / 2))).toFixed(1)} (mean, games with one)`);
  const un = all.flatMap((r) => r.uncast.map((u) => ({ ...u, r })));
  const nc = all.flatMap((r) => r.neverCastableLands);
  L.push(`- Own turns with a ramp card in hand: ${all.reduce((s, r) => s + r.inHandTurns, 0)}; of them never castable that turn: ${nc.length} (lands in play then: ${[0, 1, 2, 3].map((k) => `${k === 3 ? "3+" : k}: ${nc.filter((x) => (k === 3 ? x >= 3 : x === k)).length}`).join(", ")}).`);
  L.push(`- Own turns: ${all.reduce((s, r) => s + r.myTurns, 0)}; with a ramp card castable: ${all.reduce((s, r) => s + r.castableTurns, 0)}; **castable and not cast: ${un.length}** (${(un.length / n).toFixed(2)} a game).`);
  const cause = (u: Uncast) => { const d = u.decisive; return d.dead ? "dead (cardIsDead)" : d.pRamp === null ? "gated (priced at −∞)" : d.tookKind === "pass" ? (d.pPass !== null && d.pRamp < d.pPass ? "passed: priced under the pass" : d.hold ? "passed: a hold was on" : "passed: priced over the pass") : (d.pTook !== null && d.pTook > d.pRamp ? "outpriced by the action taken" : "another action taken at a lower or equal price"); };
  const by: Record<string, typeof un> = {}; for (const u of un) (by[cause(u)] ??= []).push(u);
  L.push(`\n| cause | turns | share | mean price of the ramp cast | of the action taken | of the pass | lands in play |\n|---|---|---|---|---|---|---|`);
  const m2 = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? mean(v).toFixed(2) : "—"; };
  for (const [k, us] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) L.push(`| ${k} | ${us.length} | ${(100 * us.length / un.length).toFixed(0)}% | ${m2(us.map((u) => u.decisive.pRamp))} | ${m2(us.map((u) => u.decisive.pTook))} | ${m2(us.map((u) => u.decisive.pPass))} | ${mean(us.map((u) => u.landsInPlay)).toFixed(1)} |`);
  for (const [k, us] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    const took: Record<string, number> = {}; for (const u of us) { const t = u.decisive.tookKind === "pass" ? "pass" : `${u.decisive.took}${u.decisive.tookKind === "castSpell" ? "" : ` (${u.decisive.tookKind})`}`; took[t] = (took[t] ?? 0) + 1; }
    L.push(`\n**${k}** — what was taken instead: ${Object.entries(took).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, c]) => `${t} ${c}`).join(", ")}. By card: ${RAMP.map((c) => `${c} ${us.filter((u) => u.cards.includes(c)).length}`).join(", ")}. By the Minefield's own turn: ${[1, 2, 3, 4, 5, 6].map((t) => `${t === 6 ? "6+" : t}: ${us.filter((u) => (t === 6 ? Math.ceil(u.turn / 2) >= 6 : Math.ceil(u.turn / 2) === t)).length}`).join(", ")}.`);
  }
  console.log(L.join("\n"));
}
if (process.argv.includes("--report")) report(); else await run();
