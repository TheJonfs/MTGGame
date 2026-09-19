import { cardColors, manaValue, parseManaCost, type CardDef, type CardType } from "@shandalar/cards";
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
  /** S40 (ADR-128, the Wrackroot gate — a stat predicate): every creature card's printed power ≥ N. */
  minCreaturePower?: number;
  /** S40 (the Observatory gate — a fraction): land cards ÷ all cards ≥ N (0 < N ≤ 1). */
  minLandFraction?: number;
  /** S40 (the Shevelport gate — a type ban): no card of any of these types. */
  bannedTypes?: CardType[];
  /** "the Jeskai gate" — shown by the editor and the parley. */
  label: string;
}
export const DECK_RULE_FIELDS = ["colorsWithin", "minCreatures", "maxLands", "maxManaValue", "singleton", "minCards", "minCreaturePower", "minLandFraction", "bannedTypes", "label"] as const;
const RULE_CARD_TYPES: readonly CardType[] = ["Land", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact"];

/** `failed` (S40): the rule fields that produced a problem, in check order — the door picks its voice by the first. */
export interface DeckCheck { ok: boolean; problems: string[]; failed?: (keyof DeckRule)[] }

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
  const failed: (keyof DeckRule)[] = [];
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
    const needsPool = rule.colorsWithin || rule.minCreatures !== undefined || rule.maxLands !== undefined || rule.maxManaValue !== undefined || rule.minCreaturePower !== undefined || rule.minLandFraction !== undefined || rule.bannedTypes !== undefined;
    if (needsPool && !pool) throw new Error(`checkDeck: the rule "${rule.label}" reads the cards; pass the pool`);
    const def = (id: string) => pool?.get(id);
    const listOf = (ids: { cardId: string; count: number }[]) => ids.map((e) => (e.count > 1 ? `${name(e.cardId)} ×${e.count}` : name(e.cardId))).join(", ");
    const before = () => problems.length;
    const mark = (field: keyof DeckRule, at: number) => { if (problems.length > at) failed.push(field); };
    let at = before();
    if (rule.minCards !== undefined && n < rule.minCards) problems.push(`${n} cards; ${rule.label} asks ${rule.minCards}`);
    mark("minCards", at); at = before();
    if (rule.colorsWithin) {
      const allowed = new Set(rule.colorsWithin);
      const out = list.filter((e) => { const d = def(e.cardId); return d ? cardColors(d).some((c) => !allowed.has(c)) : false; });
      const k = out.reduce((m, e) => m + e.count, 0);
      if (k > 0) problems.push(`${plural(k, "card is", "cards are")} outside ${rule.label}'s colours (${rule.colorsWithin.join("")}): ${listOf(out)}`);
    }
    mark("colorsWithin", at); at = before();
    if (rule.minCreatures !== undefined) {
      const k = list.reduce((m, e) => m + (def(e.cardId)?.types.includes("Creature") ? e.count : 0), 0);
      if (k < rule.minCreatures) problems.push(`${plural(k, "creature")}; ${rule.label} asks ${rule.minCreatures}`);
    }
    mark("minCreatures", at); at = before();
    if (rule.maxLands !== undefined) {
      const k = list.reduce((m, e) => m + (def(e.cardId)?.types.includes("Land") ? e.count : 0), 0);
      if (k > rule.maxLands) problems.push(`${plural(k, "land")}; ${rule.label} allows ${rule.maxLands}`);
    }
    mark("maxLands", at); at = before();
    if (rule.maxManaValue !== undefined) {
      const max = rule.maxManaValue;
      const out = list.filter((e) => { const d = def(e.cardId); return d ? !d.types.includes("Land") && manaValue(parseManaCost(d.manaCost)) > max : false; });
      const k = out.reduce((m, e) => m + e.count, 0);
      if (k > 0) problems.push(`${plural(k, "card")} above mana value ${max}; ${rule.label} allows none: ${listOf(out)}`);
    }
    mark("maxManaValue", at); at = before();
    if (rule.singleton) {
      const out = list.filter((e) => !isBasic(e.cardId) && e.count > 1);
      if (out.length > 0) problems.push(`${plural(out.length, "card has", "cards have")} more than one copy; ${rule.label} is singleton: ${listOf(out)}`);
    }
    mark("singleton", at); at = before();
    // S40 (ADR-128): the three new gates — a stat floor, a fraction, a type ban.
    if (rule.minCreaturePower !== undefined) {
      const min = rule.minCreaturePower;
      const out = list.filter((e) => { const d = def(e.cardId); return d ? d.types.includes("Creature") && (d.power ?? 0) < min : false; });
      const k = out.reduce((m, e) => m + e.count, 0);
      if (k > 0) problems.push(`${plural(k, "creature has", "creatures have")} power less than ${min}: ${listOf(out)}`);
    }
    mark("minCreaturePower", at); at = before();
    if (rule.minLandFraction !== undefined) {
      const k = list.reduce((m, e) => m + (def(e.cardId)?.types.includes("Land") ? e.count : 0), 0);
      // Integer arithmetic for the common fractions; the comparison is lands ≥ fraction × cards.
      if (k < rule.minLandFraction * n - 1e-9) problems.push(`lands are ${k} of ${n}; ${rule.label} asks ${rule.minLandFraction === 0.5 ? "half" : `${Math.round(rule.minLandFraction * 100)}%`}`);
    }
    mark("minLandFraction", at); at = before();
    if (rule.bannedTypes) {
      for (const t of rule.bannedTypes) {
        const out = list.filter((e) => def(e.cardId)?.types.includes(t));
        const k = out.reduce((m, e) => m + e.count, 0);
        if (k > 0) problems.push(`${plural(k, t.toLowerCase())}: ${listOf(out)}`);
      }
    }
    mark("bannedTypes", at);
  }
  return { ok: problems.length === 0, problems, ...(failed.length > 0 ? { failed } : {}) };
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
  if (rule.minCreaturePower !== undefined) parts.push(`every creature's power ≥ ${rule.minCreaturePower}`);
  if (rule.minLandFraction !== undefined) parts.push(`lands ≥ ${rule.minLandFraction === 0.5 ? "half" : `${Math.round(rule.minLandFraction * 100)}%`} of the deck`);
  if (rule.bannedTypes) parts.push(`no ${rule.bannedTypes.map((t) => `${t.toLowerCase()}s`).join(" or ")}`);
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
  for (const k of ["minCreatures", "maxLands", "maxManaValue", "minCards", "minCreaturePower"] as const) {
    if (r[k] !== undefined && (!Number.isInteger(r[k]) || (r[k] as number) < 0)) errors.push(`${where}: deckRule.${k} must be a non-negative integer`);
  }
  if (r.singleton !== undefined && typeof r.singleton !== "boolean") errors.push(`${where}: deckRule.singleton must be a boolean`);
  if (r.minLandFraction !== undefined && (typeof r.minLandFraction !== "number" || !(r.minLandFraction > 0 && r.minLandFraction <= 1))) errors.push(`${where}: deckRule.minLandFraction must be a number in (0, 1]`);
  if (r.bannedTypes !== undefined && (!Array.isArray(r.bannedTypes) || r.bannedTypes.length === 0 || r.bannedTypes.some((t) => !RULE_CARD_TYPES.includes(t as CardType)) || new Set(r.bannedTypes).size !== r.bannedTypes.length)) errors.push(`${where}: deckRule.bannedTypes must be a non-empty array of distinct card types`);
  return errors;
}
