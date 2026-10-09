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
import { answersGraveyards, blocksFliers, isCreatureCounter, isSweeper, isWall, stealsCreatures, usableByAnyDeck } from "./sideboard-ai.js";

export interface LibraryList { key: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: Decklist; /** S55: a contributed list's registered fifteen */ sideboard?: Decklist; /** S56 (ADR-164): archived — never a candidate */ archived?: true }
/** The Open's round-robin means — a list's measured strength. Post-S58 (Chris, 2026-10-08) — THE TABLE OF RECORD: the Cinder archived and the Rabble (the goblin build of mono-red) in its place; sixteen lists, pilot 113, 12,000 games, analysis/runs/rr16_s58d.json. Before it (rr16_s58c.json): pall 71, hearth 55, coin 54, muster 54, warband 52, kiln 52, levy 51, writ 50, sweep 48, wurmspeaker 47, depths 47, tally 46, cinder 44, locks 43, ford 42, enchantress 42. Earlier — pilot 113 (books 112–113, from Chris's recorded Cinder: an aggro deck holds its face burn; no life paid for cards within burn's reach): sixteen lists, 12,000 games. Before those two books (pilot 111, rr16_s58b.json; the Undertow archived and the Writ, his 5–0 Dimir Control list, in its place): pall 70, hearth 56, coin 54, levy 53, kiln 53, muster 52, writ 52, warband 50, sweep 50, wurmspeaker 48, depths 47, ford 44, enchantress 44, tally 43, locks 43, cinder 39. S58 (rr16_s58.json): the three swaps adopted under ADR-168 in (the Tally, the Enchantress, the Pall), sixteen lists, pilot 111, registered sixties, 12,000 games, analysis/runs/rr16_s58.json; the history of every table is in docs/decision-updates. Post-S57 (Chris, 2026-10-07): the Larder archived, the Undertow revised again (Nighthawks, two Macabres), the Cinder (his 8–0 mono-red list) in: sixteen lists, pilot 111, 12,000 games, analysis/runs/rr16_s57b.json. (The S57 table it replaces: pall 69, levy 58, hearth 58, coin 56, kiln 54, muster 53, warband 52, sweep 52, depths 52, wurmspeaker 47, tally 46, ford 46, locks 45, enchantress 45, undertow 36, larder 31.) S57, after the revision round: the sixteen with six lists revised (the Locks, the Undertow, the Tally, the Muster, the Ford, the Warband) and the Larder piloted by its plan, pilot 110, registered sixties: 12,000 games, analysis/runs/rr16_s57.json. (S56's, before the revision: pall 71, levy 62, hearth 62, coin 58, sweep 56, depths 56, kiln 55, warband 52, wurmspeaker 50, muster 47, enchantress 47, ford 45, tally 38, locks 36, undertow 35, larder 29.) S56: the sixteen active lists (the Loop archived, ADR-164) measured together on pilot 108 (the counter rule), registered sixties: 12,000 games, analysis/runs/rr16_s56.json. (The patchwork it replaces — pilot 106's sixteen with the Loop, the Kiln measured alone: pall 72, levy 62, hearth 62, coin 59, kiln 58, sweep 56, wurmspeaker 54, muster 53, loop 53, warband 51, depths 51, ford 48, enchantress 46, tally 38, undertow 34, locks 32, larder 28.) Earlier: Post-S53: re-measured on pilot 97 with the two lists contributed from play (the Sweep, the Depths): 9,100 games, analysis/runs/open_rr14.json. Post-S55: the Kiln (Chris's 5–0 Izzet list, tuned 2026-10-06: +4 Control Magic +3 Flametongue Kavu) measured alone against the sixteen on pilot 107 — 57.7% over 1,600 games (46.8% as Chris played it); the others are not re-run with it. S55: all sixteen re-measured on pilot 106 with the Pall (Chris's 5–0 combo list, piloted by its plan; every seat reads it): 12,000 games, analysis/runs/rr16.json — registered sixties. (Pilot 99's fifteen: levy 64, hearth 64, sweep 60, coin 59, wurmspeaker 59, depths 57, warband 55, muster 52, loop 51, ford 51, enchantress 45, tally 37, undertow 36, locks 35, larder 27.) Post-S54: all fifteen re-measured on pilot 99 with the Hearth (Chris's 18–1 Mardu list): 10,500 games, analysis/runs/rr15_plain.json — the registered sixties, no sideboarding. (Pilot 97's fourteen were levy 65, wurmspeaker 62, coin 59, sweep 59, depths 57, muster 53, warband 53, loop 53, ford 51, enchantress 50, tally 37, undertow 35, locks 35, larder 28.) (S46's were levy 68, wurmspeaker 61, warband 60, coin 59, muster 57, loop 55, ford 53, enchantress 51, tally 39, locks 39, undertow 38, larder 31.) */
/** S56 (ADR-164): the Loop is ARCHIVED and out of this table (its last measure: 53, pilot 106). Post-S57: the Larder too (31, pilot 111). Post-S58: the Undertow (40) and the Cinder (44).
 * Post-S58 (2026-10-09) — THE TABLE OF RECORD AGAIN: Countersnake joins (58, third) and the pilot is book 117 (flash creatures at the end step, Clio's counters, held removal): seventeen lists, 13,600 games, analysis/runs/rr17_s58e.json. */
