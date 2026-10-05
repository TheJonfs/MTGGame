/**
 * S52 (Part 1, ADR-145/152): the Constructed builder — SELECT an authored list that fits the format, REPAIR it to the
 * format's rule, add a little seeded NOISE so five seats on one archetype are five variations. No card is named: the
 * builder reads the rule, the rating, colours, types and mana values.
 *
 *  SELECT  every library list scored by cards legal ÷ cards (a copy the rule forbids — banned, off-tier, off-colour,
 *          a banned type, above the curve ceiling, under the stat floor, a restricted card's extra copies — is not
 *          legal); ties by the list's measured strength (the Open's round-robin mean where known, else the mean
 *          rating of its nonland cards); the top five; a seeded pick weighted by score.
 *  REPAIR  cut the forbidden copies; fill to the format's minimum inside the list's colours, role for role (a land
 *          for a land — basics by the list's pips; a creature for a creature; a spell for a spell) — copies of what
 *          the list already plays first, then the best-rated cards the format allows; then the floors (creatures,
 *          the land fraction) by swapping the lowest-rated cards of the other role.
 *  NOISE   by the seat's tinker level (stock: none; light: one or two; heavy: four to six) same-role swaps to a card rated within 0.5 of the one it replaces (never a free card — the
 *          Lotus and the Moxen neither leave nor arrive by noise), and a land ±1 (a land for
 *          the lowest spell, or the reverse). A swap that breaks the rule is not made.
 * Deterministic for a seed.
 */
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Decklist } from "./state.js";
import { BASIC_LANDS, COPY_CAP, checkDeck, isBasic, type DeckCheck, type DeckRule } from "./legality.js";
import type { ConstructedFormat } from "./formats.js";
import { LAW_IDS } from "./formats.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { WorldRng } from "./rng.js";

export interface LibraryList { key: string; archetype: "aggro" | "midrange" | "control"; decklist: Decklist }
/** The Open's round-robin means — a list's measured strength. Post-S53: re-measured on pilot 97 with the two lists contributed from play (the Sweep, the Depths): 9,100 games, analysis/runs/open_rr14.json. Post-S54: the Hearth (Chris's 18–1 Mardu list) measured alone against the fourteen on pilot 99 — 63.6% over 1,400 games; the others' means are not re-run with it. (S46's were levy 68, wurmspeaker 61, warband 60, coin 59, muster 57, loop 55, ford 53, enchantress 51, tally 39, locks 39, undertow 38, larder 31.) */
export const OPEN_MEANS: Record<string, number> = { "open:levy": 65, "open:hearth": 64, "open:wurmspeaker": 62, "open:coin": 59, "open:sweep": 59, "open:depths": 57, "open:muster": 53, "open:warband": 53, "open:loop": 53, "open:ford": 51, "open:enchantress": 50, "open:tally": 37, "open:undertow": 35, "open:locks": 35, "open:larder": 28 };
/** Post-S52 (Chris): the candidates are the TWELVE best-fitting lists (the Open's whole library, not its top five),
 * and the noise has a noise of its own — a seat is STOCK (the list as written), a LIGHT tinkerer (one or two swaps),
 * or a HEAVY one (four to six); the light and the heavy also move a land. The shares are a quarter, a half, a quarter. */
export const CONSTRUCTED_TERMS = { candidates: 12, noiseBand: 0.5, inListBonus: 0.3, tinker: { stock: { share: 0.25, swaps: [0, 0] }, light: { share: 0.5, swaps: [1, 2] }, heavy: { share: 0.25, swaps: [4, 6] } } } as const;
export type Tinker = keyof typeof CONSTRUCTED_TERMS.tinker;
/** Post-S53 (Chris: lists contributed from play grow the metagame): the candidates are at least the twelve, and every
 * list with a measured Open strength — a contributed list enters the field once `pnpm open:rr` has measured it. */
