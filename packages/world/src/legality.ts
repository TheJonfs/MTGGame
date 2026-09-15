import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Collection, Decklist } from "./state.js";

/**
 * Deck legality (S37 Part 1.3, ADR-123): ONE check for every reader — the editor's live panel, the
 * commit (ADR-065: no illegal deck is ever saved), the switch (a deck that drifted illegal after ante
 * losses), the duel (today's floor and cap) and the DOOR (a template's `deckRule`, phase two's
 * gates — the parley refuses a deck that fails one, naming the rule). Every problem is a sentence.
 */

export const BASIC_LANDS = ["plains", "island", "swamp", "mountain", "forest"] as const;
export const isBasic = (cardId: string) => (BASIC_LANDS as readonly string[]).includes(cardId);
/** The slice's floor and cap (manifest §2; S14). */
export const DECK_FLOOR = 30;
export const COPY_CAP = 4;

export type DeckColor = "W" | "U" | "B" | "R" | "G";

/** S37 Part 2 (ADR-123): a door's deckbuilding rule on an opponent template. Every field optional but
 * the label; the fields are the phase-two design's §5 candidates (the stronghold's colour gate, the
 * courts' shape gates). No existing template carries one. */
export interface DeckRule {
  /** The stronghold gate: every card's colours ⊆ this set (colourless always ok). */
  colorsWithin?: DeckColor[];
  minCreatures?: number;
  maxLands?: number;
  maxManaValue?: number;
  /** At most one of each non-basic. */
  singleton?: boolean;
  minCards?: number;
  /** "the Jeskai gate" — shown by the editor and the parley. */
  label: string;
}
export const DECK_RULE_FIELDS = ["colorsWithin", "minCreatures", "maxLands", "maxManaValue", "singleton", "minCards", "label"] as const;

export interface DeckCheck { ok: boolean; problems: string[] }

