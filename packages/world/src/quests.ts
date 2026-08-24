/**
 * S19 Part 3 — the quests slice (overworld manifest §5; ADR-069 card-courier + manalinks; ADR-078).
 *
 * Shapes shipped: COURIER (carry a token A→B), CARD-COURIER (a predicate-matching card leaves your
 * collection on acceptance and travels instead), BOUNTY (a named signature instance spawned in a
 * target region; reward on ITS defeat). Retrieval and rumor-chains defer to S21 (dungeons).
 *
 * Offers are a pure function of (world seed, town index) over a small authored template table —
 * every town offers ≥1 per game; accepting consumes the offer for the rest of the game. Town
 * interfaces stay clock-free; the deadline clock (the second clock consumer, after respawn) ticks
 * on map steps only. Expiry fails the quest with no further penalty; abandoning likewise (the
 * card-courier's card is already gone — that is the variant's price, stated on the offer).
 *
 * Rewards: gold by tier (knob), a tier-appropriate card (shopTier == quest tier; tier 3 rolls may
 * upgrade to an R card — the first R-acquisition path, ADR-078), or a manalink (tier 2+, the town's
 * colour, cap one per colour by knob; a `permanentOnBattlefield` modifier in every duel — zero
 * engine work per the manifest's implementation note).
 */
import type { CardDef } from "@shandalar/cards";
import type { Catalog } from "./catalog.js";
import { rollBeast, type OpponentInstance } from "./generate.js";
import { regionCells, isTownCell } from "./generate.js";
import type { KnobValues } from "./knobs.js";
import { manhattan, type Point, type Town } from "./map.js";
import { WorldRng } from "./rng.js";
import { RING_OF_TIER } from "./shop.js";
import { activeDeck, type WorldState } from "./state.js";
import { spares } from "./deck-edit.js";

export type QuestKind = "courier" | "cardCourier" | "bounty";
export type QuestOutcome = "done" | "expired" | "abandoned";

export interface QuestReward {
  gold: number;
  /** A specific card into the collection (tier-appropriate; R on premium tier-3 rolls). */
  cardId?: string;
  /** A manalink of this colour, tied to the granting town (tier 2+; capped per colour). */
  manalink?: "W" | "U" | "B" | "R" | "G";
}

export interface QuestOffer {
  id: string;
  kind: QuestKind;
  /** Reward tier = the offering town's ring (civilized 1 / approach 2 / wild 3). */
  tier: 1 | 2 | 3;
  fromTown: number;
  /** courier / cardCourier: destination town index. */
  toTown?: number;
  /** cardCourier: what the collector wants — a spare matching this (it leaves on acceptance). */
  cardWanted?: { color: "W" | "U" | "B" | "R" | "G"; minMv: number };
  /** bounty: the catalog template to spawn and the region to spawn it in. */
  bountyCatalogId?: string;
  bountyRegion?: number;
  /** Steps allowed once accepted (0 = no deadline). */
  deadlineSteps: number;
  reward: QuestReward;
  /** Placeholder flavour (authoring is planner content). */
  text: string;
}

export interface ActiveQuest extends QuestOffer {
  acceptedStep: number;
  /** Absolute step past which the quest expires (undefined = none). */
  deadlineStep?: number;
  /** cardCourier: the card that left the collection. */
  carriedCardId?: string;
  /** bounty: the spawned instance's id, and where it was last SEEN (fog rules — the mark trails sightings). */
  bountyOpponentId?: string;
  bountySeenAt?: Point;
}

export interface QuestRecord {
  id: string;
  kind: QuestKind;
  tier: 1 | 2 | 3;
  outcome: QuestOutcome;
  step: number;
  text: string;
}

export interface QuestState {
  active: ActiveQuest[];
  completed: QuestRecord[];
  /** Offer ids consumed for this game (accepted at least once). */
  taken: string[];
}

export interface Manalink {
  color: "W" | "U" | "B" | "R" | "G";
  /** Granting town (suspension-on-town-fall arrives with S20 sieges). */
  town: number;
}

export const MANALINK_CARD: Record<Manalink["color"], string> = { W: "manalink_w", U: "manalink_u", B: "manalink_b", R: "manalink_r", G: "manalink_g" };

