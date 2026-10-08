/**
 * The Open's seed lists. S58 (ADR-169): THE LISTS LIVE IN CODE — the eleven as the planner first wrote them are data
 * (`data/convocation/open-seeds.json`, by card name; the planner's document they came from is history), and every
 * change since is a REVISION below, by session. `pnpm open:gen` builds `open-decks.ts` and the generated reference
 * `docs/reference/open-lists.md`; tests pin both.
 */
export type OpenDecklist = { cardId: string; count: number }[];
export interface OpenList { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: OpenDecklist; /** S55: a contributed list's registered fifteen */ sideboard?: OpenDecklist; /** S56 (ADR-164): kept in the data with its plan and its history; out of the field, the round-robin and the retire count */ archived?: true }

/** The S46 brief's Part 2 amendments (by list key, card NAME → delta), then the Loop (Chris's kickoff: Mardu only). */
export const OPEN_AMENDMENTS: Record<string, Record<string, number>> = {
  larder: { "Thought Scour": -3, "Duress": -1, "Entomb": 4 },
  wurmspeaker: { "Pelakka Wurm": -1, "Gaean Wurm": -1, "Rampaging Baloths": 2 },
  tally: { "Thought Scour": -3, "Ponder": 3 },
  locks: { "Brainstorm": -2, "Ponder": 2 },
  // Chris, 2026-10-01 (after the first round-robin: the Undertow at 25% — "no damage in a sixty-card deck"): the list goes
  // U G b — Glimpse the Unthinkable, Tidewalls to rebuy it, one Reeve as a repeatable mill and a second win condition.
  // Written against draft 2 (so the S46 Brainstorm → Ponder swap is superseded: the two cantrips leave).
  undertow: {
    "Man-o'-War": -1, "Cathartic Adept": -4, "Brainstorm": -2, "Zinnia, the Undertow": -1, "Glimpse the Unthinkable": 4, "Tidewall": 4, "Altar of Dementia": -2, "Thought Scour": -2, "Clio, Lady of the Depths": 4,
    "Breeding Pool": -4, "Island": -2, "Forest": -2, "Library of Alexandria": -1, "Underground Sea": 4, "Bayou": 2, "Swamp": 1, "Mox Jet": 1, "Black Lotus": 1,
  },
  enchantress: { "Giant Growth": -3, "Angelic Destiny": 3 },
  ford: { "Wood Elves": -2, "Char": -2, "Vitalist": 4 },
  muster: { "Sacred Helix": -2, "Vitalist": 2 },
};
/** The revisions since S46, in order — each a session's adopted swaps by list key (card NAME → delta), with the
 * measure that adopted it. S57's bar was the gain less its 95% error ≥ 2; from S58 (ADR-168) the estimate ≥ +2 with a
 * positive lower bound. The numbers' detail is in docs/decision-updates/. */
