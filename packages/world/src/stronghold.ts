/**
 * S22b — the lords' seats (stronghold-bosses.md systems; brief Parts 4–5).
 *
 * A stronghold is the dungeon system at MAXIMUM SCALE with a PARTISAN LAW: the five fixed points
 * (ADR-072 worldgen) open as one-time dungeons on the stronghold grid knobs; the law — a custom
 * uncastable Artifact Enchantment — rides EVERY interior duel on the defender's side (per-battle
 * re-injection: a felled law returns next fight because every duel is a fresh MatchSpec, the
 * architecture's default behavior for free); the lord waits at the far end with his ENTRANCE
 * (signature-to-hand, engine modifier), the LIFE FORMULA, and interior empowerment stacked atop.
 *
 * The pace war (Chris-designed): lordStartingLife = base + stepGrowth(totalWorldSteps) −
 * floor(spokeMinionPoints / spokePointsPerLife), floored at lordLifeFloor — minion kills INSIDE
 * AND OUTSIDE the stronghold count, attributed per spoke (tier N kill = N points); growth is
 * GLOBAL. Grinding one spoke softens one lord while the clock fattens all five. §5's
 * visible-schedules law applies: lordStatus() feeds the UI telegraph.
 *
 * Treasures: the lord's card (guaranteed sole-drop — prizeOnly's sole channel, ADR-081) + any
 * strongholdPrizePicks from the colour prize list (R + T3 shelf including gold cards touching the
 * colour and the colour's typed duals; prizeOnly blocked) + the SEAL (story flag; five seals =
 * the gauntlet-unlock state — the gauntlet itself is designed nowhere and built nowhere, per brief).
 */
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import type { Modifier } from "@shandalar/engine";
import type { Catalog } from "./catalog.js";
import type { KnobValues } from "./knobs.js";
import type { WorldState } from "./state.js";

export type LordColor = "W" | "U" | "B" | "R" | "G";

/** Content shape (data/world/dungeons.json `strongholds`; ids match regions.json's fixed points). */
export interface StrongholdContentDef {
  id: string;
  name: string;
  color: LordColor;
  lord: { key: string; name: string; cardId: string; baseLife: number; portrait: string };
  law: { cardId: string; name: string; text: string };
}

/** Per-stronghold world state — lives in the v5-reserved `world.strongholds` array (the
 * reserved-field trick's third cashing; entries are created lazily, no save bump). */
export interface StrongholdState {
  color: LordColor;
  /** The story flag toward the gauntlet unlock (zero mechanics beyond counting). */
  seal: boolean;
  /** The hunt: tier-weighted kills of this spoke's opponents, inside and outside. Uncapped. */
  spokeMinionPoints: number;
}

export function strongholdState(world: WorldState, color: LordColor): StrongholdState {
  const entries = world.strongholds as StrongholdState[];
  let e = entries.find((x) => x.color === color);
  if (!e) {
    e = { color, seal: false, spokeMinionPoints: 0 };
    entries.push(e);
  }
  return e;
}

/** Credit a defeat to the lords of every colour the opponent WORE (tier N = N points per colour) —
 * the renown attribution, mirrored (S22 playtest r1, Chris: 14 green renown had bled the Sower
 * only 2 — spoke-only crediting skipped the humanoid opponents; the hunt now counts exactly the
 * defeats the renown ledger counts, so "renownByColor[G] ÷ 3" reads straight off the rail). */
export function creditSpokeKill(world: WorldState, colors: string | undefined, tier: number): void {
  for (const c of ["W", "U", "B", "R", "G"] as const) {
    if (colors?.includes(c)) strongholdState(world, c).spokeMinionPoints += tier;
  }
}

/** The global growth term: +lordGrowthLife per lordGrowthSteps world steps, capped. */
export function lordGrowth(world: WorldState, knobs: KnobValues): number {
  return Math.min(knobs.lordGrowthCap, Math.floor(world.player.stepsTaken / knobs.lordGrowthSteps) * knobs.lordGrowthLife);
}