/** Authored template table (placeholder text — quest text authoring is planner content). */
const COURIER_TEXTS = [
  "Carry the sealed letter to {town}. Ask no questions of it.",
  "This parcel is late already. {town}, and quickly.",
  "The reliquary box goes to {town}. It is heavier than it looks.",
];
const CARD_COURIER_TEXTS = [
  "A collector in {town} pays well for {want}. It leaves your hands the moment you agree.",
  "Deliver {want} to a buyer in {town}. Payment on arrival; the card travels now.",
];
const BOUNTY_TEXTS = [
  "{target} has been troubling the roads of {region}. End it and return for the purse.",
  "A bounty stands on {target}, last marked in {region}. Proof is its defeat.",
];

const COLORS = ["W", "U", "B", "R", "G"] as const;

/** Deterministic per-town offers for this game. Pure in (world.seed, town); excludes taken offers. */
export function townOffers(world: WorldState, catalog: Catalog, town: Town, knobs: KnobValues, pool: Map<string, CardDef>): QuestOffer[] {
  const rng = new WorldRng(((world.seed * 2_654_435_761) ^ ((town.index + 1) * 40_503)) >>> 0);
  const region = world.map.regions[town.region]!;
  const tier = RING_OF_TIER[region.tier] ?? 1;
  const n = Math.max(1, knobs.questsPerTown);
  const offers: QuestOffer[] = [];
  for (let i = 0; i < n; i++) {
    const id = `q_${town.index}_${i}`;
    const roll = rng.float();
    const kind: QuestKind = roll < 0.4 ? "courier" : roll < 0.65 ? "cardCourier" : "bounty";
    const reward = rollReward(rng, world, catalog, tier, region.color as QuestReward["manalink"] & string, knobs, pool);
    if (kind === "bounty") {
      // Target: a signature of the town's spoke at the quest's tier, spawned one ring out when one exists
      // (a civilized town's bounty roams the approach ring) — the road to it is the quest.
      const targetTier = (["civilized", "approach", "wild"] as const)[Math.min(2, (RING_OF_TIER[region.tier] ?? 1))];
      const targetRegion = world.map.regions.find((r) => r.color === region.color && r.tier === targetTier) ?? region;
      const beast = rollBeast(rng, catalog, targetRegion, knobs);
      if (!beast) continue; // a spoke without signatures offers no bounty (cannot happen with the full grid)
      offers.push({
        id, kind, tier, fromTown: town.index,
        bountyCatalogId: beast.id, bountyRegion: targetRegion.index,
        deadlineSteps: 0, // bounties do not expire (the mark keeps roaming)
        reward,
        text: rng.pick(BOUNTY_TEXTS).replace("{target}", beast.name).replace("{region}", targetRegion.name),
      });
      continue;
    }
    // courier / cardCourier: destination = another town, biased far (the danger is the road).
    const others = world.map.towns.filter((t) => t.index !== town.index);
    if (others.length === 0) continue;
    const byDist = [...others].sort((a, b) => manhattan(town.at, b.at) - manhattan(town.at, a.at));
    const dest = byDist[rng.int(Math.min(3, byDist.length))]!;
    const deadlineSteps = knobs.questDeadlineSteps[tier] ?? 0;
    if (kind === "cardCourier") {
      const want = { color: rng.pick(COLORS), minMv: 1 + rng.int(3) };
      offers.push({
        id, kind, tier, fromTown: town.index, toTown: dest.index, cardWanted: want, deadlineSteps, reward,
        text: rng.pick(CARD_COURIER_TEXTS).replace("{town}", dest.name).replace("{want}", `a ${({ W: "white", U: "blue", B: "black", R: "red", G: "green" } as const)[want.color]} card (mana value ${want.minMv}+)`),
      });
    } else {
      offers.push({ id, kind, tier, fromTown: town.index, toTown: dest.index, deadlineSteps, reward, text: rng.pick(COURIER_TEXTS).replace("{town}", dest.name) });
    }
  }
  return offers.filter((o) => !world.quests.taken.includes(o.id));
}

/** Reward roll: gold always; tier-appropriate card ~40%; manalink ~25% at tier 2+ (respecting the cap
 * lazily — the award step re-checks); tier-3 card rolls upgrade to an R card ~35% of the time (the
 * first R-acquisition path, ADR-078). */
