/**
 * S48 (Part 3, ADR-145/147): a Convocation EVENT — a field of seats, Swiss rounds of best-of-three series, standings,
 * a finish. Pure state and pure functions over it (the UI's controller and the headless runner both drive these); the
 * state is the save (`convocation-event-v1`) — never the world's. Everything derives from the event's seed: the pools,
 * the pairings, each series' seed.
 *
 * Tournament policy (not the Comprehensive Rules; S47/S48 rulings): a series is best of three, won at two wins, a draw
 * without a majority after three; standings 3 / 1 / 0; the tiebreaks are the Magic Tournament Rules' (Appendix C,
 * verified S49): opponents' match-win share (each opponent's floored at 0.33), then game-win share (floored at
 * 0.33), then opponents' game-win share; then the seat's number.
 */
import type { CardDef } from "@shandalar/cards";
import { cardColors, parseManaCost } from "@shandalar/cards";
import { runMatch, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";
import type { Decklist, Collection } from "./state.js";
import { checkDeck, isBasic, type DeckCheck } from "./legality.js";
import { LIMITED_FORMATS, type LimitedFormat } from "./formats.js";
import { rollPack, resolveSet, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck } from "./limited-builder.js";
import type { CardRatingTable } from "./rating.js";
import { MatchSeries, SERIES_POINTS, type Seat, type SeriesState } from "./series.js";
import { convocationSeat } from "./matchup.js";
import { aiSideboard } from "./sideboard-ai.js";
import type { KnobValues } from "./knobs.js";
import { WorldRng } from "./rng.js";

export const EVENT_SAVE_VERSION = 1 as const;
export interface EventSeat {
  name: string;
  /** A portrait slug (/portraits/<slug>.png); none for the human. */
  face?: string;
  human: boolean;
  pool: string[];
  deck: Decklist;
  sideboard: Decklist;
  /** The deck's colours (the pair, then a splash), for the face and the entrance. */
  colors: string;
  archetype: "aggro" | "midrange" | "control";
}
export interface EventResult { round: number; a: number; b: number; series: SeriesState }
export interface ConvocationEvent {
  version: typeof EVENT_SAVE_VERSION;
  seed: number;
  formatId: string;
  rounds: number;
  difficulty: string;
  /** build → (round: pairings posted, series being played) → standings → … → over. */
  phase: "build" | "round" | "standings" | "bracket" | "over";
  /** The current round, from 1 (0 while building). */
  round: number;
  /** Seat 0 is the human. */
  field: EventSeat[];
  /** This round's pairings; b = null is a bye. */
  pairings: { a: number; b: number | null }[];
  results: EventResult[];
  /** The human's series in progress: the games played (the next is replayed from its seed). */
  current?: SeriesState;
  byes?: { round: number; seat: number }[];
  /** S49: a Top 8 follows the Swiss rounds (single elimination). */
  top8?: boolean;
  /** S49: the bracket — the eight seats in standings order (seed 1 first), and each round's matches as they are
   * made and played (round 0 the quarter-finals: 1v8, 4v5, 2v7, 3v6 — so the semi-finals are neighbours). */
  bracket?: { seeds: number[]; rounds: { a: number; b: number; series?: SeriesState; winner?: number }[][] };
  /** Written once at the finish (ADR-147): the ledger has this event. */
  ledgered?: boolean;
  /** S48 placeholder for the linkage: a card from the pool the player kept at the prize screen. */
  kept?: string;
}

export interface EventDeps { cards: Map<string, CardDef>; packs: ConvocationPackData; rating: CardRatingTable }
export interface NewEventOptions { seed: number; format?: LimitedFormat; seats?: number; rounds?: number; top8?: boolean; difficulty?: string; names: readonly string[]; faces: readonly { portrait: string; colors: string }[]; playerName?: string }

const formatOf = (id: string): LimitedFormat => { const f = LIMITED_FORMATS.find((x) => x.id === id); if (!f) throw new Error(`event: unknown format ${id}`); return f; };
const sub = (seed: number, ...salt: number[]) => { const r = new WorldRng((seed ^ 0x9e3779b9) >>> 0); let x = r.int(0x7fffffff); for (const s of salt) x = new WorldRng((x + Math.imul(s + 1, 0x85ebca6b)) >>> 0).int(0x7fffffff); return x; };

/** A new Sealed event: every seat's pool from the event's seed; the AI seats' decks built; the human's to build. */
export function newSealedEvent(opts: NewEventOptions, deps: EventDeps): ConvocationEvent {
  const format = opts.format ?? LIMITED_FORMATS[0]!, seats = opts.seats ?? 8, rounds = opts.rounds ?? 3;
  if (seats < 2) throw new Error("event: at least two seats");
  const set = deps.packs.sets.find((s) => s.id === format.set), recipe = deps.packs.recipes.find((r) => r.id === format.recipe);
  if (!set || !recipe) throw new Error(`event: format ${format.id} names a set or recipe the data lacks`);
  const tiers = resolveSet(set, deps.cards, deps.packs.power);
  const rng = new WorldRng(sub(opts.seed, 1));
  const names = [...opts.names]; for (let i = names.length - 1; i > 0; i--) { const j = rng.int(i + 1); [names[i], names[j]] = [names[j]!, names[i]!]; }
  const usedFaces = new Set<string>();
  const field: EventSeat[] = [];
  for (let s = 0; s < seats; s++) {
    const packRng = new WorldRng(sub(opts.seed, 2, s));
    const pool = Array.from({ length: format.packs }, () => rollPack(tiers, recipe, packRng)).flat();
    if (s === 0) { field.push({ name: opts.playerName ?? "You", human: true, pool, deck: [], sideboard: [], colors: "", archetype: "midrange" }); continue; }
    const b = buildLimitedDeck(pool, deps.rating, deps.cards);
    const colors = b.colors.join("") + (b.splash ?? "");
    const fits = opts.faces.filter((f) => !usedFaces.has(f.portrait) && [...f.colors].some((c) => b.colors.includes(c as never)));
    const open = fits.length ? fits : opts.faces.filter((f) => !usedFaces.has(f.portrait));
    const face = open.length ? open[rng.int(open.length)]!.portrait : undefined;
    if (face) usedFaces.add(face);
    field.push({ name: names[(s - 1) % Math.max(1, names.length)] ?? `Seat ${s + 1}`, ...(face ? { face } : {}), human: false, pool, deck: b.deck, sideboard: b.sideboard, colors, archetype: b.avgMv <= 2.6 ? "aggro" : "midrange" });
  }
  if (opts.top8 && seats < 8) throw new Error("event: a Top 8 needs eight seats");
  return { version: EVENT_SAVE_VERSION, seed: opts.seed, formatId: format.id, rounds, difficulty: opts.difficulty ?? "standard", phase: "build", round: 0, field, pairings: [], results: [], ...(opts.top8 ? { top8: true } : {}) };
}

export const poolCollection = (pool: readonly string[]): Collection => { const c: Collection = {}; for (const id of pool) c[id] = (c[id] ?? 0) + 1; return c; };
/** A deck against the event's format: the pool is the collection and the cap; basics are free. */
export function checkEventDeck(event: ConvocationEvent, seat: number, deck: Decklist, cards: Map<string, CardDef>): DeckCheck {
  return checkDeck(deck, poolCollection(event.field[seat]!.pool), formatOf(event.formatId).rule, cards);
}
const sideboardOf = (pool: readonly string[], deck: Decklist): Decklist => {
  const left = poolCollection(pool); for (const e of deck) if (!isBasic(e.cardId)) left[e.cardId] = (left[e.cardId] ?? 0) - e.count;
  return Object.entries(left).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([cardId, count]) => ({ cardId, count }));
};
const deckColors = (deck: Decklist, cards: Map<string, CardDef>): string => {
  const pips: Record<string, number> = {};
  for (const e of deck) { const d = cards.get(e.cardId); if (!d || d.types.includes("Land")) continue; const c = parseManaCost(d.manaCost).colored; for (const k of cardColors(d)) pips[k] = (pips[k] ?? 0) + c[k] * e.count; }
  return Object.entries(pips).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k).join("");
};

