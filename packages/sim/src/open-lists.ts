/**
 * S46 (ADR-142/143): the Open's seed lists — parsed from the planner's document (`docs/convocation/
 * convocation-open-lists-draft-2.md`, left untouched), with the S46 brief's amendments and the twelfth list (the Loop)
 * applied from the declared table below. `pnpm open:gen` writes `open-decks.ts` (the committed source of truth) and the
 * Lab's `analysis/decks/open-*.json`; `open-lists.test.ts` pins the two together.
 */
export type OpenDecklist = { cardId: string; count: number }[];
export interface OpenList { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: OpenDecklist; /** S55: a contributed list's registered fifteen */ sideboard?: OpenDecklist; /** S56 (ADR-164): kept in the data with its plan and its history; out of the field, the round-robin and the retire count */ archived?: true }

/** The document's section title (before the em dash) → the list's key, its nickname and the AI's archetype. */
export const OPEN_KEYS: Record<string, { key: string; archetype: "aggro" | "midrange" | "control" }> = {
  "Mardu Aristocrats (W B R)": { key: "coin", archetype: "midrange" },
  "Simic Mill (U G)": { key: "undertow", archetype: "control" },
  "Four-Colour Reanimator (W U B G)": { key: "larder", archetype: "midrange" },
  "Boros Weenie (W R)": { key: "muster", archetype: "aggro" },
  "Boros Goblins (R w)": { key: "warband", archetype: "aggro" },
  "Izzet Sparks (U R)": { key: "tally", archetype: "aggro" },
  "Esper Control (W U B)": { key: "locks", archetype: "control" },
  "Mono-Green Ramp": { key: "wurmspeaker", archetype: "midrange" },
  "Naya Lifegain (R W G)": { key: "ford", archetype: "midrange" },
  "Selesnya Auras (G W)": { key: "enchantress", archetype: "aggro" },
  "Orzhov Landfall (W B)": { key: "levy", archetype: "midrange" },
};

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
/** S57 (the revision round): the swaps adopted against the round-robin of record (pilot 108) — each gained two
 * points clear of its error against the field, 1,500 games paired by seed (`open:rr --swap`; the numbers are in
 * docs/decision-updates/s57.md). Applied after the S46 amendments, by card NAME → delta. */
export const OPEN_REVISIONS_S57: Record<string, Record<string, number>> = {
  locks: { "Tidewall": -2, "Ponder": -2, "Control Magic": 4 }, // +11.0 ± 2.2
  // +8.9 ± 1.8 for the Control Magics. Then (Chris, 2026-10-07, after the round: "the 'and friends' part needs some help", and
  // help against the graveyard decks) the Nighthawks for Zinnia with the Forests to Swamps, and two Faerie Macabres
  // main for the Temporal Springs: +6.0 ± 2.3 on the S57 table (36.2 → 42.2; the Pall +13, the Larder +14, no matchup lost).
  // The list no longer holds green — or its namesake.
  undertow: { "Boomerang": -3, "Control Magic": 3, "Zinnia, the Undertow": -3, "Vampire Nighthawk": 3, "Temporal Spring": -2, "Faerie Macabre": 2, "Forest": -2, "Swamp": 2 },
  tally: { "Arc Mage": -2, "Abrade": -2, "Flametongue Kavu": 4 }, // +13.0 ± 2.0
  muster: { "Vitalist": -2, "Suntail Hawk": -2, "Flametongue Kavu": 4 }, // +10.0 ± 1.9
  ford: { "Savage Twister": -2, "Restoration Angel": -2, "Flametongue Kavu": 2, "Rage Cobra": 2 }, // +5.1 ± 1.8
  warband: { "Boggart Brute": -2, "Restoration Angel": -1, "Flametongue Kavu": 2, "Lumen, the Hearth Fire": 1 }, // +3.9 ± 1.5
};
/** The twelfth list (S46 brief; Chris: in Mardu's colours only) — the Usher's Coin −3 Vampire Nighthawk (the Coin runs
 * three) −2 Meliyan −1 Sacred Helix → +4 Restoration Angel +2 Altar of Dementia; the Coin's lands unchanged. */
export const LOOP_FROM_COIN: Record<string, number> = { "Vampire Nighthawk": -3, "Meliyan, the Torment": -2, "Sacred Helix": -1, "Restoration Angel": 4, "Altar of Dementia": 2 };

/** Parse the document's eleven fenced lists; resolve names through `idOf` (throws on an unknown name). */
export function parseOpenLists(doc: string, idOf: (name: string) => string | undefined): OpenList[] {
  const out: OpenList[] = [];
  const re = /## \d+\. ([^\n]+)\n```\n([\s\S]*?)```/g;
  for (let m = re.exec(doc); m; m = re.exec(doc)) {
    const heading = m[1]!;
    const [head, nick] = heading.split(" — ").map((x) => x.trim());
    const meta = OPEN_KEYS[head!];
    if (!meta) throw new Error(`open lists: no key for "${head}"`);
    const byName = new Map<string, number>();
    for (const line of m[2]!.split("\n")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      for (const raw of line.slice(colon + 1).split("·")) {
        const part = raw.replace("(r)", "").trim();
        if (!part) continue;
        const mm = /^(\d+)\s+(.*)$/.exec(part);
        const [n, name] = mm ? [Number(mm[1]), mm[2]!.trim()] : [1, part];
        byName.set(name, (byName.get(name) ?? 0) + n);
      }
    }
    for (const [name, d] of Object.entries(OPEN_AMENDMENTS[meta.key] ?? {})) byName.set(name, (byName.get(name) ?? 0) + d);
    for (const [name, d] of Object.entries(OPEN_REVISIONS_S57[meta.key] ?? {})) { const n = (byName.get(name) ?? 0) + d; if (n < 0) throw new Error(`open lists: the S57 revision cuts more ${name} than ${meta.key} runs`); byName.set(name, n); }
    out.push(build(meta.key, nick?.replace(/"/g, "") ?? meta.key, head!, meta.archetype, byName, idOf));
  }
  return out;
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
