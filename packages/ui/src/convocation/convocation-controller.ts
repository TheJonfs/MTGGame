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
  CONVOCATION_NAMES, EVENT_SAVE_KEY, LEDGER_KEY, MatchSeries, SEALED_PLANE, addCopy, advanceEvent, buildLimitedDeck, checkEventDeck, closeRound, defaultKnobs, deserializeEvent,
  ledgerEntry, lifeModifiers, newSealedEvent, pairingOf, playFieldRound, poolCollection, recordSeries, registerDeck, removeCopy, resultOf, roundComplete, saveCurrentSeries,
  serializeEvent, seriesSeed, seriesSetup, standings, type CardRatingTable, type Catalog, type ConvocationEvent, type ConvocationLedgerEntry, type ConvocationPackData,
  type Decklist, type SeatAgents, type Standing,
} from "@shandalar/world";
import { MatchController } from "../play/match-controller.js";
import type { DeckEditorHost } from "../components/deck-editor-host.js";

export type ConvocationScreen =
  | { kind: "door" }
  | { kind: "build"; sideboarding: boolean }
  | { kind: "pairings" }
  | { kind: "playDraw" }
  | { kind: "match" }
  | { kind: "between" }
  | { kind: "field" }
  | { kind: "standings" }
  | { kind: "prize" };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class ConvocationController {
  event: ConvocationEvent | null = null;
  screen: ConvocationScreen = { kind: "door" };
  /** The editor's draft (the build and the sideboarding). */
  draft: Decklist = [];
  notice: string | null = null;
  series: MatchSeries | null = null;
  match: MatchController | null = null;
  /** The last field round's wall time on the main thread, ms (S47 Concern 4: measured, shown in the dev line). */
  fieldMs: number | null = null;
  readonly knobs = defaultKnobs();
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
  private set(event: ConvocationEvent): void { this.event = event; this.save(); }

  hasSave(): boolean { return !!this.event; }
  ledger(): ConvocationLedgerEntry[] {
    try { const raw = this.storage?.getItem(LEDGER_KEY); const l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; } catch { return []; }
  }

  // ---------- the door ----------

  newEvent(seed: number = Math.floor(Math.random() * 1_000_000)): void {
    const faces = this.catalog.opponents.map((o) => ({ portrait: o.portrait, colors: o.colorsPhaseTwo ?? o.colors }));
    this.set(newSealedEvent({ seed, format: SEALED_PLANE, names: CONVOCATION_NAMES, faces }, { cards: this.pool, packs: this.packs, rating: this.rating }));
    this.series = null; this.match = null;
    this.openBuild(false);
  }
  /** Back to where the saved event stands. */
  resume(): void {
    const e = this.event; if (!e) return;
    this.series = null; this.match = null;
    if (e.phase === "build") return this.openBuild(false);
    if (e.phase === "standings") { this.screen = { kind: "standings" }; return this.emit(); }
    if (e.phase === "over") { this.screen = { kind: "prize" }; return this.emit(); }
    const mine = pairingOf(e, 0);
    if (e.current && mine && mine.b !== null) { this.series = new MatchSeries({ seed: seriesSeed(e, mine.a, mine.b), games: e.current.games }); this.screen = { kind: "between" }; return this.emit(); }
    if (resultOf(e, e.round, 0) && !roundComplete(e)) { this.screen = { kind: "field" }; this.emit(); void this.finishRound(); return; }
    this.screen = { kind: "pairings" }; this.emit();
  }
  abandon(): void { this.event = null; this.series = null; this.match = null; this.storage?.removeItem(EVENT_SAVE_KEY); this.screen = { kind: "door" }; this.emit(); }
  toDoor(): void { this.screen = { kind: "door" }; this.emit(); }

  // ---------- the pool and the build (the editor's source) ----------

  private openBuild(sideboarding: boolean): void {
    const me = this.event!.field[0]!;
    this.draft = me.deck.map((e) => ({ ...e })); this.notice = null;
    this.screen = { kind: "build", sideboarding }; this.emit();
  }
  openSideboard(): void { if (this.event && this.series && !this.series.done) this.openBuild(true); }
  editorLegality() { return checkEventDeck(this.event!, 0, this.draft, this.pool); }
  /** The builder's deck for the player's pool — a starting point, not a registration. */
  suggestDeck(): void { if (!this.event) return; this.draft = buildLimitedDeck(this.event.field[0]!.pool, this.rating, this.pool).deck; this.notice = null; this.emit(); }
  editorHost(): DeckEditorHost | null {
    const e = this.event; if (!e || this.screen.kind !== "build") return null;
    const me = e.field[0]!, collection = poolCollection(me.pool), sideboarding = this.screen.sideboarding;
    const edit = (r: ReturnType<typeof addCopy>) => { if (r.ok) { this.draft = r.deck; this.notice = null; } else this.notice = r.reason; this.emit(); };
    const host: DeckEditorHost = {
      title: sideboarding ? "Sideboard — your pool" : "Your pool — build forty",
      draft: this.draft, name: SEALED_PLANE.name, notice: this.notice,
      source: { collection, savedDeck: me.deck, activeDeckName: SEALED_PLANE.name },
      legality: () => this.editorLegality(),
      add: (id: string) => edit(addCopy(collection, this.draft, id, Infinity)),
      remove: (id: string) => edit(removeCopy(this.draft, id)),
      reset: () => { this.draft = me.deck.map((x) => ({ ...x })); this.notice = null; this.emit(); },
      save: () => this.register(),
      saveLabel: sideboarding ? "Keep this deck" : "Register the deck",
      ...(sideboarding ? { close: () => { this.screen = { kind: "between" }; this.emit(); }, closeLabel: "Cancel" } : {}),
      sparesLabel: sideboarding ? "Sideboard" : "The pool",
    };
    return host;
  }
  /** Register the deck (the build) or keep the sideboarded deck (between games). An illegal draft is refused. */
  register(): void {
    const e = this.event; if (!e || this.screen.kind !== "build") return;
    const r = registerDeck(e, 0, this.draft, this.pool);
    if (!r.ok) { this.notice = r.problems.join("; "); return this.emit(); }
    const sideboarding = this.screen.sideboarding;
    this.set(r.event);
    this.screen = sideboarding ? { kind: "between" } : { kind: "pairings" };
    this.emit();
  }

  // ---------- the series over the match ----------

  opponentSeat(): number | null { const p = this.event ? pairingOf(this.event, 0) : undefined; return p && p.b !== null ? (p.a === 0 ? p.b : p.a) : null; }
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
    const game = s.nextGame(choice), me = e.field[0]!, them = e.field[opp]!, setup = seriesSetup(e, 0, opp, this.knobs);
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
      if (s.done) void this.finishSeries();
      else { this.set(saveCurrentSeries(this.event!, s.state())); this.screen = { kind: "between" }; this.emit(); }
    });
  }

  /** The human's series is done: record it, then the field's series (headless, here), then the standings. */
  private async finishSeries(): Promise<void> {
    const opp = this.opponentSeat()!;
    this.set(recordSeries(this.event!, 0, opp, this.series!.state()));
    this.screen = { kind: "field" }; this.emit();
    await this.finishRound();
  }
  private async finishRound(): Promise<void> {
    await new Promise((r) => setTimeout(r, 30)); // let the screen paint before the main thread is taken
    const agents: SeatAgents = (seat, opponent, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, this.pool, difficultyProfile("master", seat.archetype, opponent.deck));
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const played = await playFieldRound(this.event!, { cards: this.pool, knobs: this.knobs }, agents);
    this.fieldMs = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : null;
    this.set(closeRound(played));
    this.series = null; this.match = null;
    this.screen = { kind: "standings" }; this.emit();
  }

  /** From the standings: the next round's pairings, or the finish (the ledger's line, written once). */
  next(): void {
    const e = this.event; if (!e || e.phase !== "standings") return;
    let n = advanceEvent(e);
    if (n.phase === "over" && !n.ledgered) { this.writeLedger(n); n = { ...n, ledgered: true }; }
    this.set(n);
    this.screen = n.phase === "over" ? { kind: "prize" } : { kind: "pairings" };
    this.emit();
  }
  private writeLedger(e: ConvocationEvent): void { this.storage?.setItem(LEDGER_KEY, JSON.stringify([...this.ledger(), ledgerEntry(e, this.now())])); }
  /** The prize placeholder (ADR-147): a card from the pool to keep — recorded on the event and its ledger line. */
  keep(cardId: string): void {
    const e = this.event; if (!e || e.phase !== "over" || e.kept || !e.field[0]!.pool.includes(cardId)) return;
    this.set({ ...e, kept: cardId });
    const l = this.ledger(); const last = l[l.length - 1];
    if (last && last.seed === e.seed) { l[l.length - 1] = { ...last, kept: cardId }; this.storage?.setItem(LEDGER_KEY, JSON.stringify(l)); }
    this.emit();
  }
  /** Leave a finished event: the save is cleared (the ledger keeps it). */
  leave(): void { if (this.event?.phase === "over") this.abandon(); }
}
