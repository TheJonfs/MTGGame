import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { PetalColor } from "./corolla.js";
import type { Decklist } from "./state.js";
import { strongholdPrizeList } from "./stronghold.js";

/**
 * S39 (ADR-126): THE SALVAGE — phase two's prescribed start. The player leaves the water with the ten
 * legends, one free pick per colour, a fixed fifty-five-card PACK (the planner's list: ten per colour at
 * tier ≤ 2, five colourless), a purse, no manalinks; then chooses two colours and the editor opens on a
 * credible thirty assembled from those colours' pack halves (Chris: twelve lands; not a good build, a
 * starting point). The pack is a fixed list so the Lab can measure it (the salvage yardsticks).
 */
export const SALVAGE_COLORS: readonly PetalColor[] = ["W", "U", "B", "R", "G"];
export const BASIC_OF: Record<PetalColor, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };

export interface SalvagePack {
  /** Ten ids per colour, in the planner's order (the assembler breaks mana-value ties by it). */
  colors: Record<PetalColor, string[]>;
  /** Five colourless ids. */
  colorless: string[];
}
export const PACK_PER_COLOR = 10;
export const PACK_COLORLESS = 5;

/** Structural validation for the catalog loader (no pool at hand): the shape, the counts, no duplicates. */
export function validateSalvagePack(pack: unknown): string[] {
  const errors: string[] = [];
  const p = pack as Partial<SalvagePack> | undefined;
  if (!p || typeof p !== "object") return ["salvage: the pack must be an object"];
  for (const c of SALVAGE_COLORS) {
    const list = p.colors?.[c];
    if (!Array.isArray(list) || list.length !== PACK_PER_COLOR || list.some((x) => typeof x !== "string")) errors.push(`salvage: colors.${c} must list exactly ${PACK_PER_COLOR} ids`);
  }
  if (!Array.isArray(p.colorless) || p.colorless.length !== PACK_COLORLESS || p.colorless.some((x) => typeof x !== "string")) errors.push(`salvage: colorless must list exactly ${PACK_COLORLESS} ids`);
  const all = packIds(p as SalvagePack);
  if (new Set(all).size !== all.length) errors.push("salvage: the pack repeats an id (one copy of each)");
  return errors;
}

export function packIds(pack: SalvagePack): string[] {
  return [...SALVAGE_COLORS.flatMap((c) => pack.colors?.[c] ?? []), ...(pack.colorless ?? [])];
}

/** The pack against the pool: every id known; a colour's ten carry that colour (and no other), tier ≤ 2,
 * never prizeOnly; the colourless five carry no colour. Sentences, for the test and the reference. */
export function salvagePackProblems(pack: SalvagePack, pool: Map<string, CardDef>): string[] {
  const out: string[] = [];
  const tierOk = (d: CardDef) => d.shopTier === 1 || d.shopTier === 2;
  for (const c of SALVAGE_COLORS) {
    for (const id of pack.colors[c]) {
      const d = pool.get(id);
      if (!d) { out.push(`${c}: ${id} is not in the pool`); continue; }
      const cols = cardColors(d);
      if (cols.length !== 1 || cols[0] !== c) out.push(`${c}: ${d.name} is ${cols.join("") || "colourless"}, not mono-${c}`);
      if (!tierOk(d)) out.push(`${c}: ${d.name} is tier ${String(d.shopTier)}; the pack allows 1–2`);
      if (d.prizeOnly) out.push(`${c}: ${d.name} is prizeOnly`);
    }
  }
  for (const id of pack.colorless) {
    const d = pool.get(id);
    if (!d) { out.push(`colourless: ${id} is not in the pool`); continue; }
    if (cardColors(d).length !== 0) out.push(`colourless: ${d.name} carries a colour`);
    if (!tierOk(d)) out.push(`colourless: ${d.name} is tier ${String(d.shopTier)}; the pack allows 1–2`);
    if (d.prizeOnly) out.push(`colourless: ${d.name} is prizeOnly`);
  }
  return out;
}

/** The pick candidates for a colour tab: the stronghold prize picker's rule (a card counts for any colour it
 * carries — gold included; typed lands by their basic type; every shop tier including R; never prizeOnly). */
export function salvageCandidates(pool: Map<string, CardDef>, color: PetalColor): CardDef[] {
  return strongholdPrizeList(pool, color);
}

