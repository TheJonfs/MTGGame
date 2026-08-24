import type { CardDef } from "@shandalar/cards";
import type { MatchResult } from "@shandalar/engine";
import {
  activeDeck,
  addCopy,
  advance,
  applyDuelResult,
  buyCard,
  commitDeck,
  createDeck,
  deckLegal,
  deleteDeck,
  duplicateDeck,
  idx,
  removeCopy,
  switchDeck,
  visibleRoamers,
  deserializeWorld,
  encounterKnobs,
  findPath,
  isExplored,
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
  type StarterId,
  type Town,
  type WorldState,
} from "@shandalar/world";
import { MatchController } from "../play/match-controller.js";
import { abandonQuest, acceptQuest, cardMatches, creditRenown, questsOnArrival, spares, townOffers, type ActiveQuest, type QuestOffer } from "@shandalar/world";
import {
  applyInteriorDuel, clearDungeon, colorPrizeRoll, dungeonAdvance, dungeonAsWorldMap, dungeonDuelSpec, dungeonPath,
  generateDungeonRun, lairPrizeRoll, reachedTiers, resetDungeon, type DungeonRun, type MoxDungeonDef,
} from "@shandalar/world";
import { GUARDIAN_DECKS } from "@shandalar/sim/guardian-decks";
import { WorldRng as DungeonRng } from "@shandalar/world";

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
  /** S20: the dungeon threshold — stakes stated before the choice (dungeon-design §4). */
  | { kind: "dungeonTelegraph"; info: { dungeonId: string; kind: "mox" | "lair"; name: string; at: Point; residentCatalogId?: string }; notice: string | null }
  /** S20: inside a dungeon (world.activeDungeon is the run). */
  | { kind: "dungeon"; notice: string | null; walking: boolean }
  /** S20: an interior duel (minion or guardian) — mounts PlayMatch like a world duel. */
  | { kind: "dungeonDuel"; enemyName: string; match: MatchController; against: { minionId?: string; guardian?: boolean } }
  /** S20: the guardian fell — the escrow + prize payout ceremony. */
  | { kind: "dungeonVictory"; name: string; paidGold: number; paidCards: string[] }
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
  /** S16: catalog starter id (white|blue|black|red|green). */
  starter: StarterId;
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
    this.world = newWorld({ seed, catalog: this.catalog, starter: choice.starter, difficulty: choice.difficulty, playerName: choice.name ?? "You" });
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
    } else if (this.world.activeDungeon) {
      // S20 durability: reloading RESUMES mid-dungeon — quitting is not walking out (the escrow holds).
      this.screen = { kind: "dungeon", notice: "You are where you stood — the halls remember, and so does the escrow.", walking: false };
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

  /** S18 fog: a cell is walkable for PLANNING if it is known passable or not yet explored
   *  (the plan may not use knowledge the player doesn't have — "invitation, not information").
   *  The walk re-plans when a fogged cell turns out to be rough ground. */
  private plannable(p: Point): boolean {
    const w = this.world!;
    if (w.explored && !isExplored(w.explored, w.map, p)) return true;
    return w.map.passable[idx(w.map, p)]!;
  }

  /** Plan a path with the player's knowledge (fog-honest); null if none. */
  planPath(to: Point): Point[] | null {
    if (!this.world) return null;
    return findPath(this.world.map, this.world.player.position, to, (q) => this.plannable(q));
  }

  /** First click previews the BFS path; clicking the previewed cell walks it. */
  clickCell(p: Point): void {
    if (!this.world || this.screen.kind !== "map" || this.screen.walking) return;
    if (this.screen.previewTarget && samePoint(this.screen.previewTarget, p) && this.screen.preview) {
      void this.walk(this.screen.preview, p);
      return;
    }
    const path = this.planPath(p);
    this.screen = { ...this.screen, preview: path, previewTarget: path ? p : null, notice: path ? null : "No path there." };
    this.emit();
  }

  /** Walk a path one cell at a time (each cell one step); encounters interrupt.
   *  S18 fog: if the next cell was planned through fog and turns out impassable, re-plan
   *  to the destination with what is now known; stop with a notice if no way remains. */
  async walk(path: Point[], destination?: Point): Promise<void> {
    if (!this.world || this.screen.kind !== "map") return;
    const token = ++this.walkToken;
    this.screen = { ...this.screen, walking: true, notice: null };
    this.emit();
    const dest = destination ?? path[path.length - 1];
    for (let i = 0; i < path.length; i++) {
      let cell = path[i]!;
      if (token !== this.walkToken || !this.world) return;
      if (!this.world.map.passable[idx(this.world.map, cell)]) {
        const replan = dest ? this.planPath(dest) : null;
        if (!replan || replan.length === 0) {
          this.resumePath = null;
          this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "Rough ground — no way through from here." };
          this.emit();
          return;
        }
        path = replan; i = 0; cell = path[0]!;
        if (this.screen.kind === "map") this.screen = { ...this.screen, preview: path, previewTarget: dest ?? null, notice: "Rough ground ahead — going around." };
        this.emit();
      }
      const events = advance(this.world, this.catalog, [cell], this.extraKnobs);
      // Trim the preview to what's left (round 3: the polyline from the
      // current position back to the path's start drew a stray diagonal).
      if (this.screen.kind === "map") this.screen = { ...this.screen, preview: path.slice(i + 1) };
      this.emit();
      for (const e of events) {
        if (e.type === "questExpired") {
          this.autosave(); // durability: expiry is a consequence
          if (this.screen.kind === "map") this.screen = { ...this.screen, notice: `A quest expired: ${e.text}` };
        }
        if (e.type === "dungeonEntry") {
          this.resumePath = path.slice(i + 1);
          this.screen = { kind: "dungeonTelegraph", info: { dungeonId: e.dungeonId, kind: e.kind, name: e.name, at: e.at, ...(e.residentCatalogId ? { residentCatalogId: e.residentCatalogId } : {}) }, notice: null };
          this.emit();
          return;
        }
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
    const target = this.resumePath[this.resumePath.length - 1] ?? null;
    const path = target ? this.planPath(target) ?? [] : [];
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
    this.screen = { kind: "editor", back, draft: activeDeck(this.world).map((e) => ({ ...e })), name: this.world.activeDeckName, notice: null };
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

  /** Discard draft changes: back to the saved deck and name. */
  editorReset(): void {
    if (!this.world || this.screen.kind !== "editor") return;
    this.screen = { ...this.screen, draft: activeDeck(this.world).map((e) => ({ ...e })), name: this.world.activeDeckName, notice: "Draft reset to the saved deck." };
    this.emit();
  }

  editorRename(name: string): void {
    if (this.screen.kind !== "editor") return;
    this.screen = { ...this.screen, name };
    this.emit();
  }

  // ---------- S16 (v3): the deck picker — new / duplicate / switch / delete ----------

  /** Saved deck names (the active one first is the UI's job; order = insertion). */
  deckNames(): string[] {
    return this.world ? Object.keys(this.world.decks) : [];
  }

  private deckOp(r: { ok: true } | { ok: false; reason: string }, okNotice: string): boolean {
    if (!this.world) return false;
    if (this.screen.kind === "editor") this.screen = r.ok ? { ...this.screen, draft: activeDeck(this.world).map((e) => ({ ...e })), name: this.world.activeDeckName, notice: okNotice } : { ...this.screen, notice: r.reason };
    else if ("notice" in this.screen) this.screen = { ...this.screen, notice: r.ok ? okNotice : r.reason };
    if (r.ok) this.autosave();
    this.emit();
    return r.ok;
  }

  /** New blank deck (30 basics) — becomes the active deck so the editor opens on it. */
  deckNew(name: string): boolean {
    if (!this.world) return false;
    const r = createDeck(this.world, name);
    if (r.ok) switchDeck(this.world, name.trim());
    return this.deckOp(r, `New deck "${name.trim()}" — 30 ${this.world.player.basicLand}s to start from.`);
  }

  deckDuplicate(name: string): boolean {
    if (!this.world) return false;
    const r = duplicateDeck(this.world, this.world.activeDeckName, name);
    if (r.ok) switchDeck(this.world, name.trim());
    return this.deckOp(r, `Duplicated as "${name.trim()}".`);
  }

  deckSwitch(name: string): boolean {
    if (!this.world) return false;
    return this.deckOp(switchDeck(this.world, name), `"${name}" is now your deck.`);
  }

  deckDelete(name: string): boolean {
    if (!this.world) return false;
    return this.deckOp(deleteDeck(this.world, name), `Deleted "${name}".`);
  }

  /** S16: roamers the player can see right now (map chips). */
  visibleRoamers() {
    return this.world ? visibleRoamers(this.world, this.catalog, this.knobs) : [];
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
    // S19: courier deliveries complete on arrival (autosave below covers them — durability on complete).
    const done = questsOnArrival(this.world, town, this.knobs);
    this.autosave();
    const first = this.world.visits[town.index] === 1;
    // S19 round 2 (Chris): completion gets a POPUP, not just a notice line.
    if (done.length) this.questPopup = done.filter((e) => e.type === "questDone").map((e) => ({ title: "Quest complete", quest: e.quest.text, reward: e.rewardText }));
    this.screen = { kind: "town", town, stock: rollShopStock(this.world, town, this.pool, this.knobs), notice: first ? `First time in ${town.name}.` : null };
    this.emit();
  }

  /** S19 round 2: pending completion announcements (modal over whatever screen is up). */
  questPopup: { title: string; quest: string; reward: string }[] | null = null;
  dismissQuestPopup(): void {
    this.questPopup = null;
    this.emit();
  }

  /** S19 round 2 (Chris): quests mark WHERE TO GO — a courier's destination town (the quest-giver told
   * you the way, so the mark shows even through fog), a bounty's named region until first sighting,
   * then the trailing last-seen mark. */
  questMarks(): { at: Point; label: string }[] {
    if (!this.world) return [];
    const w = this.world;
    const marks: { at: Point; label: string }[] = [];
    for (const q of w.quests.active) {
      if ((q.kind === "courier" || q.kind === "cardCourier") && q.toTown !== undefined) {
        const t = w.map.towns.find((x) => x.index === q.toTown);
        if (t) marks.push({ at: t.at, label: `${t.name} · delivery` });
      }
      if (q.kind === "bounty") {
        if (q.bountySeenAt) marks.push({ at: q.bountySeenAt, label: `${this.catalog.opponents.find((o) => o.id === q.bountyCatalogId)?.name ?? "bounty"} · last seen` });
        else if (q.bountyRegion !== undefined) {
          const r = w.map.regions[q.bountyRegion];
          if (r) marks.push({ at: r.heart, label: `${r.name} · last marked` });
        }
      }
    }
    return marks;
  }

  // ---------- S19 quests ----------

  /** Offers on the current town's board (already excludes taken ones). */
  townQuestOffers(): QuestOffer[] {
    if (!this.world || this.screen.kind !== "town") return [];
    return townOffers(this.world, this.catalog, this.screen.town, this.knobs, this.pool);
  }

  /** Spares that satisfy a card-courier's want (the picker's options). */
  questCardOptions(offer: QuestOffer): string[] {
    if (!this.world || !offer.cardWanted) return [];
    const sp = spares(this.world.player.collection, activeDeck(this.world));
    return Object.keys(sp).filter((id) => (sp[id] ?? 0) > 0 && !!this.pool.get(id) && cardMatches(this.pool.get(id)!, offer.cardWanted!)).sort();
  }

  acceptQuest(offer: QuestOffer, cardId?: string): void {
    if (!this.world || this.screen.kind !== "town") return;
    const r = acceptQuest(this.world, this.catalog, offer, this.knobs, this.pool, cardId);
    if (r.ok) this.autosave(); // durability: accepted quests (and a departed card) survive a reload
    this.screen = { ...this.screen, notice: r.ok ? `Taken: ${offer.text}${r.quest.deadlineStep !== undefined ? ` (${offer.deadlineSteps} steps)` : ""}` : `Can't take that: ${r.reason}` };
    this.emit();
  }

  abandonQuest(questId: string): void {
    if (!this.world) return;
    if (abandonQuest(this.world, questId)) {
      this.autosave();
      this.notice("Quest abandoned.");
    }
    this.emit();
  }

  /** Active quests with presentation helpers (the rail panel reads this). */
  activeQuests(): { quest: ActiveQuest; stepsLeft: number | null; destName: string | null; targetName: string | null }[] {
    if (!this.world) return [];
    const w = this.world;
    return w.quests.active.map((q) => ({
      quest: q,
      stepsLeft: q.deadlineStep !== undefined ? Math.max(0, q.deadlineStep - w.player.stepsTaken) : null,
      destName: q.toTown !== undefined ? w.map.towns.find((t) => t.index === q.toTown)?.name ?? null : null,
      targetName: q.bountyCatalogId ? this.catalog.opponents.find((o) => o.id === q.bountyCatalogId)?.name ?? null : null,
    }));
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
        enemy: { name: tmpl.name, decklist: duel.spec.players[1].decklist, difficulty: tmpl.difficulty, archetype: duel.enemy.archetype, portrait: tmpl.portrait },
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

  // ---------- S20: dungeons ----------

  /** The active run (only while inside). */
  get dungeonRun(): DungeonRun | null {
    return this.world?.activeDungeon ?? null;
  }

  moxDef(dungeonId: string): MoxDungeonDef | undefined {
    return this.catalog.dungeons.find((d) => d.id === dungeonId);
  }

  /** Enter from the telegraph: resume the saved run if it matches, else generate. Autosave at entry. */
  enterDungeon(): void {
    if (!this.world || this.screen.kind !== "dungeonTelegraph") return;
    const { info } = this.screen;
    let run = this.world.activeDungeon;
    if (!run || run.dungeonId !== info.dungeonId) {
      const color = (this.moxDef(info.dungeonId)?.color ?? this.catalog.opponents.find((o) => o.id === info.residentCatalogId)?.spoke ?? "G") as "W" | "U" | "B" | "R" | "G";
      run = generateDungeonRun(this.world, this.catalog, this.knobs, this.pool, {
        dungeonId: info.dungeonId,
        kind: info.kind,
        color,
        enteredFrom: { ...this.world.player.position },
        ...(info.residentCatalogId ? { residentCatalogId: info.residentCatalogId, small: true } : {}),
      });
      this.world.activeDungeon = run;
    }
    this.autosave(); // durability: entry is a consequence; reloading resumes mid-dungeon
    this.screen = { kind: "dungeon", notice: `You descend into ${info.name}.`, walking: false };
    this.emit();
  }

  declineDungeon(): void {
    if (this.screen.kind !== "dungeonTelegraph") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
  }

  /** Interior click-to-walk (fog-honest planning; instant, the interior is small). */
  dungeonClick(p: Point): void {
    if (!this.world || this.screen.kind !== "dungeon" || this.screen.walking) return;
    const run = this.world.activeDungeon;
    if (!run) return;
    const path = dungeonPath(run, p);
    if (!path || path.length === 0) return;
    void this.dungeonWalk(path);
  }

  private async dungeonWalk(path: Point[]): Promise<void> {
    if (!this.world || this.screen.kind !== "dungeon") return;
    const run = this.world.activeDungeon!;
    this.screen = { ...this.screen, walking: true };
    this.emit();
    for (const cell of path) {
      if (!this.world || this.screen.kind !== "dungeon") return;
      if (!run.grid.passable[cell.y * run.grid.width + cell.x]) break; // fogged plan met a wall — stop
      const events = dungeonAdvance(run, this.knobs, [cell]);
      this.emit();
      for (const e of events) {
        if (e.type === "treasure") {
          this.autosave(); // escrow is a consequence
          const what = e.treasure.kind === "gold" ? `${e.treasure.gold} gold` : e.treasure.cardName ?? e.treasure.cardId;
          this.screen = { kind: "dungeon", notice: `Escrowed: ${what}. The mountain holds it until the guardian falls.`, walking: true };
          this.emit();
        }
        if (e.type === "minion") {
          this.startInteriorDuel({ minionId: e.minion.id });
          return;
        }
        if (e.type === "guardian") {
          this.startInteriorDuel({ guardian: true });
          return;
        }
      }
      if (this.stepMs > 0) await new Promise((r) => setTimeout(r, this.stepMs));
    }
    if (this.screen.kind === "dungeon") {
      this.screen = { ...this.screen, walking: false };
      this.emit();
    }
  }

  /** Walk out (any time; the design's exit is a choice): forfeit the escrow, reset, back to the map. */
  walkOutOfDungeon(): void {
    if (!this.world) return;
    const run = this.world.activeDungeon;
    if (!run) return;
    resetDungeon(this.world, run);
    this.autosave();
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "You walk out. The mountain keeps what you found; the halls will be watched again." };
    this.emit();
  }

  private startInteriorDuel(against: { minionId?: string; guardian?: boolean }): void {
    if (!this.world) return;
    const run = this.world.activeDungeon!;
    const rng = new DungeonRng(this.world.rng);
    const mox = this.moxDef(run.dungeonId);
    const law = mox?.law.both ?? [];
    let enemy: Parameters<typeof dungeonDuelSpec>[4];
    let portrait: string | undefined;
    if (against.guardian) {
      if (run.kind === "mox" && mox) {
        const g = GUARDIAN_DECKS[mox.guardian.key]!;
        enemy = { kind: "guardian", name: mox.guardian.name, decklist: g.decklist, archetype: g.archetype, life: mox.guardian.life, color: mox.color };
        portrait = mox.guardian.portrait;
      } else {
        const tmpl = this.catalog.opponents.find((o) => o.id === run.residentCatalogId)!;
        const deck = enemyDeckOf(this.catalog, tmpl.deck);
        enemy = { kind: "guardian", name: tmpl.name, decklist: deck.decklist, archetype: deck.archetype, life: tmpl.worldLife, color: (tmpl.spoke ?? "G") as "W" | "U" | "B" | "R" | "G" };
        portrait = tmpl.portrait;
      }
    } else {
      const minion = run.minions.find((m) => m.id === against.minionId)!;
      const tmpl = this.catalog.opponents.find((o) => o.id === minion.catalogId)!;
      enemy = { kind: "minion", tmpl };
      portrait = tmpl.portraitChip ?? tmpl.portrait;
    }
    const { spec, enemyName } = dungeonDuelSpec(this.world, this.catalog, this.knobs, run, enemy, law, rng);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelayMs,
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: enemyName, decklist: spec.players[1].decklist, difficulty: (spec.players[1].agent.split(":")[1] ?? "journeyman") as "apprentice" | "journeyman" | "master", archetype: enemy.kind === "minion" ? "midrange" : enemy.archetype, ...(portrait ? { portrait } : {}) },
        rules: { startingLife: spec.rules.startingLife, ante: spec.rules.ante ?? 0 },
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "dungeonDuel", enemyName, match, against };
    this.emit();
    void match.start().then((result) => this.finishInteriorDuel(against, result));
  }

  private finishInteriorDuel(against: { minionId?: string; guardian?: boolean }, result: MatchResult): void {
    if (!this.world) return;
    const run = this.world.activeDungeon!;
    const out = applyInteriorDuel(this.world, this.knobs, run, result, against.minionId);
    if (out.type === "loss") {
      // §4: forfeit + reset + the normal loss consequences (already applied) + ejection.
      resetDungeon(this.world, run);
      this.autosave();
      if (this.world.gameOver) {
        this.screen = { kind: "gameOver", fatal: null };
      } else {
        this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `Thrown from the dark at a cost: your stake${out.anteLost.length ? ` (${out.anteLost.map((id) => this.pool.get(id)?.name ?? id).join(", ")})` : ""} and a world life. The escrow is forfeit; the halls reset.` };
      }
      this.emit();
      return;
    }
    if (against.guardian) {
      // Victory: payout = escrow + the prize.
      let prize: { gold: number; cardIds: string[] };
      let name: string;
      if (run.kind === "mox") {
        const mox = this.moxDef(run.dungeonId)!;
        const roll = colorPrizeRoll(this.world, this.pool, run.dungeonId, mox.color);
        prize = { gold: 0, cardIds: [mox.prize.mox, mox.prize.guardianCard, ...(roll ? [roll] : [])] };
        name = mox.name;
      } else {
        prize = lairPrizeRoll(this.world, this.pool, run.dungeonId);
        name = "the lair";
        const residentInst = this.world.opponents.find((o) => o.catalogId === run.residentCatalogId && o.fixedAt);
        if (residentInst) {
          residentInst.gone = true;
          residentInst.goneReason = "defeated";
          const tmpl = this.catalog.opponents.find((o) => o.id === residentInst.catalogId);
          creditRenown(this.world.player, tmpl?.colors ?? "", tmpl?.tier ?? 3); // OQ-14: lair boss = its tier; per-colour (S20 playtest)
        }
      }
      const paid = clearDungeon(this.world, run, prize);
      this.autosave();
      this.screen = { kind: "dungeonVictory", name, paidGold: paid.paidGold, paidCards: paid.paidCards };
      this.emit();
      return;
    }
    // Minion win: life carries, ante escrowed; back to the halls.
    this.autosave();
    this.screen = { kind: "dungeon", notice: `The way is clear. Interior life: ${run.interiorLife}. Their stake went to escrow.`, walking: false };
    this.emit();
  }

  continueAfterDungeonVictory(): void {
    if (this.screen.kind !== "dungeonVictory") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "The mountain pays its debts." };
    this.emit();
  }

  /** The empowerment meter (rail): tiers reached + the next threshold. */
  dungeonMeter(): { steps: number; reached: number; nextAt: number | null; life: number; escrowGold: number; escrowCards: string[] } | null {
    const run = this.dungeonRun;
    if (!run) return null;
    const tiers = reachedTiers(run, this.knobs);
    const next = this.knobs.dungeonEmpowermentTiers.find((t) => run.steps < t.steps);
    return { steps: run.steps, reached: tiers.length, nextAt: next?.steps ?? null, life: run.interiorLife, escrowGold: run.escrow.gold, escrowCards: run.escrow.cardIds };
  }

  /** The current match (if any) — the duel screen mounts PlayMatch on it. */
  get match(): MatchController | null {
    if (this.screen.kind === "duel") return this.screen.match;
    if (this.screen.kind === "dungeonDuel") return this.screen.match;
    return null;
  }
}

/** Local alias (avoids a name clash with the class's import list). */
function enemyDeckOf(catalog: import("@shandalar/world").Catalog, ref: import("@shandalar/world").OpponentDeckRef) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return enemyDeckImpl(catalog, ref);
}
import { enemyDeck as enemyDeckImpl } from "@shandalar/world";
