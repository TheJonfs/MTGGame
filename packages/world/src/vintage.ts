/**
 * S73 (ADR-199): a registered list's pool vintage, and the cards that came after it.
 *
 * `poolAt` on a list is the pool's size when the list was registered in its format; `portOf` ("<format>:<key>") names
 * the list it was ported from. A port was a mechanical swap, not a fresh read of the pool, so the audit reads a list
 * against the vintage of the ROOT of its `portOf` chain (`readAt`) — the last time anyone chose its cards.
 * `data/convocation/pool-history.json` holds the pool's size as each card landed.
 *
 * The delta is the mechanical first cut and nothing more: format-legal, castable in the list's colours, within its
 * curve. Which card a delta card would replace, and why by role, is read by hand (the brief's step 2).
 */
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { checkDeck, isBasic, type DeckRule } from "./legality.js";

export type Colour = "W" | "U" | "B" | "R" | "G";
export interface ListMeta { poolAt?: number | undefined; portOf?: string | undefined; archived?: boolean | undefined; source?: string | undefined; name?: string | undefined }
export interface PoolHistory { cards: Record<string, { added: string; pool: number }> }
type Deck = readonly { cardId: string; count: number }[];

/** The vintage a list is read against: its own `poolAt`, or its root's when it is a port. Throws on a broken chain. */
export function readAt(key: string, metas: Readonly<Record<string, ListMeta>>): { readAt: number; root: string; chain: string[] } {
  const chain = [key];
  for (let k = key; ; ) {
    const m = metas[k]; if (!m) throw new Error(`vintage: no list ${k} (the chain ${chain.join(" ← ")})`);
    if (m.poolAt === undefined) throw new Error(`vintage: ${k} has no poolAt (ADR-199)`);
    if (!m.portOf) return { readAt: m.poolAt, root: k, chain };
    if (chain.includes(m.portOf)) throw new Error(`vintage: the chain ${chain.join(" ← ")} loops at ${m.portOf}`);
    k = m.portOf; chain.push(k);
  }
}

/** A colour a list holds fewer than this many cards of is a splash for a restricted card (Emerald Snakes' Time Walk on
 * its Moxen), not a colour the list plays: no candidate is read against it. */
export const SPLASH_UNDER = 3;
/** The colours a list plays: those that at least SPLASH_UNDER of its nonland cards need (a plain pip, or a colourless-
 * cost card's own colour). A hybrid pip none of them pays counts for its first colour. */
export function listColours(deck: Deck, pool: ReadonlyMap<string, CardDef>): Colour[] {
  const need: Record<Colour, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }, hybridOnly: [Colour[], number][] = [];
  for (const e of deck) {
    const d = pool.get(e.cardId)!; if (d.types.includes("Land")) continue;
    const cost = parseManaCost(d.manaCost);
    for (const c of ["W", "U", "B", "R", "G"] as const) if (cost.colored[c] > 0 || (d.colors?.includes(c) && cost.hybrid.length === 0)) need[c] += e.count;
    for (const h of cost.hybrid) hybridOnly.push([h, e.count]);
  }
  const firm = new Set((["W", "U", "B", "R", "G"] as const).filter((c) => need[c] >= SPLASH_UNDER));
  for (const [h] of hybridOnly) if (!h.some((c) => firm.has(c))) firm.add(h[0]!);
  return (["W", "U", "B", "R", "G"] as const).filter((c) => firm.has(c));
}

/** Castable in those colours: every plain coloured pip is one of them, and every hybrid pip has a colour among them
 * (ADR-197: a hybrid card is a candidate for each of its colours). A colourless card always is. */
export function castableIn(def: CardDef, colours: readonly Colour[]): boolean {
  const cost = parseManaCost(def.manaCost);
  for (const c of ["W", "U", "B", "R", "G"] as const) if (cost.colored[c] > 0 && !colours.includes(c)) return false;
  for (const h of cost.hybrid) if (!h.some((c) => colours.includes(c))) return false;
  if (def.colors && cost.hybrid.length === 0 && !def.colors.every((c) => colours.includes(c))) return false;
  return true;
}

export const mv = (def: CardDef): number => manaValue(parseManaCost(def.manaCost));
/** The top of a list's curve: the largest mana value among its nonland cards. */
export const curveTop = (deck: Deck, pool: ReadonlyMap<string, CardDef>): number => Math.max(0, ...deck.map((e) => pool.get(e.cardId)!).filter((d) => !d.types.includes("Land")).map(mv));

export interface DeltaCard { id: string; pool: number; added: string; mv: number; land: boolean; inList: number }
/**
 * The cards added after `since` that the list could play: legal in the format beside the list (one copy added to the
 * sixty passes the format's rule), castable in the list's colours, at or under the top of its curve. A land is kept
 * whatever its colours (what a land makes is read by hand) and marked. A card the list already plays is kept with its
 * count — the audit shows what the list has adopted since — and is not a candidate.
 */
export function deltaFor(deck: Deck, since: number, rule: DeckRule, pool: ReadonlyMap<string, CardDef>, history: PoolHistory): DeltaCard[] {
  const colours = listColours(deck, pool), top = curveTop(deck, pool), out: DeltaCard[] = [];
  for (const [id, h] of Object.entries(history.cards)) {
    if (h.pool <= since) continue;
    const def = pool.get(id); if (!def || def.isTokenDef || isBasic(id)) continue;
    const inList = deck.find((e) => e.cardId === id)?.count ?? 0, land = def.types.includes("Land");
    if (!inList) {
      if (!checkDeck([...deck, { cardId: id, count: 1 }], null, rule, pool as Map<string, CardDef>).ok) continue;
      if (!land && (!castableIn(def, colours) || mv(def) > top)) continue;
    }
    out.push({ id, pool: h.pool, added: h.added, mv: mv(def), land, inList });
  }
  return out.sort((a, b) => Number(a.land) - Number(b.land) || a.mv - b.mv || a.id.localeCompare(b.id));
}

export const coloursOf = (def: CardDef): string => cardColors(def).join("") || "C";