function rollReward(rng: WorldRng, world: WorldState, catalog: Catalog, tier: 1 | 2 | 3, townColor: QuestReward["manalink"], knobs: KnobValues, pool: Map<string, CardDef>): QuestReward {
  void catalog;
  const gold = knobs.questGoldByTier[tier] ?? 20;
  const roll = rng.float();
  if (tier >= 2 && roll < 0.25 && townColor && COLORS.includes(townColor)) return { gold: Math.round(gold / 2), manalink: townColor };
  if (roll < 0.65) {
    const wantR = tier === 3 && rng.float() < 0.35;
    const candidates = [...pool.values()]
      .filter((d) => !d.isTokenDef && !d.prizeOnly && (wantR ? d.shopTier === "R" : d.shopTier === tier))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (candidates.length) return { gold: Math.round(gold / 2), cardId: rng.pick(candidates).id };
  }
  return { gold };
}

/** Accept an offer. cardCourier: `cardId` names the SPARE that leaves the collection (must match the
 * predicate; the active deck's copies are not offered — ADR-065 keeps decks whole). Bounty: the mark
 * spawns now, in its region, out of the player's sight where possible. Mutates world; caller autosaves. */
export function acceptQuest(
  world: WorldState,
  catalog: Catalog,
  offer: QuestOffer,
  knobs: KnobValues,
  pool: Map<string, CardDef>,
  cardId?: string,
): { ok: true; quest: ActiveQuest } | { ok: false; reason: string } {
  if (world.quests.taken.includes(offer.id)) return { ok: false, reason: "that offer is spoken for" };
  const q: ActiveQuest = { ...offer, acceptedStep: world.player.stepsTaken };
  if (offer.deadlineSteps > 0) q.deadlineStep = world.player.stepsTaken + offer.deadlineSteps;
  if (offer.kind === "cardCourier") {
    if (!cardId) return { ok: false, reason: "choose the card to send" };
    const def = pool.get(cardId);
    if (!def) return { ok: false, reason: `unknown card ${cardId}` };
    const sp = spares(world.player.collection, activeDeck(world));
    if ((sp[cardId] ?? 0) < 1) return { ok: false, reason: "only spare copies can travel (your deck keeps its cards)" };
    if (!cardMatches(def, offer.cardWanted!)) return { ok: false, reason: "that card is not what the collector wants" };
    world.player.collection[cardId]! -= 1;
    if (world.player.collection[cardId]! <= 0) delete world.player.collection[cardId];
    q.carriedCardId = cardId;
  }
  if (offer.kind === "bounty") {
    const tmpl = catalog.opponents.find((o) => o.id === offer.bountyCatalogId);
    if (!tmpl) return { ok: false, reason: `no such mark ${offer.bountyCatalogId}` };
    const rng = new WorldRng((world.rng.a ^ 0x9e3779b9) >>> 0);
    const cells = regionCells(world.map, offer.bountyRegion!).filter((p) => !isTownCell(world.map, p) && manhattan(p, world.player.position) > knobs.sightRadius);
    const fallback = regionCells(world.map, offer.bountyRegion!).filter((p) => !isTownCell(world.map, p));
    const at = cells.length ? rng.pick(cells) : fallback.length ? rng.pick(fallback) : { ...world.map.regions[offer.bountyRegion!]!.heart };
    const inst: OpponentInstance = { id: `opp_bounty_${offer.id}`, catalogId: tmpl.id, region: offer.bountyRegion!, gone: false, at: { ...at }, moveDebt: 0 };
    world.opponents.push(inst);
    q.bountyOpponentId = inst.id;
  }
  world.quests.taken.push(offer.id);
  world.quests.active.push(q);
  return { ok: true, quest: q };
}

export function cardMatches(def: CardDef, want: { color: string; minMv: number }): boolean {
  const cost = def.manaCost ?? "";
  const colors = def.colors && def.colors.length ? def.colors : [...new Set(cost.replace(/[^WUBRG]/g, ""))];
  const mv = (cost.match(/\{(\d+)\}/g) ?? []).reduce((n, m) => n + Number(m.slice(1, -1)), 0) + (cost.match(/\{[WUBRGC]\}/g) ?? []).length;
  return colors.includes(want.color) && mv >= want.minMv;
}

/** Award a completed quest's reward (gold, card into the collection + provenance, manalink under the
 * per-colour cap — an over-cap manalink converts to its gold value so the reward is never dead). */
