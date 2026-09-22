/**
 * S43 (ADR-136): THE FLOOD'S LAIRS — the phase-two manalink economy. Each coloured territory carries three lairs across
 * its approach and wild rings, each with a manalink at the end: a BASIC-land link guarded by the territory's tier-3
 * mage (the Landing), a LIFE link guarded by its tier-3 beast (the Wellhouse), a LIFE link guarded by its tier-2 mage
 * (the Hearthstead). Fifteen lairs, five basics and ten life links, there to be earned before a stronghold.
 *
 * This module is the RULE (which resident guards which lair) and the site's identity — it imports nothing that
 * imports the generator, so `generate.ts` can read it. The threshold, the duel and the prize live in journey.ts
 * (the S14 certain-encounter path: `contact: "lair"`, the resident's parley, `lairResidentLifeBonus`).
 */
import { mageListFor } from "@shandalar/sim/mage-decks";
import { FLOOD_LAIR_KINDS, type Catalog, type FloodLairKind, type OpponentTemplate } from "./catalog.js";

export type LairColor = "W" | "U" | "B" | "R" | "G";
const COLORS: readonly LairColor[] = ["W", "U", "B", "R", "G"];

/** A lair site's content id: `lair:<kind>:<colour>` (the S41 `contentId` pattern; fifteen per map). */
export const floodLairId = (kind: FloodLairKind, color: LairColor): string => `lair:${kind}:${color}`;
export function parseFloodLairId(id: string | undefined): { kind: FloodLairKind; color: LairColor } | null {
  const m = id?.match(/^lair:(landing|wellhouse|hearthstead):([WUBRG])$/);
  return m ? { kind: m[1] as FloodLairKind, color: m[2] as LairColor } : null;
}

/** The prize a lair kind pays: the basic of the territory's colour in play (a manalink of the land kind), or +2
 * maximum world life (two life links). */
export const FLOOD_LAIR_PRIZE: Record<FloodLairKind, { kind: "basic" | "life"; count: number }> = {
  landing: { kind: "basic", count: 1 },
  wellhouse: { kind: "life", count: 2 },
  hearthstead: { kind: "life", count: 2 },
};

/**
 * The resident table: by KEPT colour for the mages (the inversion's assignment — the flood list's first colour is the
 * one the mage kept), by spoke for the beasts. Two tier-2 mages keep blue (Kessa, Pell) and none keeps red, so the
 * unmatched mage takes the unfilled colour (Kessa in red — the planner's placement; the rule reaches it without a
 * name: an unfilled colour takes the free mage who WORE it at phase one). Deterministic: catalog order, colours in WUBRG.
 */
export function floodLairResidents(catalog: Pick<Catalog, "opponents">): Record<LairColor, Record<FloodLairKind, OpponentTemplate>> {
  const mages = catalog.opponents.filter((o) => (o.kind ?? "mage") === "mage" && typeof o.deck === "string" && o.deck.startsWith("mage:"));
  const kept = (o: OpponentTemplate): LairColor | null => {
    const flood = mageListFor(o.deck.slice(5), 2);
    return flood && flood.colors !== mageListFor(o.deck.slice(5), 1)?.colors ? (flood.colors[0] as LairColor) : null;
  };
  const byTier = (tier: 2 | 3): Record<LairColor, OpponentTemplate> => {
    const pool = mages.filter((o) => o.tier === tier && kept(o));
    const out: Partial<Record<LairColor, OpponentTemplate>> = {};
    const taken = new Set<string>();
    const free = () => pool.filter((o) => !taken.has(o.id));
    const give = (c: LairColor, m: OpponentTemplate | undefined) => { if (m) { out[c] = m; taken.add(m.id); } };
    // 1. A colour one mage alone keeps takes that mage.
    for (const c of COLORS) { const ms = free().filter((o) => kept(o) === c); if (ms.length === 1) give(c, ms[0]); }
    // 2. An unfilled colour takes a free mage who WORE it at phase one (Kessa's Mountains → red).
    for (const c of COLORS) if (!out[c]) give(c, free().find((o) => kept(o) !== c && o.colors.includes(c)));
    // 3. Then by kept colour; then whoever is left.
    for (const c of COLORS) if (!out[c]) give(c, free().find((o) => kept(o) === c));
    for (const c of COLORS) if (!out[c]) give(c, free()[0]);
    for (const c of COLORS) if (!out[c]) throw new Error(`flood lairs: no tier-${tier} mage for ${c}`);
    return out as Record<LairColor, OpponentTemplate>;
  };
  const t3 = byTier(3), t2 = byTier(2);
  const beasts = catalog.opponents.filter((o) => o.kind === "beast");
  const out = {} as Record<LairColor, Record<FloodLairKind, OpponentTemplate>>;
  for (const c of COLORS) {
    const spoke = beasts.filter((o) => o.spoke === c);
    const top = Math.max(0, ...spoke.map((o) => o.tier));
    const beast = spoke.find((o) => o.tier === top);
    if (!beast) throw new Error(`flood lairs: no beast on the ${c} spoke`);
    out[c] = { landing: t3[c], wellhouse: beast, hearthstead: t2[c] };
  }
  return out;
}

/** The lair's map name: the region's name with the kind's name after it ("The Saltings Landing"). */
export function floodLairName(regionNameText: string, kind: FloodLairKind, text: Pick<Catalog, "questText">["questText"]): string {
  const kindName = text?.flood?.lairs?.[kind]?.name ?? { landing: "Landing", wellhouse: "Wellhouse", hearthstead: "Hearthstead" }[kind];
  return `${regionNameText} ${kindName}`;
}

export { FLOOD_LAIR_KINDS };
