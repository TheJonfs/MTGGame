/**
 * pnpm pilot-probe --witch   [--format mardu] [--lists witch,pall] [--games 4] [--recorded file.json]
 * pnpm pilot-probe --manaba  [--format naya] [--lists emeraldsnakes] [--games 4] [--recorded file.json]
 * pnpm pilot-probe --racing  --recorded file.json [--playouts 6]
 *
 * S67 (Part 3; ADR-167 — probes this session, rules the next): three of the pilot's gaps, read against Chris's play.
 *  --witch   every Jet Witch activation: our life before it, the opponent's board power, our untapped blockers, the burn
 *            seen in their graveyard, and whether that seat lost within two turns of it. The candidate rule — pay while
 *            life after payment exceeds the board's reach plus the burn seen, never into an untapped racer — is scored
 *            on the same rows (how many activations it would forbid, and how those games went).
 *  --manaba  at each of our end steps: the Snakes left untapped, the lands left untapped, the hand's cards that mana
 *            would have cast, and the Manaba taps that turn (what was cast with them).
 *  --racing  in a recorded game, each of the human's turns where they attacked: what the pilot (master, the human's
 *            sixty) would have declared; where it holds, the board, and `--playouts` games from that point both ways.
 * Game one, registered sixties, master pilots on both sides, the format's field. A probe: it changes nothing.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { expandDecklist, replayThenPlay, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "@shandalar/sim/open-decks";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const def = (id: string) => pool.get(id);
type Dl = { cardId: string; count: number }[];
type List = { key: string; archetype: string; decklist: Dl };
const effectsOf = (d: CardDef | undefined): { type: string }[] => (d ? [...((d as { effects?: { type: string }[] }).effects ?? []), ...(d.abilities ?? []).flatMap((a) => (a as { effects?: { type: string }[] }).effects ?? [])] : []);
const isBurn = (id: string) => { const d = def(id); return !!d && (d.types.includes("Instant") || d.types.includes("Sorcery")) && effectsOf(d).some((e) => e.type === "damage"); };
const isSnake = (id: string) => (def(id)?.subtypes ?? []).includes("Snake") || id.includes("snake");
const mv = (id: string) => { const c = def(id)?.manaCost ?? ""; let n = 0; for (const m of c.matchAll(/\{([^}]+)\}/g)) n += /^\d+$/.test(m[1]!) ? Number(m[1]) : m[1] === "X" ? 0 : 1; return n; };
const isLand = (id: string) => !!def(id)?.types.includes("Land");

/** What a seat's board and graveyard say at a decision — the Witch's rows. */
function witchRow(v: GameView) {
  const me = v.you, opp = (1 - me) as 0 | 1;
  const theirs = v.battlefield.filter((b) => b.controller === opp && b.power !== null && !b.cantAttack);
  const mine = v.battlefield.filter((b) => b.controller === me && b.power !== null && !b.tapped && !b.cantBlock);
  const reach = theirs.reduce((a, b) => a + Math.max(0, b.power ?? 0), 0);
  const burn = [...v.graveyards[opp]].filter(isBurn).length;
  // an untapped racer: one of theirs with power two or more that none of our untapped creatures can block profitably (no blocker of ours with toughness above its power)
  const racer = theirs.some((b) => (b.power ?? 0) >= 2 && !mine.some((m) => (m.toughness ?? 0) > (b.power ?? 0)));
  return { turn: v.turn, life: v.life[me], reach, burn, blockers: mine.length, racer };
}
type WRow = ReturnType<typeof witchRow> & { lostWithin2: boolean; won: boolean; who: string; game: string };
const gamesSeen = new Map<string, Set<string>>(); // who → the games with a Witch on the battlefield at some decision of theirs