/** Set a seat's deck (legal only); the rest of its pool is its sideboard. Registering the human's deck while
 * building opens round one. Between games of a series this is the sideboarding. */
export function registerDeck(event: ConvocationEvent, seat: number, deck: Decklist, cards: Map<string, CardDef>): { ok: true; event: ConvocationEvent } | { ok: false; problems: string[] } {
  const check = checkEventDeck(event, seat, deck, cards);
  if (!check.ok) return { ok: false, problems: check.problems };
  const field = event.field.map((s, i) => (i === seat ? { ...s, deck: deck.map((e) => ({ ...e })), sideboard: sideboardOf(s.pool, deck), colors: deckColors(deck, cards) } : s));
  const next: ConvocationEvent = { ...event, field };
  return { ok: true, event: event.phase === "build" && seat === 0 ? pairRound(next) : next };
}

// ---------- the record and the standings ----------

export interface Standing { seat: number; name: string; points: number; wins: number; losses: number; draws: number; gameWins: number; gamesPlayed: number; omw: number; gw: number; ogw: number; place: number }
function tally(event: ConvocationEvent) {
  const t = event.field.map(() => ({ points: 0, wins: 0, losses: 0, draws: 0, gameWins: 0, gamesPlayed: 0, played: 0, opponents: [] as number[] }));
  for (const r of event.results) {
    const s = r.series, w = s.winner;
    for (const [me, them, seat] of [[r.a, r.b, 0], [r.b, r.a, 1]] as [number, number, Seat][]) {
      const x = t[me]!; x.played += 1; x.opponents.push(them);
      x.gameWins += s.wins[seat]; x.gamesPlayed += s.games.length;
      if (w === "draw") { x.draws += 1; x.points += SERIES_POINTS.draw; } else if (w === seat) { x.wins += 1; x.points += SERIES_POINTS.win; } else x.losses += 1;
    }
  }
  for (const b of event.byes ?? []) { const x = t[b.seat]!; x.wins += 1; x.points += SERIES_POINTS.win; } // a bye is a win with no games and no opponent
  return t;
}
export function standings(event: ConvocationEvent): Standing[] {
  const t = tally(event);
  const FLOOR = 0.33;
  const mw = (i: number) => (t[i]!.played ? Math.max(FLOOR, t[i]!.points / (3 * t[i]!.played)) : FLOOR);
  const gwOf = (i: number) => (t[i]!.gamesPlayed ? Math.max(FLOOR, t[i]!.gameWins / t[i]!.gamesPlayed) : FLOOR);
  const rows = event.field.map((s, i) => {
    const x = t[i]!;
    return { seat: i, name: s.name, points: x.points, wins: x.wins, losses: x.losses, draws: x.draws, gameWins: x.gameWins, gamesPlayed: x.gamesPlayed, omw: x.opponents.length ? x.opponents.reduce((n, o) => n + mw(o), 0) / x.opponents.length : 0, gw: x.gamesPlayed ? gwOf(i) : 0, ogw: x.opponents.length ? x.opponents.reduce((n, o) => n + gwOf(o), 0) / x.opponents.length : 0, place: 0 };
  });
  rows.sort((a, b) => b.points - a.points || b.omw - a.omw || b.gw - a.gw || b.ogw - a.ogw || a.seat - b.seat);
  rows.forEach((r, i) => (r.place = i + 1));
  return rows;
}

