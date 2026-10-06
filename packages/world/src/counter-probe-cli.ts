/**
 * pnpm counter-probe [--lists locks,kiln,undertow] [--games 20] [--seed 5600] [--off counter] [--vs k1,k2] [--out file]
 *
 * S56 (Part 1): what a list's pilot does with its counterspells. Each list against every other Open list, master both,
 * seats alternating. Per game: counters drawn (seen in hand) and cast; and every WINDOW — a priority request with an
 * opposing spell on top of the stack and a counter in hand — sorted into: no counter offered (the mana was spent or
 * never there), offered and cast, offered and passed (with the spell's mana value). Also what the pilot did with its
 * mana on its own turn while holding a counter, and how many end steps of the opponent it reached with mana up, a
 * counter unused and a castable spell in hand. `--off counter` pilots the probed list without the S56 counter rule;
 * `--detail` lists what the lost windows were lost to (the colours not on the battlefield, a counter already cast this
 * turn, or the cards the turn's mana went to), what was passed on, and what was castable at the end step.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, payableBy, type ManaSource } from "@shandalar/agents";
import { OPEN_DECKS, OPEN_FIELD } from "@shandalar/sim/open-decks";
import { manaValue, parseManaCost, type CardDef } from "@shandalar/cards";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

interface Tally { games: number; wins: number; drawn: number; cast: number; windows: number; noOffer: number; tooEarly: number; castAt: number; passedAt: number; passedMv: number[]; castMv: number[]; oppSpells: number; endHeld: number; endSpent: number; missed: Record<string, number>; spentOn: Record<string, number>; passed: Record<string, number>; endCastable: Record<string, number> }
const blank = (): Tally => ({ games: 0, wins: 0, drawn: 0, cast: 0, windows: 0, noOffer: 0, tooEarly: 0, castAt: 0, passedAt: 0, passedMv: [], castMv: [], oppSpells: 0, endHeld: 0, endSpent: 0, missed: {}, spentOn: {}, passed: {}, endCastable: {} });

class Probe implements Agent {
  seen = new Set<string>(); t = blank(); private items = new Set<string>(); private ends = new Set<number>(); private oppItems = new Set<string>(); private myTurn = -1; private counteredTurn = -1; private myCasts: string[] = [];
  constructor(private inner: Agent, private pool: Map<string, CardDef>) {}
  private isCounter = (cardId: string) => !!this.pool.get(cardId)?.spellEffect?.some((e) => e.type === "counter");
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, req);
    for (const c of view.hand) if (this.isCounter(c.cardId) && !this.seen.has(c.objectId)) { this.seen.add(c.objectId); this.t.drawn++; }
    for (const s of view.stack) if (s.controller !== view.you && s.kind === "spell" && !this.oppItems.has(s.id)) { this.oppItems.add(s.id); this.t.oppSpells++; }
    if (req.purpose !== "priority") return a;
    const top = view.stack[view.stack.length - 1];
    const counterIds = new Set(view.hand.filter((c) => this.isCounter(c.cardId)).map((c) => c.objectId));
    const castsCounter = (x: Action) => x.type === "castSpell" && counterIds.has(x.objectId);
    if (castsCounter(a)) { this.t.cast++; this.counteredTurn = view.turn; }
    const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
    if (view.activePlayer === view.you) { if (this.myTurn !== view.turn) { this.myTurn = view.turn; this.myCasts = []; } if (a.type === "castSpell" || a.type === "activateAbility") { const c = view.hand.find((h) => h.objectId === a.objectId)?.cardId ?? view.battlefield.find((o) => o.id === a.objectId)?.cardId; if (c && !this.pool.get(c)?.types.includes("Land") && !/^mox_|black_lotus/.test(c)) this.myCasts.push(a.type === "castSpell" ? c : `${c}#`); } }
    if (top && top.controller !== view.you && top.kind === "spell" && counterIds.size > 0 && !this.items.has(top.id)) {
      const offered = req.actions.some(castsCounter);
      const mv = manaValue(parseManaCost(this.pool.get(top.cardId)?.manaCost ?? ""));
      if (castsCounter(a)) { this.items.add(top.id); this.t.windows++; this.t.castAt++; this.t.castMv.push(mv); }
      else if (a.type === "pass") { this.items.add(top.id); this.t.windows++; if (offered) { this.t.passedAt++; this.t.passedMv.push(mv); bump(this.t.passed, top.cardId); } else { this.t.noOffer++; const lands = view.battlefield.filter((o) => o.controller === view.you && this.pool.get(o.cardId)?.types.includes("Land")).length; if (lands < Math.min(...view.hand.filter((c) => this.isCounter(c.cardId)).map((c) => manaValue(parseManaCost(this.pool.get(c.cardId)?.manaCost ?? ""))))) this.t.tooEarly++; else { bump(this.t.missed, top.cardId); const up = view.battlefield.filter((o) => o.controller === view.you && !o.tapped && this.pool.get(o.cardId)?.types.includes("Land")).length; const src = (all: boolean): ManaSource[] => view.battlefield.filter((o) => o.controller === view.you && (all || !o.tapped)).flatMap((o) => { const d = this.pool.get(o.cardId); const colors = [...new Set((d?.abilities ?? []).flatMap((ab) => (ab.kind === "activated" && ab.cost.tap && !ab.cost.sacrifice && !ab.cost.mana ? ab.effects.flatMap((e) => (e.type === "addMana" && !e.choice ? (e.mana ?? "").match(/[WUBRGC]/g) ?? [] : [])) : [])))]; return colors.length ? [{ id: o.id, colors, creature: !!d?.types.includes("Creature") }] : []; });
          const costs = view.hand.filter((c) => this.isCounter(c.cardId)).map((c) => this.pool.get(c.cardId)!.manaCost);
          const why = this.counteredTurn === view.turn ? ["(a counter already cast this turn)"] : !costs.some((c) => payableBy(src(true), c)) ? ["(the colours are not on the battlefield)"] : costs.some((c) => payableBy(src(false), c)) ? ["(payable but not offered?)"] : this.myCasts.length ? this.myCasts : ["(mana tapped, nothing cast on our turn)"]; for (const c of why) bump(this.t.spentOn, c); } } }
    }
    // the opponent's end step, the stack empty, a counter still in hand: was anything castable, and was it cast?
    if (view.activePlayer !== view.you && view.step === "END" && view.stack.length === 0 && counterIds.size > 0 && !this.ends.has(view.turn)) {
      const other = req.actions.some((x) => x.type === "castSpell" && !counterIds.has(x.objectId));
      if (other) { this.ends.add(view.turn); for (const x of req.actions) if (x.type === "castSpell" && !counterIds.has(x.objectId)) { bump(this.t.endCastable, view.hand.find((h) => h.objectId === x.objectId)?.cardId ?? "?"); break; } if (a.type === "castSpell") this.t.endSpent++; else if (a.type === "pass") this.t.endHeld++; else this.ends.delete(view.turn); }
    }
    return a;
  }
}

async function run(): Promise<void> {
  const pool = loadCardPool(join(ROOT, "data/cards")).cards;
  const lists = arg("lists", "locks,kiln,undertow").split(","), G = Number(arg("games", "20")), seed0 = Number(arg("seed", "5600"));
  const off = arg("off", "").split(",").filter(Boolean), vs = arg("vs", "").split(",").filter(Boolean);
  const out: Record<string, Tally> = {};
  for (const key of lists) {
    const me = OPEN_DECKS[key]; if (!me) throw new Error(`counter-probe: no list ${key}`);
    const t = blank();
    const others = Object.keys(OPEN_FIELD).filter((k) => k !== key && (vs.length === 0 || vs.includes(k)));
    for (let k = 0; k < others.length; k++) {
      const them = OPEN_DECKS[others[k]!]!;
      for (let g = 0; g < G; g++) {
        const mySeat = (g % 2) as 0 | 1, seed = seed0 + k * 1009 + g * 37;
        const [d0, d1] = mySeat === 0 ? [me, them] : [them, me];
        const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
        const mk = (d: typeof me, o: typeof me, n: number, mine: boolean) => new HeuristicAgent(seed * 2 + n, pool, { ...difficultyProfile("master", d.archetype, [...o.decklist], [...d.decklist]), ...(mine && off.length ? { off } : {}) });
        const probe = new Probe(mySeat === 0 ? mk(d0, d1, 1, true) : mk(d1, d0, 2, true), pool);
        const other = mySeat === 0 ? mk(d1, d0, 2, false) : mk(d0, d1, 1, false);
        const r = await runMatch(spec, pool, mySeat === 0 ? [probe, other] : [other, probe]);
        const p = probe.t; t.games++; if (r.winner === mySeat) t.wins++;
        for (const f of ["drawn", "cast", "windows", "noOffer", "tooEarly", "castAt", "passedAt", "oppSpells", "endHeld", "endSpent"] as const) t[f] += p[f];
        t.passedMv.push(...p.passedMv); t.castMv.push(...p.castMv);
        for (const f of ["missed", "spentOn", "passed", "endCastable"] as const) for (const [c, n] of Object.entries(p[f])) t[f][c] = (t[f][c] ?? 0) + n;
      }
    }
    out[key] = t;
    const per = (n: number) => (n / t.games).toFixed(2), mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
    console.log(`${key}${off.length ? ` (off: ${off.join(",")})` : ""}: ${t.games} games, ${(100 * t.wins / t.games).toFixed(1)}% won`);
    console.log(`  a game: ${per(t.drawn)} counters drawn, ${per(t.cast)} cast; the opponent cast ${per(t.oppSpells)} spells`);
    console.log(`  windows (their spell on the stack, a counter in hand): ${per(t.windows)} — no mana for it ${per(t.noOffer)} (of which too few lands ${per(t.tooEarly)}), cast ${per(t.castAt)} (mean mv ${mean(t.castMv)}), passed with the mana ${per(t.passedAt)} (mean mv ${mean(t.passedMv)})`);
    const top = (m: Record<string, number>) => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([c, n]) => `${c} ${n}`).join(", ");
    if (process.argv.includes("--detail")) console.log(`  tapped out for: ${top(t.missed)}\n  …having spent the turn on: ${top(t.spentOn)}\n  passed on: ${top(t.passed)}\n  castable at their end step: ${top(t.endCastable)}`);
    console.log(`  their end step, a counter held, another spell castable: ${per(t.endHeld + t.endSpent)} — spent ${per(t.endSpent)}, held ${per(t.endHeld)}`);
  }
  const file = arg("out", "");
  if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify({ games: G, seed: seed0, off, out })); }
}
run().catch((e) => { console.error(e); process.exit(1); });
