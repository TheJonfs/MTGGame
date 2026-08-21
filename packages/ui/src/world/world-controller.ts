import type { CardDef } from "@shandalar/cards";
import type { MatchResult } from "@shandalar/engine";
import { DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";
import {
  addCopy,
  advance,
  applyDuelResult,
  buyCard,
  commitDeck,
  deckLegal,
  idx,
  removeCopy,
  deserializeWorld,
  encounterKnobs,
  findPath,
  newWorld,
  opponentTemplate,
  parley,
  regionAt,
  rollShopStock,
  samePoint,
  sellCard,
  syncShopState,
  serializeWorld,
  townAt,
  worldKnobs,
  type Catalog,
  type Decklist,
  type DifficultyName,
  type DuelRecord,
  type Encounter,
  type KnobSource,
  type KnobValues,
  type OpponentTemplate,
  type Point,
  type PreparedDuel,
  type ShopItem,
  type Town,
  type WorldState,
} from "@shandalar/world";
import { MatchController } from "../play/match-controller.js";

/**
 * WorldController (S13): the overworld's interaction brain — React-free, like
 * MatchController. Owns the WorldState, drives the frozen S12 journey API,
 * launches duels through the play client's `custom` path, and narrates the
 * consequences. The acceptance test drives these methods; the screens call
 * the same ones.
 */

export const SAVE_KEY = "shandalar-world-save";

export type WorldScreen =
  | { kind: "start" }
  | { kind: "map"; preview: Point[] | null; previewTarget: Point | null; walking: boolean; notice: string | null }
  | { kind: "encounter"; encounter: Encounter; tmpl: OpponentTemplate; knobs: KnobValues; notice: string | null }
  | { kind: "duel"; duel: PreparedDuel; match: MatchController }
  | {
      kind: "duelResult";
      duel: PreparedDuel;
      record: DuelRecord;
      before: { life: number; gold: number };
      after: { life: number; gold: number };
    }
  | { kind: "town"; town: Town; stock: ShopItem[]; notice: string | null }
  | { kind: "collection"; back: "map" | "town" }
  | {
      /** S14 Part 2: the deck editor — a DRAFT decklist; commit only when legal (ADR-065). */
      kind: "editor";
      back: "map" | "town";
      draft: Decklist;
      name: string;
      notice: string | null;
    }
  | { kind: "gameOver"; fatal: DuelRecord | null };

export interface NewGameChoice {
  starterDeck: DeckKey;
  difficulty: DifficultyName;
  seed?: number;
  name?: string;
}

export class WorldController {
  world: WorldState | null = null;
  screen: WorldScreen = { kind: "start" };
  /** ms per walked cell (0 in tests). */
  stepMs = 140;
  /** Test hook: extra knob layers (e.g. force encounters). Never set by the UI. */
  extraKnobs: Partial<Record<"region" | "dungeon" | "opponent" | "event", KnobSource>> = {};
  /** Play-client pacing for duels. */
  aiDelayMs = 400;
  private listeners = new Set<() => void>();
  private walkToken = 0;
  private lastTown: Town | null = null;
  /** S14 rider: the path left unwalked when an encounter interrupted (resume with one click). */
  resumePath: Point[] | null = null;

  constructor(
    readonly pool: Map<string, CardDef>,
    readonly catalog: Catalog,
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null,
  ) {
    // Dev handle (like __mc) for console/driver use.
    (globalThis as { __wc?: WorldController }).__wc = this;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  get knobs(): KnobValues {
    return worldKnobs(this.world!, this.extraKnobs);
  }

  // ---------- shell ----------

  newGame(choice: NewGameChoice): void {
    const seed = choice.seed ?? Math.floor(Math.random() * 1_000_000);
    this.world = newWorld({ seed, catalog: this.catalog, starterDeck: choice.starterDeck, difficulty: choice.difficulty, playerName: choice.name ?? "You" });
    this.lastTown = townAt(this.world.map, this.world.player.position);
    this.autosave();
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `You set out from ${this.lastTown?.name ?? "the road"}.` };
    this.emit();
  }

  hasAutosave(): boolean {
    return !!this.storage?.getItem(SAVE_KEY);
  }

  continueFromAutosave(): boolean {
    const text = this.storage?.getItem(SAVE_KEY);
    if (!text) return false;
    this.loadText(text);
    return true;
  }

  loadText(text: string): void {
    this.world = deserializeWorld(text);
    if (this.world.gameOver) {
      this.screen = { kind: "gameOver", fatal: this.world.duels[this.world.duels.length - 1] ?? null };
    } else {
      const town = townAt(this.world.map, this.world.player.position);
      this.screen = town
        ? { kind: "town", town, stock: rollShopStock(this.world, town, this.pool, this.knobs), notice: "Loaded." }
        : { kind: "map", preview: null, previewTarget: null, walking: false, notice: "Loaded." };
    }
    this.emit();
  }

  saveText(): string {
    if (!this.world) throw new Error("no world");
    return serializeWorld(this.world);
  }

  /** Manual save = autosave slot (plus the UI's download). */
  save(): void {
    this.autosave();
    this.notice("Saved.");
  }

  private autosave(): void {
    if (!this.world) return;
    this.storage?.setItem(SAVE_KEY, serializeWorld(this.world));
  }

  private notice(text: string | null): void {
    if (this.screen.kind === "map" || this.screen.kind === "town" || this.screen.kind === "encounter") this.screen = { ...this.screen, notice: text };
    this.emit();
  }

  // ---------- map ----------

  regionName(): string {
    return this.world ? regionAt(this.world.map, this.world.player.position).name : "";
  }

  /** First click previews the BFS path; clicking the previewed cell walks it. */
  clickCell(p: Point): void {
    if (!this.world || this.screen.kind !== "map" || this.screen.walking) return;
    if (this.screen.previewTarget && samePoint(this.screen.previewTarget, p) && this.screen.preview) {
      void this.walk(this.screen.preview);
      return;
    }
    const path = findPath(this.world.map, this.world.player.position, p);
    this.screen = { ...this.screen, preview: path, previewTarget: path ? p : null, notice: path ? null : "No path there." };
    this.emit();
  }

  /** Walk a path one cell at a time (each cell one step); encounters interrupt. */
  async walk(path: Point[]): Promise<void> {
    if (!this.world || this.screen.kind !== "map") return;
    const token = ++this.walkToken;
    this.screen = { ...this.screen, walking: true, notice: null };
    this.emit();
    for (const [i, cell] of path.entries()) {
      if (token !== this.walkToken || !this.world) return;
      const events = advance(this.world, this.catalog, [cell], this.extraKnobs);
      // Trim the preview to what's left (round 3: the polyline from the
      // current position back to the path's start drew a stray diagonal).
      if (this.screen.kind === "map") this.screen = { ...this.screen, preview: path.slice(i + 1) };
      this.emit();
      for (const e of events) {
        if (e.type === "encounter") {
          this.resumePath = path.slice(i + 1);
          const tmpl = opponentTemplate(this.catalog, this.world.opponents.find((o) => o.id === e.encounter.opponentId)!);
          this.screen = { kind: "encounter", encounter: e.encounter, tmpl, knobs: encounterKnobs(this.world, this.catalog, e.encounter, this.extraKnobs), notice: null };
          this.emit();
          return;
        }
        if (e.type === "arrived") {
          this.enterTown(e.town);
          return;
        }
      }
      if (this.stepMs > 0) await new Promise((r) => setTimeout(r, this.stepMs));
    }
    if (token === this.walkToken && this.screen.kind === "map") {
      this.resumePath = null;
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
      this.emit();
    }
  }

  /** S14 rider: after a parley, re-preview what was left of the walk (one more click walks it). */
  resumeWalk(): void {
    if (!this.world || this.screen.kind !== "map" || !this.resumePath || this.resumePath.length === 0) return;
    const path = this.resumePath.filter((p) => this.world!.map.passable[idx(this.world!.map, p)]);
    const target = path[path.length - 1] ?? null;
    this.screen = { ...this.screen, preview: path, previewTarget: target, notice: target ? `Resume: ${path.length} steps left — click the destination to continue.` : null };
    this.resumePath = null;
    this.emit();
  }

  // ---------- S14 Part 2: deck editor ----------

  /** Editor entry: anywhere outside an encounter/duel (clock-free by principle). */
  canEdit(): { ok: boolean; reason?: string } {
    if (!this.world) return { ok: false, reason: "no world" };
    switch (this.screen.kind) {
      case "encounter": return { ok: false, reason: "not while parleying" };
      case "duel": return { ok: false, reason: "not during a duel" };
      case "duelResult": return { ok: false, reason: "finish the result first" };
      case "gameOver": return { ok: false, reason: "the journey is over" };
      default: return { ok: true };
    }
  }

  openEditor(): void {
    if (!this.world || !this.canEdit().ok) return;
    const back = this.screen.kind === "town" || (this.screen.kind === "collection" && this.screen.back === "town") ? "town" : "map";
    this.screen = { kind: "editor", back, draft: this.world.player.activeDeck.map((e) => ({ ...e })), name: this.world.deckName, notice: null };
    this.emit();
  }

  editorAdd(cardId: string): void {
    if (!this.world || this.screen.kind !== "editor") return;
    const r = addCopy(this.world.player.collection, this.screen.draft, cardId);
    this.screen = r.ok ? { ...this.screen, draft: r.deck, notice: null } : { ...this.screen, notice: `Can't add: ${r.reason}` };
    this.emit();
  }

  editorRemove(cardId: string): void {
    if (this.screen.kind !== "editor") return;
    const r = removeCopy(this.screen.draft, cardId);
    this.screen = r.ok ? { ...this.screen, draft: r.deck, notice: null } : { ...this.screen, notice: `Can't remove: ${r.reason}` };
    this.emit();
  }

  editorRename(name: string): void {
    if (this.screen.kind !== "editor") return;
    this.screen = { ...this.screen, name };
    this.emit();
  }

  /** Legality of the current draft (the Save button's reason). */
  editorLegality(): { ok: boolean; reason?: string } {
    if (this.screen.kind !== "editor") return { ok: false, reason: "no draft" };
    return deckLegal(this.screen.draft);
  }

  /** Commit the draft (legal only — ADR-065); returns to where the editor was opened from. */
  editorSave(): boolean {
    if (!this.world || this.screen.kind !== "editor") return false;
    const r = commitDeck(this.world, this.screen.draft, this.screen.name);
    if (!r.ok) {
      this.screen = { ...this.screen, notice: `Not saved: ${r.reason}` };
      this.emit();
      return false;
    }
    this.autosave();
    this.editorClose();
    return true;
  }

  editorClose(): void {
    if (!this.world || this.screen.kind !== "editor") return;
    if (this.screen.back === "town" && this.lastTown) this.enterTown(this.lastTown);
    else {
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
      this.emit();
    }
  }

  // ---------- town ----------

  enterTown(town: Town): void {
    if (!this.world) return;
    this.lastTown = town;
    // S14 v2: visits + lastTownIndex + shop epoch sync, then autosave (brief Part 4).
    this.world.visits[town.index] = (this.world.visits[town.index] ?? 0) + 1;
    this.world.lastTownIndex = town.index;
    syncShopState(this.world, town, this.knobs);
    this.autosave();
    const first = this.world.visits[town.index] === 1;
    this.screen = { kind: "town", town, stock: rollShopStock(this.world, town, this.pool, this.knobs), notice: first ? `First time in ${town.name}.` : null };
    this.emit();
  }

  buy(item: ShopItem, toDeck = false): void {
    if (!this.world || this.screen.kind !== "town") return;
    const { town } = this.screen;
    const r = buyCard(this.world, town, item, this.knobs, toDeck);
    if (r.ok) this.autosave(); // gold spent is permanent the moment it lands
    const name = this.pool.get(item.cardId)?.name ?? item.cardId;
    this.screen = {
      ...this.screen,
      stock: rollShopStock(this.world, town, this.pool, this.knobs), // depletion shows immediately
      notice: r.ok
        ? `Bought ${name} for ${r.price} gold${r.addedToDeck ? " — added to your deck" : r.note ? ` (${r.note})` : ""}.`
        : `Can't buy: ${r.reason}`,
    };
    this.emit();
  }

  /** S14 Part 3: sell one spare copy at half price (never basics, never deck copies). */
  sell(cardId: string): void {
    if (!this.world || this.screen.kind !== "town") return;
    const r = sellCard(this.world, this.pool, cardId, this.knobs);
    if (r.ok) this.autosave();
    this.screen = { ...this.screen, notice: r.ok ? `Sold ${this.pool.get(cardId)?.name ?? cardId} for ${r.gold} gold.` : `Can't sell: ${r.reason}` };
    this.emit();
  }

  leaveTown(): void {
    if (this.screen.kind !== "town") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
  }

  openCollection(): void {
    if (this.screen.kind === "map") this.screen = { kind: "collection", back: "map" };
    else if (this.screen.kind === "town") this.screen = { kind: "collection", back: "town" };
    else if (this.screen.kind === "editor") this.screen = { kind: "collection", back: this.screen.back };
    else return;
    this.emit();
  }

  closeCollection(): void {
    if (this.screen.kind !== "collection" || !this.world) return;
    if (this.screen.back === "town" && this.lastTown) this.enterTown(this.lastTown);
    else {
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
      this.emit();
    }
  }

  // ---------- parley + duel ----------

  parley(choice: "fight" | "flee" | "buyoff"): void {
    if (!this.world || this.screen.kind !== "encounter") return;
    const { encounter } = this.screen;
    const out = parley(this.world, this.catalog, encounter, choice, this.extraKnobs);
    switch (out.type) {
      case "boughtOff":
        this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `You paid ${out.goldPaid} gold and they let you pass.` };
        break;
      case "refused":
        this.screen = { ...this.screen, notice: out.reason };
        break;
      case "fled":
        this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `You got away — but your stake is gone: ${out.anteLost.map((id) => this.pool.get(id)?.name ?? id).join(", ")}.` };
        break;
      case "fleeFailed": {
        // Caught: you fight, and the duel stakes again (ADR-063 compounding).
        const again = parley(this.world, this.catalog, encounter, "fight", this.extraKnobs);
        if (again.type === "fight") this.startDuel(again.duel, `Caught! Your flee stake is gone (${out.anteLost.map((id) => this.pool.get(id)?.name ?? id).join(", ")}) — and now you fight.`);
        return;
      }
      case "fight":
        this.startDuel(out.duel, null);
        return;
    }
    this.emit();
  }

  private startDuel(duel: PreparedDuel, _notice: string | null): void {
    if (!this.world) return;
    const tmpl = this.catalog.opponents.find((o) => o.id === duel.encounter.catalogId)!;
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: duel.seed,
      aiDelayMs: this.aiDelayMs,
      custom: {
        human: { name: this.world.player.name, decklist: duel.spec.players[0].decklist },
        enemy: { name: tmpl.name, decklist: duel.spec.players[1].decklist, difficulty: tmpl.difficulty, archetype: DECK_ARCHETYPES[tmpl.deck], portrait: tmpl.portrait },
        rules: { startingLife: duel.spec.rules.startingLife, ante: duel.spec.rules.ante ?? 0 },
        modifiers: duel.spec.modifiers,
      },
    });
    this.screen = { kind: "duel", duel, match };
    this.emit();
    void match.start().then((result) => this.finishDuel(duel, result));
  }

  private finishDuel(duel: PreparedDuel, result: MatchResult): void {
    if (!this.world) return;
    const before = { life: this.world.player.worldLife, gold: this.world.player.gold };
    const record = applyDuelResult(this.world, this.catalog, duel, result, this.extraKnobs);
    const after = { life: this.world.player.worldLife, gold: this.world.player.gold };
    this.autosave(); // consequences are permanent the moment they land
    this.screen = { kind: "duelResult", duel, record, before, after };
    this.emit();
  }

  /** Leave the result screen: back to the map, or game over at the floor. */
  continueAfterDuel(): void {
    if (!this.world || this.screen.kind !== "duelResult") return;
    if (this.world.gameOver) this.screen = { kind: "gameOver", fatal: this.screen.record };
    else this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
  }

  /** The current match (if any) — the duel screen mounts PlayMatch on it. */
  get match(): MatchController | null {
    return this.screen.kind === "duel" ? this.screen.match : null;
  }
}