// ---------- pairing ----------

/** Post the next round's pairings: round one random by the seed; after that Swiss — by points, no rematch (a
 * backtracking search down the standings; a bye, to the lowest seat without one, when the field is odd). */
export function pairRound(event: ConvocationEvent): ConvocationEvent {
  const round = event.round + 1;
  if (round > event.rounds) throw new Error("event: no round left to pair");
  const rng = new WorldRng(sub(event.seed, 3, round));
  const n = event.field.length, t = tally(event);
  const jitter = event.field.map(() => rng.float());
  const order = event.field.map((_, i) => i).sort((a, b) => (round === 1 ? 0 : t[b]!.points - t[a]!.points) || jitter[a]! - jitter[b]!);
  const met = (a: number, b: number) => t[a]!.opponents.includes(b);
  const pairings: { a: number; b: number | null }[] = [];
  let bye: number | null = null;
  if (n % 2 === 1) { const hadBye = new Set((event.byes ?? []).map((b) => b.seat)); bye = [...order].reverse().find((i) => !hadBye.has(i)) ?? order[order.length - 1]!; }
  const pool = order.filter((i) => i !== bye);
  const search = (left: number[]): { a: number; b: number }[] | null => {
    if (!left.length) return [];
    const [a, ...rest] = left as [number, ...number[]];
    for (const b of rest) { if (met(a, b)) continue; const tail = search(rest.filter((x) => x !== b)); if (tail) return [{ a, b }, ...tail]; }
    return null;
  };
  const found = search(pool) ?? (() => { const out: { a: number; b: number }[] = []; for (let i = 0; i + 1 < pool.length; i += 2) out.push({ a: pool[i]!, b: pool[i + 1]! }); return out; })(); // no rematch-free pairing exists: pair down the order
  // the human's seat is always `a` of its pairing (seat 0 of its series)
  for (const p of found) pairings.push(p.b === 0 ? { a: 0, b: p.a } : p);
  if (bye !== null) pairings.push({ a: bye, b: null });
  const { current: _c, ...rest } = event;
  return { ...rest, phase: "round", round, pairings, ...(bye !== null ? { byes: [...(event.byes ?? []), { round, seat: bye }] } : {}) };
}