class Watch implements Agent {
  rows: (ReturnType<typeof witchRow> & { kind: string; extra?: unknown })[] = [];
  private lastEnd = -1; private taps = new Map<number, number>();
  constructor(private inner: Agent, private mode: "witch" | "manaba") {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, req);
    observe(this.mode, view, req, a, this.rows, this.taps, () => this.lastEnd, (t) => { this.lastEnd = t; });
    return a;
  }
}
function observe(mode: "witch" | "manaba", v: GameView, req: ActionRequest, a: Action, rows: Watch["rows"], taps: Map<number, number>, lastEnd: () => number, setEnd: (t: number) => void): void {
  const idCard = (id: string) => v.battlefield.find((b) => b.id === id)?.cardId;
  if (mode === "witch" && a.type === "activateAbility" && idCard(a.objectId) === "the_jet_witch") rows.push({ ...witchRow(v), kind: "witch" });
  if (mode === "manaba") {
    if ((a.type === "tapForMana" || a.type === "activateAbility") && idCard((a as { objectId: string }).objectId) === "manaba") taps.set(v.turn, (taps.get(v.turn) ?? 0) + 1);
    if (v.step === "END" && v.activePlayer === v.you && req.player === v.you && lastEnd() !== v.turn) {
      setEnd(v.turn);
      const mineUntapped = v.battlefield.filter((b) => b.controller === v.you && !b.tapped);
      const snakes = mineUntapped.filter((b) => b.power !== null && isSnake(b.cardId) && !b.summoningSick).length, lands = mineUntapped.filter((b) => isLand(b.cardId)).length;
      const hasManaba = v.battlefield.some((b) => b.controller === v.you && b.cardId === "manaba");
      const castable = v.hand.filter((h) => !isLand(h.cardId) && mv(h.cardId) <= lands + (hasManaba ? snakes : 0) && mv(h.cardId) > lands).map((h) => h.cardId);
      rows.push({ ...witchRow(v), kind: "end", extra: { snakes: hasManaba ? snakes : 0, lands, wastedOnlyWithSnakes: castable, tapsThisTurn: taps.get(v.turn) ?? 0, hasManaba } });
    }
  }
}

async function field(mode: "witch" | "manaba"): Promise<void> {
  const fmt = arg("format", mode === "witch" ? "mardu" : "naya"), F = (FORMAT_FIELD as unknown as Record<string, Record<string, List>>)[fmt]!;
  const keys = arg("lists", mode === "witch" ? "witch" : "emeraldsnakes").split(","), G = Number(arg("games", "4"));
  const out: WRow[] = [], ends: { list: string; opp: string; won: boolean; extra: { snakes: number; lands: number; wastedOnlyWithSnakes: string[]; tapsThisTurn: number; hasManaba: boolean } }[] = [];
  for (const key of keys) {
    const me = F[key]; if (!me) throw new Error(`pilot-probe: no list ${fmt}:${key}`);
    for (const [ok, o] of Object.entries(F)) {
      if (ok === key) continue;
      for (let g = 0; g < G; g++) {
        const seed = 6700 + g * 37 + ok.length * 1009, seat = (g % 2) as 0 | 1;
        const decks = seat === 0 ? [me, o] : [o, me];
        const spec = { seed, players: decks.map((d) => ({ name: d.key, decklist: [...d.decklist], agent: "heuristic:master" })), rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
        const ag = decks.map((d, i) => new HeuristicAgent(seed * 2 + 1 + i, pool, difficultyProfile("master", d.archetype as never, [...decks[1 - i]!.decklist], [...d.decklist]))) as unknown as [Agent, Agent];
        const w = new Watch(ag[seat], mode); ag[seat] = w;
        const r = await runMatch(spec, pool, ag);
        const won = r.winner === seat;
        for (const x of w.rows) {
          if (x.kind === "witch") out.push({ ...x, won, lostWithin2: !won && r.winner !== null && r.turns - x.turn <= 4, who: `pilot ${key}`, game: `${key}/${ok}/${g}` });
          else ends.push({ list: key, opp: ok, won, extra: x.extra as never });
        }
      }
    }
    console.error(`pilot-probe: ${fmt}:${key} done`);
  }
  if (arg("recorded", "")) { const h = await recorded(mode); out.push(...h.rows); ends.push(...h.ends); }
  if (mode === "witch") reportWitch(out); else reportManaba(ends);
}

/** The human's rows from a recorded file (seat 0), by replaying each game's log. */
async function recorded(mode: "witch" | "manaba"): Promise<{ rows: WRow[]; ends: { list: string; opp: string; won: boolean; extra: never }[] }> {
  const file = JSON.parse(readFileSync(arg("recorded", ""), "utf8")) as { games: { list: string; result: { winner: number | null; turns: number }; spec: MatchSpec & { rules: Record<string, number> }; log: { t: string }[] }[] };
  const rows: WRow[] = [], ends: { list: string; opp: string; won: boolean; extra: never }[] = [];
  for (const g of file.games) {
    if (!g.spec.players[0]!.decklist.some((e) => e.cardId === (mode === "witch" ? "the_jet_witch" : "manaba"))) continue;
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: g.spec.rules.startingLife ?? 20, handSize: g.spec.rules.handSize ?? 7, maxTurns: g.spec.rules.maxTurns ?? 120, ante: 0, ...(g.spec.rules.startingPlayer !== undefined ? { startingPlayer: g.spec.rules.startingPlayer } : {}) } as never;
    const local: Watch["rows"] = [], taps = new Map<number, number>(); let le = -1;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, g.spec.modifiers ?? [], undefined, (req, v, a) => { if (req.player === 0) observe(mode, v, req, a, local, taps, () => le, (t) => { le = t; }); });
    const won = g.result.winner === 0;
    for (const x of local) {
      if (x.kind === "witch") rows.push({ ...x, won, lostWithin2: !won && g.result.winner !== null && g.result.turns - x.turn <= 4, who: "Chris", game: `${g.list}/${file.games.indexOf(g)}` });
      else ends.push({ list: "Chris", opp: g.list, won, extra: x.extra as never });
    }
  }
  return { rows, ends };
}

