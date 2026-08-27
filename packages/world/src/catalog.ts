import { DECKS, DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { assertKnobSource, type KnobSource, type RegionTier, type EnemyTier } from "./knobs.js";

/**
 * Authored catalog v0 (overworld manifest §2 "authored inventory, procedural
 * placement"; brief Part 2). Lives in `data/world/*.json`; validated here in a
 * browser-safe way (the fs loader is the `./loader` subpath, like cards).
 * A world is `(catalogVersion, seed)`: any catalog change that would alter
 * generation bumps the version.
 */
export const CATALOG_VERSION = "v1"; // S16 (ADR-072): radial world content — 15 regions (colour × tier) + 5 strongholds

export type Color = "W" | "U" | "B" | "R" | "G" | "C";

export interface RegionTemplate {
  id: string;
  name: string;
  tier: RegionTier;
  /** Wash colour on the map + shop stock colour (S13). "C" = wild/colourless. */
  color: Color;
  /** Preferred town names for this region (falls back to the shared pool). */
  townNames: string[];
}

export type Difficulty = "apprentice" | "journeyman" | "master";
/** ADR-066: mages parley; beasts are distracted (buyable flag + multiplier knob) or not bought at all. */
export type OpponentKind = "mage" | "beast";

/** S16: an opponent's deck is a slice key (A–E) or a catalog starter ("starter:green") —
 * the measurement behind the tier-1 enemy-deck question lives on this.
 * S18: or a beast deck ("beast:warband") from packages/sim/src/expansion-decks.ts (ADR-074/077). */
export type OpponentDeckRef = DeckKey | `starter:${StarterId}` | `beast:${string}`;

/** S18 (ADR-066 reflavored parley): how this opponent's parley reads. All optional; defaults by kind. */
export interface ParleyVoice {
  /** Button label for the buy-off/distraction option ("Distract", "Tithe", "Bribe"). */
  verb?: string;
  /** One line under the name in the parley dialog (the opponent's voice or the field-guide note). */
  line?: string;
  /** Replaces the "cannot be bought" explanation when buyable is false. */
  refusal?: string;
}

export interface OpponentTemplate {
  id: string;
  name: string;
  /** Slice opponents play the existing slice decks; `starter:<id>` plays that catalog starter. */
  deck: OpponentDeckRef;
  tier: EnemyTier;
  difficulty: Difficulty;
  /** Portrait subject slug (docs/art/subjects/<slug>.md → /portraits/<slug>.png). */
  portrait: string;
  /** Enemy world life = their duel starting life (manifest §2a: per-opponent data). */
  worldLife: number;
  /** Colour identity string for UI washes, e.g. "R", "WU". */
  colors: string;
  /** Knob overrides at the `opponent` layer (e.g. a tier-3 carries anteCount 2). */
  knobs?: KnobSource;
  /** ADR-066 (S14 PoC): default "mage". */
  kind?: OpponentKind;
  /** ADR-066: can this opponent be bought off / distracted? Default true. Beasts may say no. */
  buyable?: boolean;
  /** ADR-066: silhouette chip crop slug for the map marker (beasts); falls back to `portrait`. */
  portraitChip?: string;
  /** S18 (ADR-072 region-bound roamers + the bestiary): the colour spoke this opponent roams. Beasts are
   * spoke-bound (the Warband roams the red ring); absent = anywhere (mages). */
  spoke?: Exclude<Color, "C">;
  /** S18: parley voice (verb/line/refusal). */
  parley?: ParleyVoice;
}

/** S16 (ADR-069/070): authored starter decks per colour — the world's new-game
 * choice. Slice decks A–E are enemy/ladder infrastructure only. */
export type StarterId = "white" | "blue" | "black" | "red" | "green";
export type StarterArchetype = "aggro" | "midrange" | "control";
export type StarterDecklist = { cardId: string; count: number }[];
export interface StarterTemplate {
  id: StarterId;
  color: Exclude<Color, "C">;
  name: string;
  archetype: StarterArchetype;
  /** The deck's basic land (ante-refill card; spares pool). */
  basicLand: string;
  decklist: StarterDecklist;
  /** Difficulty adjustments (manifest §2b; design round 1 §2): applied at new game. */
  easy?: { add?: StarterDecklist; remove?: StarterDecklist };
  hard?: { add?: StarterDecklist; remove?: StarterDecklist };
}

/** S16 (ADR-072): the colour castles — fixed points at the end of each spoke; residents are S19+ content. */
export interface StrongholdTemplate {
  id: string;
  name: string;
  color: Exclude<Color, "C">;
}

/** S21 Parts 3–4: the quest & rumor text pack (docs/quest-text-pack-v1.md) as catalog data.
 * Planner-owned content — the implementer wires, never rewrites (edits escalate). */
export interface QuestTextPack {
  offers: { courier: string[]; cardCourier: string[]; bounty: string[]; retrieval: string[] };
  rumors: {
    chainLinks: string[];
    guardians: Record<string, string>;
    lords: Record<string, string>;
    moxPointer: string;
    moxPointerDeep: string;
    vaultTease: string;
    nighthawkLegend: string;
    warp: string[];
    texture: string[];
    /** S22 r4 (Chris, item 1): the tavern points at a town whose CURRENT board posts a
     * manalink-paying contract ({town} substituted). Optional — a fallback line covers packs
     * that predate it. */
    manalinkPointer?: string;
  };
}

export interface Catalog {
  version: string;
  regions: RegionTemplate[];
  townNames: string[];
  opponents: OpponentTemplate[];
  starters: StarterTemplate[];
  strongholds: StrongholdTemplate[];
  /** S20 (ADR-079): the five Mox dungeons (dungeon-design §5–§8). */
  dungeons: import("./dungeon.js").MoxDungeonDef[];
  /** S22b: the five lords' seats (stronghold-bosses.md; ids match regions.json's fixed points).
   * Absent in minimal test catalogs → []. */
  strongholdContent?: import("./stronghold.js").StrongholdContentDef[];
  /** S21: the quest & rumor text pack (absent in minimal test catalogs → built-in fallback). */
  questText?: QuestTextPack;
}

/** Resolve an opponent's deck reference to a decklist + archetype (slice deck or catalog starter). */
export function enemyDeck(catalog: Catalog, ref: OpponentDeckRef): { decklist: StarterDecklist; archetype: StarterArchetype } {
  if (ref in DECKS) {
    const k = ref as DeckKey;
    return { decklist: DECKS[k].decklist.map((e) => ({ ...e })), archetype: DECK_ARCHETYPES[k] };
  }
  if (ref.startsWith("beast:")) {
    const b = EXPANSION_DECKS[ref.slice("beast:".length)];
    if (!b) throw new Error(`unknown beast deck ${ref}`);
    return { decklist: b.decklist.map((e) => ({ ...e })), archetype: b.archetype };
  }
  const id = ref.slice("starter:".length);
  const s = catalog.starters.find((x) => x.id === id);
  if (!s) throw new Error(`unknown opponent deck ${ref}`);
  return { decklist: s.decklist.map((e) => ({ ...e })), archetype: s.archetype };
}

/** Assemble + validate a catalog from already-parsed JSON objects (browser-safe). */
export function catalogFrom(parts: { regions: unknown; towns: unknown; opponents: unknown; starters: unknown; dungeons?: unknown; quests?: unknown }): Catalog {
  const r = parts.regions as { catalogVersion: string; regions: RegionTemplate[]; strongholds?: StrongholdTemplate[] };
  const t = parts.towns as { catalogVersion: string; names: string[] };
  const o = parts.opponents as { catalogVersion: string; opponents: OpponentTemplate[] };
  const st = parts.starters as { catalogVersion: string; starters: StarterTemplate[] };
  const du = (parts.dungeons ?? { catalogVersion: CATALOG_VERSION, mox: [] }) as { catalogVersion: string; mox: import("./dungeon.js").MoxDungeonDef[]; strongholds?: import("./stronghold.js").StrongholdContentDef[] };
  const errors: string[] = [];
  if (parts.dungeons) {
    if (du.catalogVersion !== CATALOG_VERSION) errors.push(`dungeons: catalogVersion ${du.catalogVersion} != ${CATALOG_VERSION}`);
    if (du.mox.length !== 5 || new Set(du.mox.map((m) => m.color)).size !== 5) errors.push("dungeons: need exactly five mox dungeons covering the five colours");
    for (const m of du.mox) if (!m.id || !m.name || !m.guardian?.key || !m.law?.both?.length || !m.prize?.mox) errors.push(`dungeon ${m.id ?? "?"}: missing fields`);
    // S22b: stronghold content — names in the validator (the S21 pack lesson): five entries, five
    // colours, ids matching the regions file's fixed points, every field the seat needs.
    if (du.strongholds) {
      if (du.strongholds.length !== 5 || new Set(du.strongholds.map((s) => s.color)).size !== 5) errors.push("dungeons: strongholds must be five entries covering the five colours");
      for (const s of du.strongholds) {
        if (!s.id || !s.name || !s.lord?.key || !s.lord?.cardId || !s.lord?.baseLife || !s.law?.cardId) errors.push(`stronghold ${s.id ?? "?"}: missing fields`);
        if (!(r.strongholds ?? []).some((x) => x.id === s.id)) errors.push(`stronghold ${s.id}: no matching fixed point in regions.json`);
      }
    }
  }
  for (const [what, v] of [["regions", r.catalogVersion], ["towns", t.catalogVersion], ["opponents", o.catalogVersion], ["starters", st.catalogVersion]] as const) {
    if (v !== CATALOG_VERSION) errors.push(`${what}: catalogVersion ${v} != ${CATALOG_VERSION}`);
  }
  const tiers = new Set<string>(["civilized", "approach", "wild"]);
  for (const reg of r.regions) {
    if (!reg.id || !reg.name) errors.push(`region missing id/name: ${JSON.stringify(reg)}`);
    if (!tiers.has(reg.tier)) errors.push(`region ${reg.id}: bad tier ${reg.tier}`);
    if (!Array.isArray(reg.townNames)) errors.push(`region ${reg.id}: townNames must be an array`);
  }
  if (!r.regions.some((x) => x.tier === "civilized")) errors.push("catalog needs at least one civilized region");
  // ADR-072: the radial generator needs every colour × tier, and a stronghold per colour.
  for (const c of ["W", "U", "B", "R", "G"] as const) {
    for (const t of ["civilized", "approach", "wild"] as const) {
      if (!r.regions.some((x) => x.color === c && x.tier === t)) errors.push(`catalog needs a ${t} region of colour ${c} (ADR-072)`);
    }
    if (!(r.strongholds ?? []).some((x) => x.color === c)) errors.push(`catalog needs a stronghold of colour ${c} (ADR-072)`);
  }
  const shIds = new Set<string>();
  for (const sh of r.strongholds ?? []) {
    if (!sh.id || !sh.name) errors.push(`stronghold missing id/name: ${JSON.stringify(sh)}`);
    if (shIds.has(sh.id)) errors.push(`duplicate stronghold id ${sh.id}`);
    shIds.add(sh.id);
  }
  const ids = new Set<string>();
  for (const op of o.opponents) {
    if (ids.has(op.id)) errors.push(`duplicate opponent id ${op.id}`);
    ids.add(op.id);
    const deckOk = op.deck in DECKS
      || (typeof op.deck === "string" && op.deck.startsWith("starter:") && (st.starters ?? []).some((s) => `starter:${s.id}` === op.deck))
      || (typeof op.deck === "string" && op.deck.startsWith("beast:") && op.deck.slice("beast:".length) in EXPANSION_DECKS);
    if (!deckOk) errors.push(`opponent ${op.id}: unknown deck ${op.deck}`);
    if (op.spoke && !["W", "U", "B", "R", "G"].includes(op.spoke)) errors.push(`opponent ${op.id}: bad spoke ${op.spoke}`);
    if (op.kind === "beast" && !op.spoke) errors.push(`opponent ${op.id}: beasts need a spoke (S18 region binding)`);
    if (![1, 2, 3].includes(op.tier)) errors.push(`opponent ${op.id}: bad tier ${op.tier}`);
    if (!["apprentice", "journeyman", "master"].includes(op.difficulty)) errors.push(`opponent ${op.id}: bad difficulty ${op.difficulty}`);
    if (!Number.isInteger(op.worldLife) || op.worldLife < 1) errors.push(`opponent ${op.id}: bad worldLife`);
    if (op.kind && !["mage", "beast"].includes(op.kind)) errors.push(`opponent ${op.id}: bad kind ${op.kind}`);
    if (op.knobs) {
      try {
        assertKnobSource(op.knobs as Record<string, unknown>, `opponent ${op.id}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
  }
  const starterIds = new Set<string>();
  const size = (d: StarterDecklist | undefined) => (d ?? []).reduce((n, e) => n + e.count, 0);
  for (const s of st.starters ?? []) {
    if (!["white", "blue", "black", "red", "green"].includes(s.id)) errors.push(`starter ${s.id}: bad id`);
    if (starterIds.has(s.id)) errors.push(`duplicate starter ${s.id}`);
    starterIds.add(s.id);
    if (!["W", "U", "B", "R", "G"].includes(s.color)) errors.push(`starter ${s.id}: bad color ${s.color}`);
    if (!["aggro", "midrange", "control"].includes(s.archetype)) errors.push(`starter ${s.id}: bad archetype ${s.archetype}`);
    if (!Array.isArray(s.decklist) || size(s.decklist) !== 30) errors.push(`starter ${s.id}: decklist must total 30 cards (got ${size(s.decklist)})`);
    if (!s.basicLand || !s.decklist?.some((e) => e.cardId === s.basicLand)) errors.push(`starter ${s.id}: basicLand must appear in the decklist`);
    for (const v of ["easy", "hard"] as const) {
      const adj = s[v];
      if (!adj) continue;
      if (size(s.decklist) + size(adj.add) - size(adj.remove) < 30) errors.push(`starter ${s.id}: ${v} variant falls below the 30 floor`);
      for (const e of adj.remove ?? []) {
        const have = s.decklist.find((d) => d.cardId === e.cardId)?.count ?? 0;
        if (have < e.count) errors.push(`starter ${s.id}: ${v} removes ${e.cardId} ×${e.count} but the deck has ${have}`);
      }
    }
  }
  for (const id of ["white", "blue", "black", "red", "green"]) if (!starterIds.has(id)) errors.push(`missing starter ${id} (every colour needs one — manifest §2b)`);
  // S21: the quest & rumor text pack (planner content, wired as data).
  let questText: QuestTextPack | undefined;
  if (parts.quests) {
    const qp = parts.quests as { catalogVersion: string; offers: QuestTextPack["offers"]; rumors: QuestTextPack["rumors"] };
    if (qp.catalogVersion !== CATALOG_VERSION) errors.push(`quests: catalogVersion ${qp.catalogVersion} != ${CATALOG_VERSION}`);
    for (const k of ["courier", "cardCourier", "bounty", "retrieval"] as const) {
      if (!Array.isArray(qp.offers?.[k]) || qp.offers[k].length === 0) errors.push(`quests: offers.${k} must be a nonempty array`);
    }
    // S22 playtest r3 (Chris: a courier offer with no destination in its text — "third time pays
    // for all", but for WHERE?): every courier-class template must name its {town}.
    for (const k of ["courier", "cardCourier"] as const) {
      for (const t of qp.offers?.[k] ?? []) if (!t.includes("{town}")) errors.push(`quests: offers.${k} template lacks {town}: "${t}"`);
    }
    if (!Array.isArray(qp.rumors?.chainLinks) || qp.rumors.chainLinks.length === 0) errors.push("quests: rumors.chainLinks must be nonempty");
    for (const g of ["reya", "arcanis", "drana", "drakuseth", "titania"]) if (!qp.rumors?.guardians?.[g]) errors.push(`quests: rumors.guardians.${g} missing`);
    for (const l of ["unwinder", "usher", "warden", "stoker", "sower"]) if (!qp.rumors?.lords?.[l]) errors.push(`quests: rumors.lords.${l} missing`);
    for (const k of ["moxPointer", "moxPointerDeep", "vaultTease", "nighthawkLegend"] as const) if (!qp.rumors?.[k]) errors.push(`quests: rumors.${k} missing`);
    if (!Array.isArray(qp.rumors?.warp) || !Array.isArray(qp.rumors?.texture)) errors.push("quests: rumors.warp/texture must be arrays");
    questText = { offers: qp.offers, rumors: qp.rumors };
  }
  if (errors.length) throw new Error(`Catalog validation failed:\n${errors.join("\n")}`);
  return { version: CATALOG_VERSION, regions: r.regions, townNames: t.names, opponents: o.opponents, starters: st.starters, strongholds: r.strongholds ?? [], dungeons: du.mox, ...(du.strongholds ? { strongholdContent: du.strongholds } : {}), ...(questText ? { questText } : {}) };
}
