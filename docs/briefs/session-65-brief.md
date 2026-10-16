# Session 65 brief — Esper, the second triad

*Planner → Implementer. 2026-10-16. Follows the running handoff.md (after S64). One session. Process rules unchanged: appends to `docs/decision-updates/s65.md`; probe before rule; a guide measured row by row; every AI change carries a ladder delta or reverts; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S64's deviations ratified**: Karmic Mentor as ADR-180's "next card" (Chris's design; Mentor of the Meek stays in the pool, in no list); book 129's three-quarters floor; the `killers` shape; ADR-181 reaching mana artifacts (`manaWithin`; the Lotus as Birds); Naya's seeds as built with the newer cards in; the Fordkeeper read.
- **ADR-182 — A custom card's study.** A single-factor sweep around a centre point (cost, trigger, cap, body), then full tables for the corners that moved, then **a combo probe by shuffling** for any version that makes a loop possible — read by shuffling or a plan, never by the pilot's win rate alone (ADR-155 extended; Karmic Mentor is the record).
- **ADR-183 — Habits become rules, not replays.** A person's habit in a play diff reads ~0 by playout (a playout cannot credit a held card's later use); it is measured as a rule on the lists it is for (books 130–131 are the record; book 129 neutral and kept).
- **ADR-184 — A triad's field is its own registered lists.** Campaign decks (a lord's stronghold list) do not seat; a format with fewer than eight lists borrows from the Open's legal lists until it has them.
- **Naya's names** (the plane's register): the Snakes → **the Brood**; GW Auras → **the Thicket**; RW Tokens → **the Watch**; Stompy → **the Stampede**; Lifegain → **the Chantry**. The rest keep theirs.
- **Peasant's table re-runs** with books 130–131 (and 132); the triangle re-read.
- **Book 57's stack read** fixed as book 132's was (a resolving trigger has left the stack the view shows), with a ladder run.

## Part 1 — Esper (`formats/esper/`, WUB)
- **The rule**: `colorsWithin: WUB` and `manaWithin` (ADR-181); the Open's restricted list where it applies (the Lotus; Mox Pearl, Sapphire, Jet; Time Walk; the Obsidian Observatory; Demonic Tutor; Library); the laws banned. The door's line: *"Esper — white, blue and black. Counters, sweepers and the long game; the finishers are few."*
- **The seeds** (the planner's; built to sixty by the implementer, whole where whole, with the newer cards in as Chris asked for Naya; working names):
  1. **Mono-Black Control** — the Pall's shell without its engine: **the Usher is Mardu (WBR) and legal only in that triad** (Chris) — so no Pall, no loop, in Esper. The mono-black list is the Witch, Drana, the Jet Witch's draw, Nighthawk, Vindicate? (no — W), Doom Blade, Edict, Hypnotic Specter, the Tutor; a control list, not a combo one.
  2. **The Writ** — whole (Dimir Control; Clio, Protocol).
  3. **The Levy** — whole (Orzhov landfall).
  4. **The Locks, revived** — the archived Esper control list with its S57/S58 revisions (the four Control Magics), plus Protocol and Karmic Mentor; Wrath and Wave as the sweepers.
  5. **The Undertow, revived** — the archived Dimir mill with Tome Scour ×4 and Tidewall; Glimpse; Clio.
  6. **WB Control** — the shape of Mardu Control without the Ushers (Mardu's) and without red: Karmic Mentor, Restoration Angel, Vindicate, the Jet Witch, Wrath, Isaura, Swords, the Levy's Emeria Angel at the top; Blood Artist and Soul Warden as the lifegain floor. Chris expects a WB control list exists here; this is the first draft of it.
  7. **UW Skies, promoted** — Peasant's UW Skies with Serra Angel, Faerie Formation, Emeria Angel, Control Magic, Counterspell; the Obsidian Observatory.
  8. **BW Tokens** — Shadow Summoning, Bitterblossom, Raise the Alarm, Captain of the Watch, Isaura, Emeria Angel, Glorious Anthem, Vindicate.
  9. **Mono-Blue Tempo** — Tidewall, Man-o'-War, Plumecreed Escort, Aether Channeler, Control Magic, Counterspell, Boomerang, Clio.
  10. **Esper Reanimator** — Entomb, Buried Alive, Zombify, Graceful Restoration; Angel of the Ruins, Artisan of Kozilek, the Reeve? (BGU — no; the Dredger is WUB ✓), the Dredger, Drana; a plan (`goal: "once"`, the Larder's vocabulary).
- **The tables** (three columns; the seat draw by matches; the cap); no Usher in the format, so no loop reads; the Clio lists' numbers after book 122; the format's three things to do read from the top-eight sub-table. **A note for the census**: a legend's colours decide its triads (the Usher is Mardu's alone; Clio is blue's; the Dredger is Esper's), so each triad's lords and ministers are the census's first line.
- **The lords**: the Dredger (WUB's stronghold lord) tried in the Locks and the Reanimator — a must-play or a card some decks want, as the Fordkeeper was read.

## Part 2 — Measure
Esper's table of record; Peasant's re-run; Naya's unchanged. The read across the three triads so far: Naya's evenness (none over 65), Esper's expected top (the Pall? the Writ?) and whether a triad with both engines produces the Open's shape in a smaller box.

## Part 3 — For Chris
His four-colour Karmic Mentor brew went 3–2 in a Constructed-only Convocation (just outside the eight): "some play without an obvious winner" — recorded; not registered; iterate if it pulls. A Naya or Esper Convocation; the journey through a sitting (still owed).

## Handoff
Esper's seeds, tables and door; Peasant's new table and the triangle; the names in; book 57; deviations, concerns — and the implementer's read for the third triad: **URW (Jeskai)** as the most balanced by the census (three counters, three sweepers, four draw, twelve finishers) — or whichever the two tables so far say the family lacks.