function reportWitch(rows: WRow[]): void {
  const rule = (r: WRow) => r.life - 2 > r.reach + r.burn * 3 && !r.racer; // the candidate: life after paying exceeds the board's reach plus three a burn spell seen; never into an untapped racer
  for (const who of [...new Set(rows.map((r) => r.who.startsWith("pilot") ? "pilot" : r.who))]) {
    const rs = rows.filter((r) => (who === "pilot" ? r.who.startsWith("pilot") : r.who === who));
    const pct = (xs: WRow[], f: (r: WRow) => boolean) => (xs.length ? `${((100 * xs.filter(f).length) / xs.length).toFixed(1)}%` : "—");
    const ok = rs.filter(rule), bad = rs.filter((r) => !rule(r));
    const games = new Set(rs.map((r) => r.game)), first = new Map<string, number>(); for (const r of rs) if (!first.has(r.game)) first.set(r.game, r.turn);
    console.log(`\n## ${who} — ${rs.length} Witch activations in ${games.size} games where the Witch was used (${(rs.length / Math.max(1, games.size)).toFixed(1)} a game; the first on turn ${([...first.values()].reduce((a, b) => a + b, 0) / Math.max(1, first.size)).toFixed(1)} on average)`);
    console.log(`- life before: mean ${(rs.reduce((a, r) => a + r.life, 0) / Math.max(1, rs.length)).toFixed(1)}; at 6 or less ${pct(rs, (r) => r.life <= 6)}; into a racer ${pct(rs, (r) => r.racer)}; with their reach ≥ life after ${pct(rs, (r) => r.reach >= r.life - 2)}`);
    console.log(`- the game: won ${pct(rs, (r) => r.won)}; lost within two turns of it ${pct(rs, (r) => r.lostWithin2)}`);
    console.log(`- the candidate rule would allow ${ok.length} (won ${pct(ok, (r) => r.won)}, lost within two ${pct(ok, (r) => r.lostWithin2)}) and forbid ${bad.length} (won ${pct(bad, (r) => r.won)}, lost within two ${pct(bad, (r) => r.lostWithin2)})`);
    const bands = [[0, 6], [7, 10], [11, 14], [15, 99]] as const;
    console.log(`- by life before: ${bands.map(([a, b]) => { const x = rs.filter((r) => r.life >= a && r.life <= b); return `${a}–${b === 99 ? "+" : b}: ${x.length} (lost within two ${pct(x, (r) => r.lostWithin2)})`; }).join("; ")}`);
  }
}
function reportManaba(ends: { list: string; opp: string; won: boolean; extra: { snakes: number; lands: number; wastedOnlyWithSnakes: string[]; tapsThisTurn: number; hasManaba: boolean } }[]): void {
  for (const who of [...new Set(ends.map((e) => (e.list === "Chris" ? "Chris" : "pilot")))]) {
    const es = ends.filter((e) => (who === "Chris" ? e.list === "Chris" : e.list !== "Chris") && e.extra.hasManaba);
    const avg = (f: (e: (typeof es)[number]) => number) => (es.reduce((a, e) => a + f(e), 0) / Math.max(1, es.length)).toFixed(2);
    const wasted = es.filter((e) => e.extra.wastedOnlyWithSnakes.length > 0);
    const cards = new Map<string, number>(); for (const e of wasted) for (const c of e.extra.wastedOnlyWithSnakes) cards.set(c, (cards.get(c) ?? 0) + 1);
    console.log(`\n## ${who} — ${es.length} end steps with a Manaba out`);
    console.log(`- Snakes left untapped ${avg((e) => e.extra.snakes)}; lands left untapped ${avg((e) => e.extra.lands)}; Manaba taps that turn ${avg((e) => e.extra.tapsThisTurn)}`);
    console.log(`- a card in hand the Snakes' mana (and only it) would have cast: ${((100 * wasted.length) / Math.max(1, es.length)).toFixed(1)}% of end steps — most often ${[...cards].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c} ${n}`).join(", ")}`);
  }
}

/** --racing: the human's attacks where the pilot would have held, and the playouts from each. */
async function racing(): Promise<void> {
  const file = JSON.parse(readFileSync(arg("recorded", ""), "utf8")) as { games: { list: string; formatId?: string; result: { winner: number | null }; spec: MatchSpec & { rules: Record<string, number> }; log: { t: string }[] }[] };
  const K = Number(arg("playouts", "6"));
  let attacks = 0; const holds: { game: number; turn: number; life: [number, number]; mine: number; theirs: number; asHuman: number; asPilot: number }[] = [];
  for (const [gi, g] of file.games.entries()) {
    if (g.formatId && arg("format", "") && g.formatId !== arg("format", "")) continue;
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: g.spec.rules.startingLife ?? 20, handSize: g.spec.rules.handSize ?? 7, maxTurns: g.spec.rules.maxTurns ?? 120, ante: 0, ...(g.spec.rules.startingPlayer !== undefined ? { startingPlayer: g.spec.rules.startingPlayer } : {}) } as never;
    const prof = (i: 0 | 1) => difficultyProfile("master", "midrange", g.spec.players[1 - i]!.decklist as never, g.spec.players[i]!.decklist as never);
    const pilot = new HeuristicAgent(99, pool, prof(0));
    const points: { cursor: number; v: GameView; req: ActionRequest; a: Action }[] = []; let lastTurn = -1;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, g.spec.modifiers ?? [], undefined, (req, v, a, cursor) => {
      if (req.player === 0 && req.purpose === "declareAttacker" && v.turn !== lastTurn) { lastTurn = v.turn; if (a.type === "declareAttacker") points.push({ cursor, v: structuredClone(v), req: structuredClone(req), a }); }
    });
    for (const p of points) {
      attacks++;
      const mine = await pilot.chooseAction(p.v, p.req);
      if (mine.type === "declareAttacker") continue; // the pilot attacks too
      const play = async (forced: Action, s: number) => { const r = await replayThenPlay(pool, decks, g.log as never, p.cursor, forced, [new HeuristicAgent(s * 2 + 1, pool, prof(0)), new HeuristicAgent(s * 2 + 2, pool, prof(1))], s, rules, g.spec.modifiers ?? []); return r.winner === 0 ? 1 : 0; };
      let h = 0, q = 0; for (let k = 0; k < K; k++) { h += await play(p.a, 500 + k); q += await play(mine, 500 + k); }
      const pw = (pl: 0 | 1) => p.v.battlefield.filter((b) => b.controller === pl && b.power !== null).reduce((a, b) => a + (b.power ?? 0), 0);
      holds.push({ game: gi, turn: p.v.turn, life: [p.v.life[0], p.v.life[1]], mine: pw(0), theirs: pw(1), asHuman: h / K, asPilot: q / K });
    }
    console.error(`pilot-probe: game ${gi} (${g.list}) — ${points.length} attacks read`);
  }
  console.log(`\n## Racing — ${attacks} turns the human attacked; the pilot would have held on ${holds.length}`);
  const m = (f: (h: (typeof holds)[number]) => number) => (holds.reduce((a, h) => a + f(h), 0) / Math.max(1, holds.length));
  console.log(`- the playouts (${K} each way, master both seats): the human's attack won ${(100 * m((h) => h.asHuman)).toFixed(1)}%, the pilot's hold ${(100 * m((h) => h.asPilot)).toFixed(1)}%`);
  console.log(`- the board at those turns: life ${m((h) => h.life[0]).toFixed(1)} to ${m((h) => h.life[1]).toFixed(1)}, power ${m((h) => h.mine).toFixed(1)} to ${m((h) => h.theirs).toFixed(1)}`);
  for (const h of holds) console.log(`  game ${h.game} T${h.turn}: life ${h.life[0]}–${h.life[1]}, power ${h.mine}–${h.theirs}: attack ${(100 * h.asHuman).toFixed(0)}%, hold ${(100 * h.asPilot).toFixed(0)}%`);
}

