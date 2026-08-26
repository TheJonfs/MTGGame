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
import { manhattan, markExplored, type Point, type Town } from "./map.js";
import { WorldRng } from "./rng.js";
import { RING_OF_TIER } from "./shop.js";
import { activeDeck, worldKnobs, type WorldState } from "./state.js";
import { spares } from "./deck-edit.js";

export type QuestKind = "courier" | "cardCourier" | "bounty" | "retrieval";
export type QuestOutcome = "done" | "expired" | "abandoned";

export interface QuestReward {
  gold: number;
  /** A specific card into the collection (tier-appropriate; R on premium tier-3 rolls). */
  cardId?: string;
  /** Display name for cardId, resolved at offer time (S19 round 2 — reward text must never show a raw key). */
  cardName?: string;
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
  /** retrieval (S21): the lair-dungeon holding the item (Chris-ruled: lair-dungeons only —
   * Mox dungeons and future challenge sites are never quest targets; rumors point at those). */
  retrievalDungeonId?: string;
  /** retrieval: the item in the lair's prize room (escrowed like everything else — the quest is the dive). */
  retrievalItem?: { cardId: string; cardName: string };
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
  /** retrieval: the item came out of the lair (the keep-or-deliver choice is live at the offer town). */
  itemRecovered?: boolean;
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
  /** S21 Part 3–4: rumor chains + the heard-rumors journal. Defaulted lazily on read (a
   * v7-shaped need dodged — flagged in the handoff; all access goes through rumorState()). */
  rumors?: RumorState;
}

// ---------- S21 rumors (Part 3 chains + Part 4 lore) ----------

/** A rumor-chain: a trail of town stops ending at a Mox dungeon reveal. Chains are DISCOVERY
 * AIDS, not quests (Chris-ruled) — no acceptance, no reward beyond the reveal. */
export interface RumorChain {
  id: string;
  /** The target's mox dungeon id (mox_w …); the reveal explores its site's cells. */
  targetDungeonId: string;
  /** Town indexes to visit in order. */
  stops: number[];
  /** −1 unheard · k = next visit stops[k] · stops.length = revealed. */
  progress: number;
}

export interface RumorState {
  chains: RumorChain[];
  /** Every distinct rumor line heard (the journal; dedup by text). */
  heard: string[];
}

export interface Manalink {
  color: "W" | "U" | "B" | "R" | "G";
  /** Granting town (suspension-on-town-fall arrives with S20 sieges). */
  town: number;
}

/** S19 round 2 (Chris): a manalink puts a REGULAR basic land onto your battlefield — a green manalink
 * is an actual Forest in play from turn 0, not a bespoke artifact. (The five manalink_* artifact defs
 * were cut the same round.) */
export const MANALINK_CARD: Record<Manalink["color"], string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
export const MANALINK_LAND_NAME: Record<Manalink["color"], string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

/** Pre-pack template table — the FALLBACK for minimal test catalogs without `questText`.
 * The real content lives in data/world/quests.json (the S21 pack; planner-owned). */
const FALLBACK_PACK: import("./catalog.js").QuestTextPack = {
  offers: {
    courier: ["Carry the sealed letter to {town}. Ask no questions of it.", "This parcel is late already. {town}, and quickly."],
    cardCourier: ["A collector in {town} pays well for {want}. It leaves your hands the moment you agree."],
    bounty: ["{target} has been troubling the roads of {region}. End it and return for the purse."],
    retrieval: ["It's in the lair in the {region}. Bring the {card} back for {reward}, or keep it."],
  },
  rumors: {
    chainLinks: ["Ask at {town}."],
    guardians: {}, lords: {},
    moxPointer: "There's a door in the {region} that opens for no key.",
    moxPointerDeep: "Five doors, five sleepless things.",
    vaultTease: "And beneath them all, they say — a flower.",
    nighthawkLegend: "Walk wide of the Nighthawk.",
    warp: [], texture: [],
  },
};

export function questPack(catalog: Catalog): import("./catalog.js").QuestTextPack {
  return catalog.questText ?? FALLBACK_PACK;
}

const COLORS = ["W", "U", "B", "R", "G"] as const;

