/**
 * S21 Part 2 — sieges (overworld manifest §5; the session's milestone).
 *
 * Enemies periodically strike towns on SEEDED SIEGE TIMERS riding the step clock (consumer #3,
 * after encounters and quest deadlines). A town under threat TELEGRAPHS visibly (§5's
 * visible-schedules law) for a warning window; unrelieved, it FALLS to the besieging party —
 * shopping, quest boards, and the town's granted manalinks SUSPEND until the player liberates it.
 *
 * Defense (relieving before the fall) and liberation are ENGAGEMENTS: consecutive duels against
 * the party with life gain and loss persisting between fights, dungeon-style (Chris-ruled for
 * liberation; the planner extended the carryover to defense for consistency — flagged for the
 * round if it plays wrong). Engagement life seeds from world life at commitment and is discarded
 * at the end; an individual LOSS pays the ordinary world consequences (ante forfeit, life
 * penalty) and the party regroups to full strength. Ante won inside goes straight to the
 * collection (sieges have no escrow — the mountain's rule is the dungeon's, not the town's).
 *
 * All siege state lives in the reserved `world.sieges` array (S19's reserved-field trick cashes:
 * no save-version bump — entries are created lazily per town). An engagement in progress is in
 * the save; reload resumes it (durability law: autosave at every siege consequence).
 */
import type { MatchResult, MatchSpec, Modifier } from "@shandalar/engine";
import { enemyDeck, type Catalog, type OpponentTemplate } from "./catalog.js";
import { manalinkModifiers } from "./quests.js";
import type { KnobValues } from "./knobs.js";
import type { Town } from "./map.js";
import { WorldRng } from "./rng.js";
import { activeDeck, type WorldState } from "./state.js";
// NOTE: journey.ts imports this module (advance() ticks sieges) and this module imports
// journey.ts (the engagement consequences reuse the one ante/collection/renown entry point —
// the S17 "one discard entry point" lesson applied to world consequences). The ESM cycle is
// deliberate and safe: every cross-call happens at call time, never at module init.
import { creditRenown, deckLegal, forfeitCards, addToCollection } from "./journey.js";
import { creditSpokeKill, lordSealed } from "./stronghold.js";

// ---------- State (lives in the reserved `sieges` array — no save bump) ----------

export interface SiegeEngagement {
  kind: "defense" | "liberation";
  /** Party members left to fight, in order (index 0 = next). */
  remaining: string[];
  /** The engagement life track — seeded from world life at commitment, carried fight to
   * fight (gain and loss), discarded at the end. */
  life: number;
  /** S22 playtest r3 (Chris, item 10): the running spoils — gold and ante cards won across the
   * engagement's fights, so the victory ceremony can name the whole purse. Optional (older
   * saves lack them); defaulted at accumulation. */
  goldWon?: number;
  anteWon?: string[];
}

export interface SiegeEntry {
  townIndex: number;
  /** Sieges resolved at this town (reseeds every schedule/party roll). */
  epoch: number;
  status: "quiet" | "threatened" | "occupied";
  /** Quiet: the step at which the next threat lands (−1 = this ring never sees sieges). */
  nextThreatStep: number;
  /** Threatened: the town falls at the END of this step if unrelieved. */
  deadlineStep?: number;
  /** The besieging/occupying party (catalog ids; the leader fights last). */
  party?: string[];
  occupiedAtStep?: number;
  /** A defense/liberation in progress (reload resumes it). */
  engagement?: SiegeEngagement;
}

export type SiegeEvent =
  | { type: "siegeThreatened"; townIndex: number; townName: string; deadlineStep: number }
  | { type: "siegeFell"; townIndex: number; townName: string };

// ---------- Schedule + party (throwaway streams — S19 rule: derivations never touch the journey RNG) ----------

