# Handoff — after Session 30 (2026-09-06)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 30 — **the mages after the sweep** — is done: six cards for the floor (ADR-104; pool 184 → 190; R-093: search-to-graveyard "up to N", a graveyard-zone ability that returns itself, `tapped` on a graveyard return; defender excluded from the AI's race sums), nine lists amended exactly as the brief gave them (ADR-105; no substitutions), the sweep re-run in full with a delta column against S29 and **per-card cast counts** (no card in any of the fifteen went uncast), the starter round-robin, the Elemental token plate (provisional), the gallery gate made production-only (Chris's observation). Pool 190 cards (203 defs with tokens and test cards); `docs/reference/` regenerated.

## Done this session

- **Part 0**: `docs/decision-updates/s30.md` — ADR-103/104/105 as given, with the filing notes (Thought Scour's first printing is Dark Ascension, not Innistrad; Wood Elves from Portal).
- **Part 1 (R-093)**: `searchLibrary` widened (`to: "graveyard"`, `count` for "up to N" with one logged pick per card and an early decline, the `creatureCard` predicate); a graveyard-zone activated ability may RETURN ITSELF to the battlefield (the A5 shape widened beside Mother Bear's exile-self; the card stays in the yard until resolution; the enumerator offers it from the graveyard only); `returnFromGraveyard.tapped`. `defender` was already a keyword gating attackers; the AI's race-risk sum, the Witch's life gate and the evaluator's deterrence set now exclude defenders. Wood Elves, Wall of Blossoms, Wall of Air and Thought Scour rode existing words.
- **Part 2**: the six defs from Scryfall verbatim (re-verified by curl; two printings differ from the brief: Thought Scour DKA 2012, and `art:fetch` took the Skeleton's art from its oldest printing, Archenemy 2010, while the def's id is M12's); tiers/prices per the brief (priceOverride where the formula differs); nine lists amended and validated (every id; 40 / 17 / 23 each).
- **Part 3 (AI; books 41–44; the FUZZ_FULL ladder gate held, the vs-random ladder PASS)**: Thought Scour at the opponent (the mill pricing's sign); Buried Alive only with a reanimator in hand (Zombify, Unearth, the Usher's ETB) — the deck-still-holds-one half of the brief's rule is unknowable without peeking, so the hand decides; the Skeleton's return on the opponent's turn or when behind on creatures, never over a spell in hand the mana would cast; Pyroclasm weighs the caster's own Pyromancer and Elementals through the board-damage prediction; Wood Elves takes the dual when one of its colours is wanted (the search chooser scores a land by its best colour need, duals win ties).
- **Part 4**: seven fixtures — Wood Elves fetches a Breeding Pool UNTAPPED and the Crab sees it; Wall of Blossoms draws and is never an eligible attacker; Wall of Air blocks a flier and never attacks; Buried Alive takes two of "up to three" when two creatures remain and asks no third time; the Skeleton returns tapped, from the graveyard only (the hand copy offers nothing), and is a legal Unearth target; Thought Scour self and opponent; Pyroclasm kills the caster's own Elementals. Fuzz first: the fifteen amended decks at the full tier (720 games, both seats, replays byte-exact).
- **Part 5**: `pnpm mage-sweep` grew `--baseline` (a delta column; the S29 run ships as `packages/world/src/sweep-baselines/s29.json`), per-deck cast counts from `facts.spellsCast` with a never-cast list, and part 4 (the starters against each other). Full run: 7,500 games. Tables in Concerns 1.
- **Part 6**: the Pyromancer's 1/1 red Elemental has a plate (`token-elemental-red`, provisional — Chris to verdict); the epithet stays off the duel rail.
- **Chris's observation**: the gallery's progressive reveal is production-only now — the dev server (and `?dev=1`) sees every card; verified live (203/203, the Lotus and the Manafleur in view, no "not yet encountered" tally).

## Playtest round 7 (deploy playtest r5 — Chris, 2026-09-07: the autosave hit the browser's quota)

**The bug**: at a stronghold door late in a run, "QuotaExceededError … 'shandalar-world-save' exceeded the quota" on every click and nothing happened. Every `DuelRecord` carried its full replay log (`saved`, ~100 KB each), pretty-printed — forty duels put the save past localStorage's ~5 MB, and the thrown error aborted the click's handler before the screen changed. **The fix (three layers)**: (1) only the last **six** duels keep their replay log (`DUEL_LOGS_KEPT`; the rail's "Recent duels" offers exactly those) — trimmed at `recordDuel` and again on load (`deserializeWorld`), so Chris's existing bloated save shrinks the moment the deploy loads it; older records keep their outcome and stakes, the rail shows "(log dropped)" in place of the replay link; (2) the storage copy is written COMPACT (the download stays pretty); (3) the autosave never throws: on a quota error it trims to one log, then none, retrying each time, and if the bare journey still will not fit it notices "Autosave failed — download your save" and the game goes on. Tests: the trim at record and at load, compact round-trips; a capped storage that throws the browser's `QuotaExceededError` — the save lands with the logs gone and the click never dies. **Chris's stuck game recovers on the next deploy** (load → trim → the next autosave fits); nothing to redo.

**Also (Chris, same day): `docs/reference/starters.md`** — the five starting decks as a standing page beside enemies.md (generated by `pnpm reference`, sync-tested): each decklist with its stats and curve, the refill basic, the easy/hard adjustments, and the new-game constants (life, gold, spares, ante). The starter round-robin stays a measurement in the S30 handoff section (`pnpm mage-sweep --part 4`).

## Deviations from the brief

1. **Thought Scour encoded from Dark Ascension** (its first printing; the brief said Innistrad). **The Skeleton's art is Archenemy's** (`art:fetch` resolves the oldest high-resolution printing by name; the def's `scryfallId` is M12's as the brief named) — say if the M12 art is wanted (a one-flag change to the fetch).
2. **Buried Alive's gate reads the hand only** (a reanimator in hand), not "or the deck still holds one" — the AI cannot know its library without peeking; with three Zombify, two Unearth and Resto in Corvane's forty the hand condition fires often enough (Buried Alive cast 0.30 per game across 600 games).
3. **The Skeleton's "mana to spare" reads the turn's castables**, not a plan: hold on our own turn while a nonland card in hand could be cast with the mana the return would take; return freely on the opponent's turn or when behind on creatures.
4. **The gallery's deck filter still lists A–E** (it is a dev tool; the mages could join it — a small).

## Concerns

1. **The sweep (100 games per pairing, both seats; mages at the tier's profile and life — 8/10/12; starters at 10 life piloted at journeyman; beasts at their catalog life/profile; Δ = A's win % against the S29 run):**

## 1. Tier by tier

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S29 |
|---|---|---|---|---|---|---|---|
| T1 | Sister Oriel (oriel) | Tessaly Reed (tessaly) | 68% | 32% (97% by library) | 0 | 13.4 | -6 |
| T1 | Sister Oriel (oriel) | Pale Edric (edric) | 61% | 39% (3% by library) | 0 | 16.6 | -17 |
| T1 | Sister Oriel (oriel) | Brann the Scorched (brann) | 74% | 26% | 0 | 12.8 | +0 |
| T1 | Sister Oriel (oriel) | Old Hask (hask) | 73% | 27% | 0 | 11.2 | +4 |
| T1 | Tessaly Reed (tessaly) | Pale Edric (edric) | 14% (100% by library) | 86% | 0 | 13.6 | -17 |
| T1 | Tessaly Reed (tessaly) | Brann the Scorched (brann) | 23% (78% by library) | 77% | 0 | 13.7 | +4 |
| T1 | Tessaly Reed (tessaly) | Old Hask (hask) | 26% (92% by library) | 74% | 0 | 12.0 | +5 |
| T1 | Pale Edric (edric) | Brann the Scorched (brann) | 60% | 40% | 0 | 12.8 | +14 |
| T1 | Pale Edric (edric) | Old Hask (hask) | 67% | 33% | 0 | 12.8 | +20 |
| T1 | Brann the Scorched (brann) | Old Hask (hask) | 55% | 45% | 0 | 9.9 | +5 |
| T2 | Mistress Vael (vael) | Kessa Emberhand (kessa) | 62% | 38% | 0 | 19.2 | -3 |
| T2 | Mistress Vael (vael) | Adept Maelin (maelin) | 68% (3% by library) | 32% (3% by library) | 0 | 18.2 | +1 |
| T2 | Mistress Vael (vael) | Brennor of the Glade (brennor) | 65% | 35% | 0 | 19.0 | +0 |
| T2 | Mistress Vael (vael) | Pell of the Shallows (pell) | 81% (1% by library) | 19% (100% by library) | 0 | 16.1 | -8 |
| T2 | Kessa Emberhand (kessa) | Adept Maelin (maelin) | 39% | 61% | 0 | 14.9 | -2 |
| T2 | Kessa Emberhand (kessa) | Brennor of the Glade (brennor) | 35% | 65% | 0 | 12.8 | -4 |
| T2 | Kessa Emberhand (kessa) | Pell of the Shallows (pell) | 81% | 19% (84% by library) | 0 | 16.3 | +10 |
| T2 | Adept Maelin (maelin) | Brennor of the Glade (brennor) | 46% | 54% | 0 | 13.4 | -9 |
| T2 | Adept Maelin (maelin) | Pell of the Shallows (pell) | 86% | 14% (71% by library) | 0 | 15.1 | +4 |
| T2 | Brennor of the Glade (brennor) | Pell of the Shallows (pell) | 79% | 21% (95% by library) | 0 | 14.2 | +1 |
| T3 | Lord Corvane (corvane) | Varro Flamebrand (varro) | 64% | 36% (28% by library) | 0 | 17.0 | -13 |
| T3 | Lord Corvane (corvane) | High Warden Sorrel (sorrel) | 57% | 43% | 0 | 16.4 | -14 |
| T3 | Lord Corvane (corvane) | Thornmother Ysolde (ysolde) | 28% | 72% | 0 | 12.0 | -13 |
| T3 | Lord Corvane (corvane) | Magister Quill (quill) | 53% | 47% (36% by library) | 0 | 14.3 | -21 |
| T3 | Varro Flamebrand (varro) | High Warden Sorrel (sorrel) | 51% (6% by library) | 49% | 0 | 18.3 | +0 |
| T3 | Varro Flamebrand (varro) | Thornmother Ysolde (ysolde) | 30% (7% by library) | 70% | 0 | 13.8 | +0 |
| T3 | Varro Flamebrand (varro) | Magister Quill (quill) | 49% (22% by library) | 51% (24% by library) | 0 | 16.5 | -7 |
| T3 | High Warden Sorrel (sorrel) | Thornmother Ysolde (ysolde) | 34% | 66% | 0 | 12.6 | +0 |
| T3 | High Warden Sorrel (sorrel) | Magister Quill (quill) | 68% | 32% (6% by library) | 0 | 14.3 | -4 |
| T3 | Thornmother Ysolde (ysolde) | Magister Quill (quill) | 76% | 24% (17% by library) | 0 | 11.4 | -8 |

## 2. Teachers vs starters (tier-1 mages at 8 / apprentice; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S29 |
|---|---|---|---|---|---|---|---|
| T1×starter | Sister Oriel (oriel) | starter:white | 44% | 56% | 0 | 14.9 | +0 |
| T1×starter | Sister Oriel (oriel) | starter:blue | 77% (9% by library) | 23% | 0 | 20.2 | +0 |
| T1×starter | Sister Oriel (oriel) | starter:black | 57% (5% by library) | 43% | 0 | 19.4 | +0 |
| T1×starter | Sister Oriel (oriel) | starter:red | 59% | 41% | 0 | 12.8 | +0 |
| T1×starter | Sister Oriel (oriel) | starter:green | 70% | 30% | 0 | 12.8 | +0 |
| T1×starter | Tessaly Reed (tessaly) | starter:white | 16% (100% by library) | 84% | 0 | 10.1 | +6 |
| T1×starter | Tessaly Reed (tessaly) | starter:blue | 55% (100% by library) | 45% | 0 | 13.0 | -1 |
| T1×starter | Tessaly Reed (tessaly) | starter:black | 24% (100% by library) | 76% | 0 | 12.3 | +1 |
| T1×starter | Tessaly Reed (tessaly) | starter:red | 32% (100% by library) | 68% | 0 | 11.4 | +2 |
| T1×starter | Tessaly Reed (tessaly) | starter:green | 37% (100% by library) | 63% | 0 | 11.2 | +2 |
| T1×starter | Pale Edric (edric) | starter:white | 14% | 86% | 0 | 12.1 | +10 |
| T1×starter | Pale Edric (edric) | starter:blue | 43% | 57% | 0 | 14.9 | +18 |
| T1×starter | Pale Edric (edric) | starter:black | 61% (23% by library) | 39% | 0 | 23.7 | +39 |
| T1×starter | Pale Edric (edric) | starter:red | 49% | 51% | 0 | 13.0 | +22 |
| T1×starter | Pale Edric (edric) | starter:green | 56% | 44% | 0 | 14.7 | +24 |
| T1×starter | Brann the Scorched (brann) | starter:white | 30% | 70% | 0 | 12.3 | +10 |
| T1×starter | Brann the Scorched (brann) | starter:blue | 61% | 39% | 0 | 13.2 | -4 |
| T1×starter | Brann the Scorched (brann) | starter:black | 35% | 65% | 0 | 13.8 | -1 |
| T1×starter | Brann the Scorched (brann) | starter:red | 32% | 68% | 0 | 10.5 | -1 |
| T1×starter | Brann the Scorched (brann) | starter:green | 31% | 69% | 0 | 12.7 | +1 |
| T1×starter | Old Hask (hask) | starter:white | 21% | 79% | 0 | 9.9 | -3 |
| T1×starter | Old Hask (hask) | starter:blue | 68% | 32% | 0 | 11.3 | -7 |
| T1×starter | Old Hask (hask) | starter:black | 17% | 83% | 0 | 13.4 | -5 |
| T1×starter | Old Hask (hask) | starter:red | 33% | 67% | 0 | 11.6 | -5 |
| T1×starter | Old Hask (hask) | starter:green | 38% | 62% | 0 | 13.1 | -2 |

## 4. The starters against each other (journeyman at 10; a read on the five roads)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S29 |
|---|---|---|---|---|---|---|---|
| starters | starter:white | starter:blue | 80% | 20% | 0 | 13.6 | — |
| starters | starter:white | starter:black | 65% | 35% | 0 | 14.9 | — |
| starters | starter:white | starter:red | 67% | 33% | 0 | 12.3 | — |
| starters | starter:white | starter:green | 86% | 14% | 0 | 12.9 | — |
| starters | starter:blue | starter:black | 37% | 63% | 0 | 17.2 | — |
| starters | starter:blue | starter:red | 38% | 62% | 0 | 11.6 | — |
| starters | starter:blue | starter:green | 62% | 38% | 0 | 14.1 | — |
| starters | starter:black | starter:red | 56% | 44% (2% by library) | 0 | 16.0 | — |
| starters | starter:black | starter:green | 77% (1% by library) | 23% | 0 | 16.5 | — |
| starters | starter:red | starter:green | 39% | 61% | 0 | 12.8 | — |

## 3. Children vs parents (parent mage at tier-1 settings; parent beast at its own)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S29 |
|---|---|---|---|---|---|---|---|
| T2×parent | Mistress Vael (vael) | Sister Oriel (oriel) | 53% | 47% | 0 | 22.6 | +0 |
| T2×parent | Mistress Vael (vael) | Pale Edric (edric) | 57% (2% by library) | 43% | 0 | 23.4 | -21 |
| T2×parent | Kessa Emberhand (kessa) | Brann the Scorched (brann) | 37% | 63% | 0 | 12.6 | -6 |
| T2×parent | Kessa Emberhand (kessa) | A Bloom of Man-o'-War (beast:manowar) | 72% | 28% | 0 | 17.3 | -3 |
| T2×parent | Adept Maelin (maelin) | Pale Edric (edric) | 35% | 65% | 0 | 15.3 | -22 |
| T2×parent | Adept Maelin (maelin) | The Boggart Warband (beast:warband) | 33% | 67% | 0 | 10.2 | +1 |
| T2×parent | Brennor of the Glade (brennor) | Old Hask (hask) | 58% | 42% | 0 | 12.2 | +4 |
| T2×parent | Brennor of the Glade (brennor) | Sister Oriel (oriel) | 36% | 64% | 0 | 14.6 | +0 |
| T2×parent | Pell of the Shallows (pell) | Tessaly Reed (tessaly) | 35% (91% by library) | 65% (97% by library) | 0 | 14.9 | -20 |
| T2×parent | Pell of the Shallows (pell) | Old Hask (hask) | 25% (64% by library) | 75% (1% by library) | 0 | 12.9 | +7 |
| T3×parent | Lord Corvane (corvane) | Pale Edric (edric) | 62% | 38% | 0 | 16.4 | -24 |
| T3×parent | Lord Corvane (corvane) | The Serra Angel (beast:serra) | 7% | 93% | 0 | 17.1 | -7 |
| T3×parent | Varro Flamebrand (varro) | Tessaly Reed (tessaly) | 80% (14% by library) | 20% (95% by library) | 0 | 14.0 | +3 |
| T3×parent | Varro Flamebrand (varro) | Brann the Scorched (brann) | 64% | 36% | 0 | 13.7 | +1 |
| T3×parent | High Warden Sorrel (sorrel) | Brann the Scorched (brann) | 59% | 41% | 0 | 14.1 | +1 |
| T3×parent | High Warden Sorrel (sorrel) | The Hypnotic Specter (beast:specter) | 53% (4% by library) | 47% | 0 | 16.4 | +0 |
| T3×parent | Thornmother Ysolde (ysolde) | Old Hask (hask) | 68% | 32% | 0 | 10.3 | +7 |
| T3×parent | Thornmother Ysolde (ysolde) | A Savannah Lion (beast:lion) | 54% | 46% | 0 | 12.1 | +0 |
| T3×parent | Magister Quill (quill) | Tessaly Reed (tessaly) | 51% (37% by library) | 49% (100% by library) | 0 | 14.1 | -9 |
| T3×parent | Magister Quill (quill) | The Pelakka Wurm (beast:wurm) | 29% (69% by library) | 71% | 0 | 13.3 | +11 |


   **The reads the planner asked for.**
   - **Tessaly and Edric against their targets.** Edric moved the most of any deck: **+39 against the black starter (61%)**, +22 red (49%), +24 green (56%), +18 blue (43%) — Nighthawks, Skeletons and four Rats turned recursion at 8 life into a fight. Against the WHITE starter he is still 14% (+10) — Dawn Levy's curve outruns him before the yard matters. So: black in the band's upper half and beyond, white not. **Tessaly is unchanged against the field** (16 / 55 / 24 / 32 / 37 — deltas within noise): the Walls and Scours did not buy the turns; she sits in the 35–45% band only against green (37%) and beats only blue (55%, all by library). Every Tessaly win is by library (100%).
   - **Pell and Quill by not dying.** Quill: yes — his wins are now 6–37% by library against the tier and 69% against the Wurm; the rest are the Wurms killing (Pelakka cast 0.15/game, Gaean 0.62). Pell: no — 64–100% of his wins are still by library, and he still folds (14–25% within the tier; 25% against Hask, 35% against Tessaly). **Pell is the deck the amendments did not reach.**
   - **Corvane against the Serra Angel: 7% (−7).** The Buried Alive build cast Buried Alive 0.30/game and Zombify 0.19/copy — the engine turns too rarely to matter against a 12-life master beast with three Serras of its own; Corvane also fell −13 to −24 against the whole tier (the two removal spells he lost mattered more than the reanimation he gained).
   - **New folds inside a tier (over 80/20 that S29 did not have)**: **Tessaly–Edric 14/86** (was 31/69 — Edric's gain is Tessaly's loss); **Kessa–Pell 81/19** (was 71/29). Standing folds: Vael–Pell 81/19, Maelin–Pell 86/14. No fold left the table.
   - **The starters' spread**: **the white starter dominates the five roads** — 80% over blue, 65% black, 67% red, 86% green; black second (63% over blue, 56% red, 77% green); blue and green are the weak roads (green loses every pairing but red's 61%). A read for S31, as the brief says; no change made.
   - **Cast counts**: nothing in any list went uncast across 600–1,200 games per deck. The least-cast cards per copy are the reactive and the expensive: counterspells (0.16–0.26 per copy — Tessaly, Kessa, Pell, Varro, Quill), Zombify/Unearth in the recursion decks (0.15–0.34), Pyroclasm 0.14, Hymn 0.15, Buried Alive 0.15, the Serra in Ysolde 0.15, Pelakka 0.15, the Siege-Gang 0.20. The cast lines are below.

## Cast counts per mage (every game the deck played in this run; casts per game in brackets; NEVER CAST listed)

- **Sister Oriel (oriel)** — 1100 games — Soul Warden ×4: 1638 (1.49) · Suntail Hawk ×3: 1233 (1.12) · Youthful Valkyrie ×3: 1243 (1.13) · Inspiring Overseer ×2: 774 (0.70) · Master Decoy ×2: 772 (0.70) · Spirit Link ×2: 782 (0.71) · Pacifism ×2: 688 (0.63) · Raise the Alarm ×2: 795 (0.72) · Swords to Plowshares ×1: 386 (0.35) · Glorious Anthem ×1: 309 (0.28) · Restoration Angel ×1: 339 (0.31)
- **Tessaly Reed (tessaly)** — 1200 games — Hedron Crab ×4: 1584 (1.32) · Cathartic Adept ×4: 1596 (1.33) · Traumatizer ×2: 609 (0.51) · Thought Scour ×2: 879 (0.73) · Brainstorm ×2: 745 (0.62) · Wall of Air ×2: 729 (0.61) · Essence Scatter ×2: 455 (0.38) · Counterspell ×2: 540 (0.45) · Boomerang ×1: 403 (0.34) · Altar of Dementia ×2: 730 (0.61)
- **Pale Edric (edric)** — 1200 games — Unearth ×3: 899 (0.75) · Zombify ×1: 182 (0.15) · Gravedigger ×2: 588 (0.49) · Vampire Nighthawk ×2: 772 (0.64) · Blood Artist ×2: 660 (0.55) · Indulgent Aristocrat ×2: 980 (0.82) · Reassembling Skeleton ×2: 801 (0.67) · Child of Night ×2: 837 (0.70) · Typhoid Rats ×4: 1860 (1.55) · Terror ×2: 682 (0.57) · Dark Ritual ×1: 296 (0.25)
- **Brann the Scorched (brann)** — 1200 games — Young Pyromancer ×3: 970 (0.81) · Arc Mage ×2: 526 (0.44) · Lightning Bolt ×3: 1120 (0.93) · Shock ×3: 1138 (0.95) · Abrade ×2: 647 (0.54) · Blaze ×2: 614 (0.51) · Brute Force ×2: 520 (0.43) · Hordeling Outburst ×2: 439 (0.37) · Goblin Piker ×2: 637 (0.53) · Thundersnake ×1: 307 (0.26) · Pyroclasm ×1: 174 (0.14)
- **Old Hask (hask)** — 1200 games — Gladecover Scout ×4: 1477 (1.23) · Blurred Mongoose ×3: 972 (0.81) · Birds of Paradise ×2: 704 (0.59) · Rancor ×3: 1211 (1.01) · Blanchwood Armor ×3: 730 (0.61) · Timberland Guide ×2: 740 (0.62) · Giant Growth ×3: 911 (0.76) · Prey Upon ×2: 592 (0.49) · Wall of Blossoms ×2: 582 (0.48)
- **Mistress Vael (vael)** — 600 games — Soul Warden ×3: 782 (1.30) · Suntail Hawk ×2: 487 (0.81) · Youthful Valkyrie ×2: 483 (0.81) · Child of Night ×2: 440 (0.73) · Vampire Nighthawk ×2: 493 (0.82) · Blood Artist ×2: 470 (0.78) · Indulgent Aristocrat ×2: 496 (0.83) · Spirit Link ×2: 485 (0.81) · Unearth ×2: 414 (0.69) · Gravedigger ×1: 196 (0.33) · Swords to Plowshares ×1: 224 (0.37) · Pacifism ×1: 219 (0.36) · Wrath of God ×1: 165 (0.28)
- **Kessa Emberhand (kessa)** — 600 games — Young Pyromancer ×3: 687 (1.15) · Arc Mage ×3: 574 (0.96) · Man-o'-War ×2: 503 (0.84) · Lightning Bolt ×3: 666 (1.11) · Shock ×2: 439 (0.73) · Blaze ×1: 172 (0.29) · Hordeling Outburst ×1: 132 (0.22) · Brainstorm ×3: 523 (0.87) · Boomerang ×2: 332 (0.55) · Essence Scatter ×2: 210 (0.35) · Counterspell ×1: 97 (0.16)
- **Adept Maelin (maelin)** — 600 games — Skirk Prospector ×2: 409 (0.68) · Goblin Piker ×2: 419 (0.70) · Hordeling Outburst ×2: 292 (0.49) · Goblin Grenade ×2: 240 (0.40) · Indulgent Aristocrat ×2: 417 (0.69) · Blood Artist ×2: 377 (0.63) · Unearth ×2: 290 (0.48) · Gravedigger ×2: 338 (0.56) · Gallows Djinn ×1: 165 (0.28) · Dark Ritual ×1: 147 (0.24) · Lightning Bolt ×1: 188 (0.31) · Terror ×1: 161 (0.27) · Siege-Gang Commander ×1: 123 (0.20) · Typhoid Rats ×2: 429 (0.71)
- **Brennor of the Glade (brennor)** — 600 games — Gladecover Scout ×3: 576 (0.96) · Blurred Mongoose ×2: 376 (0.63) · Birds of Paradise ×2: 380 (0.63) · Soul Warden ×2: 351 (0.58) · Youthful Valkyrie ×2: 417 (0.69) · Rancor ×2: 536 (0.89) · Blanchwood Armor ×2: 336 (0.56) · Spirit Link ×2: 369 (0.61) · Giant Growth ×2: 343 (0.57) · Glorious Anthem ×1: 150 (0.25) · Swords to Plowshares ×1: 191 (0.32) · Pacifism ×1: 176 (0.29) · Restoration Angel ×1: 150 (0.25)
- **Pell of the Shallows (pell)** — 600 games — Hedron Crab ×4: 862 (1.44) · Traumatizer ×2: 409 (0.68) · Rampant Growth ×4: 659 (1.10) · Wood Elves ×2: 446 (0.74) · Wall of Blossoms ×2: 432 (0.72) · Birds of Paradise ×2: 448 (0.75) · Brainstorm ×2: 443 (0.74) · Essence Scatter ×2: 303 (0.51) · Counterspell ×1: 146 (0.24) · Altar of Dementia ×2: 379 (0.63)
- **Lord Corvane (corvane)** — 600 games — Youthful Valkyrie ×2: 448 (0.75) · Inspiring Overseer ×1: 195 (0.33) · Indulgent Aristocrat ×2: 465 (0.78) · Blood Artist ×2: 388 (0.65) · Gravedigger ×1: 156 (0.26) · Unearth ×2: 286 (0.48) · Zombify ×3: 333 (0.56) · Buried Alive ×2: 181 (0.30) · Restoration Angel ×1: 204 (0.34) · Serra Angel ×3: 467 (0.78) · Swords to Plowshares ×2: 394 (0.66) · Dark Ritual ×2: 359 (0.60)
- **Varro Flamebrand (varro)** — 600 games — Hedron Crab ×3: 581 (0.97) · Young Pyromancer ×2: 428 (0.71) · Arc Mage ×2: 370 (0.62) · Traumatizer ×2: 270 (0.45) · Lightning Bolt ×3: 685 (1.14) · Shock ×2: 446 (0.74) · Blaze ×1: 170 (0.28) · Brainstorm ×2: 392 (0.65) · Divination ×1: 161 (0.27) · Boomerang ×2: 230 (0.38) · Counterspell ×1: 114 (0.19) · Essence Scatter ×1: 132 (0.22) · Faerie Formation ×1: 132 (0.22)
- **High Warden Sorrel (sorrel)** — 600 games — Young Pyromancer ×3: 546 (0.91) · Arc Mage ×2: 342 (0.57) · Hypnotic Specter ×2: 261 (0.43) · Hymn to Tourach ×1: 88 (0.15) · Duress ×2: 280 (0.47) · Mind Rot ×2: 219 (0.36) · Lightning Bolt ×3: 608 (1.01) · Shock ×2: 427 (0.71) · Blaze ×1: 167 (0.28) · Terror ×2: 289 (0.48) · Vampire Nighthawk ×1: 170 (0.28) · Dark Ritual ×1: 131 (0.22) · Unearth ×1: 116 (0.19)
- **Thornmother Ysolde (ysolde)** — 600 games — Savannah Lions ×2: 332 (0.55) · Suntail Hawk ×2: 369 (0.61) · Fencing Ace ×2: 332 (0.55) · Gladecover Scout ×2: 336 (0.56) · Blurred Mongoose ×2: 343 (0.57) · Birds of Paradise ×2: 357 (0.59) · Raise the Alarm ×2: 346 (0.58) · Glorious Anthem ×2: 274 (0.46) · Rancor ×2: 468 (0.78) · Blanchwood Armor ×2: 279 (0.47) · Giant Growth ×1: 142 (0.24) · Swords to Plowshares ×1: 184 (0.31) · Serra Angel ×1: 88 (0.15)
- **Magister Quill (quill)** — 600 games — Hedron Crab ×4: 665 (1.11) · Rampant Growth ×3: 381 (0.64) · Llanowar Elves ×2: 382 (0.64) · Wood Elves ×2: 416 (0.69) · Wall of Blossoms ×2: 436 (0.73) · Gaean Wurm ×2: 374 (0.62) · Pelakka Wurm ×1: 92 (0.15) · Baru, Wurmspeaker ×1: 204 (0.34) · Altar of Dementia ×2: 368 (0.61) · Essence Scatter ×2: 263 (0.44) · Counterspell ×1: 129 (0.21) · Brainstorm ×1: 154 (0.26)

2. **Pell needs a design answer, not a tune**: with four Crabs, four Rampant Growths, Wood Elves and Wilds he mills ~3 per land but never closes before a 10-life journeyman opponent does; his Altar (×2) is the only finisher and he holds no body big enough to sacrifice for the last cards. Either he becomes a ramp deck that mills incidentally (a Wurm-class top end), or a mill deck with a second finisher.
3. **Tessaly's floor did not move** — the Walls hold the ground but the library clock is unchanged: 4 Crabs + 4 Adepts + 2 Traumatizers is the same eleven-trigger clock. If the tier-1 blue mage is to teach "your library is a clock", she may need to win more of her races by the clock's design (Traumatizer ×3 back?) or teach it while losing, which ADR-103 permits.
4. **Corvane's reanimation engine fires too rarely** to justify what it cost him (two removal spells); the honest fixes are more Buried Alive (three) or the Terror back.
5. **The Elemental token plate** is provisional (my descriptor); the contact-sheet review is one image.

## Registry entries added/changed

R-093. Pool-registry: Session 30 section (+6; the amendment note); printings regenerated. ADRs 103–105 in `docs/decision-updates/s30.md`. Knobs unchanged. Engine: `searchLibrary` +`to: graveyard`, +`count`, +`creatureCard`; `returnFromGraveyard` +`tapped`; the validator's graveyard-zone rule widened. AI: books 41–44. Sim: `mage-decks.ts` amended; `mage-sweep` +`--baseline`, +cast counts, +part 4; `sweep-baselines/s29.json`. Art: `token-elemental-red` (MANIFEST). UI: the gallery gate production-only. `docs/reference/` regenerated.

## Test status

Playtest round 7: default tier **539 passed / 2 skipped** (+2 quota tests). S30 close: default tier **537 passed / 2 skipped** (51 files; +7 S30 fixtures, +1 book pin; baselines: the loader's def count 197 → 203, the shop-tier counts 65/50 → 70/51). `pnpm typecheck` clean. **Fuzz-before-fixtures honoured**: the amended fifteen at the full tier (720 games, both seats, replays byte-exact) before the S30 fixtures. **The FUZZ_FULL ladder gate held** (every mirror cell > 40%, overall majority, zero surprises) and the 100/cell vs-random ladder PASSES. Sweep: 7,500 games. Browser: the dev gallery shows 203/203 with the prizeOnly cards in view.

## Suggested next

1. **Chris**: the token plate verdict; the Skeleton's art (Archenemy vs M12); the Chronicle's phase-two tease (⚠ still unruled — kept after "A cutting from every colour." as implemented).
2. **Planner (S31)**: Pell's identity (concern 2); Tessaly's clock (3); Corvane's engine (4); the starters' spread (white walls the roads; green and blue fold) — the round-robin says the five roads are not five equal roads.
3. **Implementer smalls**: the gallery's deck filter on the mages; `--part` for the cast counts alone.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--part 1|2|3|4] [--baseline none]   # ~3 min; the delta column reads sweep-baselines/s29.json
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /gallery (dev: every card) · /play → any mage vs any mage
```