export const OPEN_MEANS: Record<string, number> = { "open:rabble": 66, "open:pall": 66, "open:countersnake": 58, "open:writ": 53, "open:coin": 53, "open:hearth": 52, "open:levy": 51, "open:muster": 51, "open:warband": 50, "open:kiln": 49, "open:depths": 49, "open:tally": 46, "open:sweep": 45, "open:wurmspeaker": 43, "open:ford": 41, "open:enchantress": 39, "open:locks": 39 };
/** Post-S52 (Chris): the candidates are the TWELVE best-fitting lists (the Open's whole library, not its top five),
 * and the noise has a noise of its own — a seat is STOCK (the list as written), a LIGHT tinkerer (one or two swaps),
 * or a HEAVY one (four to six); the light and the heavy also move a land. The shares are a quarter, a half, a quarter. */
export const CONSTRUCTED_TERMS = { candidates: 12, noiseBand: 0.5, inListBonus: 0.3, tinker: { stock: { share: 0.25, swaps: [0, 0] }, light: { share: 0.5, swaps: [1, 2] }, heavy: { share: 0.25, swaps: [4, 6] } } } as const;
export type Tinker = keyof typeof CONSTRUCTED_TERMS.tinker;
/** Post-S58 (Chris: the Mardu decks "feel overrepresented" — the Pall drew 37% of the strong seats and four seats of
 * 31): NO LIST IS MORE THAN A TENTH OF THE FIELD. The seats draw in order; a list at the cap is closed to the seats
 * after it. The list draw by strength (ADR-158) stands underneath — a responsive metagame kept in the back pocket —
 * and the cap is what guarantees variety whatever the table of record says. */
export const LIST_CAP = 0.1;
export const listCap = (seats: number): number => Math.max(1, Math.floor(LIST_CAP * seats));
/** The lists closed to the next seat: those `counts` shows at the cap for a field of `seats`. */
export const cappedLists = (counts: ReadonlyMap<string, number>, seats: number): Set<string> => new Set([...counts].filter(([, n]) => n >= listCap(seats)).map(([k]) => k));
/** S55 (ADR-158 amended): how a seat draws its list — a quarter of seats lean to the strong lists, a quarter to the weak. */
export type ListDraw = "top" | "any" | "low";
export const LIST_DRAW_SCALE = 10;
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
  return library.filter((l) => !l.archived).map((l) => ({ l, share: legalShare(l.decklist, rule, cards), strength: strength(l) })).sort((a, b) => b.share - a.share || b.strength - a.strength || a.l.key.localeCompare(b.l.key)).slice(0, candidateCount());
}

