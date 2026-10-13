import type { CardDef } from "@shandalar/cards";
import type { MatchResult, MatchSpec } from "@shandalar/engine";
import { CONSTRUCTED_FORMATS, GAMES_KEPT, GAMES_KEY, MatchSeries, OPEN_FORMAT, aiSideboard, fieldSideboard, formatView, sideboardTermsFor, type CardRatingTable, type Collection, type Decklist } from "@shandalar/world";
import type { PlayChoice } from "./play-decks.js";

/**
 * Post-S60 (Chris: "can we expand our single game tester to have a toggle for playing matches?"), a module of its own
 * in S61 (the unit test's sake): the single match as a MATCH. The event's series (best of three; the loser of a game
 * chooses play or draw; the AI always plays first), the deck as registered and its sideboard, the deck as it stands
 * after sideboarding, and the opponent's fifteen (its registered one, else the field builder's). The AI sideboards
 * from game two as it does in the Open — its guide where it has one, the general rules otherwise — against the
 * human's REGISTERED sixty. The human is the series' seat 0.
 */
export interface MatchRunSetup { human: PlayChoice; enemy: PlayChoice; humanSeat: 0 | 1; seed: string }
export interface MatchRun<S extends MatchRunSetup = MatchRunSetup> { series: MatchSeries; setup: S; main: Decklist; side: Decklist; deck: Decklist; enemySide: Decklist; game: ReturnType<MatchSeries["nextGame"]> | null; recorded: boolean }
/** S62 (ADR-176): the format a chosen deck belongs to — a format's own list (the Open's, Peasant's) by its category;
 * anything else is read as the Open's. Its fifteen, where the field builder makes one, and its sideboarding scale follow. */
const formatOf = (c: PlayChoice) => CONSTRUCTED_FORMATS.find((f) => f.id === c.group) ?? OPEN_FORMAT;
export const count = (l: Decklist) => l.reduce((n, e) => n + e.count, 0);
const copy = (l: Decklist): Decklist => l.map((e) => ({ ...e }));

/** A new match: the human's sixty and fifteen (a deck without one gets the field builder's), the opponent's fifteen. */
export function newMatchRun<S extends MatchRunSetup>(setup: S, pool: Map<string, CardDef>, rating: CardRatingTable, random: () => number = Math.random): MatchRun<S> {
  const seed = setup.seed.trim() !== "" && Number.isFinite(Number(setup.seed)) ? Number(setup.seed) : Math.floor(random() * 1_000_000);
  const main = copy(setup.human.decklist);
  const side = setup.human.sideboard?.length ? copy(setup.human.sideboard) : fieldSideboard(main, formatOf(setup.human), { cards: pool, rating });
  const enemySide = setup.enemy.sideboard?.length ? copy(setup.enemy.sideboard) : fieldSideboard(setup.enemy.decklist, formatOf(setup.enemy), { cards: pool, rating });
  return { series: new MatchSeries({ seed, firstChooser: 0 }), setup, main, side, deck: main, enemySide, game: null, recorded: false };
}
/** Game one's call is the setup's ("in game one you play first / second"). */
export const firstCall = (setup: MatchRunSetup): "play" | "draw" => (setup.humanSeat === 0 ? "play" : "draw");

/** The next game: the series' seed and starting player (the human's call counts only when the human is the chooser;
 * the AI always plays first), the human's deck as it stands, the AI's deck sideboarded from game two. */
export function nextMatchGame<S extends MatchRunSetup>(r: MatchRun<S>, choice: "play" | "draw", pool: Map<string, CardDef>, rating: CardRatingTable): { run: MatchRun<S>; game: ReturnType<MatchSeries["nextGame"]>; human: Decklist; enemy: Decklist } {
  const game = r.series.nextGame(r.series.nextChooser() === 0 ? choice : "play");
  const enemy = game.index === 0 ? copy(r.setup.enemy.decklist) : aiSideboard(r.setup.enemy.decklist, r.enemySide, r.main, pool, formatView(rating, formatOf(r.setup.enemy).id), sideboardTermsFor(formatOf(r.setup.enemy).id)).deck;
  return { run: { ...r, game, recorded: false }, game, human: copy(r.deck), enemy };
}
/** A finished game goes into the series once (the human is seat 0, so the result's winner is the series' seat). */
export function recordMatchGame<S extends MatchRunSetup>(r: MatchRun<S>, result: Pick<MatchResult, "winner" | "reason" | "turns">): MatchRun<S> {
  if (!r.game || r.recorded) return r;
  r.series.record(r.game, result);
  return { ...r, recorded: true };
}

/** Between games: the cards the deck may be made of (the registered seventy-five), and the least it may hold. */
export function boardingPool(r: MatchRun): { all: Collection; floor: number } {
  const all: Collection = {}; for (const e of [...r.main, ...r.side]) all[e.cardId] = (all[e.cardId] ?? 0) + e.count;
  return { all, floor: Math.min(60, count(r.main)) };
}
/** Keep a sideboarded deck: refused (the reason) when it is short or holds a card beyond the seventy-five. */
export function keepBoardedDeck<S extends MatchRunSetup>(r: MatchRun<S>, draft: Decklist): { ok: true; run: MatchRun<S> } | { ok: false; reason: string } {
  const { all, floor } = boardingPool(r), n = count(draft);
  if (n < floor) return { ok: false, reason: `the deck has ${n} cards; it needs ${floor}` };
  const over = draft.find((e) => e.count > (all[e.cardId] ?? 0));
  if (over) return { ok: false, reason: `the seventy-five holds ${all[over.cardId] ?? 0} ${over.cardId}, not ${over.count}` };
  return { ok: true, run: { ...r, deck: copy(draft) } };
}

type Store = Pick<Storage, "getItem" | "setItem">;
/** Post-S60 (Chris: his match's game ones were not in the one log he could download): a finished game of the single
 * match is kept with the Convocation's recorded games — the same key, the same shape, the newest GAMES_KEPT — so the
 * Convocation's "download my games" carries it and `pnpm narrate` / `pnpm play-diff` read it. Never throws. */
export function recordPlayedGame(storage: Store | null, game: { spec: MatchSpec; result: MatchResult | null }, meta: Record<string, unknown>, now: () => string = () => new Date().toISOString()): void {
  if (!game.result || !storage) return;
  try {
    const raw = storage.getItem(GAMES_KEY), xs = raw ? (JSON.parse(raw) as unknown) : [], all = Array.isArray(xs) ? (xs as Record<string, unknown>[]) : [];
    all.push({ format: "shandalar-log-v1", when: now(), formatId: "open", ...meta, spec: game.spec, result: { winner: game.result.winner, reason: game.result.reason, turns: game.result.turns }, log: game.result.log.filter((x) => x.t === "ACTION" || x.t === "RNG") });
    let keep = all.slice(-GAMES_KEPT);
    try { storage.setItem(GAMES_KEY, JSON.stringify(keep)); }
    catch { keep = keep.slice(Math.ceil(keep.length / 2)); try { storage.setItem(GAMES_KEY, JSON.stringify(keep)); } catch { /* full: this game goes unrecorded */ } }
  } catch { /* a recording never interrupts play */ }
}
/** What a single match's game is filed under: the match's seed and game number, the opponent, an Open list's key. */
export const playedGameMeta = (enemy: PlayChoice, seed: number, phase: "match" | "single", game: number): Record<string, unknown> =>
  ({ eventSeed: seed, phase, round: 1, game, opponent: enemy.name, ...(enemy.group === "open" ? { list: enemy.key } : {}) });
