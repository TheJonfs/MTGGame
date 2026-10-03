/**
 * S48 (Part 2, ADR-145): the Limited builder — a forty-card deck from a pool by the card rating. No card is named:
 * the choice reads ratings, colours, mana values, types and what a land's abilities say.
 *
 *  1. THE PAIR: of the ten colour pairs, the one whose best 23 castable nonland cards (its colours and the
 *     colourless) rate highest in sum — a pair short of 23 playables or of 13 creatures pays for each missing.
 *  2. A SPLASH: a third colour only with two fixing sources in the pool (a land that fetches a basic, or a land
 *     that taps for the colour and one of the pair's), and only cards with a single pip of it; at most two, each
 *     rated a tier-3 card's prior or better and beating the card it replaces by a clear margin — a splash is for a bomb.
 *  3. THE CURVE: the best-rated 23 under a cap of three six-drops and nine four-and-five-drops, then mended — two-drops (mana value ≤ 2) to
 *     five, three-drops to four, creatures to thirteen — each mend the cheapest trade in rating available.
 *  4. THE LANDS: seventeen (sixteen, and a twenty-fourth spell, when the average mana value is 2.6 or less): the
 *     pool's lands that tap only within the deck's colours, then basics split by the spells' pips — each main colour
 *     at least six sources where the count allows, a splash colour one basic for the fetch lands to find.
 * Deterministic: ties break by card id; no randomness.
 */
import { WorldRng } from "./rng.js";
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Decklist } from "./state.js";
import { packColors, type PackColor } from "./packs.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { isBasic } from "./legality.js";

const COLORS: readonly PackColor[] = ["W", "U", "B", "R", "G"];
const BASIC_OF: Record<PackColor, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
export const LIMITED_TARGETS = { deck: 40, lands: 17, landsLow: 16, lowCurve: 2.6, twoDrops: 5, threeDrops: 4, sixPlusCap: 3, fourFiveCap: 9, creatures: 13, tribeForCost: 5, splashMax: 2, splashMargin: 0.75, splashFloor: 2.0, fixersForSplash: 2 } as const;

export interface LimitedBuild {
  deck: Decklist;
  /** The pool's cards left out (basics excluded) — the sideboard. */
  sideboard: Decklist;
  colors: PackColor[];
  splash: PackColor | null;
  spells: number;
  lands: number;
  creatures: number;
  curve: number[]; // nonland cards by mana value 0…6, the last bucket 7+
  avgMv: number;
  rating: number; // the mean rating of the nonland cards played
}

const fetchesBasic = (d: CardDef) => JSON.stringify(d.abilities ?? []).includes('"basicLand"');

