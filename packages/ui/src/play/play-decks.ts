import type { CardDef } from "@shandalar/cards";
import { OPEN_FIELD } from "@shandalar/sim/open-decks";
import { EVENT_SAVE_KEY, OPEN_FORMAT, cardLegal, copyCap, deserializeEvent, isBasic, type Collection, type Decklist } from "@shandalar/world";
import type { LabDeck } from "../lab/lab-decks.js";
import { playRoster } from "./play-roster.js";
import { deckUnlocked, readUnlocked } from "../seen.js";

/**
 * Post-S58 (Chris: the single match's picker was "a menu of specific decks that results in a lot of options"): the
 * setup's decks as a CATEGORY and a DECK within it, plus decks BUILT here for either side. This module is the data:
 * the categories in their order, the Open's lists as one of them, and the built decks kept in the browser.
 */
export type PlayArchetype = "aggro" | "midrange" | "control" | "combo";
/** `sideboard` (post-S60, the match): a built deck's own, an Open list's registered fifteen, the Convocation deck's. */
export interface PlayChoice { key: string; group: string; name: string; label: string; archetype: PlayArchetype; decklist: Decklist; sideboard?: Decklist; portrait?: string }
export const PLAY_CATEGORIES: { group: string; title: string }[] = [
  { group: "built", title: "Decks built here" },
  { group: "open", title: "The Open's lists" },
  { group: "saved", title: "Your journey's decks" },
  { group: "mages", title: "The mages" },
  { group: "beasts", title: "The beasts" },
  { group: "bosses", title: "The bosses you have met" },
];

export const BUILT_DECKS_KEY = "shandalar-play-decks";
export interface BuiltDeck { name: string; archetype: PlayArchetype; decklist: Decklist; sideboard?: Decklist }
type Store = Pick<Storage, "getItem" | "setItem">;
export function readBuiltDecks(storage: Store | null): BuiltDeck[] {
  try { const xs = JSON.parse(storage?.getItem(BUILT_DECKS_KEY) ?? "[]") as unknown; return Array.isArray(xs) ? (xs as BuiltDeck[]).filter((d) => d && typeof d.name === "string" && Array.isArray(d.decklist)) : []; } catch { return []; }
}
/** Save a built deck under its name (a deck of the same name is replaced); never throws. */
export function saveBuiltDeck(storage: Store | null, deck: BuiltDeck): BuiltDeck[] {
  const all = [...readBuiltDecks(storage).filter((d) => d.name !== deck.name), { ...deck, decklist: deck.decklist.filter((e) => e.count > 0).map((e) => ({ ...e })) }];
  try { storage?.setItem(BUILT_DECKS_KEY, JSON.stringify(all)); } catch { /* a full store: the deck is kept for this visit only */ }
  return all;
}
export function deleteBuiltDeck(storage: Store | null, name: string): BuiltDeck[] {
  const all = readBuiltDecks(storage).filter((d) => d.name !== name);
  try { storage?.setItem(BUILT_DECKS_KEY, JSON.stringify(all)); } catch { /* as above */ }
  return all;
}

const colours = (deck: Decklist, pool: Map<string, CardDef>) => { const seen = new Set<string>(); for (const e of deck) { const d = pool.get(e.cardId); if (d && !d.types.includes("Land")) for (const c of d.manaCost.match(/[WUBRG]/g) ?? []) seen.add(c); } return "WUBRG".split("").filter((c) => seen.has(c)).join("") || "colourless"; };
export const deckSummary = (deck: Decklist, pool: Map<string, CardDef>) => `${deck.reduce((n, e) => n + e.count, 0)} cards · ${colours(deck, pool)}`;

/** Every deck the setup offers, by category: the built decks, the Open's active lists, and the S37 roster (the
 * journey's saved decks, the mages, the beasts, the bosses met). The unlock rule (S37) holds for the Open's lists as
 * for the rest: a deck with a prize card the player has not met is not offered, unless `revealAll`. */
export function playChoices(pool: Map<string, CardDef>, opts: { revealAll?: boolean; storage?: Store | null } = {}): PlayChoice[] {
  const storage = opts.storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : opts.storage;
  const unlocked = readUnlocked(storage);
  const built: PlayChoice[] = readBuiltDecks(storage).map((d) => ({ key: `built:${d.name}`, group: "built", name: d.name, label: d.name, archetype: d.archetype, decklist: d.decklist, ...(d.sideboard?.length ? { sideboard: d.sideboard } : {}) }));
  // post-S60 (Chris: a match against one list, with the deck he registered): the Convocation's saved event, read and never written
  try {
    const e = deserializeEvent(storage?.getItem(EVENT_SAVE_KEY) ?? ""), deck = e?.decklists?.[e.formatId] ?? (e && e.field[0]?.sideboard?.length ? e.field[0]!.deck : undefined), side = e?.sideboards?.[e.formatId] ?? e?.field[0]?.sideboard;
    if (e && deck?.length && deck.every((x) => pool.has(x.cardId))) built.push({ key: "built:~convocation", group: "built", name: "Your Convocation deck", label: "Your Convocation deck (as registered)", archetype: "midrange", decklist: deck.map((x) => ({ ...x })), ...(side?.length ? { sideboard: side.map((x) => ({ ...x })) } : {}) });
  } catch { /* no event, or one this build cannot read */ }
  const open: PlayChoice[] = Object.values(OPEN_FIELD).filter((l) => opts.revealAll || deckUnlocked(l.decklist, pool, unlocked)).map((l) => ({ key: `open:${l.key}`, group: "open", name: l.name, label: `${l.name} — ${l.title}`, archetype: l.archetype, decklist: l.decklist.map((e) => ({ ...e })), ...(l.sideboard?.length ? { sideboard: l.sideboard.map((e) => ({ ...e })) } : {}) }));
  const rest: PlayChoice[] = playRoster(pool, { ...opts, storage }).map((d: LabDeck) => ({ key: d.key, group: d.group, name: d.name, label: d.label, archetype: d.archetype, decklist: d.decklist.map((e) => ({ ...e })), ...(d.portrait ? { portrait: d.portrait } : {}) }));
  return [...built, ...open, ...rest];
}

/** What a built deck may hold: every card legal in the Open at its copy cap there (the power at one), basics free. */
export function buildPool(pool: Map<string, CardDef>): Collection {
  const out: Collection = {};
  for (const d of pool.values()) if (!isBasic(d.id) && cardLegal(d, OPEN_FORMAT.rule)) out[d.id] = copyCap(d.id, OPEN_FORMAT.rule);
  return out;
}
/** A built deck's rule: the Open's limits on a card, forty cards or more (a campaign deck's size is welcome). */
export const BUILD_RULE = { ...OPEN_FORMAT.rule, minCards: 40, label: "a single match (the Open's card limits, forty cards or more)" };