export const candidateCount = (): number => Math.max(CONSTRUCTED_TERMS.candidates, Object.keys(OPEN_MEANS).length);
/** Post-S52 (Chris: "the Larder and the Undertow repair badly" — the noise was blind to a list's plan). The PLAN rules,
 * keyed on data, never on a card's name: (1) a swap's incoming card must share an authored list with the card it
 * replaces (the library's lists are the record of what goes together); (2) a card the source list plays four of is its
 * plan — never swapped out, never the land move's cut; (3) the land-down move adds a copy of a card the deck already
 * plays, not the best-rated creature in the colours. `plan: 0` is the S52 noise. */
export const VARIATION_TERMS = { plan: 0 };
/** The A/B's hook (`pnpm rating-ab --variation`) — never called by the game. */
export function tuneVariation(over: Partial<typeof VARIATION_TERMS>): void { Object.assign(VARIATION_TERMS, over); }

type Role = "land" | "creature" | "spell";
const BASIC_OF: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
export interface ConstructedBuild { deck: Decklist; from: string; /** How far the seat moved from its list. */ tinker: Tinker; archetype: LibraryList["archetype"]; legalShare: number; cut: Decklist; added: Decklist; swaps: { out: string; in: string }[]; check: DeckCheck }

/** May one copy of this card be in a deck of this format at all? (The per-card half of the rule.) */
export function cardLegal(d: CardDef, rule: DeckRule): boolean {
  if (d.isTokenDef || (LAW_IDS as readonly string[]).includes(d.id)) return false;
  if (isBasic(d.id)) return !(rule.banned ?? []).includes(d.id) && !(rule.bannedTypes ?? []).includes("Land");
  if ((rule.banned ?? []).includes(d.id)) return false;
  if (rule.maxTier !== undefined && !(typeof d.shopTier === "number" && d.shopTier <= rule.maxTier)) return false;
  if (rule.colorsWithin && cardColors(d).some((c) => !rule.colorsWithin!.includes(c))) return false;
  if (rule.bannedTypes && rule.bannedTypes.some((t) => d.types.includes(t))) return false;
  if (rule.maxManaValue !== undefined && !d.types.includes("Land") && manaValue(parseManaCost(d.manaCost)) > rule.maxManaValue) return false;
  if (rule.minCreaturePower !== undefined && d.types.includes("Creature") && (d.power ?? 0) < rule.minCreaturePower) return false;
  return true;
}
/** The most copies of a card the format allows (basics uncapped). */
export const copyCap = (id: string, rule: DeckRule): number => (isBasic(id) ? Infinity : (rule.restricted ?? []).includes(id) || rule.singleton ? 1 : COPY_CAP);

/** A list's legal share in a format: the copies the rule lets stand ÷ all its copies. */
export function legalShare(list: Decklist, rule: DeckRule, cards: Map<string, CardDef>): number {
  let ok = 0, all = 0;
  for (const e of list) { const d = cards.get(e.cardId); all += e.count; if (d && cardLegal(d, rule)) ok += Math.min(e.count, copyCap(e.cardId, rule)); }
  return all ? ok / all : 0;
}

/** The select step's candidates: every library list by legal share, ties by measured strength (the Open's
 * round-robin mean where known, else its nonland cards' mean rating); the top twelve. S53: also the player's
 * "start from a list" picker. */
export function selectCandidates(format: ConstructedFormat, rating: CardRatingTable, library: readonly LibraryList[], cards: Map<string, CardDef>): { l: LibraryList; share: number; strength: number }[] {
  const rule = format.rule, role = (id: string) => (cards.get(id)!.types.includes("Land") ? "land" : "other");
  const size = (l: Decklist) => l.reduce((n, e) => n + e.count, 0);
  const strength = (l: LibraryList) => OPEN_MEANS[l.key] !== undefined ? 1000 + OPEN_MEANS[l.key]! : (() => { const xs = l.decklist.filter((e) => role(e.cardId) !== "land"); const n = size(xs); return n ? xs.reduce((a, e) => a + cardRating(cards.get(e.cardId)!, rating) * e.count, 0) / n : 0; })();
  return library.map((l) => ({ l, share: legalShare(l.decklist, rule, cards), strength: strength(l) })).sort((a, b) => b.share - a.share || b.strength - a.strength || a.l.key.localeCompare(b.l.key)).slice(0, candidateCount());
}