/** The pace-war formula (interior empowerment stacks on top of this at the fight itself). */
export function lordStartingLife(world: WorldState, knobs: KnobValues, content: StrongholdContentDef): number {
  const reduction = Math.floor(strongholdState(world, content.color).spokeMinionPoints / knobs.spokePointsPerLife);
  return Math.max(knobs.lordLifeFloor, content.lord.baseLife + lordGrowth(world, knobs) - reduction);
}

/** The colour prize list (§treasures; S22 playtest r1 — Chris: ALL the colour's cards, not just
 * the R/T3 shelf, sorted by tier R → 3 → 2 → 1): mono and gold cards whose cost touches the
 * colour, plus the colour's TYPED duals (Tropical Island is a Forest — the lord makes the
 * investment fetchable). prizeOnly is blocked (Moxen, boss cards, laws). The player will usually
 * take from the top shelves; offering the whole wardrobe is the point. */
const BASIC_TYPE: Record<LordColor, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
const TIER_RANK: Record<string, number> = { R: 0, "3": 1, "2": 2, "1": 3 };
export function strongholdPrizeList(pool: Map<string, CardDef>, color: LordColor): CardDef[] {
  return [...pool.values()]
    .filter((d) => !d.isTokenDef && !d.prizeOnly && d.shopTier !== undefined)
    .filter((d) => {
      if (d.types.includes("Land")) return (d.subtypes ?? []).includes(BASIC_TYPE[color]);
      return cardColors(d).includes(color);
    })
    .sort((a, b) => (TIER_RANK[String(a.shopTier)]! - TIER_RANK[String(b.shopTier)]!) || a.id.localeCompare(b.id));
}

/** Seals held (the gauntlet-unlock state — the count is the whole mechanic this session). */
export function sealsHeld(world: WorldState): number {
  return (world.strongholds as StrongholdState[]).filter((e) => e.seal).length;
}

/** §5 visible schedules: each lord's current strength for the UI telegraph, with the rumor voice
 * ("grows fat on the years" / "has been bled by your hunting"). */
export interface LordStatusRow {
  color: LordColor;
  strongholdId: string;
  strongholdName: string;
  lordName: string;
  life: number;
  base: number;
  growth: number;
  reduction: number;
  sealed: boolean;
  voice: string;
}
export function lordStatus(world: WorldState, catalog: Catalog, knobs: KnobValues): LordStatusRow[] {
  return (catalog.strongholdContent ?? []).map((c) => {
    const st = strongholdState(world, c.color);
    const growth = lordGrowth(world, knobs);
    const reduction = Math.floor(st.spokeMinionPoints / knobs.spokePointsPerLife);
    const life = lordStartingLife(world, knobs, c);
    const voice = st.seal
      ? `${c.lord.name} has fallen; ${c.name} lies quiet.`
      : reduction > growth
        ? `${c.lord.name} has been bled by your hunting.`
        : growth > 0
          ? `${c.lord.name} grows fat on the years.`
          : `${c.lord.name} waits, untested.`;
    return { color: c.color, strongholdId: c.id, strongholdName: c.name, lordName: c.lord.name, life, base: c.lord.baseLife, growth, reduction, sealed: st.seal, voice };
  });
}

/** The partisan law as a defender-side modifier (per-battle re-injection — every interior duel's
 * MatchSpec carries it fresh; destruction is per-battle for free). */
export function lawModifier(content: StrongholdContentDef): Modifier {
  return { type: "permanentOnBattlefield", player: 1, cardId: content.law.cardId };
}

/** The entrance (Chris-ratified; engine modifier — post-mulligan logged swap). */
export function entranceModifier(content: StrongholdContentDef): Modifier {
  return { type: "signatureToHand", player: 1, cardId: content.lord.cardId };
}