const deckSize = (deck: Decklist) => deck.reduce((n, e) => n + e.count, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * `checkDeck(list, collection?, rule?, pool?)` → every problem, as a sentence.
 * - The base rules always: the 30-card floor, the 4-copy cap (basics exempt).
 * - Ownership when a collection is given: every non-basic copy must be owned.
 * - A door rule when given (the pool is required for the rules that read the cards; without one the
 *   check throws rather than admit a deck it could not read).
 */
export function checkDeck(list: Decklist, collection?: Collection | null, rule?: DeckRule | null, pool?: Map<string, CardDef> | null): DeckCheck {
  const name = (id: string) => pool?.get(id)?.name ?? id;
  const problems: string[] = [];
  const n = deckSize(list);
  if (n < DECK_FLOOR) problems.push(`deck has ${n} cards; the floor is ${DECK_FLOOR}`);
  for (const e of list) if (!isBasic(e.cardId) && e.count > COPY_CAP) problems.push(`${name(e.cardId)} ×${e.count} exceeds the ${COPY_CAP}-copy cap`);
  if (collection) {
    for (const e of list) {
      const owned = collection[e.cardId] ?? 0;
      if (!isBasic(e.cardId) && owned < e.count) problems.push(`${name(e.cardId)}: deck has ${e.count}, you own ${owned}`);
    }
  }
  if (rule) {
    const needsPool = rule.colorsWithin || rule.minCreatures !== undefined || rule.maxLands !== undefined || rule.maxManaValue !== undefined;
    if (needsPool && !pool) throw new Error(`checkDeck: the rule "${rule.label}" reads the cards; pass the pool`);
    const def = (id: string) => pool?.get(id);
    const listOf = (ids: { cardId: string; count: number }[]) => ids.map((e) => (e.count > 1 ? `${name(e.cardId)} ×${e.count}` : name(e.cardId))).join(", ");
    if (rule.minCards !== undefined && n < rule.minCards) problems.push(`${n} cards; ${rule.label} asks ${rule.minCards}`);
    if (rule.colorsWithin) {
      const allowed = new Set(rule.colorsWithin);
      const out = list.filter((e) => { const d = def(e.cardId); return d ? cardColors(d).some((c) => !allowed.has(c)) : false; });
      const k = out.reduce((m, e) => m + e.count, 0);
      if (k > 0) problems.push(`${plural(k, "card is", "cards are")} outside ${rule.label}'s colours (${rule.colorsWithin.join("")}): ${listOf(out)}`);
    }
    if (rule.minCreatures !== undefined) {
      const k = list.reduce((m, e) => m + (def(e.cardId)?.types.includes("Creature") ? e.count : 0), 0);
      if (k < rule.minCreatures) problems.push(`${plural(k, "creature")}; ${rule.label} asks ${rule.minCreatures}`);
    }
    if (rule.maxLands !== undefined) {
      const k = list.reduce((m, e) => m + (def(e.cardId)?.types.includes("Land") ? e.count : 0), 0);
      if (k > rule.maxLands) problems.push(`${plural(k, "land")}; ${rule.label} allows ${rule.maxLands}`);
    }
    if (rule.maxManaValue !== undefined) {
      const max = rule.maxManaValue;
      const out = list.filter((e) => { const d = def(e.cardId); return d ? !d.types.includes("Land") && manaValue(parseManaCost(d.manaCost)) > max : false; });
      const k = out.reduce((m, e) => m + e.count, 0);
      if (k > 0) problems.push(`${plural(k, "card")} above mana value ${max}; ${rule.label} allows none: ${listOf(out)}`);
    }
    if (rule.singleton) {
      const out = list.filter((e) => !isBasic(e.cardId) && e.count > 1);
      if (out.length > 0) problems.push(`${plural(out.length, "card has", "cards have")} more than one copy; ${rule.label} is singleton: ${listOf(out)}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/** The rule in one line, for the editor's panel and enemies.md: "colours within WUR; ≥ 15 creatures; ≤ 12 lands". */
export function describeDeckRule(rule: DeckRule): string {
  const parts: string[] = [];
  if (rule.colorsWithin) parts.push(`colours within ${rule.colorsWithin.join("")}`);
  if (rule.minCreatures !== undefined) parts.push(`≥ ${rule.minCreatures} creatures`);
  if (rule.maxLands !== undefined) parts.push(`≤ ${rule.maxLands} lands`);
  if (rule.maxManaValue !== undefined) parts.push(`mana value ≤ ${rule.maxManaValue}`);
  if (rule.singleton) parts.push("singleton");
  if (rule.minCards !== undefined) parts.push(`≥ ${rule.minCards} cards`);
  return parts.join("; ") || "no constraint";
}

/** Catalog validation of a template's rule (S21 pack lesson: every field named). Returns the errors. */
export function validateDeckRule(rule: unknown, where: string): string[] {
  const errors: string[] = [];
  if (!rule || typeof rule !== "object") return [`${where}: deckRule must be an object`];
  const r = rule as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!(DECK_RULE_FIELDS as readonly string[]).includes(k)) errors.push(`${where}: unknown deckRule field "${k}"`);
  if (typeof r.label !== "string" || !r.label.trim()) errors.push(`${where}: deckRule.label must be a non-empty string`);
  if (r.colorsWithin !== undefined) {
    if (!Array.isArray(r.colorsWithin) || r.colorsWithin.length === 0 || r.colorsWithin.some((c) => !["W", "U", "B", "R", "G"].includes(c as string)) || new Set(r.colorsWithin).size !== r.colorsWithin.length) errors.push(`${where}: deckRule.colorsWithin must be a non-empty array of distinct WUBRG letters`);
  }
  for (const k of ["minCreatures", "maxLands", "maxManaValue", "minCards"] as const) {
    if (r[k] !== undefined && (!Number.isInteger(r[k]) || (r[k] as number) < 0)) errors.push(`${where}: deckRule.${k} must be a non-negative integer`);
  }
  if (r.singleton !== undefined && typeof r.singleton !== "boolean") errors.push(`${where}: deckRule.singleton must be a boolean`);
  return errors;
}