export function buildConstructedDeck(format: ConstructedFormat, rating: CardRatingTable, seed: number, library: readonly LibraryList[], cards: Map<string, CardDef>, opts: { /** Force the tinker level (the tinker study); default: rolled from the seed. */ tinker?: Tinker; /** Force the source list. */ from?: string; /** S55 (ADR-158 amended): the seat's list draw — `top` leans to the lists that measure strong, `low` to those that measure weak. */ lists?: ListDraw; /** Post-S58 (the cap): lists this seat may not draw — those already at the field's cap. */ exclude?: ReadonlySet<string> } = {}): ConstructedBuild {
  const rule = format.rule, rng = new WorldRng(seed);
  const def = (id: string) => { const d = cards.get(id); if (!d) throw new Error(`buildConstructedDeck: ${id} is not in the card pool`); return d; };
  const rate = (id: string) => cardRating(def(id), rating);
  const role = (id: string): Role => (def(id).types.includes("Land") ? "land" : def(id).types.includes("Creature") ? "creature" : "spell");
  const size = (l: Decklist) => l.reduce((n, e) => n + e.count, 0);

  // ---- select ----
  const all = selectCandidates(format, rating, library, cards), open = opts.exclude?.size ? all.filter((s) => !opts.exclude!.has(s.l.key)) : all;
  const scored = open.length ? open : all;
  // S55 (ADR-158 amended — the lever S54 found missing): a seat's list is drawn BY ITS STRENGTH. A measured list's
  // share is scaled by e^(±(mean − 50)/LIST_DRAW_SCALE): a `top` seat draws the Levy about four times as often as
  // the Larder would otherwise suggest, a `low` seat the reverse; an `any` seat (and every unmeasured list) as before.
  const lean = opts.lists === "top" ? 1 : opts.lists === "low" ? -1 : 0;
  const weight = (s: { share: number; strength: number }) => s.share * (lean !== 0 && s.strength >= 1000 ? Math.exp((lean * (s.strength - 1000 - 50)) / LIST_DRAW_SCALE) : 1);
  const total = scored.reduce((n, s) => n + weight(s), 0);
  let roll = rng.float() * (total || 1), chosen = scored[0]!;
  for (const s of scored) { if (roll < weight(s)) { chosen = s; break; } roll -= weight(s); }
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
  const poolOf = (r: Exclude<Role, "land">) => [...cards.values()].filter((d) => !isBasic(d.id) && !d.types.includes("Land") && role(d.id) === r && cardLegal(d, rule) && inColours(d.id) && !answersGraveyards(d)) /* S55: graveyard exile is never mained by the builder */.map((d) => d.id)
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

/** Post-S54 (Chris: fifteen-card sideboards in Constructed, the field too): a list's sideboard, built for the three
 * rules the field sideboards by (sideboard-ai.ts) — answers to artifacts and enchantments, answers to creatures, and
 * the best cards left for when its counterspells come out. From the format's legal cards, castable in the deck's
 * colours, within the copy cap over the seventy-five (a restricted card in the sixty is not in the fifteen).
 * Deterministic (the Constructed score, ties by id): the same deck always registers the same fifteen. */
export const SIDEBOARD_SIZE = 15;
export const SIDEBOARD_SHAPE = { relics: 4, creatures: 5, graveyards: 4 } as const;
/** S56 (Part 2): slots for the four shapes the field now sideboards by (sideboard-ai rules 5–8), taken after the three
 * above; a deck whose colours hold none of a kind leaves that slot to the best of the rest. */
export const SIDEBOARD_SHAPE_S56 = { relics: 3, creatures: 3, graveyards: 4, sweepers: 2, creatureCounters: 2, steal: 2, blockers: 2 } as const;
export function buildSideboard(deck: Decklist, format: ConstructedFormat, rating: CardRatingTable, cards: Map<string, CardDef>, isRelicAnswer: (d: CardDef) => boolean, isCreatureAnswer: (d: CardDef) => boolean, /** S56: reserve the four shapes' slots (the field does; `false` is the S55 fifteen) */ shapes = true): Decklist {
  const rule = format.rule;
  const inDeck = new Map(deck.map((e) => [e.cardId, e.count]));
  const colors = new Set(deck.flatMap((e) => { const d = cards.get(e.cardId); return d && !d.types.includes("Land") ? cardColors(d) : []; }));
  const room = (d: CardDef) => Math.max(0, Math.min(copyCap(d.id, rule), COPY_CAP) - (inDeck.get(d.id) ?? 0));
  // S55 (ADR-162): graveyard exile is a sideboard card by nature — any deck may register it (it is used for no mana),
  // two of each, in slots of its own; it is never among "the best of the rest"
  const hate = [...cards.values()].filter((d) => cardLegal(d, rule) && answersGraveyards(d) && usableByAnyDeck(d) && room(d) > 0).sort((a, b) => a.id.localeCompare(b.id));
  const pool = [...cards.values()].filter((d) => !d.types.includes("Land") && cardLegal(d, rule) && cardColors(d).every((c) => colors.has(c)) && room(d) > 0 && !answersGraveyards(d))
    .sort((a, b) => cardRating(b, rating) - cardRating(a, rating) || a.id.localeCompare(b.id));
  const side = new Map<string, number>();
  const size = () => [...side.values()].reduce((n, x) => n + x, 0);
  const take = (want: (d: CardDef) => boolean, slots: number, perCard: number) => {
    let left = Math.min(slots, SIDEBOARD_SIZE - size());
    for (const d of pool) {
      if (left <= 0) break;
      if (!want(d)) continue;
      const n = Math.min(left, perCard, room(d) - (side.get(d.id) ?? 0));
      if (n > 0) { side.set(d.id, (side.get(d.id) ?? 0) + n); left -= n; }
    }
  };
  { let left = SIDEBOARD_SHAPE.graveyards; for (const d of hate) { const n = Math.min(left, 2, room(d)); if (n > 0) { side.set(d.id, n); left -= n; } } }
  const S = shapes ? SIDEBOARD_SHAPE_S56 : SIDEBOARD_SHAPE;
  take((d) => !d.types.includes("Creature") && isRelicAnswer(d), S.relics, 2);
  take((d) => !d.types.includes("Creature") && isCreatureAnswer(d) && !isSweeper(d), S.creatures, 3);
  if (shapes) {
    take(isSweeper, SIDEBOARD_SHAPE_S56.sweepers, 2);
    take(isCreatureCounter, SIDEBOARD_SHAPE_S56.creatureCounters, 2);
    take(stealsCreatures, SIDEBOARD_SHAPE_S56.steal, 2);
    take((d) => isWall(d) || blocksFliers(d), SIDEBOARD_SHAPE_S56.blockers, 1);
  }
  take(() => true, SIDEBOARD_SIZE, 2); // the best of the rest, two of each
  return [...side.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cardId, count]) => ({ cardId, count }));
}