function award(world: WorldState, q: ActiveQuest, knobs: KnobValues): string {
  const notes: string[] = [];
  let gold = q.reward.gold;
  if (q.reward.cardId) {
    world.player.collection[q.reward.cardId] = (world.player.collection[q.reward.cardId] ?? 0) + 1;
    world.provenance.push({ cardId: q.reward.cardId, source: "reward", step: world.player.stepsTaken });
    notes.push(`the card ${q.reward.cardId}`);
  }
  if (q.reward.manalink) {
    const have = world.manalinks.filter((m) => m.color === q.reward.manalink).length;
    if (have < knobs.manalinkCapPerColor) {
      world.manalinks.push({ color: q.reward.manalink, town: q.fromTown });
      notes.push(`a Manalink (${q.reward.manalink}) — every duel now starts with it on your battlefield`);
    } else {
      gold += knobs.questGoldByTier[q.tier] ?? 20; // cap reached: the link converts to gold
      notes.push(`gold in lieu (you already hold a ${q.reward.manalink} manalink)`);
    }
  }
  world.player.gold += gold;
  notes.unshift(`${gold} gold`);
  return notes.join(", ");
}

function close(world: WorldState, q: ActiveQuest, outcome: QuestOutcome): void {
  world.quests.active = world.quests.active.filter((x) => x.id !== q.id);
  world.quests.completed.push({ id: q.id, kind: q.kind, tier: q.tier, outcome, step: world.player.stepsTaken, text: q.text });
}

export type QuestEvent =
  | { type: "questDone"; quest: ActiveQuest; rewardText: string }
  | { type: "questExpired"; quest: ActiveQuest };

/** Courier arrivals: call on entering a town. Mutates world; caller autosaves. */
export function questsOnArrival(world: WorldState, town: Town, knobs: KnobValues): QuestEvent[] {
  const events: QuestEvent[] = [];
  for (const q of [...world.quests.active]) {
    if ((q.kind === "courier" || q.kind === "cardCourier") && q.toTown === town.index) {
      const rewardText = award(world, q, knobs);
      close(world, q, "done");
      events.push({ type: "questDone", quest: q, rewardText });
    }
  }
  return events;
}

/** Bounty completion: call from duel application with the defeated instance's id. */
export function questsOnDefeat(world: WorldState, opponentId: string, knobs: KnobValues): QuestEvent[] {
  const events: QuestEvent[] = [];
  for (const q of [...world.quests.active]) {
    if (q.kind === "bounty" && q.bountyOpponentId === opponentId) {
      const rewardText = award(world, q, knobs);
      close(world, q, "done");
      events.push({ type: "questDone", quest: q, rewardText });
    }
  }
  return events;
}

/** Deadline tick + bounty sighting marks: call once per map step (advance()). */
export function questsOnStep(world: WorldState, knobs: KnobValues, sees: (p: Point) => boolean): QuestEvent[] {
  void knobs;
  const events: QuestEvent[] = [];
  for (const q of [...world.quests.active]) {
    if (q.deadlineStep !== undefined && world.player.stepsTaken > q.deadlineStep) {
      close(world, q, "expired");
      events.push({ type: "questExpired", quest: q });
      continue;
    }
    if (q.kind === "bounty" && q.bountyOpponentId) {
      const inst = world.opponents.find((o) => o.id === q.bountyOpponentId);
      if (inst?.at && !inst.gone && sees(inst.at)) q.bountySeenAt = { ...inst.at };
    }
  }
  return events;
}

/** Abandon: fails the quest (no further penalty; a carried card is already gone — the offer said so). */
export function abandonQuest(world: WorldState, questId: string): boolean {
  const q = world.quests.active.find((x) => x.id === questId);
  if (!q) return false;
  close(world, q, "abandoned");
  return true;
}

/** The duel modifiers the player's manalinks add (prepareDuel merges these). */
export function manalinkModifiers(world: WorldState): { type: "permanentOnBattlefield"; player: 0; cardId: string }[] {
  return world.manalinks.map((m) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId: MANALINK_CARD[m.color] }));
}

/** Fresh quest state (new worlds; the v3→v4 migration). */
export function emptyQuestState(): QuestState {
  return { active: [], completed: [], taken: [] };
}