/** Deterministic per-town offers. Pure in (world.seed, town, quest epoch); excludes taken offers.
 * S22 r2 (Chris): the board REPOSTS on the clock — epoch = floor(steps / questRefreshSteps); epoch
 * ids keep old consumptions harmless (a fresh epoch is a fresh board, the shop-restock pattern). */
export function questEpoch(world: WorldState, knobs: KnobValues): number {
  return knobs.questRefreshSteps > 0 ? Math.floor(world.player.stepsTaken / knobs.questRefreshSteps) : 0;
}
export function townOffers(world: WorldState, catalog: Catalog, town: Town, knobs: KnobValues, pool: Map<string, CardDef>): QuestOffer[] {
  const epoch = questEpoch(world, knobs);
  const rng = new WorldRng(((world.seed * 2_654_435_761) ^ ((town.index + 1) * 40_503) ^ (epoch * 97_911)) >>> 0);
  const region = world.map.regions[town.region]!;
  const tier = RING_OF_TIER[region.tier] ?? 1;
  const n = Math.max(1, knobs.questsPerTown);
  const pack = questPack(catalog);
  const offers: QuestOffer[] = [];
  for (let i = 0; i < n; i++) {
    const id = `q_${town.index}_${questEpoch(world, knobs)}_${i}`;
    const roll = rng.float();
    const kind: QuestKind = roll < 0.35 ? "courier" : roll < 0.55 ? "cardCourier" : roll < 0.8 ? "bounty" : "retrieval";
    const reward = rollReward(rng, world, catalog, tier, region.color as QuestReward["manalink"] & string, knobs, pool);
    if (kind === "retrieval") {
      // S21 (Chris-ruled): targets are LAIR-DUNGEONS with a living resident; the item sits in
      // the prize room, escrowed like everything else — the quest is the dive. Keep-or-deliver
      // on return (the trade stated at the choice).
      const lairs = world.map.strongholds.filter((f) => f.kind === "lair" && f.opponentId && !world.opponents.find((o) => o.id === f.opponentId)?.gone);
      if (lairs.length === 0) continue; // every lair cleared: the dens hold nothing to fetch
      const lair = rng.pick(lairs);
      const rs = [...pool.values()].filter((d) => !d.isTokenDef && !d.prizeOnly && d.shopTier === "R").sort((a, b) => a.id.localeCompare(b.id));
      if (rs.length === 0) continue;
      const item = rng.pick(rs);
      const gold = (knobs.questGoldByTier[tier] ?? 20) * 2; // the dive premium — deliver pays this
      offers.push({
        id, kind, tier, fromTown: town.index,
        retrievalDungeonId: `lair_${lair.opponentId}`,
        retrievalItem: { cardId: item.id, cardName: item.name },
        deadlineSteps: 0, // the dive is the quest; the den keeps no calendar
        reward: { gold },
        text: rng.pick(pack.offers.retrieval)
          .replace(/\{region\}/g, world.map.regions[lair.region]?.name ?? "the wilds")
          .replace(/\{card\}/g, item.name)
          .replace(/\{reward\}/g, `${gold} gold`),
      });
      continue;
    }
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
        text: rng.pick(pack.offers.bounty).replace(/\{target\}/g, beast.name).replace(/\{region\}/g, targetRegion.name).replace(/\{reward\}/g, `${reward.gold} gold`),
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
        text: rng.pick(pack.offers.cardCourier).replace(/\{town\}/g, dest.name).replace(/\{want\}/g, `a ${({ W: "white", U: "blue", B: "black", R: "red", G: "green" } as const)[want.color]} card (mana value ${want.minMv}+)`).replace(/\{reward\}/g, `${reward.gold} gold`),
      });
    } else {
      offers.push({ id, kind, tier, fromTown: town.index, toTown: dest.index, deadlineSteps, reward, text: rng.pick(pack.offers.courier).replace(/\{town\}/g, dest.name).replace(/\{reward\}/g, `${reward.gold} gold`) });
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
  if (tier >= 2 && roll < knobs.manalinkRewardChance && townColor && COLORS.includes(townColor)) return { gold: Math.round(gold / 2), manalink: townColor }; // S22 r2: knobbed (was 0.25)
  if (roll < 0.65) {
    const wantR = tier === 3 && rng.float() < 0.35;
    const candidates = [...pool.values()]
      .filter((d) => !d.isTokenDef && !d.prizeOnly && (wantR ? d.shopTier === "R" : d.shopTier === tier))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (candidates.length) { const c = rng.pick(candidates); return { gold: Math.round(gold / 2), cardId: c.id, cardName: c.name }; }
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
    notes.push(`the card ${q.reward.cardName ?? q.reward.cardId}`);
  }
  if (q.reward.manalink) {
    const have = world.manalinks.filter((m) => m.color === q.reward.manalink).length;
    if (have < knobs.manalinkCapPerColor) {
      world.manalinks.push({ color: q.reward.manalink, town: q.fromTown });
      notes.push(`a manalink — every duel now starts with a bonus ${MANALINK_LAND_NAME[q.reward.manalink]} on your battlefield`);
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

/** ADR-081: deadlines freeze while the giver's or destination's town is occupied. Reads the
 * serialized siege state directly rather than siege.ts's helper — siege.ts already imports this
 * module, and the one deliberate ESM cycle (journey↔siege) should stay the only one. */
const underOccupation = (world: WorldState, townIndex: number | undefined): boolean =>
  townIndex !== undefined && world.sieges.some((s) => s.townIndex === townIndex && s.status === "occupied");

/** Deadline tick + bounty sighting marks: call once per map step (advance()). */
export function questsOnStep(world: WorldState, knobs: KnobValues, sees: (p: Point) => boolean): QuestEvent[] {
  void knobs;
  const events: QuestEvent[] = [];
  for (const q of [...world.quests.active]) {
    if (q.deadlineStep !== undefined && (underOccupation(world, q.fromTown) || underOccupation(world, q.toTown))) {
      // The contract waits out the occupation: this step doesn't count against the deadline.
      q.deadlineStep += 1;
    }
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

// ---------- S21 Part 3: retrieval lifecycle ----------

/** Call when a lair-dungeon CLEARS (the caller adds the returned card ids to the victory payout —
 * the item was escrowed like everything else; clearDungeon's addToCollection pays it). */
export function retrievalOnDungeonClear(world: WorldState, dungeonId: string): { quest: ActiveQuest; cardId: string; cardName: string }[] {
  const out: { quest: ActiveQuest; cardId: string; cardName: string }[] = [];
  for (const q of world.quests.active) {
    if (q.kind === "retrieval" && q.retrievalDungeonId === dungeonId && !q.itemRecovered && q.retrievalItem) {
      q.itemRecovered = true;
      out.push({ quest: q, cardId: q.retrievalItem.cardId, cardName: q.retrievalItem.cardName });
    }
  }
  return out;
}

/** Recovered retrievals whose offer town is HERE — the keep-or-deliver choice is live. */
export function pendingRetrievalChoice(world: WorldState, townIndex: number): ActiveQuest[] {
  return world.quests.active.filter((q) => q.kind === "retrieval" && q.itemRecovered && q.fromTown === townIndex);
}

/** The manifest's keep-or-deliver choice (the trade stated at the choice — UI's job).
 * KEEP: the item stays (it already paid out through the escrow); no reward; quest done.
 * DELIVER: the item leaves the collection (a copy must still be owned) and the reward pays. */
export function resolveRetrieval(
  world: WorldState,
  questId: string,
  choice: "keep" | "deliver",
): { ok: true; text: string } | { ok: false; reason: string } {
  const q = world.quests.active.find((x) => x.id === questId);
  if (!q || q.kind !== "retrieval" || !q.itemRecovered || !q.retrievalItem) return { ok: false, reason: "no recovered item to hand over" };
  if (choice === "deliver") {
    const have = world.player.collection[q.retrievalItem.cardId] ?? 0;
    if (have < 1) return { ok: false, reason: `you no longer hold ${q.retrievalItem.cardName} — keep is the only honest choice left` };
    world.player.collection[q.retrievalItem.cardId] = have - 1;
    if (world.player.collection[q.retrievalItem.cardId]! <= 0) delete world.player.collection[q.retrievalItem.cardId];
    world.player.gold += q.reward.gold;
    close(world, q, "done");
    return { ok: true, text: `${q.retrievalItem.cardName} changes hands; ${q.reward.gold} gold is yours.` };
  }
  close(world, q, "done");
  return { ok: true, text: `You keep ${q.retrievalItem.cardName}. The buyer keeps their gold, and their opinion.` };
}

// ---------- S21 Part 3–4: rumor chains + the lore turn ----------

/** The rumor state, defaulted lazily; chains generate once, seeded from the world (deterministic
 * whenever they materialize — pure in (seed, catalog, map)). */
export function rumorState(world: WorldState, catalog: Catalog): RumorState {
  const rs = (world.quests.rumors ??= { chains: [], heard: [] });
  if (rs.chains.length === 0 && catalog.dungeons.length > 0) {
    for (const mox of catalog.dungeons) {
      const rng = new WorldRng(((world.seed * 3_266_489_917) ^ hash32(`chain:${mox.id}`)) >>> 0);
      const towns = [...world.map.towns];
      if (towns.length < 2) continue;
      const a = rng.int(towns.length);
      let b = rng.int(towns.length - 1);
      if (b >= a) b += 1;
      rs.chains.push({ id: `chain_${mox.id}`, targetDungeonId: mox.id, stops: [towns[a]!.index, towns[b]!.index], progress: -1 });
    }
  }
  return rs;
}

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const heardLog = (rs: RumorState, line: string): void => {
  if (!rs.heard.includes(line)) rs.heard.push(line);
};

/** The dungeon site a chain points at (the mox site in the target's colour region). */
function chainSite(world: WorldState, catalog: Catalog, chain: RumorChain): { at: Point; region: number } | null {
  const mox = catalog.dungeons.find((d) => d.id === chain.targetDungeonId);
  if (!mox) return null;
  const site = world.map.strongholds.find((f) => f.kind === "dungeon" && world.map.regions[f.region]?.color === mox.color);
  return site ? { at: site.at, region: site.region } : null;
}

export type RumorEvent = { type: "chainAdvanced" | "chainRevealed"; chainId: string; text: string };

/** Entering a town is hearing its board: unheard chains START (the opener is on every board);
 * a chain whose next stop is THIS town advances; the last stop REVEALS the site (its cells are
 * explored — the door appears on the map). Mutates world; caller autosaves on a reveal. */
export function rumorsOnArrival(world: WorldState, catalog: Catalog, town: Town): RumorEvent[] {
  const rs = rumorState(world, catalog);
  const pack = questPack(catalog);
  const events: RumorEvent[] = [];
  for (const chain of rs.chains) {
    if (chain.progress >= chain.stops.length) continue;
    if (chain.progress === -1) {
      chain.progress = 0;
      const site = chainSite(world, catalog, chain);
      const opener = pack.rumors.moxPointer.replace(/\{region\}/g, site ? world.map.regions[site.region]!.name : "the far country");
      heardLog(rs, opener);
    }
    if (chain.progress < chain.stops.length && chain.stops[chain.progress] === town.index) {
      chain.progress += 1;
      if (chain.progress >= chain.stops.length) {
        const site = chainSite(world, catalog, chain);
        if (site && world.explored) {
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const p = { x: site.at.x + dx, y: site.at.y + dy };
            if (p.x >= 0 && p.y >= 0 && p.x < world.map.width && p.y < world.map.height) markExplored(world.explored, world.map, p);
          }
        }
        heardLog(rs, pack.rumors.moxPointerDeep);
        events.push({ type: "chainRevealed", chainId: chain.id, text: `${pack.rumors.moxPointerDeep} The trail ends: the door stands in ${site ? world.map.regions[site.region]!.name : "the far country"} — it is marked on your map.` });
      } else {
        const nextTown = world.map.towns[chain.stops[chain.progress]!];
        const link = pack.rumors.chainLinks[chain.progress % pack.rumors.chainLinks.length]!
          .replace(/\{town\}/g, nextTown?.name ?? "the next town")
          .replace(/\{region\}/g, nextTown ? world.map.regions[nextTown.region]!.name : "the next country");
        heardLog(rs, link);
        events.push({ type: "chainAdvanced", chainId: chain.id, text: link });
      }
    }
  }
  return events;
}

/** The tavern's rumor board for this visit: live chain lines (the trail's current step) plus a
 * seeded rotation of lore — guardians, the five lords' whispers, the Nighthawk's legend, the warp,
 * world texture; the Vault tease only once all five Moxen are taken (Chris-ruled gate). Every line
 * shown is logged as heard (the journal). Pure in (seed, town, visit count) apart from the log. */
/** The rumor cadence without a knobs param (tavernRumors predates the knob thread; the default
 * layer is correct here — per-opponent overrides never touch it). */
function worldKnobsRumorSteps(world: WorldState): number {
  return worldKnobs(world).rumorRefreshSteps;
}
export function tavernRumors(world: WorldState, catalog: Catalog, town: Town): string[] {
  const rs = rumorState(world, catalog);
  const pack = questPack(catalog);
  const lines: string[] = [];
  for (const chain of rs.chains) {
    if (chain.progress < 0 || chain.progress >= chain.stops.length) continue;
    const nextTown = world.map.towns[chain.stops[chain.progress]!];
    lines.push(
      pack.rumors.chainLinks[chain.progress % pack.rumors.chainLinks.length]!
        .replace(/\{town\}/g, nextTown?.name ?? "the next town")
        .replace(/\{region\}/g, nextTown ? world.map.regions[nextTown.region]!.name : "the next country"),
    );
    if (lines.length >= 2) break; // the trail crowds the board only so far
  }
  const lore: string[] = [
    ...Object.values(pack.rumors.guardians),
    ...Object.values(pack.rumors.lords),
    ...pack.rumors.warp,
    ...pack.rumors.texture,
    pack.rumors.nighthawkLegend,
  ];
  const fiveMoxen = catalog.dungeons.length === 5 && catalog.dungeons.every((d) => world.dungeons[d.id]?.cleared);
  if (fiveMoxen) lore.push(pack.rumors.vaultTease);
  // S22 r2 (Chris): fewer lines per sitting, rotating on the shop cadence — keyed by the rumor
  // epoch, not the visit count (re-entering within an epoch pours the same, no farming).
  const epoch = Math.floor(world.player.stepsTaken / Math.max(1, worldKnobsRumorSteps(world)));
  const rng = new WorldRng(((world.seed * 1_540_483_477) ^ hash32(`tavern:${town.index}:${epoch}`)) >>> 0);
  const picks = Math.min(1, lore.length);
  const start = lore.length ? rng.int(lore.length) : 0;
  for (let i = 0; i < picks; i++) lines.push(lore[(start + i * 7) % lore.length]!);
  for (const l of lines) heardLog(rs, l);
  return lines;
}

/** Abandon: fails the quest (no further penalty; a carried card is already gone — the offer said so). */
export function abandonQuest(world: WorldState, questId: string): boolean {
  const q = world.quests.active.find((x) => x.id === questId);
  if (!q) return false;
  close(world, q, "abandoned");
  return true;
}

/** The duel modifiers the player's manalinks add (prepareDuel merges these — the ONE manalink
 * source; dungeon and siege specs call it too). S21 (manifest §5): a link whose granting town
 * is OCCUPIED is suspended — the status check is inlined structurally rather than importing
 * siege.ts (which imports this module); the predicate's home is siege.isTownOccupied. */
export function manalinkModifiers(world: WorldState): { type: "permanentOnBattlefield"; player: 0; cardId: string }[] {
  const occupied = new Set(
    (world.sieges as { townIndex: number; status?: string }[]).filter((s) => s.status === "occupied").map((s) => s.townIndex),
  );
  return world.manalinks
    .filter((m) => !occupied.has(m.town))
    .map((m) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId: MANALINK_CARD[m.color] }));
}

/** Fresh quest state (new worlds; the v3→v4 migration). */
export function emptyQuestState(): QuestState {
  return { active: [], completed: [], taken: [] };
}