const rngFor = (world: WorldState, townIndex: number, epoch: number, tag: string): WorldRng => {
  let h = 2166136261 >>> 0;
  for (const ch of `${townIndex}:${epoch}:${tag}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return new WorldRng(((world.seed * 2246822519) ^ h) >>> 0);
};

const townRing = (world: WorldState, town: Town) => world.map.regions[town.region]!.tier;
const townColor = (world: WorldState, town: Town) => world.map.regions[town.region]!.color;

/** The next threat step for a town: base + interval jittered ±25% (seeded per town/epoch). −1 = never. */
export function scheduleNextThreat(world: WorldState, knobs: KnobValues, town: Town, epoch: number, baseStep: number): number {
  const interval = knobs.siegeIntervalSteps[townRing(world, town)];
  if (!interval || interval <= 0) return -1;
  const rng = rngFor(world, town.index, epoch, "schedule");
  return baseStep + Math.max(1, Math.round(interval * (0.75 + rng.float() * 0.5)));
}

/** The besieging party: ring-sized, drawn from the spoke's mage-class templates (tier ≤ 2),
 * ordered weakest→strongest so the leader holds the town's heart (fights last). */
export function rollSiegeParty(world: WorldState, catalog: Catalog, knobs: KnobValues, town: Town, epoch: number): string[] {
  const size = Math.max(1, knobs.siegePartySize[townRing(world, town)]);
  const color = townColor(world, town);
  const rng = rngFor(world, town.index, epoch, "party");
  const spoke = catalog.opponents.filter((o) => o.kind !== "beast" && o.spoke === color && o.tier <= 2);
  const anywhere = catalog.opponents.filter((o) => o.kind !== "beast" && !o.spoke && o.tier <= 2);
  const pool = spoke.length ? spoke : anywhere;
  const party: OpponentTemplate[] = [];
  for (let i = 0; i < size; i++) party.push(rng.pick(pool));
  party.sort((a, b) => a.tier - b.tier || a.worldLife - b.worldLife);
  return party.map((t) => t.id);
}

// ---------- The step tick (clock consumer #3) ----------

export function siegeEntry(world: WorldState, knobs: KnobValues, town: Town): SiegeEntry {
  const sieges = world.sieges as SiegeEntry[];
  let e = sieges.find((s) => s.townIndex === town.index);
  if (!e) {
    // S22 playtest r3: the opening grace — the first threat schedules from siegeGraceSteps,
    // not step 0 (Last Chapel fell before Chris had heard its name).
    e = { townIndex: town.index, epoch: 0, status: "quiet", nextThreatStep: scheduleNextThreat(world, knobs, town, 0, knobs.siegeGraceSteps) };
    sieges.push(e);
  }
  return e;
}

/** One clock tick for every town. Threats land, deadlines fall — occupation persists until
 * liberated. Mutates the entries; emits events for the walk's notice stream. */
export function siegesOnStep(world: WorldState, catalog: Catalog, knobs: KnobValues): SiegeEvent[] {
  const events: SiegeEvent[] = [];
  const steps = world.player.stepsTaken;
  for (const town of world.map.towns) {
    const e = siegeEntry(world, knobs, town);
    // S22 playtest r3 (Chris, item 12): a sealed lord's spoke lands no NEW sieges — his
    // besieging parties are his minions. A threat already telegraphing still resolves,
    // and an occupation stands until liberated (existing consequences remain to be cleared).
    if (e.status === "quiet" && lordSealed(world, townColor(world, town))) continue;
    if (e.status === "quiet" && e.nextThreatStep >= 0 && steps >= e.nextThreatStep) {
      e.status = "threatened";
      e.deadlineStep = steps + knobs.siegeWarningSteps;
      e.party = rollSiegeParty(world, catalog, knobs, town, e.epoch);
      events.push({ type: "siegeThreatened", townIndex: town.index, townName: town.name, deadlineStep: e.deadlineStep });
    } else if (e.status === "threatened" && e.deadlineStep !== undefined && steps > e.deadlineStep) {
      e.status = "occupied";
      e.occupiedAtStep = steps;
      delete e.engagement; // a mid-defense save that dawdled past the deadline: the defense is moot
      events.push({ type: "siegeFell", townIndex: town.index, townName: town.name });
    }
  }
  return events;
}

// ---------- Status predicates (the suspension hooks) ----------

export function siegeFor(world: WorldState, townIndex: number): SiegeEntry | undefined {
  return (world.sieges as SiegeEntry[]).find((s) => s.townIndex === townIndex);
}

export function isTownOccupied(world: WorldState, townIndex: number): boolean {
  return siegeFor(world, townIndex)?.status === "occupied";
}

export function isTownThreatened(world: WorldState, townIndex: number): boolean {
  return siegeFor(world, townIndex)?.status === "threatened";
}

/** Rail/warning surface: every non-quiet town with its countdown. */
export function siegeWarnings(world: WorldState): { townIndex: number; status: "threatened" | "occupied"; stepsLeft?: number }[] {
  const out: { townIndex: number; status: "threatened" | "occupied"; stepsLeft?: number }[] = [];
  for (const s of world.sieges as SiegeEntry[]) {
    if (s.status === "threatened") out.push({ townIndex: s.townIndex, status: "threatened", stepsLeft: Math.max(0, (s.deadlineStep ?? 0) - world.player.stepsTaken) });
    else if (s.status === "occupied") out.push({ townIndex: s.townIndex, status: "occupied" });
  }
  return out;
}

// ---------- Engagements (defense before the fall; liberation after) ----------

/** Commit to the fight (from the telegraph). Resumes if one is already in progress. */
export function beginSiegeEngagement(world: WorldState, entry: SiegeEntry): SiegeEngagement {
  if (entry.engagement) return entry.engagement;
  const kind = entry.status === "occupied" ? "liberation" : "defense";
  entry.engagement = { kind, remaining: [...(entry.party ?? [])], life: world.player.worldLife };
  return entry.engagement;
}

/** MatchSpec for the next party member. Engagement life is the player's startingLife (the carry);
 * the enemy fights at template life; manalinks apply WITH suspension (an occupied town's own
 * link is dark during its liberation — the point of the siege). */
export function siegeDuelSpec(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  entry: SiegeEntry,
  rng: WorldRng,
): { spec: MatchSpec; tmpl: OpponentTemplate; remainingAfter: number } {
  const eng = entry.engagement;
  if (!eng || eng.remaining.length === 0) throw new Error("no engagement in progress");
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot fight: ${legal.reason}`);
  const tmpl = catalog.opponents.find((o) => o.id === eng.remaining[0]);
  if (!tmpl) throw new Error(`catalog has no opponent ${eng.remaining[0]}`);
  const modifiers: Modifier[] = [{ type: "startingLife", player: 1, value: tmpl.worldLife }, ...manalinkModifiers(world)];
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: tmpl.name, decklist: enemyDeck(catalog, tmpl.deck).decklist, agent: `heuristic:${tmpl.difficulty}` },
    ],
    rules: { startingLife: eng.life, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount, startingPlayer: rng.chance(0.5) ? 0 : 1 }, // S22 r2: the coin flip
    modifiers,
  };
  return { spec, tmpl, remainingAfter: eng.remaining.length - 1 };
}

