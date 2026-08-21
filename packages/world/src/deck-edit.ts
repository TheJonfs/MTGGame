import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { deckLegal } from "./journey.js";
import { deckSize, type Collection, type Decklist, type WorldState } from "./state.js";

/**
 * Deck editing (S14 Part 2): the collection is cardId → count, the active
 * deck is a decklist. Spares = ownership minus deck counts. Basics are free
 * and infinite (never gated by collection counts). Every mutation re-checks
 * `deckLegal`; removals that would break the floor are allowed in the editor
 * (you may be mid-edit) but the editor cannot SAVE an illegal deck (ADR-065):
 * the UI keeps a draft and commits only via `commitDeck`.
 */

export const BASIC_LANDS = ["plains", "island", "swamp", "mountain", "forest"] as const;
export const isBasic = (cardId: string) => (BASIC_LANDS as readonly string[]).includes(cardId);

export function deckCount(deck: Decklist, cardId: string): number {
  return deck.find((e) => e.cardId === cardId)?.count ?? 0;
}

/** Owned copies not in the deck, per card (basics excluded — they have their own row). */
export function spares(collection: Collection, deck: Decklist): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(collection)) {
    if (isBasic(id)) continue;
    const free = n - deckCount(deck, id);
    if (free > 0) out[id] = free;
  }
  return out;
}

export type EditResult = { ok: true; deck: Decklist } | { ok: false; reason: string };

/** Add one copy to a draft deck (basics always; others only if a spare exists and the 4-cap holds). */
export function addCopy(collection: Collection, deck: Decklist, cardId: string): EditResult {
  const next = deck.map((e) => ({ ...e }));
  if (!isBasic(cardId)) {
    const free = (collection[cardId] ?? 0) - deckCount(deck, cardId);
    if (free <= 0) return { ok: false, reason: "no spare copy owned" };
    if (deckCount(deck, cardId) >= 4) return { ok: false, reason: "4-copy cap" };
  }
  const e = next.find((x) => x.cardId === cardId);
  if (e) e.count += 1;
  else next.push({ cardId, count: 1 });
  return { ok: true, deck: next };
}

/** Remove one copy from a draft deck (always allowed while drafting; saving re-checks legality). */
export function removeCopy(deck: Decklist, cardId: string): EditResult {
  const next = deck.map((e) => ({ ...e }));
  const e = next.find((x) => x.cardId === cardId);
  if (!e) return { ok: false, reason: "not in deck" };
  e.count -= 1;
  if (e.count === 0) next.splice(next.indexOf(e), 1);
  return { ok: true, deck: next };
}

/** Commit a draft: legal decks only (ADR-065). Mutates world. */
export function commitDeck(world: WorldState, draft: Decklist, name?: string): EditResult {
  const legal = deckLegal(draft);
  if (!legal.ok) return { ok: false, reason: legal.reason ?? "illegal deck" };
  // Every non-basic copy must be owned.
  for (const e of draft) {
    if (!isBasic(e.cardId) && (world.player.collection[e.cardId] ?? 0) < e.count) {
      return { ok: false, reason: `${e.cardId}: deck has ${e.count}, you own ${world.player.collection[e.cardId] ?? 0}` };
    }
  }
  world.player.activeDeck = draft.map((e) => ({ ...e }));
  // Basics are free: the collection's basic counts track the deck's for bookkeeping.
  for (const b of BASIC_LANDS) {
    const inDeck = deckCount(draft, b);
    world.player.collection[b] = Math.max(world.player.collection[b] ?? 0, inDeck);
  }
  if (name !== undefined) world.deckName = name;
  return { ok: true, deck: world.player.activeDeck };
}

/** Reading aids: curve, colours, lands, types. */
export function deckStats(pool: Map<string, CardDef>, deck: Decklist): {
  size: number;
  lands: number;
  curve: number[]; // index = mana value (0..7+, last bucket = 7+), nonland only
  colors: Record<string, number>;
  types: Record<string, number>;
} {
  const curve = new Array(8).fill(0);
  const colors: Record<string, number> = {};
  const types: Record<string, number> = {};
  let lands = 0;
  for (const e of deck) {
    const def = pool.get(e.cardId);
    if (!def) continue;
    if (def.types.includes("Land")) {
      lands += e.count;
    } else {
      const mv = Math.min(7, manaValue(parseManaCost(def.manaCost)));
      curve[mv] += e.count;
    }
    for (const c of cardColors(def)) colors[c] = (colors[c] ?? 0) + e.count;
    for (const t of def.types) types[t] = (types[t] ?? 0) + e.count;
  }
  return { size: deckSize(deck), lands, curve, colors, types };
}
