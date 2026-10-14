# Session 63 brief — the Elder's table, and the formats' plumbing

*Planner → Implementer. 2026-10-14. Follows the running handoff.md (after S62 and the week's work). One session. Process rules unchanged: appends to `docs/decision-updates/s63.md`; probe before rule; a guide measured row by row; every AI change carries a ladder delta or reverts; push only when Chris asks, `pnpm build:web` first.*

## Part 0 — Rulings and ADR appends
- **S62's deviations and the week's work ratified**: the formats as directories; the relative `small`/`large` with the Open's thresholds frozen at their measured values; thirteen seeds kept, two archived; the ten cards with their four printing corrections (R-108); book 125; the turn limit at 120 (Concern 1 — a limit is a ruling, and 120 clears a library); Dazzling Angel (T1) and Wall of Reverence (T2); Dungrove Auras' Wurms (Chris); White Skies registered; the Peasant score.
- **ADR-178 — Peasant's levers, in order: the pool, then play, then the tier.** Peasant has no restricted list; a card's tier is its last lever, not its first. Dungrove Auras at 76 with no matchup within seven of even is the format's premiere threat on a first table of a format a day old — **the Elder stays** (Chris). The order of answers is the Open's: the pool grows toward the threat (a second round, as the Open's rounds did; the planner brings candidates once Part 1's table says which shape is nearest), play builds the predator (Chris's next build; White Skies is the first at even), the sideboards learn it (Part 1). The tier moves only when the pool and play have both had their rounds and no list reaches 55 — recorded as the lever, not scheduled. The Captain of the Watch carries the same order.
- **ADR-167 note — the "target player" family.** Book 125 is the third misaim of a spell or trigger aimed at a player (the Sign at the opponent; the Purge never cast; the Sharpshooter's simplification): the implementer audits the shape once — every card whose target is a player, its aim rule and its prediction — rather than finding them one card at a time.
- **Black Forest Ham** is not registered (Chris has not asked); its reads stay in the record.

## Part 1 — Peasant's second table: sideboards that know the Elder
- **A new guide shape, `hexproof`**: the opponent's list holds four or more hexproof or shroud creatures with power two or more (Dungrove Auras today; a Scout list reads under it if its Scouts are its threats — the threshold is the planner's, confirm by `sideboard:show`).
- **Registered fifteens and guides**, measured row by row at 160 matches, for the lists that can answer the Elder: **White Skies** (the fourth Wave in against `hexproof`; a guide row only — Pacifism cannot touch an Elder); **BW Aristocrats** (2 Diabolic Edict in for the Captains against `hexproof` — the Edict reads a *board of one* and the planner expects a small gain or none; measure it anyway); **UW Skies** (a second Wave; Wall of Air out for a flier); **BR Removal** and **Mono-Black** (nothing in the pool answers it from black — the row is "race": the Kavus stay, the Gravediggers out for Chars); **RW Tokens** (the Captain in, the Anthem's width as the race).
- **The out-rule's `hexproof` word**: against a hexproof deck, spot removal that cannot target its threats leaves first (Doom Blade, Terror, Pacifism, Swords) — the complement of the `graveyard` word. Measured paired on the Auras pairings.
- **The table of record** (fourteen lists, three columns, pilot 127, the 120-turn limit): Dungrove Auras' row by opponent; the read ADR-178 names — the nearest list's match rate against it, and **which shape got nearest** (the Wave, the air and the lifegain; the Edict on a small board; a race), so the second pool round is drafted toward the shape that works rather than the one that reads well.

## Part 2 — The formats' plumbing (the handoff's list)
- **`OPEN_MEANS` is generated**, not hand-edited: `open:rr --merge … --record` writes `formats/<id>/means.json` as the match report does; `open:gen` reads both into `FORMAT_STRENGTH`.
- **The reference per format**: `docs/reference/<format>-lists.md` for every format in `FIELD_FORMAT_IDS` (Peasant's lists leave the handoff and live in the reference), sync-tested; the matchup grid artifact per format.
- **Plans as a parameter**: `open:gen` accepts a combo list in any format (Peasant has none; the plumbing stops refusing).
- **`format:census --colors`** for the triads (Part 3).

## Part 3 — The triads' census (read only; seeds are S64's)
For each of the ten triads: the pool under `colorsWithin` (count by colour, role, tier), the Open's lists ranked by legal share (the seeds' starting points), the cards each triad lacks against the gaps list's shape (a sweeper, card advantage, a finisher, a counter). The planner drafts the first triad's seeds from this; the implementer says which triad has the deepest pool and which the shallowest.

## Part 4 — Smalls
- The art recompressed (`docs/deployment-size.md`, option A) before the next large push — if the storage cap still bites.
- A journey played through a sitting is still Chris's (the interval and the prizes).

## Handoff
The Elder's table and ADR-178's read (the nearest shape); the fifteens and guides adopted; the generated means and the per-format references; the triads' census; deviations, concerns — and the implementer's list of what the pool lacks against the nearest shape, for the planner's second Peasant round.