/** --mines (S68 Part 1's measure): each list in --lists against --vs (a Minefield list), game one, both seats; per game, the
 * attackers the list declared while a Minefield was out, and how many its trigger alone killed. `--off rule` pilots both. */
async function mines(): Promise<void> {
  const fmt = arg("format", "jeskai"), F = (FORMAT_FIELD as unknown as Record<string, Record<string, List>>)[fmt]!;
  const keys = arg("lists", "rabble").split(","), vs = F[arg("vs", "minefield")]!, G = Number(arg("games", "20")), off = arg("off", "").split(",").filter(Boolean);
  for (const key of keys) {
    const me = F[key]!; let games = 0, declared = 0, killed = 0, won = 0;
    for (let g = 0; g < G; g++) {
      const seed = 6800 + g * 37, seat = (g % 2) as 0 | 1, decks = seat === 0 ? [me, vs] : [vs, me];
      const spec = { seed, players: decks.map((d) => ({ name: d.key, decklist: [...d.decklist], agent: "heuristic:master" })), rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
      const ag = decks.map((d, i) => new HeuristicAgent(seed * 2 + 1 + i, pool, { ...difficultyProfile("master", d.archetype as never, [...decks[1 - i]!.decklist], [...d.decklist]), ...(off.length ? { off } : {}) })) as unknown as [Agent, Agent];
      const inner = ag[seat];
      ag[seat] = { chooseAction: async (v: GameView, r: ActionRequest) => {
        const a = await inner.chooseAction(v, r);
        if (a.type === "declareAttacker") { const n = v.battlefield.filter((b) => b.cardId === "powerstone_minefield").length; const b = v.battlefield.find((x) => x.id === a.objectId);
          if (n && b && b.toughness !== null) { declared++; if (b.toughness - b.damage <= 2 * n) killed++; } }
        return a; } };
      const r = await runMatch(spec, pool, ag); games++; if (r.winner === seat) won++;
    }
    console.log(`${fmt}:${key} vs ${vs.key}${off.length ? ` (off: ${off.join(",")})` : ""}: ${games} games, won ${((100 * won) / games).toFixed(1)}%; attackers into a Minefield ${(declared / games).toFixed(2)} a game, killed by its trigger ${(killed / games).toFixed(2)} a game (${declared ? ((100 * killed) / declared).toFixed(0) : 0}%)`);
  }
}

if (process.argv.includes("--mines")) await mines();
else if (process.argv.includes("--racing")) await racing();
else if (!process.argv.includes("--mines")) await field(process.argv.includes("--manaba") ? "manaba" : "witch");
