/**
 * S48 (Part 4, ADR-145/147): the Convocation's controller — one Sealed event of eight. It owns the event (world/
 * event.ts — pure state), its save (`shandalar-convocation`; never the world's key), the human's series (a
 * `MatchSeries` over one `MatchController` per game — the world's start → finish pattern one level up) and the
 * field's series (headless, on the main thread when the human's series ends — see `fieldMs`). The deck editor is
 * the world's component over this controller's source: the sealed pool and the event's one deck.
 */
import type { CardDef } from "@shandalar/cards";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import {
  CONSTRUCTED_FORMATS, CONVOCATION_SEATS, shortStages, stagePodDrafts, checkSideboard, suggestedSideboard, SIDEBOARD_SIZE, eventDifficulty, type ConvocationDifficulty, buildConstructedDeck, selectCandidates, type ConstructedFormat, currentStage, defaultStages, finishTitle, keepAllowance, lastLimitedPool, newConvocation, nextStage, registerDecklist, stageLastRound, type ConvocationStage, convocationNames, limitedView, DRAFT_PLANE, authoredListsFrom, cardLegal, copyCap, deserializeWorld, eventFormat, isBasic, newConstructedEvent, suggestedConstructedDeck, draftDirection, draftPack, draftStep, draftTotalPicks, newDraftEvent, suggestedPick, EVENT_SAVE_KEY, LEDGER_KEY, MatchSeries, SEALED_PLANE, addCopy, advanceBracket, advanceEvent, bracketRound, bracketRoundComplete, buildLimitedDeck, checkEventDeck, closeRound, deserializeEvent, finalPlaces, playBracketFieldRound, recordBracketSeries, resolveKnobs, seatForGame,
  GAMES_KEY, GAMES_KEPT, ledgerEntry, lifeModifiers, newSealedEvent, pairingOf, playFieldRound, poolCollection, recordSeries, registerDeck, removeCopy, resultOf, roundComplete, saveCurrentSeries,
  serializeEvent, seriesSeed, seriesSetup, standings, type CardRatingTable, type Catalog, type ConvocationEvent, type ConvocationLedgerEntry, type ConvocationPackData,
  type Decklist, type KnobValues, type SeatAgents, type Standing,
} from "@shandalar/world";
import { OUTBOX_PREFIX, keepable, postOutbox, prizeBand, prizeGold, standingInvitation, finalPlaces as linkPlaces, type Invitation, type PrizeBand } from "@shandalar/world";
import { MatchController } from "../play/match-controller.js";
import { makeFieldPool, type FieldPool } from "./field-pool.js";
import { TOKEN_FACES } from "./token-faces.js";
import type { DeckEditorHost } from "../components/deck-editor-host.js";

export type ConvocationScreen =
  | { kind: "door" }
  | { kind: "draft" }
  | { kind: "build"; sideboarding: boolean; /** post-S54: a Constructed build's second page — the fifteen */ side?: boolean }
  | { kind: "pairings" }
  | { kind: "playDraw" }
  | { kind: "match" }
  | { kind: "between" }
  | { kind: "field" }
  | { kind: "standings" }
  | { kind: "bracket" }
  | { kind: "prize" }
  /** S53: the day's end between stages, and the door's trophy room. */
  | { kind: "interlude" }
  | { kind: "trophies" };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Post-S53: the field round gives up on its workers when no series has finished for this long (a series takes a second or two). */
export const FIELD_STALL_MS = 60_000;
/** A library list's name for the picker: the Open's by their name ("the Levy"), the rest with their group. */
export function listLabel(key: string): string {
  const [group, name = ""] = key.split(":"), nice = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (x) => x.toUpperCase());
  return group === "open" ? `the ${nice}` : `${nice} (${group})`;
}
/** A stage's name in the screens' text: "a draft", "Sealed", or the Constructed format's ("the Open"). */
export function stageName(st: ConvocationStage): string { return st.kind === "draft" ? "a draft" : st.kind === "sealed" ? "Sealed" : formatTitle(st.formatId); }
const formatTitle = (id: string) => { const n = eventFormat(id).name; return /^the /i.test(n) ? n.replace(/^The /, "the ") : n; };
export { finishTitle, stageLastRound, eventDifficulty };

export class ConvocationController {
  event: ConvocationEvent | null = null;
  screen: ConvocationScreen = { kind: "door" };
  /** The editor's draft (the build and the sideboarding). */
  draft: Decklist = [];
  notice: string | null = null;
  series: MatchSeries | null = null;
  match: MatchController | null = null;
  /** The last field round's wall time, ms (S47 Concern 4: measured, shown in the dev line). */
  fieldMs: number | null = null;
  /** Where the last field round was played: the workers, or the main thread (the dev line on the standings). */
  fieldOn: "workers" | "main" | null = null;
  /** Post-S53: why the field fell back from the workers to the main thread (the field screen's second line). */
  fieldNote: string | null = null;
  /** S53: the field round's progress — series played of series to play (the field screen's line). */
  fieldProgress: { done: number; of: number; /** S54: a draft stage's pods, not a round's matches */ pods?: boolean } | null = null;
  /** S53: the field's workers (a page with Workers); null in the tests — the main thread plays. */
  private fieldPool: FieldPool | null | undefined = undefined;
  /** Post-S57 (Chris: after a restart of the dev server the field played on the main thread until the page was
   * reloaded): a pool that broke — its workers failed to start, or none was ready in time, as a cold dev server's
   * first build of the worker can be — was broken for the life of the page. It is now replaced the next time the
   * field asks for workers (once a round, once a draft), so one bad start costs one round on the main thread. */
  private workers(): FieldPool | null {
    if (this.fieldPool?.broken) { this.fieldPool.dispose(); this.fieldPool = undefined; }
    if (this.fieldPool === undefined) this.fieldPool = makeFieldPool();
    return this.fieldPool;
  }
  /** The event's knobs — the defaults (the entrance flat); S54 (ADR-157): Hard's life is the event's own (hardLife), not a
   * campaign difficulty bundle. */
  get knobs(): KnobValues { return resolveKnobs({}); }
  private listeners = new Set<() => void>();

