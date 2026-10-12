# Session 62 brief — Peasant, the second Constructed format

*Planner → Implementer. 2026-10-13. Follows the running handoff.md (after S61) and `docs/penny-experiments.md` (the tier-two experiments; "Penny" is retired as a name). One session, maybe a half more. Process rules unchanged: appends to `docs/decision-updates/s62.md`; re-verify every ⚠ real card by curl; fuzz before fixtures; probe before rule; every AI change carries a ladder delta or reverts. **Do not push** until Chris asks.*

## Part 0 — Rulings and ADR appends
- **S61's deviations and the week's work ratified**: book 124 with its third clause; the out-rule as three switches adopted per list; the Purge's journey read; the tools in the repo; the seed-56 tables (consistent with each other); the tier-two experiments.
- **ADR-176 — Peasant.** The second Constructed format: every card of tier 2 and below (140 today; 150 with this round), 60 minimum, 4-of, basics uncapped, no restricted list (nothing restrictable is in it), the laws banned as everywhere. **Named "Peasant"** (Magic's word for commons-and-uncommons; the door explains "tier two and below"); ⚠ Chris may prefer "Tier Two" — one string. Tier 1 alone (Pauper) is recorded as too small a pool (75 cards, no dual, one counter) and not built as a format.
- **ADR-177 — Ten cards for Peasant (pool 249 → 259)**, most of which the Open's weaker lists also want (Part 1).
- **A format's lists are a parameter**: `open:rr`, `open:gen`, `sideboard:show`, the tables of record, the field builder's fifteen and the guide shapes all take the format; the Open's hard-wiring ends. The Open's data moves under `data/convocation/formats/open/` with Peasant beside it (or a `format` key on every list — the implementer's choice, said in the handoff).
- **Guide shapes are relative to a format's field** (`small`, `large` thresholds as quantiles of the field's lists, not absolute counts), so `small` is not true of every Peasant deck.
- **The stalemate is a pilot debt** (Part 5), not a Peasant problem: the Tollgate's 128 turn-limit draws and the black mirrors' 18% are the same shape.

## Part 1 — The cards
| card | printing ⚠ | text as the planner has it ⚠ | tier | words |
|---|---|---|---|---|
| Penumbra Wurm | Apocalypse | {4}{G}{G}{G} 6/6 Wurm. Trample. When it dies, create a 6/6 black Wurm creature token with trample. | 2 | zero (a dies trigger; a token with trample) |
| Wave of Reckoning | Mercadian Masques | {4}{W} Sorcery. Each creature deals damage to itself equal to its power. | 2 | **each creature damages itself by its power** (half a word: a per-creature self-damage) |
| Harmonize | Planar Chaos | {2}{G}{G} Sorcery. Draw three cards. | 2 | zero |
| Sign in Blood | Shards of Alara | {B}{B} Sorcery. Target player draws two cards and loses 2 life. | 1 | zero |
| Dungrove Elder | Innistrad | {2}{G} Treefolk. Hexproof. Its power and toughness are each equal to the number of Forests you control. | 2 | **P/T defined by a count** (half: Blanchwood Armor's Forest count as a characteristic-defining static) |
| Moaning Wall | Urza's Saga | {2}{B} 0/5 Wall. Defender. Cycling {2}. | 1 | zero |
| Dawnwing Marshal | ⚠ **by the curl** (the planner does not trust its memory of the printing) | {1}{W} 2/2 flier; {4}{W}: creatures you control get +1/+1 until end of turn — as Chris has it. | 2 | zero (a team pump as an activated ability) |
| Longbow Archer | Visions | {W}{W} 2/2 Soldier Archer. First strike, reach. | 1 | zero |
| Captain of the Watch | M10 | {4}{W}{W} 3/3 Soldier. Vigilance. Other Soldier creatures you control get +1/+1 and have vigilance. When it enters, create three 1/1 white Soldier creature tokens. | 2 (⚠ may rise to 3) | zero (an anthem by subtype with a keyword grant; the Soldier token) |
| Tome Scour | M10 | {U} Sorcery. Target player mills five cards. | 1 | zero |
Art through `art:fetch`; each card's cast rate in the Peasant seeds reported (ADR-155's instrument for real cards in a Constructed format is the round-robin with the cast count).

## Part 2 — The seeds
From `docs/penny-experiments.md`'s draft lists, revised with the ten (the planner's notes; the implementer measures and adopts by ADR-168's bar in Peasant's own field):
- **BR Removal** (two builds) — the best deck; unchanged as the yardstick.
- **Mono-Black Removal** — +Sign in Blood (the draw it lacked), +Moaning Wall ×2 if its matchups want a wall.
- **The Rabble's port, RG Stompy, the Muster's port, RW Tokens** — the aggro tier; RW Tokens +Captain of the Watch ×2 at the top (and the Marshal), the Muster's port +Longbow Archer.
- **UW Skies** (two builds) — +Invisible? no (not added); +Dawnwing Marshal ×4, +Wave of Reckoning ×2 (its walls survive it).
- **BW Aristocrats** — +Captain ×2.
- **UB Control, UR Pyroclasm Control** — +Tome Scour ×4 in a UB mill build (with Hedron Crab, Thought Scour: the second mill engine); UW control gets Wave of Reckoning ×3 and Moaning Wall → no (black) — a **WB or Wx control** seed with Wave, walls and the Gargantua-less reanimation (Penumbra Wurm as the top).
- **Mono-Green / GW Auras** — the Enchantress's tier-two cousin: Dungrove Elder ×4, Harmonize ×3, Penumbra Wurm ×2, the auras, Rancor.
- **Naya Flash Snakes** — as drafted (the Forerunner is T2).
Twelve to fourteen seeds; game one and matches; the cast counts; a Peasant table of record. "Solvable" and the pillars read as the Open's (ADR-171).

## Part 3 — The Peasant rating
The S51 method on Peasant games: `rating:build` with a format, from the seeds' round-robin and a noise run; a `peasant` score beside `limited` and `rating` (ADR-153's table grows a column per Constructed format). Until it exists the out-rule and the builder's "better only" treat the tier-1/2 shelf as unranked (Concern: the shelf sits inside half a point of rating).

## Part 4 — The door
Peasant as a choice wherever the Open is: the **four-day Convocation's two Constructed days** (either may be Peasant), **the five-round Constructed event**, and the single match's deck categories (a Peasant list category). The format's name and its one-line explanation on the chooser. The field's seat draw by the Peasant match table; the cap stands.

## Part 5 — The stalemate probe (ADR-167)
From the recorded tables: every game drawn at the turn limit — which lists, what the board was (deathtouch and lifelink blockers that will not attack each other), who was ahead on cards and life. The candidate rule, to be confirmed by the probe: when neither side has attacked for N turns (N by the probe), the side ahead on cards races — attacks with everything the attack sim calls a trade or better, and the evaluator stops pricing a chump as a loss. Measure on the Tollgate's pairings and the Peasant black mirrors; the ladder.

## Part 6 — Text
- The door: *"Peasant — tier two and below. No power, no legends; sixty cards, four of a kind."*
- The format's seed list names in the plane's register follow when the seeds settle (working names until then).

## Handoff
The format switch; the ten cards and their cast rates; the seeds and the Peasant tables; the rating; the door walked (a five-round Peasant event; a four-day Convocation with a Peasant day); the stalemate probe and its rule if one measured; deviations, concerns — and the implementer's read for the next format family (the triads, now that lists are a parameter).
