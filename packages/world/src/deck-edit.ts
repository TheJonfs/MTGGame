import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { deckLegal } from "./journey.js";
import { activeDeck, deckSize, type Collection, type Decklist, type WorldState } from "./state.js";

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
  world.decks[world.activeDeckName] = draft.map((e) => ({ ...e }));
  // Basics are free: the collection's basic counts track the deck's for bookkeeping.
  for (const b of BASIC_LANDS) {
    const inDeck = deckCount(draft, b);
    world.player.collection[b] = Math.max(world.player.collection[b] ?? 0, inDeck);
  }
  if (name !== undefined && name !== world.activeDeckName) {
    const r = renameDeck(world, world.activeDeckName, name);
    if (!r.ok) return r;
  }
  return { ok: true, deck: activeDeck(world) };
}

// ---------- S16 (v3): multiple decks ----------

export type DeckOp = { ok: true } | { ok: false; reason: string };

function validName(world: WorldState, name: string): string | null {
  const n = name.trim();
  if (!n) return "a deck needs a name";
  if (n.length > 40) return "name too long (40)";
  if (world.decks[n]) return `a deck named "${n}" already exists`;
  return null;
}

/** A new deck: 30 of the player's basic land — legal by construction (ADR-065:
 * no illegal deck is ever saved), a blank canvas for the editor. Not switched to. */
export function createDeck(world: WorldState, name: string): DeckOp {
  const bad = validName(world, name);
  if (bad) return { ok: false, reason: bad };
  world.decks[name.trim()] = [{ cardId: world.player.basicLand, count: 30 }];
  return { ok: true };
}

export function duplicateDeck(world: WorldState, from: string, name: string): DeckOp {
  const src = world.decks[from];
  if (!src) return { ok: false, reason: `no deck "${from}"` };
  const bad = validName(world, name);
  if (bad) return { ok: false, reason: bad };
  world.decks[name.trim()] = src.map((e) => ({ ...e }));
  return { ok: true };
}

/** Delete a saved deck — never the active one (switch first), never the last. */
export function deleteDeck(world: WorldState, name: string): DeckOp {
  if (!world.decks[name]) return { ok: false, reason: `no deck "${name}"` };
  if (name === world.activeDeckName) return { ok: false, reason: "that deck is active — switch to another first" };
  if (Object.keys(world.decks).length <= 1) return { ok: false, reason: "you need at least one deck" };
  delete world.decks[name];
  return { ok: true };
}

export function renameDeck(world: WorldState, from: string, to: string): DeckOp {
  const src = world.decks[from];
  if (!src) return { ok: false, reason: `no deck "${from}"` };
  const bad = validName(world, to);
  if (bad) return { ok: false, reason: bad };
  const next: Record<string, Decklist> = {};
  for (const [k, v] of Object.entries(world.decks)) next[k === from ? to.trim() : k] = v; // keep order
  world.decks = next;
  if (world.activeDeckName === from) world.activeDeckName = to.trim();
  return { ok: true };
}

/** Make a saved deck the one that duels. Every saved deck is legal by
 * construction, but a deck can drift illegal when copies are lost (ante) —
 * the spares rule counts the ACTIVE deck only, so a non-active deck may list
 * copies you no longer own; switching re-checks ownership and legality. */
export function switchDeck(world: WorldState, name: string): DeckOp {
  const deck = world.decks[name];
  if (!deck) return { ok: false, reason: `no deck "${name}"` };
  const legal = deckLegal(deck);
  if (!legal.ok) return { ok: false, reason: legal.reason ?? "illegal deck" };
  for (const e of deck) {
    if (!isBasic(e.cardId) && (world.player.collection[e.cardId] ?? 0) < e.count) {
      return { ok: false, reason: `${e.cardId}: deck lists ${e.count}, you own ${world.player.collection[e.cardId] ?? 0} — edit it first` };
    }
  }
  world.activeDeckName = name;
  return { ok: true };
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