export interface LimitedBuildOptions {
  /** S49 (the colour question): build in this pair whatever the pool prefers. */
  forcePair?: [PackColor, PackColor];
  /** S49 (rating noise): added to a card's rating for this build — under-rated cards get played. */
  noise?: (cardId: string) => number;
  /** S53 (ADR-154): the Sealed field varies its pair — a seeded choice over the top `top` pairs, weighted by score
   * (the Constructed select's rule), not the argmax; so a field is a field. Unset: the best pair (the player's
   * suggestion, the drafter's seats). */
  pairChoice?: { seed: number; top: number };
}
/** The ten pairs' scores for a pool (the builder's step 1), best first — the forced-pair experiment's "at least third". */
export function pairScores(poolIds: readonly string[], rating: CardRatingTable, cards: Map<string, CardDef>): { pair: [PackColor, PackColor]; score: number }[] {
  const spells = poolIds.filter((id) => !isBasic(id) && !cards.get(id)!.types.includes("Land"));
  const out: { pair: [PackColor, PackColor]; score: number }[] = [];
  for (let i = 0; i < COLORS.length; i++) for (let j = i + 1; j < COLORS.length; j++) {
    const pair: [PackColor, PackColor] = [COLORS[i]!, COLORS[j]!];
    const top = spells.filter((id) => cardColors(cards.get(id)!).every((c) => pair.includes(c))).sort((a, b) => cardRating(cards.get(b)!, rating) - cardRating(cards.get(a)!, rating) || a.localeCompare(b)).slice(0, 23);
    out.push({ pair, score: top.reduce((n, id) => n + cardRating(cards.get(id)!, rating), 0) - (23 - top.length) * 1.0 - Math.max(0, LIMITED_TARGETS.creatures - top.filter((id) => cards.get(id)!.types.includes("Creature")).length) * 0.3 });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function buildLimitedDeck(poolIds: readonly string[], rating: CardRatingTable, cards: Map<string, CardDef>, opts: LimitedBuildOptions = {}): LimitedBuild {
  const def = (id: string) => { const d = cards.get(id); if (!d) throw new Error(`buildLimitedDeck: ${id} is not in the card pool`); return d; };
  const ids = poolIds.filter((id) => !isBasic(id));
  const mv = (id: string) => manaValue(parseManaCost(def(id).manaCost));
  const noise = new Map<string, number>();
  const rate = (id: string) => { if (!opts.noise) return cardRating(def(id), rating); if (!noise.has(id)) noise.set(id, opts.noise(id)); return cardRating(def(id), rating) + noise.get(id)!; };
  const isLand = (id: string) => def(id).types.includes("Land");
  const isCreature = (id: string) => def(id).types.includes("Creature");
  const pips = (id: string, c: PackColor) => parseManaCost(def(id).manaCost).colored[c];
  const byRating = (a: string, b: string) => rate(b) - rate(a) || a.localeCompare(b);
  const spells = ids.filter((id) => !isLand(id)), lands = ids.filter(isLand);
  const within = (id: string, cs: readonly PackColor[]) => cardColors(def(id)).every((c) => cs.includes(c));

  // 1. the pair
  const scored: { pair: [PackColor, PackColor]; score: number }[] = [];
  for (let i = 0; i < COLORS.length; i++) for (let j = i + 1; j < COLORS.length; j++) {
    const pair: [PackColor, PackColor] = [COLORS[i]!, COLORS[j]!];
    const top = spells.filter((id) => within(id, pair)).sort(byRating).slice(0, 23);
    scored.push({ pair, score: top.reduce((n, id) => n + rate(id), 0) - (23 - top.length) * 1.0 - Math.max(0, LIMITED_TARGETS.creatures - top.filter(isCreature).length) * 0.3 });
  }
  scored.sort((a, b) => b.score - a.score || COLORS.indexOf(a.pair[0]) - COLORS.indexOf(b.pair[0]) || COLORS.indexOf(a.pair[1]) - COLORS.indexOf(b.pair[1]));
  const chosen = (() => {
    if (!opts.pairChoice) return scored[0]!;
    const top = scored.slice(0, Math.max(1, opts.pairChoice.top)), w = top.map((x) => Math.max(1e-6, x.score)), total = w.reduce((a, b) => a + b, 0);
    let roll = new WorldRng(opts.pairChoice.seed).float() * total;
    for (let k = 0; k < top.length; k++) { if (roll < w[k]!) return top[k]!; roll -= w[k]!; }
    return top[top.length - 1]!;
  })();
  const pair = opts.forcePair ?? chosen.pair;
  let candidates = spells.filter((id) => within(id, pair)).sort(byRating);

  // 3a. the best 23 under the six-drop cap
  const take = (n: number, from: string[]): string[] => {
    const out: string[] = []; let six = 0, mid = 0;
    for (const id of from) {
      if (out.length >= n) break;
      if (mv(id) >= 6) { if (six >= LIMITED_TARGETS.sixPlusCap) continue; six += 1; }
      else if (mv(id) >= 4) { if (mid >= LIMITED_TARGETS.fourFiveCap) continue; mid += 1; } // S49: the four- and five-drops together
      out.push(id);
    }
    return out;
  };
  // Post-S49 (the burn probe: Goblin Grenade sat in hand in 54% of the games it was drawn — no Goblin to sacrifice):
  // a card whose ADDITIONAL COST sacrifices a creature of a subtype is a playable only in a deck that holds that
  // subtype — five creature cards of it among the cards PLAYED, or the card is left out. Keyed on the cost's shape.
  const needs = (id: string) => /^creature\.subtype:(.+)$/.exec(((def(id) as { additionalCost?: { sacrifice?: { predicate?: string } } }).additionalCost?.sacrifice?.predicate) ?? "")?.[1];
  let picked = take(23, candidates);
  for (let guard = 0; guard < 4; guard++) {
    const tribe = (sub: string) => picked.filter((id) => isCreature(id) && (def(id).subtypes ?? []).includes(sub)).length;
    const stranded = new Set(picked.filter((id) => { const sub = needs(id); return !!sub && tribe(sub) < LIMITED_TARGETS.tribeForCost; }));
    if (!stranded.size) break;
    candidates = candidates.filter((id) => !stranded.has(id));
    picked = take(23, candidates);
  }

  // 2. a splash
  let splash: PackColor | null = null;
  let bestSplash: { c: PackColor; adds: string[]; gain: number } | null = null;
  for (const c of COLORS) {
    if (pair.includes(c)) continue;
    const fixers = lands.filter((id) => fetchesBasic(def(id)) || (packColors(def(id)).includes(c) && packColors(def(id)).some((x) => pair.includes(x)))).length;
    if (fixers < LIMITED_TARGETS.fixersForSplash) continue;
    const floor = picked.length >= 23 ? [...picked].sort(byRating).slice(-LIMITED_TARGETS.splashMax).map(rate) : [0, 0];
    const adds = spells.filter((id) => !within(id, pair) && within(id, [...pair, c]) && pips(id, c) === 1 && mv(id) < 6).sort(byRating).slice(0, LIMITED_TARGETS.splashMax)
      .filter((id, k) => rate(id) >= LIMITED_TARGETS.splashFloor && rate(id) >= (floor[floor.length - 1 - k] ?? 0) + LIMITED_TARGETS.splashMargin);
    const gain = adds.reduce((n, id, k) => n + rate(id) - (floor[floor.length - 1 - k] ?? 0), 0);
    if (adds.length && (!bestSplash || gain > bestSplash.gain + 1e-9)) bestSplash = { c, adds, gain };
  }
  if (bestSplash) {
    splash = bestSplash.c;
    picked = [...[...picked].sort(byRating).slice(0, Math.max(0, 23 - bestSplash.adds.length)), ...bestSplash.adds];
    candidates = [...candidates, ...bestSplash.adds];
  }

  // 3b. mend the curve: bring a wanted kind up to its count by the cheapest trade in rating
  const mend = (want: (id: string) => boolean, count: number, keep: ((id: string) => boolean)[]) => {
    for (;;) {
      if (picked.filter(want).length >= count) return;
      const used = new Map<string, number>(); for (const id of picked) used.set(id, (used.get(id) ?? 0) + 1);
      const spare: string[] = []; const seen = new Map<string, number>();
      for (const id of candidates) { const k = (seen.get(id) ?? 0) + 1; seen.set(id, k); if (k > (used.get(id) ?? 0)) spare.push(id); }
      const add = spare.filter(want).sort(byRating)[0];
      // never drop a card of the wanted kind, a splash card, or one a satisfied earlier target still needs
      const droppable = picked.filter((id) => !want(id) && !(splash && pips(id, splash) > 0) && keep.every((k) => !k(id) || picked.filter(k).length > (k === keep[0] ? LIMITED_TARGETS.twoDrops : k === keep[1] ? LIMITED_TARGETS.threeDrops : LIMITED_TARGETS.creatures)));
      const drop = droppable.sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
      if (!add || !drop) return;
      picked.splice(picked.indexOf(drop), 1); picked.push(add);
    }
  };
  const two = (id: string) => mv(id) <= 2, three = (id: string) => mv(id) === 3;
  mend(two, LIMITED_TARGETS.twoDrops, []);
  mend(three, LIMITED_TARGETS.threeDrops, [two]);
  mend(isCreature, LIMITED_TARGETS.creatures, [two, three]);

  // 4. the lands
  const avg = (xs: string[]) => (xs.length ? xs.reduce((n, id) => n + mv(id), 0) / xs.length : 0);
  let landCount: number = LIMITED_TARGETS.lands;
  if (picked.length >= 23 && avg(picked) <= LIMITED_TARGETS.lowCurve) {
    const used = new Map<string, number>(); for (const id of picked) used.set(id, (used.get(id) ?? 0) + 1);
    const seen = new Map<string, number>();
    const extra = candidates.find((id) => { const k = (seen.get(id) ?? 0) + 1; seen.set(id, k); return k > (used.get(id) ?? 0) && mv(id) < 6; });
    if (extra) { picked.push(extra); landCount = LIMITED_TARGETS.landsLow; }
  }
  landCount = LIMITED_TARGETS.deck - picked.length; // a pool short of playables fills with lands (the deck is always forty)
  const deckColors: PackColor[] = splash ? [...pair, splash] : [...pair];
  const usable = lands.filter((id) => { const cs = packColors(def(id)); return fetchesBasic(def(id)) ? !!splash : cs.length >= 2 && cs.every((c) => deckColors.includes(c)); }).sort(byRating);
  const playedLands = usable.slice(0, Math.min(usable.length, 4));
  const basics = landCount - playedLands.length;
  const need: Record<string, number> = {};
  for (const c of deckColors) need[c] = picked.reduce((n, id) => n + pips(id, c), 0);
  const split: Record<string, number> = {};
  const mains = pair.filter((c) => need[c]! > 0), totalMain = mains.reduce((n, c) => n + need[c]!, 0) || 1;
  const forSplash = splash ? 1 : 0;
  let left = basics - forSplash;
  if (splash) split[splash] = 1;
  mains.forEach((c, i) => { const share = i === mains.length - 1 ? left : Math.min(left, Math.max(Math.min(6, Math.floor((basics - forSplash) / 2)), Math.round(((basics - forSplash) * need[c]!) / totalMain))); split[c] = share; left -= share; });
  if (!mains.length) split[pair[0]] = (split[pair[0]] ?? 0) + left;

  const deck: Decklist = [];
  const add = (id: string, n = 1) => { if (n <= 0) return; const e = deck.find((x) => x.cardId === id); if (e) e.count += n; else deck.push({ cardId: id, count: n }); };
  for (const id of [...picked].sort((a, b) => mv(a) - mv(b) || a.localeCompare(b))) add(id);
  for (const id of playedLands) add(id);
  for (const c of COLORS) if (split[c]) add(BASIC_OF[c], split[c]!);
  const sideboard: Decklist = [];
  const inDeck = new Map(deck.map((e) => [e.cardId, e.count]));
  for (const id of [...ids].sort()) { const k = inDeck.get(id) ?? 0; if (k > 0) inDeck.set(id, k - 1); else { const e = sideboard.find((x) => x.cardId === id); if (e) e.count += 1; else sideboard.push({ cardId: id, count: 1 }); } }
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const id of picked) curve[Math.min(7, mv(id))]! += 1;
  return { deck, sideboard, colors: [...pair], splash, spells: picked.length, lands: landCount, creatures: picked.filter(isCreature).length, curve, avgMv: avg(picked), rating: picked.reduce((n, id) => n + rate(id), 0) / Math.max(1, picked.length) };
}
