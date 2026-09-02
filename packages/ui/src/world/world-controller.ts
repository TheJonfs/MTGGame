import type { CardDef } from "@shandalar/cards";
import type { MatchResult, MatchSpec } from "@shandalar/engine";
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
  empowermentTiersFor, generateDungeonRun, lairPrizeRoll, reachedTiers, resetDungeon, type DungeonRun, type MoxDungeonDef, type PowerDungeonDef,
} from "@shandalar/world";
import {
  applySiegeDuel, beginSiegeEngagement, isTownOccupied, isTownThreatened, siegeDuelSpec, siegeFor, siegeWarnings,
  type SiegeEntry,
} from "@shandalar/world";
import { GUARDIAN_DECKS } from "@shandalar/sim/guardian-decks";
import { COURT_DECKS } from "@shandalar/sim/court-decks";
import { LORD_DECKS } from "@shandalar/sim/lord-decks";
import {
  activateStride, applyBalm, applyCrossing, barrageFight, crossingDestinations, fuelCandidates, fuelDepth,
  maxWorldLife, payBarrage, powerRates, powerRefusal, quietusRefusal, quietusStrike, suggestFuel, unlockPower, POWER_COLORS,
  type FuelCandidate, type PowerColor, type PowerRates,
} from "@shandalar/world";
import {
  entranceModifier, lawModifier, lordStartingLife, lordStatus, sealsHeld, strongholdPrizeList, strongholdState,
  type LordStatusRow, type StrongholdContentDef,
} from "@shandalar/world";
import type { Modifier } from "@shandalar/engine";
import { WorldRng as DungeonRng } from "@shandalar/world";
import {
  applyMirrorDuel, applyPetalDuel, corollaAdvance, corollaAsWorldMap, corollaDoor, corollaInnRest, corollaPath, corollaTown, enterCorolla,
  fixedPointAt, generateCorolla, insideCorolla, leaveCorolla, mirrorDuelSpec, petalAt, petalDistance, petalDuelSpec, petalLawName, petalsFallen,
  rollCorollaStock, vaultDoor, PETAL_ORDER, type CorollaDef, type CorollaGeometry, type PetalColor, type WorldMap,
} from "@shandalar/world";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
import { HEART_DECK } from "@shandalar/sim/heart-deck";
import { applyHeartDuel, applyLegacy, cutColors, emptyLegacy, heartDoor, heartDuelSpec, legacyCarry, migrateLegacy, recordCutting, startingColor, type ChronicleEntry, type Legacy } from "@shandalar/world";

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
  | { kind: "dungeonTelegraph"; info: { dungeonId: string; kind: "mox" | "lair" | "stronghold" | "power"; name: string; at: Point; residentCatalogId?: string }; notice: string | null }
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
  /** S26 (ADR-091): the Corolla's door — five seals part the petals (locked, it states the count). */
  | { kind: "corollaTelegraph"; at: Point; seals: number; open: boolean; notice: string | null }
  /** S26: the Vault's door — five Moxen open the Mirror ("the Vault shows you what you brought"). */
  | { kind: "vaultTelegraph"; at: Point; moxen: number; open: boolean; notice: string | null }
  /** S26: inside the flower (world.gauntlet.corolla is where you stand). */
  | { kind: "corolla"; notice: string | null; walking: boolean }
  /** S26: at a petal's tip — the boss, the returned law, the stakes. */
  | { kind: "petalTelegraph"; color: PetalColor }
  /** S26: a petal fight or the Mirror — mounts PlayMatch like a world duel. */
  | { kind: "corollaDuel"; enemyName: string; match: MatchController; against: { petal?: PetalColor; mirror?: boolean; heart?: boolean } }
  /** S26: a petal fell — the payout (signature, duals, purse, ante). */
  | { kind: "petalVictory"; color: PetalColor; bossName: string; paidGold: number; paidCards: string[]; anteWon: string[]; anteWithheld: string[]; fallen: number; ministerWithheld: boolean }
  /** S26: the town at the heart — the inn, the R-drawer shelf, the Heart's door. */
  | { kind: "corollaTown"; stock: ShopItem[]; notice: string | null }
  /** S26: the Lotus paid out. */
  | { kind: "mirrorVictory" }
  /** S27 (ADR-093): the Heart's telegraph — the Manafleur behind the town's door. */
  | { kind: "heartTelegraph" }
  /** S27: the Manafleur fell — the ceremony, the card, the chronicle's entry, the offer. */
  | { kind: "heartVictory"; entry: ChronicleEntry; paidCards: string[]; first: boolean; fifth: boolean }
  | {
      kind: "duelResult";
      duel: PreparedDuel;
      record: DuelRecord;
      before: { life: number; gold: number };
      after: { life: number; gold: number };
    }
  | { kind: "town"; town: Town; stock: ShopItem[]; notice: string | null }
  | { kind: "collection"; back: "map" | "town" | "corolla" | "corollaTown" }
  | {
      /** S14 Part 2: the deck editor — a DRAFT decklist; commit only when legal (ADR-065). */
      kind: "editor";
      back: "map" | "town" | "corolla" | "corollaTown"; // S26 r2: the flower and its town return to themselves
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
  /** Play-client pacing for duels (the fallback; the live read prefers stored). */
  aiDelayMs = 400;

  /** S25 r2 note 1: the in-duel flyout writes the delay to storage — read it FRESH per duel, so a
   * change made mid-session reaches the next fight (the old mount-time copy went stale). Tests
   * (storage: null) keep the field as their hook. */
  private aiDelay(): number {
    const raw = this.storage?.getItem("shandalar-ai-delay");
    return raw !== null && raw !== undefined ? Number(raw) : this.aiDelayMs;
  }
  private listeners = new Set<() => void>();
  private walkToken = 0;
  private lastTown: Town | null = null;
  /** S14 rider: the path left unwalked when an encounter interrupted (resume with one click). */
  resumePath: Point[] | null = null;
  /** S25 (ADR-088): the fuel picker overlay — the rail (Stride/Balm/Crossing) and the parley
   * menu (Quietus/Barrage) both open it. Chosen fuel is a multiset of cardIds; a pick that
   * includes a sole-mechanism card arms a second confirm (permanent-loss warning). */
  fuelPicker: {
    action:
      | { kind: "stride" }
      | { kind: "balm"; lives: number }
      | { kind: "crossing"; townIndex: number }
      | { kind: "quietus" }
      | { kind: "barrage"; damage: number };
    color: PowerColor;
    cost: number;
    title: string;
    candidates: FuelCandidate[];
    chosen: string[];
    notice: string | null;
    armed: boolean;
  } | null = null;

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
    // S27 (ADR-093): the chronicle's carryover — what the profile carries into every new road.
    const legacy = this.legacy();
    const carried = legacy.victories > 0 ? applyLegacy(this.world, this.catalog, legacy, this.knobs) : null;
    // S23 r1: the start stands OUTSIDE the home town's gate now — "set out from" reads the
    // world's nearest-town index, not the cell underfoot.
    this.lastTown = townAt(this.world.map, this.world.player.position) ?? this.world.map.towns[this.world.lastTownIndex] ?? null;
    this.autosave();
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `You set out from ${this.lastTown?.name ?? "the road"}.${carried && carried.colors.length ? ` ${this.newRoadLine()}` : ""}` };
    this.emit();
  }

  // ---------- S27: the profile store (the chronicle's first phase) ----------
  static readonly LEGACY_KEY = "shandalar-legacy";
  /** The profile's legacy, read fresh from storage (migration hygiene: any bad shape reads empty). */
  legacy(): Legacy {
    const raw = this.storage?.getItem(WorldController.LEGACY_KEY);
    if (!raw) return emptyLegacy();
    try { return migrateLegacy(JSON.parse(raw)); } catch { return emptyLegacy(); }
  }
  private writeLegacy(l: Legacy): void { this.storage?.setItem(WorldController.LEGACY_KEY, JSON.stringify(l)); }
  /** The new-road line for the start screen and the first notice (the pack's two variants). */
  newRoadLine(): string | null {
    const l = this.legacy();
    const colors = cutColors(l);
    if (colors.length === 0) return null;
    const pack = this.catalog.questText?.heart;
    if (colors.length >= 5) return pack?.newRoadAll ?? "You have cut the flower from every road. You begin with everything you carried out.";
    const names: Record<string, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };
    return colors.map((c) => {
      const carry = legacyCarry(this.catalog, c);
      const power = powerRates(this.world ?? ({ powers: { unlocked: [c], strideStepsLeft: 0 }, strongholds: [] } as never), c).name;
      const guardian = carry.guardianCard ? (this.pool.get(carry.guardianCard)?.name ?? carry.guardianCard) : "its guardian";
      const minister = carry.minister ? (this.pool.get(carry.minister)?.name ?? carry.minister) : "its minister";
      return (pack?.newRoad ?? "You have cut the flower from the {colour} road. You begin with what you carried out: {power}, {guardian}, and {minister}.")
        .replace("{colour}", names[c] ?? c).replace("{power}", power).replace("{guardian}", guardian).replace("{minister}", minister);
    }).join(" ");
  }
  /** Dev (S27): grant or clear cuttings for testing the carryover and the Chronicle page. */
  devGrantCutting(color: PetalColor): void {
    const text = this.catalog.questText?.heart?.chronicle[color] ?? `Cut from the ${color} road.`;
    const l = this.legacy();
    this.writeLegacy(recordCutting(l, { n: l.victories + 1, color, text, seed: 0, difficulty: "dev", steps: 0, when: new Date().toISOString() }));
    this.emit();
  }
  devClearLegacy(): void { this.writeLegacy(emptyLegacy()); this.emit(); }
  /** Dev (S27): fell the five petals so the Heart's door can be tested without the five fights. */
  /** S27 r1 (Chris): AUTO-VICTORY over the five petal bosses — each unfallen petal falls as if won
   * (the signature — withheld if held — both duals, the purse; no stake), so the Heart can be
   * speed-run with a starter deck. Reachable from the flower's rail and the heart's town too. */
  devFellPetals(): number {
    const def = this.corollaDef;
    if (!this.world || !def) return 0;
    const fallen = new Set(petalsFallen(this.world));
    let n = 0;
    for (const petal of def.petals) {
      if (fallen.has(petal.color)) continue;
      const fake: MatchResult = { winner: 0, reason: "LIFE", turns: 0, finalLife: [this.world.player.worldLife, 0], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante: [[], []] }, log: [], finalStateSerialized: "" };
      applyPetalDuel(this.world, this.knobs, this.pool, petal, fake);
      n += 1;
    }
    this.autosave();
    const notice = n ? `Dev: ${n} petal${n === 1 ? "" : "s"} fell as victories — the ministers, their duals and the purses are yours.` : "Dev: every petal had already fallen.";
    if (this.screen.kind === "corollaTown") this.screen = { kind: "corollaTown", stock: rollCorollaStock(this.world, this.pool, this.knobs), notice };
    else if (this.screen.kind === "corolla") this.screen = { kind: "corolla", notice, walking: false };
    this.emit();
    return n;
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
    } else if (insideCorolla(this.world) && this.catalog.corolla) {
      // S26: reloading inside the flower resumes where you stood (world-kind: nothing to forfeit).
      this.screen = { kind: "corolla", notice: "You are where you stood, among the petals.", walking: false };
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
        // S26 (ADR-091): the centre doors stop the walk; the telegraph states the lock either way.
        if (e.type === "corollaDoor") {
          this.resumePath = path.slice(i + 1);
          this.screen = { kind: "corollaTelegraph", at: e.at, seals: e.seals, open: e.open, notice: null };
          this.emit();
          return;
        }
        if (e.type === "vaultDoor") {
          this.resumePath = path.slice(i + 1);
          this.screen = { kind: "vaultTelegraph", at: e.at, moxen: e.moxen, open: e.open, notice: null };
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
    const back: "map" | "town" | "corolla" | "corollaTown" =
      this.screen.kind === "collection" ? this.screen.back
      : this.screen.kind === "town" ? "town"
      : this.screen.kind === "corolla" ? "corolla"
      : this.screen.kind === "corollaTown" ? "corollaTown"
      : "map";
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
    this.returnFrom(this.screen.back);
  }

  /** S26 r2: where a browsing screen goes back to — the town, the flower, the flower's town, or the map. */
  private returnFrom(back: "map" | "town" | "corolla" | "corollaTown"): void {
    if (back === "town" && this.lastTown) return this.enterTown(this.lastTown);
    if (back === "corollaTown" && this.world && insideCorolla(this.world)) return this.enterHeartTown();
    if (back === "corolla" && this.world && insideCorolla(this.world)) { this.screen = { kind: "corolla", notice: null, walking: false }; this.emit(); return; }
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
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
  activeQuests(): { quest: ActiveQuest; stepsLeft: number | null; destName: string | null; targetName: string | null; targetRegion: string | null }[] {
    if (!this.world) return [];
    const w = this.world;
    return w.quests.active.map((q) => {
      // S25 r2 note 4 (Chris: sparse details): a bounty names its mark's REGION — from the live
      // roamer when it still walks, else from where it was last sighted.
      const inst = q.bountyOpponentId ? w.opponents.find((o) => o.id === q.bountyOpponentId) : undefined;
      const regionIdx = inst?.region ?? (q.bountySeenAt ? regionAt(w.map, q.bountySeenAt).index : undefined);
      return {
        quest: q,
        stepsLeft: q.deadlineStep !== undefined ? Math.max(0, q.deadlineStep - w.player.stepsTaken) : null,
        destName: q.toTown !== undefined ? w.map.towns.find((t) => t.index === q.toTown)?.name ?? null : null,
        targetName: q.bountyCatalogId ? this.catalog.opponents.find((o) => o.id === q.bountyCatalogId)?.name ?? null : null,
        targetRegion: regionIdx !== undefined ? w.map.regions[regionIdx]?.name ?? null : null,
      };
    });
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
    else if (this.screen.kind === "corolla") this.screen = { kind: "collection", back: "corolla" };
    else if (this.screen.kind === "corollaTown") this.screen = { kind: "collection", back: "corollaTown" };
    else if (this.screen.kind === "editor") this.screen = { kind: "collection", back: this.screen.back };
    else return;
    this.emit();
  }

  closeCollection(): void {
    if (this.screen.kind !== "collection" || !this.world) return;
    this.returnFrom(this.screen.back);
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

  // ---------- S25: the five powers (ADR-088) ----------

  /** The Powers rail rows: every power with form, seal state, live cost, and the greyed reason. */
  powersRail(): (PowerRates & { reason: string | null; running?: number })[] {
    if (!this.world) return [];
    return POWER_COLORS.map((color) => {
      const r = powerRates(this.world!, color);
      const cost = r.stride?.cost ?? r.crossing?.cost ?? (r.balm ? r.balm.costPerLife : 0) ?? 0;
      const reason = r.unlocked ? powerRefusal(this.world!, this.pool, color, cost) : `${r.name} is not yet learned — its dungeon teaches it`;
      return { ...r, reason, ...(color === "G" && this.world!.powers.strideStepsLeft > 0 ? { running: this.world!.powers.strideStepsLeft } : {}) };
    });
  }

  /** The Crossing's live destination list (towns under warning or occupation, named). */
  crossingList(): { townIndex: number; name: string; status: "threatened" | "occupied"; stepsLeft?: number }[] {
    if (!this.world) return [];
    return crossingDestinations(this.world).map((d) => ({ ...d, name: this.world!.map.towns[d.townIndex]?.name ?? `town ${d.townIndex}` }));
  }

  /** The parley menu's Quietus line (greyed-with-reason when illegal; absent until learned —
   * the menu "grows by up to two"). */
  quietusOption(): { cost: number; reason: string | null } | null {
    if (!this.world || this.screen.kind !== "encounter") return null;
    if (!powerRates(this.world, "B").unlocked) return null;
    const enc = this.screen.encounter;
    const cost = powerRates(this.world, "B").quietus!.costs[enc.tier];
    return { cost, reason: quietusRefusal(this.world, this.catalog, this.pool, enc) };
  }

  /** The parley menu's Barrage line (absent until learned). */
  barrageOption(): { costPerDamage: number; cap: number; depth: number; reason: string | null } | null {
    if (!this.world || this.screen.kind !== "encounter") return null;
    const r = powerRates(this.world, "R");
    if (!r.unlocked) return null;
    const depth = fuelDepth(fuelCandidates(this.world, this.pool, "R"));
    const reason = depth < r.barrage!.costPerDamage ? "no red spares to burn" : null;
    return { costPerDamage: r.barrage!.costPerDamage, cap: r.barrage!.cap, depth, reason };
  }

  /** S25 r4: the interior Barrage line (dungeon rail; absent until learned). */
  dungeonBarrageOption(): { costPerDamage: number; cap: number; depth: number; armed: number; reason: string | null } | null {
    if (!this.world || this.screen.kind !== "dungeon" || !this.world.activeDungeon) return null;
    const r = powerRates(this.world, "R");
    if (!r.unlocked) return null;
    const armed = this.world.activeDungeon.armedBarrage ?? 0;
    const depth = fuelDepth(fuelCandidates(this.world, this.pool, "R"));
    const room = r.barrage!.cap - armed;
    const reason = room <= 0 ? `armed to the cap (${r.barrage!.cap})` : depth < r.barrage!.costPerDamage ? "no red spares to burn" : null;
    return { costPerDamage: r.barrage!.costPerDamage, cap: r.barrage!.cap, depth, armed, reason };
  }

  /** Open the fuel picker for a power action (the rail and the parley menu both come here). */
  openPower(action: NonNullable<WorldController["fuelPicker"]>["action"]): void {
    if (!this.world) return;
    const color: PowerColor = action.kind === "stride" ? "G" : action.kind === "balm" ? "W" : action.kind === "crossing" ? "U" : action.kind === "quietus" ? "B" : "R";
    const r = powerRates(this.world, color);
    if (!r.unlocked) return;
    const cost = this.powerCost(action);
    const candidates = fuelCandidates(this.world, this.pool, color);
    const suggestion = suggestFuel(candidates, cost);
    this.fuelPicker = {
      action, color, cost,
      title: r.name,
      candidates,
      chosen: suggestion ?? [],
      notice: suggestion ? null : fuelDepth(candidates) >= cost ? "only sole-mechanism spares can cover this — choose them deliberately" : `${cost} ${color} spares needed; you hold ${fuelDepth(candidates)}`,
      armed: false,
    };
    this.emit();
  }

  private powerCost(action: NonNullable<WorldController["fuelPicker"]>["action"]): number {
    const w = this.world!;
    switch (action.kind) {
      case "stride": return powerRates(w, "G").stride!.cost;
      case "balm": return action.lives * powerRates(w, "W").balm!.costPerLife;
      case "crossing": return powerRates(w, "U").crossing!.cost;
      case "quietus": return this.screen.kind === "encounter" ? powerRates(w, "B").quietus!.costs[this.screen.encounter.tier] : 0;
      case "barrage": return action.damage * powerRates(w, "R").barrage!.costPerDamage;
    }
  }

  /** Balm lives / Barrage damage stepper — recosts and re-suggests. */
  pickerSetAmount(n: number): void {
    if (!this.world || !this.fuelPicker) return;
    const a = this.fuelPicker.action;
    if (a.kind === "balm") {
      const room = Math.max(1, (this.maxLife() ?? 1) - this.world.player.worldLife);
      a.lives = Math.max(1, Math.min(room, n));
    } else if (a.kind === "barrage") {
      a.damage = Math.max(1, Math.min(powerRates(this.world, "R").barrage!.cap, n));
    } else return;
    this.fuelPicker.cost = this.powerCost(a);
    this.fuelPicker.chosen = suggestFuel(this.fuelPicker.candidates, this.fuelPicker.cost) ?? [];
    this.fuelPicker.armed = false;
    this.fuelPicker.notice = null;
    this.emit();
  }

  pickerAdd(cardId: string): void {
    const p = this.fuelPicker;
    if (!p) return;
    const cand = p.candidates.find((c) => c.cardId === cardId);
    const used = p.chosen.filter((id) => id === cardId).length;
    if (!cand || used >= cand.available || p.chosen.length >= p.cost) return;
    p.chosen.push(cardId);
    p.armed = false;
    p.notice = null;
    this.emit();
  }

  pickerRemove(cardId: string): void {
    const p = this.fuelPicker;
    if (!p) return;
    const i = p.chosen.indexOf(cardId);
    if (i >= 0) p.chosen.splice(i, 1);
    p.armed = false;
    p.notice = null;
    this.emit();
  }

  pickerSuggest(): void {
    const p = this.fuelPicker;
    if (!p) return;
    p.chosen = suggestFuel(p.candidates, p.cost) ?? [];
    p.armed = false;
    this.emit();
  }

  pickerCancel(): void {
    this.fuelPicker = null;
    this.emit();
  }

  /** Confirm the burn. A pick containing a sole-mechanism card arms a second confirm first —
   * "there is exactly one, and it was yours" (the permanent-loss warning, design §1). */
  pickerConfirm(): void {
    const p = this.fuelPicker;
    if (!this.world || !p) return;
    if (p.chosen.length !== p.cost) {
      p.notice = `${p.cost} cards needed — ${p.chosen.length} chosen`;
      this.emit();
      return;
    }
    const soles = p.chosen.filter((id) => p.candidates.find((c) => c.cardId === id)?.soleMechanism);
    if (soles.length > 0 && !p.armed) {
      p.armed = true;
      p.notice = `${soles.map((id) => this.pool.get(id)?.name ?? id).join(", ")}: there is exactly one, and it was yours. Burn it forever? Confirm again.`;
      this.emit();
      return;
    }
    const a = p.action;
    this.fuelPicker = null;
    switch (a.kind) {
      case "stride": {
        const r = activateStride(this.world, this.pool, p.chosen);
        this.notice(r.ok ? `The Stride carries you — ${r.durationSteps} steps at double pace.` : r.reason);
        break;
      }
      case "balm": {
        const r = applyBalm(this.world, this.pool, a.lives, p.chosen);
        this.notice(r.ok ? `The Balm restores ${r.healed} — ${this.world.player.worldLife}/${this.maxLife()}.` : r.reason);
        break;
      }
      case "crossing": {
        const r = applyCrossing(this.world, this.pool, a.townIndex, p.chosen);
        if (!r.ok) { this.notice(r.reason); break; }
        this.autosave();
        const town = this.world.map.towns[a.townIndex]!;
        this.resumePath = null;
        if (isTownOccupied(this.world, a.townIndex)) {
          this.screen = { kind: "siegeTelegraph", townIndex: a.townIndex, notice: "The Crossing sets you at the gate — the town is theirs, for now." };
          this.emit();
        } else {
          this.enterTown(town);
        }
        return;
      }
      case "quietus": {
        if (this.screen.kind !== "encounter") return;
        const enc = this.screen.encounter;
        const r = quietusStrike(this.world, this.catalog, this.pool, enc, p.chosen);
        if (!r.ok) { this.screen = { ...this.screen, notice: r.reason }; this.emit(); return; }
        this.autosave();
        // Dueltune rings at the menu; the screen change fades it — then the quiet.
        const loot = r.anteWon.map((id) => this.pool.get(id)?.name ?? id).join(", ");
        this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: `The Quietus takes them without a blow. Their stake is yours${loot ? ` (${loot})` : ""} — no gold, and only fear spreads.` };
        this.emit();
        return;
      }
      case "barrage": {
        // S25 r4: the interior form — arm the NEXT fight in this dungeon (the boons' hold-or-spend
        // shape: fuel burns now, the damage opens whichever battle comes; dies with the run).
        if (this.screen.kind === "dungeon" && this.world.activeDungeon) {
          const run = this.world.activeDungeon;
          const cap = powerRates(this.world, "R").barrage!.cap;
          if ((run.armedBarrage ?? 0) + a.damage > cap) { this.screen = { ...this.screen, notice: `the Barrage caps at ${cap} (already armed: ${run.armedBarrage ?? 0})` }; this.emit(); return; }
          const paid = payBarrage(this.world, this.pool, a.damage, p.chosen);
          if (!paid.ok) { this.screen = { ...this.screen, notice: paid.reason }; this.emit(); return; }
          run.armedBarrage = (run.armedBarrage ?? 0) + a.damage;
          this.autosave();
          this.screen = { ...this.screen, notice: `The Barrage is armed — the next fight here opens with ${run.armedBarrage} damage already dealt.` };
          this.emit();
          return;
        }
        if (this.screen.kind !== "encounter") return;
        const enc = this.screen.encounter;
        const r = barrageFight(this.world, this.catalog, this.pool, enc, a.damage, p.chosen, this.extraKnobs);
        if (!r.ok) { this.screen = { ...this.screen, notice: r.reason }; this.emit(); return; }
        if (r.outcome.type === "fight") this.startDuel(r.outcome.duel, null);
        return;
      }
    }
    this.autosave();
    this.emit();
  }

  private maxLife(): number {
    return this.world ? maxWorldLife(this.world) : 0;
  }

  private startDuel(duel: PreparedDuel, _notice: string | null): void {
    if (!this.world) return;
    const tmpl = this.catalog.opponents.find((o) => o.id === duel.encounter.catalogId)!;
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: duel.seed,
      aiDelayMs: this.aiDelay(),
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

  /** S25: the power-dungeon content entry (power_w …). */
  powerDef(dungeonId: string): PowerDungeonDef | undefined {
    return (this.catalog.powerDungeons ?? []).find((d) => d.id === dungeonId);
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
      const color = (this.strongholdDef(info.dungeonId)?.color ?? this.moxDef(info.dungeonId)?.color ?? this.powerDef(info.dungeonId)?.color ?? this.catalog.opponents.find((o) => o.id === info.residentCatalogId)?.spoke ?? "G") as "W" | "U" | "B" | "R" | "G";
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
        // S25 (the great swap): the Moxen pass to the gem-titled court.
        const g = COURT_DECKS[mox.guardian.key]!;
        enemy = { kind: "guardian", name: mox.guardian.name, decklist: g.decklist, archetype: g.archetype, life: mox.guardian.life, color: mox.color };
        portrait = mox.guardian.portrait;
      } else if (run.kind === "power") {
        // S25: the real legends guard the power-dungeons — their S20 decks traveled whole.
        const pd = this.powerDef(run.dungeonId)!;
        const g = GUARDIAN_DECKS[pd.guardian.key]!;
        enemy = { kind: "guardian", name: pd.guardian.name, decklist: g.decklist, archetype: g.archetype, life: pd.guardian.life, color: pd.color };
        portrait = pd.guardian.portrait;
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
    // S25 r4 (Chris: the Barrage never reached the interiors): the armed damage opens this fight.
    const { spec, enemyName } = dungeonDuelSpec(this.world, this.catalog, this.knobs, run, enemy, law, rng, extraModifiers, run.armedBarrage ? { enemyLifeDelta: -run.armedBarrage } : {});
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelay(),
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: enemyName, decklist: spec.players[1].decklist, difficulty: (spec.players[1].agent.split(":")[1] ?? "journeyman") as "apprentice" | "journeyman" | "master", archetype: enemy.kind === "minion" ? "midrange" : enemy.archetype, ...(portrait ? { portrait } : {}) },
        rules: { startingLife: spec.rules.startingLife, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) }, // S22 r2: the coin flip rides through
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "dungeonDuel", enemyName, match, against };
    this.emit();
    // S25 playtest r2 (Chris: the Usher fight never reached Recent Battles): interior fights
    // record like overworld ones — the spec rides to the finisher for the saved-game payload.
    const rec = { seed: spec.seed, spec, enemyName, ...(enemy.kind === "minion" ? { catalogId: enemy.tmpl.id } : {}) };
    void match.start().then((result) => this.finishInteriorDuel(against, result, rec));
  }

  private finishInteriorDuel(against: { minionId?: string; guardian?: boolean }, result: MatchResult, rec?: { seed: number; spec: MatchSpec; enemyName: string; catalogId?: string }): void {
    if (!this.world) return;
    const run = this.world.activeDungeon!;
    const out = applyInteriorDuel(this.world, this.knobs, run, result, against.minionId, this.catalog, rec);
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
      } else if (run.kind === "power") {
        // S25 (ADR-088): the power pays out WITH the treasure — escrow law satisfied by living
        // in the victory branch only (walk-out and defeat never reach here).
        const pd = this.powerDef(run.dungeonId)!;
        const roll = colorPrizeRoll(this.world, this.pool, run.dungeonId, pd.color);
        prize = { gold: 0, cardIds: [pd.prize.guardianCard, ...(roll ? [roll] : [])] };
        name = pd.name;
        unlockPower(this.world, pd.color);
        victoryNotes.push(`You have learned ${powerRates(this.world, pd.color).name} — it waits on the Powers panel${pd.color === "B" || pd.color === "R" ? " and at every parley" : ""}.`);
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

  // ---------- S26 r1 (Chris): the DEV menu — autocomplete the fifteen in-world dungeons ----------

  /** The fifteen authored sites with their cleared state, for the dev menu's rows. */
  devDungeonRows(): { id: string; kind: "mox" | "power" | "stronghold"; name: string; cleared: boolean }[] {
    if (!this.world) return [];
    const w = this.world;
    return [
      ...this.catalog.dungeons.map((m) => ({ id: m.id, kind: "mox" as const, name: m.name, cleared: !!w.dungeons[m.id]?.cleared })),
      ...(this.catalog.powerDungeons ?? []).map((d) => ({ id: d.id, kind: "power" as const, name: d.name, cleared: !!w.dungeons[d.id]?.cleared })),
      ...(this.catalog.strongholdContent ?? []).map((c) => ({ id: c.id, kind: "stronghold" as const, name: c.name, cleared: !!w.dungeons[c.id]?.cleared })),
    ];
  }
  /** Complete one site as if its guardian had fallen: cleared = ground, and the prize that unlocks
   * things — the Mox + guardian card, the power + guardian card, the lord's card + the SEAL. No
   * escrow, no colour roll, no renown (a dev shortcut, not a ceremony). Autosaved. */
  devCompleteDungeon(id: string): boolean {
    if (!this.world) return false;
    const w = this.world;
    const mark = () => { (w.dungeons[id] ??= { cleared: false, resets: 0 }).cleared = true; };
    const mox = this.moxDef(id);
    if (mox) { mark(); addToCollection(w, [mox.prize.mox, mox.prize.guardianCard], "reward"); this.autosave(); return true; }
    const pd = this.powerDef(id);
    if (pd) { mark(); addToCollection(w, [pd.prize.guardianCard], "reward"); unlockPower(w, pd.color); this.autosave(); return true; }
    const sh = this.strongholdDef(id);
    if (sh) { mark(); addToCollection(w, [sh.lord.cardId], "reward"); strongholdState(w, sh.color).seal = true; this.autosave(); return true; }
    return false;
  }
  /** Complete every site of a kind (or all fifteen). Returns how many newly fell. */
  devCompleteAll(kind?: "mox" | "power" | "stronghold"): number {
    let n = 0;
    for (const row of this.devDungeonRows()) if ((!kind || row.kind === kind) && !row.cleared && this.devCompleteDungeon(row.id)) n += 1;
    if (this.screen.kind === "map") this.screen = { ...this.screen, notice: n ? `Dev: ${n} site${n === 1 ? "" : "s"} completed — ${sealsHeld(this.world!)}/5 seals held; the doors at the centre read the new counts.` : "Dev: nothing left to complete." };
    this.emit();
    return n;
  }

  // ---------- S26 (ADR-091): the Corolla + the Vault ----------

  /** S26 r2 (Chris notes 3–4): the Corolla's fights ring the usual result stings — the UI watches
   * this sequence (win/loss) the way it watches treasureSeq. */
  resultSting: { seq: number; outcome: "win" | "loss" } = { seq: 0, outcome: "win" };
  private ringResult(outcome: "win" | "loss"): void { this.resultSting = { seq: this.resultSting.seq + 1, outcome }; }

  get corollaDef(): CorollaDef | null {
    return this.catalog.corolla ?? null;
  }
  private corollaGeom: CorollaGeometry | null = null;
  /** The flower's shape (pure from the knob; memoized). */
  corollaGeometry(): CorollaGeometry {
    if (!this.corollaGeom || this.corollaGeom.size !== Math.max(21, this.knobs.corollaGridSize | 1)) this.corollaGeom = generateCorolla(this.knobs.corollaGridSize);
    return this.corollaGeom;
  }
  petalLawNames(): Partial<Record<PetalColor, string>> {
    const out: Partial<Record<PetalColor, string>> = {};
    for (const c of PETAL_ORDER) { const n = petalLawName(this.catalog, c); if (n) out[c] = n; }
    return out;
  }
  /** The flower as a map for the renderer's corolla register (fallen tips marked cleared). */
  corollaMap(): WorldMap | null {
    if (!this.world || !this.corollaDef) return null;
    return corollaAsWorldMap(this.corollaGeometry(), this.corollaDef, this.petalLawNames(), new Set(petalsFallen(this.world)));
  }
  /** The rail: one row per petal — its law, its boss, fallen or standing, how far the tip is. */
  petalRows(): { color: PetalColor; lawName: string; bossName: string; fallen: boolean; distance: number; tip: Point }[] {
    const def = this.corollaDef;
    if (!this.world || !def) return [];
    const fallen = new Set(petalsFallen(this.world));
    const g = this.corollaGeometry();
    return PETAL_ORDER.map((color) => {
      const pd = def.petals.find((p) => p.color === color)!;
      return { color, lawName: petalLawName(this.catalog, color) ?? color, bossName: pd.boss.name, fallen: fallen.has(color), distance: petalDistance(g, color), tip: g.petals.find((p) => p.color === color)!.tip };
    });
  }
  /** Standing on one of the centre doors (the map's transport offers a knock). */
  doorHere(): "corolla" | "vault" | null {
    if (!this.world || this.screen.kind !== "map") return null;
    const f = fixedPointAt(this.world.map, this.world.player.position);
    if (f?.kind === "corolla") return "corolla";
    if (f?.kind === "vault" && this.world.gauntlet.vault !== "cleared") return "vault";
    return null;
  }
  knock(): void {
    if (!this.world) return;
    const d = this.doorHere();
    if (d === "corolla") {
      const s = corollaDoor(this.world);
      this.screen = { kind: "corollaTelegraph", at: { ...this.world.player.position }, seals: s.seals, open: s.open, notice: null };
    } else if (d === "vault") {
      const v = vaultDoor(this.world);
      this.screen = { kind: "vaultTelegraph", at: { ...this.world.player.position }, moxen: v.moxen, open: v.open, notice: null };
    } else return;
    this.emit();
  }

  /** The petals part: enter (or resume — reload lands you where you stood). Autosaved: a consequence. */
  enterCorolla(): void {
    if (!this.world || this.screen.kind !== "corollaTelegraph" || !this.screen.open || !this.corollaDef) return;
    if (!insideCorolla(this.world)) enterCorolla(this.world, this.corollaGeometry());
    this.autosave();
    const fallen = petalsFallen(this.world).length;
    this.screen = { kind: "corolla", notice: fallen ? `The petals part again. ${fallen} of five have fallen; the flower remembers.` : "The petals part. Five tips, five laws returned; the town waits at the heart.", walking: false };
    this.emit();
  }
  declineCorolla(): void {
    if (this.screen.kind !== "corollaTelegraph") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
  }
  /** Walk back out (any time): the flower keeps its wounds; you stand at the door you never left. */
  leaveCorolla(): void {
    if (!this.world || !insideCorolla(this.world)) return;
    leaveCorolla(this.world);
    this.autosave();
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "You step back through the petals. The flower keeps what fell; the rest still stands." };
    this.emit();
  }

  corollaClick(p: Point): void {
    if (!this.world || this.screen.kind !== "corolla" || this.screen.walking) return;
    const inside = insideCorolla(this.world);
    const map = this.corollaMap();
    if (!inside || !map) return;
    const path = corollaPath(map, inside.position, p);
    if (!path || path.length === 0) {
      // Standing on the town or a tip already: open it.
      const g = this.corollaGeometry();
      if (samePoint(inside.position, g.town)) return this.enterHeartTown();
      const petal = petalAt(g, inside.position);
      if (petal && !petalsFallen(this.world).includes(petal.color)) { this.screen = { kind: "petalTelegraph", color: petal.color }; this.emit(); }
      return;
    }
    void this.corollaWalk(path);
  }
  private async corollaWalk(path: Point[]): Promise<void> {
    if (!this.world || this.screen.kind !== "corolla") return;
    const g = this.corollaGeometry();
    this.screen = { ...this.screen, walking: true };
    this.emit();
    for (const cell of path) {
      if (!this.world || this.screen.kind !== "corolla") return;
      const events = corollaAdvance(this.world, g, [cell]);
      this.emit();
      for (const e of events) {
        if (e.type === "petal") {
          this.autosave();
          this.screen = { kind: "petalTelegraph", color: e.color };
          this.emit();
          return;
        }
        if (e.type === "heart") {
          this.autosave();
          this.enterHeartTown();
          return;
        }
      }
      if (this.stepMs > 0) await new Promise((r) => setTimeout(r, this.stepMs));
    }
    if (this.screen.kind === "corolla") {
      this.autosave(); // position is a consequence (reload resumes here)
      this.screen = { ...this.screen, walking: false };
      this.emit();
    }
  }

  /** The petal's telegraph: the boss, the returned law, the stakes — fight or step back. */
  fightPetal(): void {
    if (this.screen.kind !== "petalTelegraph") return;
    this.startPetalDuel(this.screen.color);
  }
  declinePetal(): void {
    if (this.screen.kind !== "petalTelegraph") return;
    this.screen = { kind: "corolla", notice: "You step back from the tip. It will be here.", walking: false };
    this.emit();
  }
  private startPetalDuel(color: PetalColor): void {
    const def = this.corollaDef;
    if (!this.world || !def) return;
    const petal = def.petals.find((p) => p.color === color)!;
    const boss = COROLLA_DECKS[petal.boss.key]!;
    const rng = new DungeonRng(this.world.rng);
    const { spec, enemyName } = petalDuelSpec(this.world, this.catalog, this.knobs, def, petal, { name: boss.name, decklist: boss.decklist, archetype: boss.archetype }, rng);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelay(),
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: enemyName, decklist: spec.players[1].decklist, difficulty: "master", archetype: boss.archetype, portrait: petal.boss.portrait },
        rules: { startingLife: spec.rules.startingLife, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) },
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "corollaDuel", enemyName, match, against: { petal: color } };
    this.emit();
    const rec = { seed: spec.seed, spec, enemyName };
    void match.start().then((result) => this.finishPetalDuel(color, result, rec));
  }
  private finishPetalDuel(color: PetalColor, result: MatchResult, rec: { seed: number; spec: MatchSpec; enemyName: string }): void {
    const def = this.corollaDef;
    if (!this.world || !def) return;
    const petal = def.petals.find((p) => p.color === color)!;
    const out = applyPetalDuel(this.world, this.knobs, this.pool, petal, result, rec);
    this.autosave();
    this.ringResult(out.type === "win" ? "win" : "loss");
    if (out.type === "loss") {
      if (this.world.gameOver) { this.screen = { kind: "gameOver", fatal: this.world.duels[this.world.duels.length - 1] ?? null }; this.emit(); return; }
      this.screen = { kind: "corolla", notice: `${this.catalog.questText?.corolla?.petalLost ?? "The petal holds. You are left where you fell."} A world life and your stake${out.anteLost.length ? ` (${out.anteLost.map((id) => this.pool.get(id)?.name ?? id).join(", ")})` : ""} are gone.`, walking: false };
      this.emit();
      return;
    }
    this.screen = { kind: "petalVictory", color, bossName: petal.boss.name, paidGold: out.paidGold, paidCards: out.paidCards, anteWon: out.anteWon, anteWithheld: out.anteWithheld, fallen: petalsFallen(this.world).length, ministerWithheld: out.ministerWithheld };
    this.emit();
  }
  continueAfterPetalVictory(): void {
    if (this.screen.kind !== "petalVictory") return;
    const n = this.screen.fallen;
    this.screen = { kind: "corolla", notice: n >= 5 ? "Five petals have fallen. The Heart's door stands at the town." : `${n} of five petals fallen.`, walking: false };
    this.emit();
  }

  /** The town at the heart: the inn, the R-drawer shelf, the Heart's door. */
  enterHeartTown(): void {
    if (!this.world) return;
    this.screen = { kind: "corollaTown", stock: rollCorollaStock(this.world, this.pool, this.knobs), notice: null };
    this.emit();
  }
  leaveHeartTown(): void {
    if (this.screen.kind !== "corollaTown") return;
    this.screen = { kind: "corolla", notice: null, walking: false };
    this.emit();
  }
  corollaBuy(item: ShopItem, toDeck = false): void {
    if (!this.world || this.screen.kind !== "corollaTown" || !this.corollaDef) return;
    const town = corollaTown(this.corollaDef, this.corollaGeometry());
    const out = buyCard(this.world, town, item, this.knobs, toDeck);
    this.autosave();
    this.screen = { kind: "corollaTown", stock: rollCorollaStock(this.world, this.pool, this.knobs), notice: out.ok ? `Bought ${this.pool.get(item.cardId)?.name ?? item.cardId} for ${out.price} gold${out.addedToDeck ? " — added to your deck" : out.note ? ` (${out.note})` : ""}.` : out.reason };
    this.emit();
  }
  corollaRest(): void {
    if (!this.world || this.screen.kind !== "corollaTown") return;
    const healed = corollaInnRest(this.world);
    this.autosave();
    this.screen = { ...this.screen, notice: healed > 0 ? `You rest. Time does not pass in the flower: +${healed} life, and nothing in the world moved.` : "Nothing ails you." };
    this.emit();
  }

  /** S27: the Heart — the Manafleur behind the town's door (open at five petals). */
  heartOpen(): boolean {
    return !!this.world && !!this.corollaDef?.heart && heartDoor(this.world).open;
  }
  openHeart(): void {
    if (!this.heartOpen() || this.screen.kind !== "corollaTown") return;
    this.screen = { kind: "heartTelegraph" };
    this.emit();
  }
  declineHeart(): void {
    if (this.screen.kind !== "heartTelegraph") return;
    this.enterHeartTown();
  }
  fightHeart(): void {
    if (!this.world || this.screen.kind !== "heartTelegraph" || !this.corollaDef?.heart) return;
    const rng = new DungeonRng(this.world.rng);
    const { spec, enemyName } = heartDuelSpec(this.world, this.catalog, this.knobs, this.corollaDef, { name: HEART_DECK.name, decklist: HEART_DECK.decklist, archetype: HEART_DECK.archetype }, rng);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelay(),
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: enemyName, decklist: spec.players[1].decklist, difficulty: "master", archetype: HEART_DECK.archetype, portrait: this.corollaDef.heart.boss.portrait },
        rules: { startingLife: spec.rules.startingLife, ante: 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) },
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "corollaDuel", enemyName, match, against: { heart: true } };
    this.emit();
    const rec = { seed: spec.seed, spec, enemyName };
    void match.start().then((result) => this.finishHeartDuel(result, rec));
  }
  private finishHeartDuel(result: MatchResult, rec: { seed: number; spec: MatchSpec; enemyName: string }): void {
    if (!this.world) return;
    const legacy = this.legacy();
    const pack = this.catalog.questText?.heart;
    const out = applyHeartDuel(this.world, this.catalog, this.knobs, result, { cuttingsSoFar: legacy.victories, text: (c) => pack?.chronicle[c] ?? `Cut from the ${c} road.` }, rec);
    this.ringResult(out.type === "win" ? "win" : "loss");
    if (out.type === "loss") {
      this.autosave();
      if (this.world.gameOver) { this.screen = { kind: "gameOver", fatal: this.world.duels[this.world.duels.length - 1] ?? null }; this.emit(); return; }
      this.screen = { kind: "corollaTown", stock: rollCorollaStock(this.world, this.pool, this.knobs), notice: pack?.loss ?? "The flower stands. Rest, and return; it will be here." };
      this.emit();
      return;
    }
    // The ledger: the run's entry copies into the profile the moment it is written (durability).
    const next = recordCutting(legacy, out.entry);
    this.writeLegacy(next);
    this.autosave();
    this.screen = { kind: "heartVictory", entry: out.entry, paidCards: out.paidCards, first: out.first, fifth: cutColors(next).length >= 5 && next.victories >= 5 };
    this.emit();
  }
  /** The offer: stay in the quiet world (the heart's town), or a new road (the start screen). */
  stayAfterHeart(): void {
    if (!this.world || this.screen.kind !== "heartVictory") return;
    this.screen = { kind: "corollaTown", stock: rollCorollaStock(this.world, this.pool, this.knobs), notice: this.catalog.questText?.heart?.victory ?? "The flower folds. For now." };
    this.emit();
  }
  newRoadAfterHeart(): void {
    if (this.screen.kind !== "heartVictory") return;
    this.autosave();
    this.screen = { kind: "start" };
    this.emit();
  }
  /** The chronicle's ledger for the page (profile entries; the current run's own are already there). */
  chronicle(): ChronicleEntry[] { return this.legacy().chronicle; }
  /** The run's starting colour (for the rail and the new-road line). */
  startColor(): PetalColor | null { return this.world ? startingColor(this.world, this.catalog) : null; }

  /** The Vault's telegraph → the Mirror. */
  enterVault(): void {
    if (!this.world || this.screen.kind !== "vaultTelegraph" || !this.screen.open) return;
    const rng = new DungeonRng(this.world.rng);
    const { spec, archetype } = mirrorDuelSpec(this.world, this.knobs, this.pool, rng);
    this.world.rng = rng.state();
    this.autosave();
    const match = new MatchController(this.pool, {
      humanSeat: 0,
      seed: spec.seed,
      aiDelayMs: this.aiDelay(),
      custom: {
        human: { name: this.world.player.name, decklist: spec.players[0].decklist },
        enemy: { name: "Your reflection", decklist: spec.players[1].decklist, difficulty: "master", archetype, portrait: "reflection" }, // S26 r2 (Chris note 2): the mirrored player portrait under /portraits/
        rules: { startingLife: spec.rules.startingLife, ante: 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) },
        modifiers: spec.modifiers,
      },
    });
    this.screen = { kind: "corollaDuel", enemyName: "Your reflection", match, against: { mirror: true } };
    this.emit();
    const rec = { seed: spec.seed, spec };
    void match.start().then((result) => this.finishMirrorDuel(result, rec));
  }
  declineVault(): void {
    if (this.screen.kind !== "vaultTelegraph") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    this.emit();
  }
  private finishMirrorDuel(result: MatchResult, rec: { seed: number; spec: MatchSpec }): void {
    if (!this.world) return;
    const out = applyMirrorDuel(this.world, this.knobs, result, rec);
    this.autosave();
    this.ringResult(out.type === "win" ? "win" : "loss");
    if (out.type === "loss") {
      if (this.world.gameOver) { this.screen = { kind: "gameOver", fatal: this.world.duels[this.world.duels.length - 1] ?? null }; this.emit(); return; }
      this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "Your reflection knew your deck better. A world life is gone; the Vault waits." };
      this.emit();
      return;
    }
    this.screen = { kind: "mirrorVictory" };
    this.emit();
  }
  continueAfterMirrorVictory(): void {
    if (this.screen.kind !== "mirrorVictory") return;
    this.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: "The Black Lotus is yours. There is exactly one, and now it is yours. The Vault is empty ground." };
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
      aiDelayMs: this.aiDelay(),
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
    void match.start().then((result) => this.finishSiegeDuel(townIndex, result, { seed: spec.seed, spec }));
  }

  private finishSiegeDuel(townIndex: number, result: MatchResult, rec?: { seed: number; spec: MatchSpec }): void {
    if (!this.world) return;
    const entry = siegeFor(this.world, townIndex)!;
    const town = this.world.map.towns[townIndex]!;
    const out = applySiegeDuel(this.world, this.catalog, this.knobs, entry, town, result, rec);
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
