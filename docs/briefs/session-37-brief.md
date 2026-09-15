# Session 37 brief — the deckbuilder, and three smalls

*Planner → Implementer. 2026-09-15. Follows the running handoff.md (after S36). Reads `phase-two-design-draft-1.md` §5, §6 and §10 for context; nothing phase-two-specific ships this session beyond the data shape a door rule needs. Process rules unchanged: appends to `docs/decision-updates/s37.md`; fuzz before fixtures where duels are touched; every AI change carries a ladder delta or reverts.*

## Part 0 — ADR appends
- **ADR-122 — Phase two's design is ratified as `phase-two-design-draft-1.md`** (the Flood; one journey; the five lord/court pairs under the five laws; triad gates at strongholds, shape gates at courts; the accumulating Heart; the salvage start). Its open list stands; its engineering sequence begins with the deckbuilder.
- **ADR-123 — Saved decks and door rules.** A save holds several named decks over one collection; an opponent template may carry a `deckRule`; the deck editor and the parley both validate against it. No phase-two content, no rule on any existing template this session.
- **Placements**: Pell of the Shallows −1 Thawing Glaciers +1 Island (the S36 read: −7; the Glaciers stays in Quill and the shop).

## Part 1 — The deckbuilder

Build on the in-game deck editor and the Lab's editor (`packages/ui/src/lab/` — counts, add-by-name, stats, custom decks saved by name); don't build a third.

1. **Several decks per save.** `world.decks: { id, name, list, notes, createdAt, updatedAt }[]` with `world.activeDeckId`; the collection is unchanged (one pool of owned cards); a card may be in several decks but a deck can't exceed the collection's copies at duel time (see 3). Rename, duplicate, delete (with confirmation), set active. Migration: an existing save's single deck becomes "Deck 1", active.
2. **The editor** on the world screen: the current editor's grid plus a deck picker, the Lab's live stats (cards / lands / avg MV / colour pips), and a **legality panel** (3). Keyboard-free on mobile stays true.
3. **Legality** — `checkDeck(list, collection, rule?) → { ok, problems[] }`: the existing minimums (deck size, copy caps, ownership) plus an optional `deckRule` (Part 2). Problems are sentences ("3 cards are outside the Jeskai colours: …", "12 creatures; the door asks 15"). The editor shows them live; the world refuses to *enter a duel* with an illegal active deck (today's rule) and refuses a *door* whose rule the active deck fails — the parley says which rule, in the archaic register (planner's line: *"The gate knows your colours. It will not open to these."* — refine per rule later).
4. **Single-game mode** reads the same saved decks (the picker lists them beside the starters and the road decks).
5. Save format: `SCHEMA_VERSION` bump with a migration test; the autosave's compact path unchanged; the quota trim untouched.

## Part 2 — `deckRule` on templates (data shape only)
```ts
type DeckRule = {
  colorsWithin?: Color[];       // the stronghold gate: every card's colours ⊆ this set (colourless always ok)
  minCreatures?: number;
  maxLands?: number;
  maxManaValue?: number;
  singleton?: boolean;          // at most one of each non-basic
  minCards?: number;
  label: string;                // "the Jeskai gate", shown by the editor and the parley
};
```
On `OpponentTemplate.deckRule?` — validated by the catalog loader, rendered in `enemies.md` when present, read by `checkDeck` and by the door. **No existing template gets one.** A test template in the fixtures carries one so the path is exercised end to end (editor → refusal → a legal deck enters).

## Part 3 — Smalls
- **The Angel's cycling gate** respects the reanimator's ceiling (Unearth ≤ 3; Zombify any) — book 53 amended, pinned.
- **Spawn knobs, wired at today's values** (Chris: set up for a future tuning pass, change nothing): `mageSpawnWeight[tier][region]` (the three regions × three tiers; default = the current effective weights, whatever they are — document them) and `mageSpawnRamp` (a per-step-count multiplier on tier-2/3 weights; default 1.0 = no ramp). Rendered in `docs/knobs.md`; a world test pins that the default spawn distribution is unchanged from S36 (same seeds, same encounters).
- The Lab's roster can list a saved deck as a row (it already lists custom decks; saved decks are the same shape).

## Part 4 — Verification & handoff
Editor and legality tests (each rule field; the combined problems list; the migration); the door refusal through the controller (the S10 pattern); the spawn pin; the Angel pin; ladder gates if any AI moved. Handoff: what the editor can do, the schema bump, the default spawn weights as documented, deviations, concerns — and the implementer's read of what the salvage start (§6 of the design) would need on top of this, for the S38 brief.

## Out of scope
Any phase-two content; the resolver's phase-two bundle; `heartLawsPersist`; the map. Those are S38+ once the deckbuilder is in hand.