export function buildConstructedDeck(format: ConstructedFormat, rating: CardRatingTable, seed: number, library: readonly LibraryList[], cards: Map<string, CardDef>, opts: { /** Force the tinker level (the tinker study); default: rolled from the seed. */ tinker?: Tinker; /** Force the source list. */ from?: string } = {}): ConstructedBuild {
  const rule = format.rule, rng = new WorldRng(seed);
  const def = (id: string) => { const d = cards.get(id); if (!d) throw new Error(`buildConstructedDeck: ${id} is not in the card pool`); return d; };
  const rate = (id: string) => cardRating(def(id), rating);
  const role = (id: string): Role => (def(id).types.includes("Land") ? "land" : def(id).types.includes("Creature") ? "creature" : "spell");
  const size = (l: Decklist) => l.reduce((n, e) => n + e.count, 0);

  // ---- select ----
  const scored = selectCandidates(format, rating, library, cards);
  const total = scored.reduce((n, s) => n + s.share, 0);
  let roll = rng.float() * (total || 1), chosen = scored[0]!;
  for (const s of scored) { if (roll < s.share) { chosen = s; break; } roll -= s.share; }
  if (opts.from) { const forced = library.find((l) => l.key === opts.from); if (!forced) throw new Error(`buildConstructedDeck: no list ${opts.from}`); chosen = { l: forced, share: legalShare(forced.decklist, rule, cards), strength: 0 }; }
  const source = chosen.l;
  const tRoll = rng.float();
  const tinker: Tinker = opts.tinker ?? (tRoll < CONSTRUCTED_TERMS.tinker.stock.share ? "stock" : tRoll < CONSTRUCTED_TERMS.tinker.stock.share + CONSTRUCTED_TERMS.tinker.light.share ? "light" : "heavy");

  // ---- repair ----
  const deck = new Map<string, number>(), cut: Decklist = [], added = new Map<string, number>();
  for (const e of source.decklist) {
    const keep = cardLegal(def(e.cardId), rule) ? Math.min(e.count, copyCap(e.cardId, rule)) : 0;
    if (keep > 0) deck.set(e.cardId, keep);
    if (keep < e.count) cut.push({ cardId: e.cardId, count: e.count - keep });
  }
  const colours = [...new Set(source.decklist.filter((e) => role(e.cardId) !== "land").flatMap((e) => cardColors(def(e.cardId))))];
  const inColours = (id: string) => cardColors(def(id)).every((c) => colours.includes(c));
  const count = (r: Role) => [...deck].reduce((n, [id, k]) => n + (role(id) === r ? k : 0), 0);
  const deckSize = () => [...deck.values()].reduce((a, b) => a + b, 0);
  const add = (id: string) => { deck.set(id, (deck.get(id) ?? 0) + 1); added.set(id, (added.get(id) ?? 0) + 1); };
  const remove = (id: string) => { const k = deck.get(id)! - 1; if (k <= 0) deck.delete(id); else deck.set(id, k); if (added.get(id)) { const a = added.get(id)! - 1; if (a <= 0) added.delete(id); else added.set(id, a); } else { const c = cut.find((x) => x.cardId === id); if (c) c.count += 1; else cut.push({ cardId: id, count: 1 }); } };
  const inSource = new Set(source.decklist.map((e) => e.cardId));
  const poolOf = (r: Exclude<Role, "land">) => [...cards.values()].filter((d) => !isBasic(d.id) && !d.types.includes("Land") && role(d.id) === r && cardLegal(d, rule) && inColours(d.id)).map((d) => d.id)
    .sort((a, b) => (rate(b) + (inSource.has(b) ? CONSTRUCTED_TERMS.inListBonus : 0)) - (rate(a) + (inSource.has(a) ? CONSTRUCTED_TERMS.inListBonus : 0)) || a.localeCompare(b));
  const best = (r: Exclude<Role, "land">) => poolOf(r).find((id) => (deck.get(id) ?? 0) < copyCap(id, rule));
  const basic = () => { // the basic the deck's pips want most, against what it already has
    const pips: Record<string, number> = {}; for (const [id, k] of deck) { if (role(id) === "land") continue; const c = parseManaCost(def(id).manaCost).colored; for (const col of colours) pips[col] = (pips[col] ?? 0) + c[col] * k; }
    const have = (col: string) => [...deck].reduce((n, [id, k]) => n + (id === BASIC_OF[col] ? k : 0), 0);
    const cs = colours.length ? colours : ["W" as const]; const totalPips = cs.reduce((n, c) => n + (pips[c] ?? 0), 0) || 1; const lands = count("land") + 1;
    return BASIC_OF[[...cs].sort((a, b) => ((pips[b] ?? 0) / totalPips - have(b) / lands) - ((pips[a] ?? 0) / totalPips - have(a) / lands) || a.localeCompare(b))[0]!]!;
  };
  // the source's own shape is the target: lands, creatures and spells in its proportions, at the format's size
  const min = Math.max(rule.minCards ?? 0, 30), srcSize = size(source.decklist) || 1;
  const want = (r: Role) => Math.round((source.decklist.reduce((n, e) => n + (role(e.cardId) === r ? e.count : 0), 0) / srcSize) * Math.max(min, deckSize()));
  const target = { land: want("land"), creature: want("creature"), spell: 0 }; target.spell = Math.max(min, deckSize()) - target.land - target.creature;
  for (let guard = 0; deckSize() < min && guard < 400; guard++) {
    const short = (["land", "creature", "spell"] as Role[]).map((r) => [r, target[r] - count(r)] as const).sort((a, b) => b[1] - a[1])[0]![0];
    const id = short === "land" ? basic() : best(short) ?? best(short === "creature" ? "spell" : "creature") ?? basic();
    add(id);
  }
  // the floors
  const lowest = (r: Role, keep: (id: string) => boolean = () => true) => [...deck.keys()].filter((id) => role(id) === r && keep(id)).sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
  for (let guard = 0; rule.minCreatures !== undefined && count("creature") < rule.minCreatures && guard < 200; guard++) { const out = lowest("spell"), into = best("creature"); if (!out || !into) break; remove(out); add(into); }
  for (let guard = 0; rule.minLandFraction !== undefined && count("land") < rule.minLandFraction * deckSize() - 1e-9 && guard < 200; guard++) { const out = lowest("spell") ?? lowest("creature"); if (!out) break; remove(out); add(basic()); }
  for (let guard = 0; rule.maxLands !== undefined && count("land") > rule.maxLands && guard < 200; guard++) { const out = [...deck.keys()].filter((id) => role(id) === "land").sort((a, b) => Number(isBasic(b)) - Number(isBasic(a)) || a.localeCompare(b))[0]; const into = best("creature") ?? best("spell"); if (!out || !into) break; remove(out); add(into); }

  // ---- noise ----
  const plan = VARIATION_TERMS.plan > 0;
  const srcCount = (id: string) => source.decklist.reduce((n, e) => n + (e.cardId === id ? e.count : 0), 0);
  const core = (id: string) => plan && srcCount(id) >= 4; // rule 2
  const together = (() => { // rule 1: the nonland cards each library list plays
    if (!plan) return null;
    const m = new Map<string, Set<number>>();
    library.forEach((l, i) => { for (const e of l.decklist) if (role(e.cardId) !== "land") { const x = m.get(e.cardId) ?? new Set<number>(); x.add(i); m.set(e.cardId, x); } });
    return (a: string, b: string) => { const x = m.get(a), y = m.get(b); if (!x || !y) return false; for (const i of x) if (y.has(i)) return true; return false; };
  })();
  const list = (): Decklist => [...deck].map(([cardId, n]) => ({ cardId, count: n }));
  const legalNow = () => checkDeck(list(), null, rule, cards).ok;
  const swaps: { out: string; in: string }[] = [];
  const [lo, hi] = CONSTRUCTED_TERMS.tinker[tinker].swaps;
  const nSwaps = lo + rng.int(hi - lo + 1);
  for (let i = 0; i < nSwaps; i++) {
    // a swap never touches a free card (mana value 0 — the Lotus, a Mox): the first round-robin swapped Power out for a
    // two-drop and an off-colour Mox in, on rating alone
    const free = (id: string) => manaValue(parseManaCost(def(id).manaCost)) === 0;
    const outs = [...deck.keys()].filter((id) => role(id) !== "land" && !free(id) && !core(id)).sort();
    if (!outs.length) break;
    const out = outs[rng.int(outs.length)]!, r = role(out) as Exclude<Role, "land">;
    const ins = poolOf(r).filter((id) => id !== out && !free(id) && (deck.get(id) ?? 0) < copyCap(id, rule) && Math.abs(rate(id) - rate(out)) <= CONSTRUCTED_TERMS.noiseBand && (!together || together(out, id)));
    if (!ins.length) continue;
    const into = ins[rng.int(ins.length)]!;
    const before = new Map(deck);
    deck.set(out, deck.get(out)! - 1); if (deck.get(out) === 0) deck.delete(out); deck.set(into, (deck.get(into) ?? 0) + 1);
    if (legalNow()) swaps.push({ out, in: into }); else { deck.clear(); for (const [k, v] of before) deck.set(k, v); }
  }
  if (tinker !== "stock") { // a land ±1
    const before = new Map(deck), up = rng.int(2) === 0;
    if (up) { const out = lowest("spell", (id) => !core(id)) ?? lowest("creature", (id) => !core(id)); if (out) { deck.set(out, deck.get(out)! - 1); if (deck.get(out) === 0) deck.delete(out); const b = basic(); deck.set(b, (deck.get(b) ?? 0) + 1); swaps.push({ out, in: b }); } }
    else { const b = BASIC_LANDS.map((x) => x as string).filter((x) => (deck.get(x) ?? 0) > 0).sort((x, y) => deck.get(y)! - deck.get(x)! || x.localeCompare(y))[0]; const again = plan ? [...deck.keys()].filter((id) => role(id) !== "land" && manaValue(parseManaCost(def(id).manaCost)) > 0 && deck.get(id)! < copyCap(id, rule)).sort((x, y) => rate(y) - rate(x) || x.localeCompare(y))[0] : undefined; // rule 3
      const into = again ?? best("creature") ?? best("spell"); if (b && into) { deck.set(b, deck.get(b)! - 1); if (deck.get(b) === 0) deck.delete(b); deck.set(into, (deck.get(into) ?? 0) + 1); swaps.push({ out: b, in: into }); } }
    if (!legalNow()) { deck.clear(); for (const [k, v] of before) deck.set(k, v); swaps.pop(); }
  }
  const order = (a: string, b: string) => ["land", "creature", "spell"].indexOf(role(a)) - ["land", "creature", "spell"].indexOf(role(b)) || a.localeCompare(b);
  const final: Decklist = [...deck.keys()].sort(order).map((cardId) => ({ cardId, count: deck.get(cardId)! }));
  return { deck: final, from: source.key, tinker, archetype: source.archetype, legalShare: chosen.share, cut: cut.filter((c) => c.count > 0), added: [...added].map(([cardId, n]) => ({ cardId, count: n })), swaps, check: checkDeck(final, null, rule, cards) };
}