/** A series' seed: from the event's, the round and the two seats. */
export const seriesSeed = (event: ConvocationEvent, a: number, b: number): number => (event.phase === "bracket" && event.bracket ? sub(event.seed, 5, event.bracket.rounds.length, a, b) : sub(event.seed, 4, event.round, a, b));
export const pairingOf = (event: ConvocationEvent, seat: number) => event.pairings.find((p) => p.a === seat || p.b === seat);
export const resultOf = (event: ConvocationEvent, round: number, seat: number) => event.results.find((r) => r.round === round && (r.a === seat || r.b === seat));
export const roundComplete = (event: ConvocationEvent) => event.pairings.every((p) => p.b === null || !!resultOf(event, event.round, p.a));

/** Record a finished series of this round (a over b: seat 0 of the series is `a`). */
export function recordSeries(event: ConvocationEvent, a: number, b: number, series: SeriesState): ConvocationEvent {
  if (!series.done) throw new Error("event: a series is recorded when done");
  if (!event.pairings.some((p) => p.a === a && p.b === b)) throw new Error(`event: ${a} v ${b} is not a pairing of round ${event.round}`);
  if (resultOf(event, event.round, a)) return event;
  const { current, ...rest } = event;
  // the human's own series, once recorded, is no longer "in progress"; a field series leaves it be
  return { ...rest, ...(current && a !== 0 && b !== 0 ? { current } : {}), results: [...event.results, { round: event.round, a, b, series }] };
}
/** The human's series in progress (saved between games). */
export function saveCurrentSeries(event: ConvocationEvent, series: SeriesState): ConvocationEvent { return { ...event, current: series }; }

/** After a round's last series: the standings screen; `advanceEvent` then posts the next round or ends the event. */
export function closeRound(event: ConvocationEvent): ConvocationEvent {
  if (!roundComplete(event)) throw new Error("event: the round has series outstanding");
  return { ...event, phase: "standings" };
}
export function advanceEvent(event: ConvocationEvent): ConvocationEvent {
  if (event.phase !== "standings") throw new Error("event: advance from the standings");
  if (event.round < event.rounds) return pairRound(event);
  return event.top8 ? startBracket({ ...event, pairings: [] }) : { ...event, phase: "over", pairings: [] };
}