export type SiegeDuelOutcome =
  | { type: "fightWon"; remaining: number; lifeNow: number; anteWon: string[]; goldWon: number }
  /** totalGold/totalAnte: the WHOLE engagement's spoils (r3 item 10 — the ceremony names the purse). */
  | { type: "engagementWon"; kind: SiegeEngagement["kind"]; anteWon: string[]; goldWon: number; totalGold: number; totalAnte: string[] }
  | { type: "loss"; kind: SiegeEngagement["kind"]; anteLost: string[] };

/** Apply one engagement duel. WIN: life carries, ante and gold pay NOW (no escrow), renown
 * credits per the standard defeat law; the last member falling resolves the siege (defense
 * lifts it, liberation frees the town) and reschedules the next threat. LOSS: ordinary loss
 * consequences; the party regroups to full; the siege stands (a defense can be retried until
 * the deadline; an occupation until liberated). Draws count as losses (the walls hold).
 * Caller autosaves after every call — each fight is a consequence. */
export function applySiegeDuel(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  entry: SiegeEntry,
  town: Town,
  result: MatchResult,
): SiegeDuelOutcome {
  const eng = entry.engagement;
  if (!eng) throw new Error("no engagement in progress");
  if (result.winner === 0) {
    const tmpl = catalog.opponents.find((o) => o.id === eng.remaining[0])!;
    eng.remaining.shift();
    eng.life = Math.max(1, result.finalLife[0]);
    const anteWon = [...result.facts.ante[1]];
    addToCollection(world, anteWon, "ante");
    const goldWon = knobs.goldRewardByTier[tmpl.tier];
    world.player.gold += goldWon;
    eng.goldWon = (eng.goldWon ?? 0) + goldWon; // r3 item 10: the running purse
    eng.anteWon = [...(eng.anteWon ?? []), ...anteWon];
    creditRenown(world.player, tmpl.colors, tmpl.tier);
    creditSpokeKill(world, tmpl.colors, tmpl.tier); // S22 r1: siege defenders' kills bleed their lords too (outside = everywhere renown pays)
    if (eng.remaining.length > 0) return { type: "fightWon", remaining: eng.remaining.length, lifeNow: eng.life, anteWon, goldWon };
    const kind = eng.kind;
    const totalGold = eng.goldWon;
    const totalAnte = [...eng.anteWon];
    resolveSiege(world, knobs, entry, town);
    return { type: "engagementWon", kind, anteWon, goldWon, totalGold, totalAnte };
  }
  const anteLost = [...result.facts.ante[0]];
  forfeitCards(world, anteLost);
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  const kind = eng.kind;
  delete entry.engagement; // the party regroups to full strength
  return { type: "loss", kind, anteLost };
}

/** The siege ends in the player's favour: quiet again, epoch advances, the next threat rolls. */
export function resolveSiege(world: WorldState, knobs: KnobValues, entry: SiegeEntry, town: Town): void {
  entry.epoch += 1;
  entry.status = "quiet";
  entry.nextThreatStep = scheduleNextThreat(world, knobs, town, entry.epoch, world.player.stepsTaken);
  delete entry.deadlineStep;
  delete entry.party;
  delete entry.occupiedAtStep;
  delete entry.engagement;
}
