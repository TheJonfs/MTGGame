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
import { audio } from "../audio/audio.js";

/** S24 r6: set-bit count over an explored bitmap (the reveal-burst detector's meter). */
function popcount(words: number[]): number {
  let n = 0;
  for (let w of words) {
    w = w - ((w >> 1) & 0x55555555);
    w = (w & 0x33333333) + ((w >> 2) & 0x33333333);
    n += (((w + (w >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
  }
  return n;
}
import { abandonQuest, acceptQuest, addToCollection, cardMatches, creditRenown, innRest, pendingRetrievalChoice, questsOnArrival, resolveRetrieval, retrievalOnDungeonClear, rumorState, rumorsOnArrival, tavernRumors, spares, townOffers, type ActiveQuest, type QuestOffer } from "@shandalar/world";
import {
  applyInteriorDuel, clearDungeon, colorPrizeRoll, dungeonAdvance, dungeonAsWorldMap, dungeonDuelSpec, dungeonPath,
  empowermentTiersFor, generateDungeonRun, lairPrizeRoll, reachedTiers, resetDungeon, type DungeonRun, type MoxDungeonDef,
} from "@shandalar/world";
import {
  applySiegeDuel, beginSiegeEngagement, isTownOccupied, isTownThreatened, siegeDuelSpec, siegeFor, siegeWarnings,
  type SiegeEntry,
} from "@shandalar/world";
import { GUARDIAN_DECKS } from "@shandalar/sim/guardian-decks";
import { LORD_DECKS } from "@shandalar/sim/lord-decks";
import {
  entranceModifier, lawModifier, lordStartingLife, lordStatus, sealsHeld, strongholdPrizeList, strongholdState,
  type LordStatusRow, type StrongholdContentDef,
} from "@shandalar/world";
import type { Modifier } from "@shandalar/engine";
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
  /** S20: the dungeon threshold — stakes stated before the choice (dungeon-design §4). S22b: strongholds too. */
  | { kind: "dungeonTelegraph"; info: { dungeonId: string; kind: "mox" | "lair" | "stronghold"; name: string; at: Point; residentCatalogId?: string }; notice: string | null }
  /** S20: inside a dungeon (world.activeDungeon is the run). */
  | { kind: "dungeon"; notice: string | null; walking: boolean }
  /** S20: an interior duel (minion or guardian) — mounts PlayMatch like a world duel. */
  | { kind: "dungeonDuel"; enemyName: string; match: MatchController; against: { minionId?: string; guardian?: boolean } }
  /** S20: the guardian fell — the escrow + prize payout ceremony. */
  | { kind: "dungeonVictory"; name: string; paidGold: number; paidCards: string[]; notes?: string[] }
  /** S22b: a LORD fell — the sole-drop + escrow paid; the player picks strongholdPrizePicks cards
   * from the colour prize list, then the seal ceremony. */
  | { kind: "strongholdVictory"; strongholdId: string; name: string; lordName: string; lordCardId: string; paidGold: number; paidCards: string[]; prizeList: string[]; picks: string[]; pickCount: number; sealCount: number }
  /** S21 sieges: the engagement telegraph — the party, the life-carry law, the stakes (resume-aware). */
  | { kind: "siegeTelegraph"; townIndex: number; notice: string | null }
  | { kind: "siegeDuel"; enemyName: string; match: MatchController; townIndex: number }
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
    // S23 r1: the start stands OUTSIDE the home town's gate now — "set out from" reads the
    // world's nearest-town index, not the cell underfoot.
    this.lastTown = townAt(this.world.map, this.world.player.position) ?? this.world.map.towns[this.world.lastTownIndex] ?? null;
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
      // S21: standing in an occupied town on load (incl. mid-engagement — the telegraph resumes it).
      if (town && isTownOccupied(this.world, town.index)) {
        this.screen = { kind: "siegeTelegraph", townIndex: town.index, notice: "Loaded — the town is still theirs." };
        this.emit();
        return;
      }
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
        // S21 sieges: threats and falls surface as notices; a fall is a consequence (autosave).
        // S22 r2 (Chris: "four towns had fallen and I never noticed"): siege news is a POPUP now,
        // not a notice line a walk scrolls past — the quest-completion modal generalized.
        if (e.type === "siegeThreatened") {
          (this.questPopup ??= []).push({ title: "A town is under threat", quest: `${e.townName} is besieged — it falls in ${e.deadlineStep - this.world.player.stepsTaken} steps unless relieved.`, reward: "Reach it in time to drive the party off; fall, and its market, board, and gifts go dark." });
          this.autosave();
          this.emit();
        }
        if (e.type === "siegeFell") {
          (this.questPopup ??= []).push({ title: "A town has fallen", quest: `${e.townName} has fallen to its besiegers.`, reward: "Its market, board, and gifts are dark until you liberate it." });
          this.autosave();
          this.emit();
        }
        if (e.type === "encounter") {
          this.resumePath = path.slice(i + 1);
          const tmpl = opponentTemplate(this.catalog, this.world.opponents.find((o) => o.id === e.encounter.opponentId)!);
          this.screen = { kind: "encounter", encounter: e.encounter, tmpl, knobs: encounterKnobs(this.world, this.catalog, e.encounter, this.extraKnobs), notice: null };
          this.emit();
          return;
        }
        if (e.type === "arrived") {
          // S21: an occupied town's gate is the fight — the telegraph replaces the town screen.
          if (isTownOccupied(this.world, e.town.index)) {
            this.resumePath = path.slice(i + 1);
            this.screen = { kind: "siegeTelegraph", townIndex: e.town.index, notice: null };
            this.emit();
            return;
          }
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
    const linksBefore = this.world.manalinks.length; // S24 r5: the splash's diff baseline
    const done = questsOnArrival(this.world, town, this.knobs);
    this.queueNewManalinks(linksBefore);
    // S22 r1 (Chris): rumors are HEARD AT THE TAVERN now, not by walking in — chains start/advance/
    // reveal when the tavern tab opens (townRumors), where the lines are actually read.
    this.autosave();
    const first = this.world.visits[town.index] === 1;
    // S19 round 2 (Chris): completion gets a POPUP, not just a notice line.
    if (done.length) this.questPopup = done.filter((e) => e.type === "questDone").map((e) => ({ title: "Quest complete", quest: e.quest.text, reward: e.rewardText }));
    this.screen = { kind: "town", town, stock: rollShopStock(this.world, town, this.pool, this.knobs), notice: first ? `First time in ${town.name}.` : null };
    this.emit();
  }

  /** S19 round 2: pending completion announcements (modal over whatever screen is up). */
  questPopup: { title: string; quest: string; reward: string }[] | null = null;
  /** S24 audio (v3): bumped on every dungeon cache found — the UI's Findcard sting watches it. */
  treasureSeq = 0;
  /** S24 r5 (Chris): a granted manalink gets its OWN splash — the Manalink sting was drowning
   * under Winduel inside the news modal. Queued; the splash renders above everything and the
   * sting fires on mount (one-voice: it fades whatever rings). */
  manalinkSplash: { kind: "basic" | "life"; color: "W" | "U" | "B" | "R" | "G"; townName: string }[] | null = null;

  dismissManalinkSplash(): void {
    if (!this.manalinkSplash) return;
    this.manalinkSplash = this.manalinkSplash.slice(1);
    if (this.manalinkSplash.length === 0) this.manalinkSplash = null;
    this.emit();
  }

  /** Diff-based grant detection: works for EVERY award path (arrival couriers, bounty defeats,
   * future boons) with zero reward-plumbing — anything award() pushed past `before` splashes. */
  private queueNewManalinks(before: number): void {
    if (!this.world) return;
    for (const m of this.world.manalinks.slice(before)) {
      (this.manalinkSplash ??= []).push({
        kind: m.kind === "life" ? "life" : "basic",
        color: m.color,
        townName: this.world.map.towns[m.town]?.name ?? "a town",
      });
    }
  }
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
      // S21 r2 (Chris: "no indicator of where that is"): retrieval quests mark their target —
      // the lair before the item is out, the buyer's town after.
      if (q.kind === "retrieval") {
        if (!q.itemRecovered && q.retrievalDungeonId) {
          const lair = w.map.strongholds.find((f) => f.kind === "lair" && `lair_${f.opponentId}` === q.retrievalDungeonId);
          if (lair) marks.push({ at: lair.at, label: `${q.retrievalItem?.cardName ?? "the item"} · in this lair` });
        } else if (q.itemRecovered) {
          const t = w.map.towns.find((x) => x.index === q.fromTown);
          if (t) marks.push({ at: t.at, label: `${t.name} · the buyer waits` });
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

  /** S24 (ADR-086) — the inn: rest trades steps for life; the clock bulk-advances and any news
   * that landed while sleeping queues for waking (through the news modal, never mid-dialog). */
  innRest(points: number): void {
    if (!this.world || this.screen.kind !== "town") return;
    const town = this.screen.town;
    const out = innRest(this.world, this.catalog, points, this.extraKnobs);
    this.autosave(); // a rest is a consequence (steps spent, clocks run)
    for (const e of out.events) {
      if (e.type === "siegeThreatened")
        (this.questPopup ??= []).push({ title: "A town is under threat", quest: `While you slept: ${e.townName} is besieged — it falls in ${e.deadlineStep - this.world.player.stepsTaken} steps unless relieved.`, reward: "Reach it in time to drive the party off; fall, and its market, board, and gifts go dark." });
      if (e.type === "siegeFell")
        (this.questPopup ??= []).push({ title: "A town has fallen", quest: `While you slept: ${e.townName} fell to its besiegers.`, reward: "Its market, board, and gifts are dark until you liberate it." });
      if (e.type === "questExpired")
        (this.questPopup ??= []).push({ title: "A quest expired", quest: `While you slept, a contract ran out: ${e.text}`, reward: "No further penalty — the road simply outlasted it." });
    }
    // The clock may have crossed epochs while we slept: the shelf restocks live.
    this.screen = {
      kind: "town", town,
      stock: rollShopStock(this.world, town, this.pool, this.knobs),
      notice: out.healed > 0 ? `You rest ${out.stepsSpent} steps and wake restored (+${out.healed} life).` : "You are already at your full strength.",
    };
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
        rules: { startingLife: duel.spec.rules.startingLife, ante: duel.spec.rules.ante ?? 0, ...(duel.spec.rules.startingPlayer !== undefined ? { startingPlayer: duel.spec.rules.startingPlayer } : {}) }, // S22 r2: the coin flip rides through
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
    const linksBefore = this.world.manalinks.length; // S24 r5: bounty rewards can grant links
    const record = applyDuelResult(this.world, this.catalog, duel, result, this.extraKnobs);
    this.queueNewManalinks(linksBefore);
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

  /** S22b: the stronghold content entry for a dungeonId (argent_bastion, spiral_spire, …). */
  strongholdDef(dungeonId: string): StrongholdContentDef | undefined {
    return (this.catalog.strongholdContent ?? []).find((s) => s.id === dungeonId);
  }

  /** S22b (§5 visible schedules): each lord's current strength for the rail telegraph. */
  lordStatusRows(): LordStatusRow[] {
    if (!this.world) return [];
    return lordStatus(this.world, this.catalog, this.knobs);
  }

  /** Enter from the telegraph: resume the saved run if it matches, else generate. Autosave at entry. */
  enterDungeon(): void {
    if (!this.world || this.screen.kind !== "dungeonTelegraph") return;
    const { info } = this.screen;
    let run = this.world.activeDungeon;
    if (!run || run.dungeonId !== info.dungeonId) {
      const color = (this.strongholdDef(info.dungeonId)?.color ?? this.moxDef(info.dungeonId)?.color ?? this.catalog.opponents.find((o) => o.id === info.residentCatalogId)?.spoke ?? "G") as "W" | "U" | "B" | "R" | "G";
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

  /** S24 r6 (Chris — the Damb set): the deep breathes when a step OPENS A SIGHTLINE. The
   * original played on new-segment reveals; our translation is a reveal BURST — a step that
   * uncovers ≥5 fog cells just rounded a corner or entered a chamber. A cooldown keeps it
   * occasional (consecutive reveals don't chatter; explored backtracks stay silent), the draw
   * is random-without-immediate-repeat from the five, and it rides the SFX channel so a breath
   * never cuts a Findcard. UI-side randomness — sounds are not game state. */
  private lastAmbientAt = 0;
  private lastAmbientIdx = 0;
  private dungeonAmbience(newCells: number): void {
    if (newCells < 5) return;
    const now = Date.now();
    if (now - this.lastAmbientAt < 8_000) return; // r7: 12s → 8s, Chris's tuning
    this.lastAmbientAt = now;
    let n: number;
    if (this.lastAmbientIdx === 0) n = 1 + Math.floor(Math.random() * 5); // first breath: any of the five
    else {
      n = 1 + Math.floor(Math.random() * 4); // draw from the four others
      if (n >= this.lastAmbientIdx) n += 1;
    }
    this.lastAmbientIdx = n;
    audio.sfx(`sfx.ambient.dungeon.${n}`);
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
      const exploredBefore = popcount(run.explored); // S24 r6: the reveal-burst detector
      const events = dungeonAdvance(run, this.knobs, [cell]);
      this.dungeonAmbience(popcount(run.explored) - exploredBefore);
      this.emit();
      for (const e of events) {
        if (e.type === "treasure") {
          this.autosave(); // every cache is a consequence
          this.treasureSeq += 1; // S24 audio (v3): the Findcard sting watches this
          const t = e.treasure;
          const notice =
            t.kind === "gold" ? `Escrowed: ${t.gold} gold. The mountain holds it until the guardian falls.`
            : t.kind === "card" ? `Escrowed: ${t.cardName ?? t.cardId}. The mountain holds it until the guardian falls.`
            : t.kind === "life" ? `A healing cache: +${t.life} interior life (now ${run.interiorLife}). Spent here or lost here — it never leaves the dark.`
            : `A boon: ${t.cardName ?? t.cardId} will fight beside you in your NEXT battle here — spent when it's fought, held until then.`;
          this.screen = { kind: "dungeon", notice, walking: true };
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
    const sh = run.kind === "stronghold" ? this.strongholdDef(run.dungeonId) : undefined;
    const law = mox?.law.both ?? [];
    // S22b: the PARTISAN law rides every interior duel on the defender's side (per-battle
    // re-injection — a felled law returns next fight for free); the lord adds his entrance.
    const extraModifiers: Modifier[] = sh ? [lawModifier(sh)] : [];
    let enemy: Parameters<typeof dungeonDuelSpec>[4];
    let portrait: string | undefined;
    if (against.guardian) {
      if (sh) {
        const g = LORD_DECKS[sh.lord.key]!;
        enemy = { kind: "guardian", name: sh.lord.name, decklist: g.decklist, archetype: g.archetype, life: lordStartingLife(this.world, this.knobs, sh), color: sh.color };
        portrait = sh.lord.portrait;
        extraModifiers.push(entranceModifier(sh)); // the signature always looms (Chris-ratified)
      } else if (run.kind === "mox" && mox) {
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
    const { spec, enemyName } = dungeonDuelSpec(this.world, this.catalog, this.knobs, run, enemy, law, rng, extraModifiers);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelayMs,
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: enemyName, decklist: spec.players[1].decklist, difficulty: (spec.players[1].agent.split(":")[1] ?? "journeyman") as "apprentice" | "journeyman" | "master", archetype: enemy.kind === "minion" ? "midrange" : enemy.archetype, ...(portrait ? { portrait } : {}) },
        rules: { startingLife: spec.rules.startingLife, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) }, // S22 r2: the coin flip rides through
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
    const out = applyInteriorDuel(this.world, this.knobs, run, result, against.minionId, this.catalog);
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
      // S22b: a LORD fell — sole-drop + escrow now; the five picks come as a choice screen;
      // the seal is the story flag toward the gauntlet unlock (counted, nothing more).
      if (run.kind === "stronghold") {
        const sh = this.strongholdDef(run.dungeonId)!;
        const paid = clearDungeon(this.world, run, { gold: 0, cardIds: [sh.lord.cardId] });
        strongholdState(this.world, sh.color).seal = true;
        creditRenown(this.world.player, sh.color, 3); // a lord's fall echoes like a tier-3 kill (flagged for ratification)
        this.autosave();
        this.screen = {
          kind: "strongholdVictory",
          strongholdId: sh.id,
          name: sh.name,
          lordName: sh.lord.name,
          lordCardId: sh.lord.cardId,
          paidGold: paid.paidGold,
          paidCards: paid.paidCards,
          prizeList: strongholdPrizeList(this.pool, sh.color).map((d) => d.id),
          picks: [],
          pickCount: this.knobs.strongholdPrizePicks,
          sealCount: sealsHeld(this.world),
        };
        this.emit();
        return;
      }
      // Victory: payout = escrow + the prize.
      let prize: { gold: number; cardIds: string[] };
      let name: string;
      const victoryNotes: string[] = [];
      if (run.kind === "mox") {
        const mox = this.moxDef(run.dungeonId)!;
        const roll = colorPrizeRoll(this.world, this.pool, run.dungeonId, mox.color);
        prize = { gold: 0, cardIds: [mox.prize.mox, mox.prize.guardianCard, ...(roll ? [roll] : [])] };
        name = mox.name;
      } else {
        prize = lairPrizeRoll(this.world, this.pool, run.dungeonId);
        // S21 retrieval: the quest item was in this prize room, escrowed like everything else —
        // it pays out with the escrow; the keep-or-deliver choice waits at the offer town.
        for (const r of retrievalOnDungeonClear(this.world, run.dungeonId)) {
          prize.cardIds.push(r.cardId);
          const t = this.world.map.towns.find((x) => x.index === r.quest.fromTown);
          victoryNotes.push(`${r.cardName} — the retrieval quest's item. Return to ${t?.name ?? "the offer town"} (marked on your map) to keep it or sell it back.`);
        }
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
      this.screen = { kind: "dungeonVictory", name, paidGold: paid.paidGold, paidCards: paid.paidCards, ...(victoryNotes.length ? { notes: victoryNotes } : {}) };
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

  /** S22b: toggle one prize-list card in/out of the picks (capped at pickCount; list members only). */
  toggleStrongholdPick(cardId: string): void {
    if (this.screen.kind !== "strongholdVictory") return;
    const s = this.screen;
    if (!s.prizeList.includes(cardId)) return; // only the hoard is on offer
    const picks = s.picks.includes(cardId) ? s.picks.filter((c) => c !== cardId) : s.picks.length < s.pickCount ? [...s.picks, cardId] : s.picks;
    this.screen = { ...s, picks };
    this.emit();
  }

  /** S22b: bank the picks (fewer than pickCount is allowed — walking away from value is a choice),
   * then the seal ceremony note. Autosaved: the picks are a consequence. */
  confirmStrongholdPicks(): void {
    if (!this.world || this.screen.kind !== "strongholdVictory") return;
    const s = this.screen;
    addToCollection(this.world, s.picks, "reward");
    this.autosave();
    const gauntlet = s.sealCount >= 5
      ? " Five seals. Something at the heart of the plane has noticed."
      : ` Seals held: ${s.sealCount} of 5.`;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `${s.name} is broken; its seal is yours.${gauntlet}` };
    this.emit();
  }

  /** The empowerment meter (rail): tiers reached + the next threshold. */
  dungeonMeter(): { steps: number; reached: number; nextAt: number | null; life: number; escrowGold: number; escrowCards: string[] } | null {
    const run = this.dungeonRun;
    if (!run) return null;
    const tiers = reachedTiers(run, this.knobs);
    const next = empowermentTiersFor(run, this.knobs).find((t) => run.steps < t.steps);
    return { steps: run.steps, reached: tiers.length, nextAt: next?.steps ?? null, life: run.interiorLife, escrowGold: run.escrow.gold, escrowCards: run.escrow.cardIds };
  }

  // ---------- S21 Parts 3–4: rumors + retrieval ----------

  /** The tavern's rumor lines for the current town screen (logs them as heard). S22 r1: the
   * CHAINS live here too now — opening the tavern starts/advances/reveals them (idempotent per
   * town: an advanced chain points elsewhere), and a reveal's trail-end line leads the board.
   * A reveal marks the map — a consequence, so it autosaves. */
  townRumors(): string[] {
    if (!this.world || this.screen.kind !== "town") return [];
    const events = rumorsOnArrival(this.world, this.catalog, this.screen.town);
    if (events.length > 0) this.autosave();
    const lines = tavernRumors(this.world, this.catalog, this.screen.town, this.pool); // r4: the pool powers the manalink pointer
    const reveals = events.filter((e) => e.type === "chainRevealed").map((e) => e.text);
    return [...reveals, ...lines];
  }

  /** Recovered retrieval items whose buyer is in THIS town — the keep-or-deliver choice. */
  retrievalChoices(): ActiveQuest[] {
    if (!this.world || this.screen.kind !== "town") return [];
    return pendingRetrievalChoice(this.world, this.screen.town.index);
  }

  chooseRetrieval(questId: string, choice: "keep" | "deliver"): void {
    if (!this.world) return;
    const r = resolveRetrieval(this.world, questId, choice);
    this.autosave();
    if ("notice" in this.screen) this.screen = { ...this.screen, notice: r.ok ? r.text : r.reason };
    this.emit();
  }

  /** The heard-rumors journal (rail): count + the freshest few. */
  rumorJournal(): { count: number; recent: string[]; all: string[] } {
    if (!this.world) return { count: 0, recent: [], all: [] };
    const rs = rumorState(this.world, this.catalog);
    return { count: rs.heard.length, recent: rs.heard.slice(-3).reverse(), all: [...rs.heard].reverse() }; // newest first (S22 r1: the rail scrolls the whole journal)
  }

  // ---------- S21 sieges (manifest §5) ----------

  /** Map/rail surface: every non-quiet town's status. */
  siegeStates(): Record<number, "threatened" | "occupied"> {
    if (!this.world) return {};
    const out: Record<number, "threatened" | "occupied"> = {};
    for (const s of siegeWarnings(this.world)) out[s.townIndex] = s.status;
    return out;
  }

  siegeRail(): { town: Town; status: "threatened" | "occupied"; stepsLeft?: number }[] {
    if (!this.world) return [];
    const w = this.world;
    return siegeWarnings(w)
      .map((s) => ({ town: w.map.towns[s.townIndex]!, status: s.status, ...(s.stepsLeft !== undefined ? { stepsLeft: s.stepsLeft } : {}) }))
      .sort((a, b) => (a.stepsLeft ?? 1e9) - (b.stepsLeft ?? 1e9));
  }

  /** Telegraph payload: the town, the party (remaining vs total), the engagement kind. */
  siegeInfo(townIndex: number): {
    town: Town; entry: SiegeEntry; kind: "defense" | "liberation";
    party: { tmpl: OpponentTemplate; fallen: boolean }[]; resume: boolean; stepsLeft?: number;
  } | null {
    if (!this.world) return null;
    const town = this.world.map.towns[townIndex];
    const entry = siegeFor(this.world, townIndex);
    if (!town || !entry || entry.status === "quiet" || !entry.party) return null;
    const kind = entry.status === "occupied" ? "liberation" : "defense";
    const remaining = entry.engagement ? [...entry.engagement.remaining] : [...entry.party];
    // Mark the already-fallen prefix (engagement in progress): party order is fight order.
    const fallenCount = entry.party.length - remaining.length;
    const party = entry.party.map((id, i) => ({ tmpl: this.catalog.opponents.find((o) => o.id === id)!, fallen: i < fallenCount }));
    return {
      town, entry, kind, party, resume: !!entry.engagement,
      ...(entry.status === "threatened" && entry.deadlineStep !== undefined ? { stepsLeft: Math.max(0, entry.deadlineStep - this.world.player.stepsTaken) } : {}),
    };
  }

  /** From a THREATENED town's screen: sally out to break the siege before it lands. */
  defendTown(): void {
    if (!this.world || this.screen.kind !== "town") return;
    const town = this.screen.town;
    if (!isTownThreatened(this.world, town.index)) return;
    this.screen = { kind: "siegeTelegraph", townIndex: town.index, notice: null };
    this.emit();
  }

  /** Commit from the telegraph: the engagement begins (or resumes) and the first fight starts. */
  enterSiege(): void {
    if (!this.world || this.screen.kind !== "siegeTelegraph") return;
    const entry = siegeFor(this.world, this.screen.townIndex);
    if (!entry || entry.status === "quiet") return;
    beginSiegeEngagement(this.world, entry);
    this.autosave(); // commitment is a consequence (the engagement rides the save)
    this.startSiegeDuel(this.screen.townIndex);
  }

  declineSiege(): void {
    if (!this.world || this.screen.kind !== "siegeTelegraph") return;
    const townIndex = this.screen.townIndex;
    const town = this.world.map.towns[townIndex]!;
    // Threatened = declined from inside the (still friendly) town; occupied = from its gate.
    if (isTownThreatened(this.world, townIndex)) this.enterTown(town);
    else {
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `${town.name} stays theirs — for now.` };
      this.emit();
    }
  }

  private startSiegeDuel(townIndex: number): void {
    if (!this.world) return;
    const entry = siegeFor(this.world, townIndex)!;
    const rng = new DungeonRng(this.world.rng);
    const { spec, tmpl } = siegeDuelSpec(this.world, this.catalog, this.knobs, entry, rng);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelayMs,
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: {
          name: tmpl.name, decklist: spec.players[1].decklist,
          difficulty: (spec.players[1].agent.split(":")[1] ?? "journeyman") as "apprentice" | "journeyman" | "master",
          archetype: enemyDeckOf(this.catalog, tmpl.deck).archetype,
          portrait: tmpl.portraitChip ?? tmpl.portrait,
        },
        rules: { startingLife: spec.rules.startingLife, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) }, // S22 r2: the coin flip rides through
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "siegeDuel", enemyName: tmpl.name, match, townIndex };
    this.emit();
    void match.start().then((result) => this.finishSiegeDuel(townIndex, result));
  }

  private finishSiegeDuel(townIndex: number, result: MatchResult): void {
    if (!this.world) return;
    const entry = siegeFor(this.world, townIndex)!;
    const town = this.world.map.towns[townIndex]!;
    const out = applySiegeDuel(this.world, this.catalog, this.knobs, entry, town, result);
    this.autosave(); // every fight is a consequence
    if (out.type === "fightWon") {
      this.screen = {
        kind: "siegeTelegraph", townIndex,
        notice: `${out.remaining} ${out.remaining === 1 ? "foe" : "foes"} left. Your life stands at ${out.lifeNow}; their stake${out.anteWon.length ? ` (${out.anteWon.map((id) => this.pool.get(id)?.name ?? id).join(", ")})` : ""} and ${out.goldWon} gold are yours.`,
      };
      this.emit();
      return;
    }
    if (out.type === "engagementWon") {
      const won = out.kind === "liberation" ? `${town.name} is free. Its market, board, and gifts return.` : `The siege of ${town.name} is broken before it landed.`;
      // S22 r3 (Chris, item 10): the ceremony names the WHOLE purse — every fight's gold and
      // stake across the engagement, through the news modal (titles starting "A town" render
      // the reward line as plain text there).
      const spoils = [`${out.totalGold} gold`];
      if (out.totalAnte.length) spoils.push(`their stakes — ${out.totalAnte.map((id) => this.pool.get(id)?.name ?? id).join(", ")}`);
      (this.questPopup ??= []).push({
        title: out.kind === "liberation" ? "A town liberated" : "A town relieved",
        quest: won,
        reward: `The spoils of the engagement: ${spoils.join("; ")}.`,
      });
      this.enterTown(town);
      if (this.screen.kind === "town") this.screen = { ...this.screen, notice: won };
      this.emit();
      return;
    }
    if (this.world.gameOver) {
      this.screen = { kind: "gameOver", fatal: null };
    } else {
      const holds = out.kind === "liberation" ? `${town.name} stays theirs` : `${town.name}'s defenders regroup — the deadline stands`;
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `Driven off at a cost: your stake and a world life. ${holds}; their band is back at full strength.` };
    }
    this.emit();
  }

  /** The current match (if any) — the duel screen mounts PlayMatch on it. */
  get match(): MatchController | null {
    if (this.screen.kind === "duel") return this.screen.match;
    if (this.screen.kind === "dungeonDuel") return this.screen.match;
    if (this.screen.kind === "siegeDuel") return this.screen.match;
    return null;
  }
}

/** Local alias (avoids a name clash with the class's import list). */
function enemyDeckOf(catalog: import("@shandalar/world").Catalog, ref: import("@shandalar/world").OpponentDeckRef) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return enemyDeckImpl(catalog, ref);
}
import { enemyDeck as enemyDeckImpl } from "@shandalar/world";