// ---------- playing a series headless ----------

/** The two seats' specs for a game of a series: the AI seat's entrance applies only against the human. */
export function seriesSetup(event: ConvocationEvent, a: number, b: number, knobs: EntranceKnobs): { life: [number, number]; modifiers: Modifier[] } {
  const A = event.field[a]!, B = event.field[b]!;
  const life: [number, number] = [20, 20]; const modifiers: Modifier[] = [];
  const bracketRound = event.phase === "bracket" && event.bracket ? event.bracket.rounds.length : undefined;
  const apply = (seat: Seat, s: EventSeat) => { const e = convocationSeat(event.round, [...s.colors], knobs, bracketRound); life[seat] = e.life; for (const cardId of e.entrance) modifiers.push({ type: "permanentOnBattlefield", player: seat, cardId }); };
  if (A.human && !B.human) apply(1, B);
  if (B.human && !A.human) apply(0, A);
  return { life, modifiers };
}

export interface SeriesDeps { cards: Map<string, CardDef>; knobs: EntranceKnobs; /** S49: with the rating, the AI seats sideboard between games. */ rating?: CardRatingTable }
export type EntranceKnobs = Pick<KnobValues, "convocationEntrance"> & Partial<Pick<KnobValues, "convocationBracketEntrance">>;
export type SeatAgents = (seat: EventSeat, opponent: EventSeat, gameSeed: number, side: Seat) => Agent;

