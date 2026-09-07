# Handoff — after Session 31 (2026-09-07)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 31 — **the Traumatizer, the Artisan, Pell and Corvane, and the five roads** — is done: the Traumatizer retexted as the archetype anchor (ADR-107; R-094: the controller-wide creature trigger on the existing damage collectors, `who: eventPlayer`), Artisan of Kozilek and Grazing Gladehart in the pool (ADR-108; pool 190 → 192; R-094: the edict sacrifice word — annihilator — and the stack-zone "when you cast" trigger), Tessaly / Pell / Corvane / Quill amended as the brief gave them, the five starters amended per ADR-106, sweep part 5 (tier-2/3 mages vs the starters) with the S30 baseline, and the full sweep re-run (13,500 games). Two AI corrections the measurement forced (books 47–48: Buried Alive's picks and Zombify's targets were not aiming at the Artisan) — see Deviations. Playtest round 6 (Chris's four notes + the Traumatizer's v3 render) shipped at the start of the session. Pool 192 cards (205 defs with tokens and test cards); `docs/reference/` regenerated.

## Done this session

- **Playtest r6 (Chris, 2026-09-07)**: the opponent's Brainstorm put-backs are hidden in the log ("Puts a card on top of their library" — the bottoming rule); the Quests panel shows every quest by default (the clocked-only toggle is offered whenever there is something to filter and stays visible while on; a filter with nothing clocked is ignored rather than emptying the panel — the r1 filter could be left on from an earlier run with its checkbox hidden); "Resume walk" is followed by a **"Walk there (N steps)"** button in the same rail spot (any standing preview walks from it; +1 controller test); the gallery defaults to the as-printed frames (both the grid checkbox and the inspector); the Traumatizer's v3 as-printed render (the S31 text, verified word-for-word) installed. Committed separately (2f3b30a).
- **Part 0**: `docs/decision-updates/s31.md` — ADR-106/107/108 as given, the standing rulings, filing notes.
- **Part 1 (R-094 words 1–2)**: the two damage collectors read the condition's `controller` (the source's controller, relative to the observer) and `type` (the source's card types) beside S23's `source` — "whenever a creature you control deals damage to a player" is `{source: any, controller: you, type: [Creature], player: any}`; nothing Traumatizer-specific in the engine. `who: "eventPlayer"` ("that player mills") on the Who union, validator-confined to damage triggers. The def retexted (deals damage, not combat damage; the observer's own damage counts; copies additive). Six fixtures (the Adept's swing mills 2; a pinger's activation mills 2; two Traumatizers mill 8 not 16; a fight and a blocked Bears mill nothing; Giant Growth doubles it to 10; its own damage triggers it, the opponent's creatures never do); the three S23 fixtures still hold. AI (book 45; the FUZZ_FULL ladder gate held, the vs-random ladder PASS): the attack planner prices every point of combat damage on the S29 mill curve (`millValue`, factored into the evaluator so the attack planner and the ability predictor share it; an attack that empties the library +200), Arc Mage's ping prices the same way, the evaluator carries an engine term (per-damage mill × the side's attacking power × 0.3) so the Traumatizer is cast ahead of a second Crab and a Terror at it is countered.
- **Part 2 (R-094 words 3–4)**: the **edict sacrifice** `{type: sacrifice, who, count, predicate}` beside the S23 self form — the stated player picks one at a time (`chooseSacrifice` carrying the resolving ability as source; a lone candidate forced), the picks leave together (`moveBatchToGraveyard`, CR 701.17); annihilator 2 = an ATTACKS trigger at who:opponent. The **stack-zone cast trigger** (`zone: "stack"`, SPELL_CAST, source self): the SPELL_CAST event carries the stack object's id and the cast card's own trigger pends with it as source, above the spell (603.3). Artisan of Kozilek (ROE, R, 100g by the R formula) and Grazing Gladehart (ZEN, T1/12g) from Scryfall verbatim, re-verified by curl; five Artisan fixtures (the Serra returns under a countered Artisan; the plain hard-cast pends no trigger with an empty yard; annihilator with one permanent takes it before blockers; the defender's two logged picks leave together and the token stays; deathtouch Rats kill it), one Gladehart fixture (a land drop and a Wood Elves' fetched Forest each gain 2). AI (book 46): the Artisan attacks into Bears and lands, holds against untapped deathtouch Rats (the annihilator swing is worth the defender's two cheapest permanents plus a tempo half-point each); as the defender, tokens first and lands last; the cast trigger's target by the reanimation valuation.
- **Part 3**: the four lists amended exactly as given (Tessaly 40/18/22; Pell 40/17/23 — the pump-mill deck; Corvane 40/17/23; Quill −1 Wall +1 Traumatizer); Varro unchanged. Every id validated by the fuzz test.
- **Part 4**: `pnpm mage-sweep` grew part 5 (tier-2/3 mages vs the five starters) and the baseline defaults to `sweep-baselines/s30.json` (built from the S30 handoff's tables; the delta header names the baseline). Full run below.
- **Part 5**: the five roads amended per ADR-106 in `data/world/starters.json` (Dawn Levy −1 Swords −1 Tactician +1 Plains +1 Valkyrie; Tidal Grimoire −Raven −Fisher −1 Drake +2 Wall of Air +1 Brainstorm; Verdant Trail −2 Visionary −1 Guide +2 Rancor +1 Prey Upon; Ember Warband −1 Ogre +1 Bolt; Pallid Court unchanged); every easy/hard delta still legal (hard Dawn Levy removes its only Swords; hard Verdant keeps one Prey Upon); `starters.md` regenerated. Parts 2 and 4 re-run (tables below).
- **Fuzz before fixtures**: `s31-fuzz.test.ts` — the fifteen mages against a mage and a starter each, both seats, plus the starters' round-robin (720 + 120 games at the full tier), replays byte-exact — before any S31 fixture.

## Deviations from the brief

1. **Two AI corrections beyond the brief, forced by the measurement (books 47–48).** The first sweep's cast counts showed Buried Alive burying Gravediggers: the search chooser was the Tutor's ("castable soon" first), so the Artisan was picked 0.01/game. A `searchLibrary` request now carries the resolving effect as its source and a search **to the graveyard** takes the best reanimation target. Then a 400-game scratch measurement showed Zombify returning the Aristocrat as often as the Serra and the Artisan 0.06/game: the predictor priced every graveyard return at a flat 0.6, so every aim tied and softmax coin-flipped it (the S11 lesson). A targeted return is now worth its target (`reanimationWorth` — one valuation shared by the search chooser, the return predictor, the trigger-target chooser and the Artisan's cast credit). After both: Buried Alive takes the Artisan 0.19–0.28/game and the Serra 0.75–0.97, Zombify/Unearth return the Artisan 0.16–0.20/game. Both ladder gates re-run and held after each change. The planner should ratify or revert; the sweep below is with both in.
2. **The Artisan is priced by the R formula, no override (100g)** — "the duals are R at 10; the implementer aligns" read as "the same formula" (Scrubland 10, Demonic Tutor 30, Mystic Snake 50 all come from it). Say if 100 is wrong.
3. **`who: "eventPlayer"` is a small vocabulary widening the brief did not name.** "That player mills" needed an address; the alternative (`player: opponentOfController` + `who: opponent`) would have made a self-inflicted Arc Mage ping mill the wrong player. Confined like `eventDamage`.
4. **The cast trigger is a `zone: "stack"` trigger, not the Pyromancer's collector.** The brief called it "the Pyromancer's word"; that collector scans the battlefield and a spell being cast is not there yet. The SPELL_CAST event gained the stack object's id; the rest is the same event.
5. **Corvane's list dropped the Overseer and both Dark Rituals** — the brief's 23 nonland omit them and say "unchanged lands"; I followed the list. Concern 4 below suggests the Rituals were the turn-two Buried Alive.
6. **`spellsCast` cannot see reanimation** — the Artisan's 0.03 casts/game in the sweep are hard-casts; the engine's turn rate came from a scratch script (Deviation 1's numbers). A `facts.returned` (graveyard → battlefield by card) would make the sweep honest for reanimator decks — a small, not done.
7. **The annihilator's sacrifice dialog for the human seat is not browser-walked** — it rides the generic `chooseSacrifice` panel (the source card is the Artisan; the title is the generic one). Typechecked and fixture-covered on the engine side only.

## Concerns

1. **The sweep (100 games per pairing, both seats; mages at the tier's profile and life — 8/10/12; starters at 10 life piloted at journeyman; beasts at their catalog life/profile; Δ = A's win % against the S30 run; part 5 is new, no baseline):**

## 1. Tier by tier

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S30 |
|---|---|---|---|---|---|---|---|
| T1 | Sister Oriel (oriel) | Tessaly Reed (tessaly) | 75% | 25% (100% by library) | 0 | 12.7 | +7 |
| T1 | Sister Oriel (oriel) | Pale Edric (edric) | 61% | 39% | 0 | 16.3 | +0 |
| T1 | Sister Oriel (oriel) | Brann the Scorched (brann) | 74% | 26% | 0 | 12.8 | +0 |
| T1 | Sister Oriel (oriel) | Old Hask (hask) | 73% | 27% | 0 | 11.2 | +0 |
| T1 | Tessaly Reed (tessaly) | Pale Edric (edric) | 18% (100% by library) | 82% | 0 | 12.9 | +4 |
| T1 | Tessaly Reed (tessaly) | Brann the Scorched (brann) | 25% (84% by library) | 75% | 0 | 11.6 | +2 |
| T1 | Tessaly Reed (tessaly) | Old Hask (hask) | 23% (91% by library) | 77% | 0 | 11.2 | -3 |
| T1 | Pale Edric (edric) | Brann the Scorched (brann) | 59% | 41% | 0 | 12.7 | -1 |
| T1 | Pale Edric (edric) | Old Hask (hask) | 66% | 34% | 0 | 12.7 | -1 |
| T1 | Brann the Scorched (brann) | Old Hask (hask) | 55% | 45% | 0 | 9.9 | +0 |
| T2 | Mistress Vael (vael) | Kessa Emberhand (kessa) | 68% | 32% | 0 | 19.1 | +6 |
| T2 | Mistress Vael (vael) | Adept Maelin (maelin) | 65% | 35% | 0 | 16.9 | -3 |
| T2 | Mistress Vael (vael) | Brennor of the Glade (brennor) | 65% | 35% | 0 | 19.1 | +0 |
| T2 | Mistress Vael (vael) | Pell of the Shallows (pell) | 62% | 38% (84% by library) | 0 | 15.4 | -19 |
| T2 | Kessa Emberhand (kessa) | Adept Maelin (maelin) | 40% | 60% | 0 | 15.0 | +1 |
| T2 | Kessa Emberhand (kessa) | Brennor of the Glade (brennor) | 35% | 65% | 0 | 12.8 | +0 |
| T2 | Kessa Emberhand (kessa) | Pell of the Shallows (pell) | 61% | 39% (15% by library) | 0 | 13.5 | -20 |
| T2 | Adept Maelin (maelin) | Brennor of the Glade (brennor) | 46% | 54% | 0 | 13.3 | +0 |
| T2 | Adept Maelin (maelin) | Pell of the Shallows (pell) | 59% | 41% (41% by library) | 0 | 13.7 | -27 |
| T2 | Brennor of the Glade (brennor) | Pell of the Shallows (pell) | 61% | 39% (56% by library) | 0 | 13.1 | -18 |
| T3 | Lord Corvane (corvane) | Varro Flamebrand (varro) | 70% | 30% (30% by library) | 0 | 17.5 | +6 |
| T3 | Lord Corvane (corvane) | High Warden Sorrel (sorrel) | 51% | 49% | 0 | 17.1 | -6 |
| T3 | Lord Corvane (corvane) | Thornmother Ysolde (ysolde) | 25% | 75% | 0 | 12.2 | -3 |
| T3 | Lord Corvane (corvane) | Magister Quill (quill) | 53% | 47% (49% by library) | 0 | 15.8 | +0 |
| T3 | Varro Flamebrand (varro) | High Warden Sorrel (sorrel) | 53% (6% by library) | 47% | 0 | 17.7 | +2 |
| T3 | Varro Flamebrand (varro) | Thornmother Ysolde (ysolde) | 28% (7% by library) | 72% | 0 | 13.4 | -2 |
| T3 | Varro Flamebrand (varro) | Magister Quill (quill) | 47% (19% by library) | 53% (38% by library) | 0 | 16.1 | -2 |
| T3 | High Warden Sorrel (sorrel) | Thornmother Ysolde (ysolde) | 34% | 66% | 0 | 12.6 | +0 |
| T3 | High Warden Sorrel (sorrel) | Magister Quill (quill) | 68% | 32% (28% by library) | 0 | 14.1 | +0 |
| T3 | Thornmother Ysolde (ysolde) | Magister Quill (quill) | 75% | 25% (20% by library) | 0 | 11.3 | -1 |

## 2. Teachers vs starters (tier-1 mages at 8 / apprentice; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S30 |
|---|---|---|---|---|---|---|---|
| T1×starter | Sister Oriel (oriel) | starter:white | 49% | 51% | 0 | 16.1 | +5 |
| T1×starter | Sister Oriel (oriel) | starter:blue | 74% (11% by library) | 26% | 0 | 21.0 | -3 |
| T1×starter | Sister Oriel (oriel) | starter:black | 57% (5% by library) | 43% | 0 | 19.4 | +0 |
| T1×starter | Sister Oriel (oriel) | starter:red | 63% | 37% | 0 | 12.7 | +4 |
| T1×starter | Sister Oriel (oriel) | starter:green | 51% | 49% | 0 | 12.9 | -19 |
| T1×starter | Tessaly Reed (tessaly) | starter:white | 10% (100% by library) | 90% | 0 | 9.7 | -6 |
| T1×starter | Tessaly Reed (tessaly) | starter:blue | 67% (100% by library) | 33% | 0 | 13.5 | +12 |
| T1×starter | Tessaly Reed (tessaly) | starter:black | 31% (100% by library) | 69% | 0 | 12.0 | +7 |
| T1×starter | Tessaly Reed (tessaly) | starter:red | 24% (100% by library) | 76% | 0 | 10.3 | -8 |
| T1×starter | Tessaly Reed (tessaly) | starter:green | 22% (100% by library) | 78% | 0 | 10.2 | -15 |
| T1×starter | Pale Edric (edric) | starter:white | 23% | 77% | 0 | 13.1 | +9 |
| T1×starter | Pale Edric (edric) | starter:blue | 50% | 50% | 0 | 16.7 | +7 |
| T1×starter | Pale Edric (edric) | starter:black | 65% (20% by library) | 35% | 0 | 23.5 | +4 |
| T1×starter | Pale Edric (edric) | starter:red | 55% | 45% | 0 | 13.2 | +6 |
| T1×starter | Pale Edric (edric) | starter:green | 45% | 55% | 0 | 12.4 | -11 |
| T1×starter | Brann the Scorched (brann) | starter:white | 22% | 78% | 0 | 12.5 | -8 |
| T1×starter | Brann the Scorched (brann) | starter:blue | 47% | 53% | 0 | 14.2 | -14 |
| T1×starter | Brann the Scorched (brann) | starter:black | 35% | 65% | 0 | 13.8 | +0 |
| T1×starter | Brann the Scorched (brann) | starter:red | 24% | 76% | 0 | 9.9 | -8 |
| T1×starter | Brann the Scorched (brann) | starter:green | 34% | 66% | 0 | 11.4 | +3 |
| T1×starter | Old Hask (hask) | starter:white | 18% | 82% | 0 | 10.2 | -3 |
| T1×starter | Old Hask (hask) | starter:blue | 65% | 35% | 0 | 12.6 | -3 |
| T1×starter | Old Hask (hask) | starter:black | 17% | 83% | 0 | 13.4 | +0 |
| T1×starter | Old Hask (hask) | starter:red | 30% | 70% | 0 | 10.6 | -3 |
| T1×starter | Old Hask (hask) | starter:green | 37% (3% by library) | 63% | 0 | 12.4 | -1 |

## 4. The starters against each other (journeyman at 10; a read on the five roads)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S30 |
|---|---|---|---|---|---|---|---|
| starters | starter:white | starter:blue | 81% | 19% | 0 | 14.6 | +1 |
| starters | starter:white | starter:black | 64% (2% by library) | 36% | 0 | 15.9 | -1 |
| starters | starter:white | starter:red | 64% | 36% | 0 | 11.9 | -3 |
| starters | starter:white | starter:green | 67% | 33% | 0 | 11.6 | -19 |
| starters | starter:blue | starter:black | 36% | 64% (3% by library) | 0 | 18.1 | -1 |
| starters | starter:blue | starter:red | 44% | 56% | 0 | 12.9 | +6 |
| starters | starter:blue | starter:green | 47% | 53% | 0 | 14.7 | -15 |
| starters | starter:black | starter:red | 54% | 46% | 0 | 15.0 | -2 |
| starters | starter:black | starter:green | 74% (1% by library) | 26% | 0 | 15.9 | -3 |
| starters | starter:red | starter:green | 44% | 56% | 0 | 11.1 | +5 |

## 5. Tier-2 and tier-3 mages vs the five starters (the mage at its tier's profile and life; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S30 |
|---|---|---|---|---|---|---|---|
| T2×starter | Mistress Vael (vael) | starter:white | 55% | 45% | 0 | 16.7 | — |
| T2×starter | Mistress Vael (vael) | starter:blue | 81% (9% by library) | 19% | 0 | 23.2 | — |
| T2×starter | Mistress Vael (vael) | starter:black | 80% (36% by library) | 20% | 0 | 29.1 | — |
| T2×starter | Mistress Vael (vael) | starter:red | 69% | 31% | 0 | 15.9 | — |
| T2×starter | Mistress Vael (vael) | starter:green | 64% | 36% | 0 | 15.1 | — |
| T2×starter | Kessa Emberhand (kessa) | starter:white | 23% (4% by library) | 77% | 0 | 14.9 | — |
| T2×starter | Kessa Emberhand (kessa) | starter:blue | 55% | 45% | 0 | 16.7 | — |
| T2×starter | Kessa Emberhand (kessa) | starter:black | 31% (3% by library) | 69% | 0 | 18.6 | — |
| T2×starter | Kessa Emberhand (kessa) | starter:red | 27% | 73% | 0 | 14.1 | — |
| T2×starter | Kessa Emberhand (kessa) | starter:green | 34% | 66% | 0 | 13.2 | — |
| T2×starter | Adept Maelin (maelin) | starter:white | 15% | 85% | 0 | 10.9 | — |
| T2×starter | Adept Maelin (maelin) | starter:blue | 40% | 60% | 0 | 14.5 | — |
| T2×starter | Adept Maelin (maelin) | starter:black | 31% (10% by library) | 69% | 0 | 17.3 | — |
| T2×starter | Adept Maelin (maelin) | starter:red | 34% | 66% | 0 | 11.7 | — |
| T2×starter | Adept Maelin (maelin) | starter:green | 39% | 61% | 0 | 12.2 | — |
| T2×starter | Brennor of the Glade (brennor) | starter:white | 35% | 65% | 0 | 12.4 | — |
| T2×starter | Brennor of the Glade (brennor) | starter:blue | 68% (4% by library) | 32% | 0 | 17.4 | — |
| T2×starter | Brennor of the Glade (brennor) | starter:black | 29% (10% by library) | 71% | 0 | 17.8 | — |
| T2×starter | Brennor of the Glade (brennor) | starter:red | 52% | 48% | 0 | 11.2 | — |
| T2×starter | Brennor of the Glade (brennor) | starter:green | 45% | 55% | 0 | 12.3 | — |
| T2×starter | Pell of the Shallows (pell) | starter:white | 21% (76% by library) | 79% | 0 | 10.8 | — |
| T2×starter | Pell of the Shallows (pell) | starter:blue | 58% (97% by library) | 42% | 0 | 14.7 | — |
| T2×starter | Pell of the Shallows (pell) | starter:black | 34% (100% by library) | 66% | 0 | 13.8 | — |
| T2×starter | Pell of the Shallows (pell) | starter:red | 36% (67% by library) | 64% | 0 | 10.9 | — |
| T2×starter | Pell of the Shallows (pell) | starter:green | 25% (64% by library) | 75% | 0 | 11.3 | — |
| T3×starter | Lord Corvane (corvane) | starter:white | 24% | 76% | 0 | 12.5 | — |
| T3×starter | Lord Corvane (corvane) | starter:blue | 36% | 64% | 0 | 18.7 | — |
| T3×starter | Lord Corvane (corvane) | starter:black | 44% (9% by library) | 56% | 0 | 19.2 | — |
| T3×starter | Lord Corvane (corvane) | starter:red | 46% | 54% | 0 | 13.1 | — |
| T3×starter | Lord Corvane (corvane) | starter:green | 44% | 56% | 0 | 12.8 | — |
| T3×starter | Varro Flamebrand (varro) | starter:white | 46% (43% by library) | 54% | 0 | 15.2 | — |
| T3×starter | Varro Flamebrand (varro) | starter:blue | 60% (62% by library) | 40% | 0 | 18.1 | — |
| T3×starter | Varro Flamebrand (varro) | starter:black | 44% (55% by library) | 56% | 0 | 17.4 | — |
| T3×starter | Varro Flamebrand (varro) | starter:red | 54% (33% by library) | 46% | 0 | 14.8 | — |
| T3×starter | Varro Flamebrand (varro) | starter:green | 42% (24% by library) | 58% | 0 | 13.6 | — |
| T3×starter | High Warden Sorrel (sorrel) | starter:white | 48% | 52% | 0 | 15.7 | — |
| T3×starter | High Warden Sorrel (sorrel) | starter:blue | 61% (2% by library) | 39% | 0 | 17.7 | — |
| T3×starter | High Warden Sorrel (sorrel) | starter:black | 47% (4% by library) | 53% | 0 | 17.5 | — |
| T3×starter | High Warden Sorrel (sorrel) | starter:red | 50% | 50% | 0 | 13.7 | — |
| T3×starter | High Warden Sorrel (sorrel) | starter:green | 41% | 59% | 0 | 13.2 | — |
| T3×starter | Thornmother Ysolde (ysolde) | starter:white | 45% | 55% | 0 | 11.5 | — |
| T3×starter | Thornmother Ysolde (ysolde) | starter:blue | 78% | 22% | 0 | 13.6 | — |
| T3×starter | Thornmother Ysolde (ysolde) | starter:black | 56% | 44% | 0 | 14.2 | — |
| T3×starter | Thornmother Ysolde (ysolde) | starter:red | 66% | 34% | 0 | 11.0 | — |
| T3×starter | Thornmother Ysolde (ysolde) | starter:green | 66% | 34% | 0 | 10.9 | — |
| T3×starter | Magister Quill (quill) | starter:white | 29% (31% by library) | 71% | 0 | 11.7 | — |
| T3×starter | Magister Quill (quill) | starter:blue | 54% (80% by library) | 46% | 0 | 15.2 | — |
| T3×starter | Magister Quill (quill) | starter:black | 46% (85% by library) | 54% | 0 | 16.0 | — |
| T3×starter | Magister Quill (quill) | starter:red | 41% (56% by library) | 59% | 0 | 12.6 | — |
| T3×starter | Magister Quill (quill) | starter:green | 32% (38% by library) | 68% | 0 | 11.9 | — |

## 3. Children vs parents (parent mage at tier-1 settings; parent beast at its own)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S30 |
|---|---|---|---|---|---|---|---|
| T2×parent | Mistress Vael (vael) | Sister Oriel (oriel) | 56% | 44% | 0 | 23.5 | +3 |
| T2×parent | Mistress Vael (vael) | Pale Edric (edric) | 57% (2% by library) | 43% (2% by library) | 0 | 22.9 | +0 |
| T2×parent | Kessa Emberhand (kessa) | Brann the Scorched (brann) | 37% | 63% | 0 | 12.6 | +0 |
| T2×parent | Kessa Emberhand (kessa) | A Bloom of Man-o'-War (beast:manowar) | 72% | 28% | 0 | 17.3 | +0 |
| T2×parent | Adept Maelin (maelin) | Pale Edric (edric) | 34% | 66% | 0 | 15.4 | -1 |
| T2×parent | Adept Maelin (maelin) | The Boggart Warband (beast:warband) | 35% | 65% | 0 | 10.4 | +2 |
| T2×parent | Brennor of the Glade (brennor) | Old Hask (hask) | 58% | 42% | 0 | 12.2 | +0 |
| T2×parent | Brennor of the Glade (brennor) | Sister Oriel (oriel) | 36% | 64% | 0 | 14.6 | +0 |
| T2×parent | Pell of the Shallows (pell) | Tessaly Reed (tessaly) | 65% (42% by library) | 35% (100% by library) | 0 | 13.4 | +30 |
| T2×parent | Pell of the Shallows (pell) | Old Hask (hask) | 40% (30% by library) | 60% | 0 | 11.8 | +15 |
| T3×parent | Lord Corvane (corvane) | Pale Edric (edric) | 54% | 46% | 0 | 16.8 | -8 |
| T3×parent | Lord Corvane (corvane) | The Serra Angel (beast:serra) | 12% | 88% | 0 | 18.2 | +5 |
| T3×parent | Varro Flamebrand (varro) | Tessaly Reed (tessaly) | 73% (12% by library) | 27% (89% by library) | 0 | 13.5 | -7 |
| T3×parent | Varro Flamebrand (varro) | Brann the Scorched (brann) | 66% | 34% | 0 | 13.6 | +2 |
| T3×parent | High Warden Sorrel (sorrel) | Brann the Scorched (brann) | 59% | 41% | 0 | 13.8 | +0 |
| T3×parent | High Warden Sorrel (sorrel) | The Hypnotic Specter (beast:specter) | 53% (2% by library) | 47% | 0 | 16.3 | +0 |
| T3×parent | Thornmother Ysolde (ysolde) | Old Hask (hask) | 68% | 32% | 0 | 10.3 | +0 |
| T3×parent | Thornmother Ysolde (ysolde) | A Savannah Lion (beast:lion) | 54% | 46% | 0 | 12.1 | +0 |
| T3×parent | Magister Quill (quill) | Tessaly Reed (tessaly) | 53% (36% by library) | 47% (100% by library) | 0 | 14.0 | +2 |
| T3×parent | Magister Quill (quill) | The Pelakka Wurm (beast:wurm) | 32% (78% by library) | 68% | 0 | 12.9 | +3 |

## Cast counts per mage (every game the deck played in this run; casts per game in brackets; NEVER CAST listed)

- **Sister Oriel (oriel)** — 1100 games — Soul Warden ×4: 1603 (1.46) · Suntail Hawk ×3: 1250 (1.14) · Youthful Valkyrie ×3: 1228 (1.12) · Inspiring Overseer ×2: 780 (0.71) · Master Decoy ×2: 772 (0.70) · Spirit Link ×2: 792 (0.72) · Pacifism ×2: 685 (0.62) · Raise the Alarm ×2: 790 (0.72) · Swords to Plowshares ×1: 392 (0.36) · Glorious Anthem ×1: 315 (0.29) · Restoration Angel ×1: 333 (0.30)
- **Tessaly Reed (tessaly)** — 1200 games — Hedron Crab ×4: 1548 (1.29) · Cathartic Adept ×4: 1644 (1.37) · Traumatizer ×3: 886 (0.74) · Thought Scour ×2: 821 (0.68) · Brainstorm ×2: 761 (0.63) · Wall of Air ×1: 305 (0.25) · Essence Scatter ×2: 441 (0.37) · Counterspell ×1: 286 (0.24) · Boomerang ×1: 378 (0.32) · Altar of Dementia ×2: 704 (0.59)
- **Pale Edric (edric)** — 1200 games — Unearth ×3: 990 (0.82) · Zombify ×1: 231 (0.19) · Gravedigger ×2: 568 (0.47) · Vampire Nighthawk ×2: 770 (0.64) · Blood Artist ×2: 658 (0.55) · Indulgent Aristocrat ×2: 1010 (0.84) · Reassembling Skeleton ×2: 783 (0.65) · Child of Night ×2: 811 (0.68) · Typhoid Rats ×4: 1836 (1.53) · Terror ×2: 682 (0.57) · Dark Ritual ×1: 292 (0.24)
- **Brann the Scorched (brann)** — 1200 games — Young Pyromancer ×3: 953 (0.79) · Arc Mage ×2: 506 (0.42) · Lightning Bolt ×3: 1094 (0.91) · Shock ×3: 1130 (0.94) · Abrade ×2: 627 (0.52) · Blaze ×2: 591 (0.49) · Brute Force ×2: 501 (0.42) · Hordeling Outburst ×2: 421 (0.35) · Goblin Piker ×2: 606 (0.51) · Thundersnake ×1: 289 (0.24) · Pyroclasm ×1: 169 (0.14)
- **Old Hask (hask)** — 1200 games — Gladecover Scout ×4: 1474 (1.23) · Blurred Mongoose ×3: 966 (0.81) · Birds of Paradise ×2: 691 (0.58) · Rancor ×3: 1237 (1.03) · Blanchwood Armor ×3: 719 (0.60) · Timberland Guide ×2: 735 (0.61) · Giant Growth ×3: 906 (0.76) · Prey Upon ×2: 589 (0.49) · Wall of Blossoms ×2: 566 (0.47)
- **Mistress Vael (vael)** — 1100 games — Soul Warden ×3: 1454 (1.32) · Suntail Hawk ×2: 939 (0.85) · Youthful Valkyrie ×2: 1013 (0.92) · Child of Night ×2: 882 (0.80) · Vampire Nighthawk ×2: 995 (0.90) · Blood Artist ×2: 820 (0.75) · Indulgent Aristocrat ×2: 938 (0.85) · Spirit Link ×2: 818 (0.74) · Unearth ×2: 798 (0.73) · Gravedigger ×1: 401 (0.36) · Swords to Plowshares ×1: 426 (0.39) · Pacifism ×1: 393 (0.36) · Wrath of God ×1: 289 (0.26)
- **Kessa Emberhand (kessa)** — 1100 games — Young Pyromancer ×3: 1235 (1.12) · Arc Mage ×3: 1039 (0.94) · Man-o'-War ×2: 847 (0.77) · Lightning Bolt ×3: 1176 (1.07) · Shock ×2: 732 (0.67) · Blaze ×1: 304 (0.28) · Hordeling Outburst ×1: 232 (0.21) · Brainstorm ×3: 896 (0.81) · Boomerang ×2: 576 (0.52) · Essence Scatter ×2: 428 (0.39) · Counterspell ×1: 170 (0.15)
- **Adept Maelin (maelin)** — 1100 games — Skirk Prospector ×2: 783 (0.71) · Goblin Piker ×2: 782 (0.71) · Hordeling Outburst ×2: 461 (0.42) · Goblin Grenade ×2: 431 (0.39) · Indulgent Aristocrat ×2: 739 (0.67) · Blood Artist ×2: 682 (0.62) · Unearth ×2: 530 (0.48) · Gravedigger ×2: 587 (0.53) · Gallows Djinn ×1: 260 (0.24) · Dark Ritual ×1: 267 (0.24) · Lightning Bolt ×1: 336 (0.31) · Terror ×1: 282 (0.26) · Siege-Gang Commander ×1: 212 (0.19) · Typhoid Rats ×2: 722 (0.66)
- **Brennor of the Glade (brennor)** — 1100 games — Gladecover Scout ×3: 1070 (0.97) · Blurred Mongoose ×2: 695 (0.63) · Birds of Paradise ×2: 762 (0.69) · Soul Warden ×2: 674 (0.61) · Youthful Valkyrie ×2: 838 (0.76) · Rancor ×2: 977 (0.89) · Blanchwood Armor ×2: 590 (0.54) · Spirit Link ×2: 643 (0.58) · Giant Growth ×2: 626 (0.57) · Glorious Anthem ×1: 259 (0.24) · Swords to Plowshares ×1: 353 (0.32) · Pacifism ×1: 321 (0.29) · Restoration Angel ×1: 287 (0.26)
- **Pell of the Shallows (pell)** — 1100 games — Hedron Crab ×4: 1328 (1.21) · Traumatizer ×3: 924 (0.84) · Rampant Growth ×3: 751 (0.68) · Wood Elves ×2: 667 (0.61) · Grazing Gladehart ×2: 649 (0.59) · Rumbling Baloth ×2: 536 (0.49) · Rancor ×2: 952 (0.87) · Giant Growth ×2: 493 (0.45) · Birds of Paradise ×1: 316 (0.29) · Brainstorm ×1: 306 (0.28) · Altar of Dementia ×1: 261 (0.24)
- **Lord Corvane (corvane)** — 1100 games — Youthful Valkyrie ×2: 895 (0.81) · Indulgent Aristocrat ×2: 872 (0.79) · Blood Artist ×2: 712 (0.65) · Gravedigger ×1: 342 (0.31) · Terror ×1: 261 (0.24) · Unearth ×2: 489 (0.44) · Zombify ×3: 777 (0.71) · Buried Alive ×3: 555 (0.50) · Restoration Angel ×1: 361 (0.33) · Serra Angel ×3: 772 (0.70) · Artisan of Kozilek ×1: 37 (0.03) · Swords to Plowshares ×2: 763 (0.69)
- **Varro Flamebrand (varro)** — 1100 games — Hedron Crab ×3: 1084 (0.99) · Young Pyromancer ×2: 796 (0.72) · Arc Mage ×2: 805 (0.73) · Traumatizer ×2: 518 (0.47) · Lightning Bolt ×3: 1246 (1.13) · Shock ×2: 751 (0.68) · Blaze ×1: 311 (0.28) · Brainstorm ×2: 664 (0.60) · Divination ×1: 295 (0.27) · Boomerang ×2: 516 (0.47) · Counterspell ×1: 230 (0.21) · Essence Scatter ×1: 263 (0.24) · Faerie Formation ×1: 216 (0.20)
- **High Warden Sorrel (sorrel)** — 1100 games — Young Pyromancer ×3: 1069 (0.97) · Arc Mage ×2: 674 (0.61) · Hypnotic Specter ×2: 541 (0.49) · Hymn to Tourach ×1: 174 (0.16) · Duress ×2: 509 (0.46) · Mind Rot ×2: 344 (0.31) · Lightning Bolt ×3: 1074 (0.98) · Shock ×2: 716 (0.65) · Blaze ×1: 349 (0.32) · Terror ×2: 549 (0.50) · Vampire Nighthawk ×1: 341 (0.31) · Dark Ritual ×1: 245 (0.22) · Unearth ×1: 222 (0.20)
- **Thornmother Ysolde (ysolde)** — 1100 games — Savannah Lions ×2: 666 (0.61) · Suntail Hawk ×2: 726 (0.66) · Fencing Ace ×2: 630 (0.57) · Gladecover Scout ×2: 673 (0.61) · Blurred Mongoose ×2: 641 (0.58) · Birds of Paradise ×2: 669 (0.61) · Raise the Alarm ×2: 629 (0.57) · Glorious Anthem ×2: 490 (0.45) · Rancor ×2: 914 (0.83) · Blanchwood Armor ×2: 528 (0.48) · Giant Growth ×1: 263 (0.24) · Swords to Plowshares ×1: 342 (0.31) · Serra Angel ×1: 190 (0.17)
- **Magister Quill (quill)** — 1100 games — Hedron Crab ×4: 1267 (1.15) · Rampant Growth ×3: 638 (0.58) · Llanowar Elves ×2: 741 (0.67) · Wood Elves ×2: 743 (0.68) · Wall of Blossoms ×1: 347 (0.32) · Traumatizer ×1: 381 (0.35) · Gaean Wurm ×2: 648 (0.59) · Pelakka Wurm ×1: 164 (0.15) · Baru, Wurmspeaker ×1: 311 (0.28) · Altar of Dementia ×2: 734 (0.67) · Essence Scatter ×2: 481 (0.44) · Counterspell ×1: 245 (0.22) · Brainstorm ×1: 307 (0.28)


   **The reads the planner asked for.**
   - **Pell is the deck the amendments reached.** Inside the tier he went from 14–21% to **38–41%** (+18 to +27 in every cell), 65% over Tessaly (+30), 40% over Hask (+15), and his wins are no longer all by library (15–84%: the Baloths and Rancors kill). The four Pell folds inside tier 2 are gone; no fold stands inside tier 2 now. Against the starters (part 5) he is 21 / 58 / 34 / 36 / 25 — still mostly by library, folding to white and green. The Gladehart cast 0.59/game, the Baloth 0.49, Rancor 0.87, Giant Growth 0.45.
   - **Tessaly's floor did not move.** Inside the tier 18–25% (Δ +4 / +2 / −3 — noise); every win is still by library; against the starters 10 / 67 / 31 / 24 / 22 (blue +12, black +7, white −6, red −8, green −15 — the green starter got faster with Rancor). Three Traumatizers cast 0.74/game and the deck attacks now (book 45), but her attackers are 1/1 Adepts and Crabs: the anchor doubles one power. She is in ADR-103's 35–45% band only against black (31%) and above it against blue (67%). If she is to teach "your library is a clock" while winning, she needs bodies with power under the Traumatizer (a 2-power flier), or ADR-103's teach-while-losing stands.
   - **Corvane's engine turns now but the deck still dies early.** Inside the tier 70 / 51 / 25 / 53 (+6 / −6 / −3 / +0); 12% against the Serra beast (+5); 54% over Edric (−8). Against the starters 24 / 36 / 44 / 46 / 44 — a master at 12 life below 50% against every journeyman starter at 10. Measured (200 games each): vs Sorrel 52% at 17 turns with the Artisan reanimated 0.20/game; vs Dawn Levy 25% at **12.5 turns** — the game ends before the Zombify turn. Buried Alive 0.50/game, Zombify 0.71, Terror 0.24.
   - **Quill and Varro against the starters** (the read the brief wanted): Quill 29 / 54 / 46 / 41 / 32 (31–85% by library); Varro 46 / 60 / 44 / 54 / 42 (24–62% by library) — Varro is the mill deck nearest the band; his Traumatizers cast 0.47/game.
   - **The five roads after ADR-106**: white–green fell from 86/14 to **67/33** (−19), blue–green 47/53 (−15), blue–red 44/56 (+6), red–green 44/56 (+5), black–red 54/46 — **four pairings inside 40–60** (blue–red, blue–green, black–red, red–green) where S30 had one. Outside the band: **white over all four (81 / 64 / 64 / 67)** — the Valkyrie-for-Swords swap did not slow Dawn Levy; blue–black 36/64; black–green 74/26. Green moved most (the Rancors); blue still folds to white (19%).
   - **Teachers vs the new starters**: Oriel 49 / 74 / 57 / 63 / 51 (green −19); Edric 23 / 50 / 65 / 55 / 45 (green −11); Brann 22 / 47 / 35 / 24 / 34 (white −8, blue −14, red −8 — the starter's second Bolt); Hask 18 / 65 / 17 / 30 / 37.
   - **Part 5's headline: the tier-3 masters lose to the journeyman starters in 17 of 25 cells** (Corvane 24–46, Quill 29–54, Varro 42–60, Sorrel 41–61, Ysolde 45–78); tier 2 in 18 of 25 (Maelin 15–40, Kessa 23–55, Pell 21–58, Brennor 29–68; only Vael 55–81 is above). The post-ADR-106 starters at 10 life under journeyman are in the tier-3 mages' band. Whether that means the starters are now too strong for the ladder or the mage lists are weak to aggro is the planner's read — ADR-103 says the sweep is a diagnostic, and the human plays the starter better than journeyman.
   - **Cast counts**: nothing in any list went uncast. The least-cast per copy stay the reactive and the expensive (counterspells 0.15–0.24, Zombify in Edric 0.19, the Artisan 0.03 hard-cast — see Deviation 6).

2. **Tessaly needs a power source, not a third anchor** (the read above): under the Traumatizer her Adepts mill two per swing; a 2-power evasive body would double the clock. Or ADR-103's teaching-while-losing stands and the tier-1 blue mage is meant to be beaten by the clock's design.
3. **The starters vs the tiers** (part 5's headline): if the five roads are meant to be beaten by tier-2 mages at the world's difficulty, the sweep says they are not — the fix is either worldcraft (ADR-106 says the dial is worldcraft) or the mage lists' floors against aggro.
4. **Corvane's Rituals**: the list lost two Dark Rituals and an Overseer for Terror, a third Buried Alive and the Artisan; the engine turns (Deviation 1) but at 12.5 mean turns against Dawn Levy the Zombify turn never comes. The Rituals were the turn-two Buried Alive / turn-three Zombify line; the planner may want them back over a Swords or the Gravedigger.
5. **A `returned` fact** for the sweep (Deviation 6) — an implementer small the reanimator decks want before the next sweep is read.
6. **CLAUDE.md says `data/art/real/` is gitignored; it is tracked** (649 files, the new scans added) — doc drift, Chris/planner to rule.
7. **The edict's "defending player" is the opponent** (two players) — R-094's known simplification.

## Registry entries added/changed

R-094. Pool-registry: Session 31 section (+2; the Traumatizer row retexted; Buried Alive's row notes book 47); printings regenerated (`art:fetch`). ADRs 106–108 in `docs/decision-updates/s31.md`. Knobs unchanged. Engine: the damage collectors' `controller`/`type` filters; `Who` + `eventPlayer`; `sacrifice {who, count, predicate}` + `sacrificeChoose`; `zone: "stack"` triggers; `SPELL_CAST.objectId`; `EffectRequester` carries a source (`chooseSacrifice`, `searchLibrary`). AI: `millValue`, `millPerDamage`, `reanimationWorth` in the evaluator; the engine term in `evaluate`; books 45–48. Sim: `s31-fuzz.test.ts`; `mage-sweep` part 5 + `sweep-baselines/s30.json`. World: the starters. UI: playtest r6 (`walkPreview`). `docs/reference/` regenerated; implementer-notes S31 lessons.

## Test status

Default tier **559 passed / 2 skipped** (53 files; +12 S31 fixtures, +2 fuzz tests, +4 book pins, +1 world-controller test; baselines: the loader's def count 203 → 205, the shop-tier counts 70/51/10/22 → 71/51/10/23, the blue starter's pin, hard Verdant's Prey Upon count). `pnpm typecheck` clean. **Fuzz-before-fixtures honoured**: 720 mage games + 120 starter games at the full tier, replays byte-exact, before the S31 fixtures. **The FUZZ_FULL ladder gate held and the 100/cell vs-random ladder PASSES** — run after Part 1–2's AI and again after books 47–48. Sweep: 13,500 games (135 pairings). Browser: the dev gallery shows 205/205 with the two new scans on the printed default; the r6 items verified live (gallery) and by test (quests, walkPreview).

## Suggested next

1. **Chris**: Deviation 1 (ratify the two chooser fixes); the Artisan's 100g; Concern 3 (the starters vs the tiers — worldcraft or lists).
2. **Planner (S32)**: Tessaly's power source (Concern 2); Corvane's Rituals (4); Diabolic Edict is a zero-word add now (Part 6 of the brief); the white road still walls the other four.
3. **Implementer smalls**: `facts.returned`; the gallery's deck filter on the mages; a browser walk of the annihilator dialog on the human seat.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--part 1|2|3|4|5] [--baseline none]   # ~10 min; the delta column reads sweep-baselines/s30.json
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /gallery (dev: every card; printed frames by default) · /play → any mage vs any mage
```