export interface OpenRevision { session: string; note: string; lists: Record<string, Record<string, number>>; why?: Record<string, string> }
export const OPEN_REVISIONS: OpenRevision[] = [
  { session: "S57", note: "the revision round: each swap gained two points clear of its error against the field (1,500 games, paired by seed)", lists: {
  locks: { "Tidewall": -2, "Ponder": -2, "Control Magic": 4 },
  undertow: { "Boomerang": -3, "Control Magic": 3 },
  tally: { "Arc Mage": -2, "Abrade": -2, "Flametongue Kavu": 4 },
  muster: { "Vitalist": -2, "Suntail Hawk": -2, "Flametongue Kavu": 4 },
  ford: { "Savage Twister": -2, "Restoration Angel": -2, "Flametongue Kavu": 2, "Rage Cobra": 2 },
  warband: { "Boggart Brute": -2, "Restoration Angel": -1, "Flametongue Kavu": 2, "Lumen, the Hearth Fire": 1 },
  }, why: { locks: "+11.0 ± 2.2", undertow: "+8.9 ± 1.8", tally: "+13.0 ± 2.0", muster: "+10.0 ± 1.9", ford: "+5.1 ± 1.8", warband: "+3.9 ± 1.5" } },
  // (Chris, 2026-10-07: "the 'and friends' part needs some help", and help against the graveyard decks. The list no
  // longer holds green — or Zinnia, its namesake: S58 retitles it Dimir Mill.)
  { session: "post-S57", note: "Chris, 2026-10-07: the Undertow's fliers and its answer to graveyards", lists: {
    undertow: { "Zinnia, the Undertow": -3, "Vampire Nighthawk": 3, "Temporal Spring": -2, "Faerie Macabre": 2, "Forest": -2, "Swamp": 2 },
  }, why: { undertow: "+6.0 ± 2.3 (the Pall +13, the Larder +14, no matchup lost)" } },
  { session: "S58", note: "adopted under ADR-168 from S57's near-misses", lists: {
    tally: { "Blaze": -2, "Control Magic": 2 },
    enchantress: { "Glare of Subdual": -1, "Pacifism": 1 },
  }, why: { tally: "+3.2 ± 1.5 (and +3.1 ± 1.5 on the Kavus)", enchantress: "+1.9 ± 0.7 pooled over two seeds (the brief's Giant Growth left in S46; the Glare is the slot measured)" } },
];
/** S58 (Part 0): a list's title where the planner's first one no longer describes it. */
export const OPEN_TITLES: Record<string, string> = { undertow: "Dimir Mill (U B)" };
/** The twelfth list (S46 brief; Chris: in Mardu's colours only) — the Usher's Coin −3 Vampire Nighthawk (the Coin runs
 * three) −2 Meliyan −1 Sacred Helix → +4 Restoration Angel +2 Altar of Dementia; the Coin's lands unchanged. */
export const LOOP_FROM_COIN: Record<string, number> = { "Vampire Nighthawk": -3, "Meliyan, the Torment": -2, "Sacred Helix": -1, "Restoration Angel": 4, "Altar of Dementia": 2 };

export interface OpenSeed { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control"; cards: Record<string, number> }
/** The seed lists as they stand: each seed with the S46 amendments and every revision since applied, in order;
 * names resolved through `idOf` (throws on an unknown name or a count that goes negative). */
export function seedLists(seeds: readonly OpenSeed[], idOf: (name: string) => string | undefined): OpenList[] {
  return seeds.map((seed) => {
    const byName = new Map(Object.entries(seed.cards));
    const apply = (delta: Record<string, number> | undefined, what: string) => { for (const [name, d] of Object.entries(delta ?? {})) { const n = (byName.get(name) ?? 0) + d; if (n < 0) throw new Error(`open lists: ${what} cuts more ${name} than ${seed.key} runs`); byName.set(name, n); } };
    apply(OPEN_AMENDMENTS[seed.key], "the S46 amendment");
    for (const r of OPEN_REVISIONS) apply(r.lists[seed.key], `the ${r.session} revision`);
    return build(seed.key, seed.name, OPEN_TITLES[seed.key] ?? seed.title, seed.archetype, byName, idOf);
  });
}

/** The Loop from the Coin's parsed list (by card id; `idOf` maps the amendment names). */
export function buildLoop(coin: OpenList, idOf: (name: string) => string | undefined): OpenList {
  const m = new Map(coin.decklist.map((e) => [e.cardId, e.count]));
  for (const [name, d] of Object.entries(LOOP_FROM_COIN)) {
    const id = idOf(name);
    if (!id) throw new Error(`open lists: the Loop names an unknown card "${name}"`);
    const n = (m.get(id) ?? 0) + d;
    if (n < 0) throw new Error(`open lists: the Loop cuts more ${name} than the Coin runs`);
    m.set(id, n);
  }
  return { key: "loop", name: "the Loop", title: "Mardu Loop (W B R)", archetype: "midrange", decklist: [...m].filter(([, n]) => n > 0).map(([cardId, count]) => ({ cardId, count })) };
}

function build(key: string, name: string, title: string, archetype: OpenList["archetype"], byName: Map<string, number>, idOf: (name: string) => string | undefined): OpenList {
  const decklist: OpenDecklist = [];
  for (const [n, count] of byName) {
    if (count < 0) throw new Error(`open lists: ${key} — ${n} goes negative after the amendments`);
    if (count === 0) continue;
    const id = idOf(n);
    if (!id) throw new Error(`open lists: ${key} — unknown card "${n}"`);
    decklist.push({ cardId: id, count });
  }
  return { key, name, title, archetype, decklist };
}