  constructor(
    readonly pool: Map<string, CardDef>,
    readonly packs: ConvocationPackData,
    readonly rating: CardRatingTable,
    readonly catalog: Catalog,
    private readonly storage: Store | null = typeof localStorage !== "undefined" ? localStorage : null,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    const raw = this.storage?.getItem(EVENT_SAVE_KEY);
    const saved = raw ? deserializeEvent(raw) : null;
    if (saved) this.event = saved;
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(): void { for (const fn of this.listeners) fn(); }
  private save(): void { if (this.event) this.storage?.setItem(EVENT_SAVE_KEY, serializeEvent(this.event)); }
  /** S59 (ADR-172): an event is stamped with its origin as it is created — the door's menu, or a journey's letter. */
  private startOrigin: { origin: "menu" | "journey"; invitationId?: string } | null = null;
  private pendingOrigin: { origin: "journey"; invitationId: string } | null = null;
  private set(event: ConvocationEvent): void {
    if (this.startOrigin) { event = { ...event, ...this.startOrigin }; this.startOrigin = null; }
    this.event = event; this.save();
  }

  // ---------- S59 (ADR-172): the bridge to the journey ----------
  /** The letter the journey holds (read from its save, never written): the invitation that stands, unless this page
   * has already spent it (the ledger or the event in progress names it). */
  invitation(): Invitation | null {
    try {
      const raw = this.storage?.getItem("shandalar-world-save"); if (!raw) return null;
      const inv = standingInvitation(deserializeWorld(raw));
      if (!inv || this.event?.invitationId === inv.id || this.ledger().some((l) => l.invitationId === inv.id) || this.storage?.getItem(OUTBOX_PREFIX + `${inv.id}:spent`)) return null;
      return inv;
    } catch { return null; }
  }
  /** Enter by the letter: the event of the invitation's shape, its origin the journey; the spend is posted home. A
   * single event is a draft (its kept card comes from a drafted pool). Refused while another event is in progress. */
  enterByInvitation(opts: { difficulty?: ConvocationDifficulty; first?: string; second?: string; seed?: number } = {}): boolean {
    const inv = this.invitation(); if (!inv || (this.event && this.event.phase !== "over")) return false;
    if (!postOutbox(this.storage, { id: `${inv.id}:spent`, kind: "spent", invitationId: inv.id })) return false;
    this.pendingOrigin = { origin: "journey", invitationId: inv.id };
    const d = opts.difficulty ? { difficulty: opts.difficulty } : {};
    if (inv.shape === "single") this.newEvent(opts.seed, { draft: true, seats: 32, rounds: 5, top8: true, ...d });
    else this.newConvocation(opts.seed, { ...d, ...(opts.first ? { first: opts.first } : {}), ...(opts.second ? { second: opts.second } : {}), short: inv.shape === "short" });
    return true;
  }
  /** What a journey event sends home at its finish: the band and its gold (null for a menu event). */
  prize(): { band: PrizeBand; gold: number; cards: number } | null {
    const e = this.event; if (!e || e.phase !== "over" || e.origin !== "journey" || !e.invitationId) return null;
    const place = linkPlaces(e).find((p) => p.seat === 0)!.place, band = prizeBand(place, e.field.length, !!e.bracket);
    return { band, gold: prizeGold(band, { hard: e.difficulty === "hard", single: !e.stages }, this.knobs), cards: band === "champion" ? (e.stages ? 2 : 1) : band === "eight" ? 1 : 0 };
  }
  /** The fence (a): a kept card is never one of the packs' power slot. */
  keepable(cardId: string): boolean { return keepable(cardId, this.packs.power); }

  hasSave(): boolean { return !!this.event; }
  ledger(): ConvocationLedgerEntry[] {
    try { const raw = this.storage?.getItem(LEDGER_KEY); const l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; } catch { return []; }
  }

  // ---------- the door ----------

  /** S49: the event's size — sixteen seats, five rounds and a Top 8 by default; the S48 event of eight stays offered. */
  newEvent(seed: number = Math.floor(Math.random() * 1_000_000), opts: { seats?: number; rounds?: number; top8?: boolean; difficulty?: ConvocationDifficulty; draft?: boolean; constructed?: string } = {}): void {
    this.startOrigin = this.pendingOrigin ?? { origin: "menu" }; this.pendingOrigin = null;
    const faces = this.faces();
    if (opts.constructed) { // S52 (ADR-152): a Constructed event — the field by select-and-repair, the player's deck from the format's whole pool
      const format = CONSTRUCTED_FORMATS.find((f) => f.id === opts.constructed); if (!format) return;
      this.set(newConstructedEvent({ seed, format, names: convocationNames(Math.max(16, (opts.seats ?? 32) - 1)), faces, library: this.library(), seats: opts.seats ?? 16, rounds: opts.rounds ?? 5, top8: opts.top8 ?? true, difficulty: opts.difficulty ?? "normal" }, this.deps()));
      this.series = null; this.match = null;
      return this.openBuild(false);
    }
    if (opts.draft) { // S51: a pod of eight drafts three packs; then the build, the rounds and the Umbel as before
      this.set(newDraftEvent({ seed, format: DRAFT_PLANE, names: convocationNames(Math.max(16, (opts.seats ?? 32) - 1)), faces, seats: opts.seats ?? 8, rounds: opts.rounds ?? 5, top8: opts.top8 ?? true, difficulty: opts.difficulty ?? "normal" }, this.deps()));
      this.series = null; this.match = null; this.passNote = null;
      this.screen = { kind: "draft" }; this.emit();
      return;
    }
    this.set(newSealedEvent({ seed, format: SEALED_PLANE, names: convocationNames(Math.max(16, (opts.seats ?? 32) - 1)), faces, seats: opts.seats ?? 8, rounds: opts.rounds ?? 3, ...(opts.top8 ? { top8: true } : {}), difficulty: opts.difficulty ?? "normal" }, { cards: this.pool, packs: this.packs, rating: this.rating }));
    this.series = null; this.match = null;
    this.openBuild(false);
  }
  /** S53: the full Convocation — four days (a draft, a Constructed format, a draft, a Constructed format) and the
   * Umbel, at 128 seats (Chris). The two Constructed formats are the door's choice of the seven. */
  newConvocation(seed: number = Math.floor(Math.random() * 1_000_000), opts: { difficulty?: ConvocationDifficulty; first?: string; second?: string; seats?: number; /** S54: two days — a draft and the first Constructed format */ short?: boolean; /** the tests' short shape */ stages?: ConvocationStage[] } = {}): void {
    this.startOrigin = this.pendingOrigin ?? { origin: "menu" }; this.pendingOrigin = null;
    const seats = opts.seats ?? CONVOCATION_SEATS;
    this.set(newConvocation({ seed, stages: opts.stages ?? (opts.short ? shortStages(opts.first ?? "open") : defaultStages(opts.second ?? "open", opts.first ?? "open")), seats, names: convocationNames(seats - 1), faces: this.faces(), library: this.library(), difficulty: opts.difficulty ?? "normal" }, this.deps()));
    this.series = null; this.match = null; this.passNote = null;
    if (this.event!.registering?.length) return this.openBuild(false); // the decklists first
    this.screen = { kind: "draft" }; this.emit();
  }
  /** S53 (Chris): before Day 1, the decklists — the format being registered, and the days it will play. */
  registration(): { formatName: string; days: number[]; left: number } | null {
    const e = this.event; if (!e?.registering?.length) return null;
    const f = e.registering[0]!, days = (e.stages ?? []).flatMap((st, i) => (st.formatId === f ? [i + 1] : []));
    return { formatName: eventFormat(f).name, days, left: e.registering.length };
  }
  isStaged(): boolean { return !!this.event?.stages; }
  /** "Day 2 — the Open" for the banners; "" outside a full Convocation. */
  stageLabel(): string { const e = this.event, st = e ? currentStage(e) : undefined; return st ? `Day ${(e!.stage ?? 0) + 1} — ${stageName(st)}` : ""; }
  /** The next stage's name ("a draft", "the Open") — the interlude's "Tomorrow". */
  nextStageName(): string { const e = this.event, st = e?.stages?.[(e.stage ?? 0) + 1]; return st ? stageName(st) : ""; }
  /** From the interlude: the next day begins — the draft, or the build. */
  async toNextStage(): Promise<void> {
    const e = this.event; if (!e || e.phase !== "interlude") return;
    const job = this.podsOnWorkers(e, (e.stage ?? 0) + 1), picks = job && (await job);
    this.set(nextStage(e, this.deps(), this.library(), picks));
    this.series = null; this.match = null; this.passNote = null;
    if (this.event!.phase === "draft") { this.screen = { kind: "draft" }; return this.emit(); }
    if (this.event!.phase === "round") { this.screen = { kind: "pairings" }; return this.emit(); } // a registered deck: straight to the round
    this.openBuild(false);
  }
  /** The door's trophy room: the full Convocations in the ledger. */
  toTrophies(): void { this.screen = { kind: "trophies" }; this.emit(); }

  /** Back to where the saved event stands. */
  resume(): void {
    const e = this.event; if (!e) return;
    this.series = null; this.match = null;
    if (e.phase === "draft") { this.passNote = null; this.screen = { kind: "draft" }; return this.emit(); }
    if (e.phase === "build") return this.openBuild(false);
    if (e.phase === "standings") { this.screen = { kind: "standings" }; return this.emit(); }
    if (e.phase === "interlude") { this.screen = { kind: "interlude" }; return this.emit(); }
    if (e.phase === "over") { this.screen = { kind: "prize" }; return this.emit(); }
    const opp = this.opponentSeat();
    if (e.current && opp !== null) { this.series = new MatchSeries({ seed: seriesSeed(e, 0, opp), games: e.current.games }); this.screen = { kind: "between" }; return this.emit(); }
    if (e.phase === "bracket") { this.screen = { kind: "bracket" }; return this.emit(); }
    if (resultOf(e, e.round, 0) && !roundComplete(e)) { this.screen = { kind: "field" }; this.emit(); void this.finishRound(); return; }
    this.screen = { kind: "pairings" }; this.emit();
  }
  abandon(): void { this.event = null; this.series = null; this.match = null; this.storage?.removeItem(EVENT_SAVE_KEY); this.screen = { kind: "door" }; this.emit(); }
  toDoor(): void { this.screen = { kind: "door" }; this.emit(); }

  // ---------- S51: the draft ----------

  /** The field's faces: the world catalog's opponents, and (post-S53, Chris) the tokens' art promoted to portraits. */
  private faces() { return [...this.catalog.opponents.map((o) => ({ portrait: o.portrait, colors: o.colorsPhaseTwo ?? o.colors })), ...TOKEN_FACES]; }
  private deps() { return { cards: this.pool, packs: this.packs, rating: this.rating }; }
  /** "The pack goes left." — the last pass, for the screen's line. */
  passNote: string | null = null;
  isDraft(): boolean { return this.event?.formatId === DRAFT_PLANE.id; }
  // ---------- S52: Constructed ----------
  /** The select-and-repair library: every authored list, from the catalog's data. */
  library() { return authoredListsFrom(this.catalog.starters, (this.catalog.flood?.decks ?? {}) as never); }
  isConstructed(): boolean { return !!this.event && eventFormat(this.event.formatId).kind === "constructed"; }
  formatName(): string { return this.event ? eventFormat(this.event.formatId).name : ""; }
  /** ADR-152: the player's pool is the format's whole legal pool — every legal card at its copy cap. */
  private legalPool(): Record<string, number> {
    const rule = eventFormat(this.event!.formatId).rule, out: Record<string, number> = {};
    for (const d of this.pool.values()) if (!isBasic(d.id) && cardLegal(d, rule)) out[d.id] = copyCap(d.id, rule);
    return out;
  }
  /** The campaign's saved decks (read from its save, never written), each with the format's verdict. */
  savedDecks(): { name: string; deck: Decklist; ok: boolean; problems: string[] }[] {
    if (!this.event || !this.isConstructed()) return [];
    try {
      const raw = this.storage?.getItem("shandalar-world-save"); if (!raw) return [];
      const w = deserializeWorld(raw);
      return Object.entries(w.decks).map(([name, deck]) => { const c = checkEventDeck(this.event!, 0, deck, this.pool); return { name, deck: deck.map((e) => ({ ...e })), ok: c.ok, problems: c.problems }; });
    } catch { return []; }
  }
  /** S53 (Part 3): the format's starting lists — the twelve its field is drawn from — for "start from a list". */
  startingLists(): { key: string; label: string; archetype: string }[] {
    if (!this.event || !this.isConstructed()) return [];
    return selectCandidates(eventFormat(this.event.formatId) as ConstructedFormat, this.rating, this.library(), this.pool).map(({ l }) => ({ key: l.key, label: listLabel(l.key), archetype: l.archetype }));
  }
  /** Start the build from one of them, repaired to the format and played as written (no tinkering). */
  startFromList(key: string): void {
    const e = this.event; if (!e || this.screen.kind !== "build" || !this.isConstructed()) return;
    this.draft = buildConstructedDeck(eventFormat(e.formatId) as ConstructedFormat, this.rating, 0, this.library(), this.pool, { from: key, tinker: "stock" }).deck;
    this.notice = null; this.emit();
  }
  /** Bring a saved deck into the draft (the legality panel says whether it may be registered). */
  useSavedDeck(name: string): void { const d = this.savedDecks().find((x) => x.name === name); if (!d || this.screen.kind !== "build") return; this.draft = d.deck; this.notice = null; this.emit(); }
  /** What the draft screen shows: the pack in hand, the picks so far, pick N of the total, the pack round. */
  draftView(): { pack: string[]; picks: string[]; pick: number; total: number; packRound: number; packs: number; direction: "left" | "right" } | null {
    const e = this.event; if (!e || e.phase !== "draft" || !e.draft) return null;
    return { pack: draftPack(e), picks: e.draft.picks[0]!, pick: e.draft.pick, total: draftTotalPicks(e, this.deps()), packRound: e.draft.round + 1, packs: DRAFT_PLANE.packs, direction: draftDirection(e) };
  }
  /** Take a card from the pack (no take-backs); the pod picks and the packs pass. The last pick opens the build. */
  pickCard(cardId: string): void {
    const e = this.event; if (!e || e.phase !== "draft" || this.screen.kind !== "draft" || !draftPack(e).includes(cardId)) return;
    const dir = draftDirection(e), lastOfPack = draftPack(e).length === 1;
    const next = draftStep(e, cardId, this.deps(), this.faces());
    this.set(next);
    this.passNote = lastOfPack ? null : `The pack goes ${dir}.`;
    if (next.phase === "build") return this.openBuild(false);
    this.emit();
  }
  /** The pick rule's own choice for the human's seat (the dev walk; never shown as advice). */
  suggestedPick(): string | null { const e = this.event; return e && e.phase === "draft" ? suggestedPick(e, this.deps()) : null; }

  // ---------- the pool and the build (the editor's source) ----------

  private openBuild(sideboarding: boolean): void {
    const me = this.event!.field[0]!;
    this.draft = me.deck.map((e) => ({ ...e })); this.notice = null;
    this.otherDraft = sideboarding ? [] : me.sideboard.map((e) => ({ ...e })); this.sideVisited = false;
    this.screen = { kind: "build", sideboarding }; this.emit();
  }
  /** Post-S54 (Chris): a Constructed build has two pages — the sixty and the fifteen. `draft` is the page on screen;
   * this is the other one. */
  private otherDraft: Decklist = [];
  private sideVisited = false;
  /** The build's page: true on the sideboard's. */
  buildingSide(): boolean { return this.screen.kind === "build" && !!this.screen.side; }
  private buildDeck(): Decklist { return this.buildingSide() ? this.otherDraft : this.draft; }
  private buildSide(): Decklist { return this.buildingSide() ? this.draft : this.otherDraft; }
  sideboardCount(): number { return (this.screen.kind === "build" && !this.screen.sideboarding ? this.buildSide() : this.event?.field[0]!.sideboard ?? []).reduce((n, e) => n + e.count, 0); }
  /** From the sixty to the fifteen, and back. */
  toSideboard(): void { if (this.screen.kind !== "build" || this.screen.sideboarding || this.screen.side || !this.isConstructed()) return; [this.draft, this.otherDraft] = [this.otherDraft, this.draft]; this.sideVisited = true; this.notice = null; this.screen = { kind: "build", sideboarding: false, side: true }; this.emit(); }
  toMainDeck(): void { if (!this.buildingSide()) return; [this.draft, this.otherDraft] = [this.otherDraft, this.draft]; this.notice = null; this.screen = { kind: "build", sideboarding: false }; this.emit(); }
  /** Between games: a Limited pool is the sideboard; a Constructed seat has its registered fifteen (post-S54). */
  canSideboard(): boolean { const e = this.event; return !!e && !!this.series && !this.series.done && (!this.isConstructed() || e.field[0]!.sideboard.length > 0 || (e.sideboards?.[e.formatId]?.length ?? 0) > 0); }
  openSideboard(): void { if (this.canSideboard()) this.openBuild(true); }
  editorLegality() { return this.buildingSide() ? checkSideboard(this.event!, this.otherDraft, this.draft, this.pool) : checkEventDeck(this.event!, 0, this.draft, this.pool); }
  /** The builder's deck for the player's pool — a starting point, not a registration. On the sideboard's page: the
   * fifteen the field's own builder would register beside this sixty. */
  suggestDeck(): void {
    if (!this.event) return;
    this.draft = this.buildingSide() ? suggestedSideboard(this.event, this.otherDraft, this.deps())
      : this.isConstructed() ? suggestedConstructedDeck(this.event, this.library(), this.deps()) : buildLimitedDeck(this.event.field[0]!.pool, limitedView(this.rating), this.pool).deck;
    this.notice = null; this.emit();
  }
  editorHost(): DeckEditorHost | null {
    const e = this.event; if (!e || this.screen.kind !== "build") return null;
    const constructed = this.isConstructed();
    const me = e.field[0]!, sideboarding = this.screen.sideboarding, side = this.buildingSide();
    const count = (l: Decklist) => { const c: Record<string, number> = {}; for (const x of l) c[x.cardId] = (c[x.cardId] ?? 0) + x.count; return c; };
    // post-S54: the sideboard's page draws on what the sixty leaves of each card's cap; between games a Constructed
    // seat draws on its registered seventy-five and nothing else
    const collection = !constructed ? poolCollection(me.pool)
      : sideboarding ? count([...me.deck, ...me.sideboard])
      : side ? (() => { const pool = this.legalPool(), used = count(this.otherDraft); for (const id of Object.keys(pool)) pool[id] = Math.max(0, pool[id]! - (used[id] ?? 0)); return pool; })()
      : this.legalPool();
    const formatName = this.formatName();
    const edit = (r: ReturnType<typeof addCopy>) => { if (r.ok) { this.draft = r.deck; this.notice = null; } else this.notice = r.reason; this.emit(); };
    const sideN = this.sideboardCount();
    const host: DeckEditorHost = {
      title: sideboarding ? (constructed ? "Sideboard — your seventy-five" : "Sideboard — your pool") : side ? `${formatName} — the sideboard, up to ${SIDEBOARD_SIZE}` : constructed ? `${formatName} — build ${eventFormat(e.formatId).rule.minCards ?? 60}` : this.isDraft() ? "Your picks — build forty" : "Your pool — build forty",
      draft: this.draft, name: side ? `${formatName} — sideboard` : formatName, notice: this.notice,
      source: { collection, savedDeck: side ? me.sideboard : me.deck, activeDeckName: formatName },
      legality: () => this.editorLegality(),
      add: (id: string) => edit(constructed && !sideboarding ? addCopy(collection, this.draft, id) : addCopy(collection, this.draft, id, Infinity)),
      remove: (id: string) => edit(removeCopy(this.draft, id)),
      reset: () => { this.draft = (side ? me.sideboard : me.deck).map((x) => ({ ...x })); this.notice = null; this.emit(); },
      // A Constructed build is registered from the SIDEBOARD's page only: the sixty's save always leads there.
      // (Post-S57, Chris: back on the sixty after a look at the sideboard, the one prominent button registered the
      // deck — with a half-built fifteen — and began the event. Post-S54 it led to the sideboard only the first time.)
      save: () => (constructed && !sideboarding && !side ? this.toSideboard() : void this.register()),
      saveLabel: sideboarding ? "Keep this deck" : side ? `Register the deck and its sideboard of ${this.draft.reduce((n, e) => n + e.count, 0)}` : constructed ? (this.sideVisited ? `Back to the sideboard (${sideN}/15)` : "Next: the sideboard") : "Register the deck",
      ...(sideboarding ? { close: () => { this.screen = { kind: "between" }; this.emit(); }, closeLabel: "Cancel" } : side ? { close: () => this.toMainDeck(), closeLabel: "Back to the sixty" } : {}),
      sparesLabel: sideboarding ? "Sideboard" : side ? "The format's pool — what the sixty leaves" : constructed ? "The format's pool" : "The pool",
    };
    return host;
  }
  /** Register the deck (the build) or keep the sideboarded deck (between games). An illegal draft is refused. */
  async register(): Promise<void> {
    const e = this.event; if (!e || this.screen.kind !== "build") return;
    const registering = !!e.registering?.length;
    // post-S54: a Constructed build registers its sixty and its fifteen together (whichever page is on screen)
    const building = this.isConstructed() && !this.screen.sideboarding;
    const deck = building ? this.buildDeck() : this.draft, side = building ? this.buildSide() : [];
    // the last decklist begins Day 1: a draft's other pods on the workers first (a refused deck drafts nothing)
    const day1 = registering && e.registering!.length === 1 && checkEventDeck(e, 0, deck, this.pool).ok && checkSideboard(e, deck, side, this.pool).ok;
    const job = day1 ? this.podsOnWorkers(e, 0) : undefined, picks = job && (await job);
    const r = registering ? registerDecklist(e, deck, this.deps(), this.library(), picks, side) : registerDeck(e, 0, deck, this.pool, side);
    if (!r.ok) { this.notice = r.problems.join("; "); return this.emit(); }
    const sideboarding = this.screen.sideboarding;
    this.set(r.event);
    if (registering) { // the next decklist, or Day 1
      if (r.event.phase === "build") return this.openBuild(false);
      this.passNote = null; this.screen = r.event.phase === "draft" ? { kind: "draft" } : { kind: "pairings" }; return this.emit();
    }
    this.screen = sideboarding ? { kind: "between" } : { kind: "pairings" };
    this.emit();
  }

  // ---------- the series over the match ----------

  /** The human's opponent: this round's pairing, or — in the bracket — the match they are still to play. */
  opponentSeat(): number | null {
    const e = this.event; if (!e) return null;
    if (e.phase === "bracket") { const m = bracketRound(e).find((x) => x.a === 0 && x.winner === undefined); return m ? m.b : null; }
    const p = pairingOf(e, 0); return p && p.b !== null ? (p.a === 0 ? p.b : p.a) : null;
  }
  /** The human has the bye this round (an odd field). */
  hasBye(): boolean { const e = this.event; return !!e && e.phase === "round" && pairingOf(e, 0)?.b === null; }
  /** Sit out a bye: the field plays, then the standings. */
  sitOut(): void { if (!this.hasBye()) return; this.screen = { kind: "field" }; this.emit(); void this.finishRound(); }
  places() { return this.event ? finalPlaces(this.event) : []; }
  standings(): Standing[] { return this.event ? standings(this.event) : []; }

  /** "Play the match": the series begins (or continues); the coin's winner chooses — the AI plays first. */
  playMatch(): void {
    const e = this.event, opp = this.opponentSeat(); if (!e || opp === null) return;
    if (!this.series) this.series = new MatchSeries({ seed: seriesSeed(e, 0, opp), ...(e.current ? { games: e.current.games } : {}) });
    this.nextGame();
  }
  /** The next game: the human chooser is asked; the AI chooser plays. */
  nextGame(): void {
    const s = this.series; if (!s || s.done) return;
    if (s.nextChooser() === 0) { this.screen = { kind: "playDraw" }; return this.emit(); }
    this.startGame("play");
  }
  choose(choice: "play" | "draw"): void { if (this.screen.kind === "playDraw") this.startGame(choice); }

  private startGame(choice: "play" | "draw"): void {
    const e = this.event!, s = this.series!, opp = this.opponentSeat()!;
    const game = s.nextGame(choice), me = e.field[0]!, setup = seriesSetup(e, 0, opp, this.knobs);
    const them = game.index === 0 ? e.field[opp]! : seatForGame(e, opp, 0, { cards: this.pool, rating: this.rating }); // S49: the AI sideboards from game two
    const m = new MatchController(this.pool, {
      humanSeat: 0, seed: game.seed,
      custom: {
        human: { name: me.name, decklist: me.deck },
        enemy: { name: them.name, decklist: them.deck, difficulty: "master", archetype: them.archetype, ...(them.face ? { portrait: them.face } : {}) },
        rules: { startingLife: 20, ante: 0, startingPlayer: game.startingPlayer },
        modifiers: [...setup.modifiers, ...lifeModifiers(setup.life)],
      },
    });
    this.match = m;
    this.screen = { kind: "match" };
    this.emit();
    void m.start().then((result) => {
      if (this.match !== m) return; // abandoned
      s.record(game, result);
      this.recordGame(m, { round: e.round, phase: e.phase, game: game.index, opponent: them.name, ...(them.list ? { list: them.list } : {}) });
      if (s.done) void this.finishSeries();
      else { this.set(saveCurrentSeries(this.event!, s.state())); this.screen = { kind: "between" }; this.emit(); }
    });
  }

  /** S58 (Part 2 — the play diff needs the human's MOVES, and an event's save keeps results only): each finished
   * game's spec and its moves (the ACTION and RNG entries: what a replay reads) are kept under their own key, the
   * newest GAMES_KEPT of them. A full store never breaks the game: the oldest half goes, then the write is skipped. */
  private recordGame(m: MatchController, meta: Record<string, unknown>): void {
    if (!this.storage || !m.result) return;
    try {
      const all = this.recordedGames();
      all.push({ format: "shandalar-log-v1", when: new Date().toISOString(), eventSeed: this.event?.seed, formatId: this.event?.formatId, ...meta, spec: m.spec, result: { winner: m.result.winner, reason: m.result.reason, turns: m.result.turns }, log: m.result.log.filter((x) => x.t === "ACTION" || x.t === "RNG") });
      let keep = all.slice(-GAMES_KEPT);
      try { this.storage.setItem(GAMES_KEY, JSON.stringify(keep)); }
      catch { keep = keep.slice(Math.ceil(keep.length / 2)); try { this.storage.setItem(GAMES_KEY, JSON.stringify(keep)); } catch { /* full: this game goes unrecorded */ } }
    } catch { /* a recording never interrupts play */ }
  }
  /** The recorded games, oldest first (what "download my games" writes: `{ games }`, the file `pnpm play-diff` reads). */
  recordedGames(): Record<string, unknown>[] {
    try { const raw = this.storage?.getItem(GAMES_KEY); const xs = raw ? (JSON.parse(raw) as unknown) : []; return Array.isArray(xs) ? (xs as Record<string, unknown>[]) : []; } catch { return []; }
  }

  /** The human's series is done: record it, then the field's series (headless, here), then the standings. */
  private async finishSeries(): Promise<void> {
    const opp = this.opponentSeat()!, e = this.event!;
    this.set(e.phase === "bracket" ? recordBracketSeries(e, 0, opp, this.series!.state()) : recordSeries(e, 0, opp, this.series!.state()));
    this.screen = { kind: "field" }; this.emit();
    if (e.phase === "bracket") await this.finishBracketRound(); else await this.finishRound();
  }
  private async finishRound(): Promise<void> {
    await new Promise((r) => setTimeout(r, 30)); // let the screen paint before the main thread is taken
    const agents: SeatAgents = (seat, opponent, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, this.pool, difficultyProfile("master", seat.archetype, opponent.deck, seat.deck));
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const pool = this.workers(), main = () => playFieldRound(this.event!, { cards: this.pool, knobs: this.knobs, rating: this.rating }, agents);
    let played: ConvocationEvent;
    this.fieldOn = pool ? "workers" : "main";
    if (!pool) played = await main();
    else {
      // post-S53: workers that fail or stall never strand the round — it plays on the main thread (the same series,
      // a series being its seed's), and the page stops using them
      try { played = await this.fieldOnWorkers(this.event!, pool); }
      catch (err) {
        pool.dispose(); this.fieldPool = undefined; // a fresh pool is tried the next time (null stayed null until the page reloaded)
        this.fieldNote = `The other tables play here instead (${err instanceof Error ? err.message : String(err)}).`; this.fieldProgress = null; this.emit();
        this.fieldOn = "main";
        await new Promise((r) => setTimeout(r, 30));
        played = await main();
      }
    }
    this.fieldNote = null;
    this.fieldMs = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : null;
    this.fieldProgress = null;
    this.set(closeRound(played));
    this.series = null; this.match = null;
    this.screen = { kind: "standings" }; this.emit();
  }
  /** S54 (Concern 6): a draft stage's other pods, drafted on the workers (each pod its seed's — the picks are the main
   * thread's). No promise without workers or pods (the tests: the event drafts them itself and the caller stays
   * synchronous); undefined picks when the workers fail (the event drafts them on the main thread). */
  private podsOnWorkers(e: ConvocationEvent, k: number): Promise<Map<number, string[][]> | undefined> | undefined {
    const { jobs } = stagePodDrafts(e, k);
    const pool = jobs.length ? this.workers() : null;
    return pool ? this.draftPods(jobs, pool) : undefined;
  }
  private async draftPods(jobs: ReturnType<typeof stagePodDrafts>["jobs"], pool: FieldPool): Promise<Map<number, string[][]> | undefined> {
    const back = this.screen;
    this.screen = { kind: "field" }; this.fieldProgress = { done: 0, of: jobs.length, pods: true }; this.emit();
    try {
      const picks = await Promise.all(jobs.map((j) => pool.draft(j).then((p) => { this.fieldProgress = { done: (this.fieldProgress?.done ?? 0) + 1, of: jobs.length, pods: true }; this.emit(); return p; })));
      return new Map(jobs.map((j, i) => [j.pod, picks[i]!]));
    } catch (err) {
      pool.dispose(); this.fieldPool = undefined; // a fresh pool is tried the next time (null stayed null until the page reloaded)
      this.fieldNote = `The other pods draft here instead (${err instanceof Error ? err.message : String(err)}).`; this.emit();
      await new Promise((r) => setTimeout(r, 30));
      return undefined;
    } finally { this.fieldProgress = null; this.screen = back; }
  }
  /** S53: the round's other series on the workers, recorded in the pairings' order (a series is its seed's). */
  private async fieldOnWorkers(e: ConvocationEvent, pool: FieldPool): Promise<ConvocationEvent> {
    const todo = e.pairings.filter((p) => p.b !== null && p.a !== 0 && p.b !== 0 && !resultOf(e, e.round, p.a)) as { a: number; b: number }[];
    this.fieldProgress = { done: 0, of: todo.length }; this.emit();
    const knobs = this.knobs;
    let last = Date.now();
    const watch = setInterval(() => { if (Date.now() - last > FIELD_STALL_MS) pool.breakAll(`no match finished in ${FIELD_STALL_MS / 1000} s`); }, 2_000);
    let done: Awaited<ReturnType<FieldPool["series"]>>[];
    try {
      done = await Promise.all(todo.map((p) => pool.series(e, p.a, p.b, knobs).then((s) => { last = Date.now(); this.fieldProgress = { done: (this.fieldProgress?.done ?? 0) + 1, of: todo.length }; this.emit(); return s; })));
    } finally { clearInterval(watch); }
    let x = e; todo.forEach((p, i) => { x = recordSeries(x, p.a, p.b, done[i]!); });
    return x;
  }
  private fieldAgents(): SeatAgents { return (seat, opponent, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, this.pool, difficultyProfile("master", seat.archetype, opponent.deck, seat.deck)); }
  /** S49: the bracket round's other matches (headless, here), then the next round's matches — or the finish. */
  private async finishBracketRound(): Promise<void> {
    await new Promise((r) => setTimeout(r, 30));
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    let e = await playBracketFieldRound(this.event!, { cards: this.pool, knobs: this.knobs, rating: this.rating }, this.fieldAgents());
    this.fieldMs = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : null;
    if (bracketRoundComplete(e)) e = this.finished(advanceBracket(e));
    this.set(e);
    this.series = null; this.match = null;
    this.screen = { kind: "bracket" }; this.emit();
  }
  /** A player outside the eight (or out of it) watches the bracket resolve: every remaining round, headless. */
  async resolveBracket(): Promise<void> {
    if (!this.event || this.event.phase !== "bracket" || this.opponentSeat() !== null) return;
    this.screen = { kind: "field" }; this.emit();
    await new Promise((r) => setTimeout(r, 30));
    let e = this.event;
    while (e.phase === "bracket") {
      e = await playBracketFieldRound(e, { cards: this.pool, knobs: this.knobs, rating: this.rating }, this.fieldAgents());
      if (!bracketRoundComplete(e)) break; // the human's own match is still to play
      e = this.finished(advanceBracket(e));
      if (e.phase === "bracket" && bracketRound(e).some((m) => m.a === 0 && m.winner === undefined)) break; // the human plays on
    }
    this.set(e);
    this.screen = { kind: "bracket" }; this.emit();
  }
  /** The ledger's line, written once, when the event is over. */
  private finished(e: ConvocationEvent): ConvocationEvent {
    if (e.phase !== "over" || e.ledgered) return e;
    // S59: a journey event posts its purse home (once: the id is the invitation's); a menu event posts nothing
    const was = this.event; this.event = e; const pz = this.prize(); this.event = was;
    if (pz && pz.gold > 0) postOutbox(this.storage, { id: `${e.invitationId}:prize`, kind: "prize", invitationId: e.invitationId!, gold: pz.gold });
    this.storage?.setItem(LEDGER_KEY, JSON.stringify([...this.ledger(), { ...ledgerEntry(e, this.now()), ...(pz ? { prizeGold: pz.gold } : {}) }]));
    return { ...e, ledgered: true };
  }
  /** From the bracket screen once the event is over: the prize. */
  toPrize(): void { if (this.event?.phase === "over") { this.screen = { kind: "prize" }; this.emit(); } }

  /** From the standings: the next round's pairings, or the finish (the ledger's line, written once). */
  next(): void {
    const e = this.event; if (!e || e.phase !== "standings") return;
    const n = this.finished(advanceEvent(e));
    this.set(n);
    this.screen = n.phase === "over" ? { kind: "prize" } : n.phase === "bracket" ? { kind: "bracket" } : n.phase === "interlude" ? { kind: "interlude" } : { kind: "pairings" };
    this.emit();
  }
  /** The prize placeholder (ADR-147): a card from the pool to keep — recorded on the event and its ledger line. */
  keep(cardId: string): void {
    const e = this.event; if (!e || e.phase !== "over" || !this.keepable(cardId)) return; // S59: the fence
    // S59: a journey event's kept card goes home with the purse — the champion's and the eight's, as the table has it
    const home = (n: number) => { const pz = this.prize(); if (pz && n <= pz.cards) postOutbox(this.storage, { id: `${e.invitationId}:kept:${n}`, kind: "kept", invitationId: e.invitationId!, cards: [cardId] }); };
    if (e.stages) { // S53 (Part 2): the eight keep one, the champion two — from the last Limited stage's pool
      const kept = e.keptCards ?? [], pool = lastLimitedPool(e);
      if (kept.length >= keepAllowance(e) || !pool.includes(cardId) || kept.filter((x) => x === cardId).length >= pool.filter((x) => x === cardId).length) return;
      const next = [...kept, cardId];
      home(next.length);
      this.set({ ...e, keptCards: next });
      const l = this.ledger(); const last = l[l.length - 1];
      if (last && last.seed === e.seed) { l[l.length - 1] = { ...last, keptCards: next }; this.storage?.setItem(LEDGER_KEY, JSON.stringify(l)); }
      return this.emit();
    }
    if (e.kept || !e.field[0]!.pool.includes(cardId)) return;
    home(1);
    this.set({ ...e, kept: cardId });
    const l = this.ledger(); const last = l[l.length - 1];
    if (last && last.seed === e.seed) { l[l.length - 1] = { ...last, kept: cardId }; this.storage?.setItem(LEDGER_KEY, JSON.stringify(l)); }
    this.emit();
  }
  /** Leave a finished event: the save is cleared (the ledger keeps it). */
  leave(): void { if (this.event?.phase === "over") this.abandon(); }
}