/** Does a picked card belong to the pair's colours (a spell whose colours sit within the pair; a land typed
 * for one of the pair's basics)? Colourless picks are never in a pair. */
export function pickInPair(def: CardDef, pair: readonly [PetalColor, PetalColor]): boolean {
  if (def.types.includes("Land")) return (def.subtypes ?? []).some((s) => pair.some((c) => BASIC_TYPE[c] === s));
  const cols = cardColors(def);
  return cols.length > 0 && cols.every((c) => (pair as readonly string[]).includes(c));
}
const BASIC_TYPE: Record<PetalColor, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

/**
 * The first deck (Chris, 2026-09-16: the twelve-land shape): each pair colour's ten minus its two highest
 * mana values (ties: the later in the planner's list goes first) = sixteen; the picks that sit in the pair;
 * colourless artifacts from the pack until eighteen nonland cards or the five run out; basics to thirty, split
 * by the nonland cards' pip counts (each colour at least three). Legal by construction (≥ 30, one copy each).
 */
export function assembleSalvageDeck(pool: Map<string, CardDef>, pack: SalvagePack, pair: readonly [PetalColor, PetalColor], picks: readonly string[]): Decklist {
  const def = (id: string): CardDef => { const d = pool.get(id); if (!d) throw new Error(`salvage: ${id} is not in the pool`); return d; };
  const mv = (id: string) => { const d = def(id); return d.types.includes("Land") ? -1 : manaValue(parseManaCost(d.manaCost)); };
  const deck: Decklist = [];
  const add = (id: string) => { const e = deck.find((x) => x.cardId === id); if (e) e.count += 1; else deck.push({ cardId: id, count: 1 }); };
  for (const c of pair) {
    const ten = pack.colors[c];
    // Drop the two highest mana values; ties by list position descending (the later card leaves first).
    const ranked = ten.map((id, i) => ({ id, i, mv: mv(id) })).sort((a, b) => b.mv - a.mv || b.i - a.i);
    const dropped = new Set(ranked.slice(0, 2).map((x) => x.id));
    for (const id of ten) if (!dropped.has(id)) add(id);
  }
  for (const id of picks) if (pickInPair(def(id), pair)) add(id);
  const nonland = () => deck.reduce((n, e) => n + (def(e.cardId).types.includes("Land") ? 0 : e.count), 0);
  for (const id of pack.colorless) { if (nonland() >= 18) break; if (!def(id).types.includes("Land")) add(id); }
  // Basics to thirty, by pips.
  const size = () => deck.reduce((n, e) => n + e.count, 0);
  const pips: Record<string, number> = { [pair[0]]: 0, [pair[1]]: 0 };
  for (const e of deck) for (const ch of def(e.cardId).manaCost.replace(/[^WUBRG]/g, "")) if (ch in pips) pips[ch]! += e.count;
  const basicsN = Math.max(0, 30 - size());
  const total = Math.max(1, pips[pair[0]]! + pips[pair[1]]!);
  let first = Math.round((basicsN * pips[pair[0]]!) / total);
  first = Math.max(Math.min(3, basicsN), Math.min(basicsN - Math.min(3, basicsN), first));
  for (let i = 0; i < first; i++) add(BASIC_OF[pair[0]]);
  for (let i = 0; i < basicsN - first; i++) add(BASIC_OF[pair[1]]);
  return deck;
}

/** The ten pairs, in a fixed order (the still pairs first, then the flowing — the design's vocabulary). */
export const SALVAGE_PAIRS: readonly [PetalColor, PetalColor][] = [["W", "U"], ["U", "B"], ["B", "R"], ["R", "G"], ["G", "W"], ["W", "B"], ["U", "R"], ["B", "G"], ["R", "W"], ["G", "U"]];
export const PAIR_NAMES: Record<string, string> = { WU: "Azorius", UB: "Dimir", BR: "Rakdos", RG: "Gruul", GW: "Selesnya", WB: "Orzhov", UR: "Izzet", BG: "Golgari", RW: "Boros", GU: "Simic" };
export function pairName(pair: readonly [PetalColor, PetalColor]): string {
  return PAIR_NAMES[`${pair[0]}${pair[1]}`] ?? PAIR_NAMES[`${pair[1]}${pair[0]}`] ?? `${pair[0]}${pair[1]}`;
}
