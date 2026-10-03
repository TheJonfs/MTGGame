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
import { CONSTRUCTED_FORMATS, DRAFT_PLANE, LIMITED_FORMATS, OPEN_FORMAT, type ConstructedFormat, type Format, type LimitedFormat } from "./formats.js";
import { buildConstructedDeck, type LibraryList } from "./constructed-builder.js";
import { draftPick, runDraftPacks } from "./drafter.js";
import { rollPack, resolveSet, type ConvocationPackData } from "./packs.js";
import { buildLimitedDeck } from "./limited-builder.js";
import { limitedView, type CardRatingTable } from "./rating.js";
import { MatchSeries, SERIES_POINTS, type Seat, type SeriesState } from "./series.js";
import { convocationSeat } from "./matchup.js";
import { aiSideboard } from "./sideboard-ai.js";
import type { KnobValues } from "./knobs.js";
import { WorldRng } from "./rng.js";

/** S53: v2 — the staged event (a v1 event still loads: it is a v2 event without stages). */
export const EVENT_SAVE_VERSION = 2 as const;
/** S53: one stage of a full Convocation — a draft, a Sealed deal or a Constructed format, and its Swiss rounds. */
export interface ConvocationStage { kind: "draft" | "sealed" | "constructed"; formatId: string; rounds: number }
export interface EventSeat {
  name: string;
  /** A portrait slug (/portraits/<slug>.png); none for the human. */
  face?: string;
  human: boolean;
  pool: string[];
  deck: Decklist;
  sideboard: Decklist;
  /** S52 (Constructed): the authored list the seat's deck was built from, and how far it moved from it. */
  list?: string;
  tinker?: "stock" | "light" | "heavy";
  /** The deck's colours (the pair, then a splash), for the face and the entrance. */
  colors: string;
  archetype: "aggro" | "midrange" | "control";
}
export interface EventResult { round: number; a: number; b: number; series: SeriesState }
export interface ConvocationEvent {
  version: 1 | typeof EVENT_SAVE_VERSION;
  seed: number;
  /** The format being played — in a staged event, the current stage's. */
  formatId: string;
  rounds: number;
  difficulty: string;
  /** build → (round: pairings posted, series being played) → standings → … → over. S53: a staged event stands at
   * the interlude between stages (the day's end). */
  phase: "draft" | "build" | "round" | "standings" | "interlude" | "bracket" | "over";
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
  /** S51: the draft in progress — the pack each seat is holding (index = seat), every seat's picks so far, the pack
   * round (0…) and the pick number across the whole draft (1…). Gone once the draft is done (the picks are the pools). */
  draft?: { round: number; pick: number; packs: string[][]; picks: string[][]; /** S53: the live pod's seats by position (position 0 the human); absent = seats 0–7. */ pod?: number[] };
  /** S53: the full Convocation — its stages, the current one, and (in a draft stage) the pods its rounds pair in
   * (MTR 7.6: a player in a pod plays only that pod's players). `rounds` is the whole event's Swiss rounds. */
  stages?: ConvocationStage[];
  stage?: number;
  pods?: number[][];
  /** S53: the human's pool and registered deck in each stage (the ledger's "every deck the player registered"). */
  history?: { stage: number; formatId: string; pool: string[]; deck: Decklist }[];
  /** S53 (Part 2): the cards the human kept at the finish (the eight one, the champion two). */
  keptCards?: string[];
  /** S53 (Chris): the Pro Tour's decklists — the human registers one deck per Constructed format before the first
   * stage, and plays it every round of that format and in the Umbel. `registering` is the formats still to register. */
  decklists?: Record<string, Decklist>;
  registering?: string[];
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

const formatOf = (id: string): LimitedFormat => { const f = LIMITED_FORMATS.find((x) => x.id === id); if (!f) throw new Error(`event: ${id} is not a Limited format`); return f; };
/** Any format an event may be played in — Limited or Constructed. */
export const eventFormat = (id: string): Format => { const f = [...LIMITED_FORMATS, ...CONSTRUCTED_FORMATS].find((x) => x.id === id); if (!f) throw new Error(`event: unknown format ${id}`); return f; };
/** S53: a staged event's rolls are salted by the stage, so the second draft is not the first; an unstaged event's are as before. */
const stageSalt = (event: Pick<ConvocationEvent, "stages" | "stage">): number[] => (event.stages ? [1000 + (event.stage ?? 0)] : []);
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
    const b = buildLimitedDeck(pool, limitedView(deps.rating), deps.cards, { pairChoice: { seed: sub(opts.seed, 11, s), top: 3 } }); // post-S52: the Limited score; S53 (ADR-154): the field varies its pair
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

// ---------- S52: Constructed ----------

/** A new Constructed event (ADR-152): the field's decks by select-and-repair from the library (each seat its own
 * seed, so one archetype is several variations); the human's to build in the editor over the format's legal pool, to
 * take from "Suggest a deck", or to bring as a saved deck — checked at registration. */
export function newConstructedEvent(opts: Omit<NewEventOptions, "format"> & { format?: ConstructedFormat; library: readonly LibraryList[] }, deps: Pick<EventDeps, "cards" | "rating">): ConvocationEvent {
  const format = opts.format ?? OPEN_FORMAT, seats = opts.seats ?? 16, rounds = opts.rounds ?? 5;
  if (seats < 2) throw new Error("event: at least two seats");
  if (opts.top8 && seats < 8) throw new Error("event: a Top 8 needs eight seats");
  const rng = new WorldRng(sub(opts.seed, 1));
  const names = [...opts.names]; for (let i = names.length - 1; i > 0; i--) { const j = rng.int(i + 1); [names[i], names[j]] = [names[j]!, names[i]!]; }
  const used = new Set<string>();
  const field: EventSeat[] = [];
  for (let s = 0; s < seats; s++) {
    if (s === 0) { field.push({ name: opts.playerName ?? "You", human: true, pool: [], deck: [], sideboard: [], colors: "", archetype: "midrange" }); continue; }
    const b = buildConstructedDeck(format, deps.rating, sub(opts.seed, 8, s), opts.library, deps.cards);
    const colors = deckColors(b.deck, deps.cards);
    const fits = opts.faces.filter((f) => !used.has(f.portrait) && [...f.colors].some((c) => colors.includes(c)));
    const open = fits.length ? fits : opts.faces.filter((f) => !used.has(f.portrait));
    const face = open.length ? open[rng.int(open.length)]!.portrait : undefined;
    if (face) used.add(face);
    field.push({ name: names[(s - 1) % Math.max(1, names.length)] ?? `Seat ${s + 1}`, ...(face ? { face } : {}), human: false, pool: [], deck: b.deck, sideboard: [], list: b.from, tinker: b.tinker, colors, archetype: b.archetype });
  }
  return { version: EVENT_SAVE_VERSION, seed: opts.seed, formatId: format.id, rounds, difficulty: opts.difficulty ?? "standard", phase: "build", round: 0, field, pairings: [], results: [], ...(opts.top8 ? { top8: true } : {}) };
}
/** The human's seat's own select-and-repair deck — "Suggest a deck" in a Constructed event. */
export function suggestedConstructedDeck(event: ConvocationEvent, library: readonly LibraryList[], deps: Pick<EventDeps, "cards" | "rating">): Decklist {
  const format = eventFormat(event.formatId);
  if (format.kind !== "constructed") throw new Error("event: not a Constructed event");
  return buildConstructedDeck(format, deps.rating, sub(event.seed, 8, 0), library, deps.cards).deck;
}

// ---------- S51: the draft ----------

/** A new Draft event: the pod's first packs opened; every seat's pool empty until the draft is done. */
export function newDraftEvent(opts: NewEventOptions, deps: EventDeps): ConvocationEvent {
  const format = opts.format ?? DRAFT_PLANE, seats = opts.seats ?? 8, rounds = opts.rounds ?? 5;
  if (format.shape !== "draft") throw new Error(`event: ${format.id} is not a draft format`);
  if (opts.top8 && seats < 8) throw new Error("event: a Top 8 needs eight seats");
  const rng = new WorldRng(sub(opts.seed, 1));
  const names = [...opts.names]; for (let i = names.length - 1; i > 0; i--) { const j = rng.int(i + 1); [names[i], names[j]] = [names[j]!, names[i]!]; }
  const field: EventSeat[] = Array.from({ length: seats }, (_, s) => ({ name: s === 0 ? (opts.playerName ?? "You") : (names[(s - 1) % Math.max(1, names.length)] ?? `Seat ${s + 1}`), human: s === 0, pool: [], deck: [], sideboard: [], colors: "", archetype: "midrange" as const }));
  if (seats % DRAFT_POD !== 0) throw new Error(`event: a draft seats pods of ${DRAFT_POD} (${seats} asked)`);
  // Post-S52 (Chris: thirty-two players, no rematch in five rounds): the field is PODS of eight. The human's pod
  // (seats 0–7) drafts live; every other pod drafts now, headless on the pick rule, and its decks are built.
  const rngFace = new WorldRng(sub(opts.seed, 7)), used = new Set<string>();
  const set = deps.packs.sets.find((s) => s.id === format.set), recipe = deps.packs.recipes.find((r) => r.id === format.recipe);
  if (!set || !recipe) throw new Error(`event: format ${format.id} names a set or recipe the data lacks`);
  for (let pod = 1; pod < seats / DRAFT_POD; pod++) {
    const picks = runDraftPacks(set, recipe, deps.packs, deps.cards, limitedView(deps.rating), sub(opts.seed, 9, pod), DRAFT_POD, format.packs);
    picks.forEach((p, k) => { const s = pod * DRAFT_POD + k; field[s] = builtSeat(field[s]!, p, deps, opts.faces, used, rngFace); });
  }
  const event: ConvocationEvent = { version: EVENT_SAVE_VERSION, seed: opts.seed, formatId: format.id, rounds, difficulty: opts.difficulty ?? "standard", phase: "draft", round: 0, field, pairings: [], results: [], ...(opts.top8 ? { top8: true } : {}) };
  return { ...event, draft: { round: 0, pick: 1, packs: draftPacks(event, 0, deps), picks: Array.from({ length: DRAFT_POD }, () => []) } };
}
/** A draft pod's size: eight seats pass three packs. */
export const DRAFT_POD = 8;
/** An AI seat once its picks are known: its pool, its deck by the Limited builder, a face by its colours. */
function builtSeat(seat: EventSeat, picks: string[], deps: Pick<EventDeps, "cards" | "rating">, faces: readonly { portrait: string; colors: string }[], used: Set<string>, rng: WorldRng, opts: Parameters<typeof buildLimitedDeck>[3] = {}): EventSeat {
  const b = buildLimitedDeck(picks, limitedView(deps.rating), deps.cards, opts);
  if (seat.face) return { ...seat, pool: picks, deck: b.deck, sideboard: b.sideboard, colors: b.colors.join("") + (b.splash ?? ""), archetype: b.avgMv <= 2.6 ? "aggro" : "midrange" }; // S53: one face for the whole event
  const fits = faces.filter((f) => !used.has(f.portrait) && [...f.colors].some((c) => b.colors.includes(c as never)));
  const open = fits.length ? fits : faces.filter((f) => !used.has(f.portrait));
  const face = open.length ? open[rng.int(open.length)]!.portrait : undefined;
  if (face) used.add(face);
  return { ...seat, ...(face ? { face } : {}), pool: picks, deck: b.deck, sideboard: b.sideboard, colors: b.colors.join("") + (b.splash ?? ""), archetype: b.avgMv <= 2.6 ? "aggro" : "midrange" };
}
/** A pack round's packs — one a seat, from the event's seed and the round. */
function draftPacks(event: ConvocationEvent, round: number, deps: Pick<EventDeps, "cards" | "packs">): string[][] {
  const format = formatOf(event.formatId);
  const set = deps.packs.sets.find((s) => s.id === format.set), recipe = deps.packs.recipes.find((r) => r.id === format.recipe);
  if (!set || !recipe) throw new Error(`event: format ${format.id} names a set or recipe the data lacks`);
  const tiers = resolveSet(set, deps.cards, deps.packs.power), rng = new WorldRng(sub(event.seed, 6, round, ...stageSalt(event)));
  return Array.from({ length: DRAFT_POD }, () => rollPack(tiers, recipe, rng)); // the human's pod
}
/** The pack the human is looking at, and where it goes next ("left" on packs one and three, "right" on two). */
export const draftPack = (event: ConvocationEvent): string[] => event.draft?.packs[0] ?? [];
export const draftDirection = (event: ConvocationEvent): "left" | "right" => ((event.draft?.round ?? 0) % 2 === 0 ? "left" : "right");
export const draftTotalPicks = (event: ConvocationEvent, deps: Pick<EventDeps, "packs">): number => { const f = formatOf(event.formatId), r = deps.packs.recipes.find((x) => x.id === f.recipe)!; return f.packs * r.slots.reduce((n, s) => n + s.count, 0); };
/** The pick the pick rule would make for the human's seat (a headless human; the screen's "suggest"). */
export function suggestedPick(event: ConvocationEvent, deps: Pick<EventDeps, "cards" | "rating">): string {
  const d = event.draft!; return draftPick(d.packs[0]!, d.picks[0]!, d.pick, limitedView(deps.rating), deps.cards);
}

/** One step of the draft: the human takes `cardId` from their pack, every AI seat takes its pick by the pick rule
 * (hidden from the human — a real draft), and the packs pass: left on the first and third packs, right on the
 * second. When a pack round is spent the next is opened; when the last is spent the picks become the pools, the AI
 * seats' decks are built from theirs (the Limited builder), and the event stands at the build. No take-backs. */
export function draftStep(event: ConvocationEvent, cardId: string, deps: EventDeps, faces: readonly { portrait: string; colors: string }[] = []): ConvocationEvent {
  const d = event.draft;
  if (event.phase !== "draft" || !d) throw new Error("event: no draft in progress");
  if (!d.packs[0]!.includes(cardId)) throw new Error(`event: ${cardId} is not in the pack`);
  const seats = d.packs.length, format = formatOf(event.formatId); // the human's pod
  const packs = d.packs.map((p) => [...p]), picks = d.picks.map((p) => [...p]), lim = limitedView(deps.rating);
  for (let s = 0; s < seats; s++) {
    const choice = s === 0 ? cardId : draftPick(packs[s]!, picks[s]!, d.pick, lim, deps.cards);
    packs[s]!.splice(packs[s]!.indexOf(choice), 1); picks[s]!.push(choice);
  }
  if (packs[0]!.length > 0) {
    const dir = d.round % 2 === 0 ? 1 : -1; // seat s receives the pack of the seat to its right on a leftward pass
    return { ...event, draft: { round: d.round, pick: d.pick + 1, packs: packs.map((_, s) => packs[(s - dir + seats) % seats]!), picks, ...(d.pod ? { pod: d.pod } : {}) } };
  }
  if (d.round + 1 < format.packs) return { ...event, draft: { round: d.round + 1, pick: d.pick + 1, packs: draftPacks(event, d.round + 1, deps), picks, ...(d.pod ? { pod: d.pod } : {}) } }; // S53: the live pod rides along
  // the draft is done: the picks are the pools; the pod's AI seats build (the other pods built when the event began)
  const rng = new WorldRng(sub(event.seed, 10, ...stageSalt(event)));
  const used = new Set(event.field.map((x) => x.face).filter((x): x is string => !!x));
  const pod = d.pod ?? Array.from({ length: seats }, (_, k) => k); // S53: position → seat
  const field = event.field.map((seat, s) => { const k = pod.indexOf(s); return s === 0 ? { ...seat, pool: picks[0]! } : k >= 0 ? builtSeat(seat, picks[k]!, deps, faces, used, rng) : seat; });
  const { draft: _d, ...rest } = event;
  return { ...rest, field, phase: "build" };
}

export const poolCollection = (pool: readonly string[]): Collection => { const c: Collection = {}; for (const id of pool) c[id] = (c[id] ?? 0) + 1; return c; };
/** A deck against the event's format: the pool is the collection and the cap; basics are free. */
export function checkEventDeck(event: ConvocationEvent, seat: number, deck: Decklist, cards: Map<string, CardDef>): DeckCheck {
  const format = eventFormat(event.formatId);
  // S52 (ADR-152): a Constructed deck is checked against the format alone — the player's pool is every card it allows.
  return format.kind === "constructed" ? checkDeck(deck, null, format.rule, cards) : checkDeck(deck, poolCollection(event.field[seat]!.pool), format.rule, cards);
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
  const constructed = eventFormat(event.formatId).kind === "constructed"; // no pool: no sideboard this session
  const field = event.field.map((s, i) => (i === seat ? { ...s, deck: deck.map((e) => ({ ...e })), sideboard: constructed ? [] : sideboardOf(s.pool, deck), colors: deckColors(deck, cards) } : s));
  const opening = event.phase === "build" && seat === 0;
  // S53: a staged event keeps the human's pool and deck for each stage (the ledger lists every deck registered)
  const history = event.stages && opening ? [...(event.history ?? []).filter((h) => h.stage !== (event.stage ?? 0)), { stage: event.stage ?? 0, formatId: event.formatId, pool: [...event.field[0]!.pool], deck: deck.map((e) => ({ ...e })) }] : event.history;
  const next: ConvocationEvent = { ...event, field, ...(history ? { history } : {}) };
  return { ok: true, event: opening ? pairRound(next) : next };
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
  const pairDown = (xs: number[]) => search(xs) ?? (() => { const out: { a: number; b: number }[] = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push({ a: xs[i]!, b: xs[i + 1]! }); return out; })(); // no rematch-free pairing exists: pair down the order
  // S53 (MTR 7.6, Chris): a draft stage's rounds pair inside each pod, in the standings' order within it
  const inPods = event.stages && event.pods && event.stages[event.stage ?? 0]?.kind === "draft";
  const found = inPods ? event.pods!.flatMap((podSeats) => pairDown(pool.filter((i) => podSeats.includes(i)))) : pairDown(pool);
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
  if (event.stages && event.round === stageLastRound(event, event.stage ?? 0) && (event.stage ?? 0) + 1 < event.stages.length) return { ...event, phase: "interlude", pairings: [] }; // S53: the day ends
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
  const rating = eventFormat(event.formatId).kind === "limited" ? limitedView(deps.rating) : deps.rating; // post-S52: each format its own score
  const sb = aiSideboard(s.deck, s.sideboard, event.field[opp]!.deck, deps.cards, rating);
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

// ---------- S53: the full Convocation — a list of stages ----------

/** The Pro Tour's shape (S53 brief, Part 1): a draft, the Open, a draft, a second Constructed format; the Umbel in the last. */
export function defaultStages(secondConstructed: string = "open", firstConstructed: string = "open"): ConvocationStage[] {
  return [
    { kind: "draft", formatId: DRAFT_PLANE.id, rounds: 3 },
    { kind: "constructed", formatId: firstConstructed, rounds: 5 },
    { kind: "draft", formatId: DRAFT_PLANE.id, rounds: 3 },
    { kind: "constructed", formatId: secondConstructed, rounds: 5 },
  ];
}
/** The full Convocation seats 128 (Chris, S53: sixteen pods; a sixteen-round Swiss without rematches). */
export const CONVOCATION_SEATS = 128;
/** The last Swiss round of stage k (rounds counted across the whole event, from 1). */
export const stageLastRound = (event: Pick<ConvocationEvent, "stages">, k: number): number => (event.stages ?? []).slice(0, k + 1).reduce((n, st) => n + st.rounds, 0);
export const currentStage = (event: ConvocationEvent): ConvocationStage | undefined => event.stages?.[event.stage ?? 0];
export interface NewConvocationOptions { seed: number; stages?: ConvocationStage[]; seats?: number; difficulty?: string; names: readonly string[]; faces: readonly { portrait: string; colors: string }[]; playerName?: string; library: readonly LibraryList[] }

/** A new full Convocation: the field named and given its faces once; the first stage begun. The Umbel follows the
 * last stage, in its format. */
export function newConvocation(opts: NewConvocationOptions, deps: EventDeps): ConvocationEvent {
  const stages = opts.stages ?? defaultStages(), seats = opts.seats ?? CONVOCATION_SEATS;
  if (!stages.length) throw new Error("event: a Convocation has at least one stage");
  if (stages.some((st) => st.kind === "draft") && seats % DRAFT_POD !== 0) throw new Error(`event: a draft seats pods of ${DRAFT_POD} (${seats} asked)`);
  if (seats < 8) throw new Error("event: the Umbel needs eight seats");
  for (const st of stages) { const f = eventFormat(st.formatId); if ((st.kind === "constructed") !== (f.kind === "constructed")) throw new Error(`event: stage ${st.kind} names ${f.id}`); }
  const rng = new WorldRng(sub(opts.seed, 1));
  const names = [...opts.names]; for (let i = names.length - 1; i > 0; i--) { const j = rng.int(i + 1); [names[i], names[j]] = [names[j]!, names[i]!]; }
  const faces = [...opts.faces]; for (let i = faces.length - 1; i > 0; i--) { const j = rng.int(i + 1); [faces[i], faces[j]] = [faces[j]!, faces[i]!]; }
  // the portraits recycle across the field (Chris, S53: fine while there are fewer portraits than seats)
  const field: EventSeat[] = Array.from({ length: seats }, (_, s) => ({ name: s === 0 ? (opts.playerName ?? "You") : (names[(s - 1) % Math.max(1, names.length)] ?? `Seat ${s + 1}`), ...(s > 0 && faces.length ? { face: faces[(s - 1) % faces.length]!.portrait } : {}), human: s === 0, pool: [], deck: [], sideboard: [], colors: "", archetype: "midrange" as const }));
  const rounds = stages.reduce((n, st) => n + st.rounds, 0);
  const event: ConvocationEvent = { version: EVENT_SAVE_VERSION, seed: opts.seed, formatId: stages[0]!.formatId, rounds, difficulty: opts.difficulty ?? "standard", phase: "build", round: 0, field, pairings: [], results: [], top8: true, stages, stage: 0, history: [] };
  // the decklists first (the Pro Tour's registration): one deck per Constructed format, before Day 1
  const formats = [...new Set(stages.filter((st) => st.kind === "constructed").map((st) => st.formatId))];
  if (formats.length) return { ...event, formatId: formats[0]!, registering: formats, decklists: {} };
  return beginStage(event, 0, deps, opts.library);
}

/** S53 (Chris): register the human's deck for the format at the head of `registering` (checked by the format); the
 * last one begins Day 1. A registered deck is locked: it plays every round of its format and the Umbel. */
export function registerDecklist(event: ConvocationEvent, deck: Decklist, deps: EventDeps, library: readonly LibraryList[]): { ok: true; event: ConvocationEvent } | { ok: false; problems: string[] } {
  const [formatId, ...rest] = event.registering ?? [];
  if (!formatId || event.phase !== "build") throw new Error("event: no decklist to register");
  const check = checkEventDeck(event, 0, deck, deps.cards);
  if (!check.ok) return { ok: false, problems: check.problems };
  const decklists = { ...(event.decklists ?? {}), [formatId]: deck.map((e) => ({ ...e })) };
  const field = event.field.map((s, i) => (i === 0 ? { ...s, deck: [], colors: "" } : s));
  if (rest.length) return { ok: true, event: { ...event, field, decklists, registering: rest, formatId: rest[0]! } };
  const { registering: _r, ...done } = event;
  return { ok: true, event: beginStage({ ...done, field, decklists, formatId: event.stages![0]!.formatId }, 0, deps, library) };
}

/** Stage k begins: every seat a fresh pool or deck for it (the record carries — the standings read every result).
 * A draft: the pods (the first draft's at random, a later one's by the standings — Chris, S53), every pod but the
 * human's drafted now, the human's live. A Sealed stage deals every seat a pool (the field varies its pair, ADR-154).
 * A Constructed stage builds the field by select-and-repair (each seat its own seed). The human builds or registers. */
export function beginStage(event: ConvocationEvent, k: number, deps: EventDeps, library: readonly LibraryList[]): ConvocationEvent {
  const st = event.stages?.[k]; if (!st) throw new Error(`event: no stage ${k}`);
  const { current: _c, draft: _d, pods: _p, ...base } = event;
  const at: ConvocationEvent = { ...base, stage: k, formatId: st.formatId, phase: "build", pairings: [] };
  const n = at.field.length, salt = stageSalt(at);
  const bare = (seat: EventSeat): EventSeat => { const { list: _l, tinker: _t, ...rest } = seat; return { ...rest, pool: [], deck: [], sideboard: [], colors: "" }; };
  if (st.kind === "constructed") {
    const format = eventFormat(st.formatId) as ConstructedFormat;
    // S53 (Chris): a deck is registered once per format — the AI seats' from the format's first stage's roll, so a
    // second stage (and the Umbel) in the same format plays the same decks
    const first = at.stages!.findIndex((x) => x.formatId === st.formatId), deckSalt = stageSalt({ stages: at.stages!, stage: first });
    const mine = at.decklists?.[st.formatId];
    const field = at.field.map((seat, s) => {
      if (s === 0) return mine ? { ...bare(seat), deck: mine.map((e) => ({ ...e })), colors: deckColors(mine, deps.cards) } : bare(seat);
      const b = buildConstructedDeck(format, deps.rating, sub(at.seed, 8, s, ...deckSalt), library, deps.cards);
      return { ...bare(seat), deck: b.deck, list: b.from, tinker: b.tinker, colors: deckColors(b.deck, deps.cards), archetype: b.archetype };
    });
    if (!mine) return { ...at, field };
    const history = [...(at.history ?? []).filter((h) => h.stage !== k), { stage: k, formatId: st.formatId, pool: [], deck: mine.map((e) => ({ ...e })) }];
    return pairRound({ ...at, field, history }); // the registered deck plays: the round is posted
  }
  const format = formatOf(st.formatId);
  const set = deps.packs.sets.find((x) => x.id === format.set), recipe = deps.packs.recipes.find((r) => r.id === format.recipe);
  if (!set || !recipe) throw new Error(`event: format ${format.id} names a set or recipe the data lacks`);
  const noFaces: { portrait: string; colors: string }[] = [], used = new Set<string>(), rng = new WorldRng(sub(at.seed, 7, ...salt));
  if (st.kind === "sealed") {
    const tiers = resolveSet(set, deps.cards, deps.packs.power);
    const field = at.field.map((seat, s) => {
      const packRng = new WorldRng(sub(at.seed, 2, s, ...salt));
      const pool = Array.from({ length: format.packs }, () => rollPack(tiers, recipe, packRng)).flat();
      return s === 0 ? { ...bare(seat), pool } : builtSeat(bare(seat), pool, deps, noFaces, used, rng, { pairChoice: { seed: sub(at.seed, 11, s, ...salt), top: 3 } });
    });
    return { ...at, field };
  }
  // a draft: the pods
  const order = (() => {
    if (!at.results.length) { const r = new WorldRng(sub(at.seed, 12, ...salt)); const xs = at.field.map((_, i) => i); for (let i = xs.length - 1; i > 0; i--) { const j = r.int(i + 1); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
    return standings(at).map((r) => r.seat); // by the standings: the top eight records draft together
  })();
  const pods: number[][] = []; for (let i = 0; i < n; i += DRAFT_POD) pods.push(order.slice(i, i + DRAFT_POD));
  const field = at.field.map(bare);
  pods.forEach((podSeats, q) => {
    if (podSeats.includes(0)) return; // the human's pod drafts live
    const picks = runDraftPacks(set, recipe, deps.packs, deps.cards, limitedView(deps.rating), sub(at.seed, 9, q, ...salt), DRAFT_POD, format.packs);
    podSeats.forEach((seat, pos) => { field[seat] = builtSeat(field[seat]!, picks[pos]!, deps, noFaces, used, rng); });
  });
  const live = pods.find((x) => x.includes(0))!, pod = [0, ...live.filter((x) => x !== 0)];
  const drafting: ConvocationEvent = { ...at, field, pods, phase: "draft" };
  return { ...drafting, draft: { round: 0, pick: 1, packs: draftPacks(drafting, 0, deps), picks: Array.from({ length: DRAFT_POD }, () => []), pod } };
}
/** From the interlude: the next stage begins. */
export function nextStage(event: ConvocationEvent, deps: EventDeps, library: readonly LibraryList[]): ConvocationEvent {
  if (event.phase !== "interlude" || !event.stages) throw new Error("event: the next stage begins from the interlude");
  return beginStage(event, (event.stage ?? 0) + 1, deps, library);
}

// ---------- the finish and the ledger (ADR-147) ----------

export interface ConvocationLedgerEntry { when: string; formatId: string; seed: number; seats: number; rounds: number; difficulty: string; place: number; record: string; points: number; field: { name: string; place: number; points: number; colors: string }[]; deck: Decklist; kept?: string; top8?: true;
  /** S53: a full Convocation — its stages, the title won, every deck the human registered, the cards kept. */
  stages?: ConvocationStage[]; title?: string; decks?: { stage: number; formatId: string; deck: Decklist }[]; keptCards?: string[] }
/** S53 (Part 2): the finish's title — the Umbel's eight by their round, the rest by their place. */
export function finishTitle(place: number, seats: number): string {
  if (place === 1) return "Champion of the Umbel";
  if (place === 2) return "the Umbel's second stalk";
  if (place <= 4) return "a semi-finalist";
  if (place <= 8) return "an Umbel seat";
  return `${place}${["th", "st", "nd", "rd"][(place % 100 >= 11 && place % 100 <= 13) || place % 10 > 3 ? 0 : place % 10]} of ${seats}`;
}
/** S53 (Part 2): how many cards the human keeps from the last Limited stage's pool — the champion two, the eight one. */
export function keepAllowance(event: ConvocationEvent): number {
  if (!event.stages || event.phase !== "over") return 0;
  const place = finalPlaces(event).find((p) => p.seat === 0)!.place;
  return place === 1 ? 2 : place <= 8 ? 1 : 0;
}
/** S53: the pool the kept cards come from — the human's last Limited stage's. */
export function lastLimitedPool(event: ConvocationEvent): string[] {
  const h = [...(event.history ?? [])].reverse().find((x) => eventFormat(x.formatId).kind === "limited");
  return h ? [...h.pool] : [];
}
export function ledgerEntry(event: ConvocationEvent, when: string): ConvocationLedgerEntry {
  const table = standings(event), me = table.find((r) => r.seat === 0)!, places = finalPlaces(event);
  const placeOf = (seat: number) => places.find((p) => p.seat === seat)!.place;
  return {
    when, formatId: event.formatId, seed: event.seed, seats: event.field.length, rounds: event.rounds, difficulty: event.difficulty,
    place: placeOf(0), record: `${me.wins}–${me.losses}${me.draws ? `–${me.draws}` : ""}`, points: me.points,
    field: [...table].sort((x, y) => placeOf(x.seat) - placeOf(y.seat)).map((r) => ({ name: r.name, place: placeOf(r.seat), points: r.points, colors: event.field[r.seat]!.colors })),
    ...(event.bracket ? { top8: true as const } : {}),
    deck: event.field[0]!.deck.map((e) => ({ ...e })), ...(event.kept ? { kept: event.kept } : {}),
    ...(event.stages ? { stages: event.stages.map((x) => ({ ...x })), title: finishTitle(placeOf(0), event.field.length), decks: (event.history ?? []).map((h) => ({ stage: h.stage, formatId: h.formatId, deck: h.deck.map((e) => ({ ...e })) })), ...(event.keptCards?.length ? { keptCards: [...event.keptCards] } : {}) } : {}),
  };
}

// ---------- the save: convocation-event-v1 ----------

export const EVENT_SAVE_KEY = "shandalar-convocation";
export const LEDGER_KEY = "shandalar-convocation-ledger";
/** S53: the save is `convocation-event-v2` (the stage list, the stage, the pods, the human's per-stage pools and
 * decks); a `convocation-event-v1` save loads as an event without stages. */
export function serializeEvent(event: ConvocationEvent): string { return JSON.stringify({ format: "convocation-event-v2", event: { ...event, version: EVENT_SAVE_VERSION } }); }
export function deserializeEvent(text: string): ConvocationEvent | null {
  try {
    const raw = JSON.parse(text) as { format?: string; event?: ConvocationEvent };
    if (!raw.event || !Array.isArray(raw.event.field)) return null;
    if (raw.format === "convocation-event-v1" && raw.event.version === 1) return { ...raw.event, version: EVENT_SAVE_VERSION };
    if (raw.format !== "convocation-event-v2" || raw.event.version !== EVENT_SAVE_VERSION) return null;
    return raw.event;
  } catch { return null; }
}

/** The field's names (S49 brief Part 5 — the planner's sixteen; the plane's register). */
export const CONVOCATION_NAMES: readonly string[] = ["Hesper Lune", "Tamsin Vell", "Orrin Blackquill", "Ilse Marrowgate", "Cassian Dray", "Nerys Fallow", "Dathan Mire", "Perpetua Ash", "Wyn Cordovan", "Sabel Thorne", "Ignatius Reed", "Mora Tideswell", "Corvin Hale", "Lirael Stane", "Osric Fenn", "Ysolt Garrow"];