/** One pairing's series, start to finish, headless (every seat an agent). Resumes from `from` when given. */
export async function playSeriesHeadless(event: ConvocationEvent, a: number, b: number, deps: SeriesDeps, agents: SeatAgents, from?: SeriesState): Promise<SeriesState> {
  const series = new MatchSeries({ seed: seriesSeed(event, a, b), ...(from ? { games: from.games } : {}) });
  const setup = seriesSetup(event, a, b, deps.knobs);
  while (!series.done) {
    const game = series.nextGame("play");
    // S49: from game two an AI seat plays its sideboarded deck (keyed on the opponent's registered list)
    const [A, B] = game.index === 0 ? [event.field[a]!, event.field[b]!] : [seatForGame(event, a, b, deps), seatForGame(event, b, a, deps)];
    const spec = { seed: game.seed, players: [{ name: A.name, decklist: A.deck, agent: "event" }, { name: B.name, decklist: B.deck, agent: "event" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: game.startingPlayer }, modifiers: [...setup.modifiers, ...lifeModifiers(setup.life)] } as MatchSpec;
    series.record(game, await runMatch(spec, deps.cards, [agents(A, B, game.seed, 0), agents(B, A, game.seed, 1)]));
  }
  return series.state();
}
/** A seat as it sits down for game two or three against `opp`: an AI seat sideboarded (when the rating is given);
 * the human's seat as registered. */
export function seatForGame(event: ConvocationEvent, seat: number, opp: number, deps: Pick<SeriesDeps, "cards" | "rating">): EventSeat {
  const s = event.field[seat]!;
  if (s.human || !deps.rating) return s;
  const sb = aiSideboard(s.deck, s.sideboard, event.field[opp]!.deck, deps.cards, deps.rating);
  return sb.swaps.length ? { ...s, deck: sb.deck, sideboard: sb.sideboard } : s;
}

/** A seat's life other than twenty, as engine modifiers. */
export function lifeModifiers(life: [number, number]): Modifier[] {
  const out: Modifier[] = [];
  life.forEach((l, p) => { if (l !== 20) out.push({ type: "startingLife", player: p as 0 | 1, value: l }); });
  return out;
}

/** Play every outstanding series of the round that the human is not in (the field), headless. */
export async function playFieldRound(event: ConvocationEvent, deps: SeriesDeps, agents: SeatAgents): Promise<ConvocationEvent> {
  let e = event;
  for (const p of event.pairings) {
    if (p.b === null || p.a === 0 || p.b === 0 || resultOf(e, e.round, p.a)) continue;
    e = recordSeries(e, p.a, p.b, await playSeriesHeadless(e, p.a, p.b, deps, agents));
  }
  return e;
}

// ---------- S49: the Top 8 — single elimination over the series ----------

/** The bracket opens: the standings' first eight, seeded 1v8, 4v5, 2v7, 3v6 (the halves meet in the final). */
export function startBracket(event: ConvocationEvent): ConvocationEvent {
  const seeds = standings(event).slice(0, 8).map((r) => r.seat);
  const m = (x: number, y: number) => order(seeds[x]!, seeds[y]!);
  return { ...event, phase: "bracket", bracket: { seeds, rounds: [[m(0, 7), m(3, 4), m(1, 6), m(2, 5)]] } };
}
/** The human's seat is always `a` of its match (seat 0 of its series). */
const order = (x: number, y: number) => (y === 0 ? { a: 0, b: x } : { a: x, b: y });
export const bracketRound = (event: ConvocationEvent) => event.bracket?.rounds[event.bracket.rounds.length - 1] ?? [];
export const BRACKET_ROUND_NAMES = ["the quarter-finals", "the semi-finals", "the final"] as const;
/** A bracket series must have a winner: a drawn series (no majority after three) goes to the higher seed. */
export function bracketWinner(event: ConvocationEvent, a: number, b: number, series: SeriesState): number {
  if (series.winner === 0) return a;
  if (series.winner === 1) return b;
  const seeds = event.bracket!.seeds;
  return seeds.indexOf(a) < seeds.indexOf(b) ? a : b;
}
export function recordBracketSeries(event: ConvocationEvent, a: number, b: number, series: SeriesState): ConvocationEvent {
  if (!series.done || !event.bracket) throw new Error("event: a bracket series is recorded when done");
  const rounds = event.bracket.rounds.map((r) => r.map((x) => ({ ...x })));
  const match = rounds[rounds.length - 1]!.find((x) => x.a === a && x.b === b);
  if (!match) throw new Error(`event: ${a} v ${b} is not a match of this bracket round`);
  if (match.series) return event;
  match.series = series; match.winner = bracketWinner(event, a, b, series);
  const { current, ...rest } = event;
  return { ...rest, ...(current && a !== 0 && b !== 0 ? { current } : {}), bracket: { seeds: event.bracket.seeds, rounds } };
}
export const bracketRoundComplete = (event: ConvocationEvent) => bracketRound(event).every((m) => m.winner !== undefined);
/** After a bracket round: the winners meet (neighbours), or the event is over. */
export function advanceBracket(event: ConvocationEvent): ConvocationEvent {
  if (event.phase !== "bracket" || !event.bracket || !bracketRoundComplete(event)) throw new Error("event: the bracket round has matches outstanding");
  const last = bracketRound(event);
  if (last.length === 1) return { ...event, phase: "over" };
  const next: { a: number; b: number }[] = [];
  for (let i = 0; i + 1 < last.length; i += 2) next.push(order(last[i]!.winner!, last[i + 1]!.winner!));
  return { ...event, bracket: { seeds: event.bracket.seeds, rounds: [...event.bracket.rounds, next] } };
}
/** Is this seat still in the bracket (in a match of the current round not yet lost)? */
export const aliveInBracket = (event: ConvocationEvent, seat: number) => event.phase === "bracket" && bracketRound(event).some((m) => (m.a === seat || m.b === seat) && (m.winner === undefined || m.winner === seat));
/** Play every outstanding match of the bracket round that the human is not in, headless. */
export async function playBracketFieldRound(event: ConvocationEvent, deps: SeriesDeps, agents: SeatAgents): Promise<ConvocationEvent> {
  let e = event;
  for (const m of bracketRound(event)) {
    if (m.winner !== undefined || m.a === 0 || m.b === 0) continue;
    e = recordBracketSeries(e, m.a, m.b, await playSeriesHeadless(e, m.a, m.b, deps, agents));
  }
  return e;
}
/** Every seat's final place: the bracket's for the eight (the winner, the finalist, the semi-finals' losers 3rd–4th
 * and the quarter-finals' 5th–8th, each group in standings order), the standings' for the rest. Without a bracket,
 * the standings'. */
export function finalPlaces(event: ConvocationEvent): { seat: number; place: number }[] {
  const table = standings(event);
  if (!event.bracket || event.phase !== "over") return table.map((r) => ({ seat: r.seat, place: r.place }));
  const rank = (seat: number) => table.findIndex((r) => r.seat === seat);
  const out: number[] = [];
  const rounds = event.bracket.rounds;
  const final = rounds[rounds.length - 1]![0]!;
  out.push(final.winner!, final.winner === final.a ? final.b : final.a);
  for (let r = rounds.length - 2; r >= 0; r--) out.push(...rounds[r]!.map((m) => (m.winner === m.a ? m.b : m.a)).sort((x, y) => rank(x) - rank(y)));
  out.push(...table.map((r) => r.seat).filter((s) => !out.includes(s)));
  return out.map((seat, i) => ({ seat, place: i + 1 }));
}

// ---------- the finish and the ledger (ADR-147) ----------

export interface ConvocationLedgerEntry { when: string; formatId: string; seed: number; seats: number; rounds: number; difficulty: string; place: number; record: string; points: number; field: { name: string; place: number; points: number; colors: string }[]; deck: Decklist; kept?: string; top8?: true }
export function ledgerEntry(event: ConvocationEvent, when: string): ConvocationLedgerEntry {
  const table = standings(event), me = table.find((r) => r.seat === 0)!, places = finalPlaces(event);
  const placeOf = (seat: number) => places.find((p) => p.seat === seat)!.place;
  return {
    when, formatId: event.formatId, seed: event.seed, seats: event.field.length, rounds: event.rounds, difficulty: event.difficulty,
    place: placeOf(0), record: `${me.wins}–${me.losses}${me.draws ? `–${me.draws}` : ""}`, points: me.points,
    field: [...table].sort((x, y) => placeOf(x.seat) - placeOf(y.seat)).map((r) => ({ name: r.name, place: placeOf(r.seat), points: r.points, colors: event.field[r.seat]!.colors })),
    ...(event.bracket ? { top8: true as const } : {}),
    deck: event.field[0]!.deck.map((e) => ({ ...e })), ...(event.kept ? { kept: event.kept } : {}),
  };
}

// ---------- the save: convocation-event-v1 ----------

export const EVENT_SAVE_KEY = "shandalar-convocation";
export const LEDGER_KEY = "shandalar-convocation-ledger";
export function serializeEvent(event: ConvocationEvent): string { return JSON.stringify({ format: "convocation-event-v1", event }); }
export function deserializeEvent(text: string): ConvocationEvent | null {
  try {
    const raw = JSON.parse(text) as { format?: string; event?: ConvocationEvent };
    if (raw.format !== "convocation-event-v1" || !raw.event || raw.event.version !== EVENT_SAVE_VERSION || !Array.isArray(raw.event.field)) return null;
    return raw.event;
  } catch { return null; }
}

/** The field's names (S49 brief Part 5 — the planner's sixteen; the plane's register). */
export const CONVOCATION_NAMES: readonly string[] = ["Hesper Lune", "Tamsin Vell", "Orrin Blackquill", "Ilse Marrowgate", "Cassian Dray", "Nerys Fallow", "Dathan Mire", "Perpetua Ash", "Wyn Cordovan", "Sabel Thorne", "Ignatius Reed", "Mora Tideswell", "Corvin Hale", "Lirael Stane", "Osric Fenn", "Ysolt Garrow"];
