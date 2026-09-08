# Handoff — after Session 32 (2026-09-07)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 32 — **the Escort, the Edict, the last list turns, and the tier yardstick** — is done: Plumecreed Escort and Diabolic Edict in the pool (ADR-109; 192 → 194; both zero words — the Escort rides the resolved `grantKeyword` with the until-end-of-turn duration, the Edict rides S31's edict word; no R-095), the four lists and two starters turned (ADR-110), `facts.returned` so the reanimator decks read honestly, sweep parts 6 (the beasts vs the starters) and 7 (the mid-road yardstick, ADR-111 — `road-mid-W` / `road-mid-B` in `sim/road-decks`), the S31 baseline, and the full sweep re-run (parts 1–7, 22,000 games). Three AI corrections the work forced, all pinned and ladder-gated: the S28 cantrip window compared the step to a name the engine never uses (Brainstorm's end-step cast had never happened live), the pump-waste gate was swallowing the Escort as a "trick", and the view's stack now carries its targets (the Altar's "doomed" read had been blind live since S29). The smalls: CLAUDE.md's art lines, the gallery's mage filter, the annihilator dialog walked headlessly through the UI's own event path. Pool 194 cards (207 defs with tokens and test cards); `docs/reference/` regenerated.

## Done this session

- **Part 0**: `docs/decision-updates/s32.md` — the ratifications, ADR-109/110/111, the CLAUDE.md ruling, filing notes.
- **Part 1 — Plumecreed Escort** (BLB; T1/12g; zero words): flash + flying + an ETB `grantKeyword hexproof` at `creatureYouControl`, `UNTIL_END_OF_TURN` (the S22 haste rider's resolved form); hexproof was already honoured by the targeting predicate. Five fixtures: the save (their Bolt at our Crab fizzles when the Escort resolves first); Pacifism at a hexproofed creature fizzles; the grant ends at cleanup (a Terror is not even offered while it holds, and takes the creature next turn); an Escort saves another Escort from a Shock, and an Escort entering alone is its own forced target; flash offered at the opponent's end step, never a sorcery-speed creature. AI (book 49): a flash creature is an instant — the opponent's end step by default, in response to anything on the stack (the cast prediction credits the biggest creature of ours an opponent's stack item is aimed at — the save), on our own turn only with idle mana; the ETB's target chooser sends a helpful effect to the creature UNDER FIRE first. The FUZZ_FULL ladder gate held, the vs-random ladder PASS.
- **Part 2 — Diabolic Edict** (TMP; T2/16g; zero words on R-094 word 3 at `who: target, count 1, predicate creature`). Three fixtures: the lone Serra goes forced; no creatures resolves doing nothing; the defender gives up the Goblin token over the Serra (one logged pick). AI (book 50): worth the LEAST creature the target would give up (the S31 predictor already priced it so), and gated — never into no creatures, never into a token shielding a real creature, never at our own face; a lone Serra is the play.
- **Part 3**: Tessaly (−1 Wall of Air −1 Boomerang +2 Escort), Corvane (−1 Gravedigger −1 Unearth +2 Dark Ritual), Sorrel (−1 Terror +1 Edict), Kessa (−1 Boomerang +1 Escort) — exactly as given.
- **Part 4**: Dawn Levy (−1 Fencing Ace −1 Raise the Alarm +1 Inspiring Overseer +1 Master Decoy) and Tidal Grimoire (−1 Aether Channeler −1 Cloudkin Seer +2 Escort); every easy/hard delta still legal; `starters.md` regenerated.
- **Part 5**: `facts.returned` (a `RETURNED` log event on every graveyard → battlefield move; derived in `deriveFacts`) and the sweep's cast-count section now lists **returned from the graveyard** per deck; the baseline defaults to `sweep-baselines/s31.json`; part 6 (17 beasts × 5 starters). Full run below.
- **Part 6**: `roadMidW` / `roadMidB` in `packages/sim/src/road-decks.ts` (the amended starter + the planner's eight cards, 38 each, one basic in play via `permanentOnBattlefield`, 12 life, journeyman — the Side gained `entrance`); a world test keeps each equal to its starter plus the eight; sweep part 7 (ten mages × two references). Tables below.
- **Part 7**: CLAUDE.md's two art lines say tracked; the gallery's deck filter lists the fifteen mages (`mage:<key>`; each card's row names its mage decks — browser-verified: Tessaly shows her eleven distinct cards); the annihilator's sacrifice dialog walked through the UI's own event path (a headless MatchController match: the Artisan in play for the AI, two Forests and a Bears for the human — two `chooseSacrifice` dialogs reach the human seat with the Artisan as source, the picks resolve, the Bears stay).
- **Fuzz before fixtures**: `s32-fuzz.test.ts` (the fifteen mages against a mage and a starter each, both seats, plus the starters' round-robin — 840 games at the full tier, replays byte-exact) ran before any S32 fixture.

## Deviations from the brief

1. **The S28 cantrip window was dead live** — `cantripTimingGated` compared `view.step` to `"END_STEP"` while the engine's step is `"END"`; Brainstorm (and Thought Scour's window, had it used the gate) could only ever be cast in response. Caught by the Escort's pin (which used the same rule). Fixed in both gates and in book 36's pin. Every blue deck's timing changed; both ladder gates held; the sweep below includes it. The planner should note it as an S28 correction.
2. **The pump-waste gate reads instants and sorceries only** — it was reading the Escort's ETB (an until-end-of-turn grant) as a combat trick and gating the cast. A permanent's timed ETB is a body, not a trick.
3. **`GameView.stack[].targets` is public now.** The Escort's save needs to see which creature an opponent's spell is aimed at; the view's stack carried no targets, and the S29 Altar "doomed" read (`creatureIsDoomed`) had been reading a field that only tests supplied — blind live since S29. The stack's targets are announced information, so the view carries them.
4. **The Edict's three gates** (no creatures / a token shield / our own face) go beyond "values the Edict by the least creature": the predictor alone still cast into a 5/5 behind two tokens (a token's half-point plus tempo outscored passing). The brief's pin wanted a hold, so the hold is a gate.
5. **The mid-road references are static lists, not the catalog plus adds** — `sim` cannot read `data/world` (the dependency runs the other way), so `road-decks.ts` carries the 38 explicitly and a world test asserts each equals its starter plus the planner's eight. Edit the starter, then the road deck; the test says when they drift.
6. **The annihilator walk is headless**, not a browser screenshot: a duel with a custom `permanentOnBattlefield` setup has no UI entry point, and the S10 pattern (the controller drives the same event path as the clicks) is the honest reproducible form. The visual panel is the generic `chooseSacrifice` dialog with the Artisan as its named source.

## Concerns

1. **The sweep (100 games per pairing, both seats; mages at the tier's profile and life — 8/10/12; starters at 10 life piloted at journeyman; beasts at their catalog life/profile; the mid-road references at 12 life with a basic in play, journeyman; Δ = A's win % against the S31 run; parts 6–7 are new, no baseline):**

## 1. Tier by tier

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T1 | Sister Oriel (oriel) | Tessaly Reed (tessaly) | 67% | 33% (97% by library) | 0 | 11.9 | -8 |
| T1 | Sister Oriel (oriel) | Pale Edric (edric) | 62% | 38% | 0 | 16.2 | +1 |
| T1 | Sister Oriel (oriel) | Brann the Scorched (brann) | 74% | 26% | 0 | 12.7 | +0 |
| T1 | Sister Oriel (oriel) | Old Hask (hask) | 73% | 27% | 0 | 11.1 | +0 |
| T1 | Tessaly Reed (tessaly) | Pale Edric (edric) | 26% (77% by library) | 74% | 0 | 12.5 | +8 |
| T1 | Tessaly Reed (tessaly) | Brann the Scorched (brann) | 28% (61% by library) | 72% | 0 | 11.1 | +3 |
| T1 | Tessaly Reed (tessaly) | Old Hask (hask) | 35% (63% by library) | 65% | 0 | 11.0 | +12 |
| T1 | Pale Edric (edric) | Brann the Scorched (brann) | 59% | 41% | 0 | 12.7 | +0 |
| T1 | Pale Edric (edric) | Old Hask (hask) | 66% | 34% | 0 | 12.7 | +0 |
| T1 | Brann the Scorched (brann) | Old Hask (hask) | 55% | 45% | 0 | 9.9 | +0 |
| T2 | Mistress Vael (vael) | Kessa Emberhand (kessa) | 68% | 32% | 0 | 19.6 | +0 |
| T2 | Mistress Vael (vael) | Adept Maelin (maelin) | 65% | 35% | 0 | 16.9 | +0 |
| T2 | Mistress Vael (vael) | Brennor of the Glade (brennor) | 66% (2% by library) | 34% | 0 | 19.1 | +1 |
| T2 | Mistress Vael (vael) | Pell of the Shallows (pell) | 61% | 39% (85% by library) | 0 | 15.4 | -1 |
| T2 | Kessa Emberhand (kessa) | Adept Maelin (maelin) | 46% | 54% | 0 | 14.5 | +6 |
| T2 | Kessa Emberhand (kessa) | Brennor of the Glade (brennor) | 39% | 61% | 0 | 12.7 | +4 |
| T2 | Kessa Emberhand (kessa) | Pell of the Shallows (pell) | 73% | 27% (22% by library) | 0 | 12.6 | +12 |
| T2 | Adept Maelin (maelin) | Brennor of the Glade (brennor) | 48% | 52% | 0 | 13.3 | +2 |
| T2 | Adept Maelin (maelin) | Pell of the Shallows (pell) | 58% | 42% (43% by library) | 0 | 13.7 | -1 |
| T2 | Brennor of the Glade (brennor) | Pell of the Shallows (pell) | 62% | 38% (55% by library) | 0 | 13.2 | +1 |
| T3 | Lord Corvane (corvane) | Varro Flamebrand (varro) | 66% | 34% (24% by library) | 0 | 17.3 | -4 |
| T3 | Lord Corvane (corvane) | High Warden Sorrel (sorrel) | 46% | 54% | 0 | 16.4 | -5 |
| T3 | Lord Corvane (corvane) | Thornmother Ysolde (ysolde) | 26% | 74% | 0 | 12.2 | +1 |
| T3 | Lord Corvane (corvane) | Magister Quill (quill) | 50% | 50% (56% by library) | 0 | 15.6 | -3 |
| T3 | Varro Flamebrand (varro) | High Warden Sorrel (sorrel) | 56% (7% by library) | 44% | 0 | 17.0 | +3 |
| T3 | Varro Flamebrand (varro) | Thornmother Ysolde (ysolde) | 30% (7% by library) | 70% | 0 | 13.4 | +2 |
| T3 | Varro Flamebrand (varro) | Magister Quill (quill) | 47% (17% by library) | 53% (38% by library) | 0 | 16.1 | +0 |
| T3 | High Warden Sorrel (sorrel) | Thornmother Ysolde (ysolde) | 36% | 64% | 0 | 12.7 | +2 |
| T3 | High Warden Sorrel (sorrel) | Magister Quill (quill) | 66% | 34% (29% by library) | 0 | 13.8 | -2 |
| T3 | Thornmother Ysolde (ysolde) | Magister Quill (quill) | 75% | 25% (20% by library) | 0 | 11.2 | +0 |

## 2. Teachers vs starters (tier-1 mages at 8 / apprentice; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T1×starter | Sister Oriel (oriel) | starter:white | 55% | 45% | 0 | 17.1 | +6 |
| T1×starter | Sister Oriel (oriel) | starter:blue | 76% (9% by library) | 24% | 0 | 20.5 | +2 |
| T1×starter | Sister Oriel (oriel) | starter:black | 59% (5% by library) | 41% | 0 | 19.4 | +2 |
| T1×starter | Sister Oriel (oriel) | starter:red | 60% | 40% | 0 | 12.7 | -3 |
| T1×starter | Sister Oriel (oriel) | starter:green | 52% | 48% | 0 | 12.9 | +1 |
| T1×starter | Tessaly Reed (tessaly) | starter:white | 14% (100% by library) | 86% | 0 | 9.7 | +4 |
| T1×starter | Tessaly Reed (tessaly) | starter:blue | 52% (100% by library) | 48% | 0 | 12.4 | -15 |
| T1×starter | Tessaly Reed (tessaly) | starter:black | 30% (100% by library) | 70% | 0 | 11.8 | -1 |
| T1×starter | Tessaly Reed (tessaly) | starter:red | 29% (93% by library) | 71% | 0 | 10.2 | +5 |
| T1×starter | Tessaly Reed (tessaly) | starter:green | 23% (100% by library) | 77% | 0 | 9.8 | +1 |
| T1×starter | Pale Edric (edric) | starter:white | 24% | 76% | 0 | 12.4 | +1 |
| T1×starter | Pale Edric (edric) | starter:blue | 50% | 50% | 0 | 15.7 | +0 |
| T1×starter | Pale Edric (edric) | starter:black | 65% (20% by library) | 35% | 0 | 23.5 | +0 |
| T1×starter | Pale Edric (edric) | starter:red | 55% | 45% | 0 | 13.2 | +0 |
| T1×starter | Pale Edric (edric) | starter:green | 45% | 55% | 0 | 12.4 | +0 |
| T1×starter | Brann the Scorched (brann) | starter:white | 23% | 77% | 0 | 13.0 | +1 |
| T1×starter | Brann the Scorched (brann) | starter:blue | 45% | 55% | 0 | 13.1 | -2 |
| T1×starter | Brann the Scorched (brann) | starter:black | 35% | 65% | 0 | 13.8 | +0 |
| T1×starter | Brann the Scorched (brann) | starter:red | 24% | 76% | 0 | 9.9 | +0 |
| T1×starter | Brann the Scorched (brann) | starter:green | 34% | 66% | 0 | 11.4 | +0 |
| T1×starter | Old Hask (hask) | starter:white | 24% | 76% | 0 | 10.0 | +6 |
| T1×starter | Old Hask (hask) | starter:blue | 51% | 49% | 0 | 12.1 | -14 |
| T1×starter | Old Hask (hask) | starter:black | 17% | 83% | 0 | 13.4 | +0 |
| T1×starter | Old Hask (hask) | starter:red | 30% | 70% | 0 | 10.6 | +0 |
| T1×starter | Old Hask (hask) | starter:green | 37% (3% by library) | 63% | 0 | 12.4 | +0 |

## 4. The starters against each other (journeyman at 10; a read on the five roads)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| starters | starter:white | starter:blue | 78% | 22% | 0 | 15.3 | -3 |
| starters | starter:white | starter:black | 59% | 41% | 0 | 16.3 | -5 |
| starters | starter:white | starter:red | 64% | 36% | 0 | 12.0 | +0 |
| starters | starter:white | starter:green | 64% | 36% | 0 | 11.7 | -3 |
| starters | starter:blue | starter:black | 55% (2% by library) | 45% (2% by library) | 0 | 18.0 | +19 |
| starters | starter:blue | starter:red | 50% | 50% | 0 | 11.8 | +6 |
| starters | starter:blue | starter:green | 61% | 39% | 0 | 13.5 | +14 |
| starters | starter:black | starter:red | 54% | 46% | 0 | 15.0 | +0 |
| starters | starter:black | starter:green | 74% (1% by library) | 26% | 0 | 15.9 | +0 |
| starters | starter:red | starter:green | 44% | 56% | 0 | 11.1 | +0 |

## 5. Tier-2 and tier-3 mages vs the five starters (the mage at its tier's profile and life; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T2×starter | Mistress Vael (vael) | starter:white | 55% (2% by library) | 45% | 0 | 17.7 | +0 |
| T2×starter | Mistress Vael (vael) | starter:blue | 79% (9% by library) | 21% | 0 | 24.1 | -2 |
| T2×starter | Mistress Vael (vael) | starter:black | 80% (36% by library) | 20% | 0 | 29.1 | +0 |
| T2×starter | Mistress Vael (vael) | starter:red | 69% | 31% | 0 | 15.9 | +0 |
| T2×starter | Mistress Vael (vael) | starter:green | 64% | 36% | 0 | 15.1 | +0 |
| T2×starter | Kessa Emberhand (kessa) | starter:white | 30% | 70% | 0 | 14.7 | +7 |
| T2×starter | Kessa Emberhand (kessa) | starter:blue | 51% | 49% | 0 | 15.4 | -4 |
| T2×starter | Kessa Emberhand (kessa) | starter:black | 34% | 66% | 0 | 17.4 | +3 |
| T2×starter | Kessa Emberhand (kessa) | starter:red | 33% | 67% | 0 | 13.7 | +6 |
| T2×starter | Kessa Emberhand (kessa) | starter:green | 45% | 55% | 0 | 13.6 | +11 |
| T2×starter | Adept Maelin (maelin) | starter:white | 19% | 81% | 0 | 11.1 | +4 |
| T2×starter | Adept Maelin (maelin) | starter:blue | 38% | 62% | 0 | 13.7 | -2 |
| T2×starter | Adept Maelin (maelin) | starter:black | 31% (10% by library) | 69% | 0 | 17.3 | +0 |
| T2×starter | Adept Maelin (maelin) | starter:red | 34% | 66% | 0 | 11.7 | +0 |
| T2×starter | Adept Maelin (maelin) | starter:green | 39% | 61% | 0 | 12.2 | +0 |
| T2×starter | Brennor of the Glade (brennor) | starter:white | 32% | 68% | 0 | 12.6 | -3 |
| T2×starter | Brennor of the Glade (brennor) | starter:blue | 61% (3% by library) | 39% | 0 | 15.7 | -7 |
| T2×starter | Brennor of the Glade (brennor) | starter:black | 30% (10% by library) | 70% | 0 | 17.4 | +1 |
| T2×starter | Brennor of the Glade (brennor) | starter:red | 52% | 48% | 0 | 11.3 | +0 |
| T2×starter | Brennor of the Glade (brennor) | starter:green | 43% | 57% | 0 | 12.2 | -2 |
| T2×starter | Pell of the Shallows (pell) | starter:white | 21% (81% by library) | 79% | 0 | 10.5 | +0 |
| T2×starter | Pell of the Shallows (pell) | starter:blue | 44% (93% by library) | 56% | 0 | 12.9 | -14 |
| T2×starter | Pell of the Shallows (pell) | starter:black | 35% (100% by library) | 65% | 0 | 13.8 | +1 |
| T2×starter | Pell of the Shallows (pell) | starter:red | 36% (67% by library) | 64% | 0 | 11.0 | +0 |
| T2×starter | Pell of the Shallows (pell) | starter:green | 26% (69% by library) | 74% | 0 | 11.3 | +1 |
| T3×starter | Lord Corvane (corvane) | starter:white | 32% | 68% | 0 | 13.2 | +8 |
| T3×starter | Lord Corvane (corvane) | starter:blue | 32% | 68% | 0 | 18.3 | -4 |
| T3×starter | Lord Corvane (corvane) | starter:black | 28% (4% by library) | 72% | 0 | 17.0 | -16 |
| T3×starter | Lord Corvane (corvane) | starter:red | 35% | 65% | 0 | 12.5 | -11 |
| T3×starter | Lord Corvane (corvane) | starter:green | 38% | 62% | 0 | 12.6 | -6 |
| T3×starter | Varro Flamebrand (varro) | starter:white | 41% (51% by library) | 59% | 0 | 16.1 | -5 |
| T3×starter | Varro Flamebrand (varro) | starter:blue | 58% (53% by library) | 42% | 0 | 17.4 | -2 |
| T3×starter | Varro Flamebrand (varro) | starter:black | 44% (55% by library) | 56% | 0 | 17.5 | +0 |
| T3×starter | Varro Flamebrand (varro) | starter:red | 54% (31% by library) | 46% | 0 | 14.8 | +0 |
| T3×starter | Varro Flamebrand (varro) | starter:green | 42% (21% by library) | 58% | 0 | 13.5 | +0 |
| T3×starter | High Warden Sorrel (sorrel) | starter:white | 40% | 60% | 0 | 15.9 | -8 |
| T3×starter | High Warden Sorrel (sorrel) | starter:blue | 59% | 41% | 0 | 17.6 | -2 |
| T3×starter | High Warden Sorrel (sorrel) | starter:black | 45% (4% by library) | 55% | 0 | 17.8 | -2 |
| T3×starter | High Warden Sorrel (sorrel) | starter:red | 48% | 52% | 0 | 13.6 | -2 |
| T3×starter | High Warden Sorrel (sorrel) | starter:green | 40% | 60% | 0 | 13.2 | -1 |
| T3×starter | Thornmother Ysolde (ysolde) | starter:white | 47% | 53% | 0 | 11.2 | +2 |
| T3×starter | Thornmother Ysolde (ysolde) | starter:blue | 74% | 26% | 0 | 12.6 | -4 |
| T3×starter | Thornmother Ysolde (ysolde) | starter:black | 56% | 44% | 0 | 14.2 | +0 |
| T3×starter | Thornmother Ysolde (ysolde) | starter:red | 66% | 34% | 0 | 11.0 | +0 |
| T3×starter | Thornmother Ysolde (ysolde) | starter:green | 66% | 34% | 0 | 10.9 | +0 |
| T3×starter | Magister Quill (quill) | starter:white | 28% (71% by library) | 72% | 0 | 11.6 | -1 |
| T3×starter | Magister Quill (quill) | starter:blue | 36% (78% by library) | 64% | 0 | 15.2 | -18 |
| T3×starter | Magister Quill (quill) | starter:black | 48% (83% by library) | 52% | 0 | 16.0 | +2 |
| T3×starter | Magister Quill (quill) | starter:red | 41% (56% by library) | 59% | 0 | 12.6 | +0 |
| T3×starter | Magister Quill (quill) | starter:green | 32% (38% by library) | 68% | 0 | 11.9 | +0 |

## 6. The beasts vs the five starters (each beast at its catalog life/profile; starters at 10 / journeyman) — is the part-5 gap the lists, or the tiers?

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| beast×starter | A Grizzly Bear (beast:grizzly) | starter:white | 10% | 90% | 0 | 9.8 | — |
| beast×starter | A Grizzly Bear (beast:grizzly) | starter:blue | 24% | 76% | 0 | 12.5 | — |
| beast×starter | A Grizzly Bear (beast:grizzly) | starter:black | 29% | 71% | 0 | 12.8 | — |
| beast×starter | A Grizzly Bear (beast:grizzly) | starter:red | 29% | 71% | 0 | 10.1 | — |
| beast×starter | A Grizzly Bear (beast:grizzly) | starter:green | 27% | 73% | 0 | 11.4 | — |
| beast×starter | The Deadly Recluse (beast:recluse) | starter:white | 30% | 70% | 0 | 13.1 | — |
| beast×starter | The Deadly Recluse (beast:recluse) | starter:blue | 41% | 59% | 0 | 17.6 | — |
| beast×starter | The Deadly Recluse (beast:recluse) | starter:black | 27% (15% by library) | 73% | 0 | 19.9 | — |
| beast×starter | The Deadly Recluse (beast:recluse) | starter:red | 18% | 82% | 0 | 11.6 | — |
| beast×starter | The Deadly Recluse (beast:recluse) | starter:green | 46% | 54% | 0 | 12.7 | — |
| beast×starter | A Bloom of Man-o'-War (beast:manowar) | starter:white | 8% | 92% | 0 | 11.9 | — |
| beast×starter | A Bloom of Man-o'-War (beast:manowar) | starter:blue | 31% | 69% | 0 | 18.4 | — |
| beast×starter | A Bloom of Man-o'-War (beast:manowar) | starter:black | 26% | 74% | 0 | 15.7 | — |
| beast×starter | A Bloom of Man-o'-War (beast:manowar) | starter:red | 19% | 81% | 0 | 9.9 | — |
| beast×starter | A Bloom of Man-o'-War (beast:manowar) | starter:green | 25% | 75% | 0 | 12.9 | — |
| beast×starter | The Cunning Tactician (beast:tactician) | starter:white | 12% | 88% | 0 | 10.7 | — |
| beast×starter | The Cunning Tactician (beast:tactician) | starter:blue | 25% | 75% | 0 | 13.4 | — |
| beast×starter | The Cunning Tactician (beast:tactician) | starter:black | 31% (6% by library) | 69% | 0 | 15.2 | — |
| beast×starter | The Cunning Tactician (beast:tactician) | starter:red | 21% | 79% | 0 | 11.8 | — |
| beast×starter | The Cunning Tactician (beast:tactician) | starter:green | 21% (5% by library) | 79% | 0 | 12.2 | — |
| beast×starter | The Boggart Warband (beast:warband) | starter:white | 39% | 61% | 0 | 9.5 | — |
| beast×starter | The Boggart Warband (beast:warband) | starter:blue | 62% | 38% | 0 | 11.2 | — |
| beast×starter | The Boggart Warband (beast:warband) | starter:black | 49% | 51% | 0 | 12.6 | — |
| beast×starter | The Boggart Warband (beast:warband) | starter:red | 46% | 54% | 0 | 9.5 | — |
| beast×starter | The Boggart Warband (beast:warband) | starter:green | 45% | 55% | 0 | 10.4 | — |
| beast×starter | A Vampire Nighthawk (beast:nighthawk) | starter:white | 58% | 42% | 0 | 15.1 | — |
| beast×starter | A Vampire Nighthawk (beast:nighthawk) | starter:blue | 73% | 27% | 0 | 15.9 | — |
| beast×starter | A Vampire Nighthawk (beast:nighthawk) | starter:black | 92% (11% by library) | 8% | 0 | 22.2 | — |
| beast×starter | A Vampire Nighthawk (beast:nighthawk) | starter:red | 82% | 18% | 0 | 14.1 | — |
| beast×starter | A Vampire Nighthawk (beast:nighthawk) | starter:green | 85% | 15% | 0 | 13.4 | — |
| beast×starter | The Living Gale (beast:gale) | starter:white | 13% | 87% | 0 | 12.3 | — |
| beast×starter | The Living Gale (beast:gale) | starter:blue | 24% | 76% (1% by library) | 0 | 19.1 | — |
| beast×starter | The Living Gale (beast:gale) | starter:black | 42% | 58% | 0 | 15.1 | — |
| beast×starter | The Living Gale (beast:gale) | starter:red | 16% | 84% | 0 | 10.5 | — |
| beast×starter | The Living Gale (beast:gale) | starter:green | 28% | 72% | 0 | 12.1 | — |
| beast×starter | The Siege-Gang (beast:siegegang) | starter:white | 53% | 47% | 0 | 10.4 | — |
| beast×starter | The Siege-Gang (beast:siegegang) | starter:blue | 56% | 44% | 0 | 13.9 | — |
| beast×starter | The Siege-Gang (beast:siegegang) | starter:black | 62% | 38% | 0 | 15.5 | — |
| beast×starter | The Siege-Gang (beast:siegegang) | starter:red | 66% | 34% | 0 | 11.4 | — |
| beast×starter | The Siege-Gang (beast:siegegang) | starter:green | 54% | 46% | 0 | 11.1 | — |
| beast×starter | The Hypnotic Specter (beast:specter) | starter:white | 20% | 80% | 0 | 13.7 | — |
| beast×starter | The Hypnotic Specter (beast:specter) | starter:blue | 30% | 70% (1% by library) | 0 | 18.4 | — |
| beast×starter | The Hypnotic Specter (beast:specter) | starter:black | 29% | 71% (3% by library) | 0 | 13.8 | — |
| beast×starter | The Hypnotic Specter (beast:specter) | starter:red | 27% | 73% | 0 | 11.8 | — |
| beast×starter | The Hypnotic Specter (beast:specter) | starter:green | 46% | 54% | 0 | 12.2 | — |
| beast×starter | The Serra Angel (beast:serra) | starter:white | 79% | 21% | 0 | 16.1 | — |
| beast×starter | The Serra Angel (beast:serra) | starter:blue | 82% | 18% | 0 | 20.5 | — |
| beast×starter | The Serra Angel (beast:serra) | starter:black | 86% (1% by library) | 14% | 0 | 18.8 | — |
| beast×starter | The Serra Angel (beast:serra) | starter:red | 84% | 16% | 0 | 13.6 | — |
| beast×starter | The Serra Angel (beast:serra) | starter:green | 76% | 24% | 0 | 13.4 | — |
| beast×starter | A Plague of Rats (beast:rats) | starter:white | 16% | 84% | 0 | 11.4 | — |
| beast×starter | A Plague of Rats (beast:rats) | starter:blue | 39% | 61% | 0 | 14.4 | — |
| beast×starter | A Plague of Rats (beast:rats) | starter:black | 23% (4% by library) | 77% (4% by library) | 0 | 17.6 | — |
| beast×starter | A Plague of Rats (beast:rats) | starter:red | 23% | 77% (1% by library) | 0 | 13.9 | — |
| beast×starter | A Plague of Rats (beast:rats) | starter:green | 30% (7% by library) | 70% (1% by library) | 0 | 13.8 | — |
| beast×starter | A Gray Ogre (beast:ogre) | starter:white | 11% | 89% | 0 | 10.3 | — |
| beast×starter | A Gray Ogre (beast:ogre) | starter:blue | 27% | 73% | 0 | 12.5 | — |
| beast×starter | A Gray Ogre (beast:ogre) | starter:black | 22% | 78% | 0 | 13.1 | — |
| beast×starter | A Gray Ogre (beast:ogre) | starter:red | 21% | 79% | 0 | 10.6 | — |
| beast×starter | A Gray Ogre (beast:ogre) | starter:green | 16% | 84% | 0 | 10.3 | — |
| beast×starter | A Savannah Lion (beast:lion) | starter:white | 36% | 64% | 0 | 13.2 | — |
| beast×starter | A Savannah Lion (beast:lion) | starter:blue | 66% | 34% | 0 | 12.1 | — |
| beast×starter | A Savannah Lion (beast:lion) | starter:black | 54% (2% by library) | 46% | 0 | 12.8 | — |
| beast×starter | A Savannah Lion (beast:lion) | starter:red | 44% | 56% | 0 | 12.5 | — |
| beast×starter | A Savannah Lion (beast:lion) | starter:green | 49% | 51% | 0 | 11.5 | — |
| beast×starter | A Rumbling Baloth (beast:baloth) | starter:white | 38% | 62% | 0 | 12.0 | — |
| beast×starter | A Rumbling Baloth (beast:baloth) | starter:blue | 36% | 64% | 0 | 15.1 | — |
| beast×starter | A Rumbling Baloth (beast:baloth) | starter:black | 28% | 72% | 0 | 17.2 | — |
| beast×starter | A Rumbling Baloth (beast:baloth) | starter:red | 62% | 38% | 0 | 12.2 | — |
| beast×starter | A Rumbling Baloth (beast:baloth) | starter:green | 60% | 40% | 0 | 12.7 | — |
| beast×starter | The Faerie Formation (beast:formation) | starter:white | 38% | 62% (5% by library) | 0 | 14.9 | — |
| beast×starter | The Faerie Formation (beast:formation) | starter:blue | 38% | 62% (13% by library) | 0 | 21.9 | — |
| beast×starter | The Faerie Formation (beast:formation) | starter:black | 71% | 29% (14% by library) | 0 | 17.2 | — |
| beast×starter | The Faerie Formation (beast:formation) | starter:red | 58% | 42% | 0 | 12.3 | — |
| beast×starter | The Faerie Formation (beast:formation) | starter:green | 58% | 42% | 0 | 13.7 | — |
| beast×starter | The Pelakka Wurm (beast:wurm) | starter:white | 48% | 52% | 0 | 11.7 | — |
| beast×starter | The Pelakka Wurm (beast:wurm) | starter:blue | 62% | 38% | 0 | 15.0 | — |
| beast×starter | The Pelakka Wurm (beast:wurm) | starter:black | 64% | 36% | 0 | 15.0 | — |
| beast×starter | The Pelakka Wurm (beast:wurm) | starter:red | 62% | 38% | 0 | 10.8 | — |
| beast×starter | The Pelakka Wurm (beast:wurm) | starter:green | 66% | 34% | 0 | 11.5 | — |

## 7. Tier-2 and tier-3 mages vs the mid-road references (ADR-111: a starter + eight shop cards, one manalink basic in play, 12 life, journeyman)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T2×road | Mistress Vael (vael) | road-mid-W | 20% | 80% | 0 | 15.7 | — |
| T2×road | Mistress Vael (vael) | road-mid-B | 61% (26% by library) | 39% | 0 | 30.7 | — |
| T2×road | Kessa Emberhand (kessa) | road-mid-W | 7% | 93% | 0 | 12.7 | — |
| T2×road | Kessa Emberhand (kessa) | road-mid-B | 9% | 91% | 0 | 16.9 | — |
| T2×road | Adept Maelin (maelin) | road-mid-W | 6% | 94% | 0 | 10.0 | — |
| T2×road | Adept Maelin (maelin) | road-mid-B | 16% (13% by library) | 84% | 0 | 16.0 | — |
| T2×road | Brennor of the Glade (brennor) | road-mid-W | 16% | 84% | 0 | 11.1 | — |
| T2×road | Brennor of the Glade (brennor) | road-mid-B | 21% (24% by library) | 79% | 0 | 20.2 | — |
| T2×road | Pell of the Shallows (pell) | road-mid-W | 6% (100% by library) | 94% | 0 | 9.6 | — |
| T2×road | Pell of the Shallows (pell) | road-mid-B | 7% (100% by library) | 93% | 0 | 12.0 | — |
| T3×road | Lord Corvane (corvane) | road-mid-W | 10% | 90% | 0 | 11.3 | — |
| T3×road | Lord Corvane (corvane) | road-mid-B | 12% (8% by library) | 88% | 0 | 16.6 | — |
| T3×road | Varro Flamebrand (varro) | road-mid-W | 18% (39% by library) | 82% | 0 | 13.4 | — |
| T3×road | Varro Flamebrand (varro) | road-mid-B | 14% (50% by library) | 86% | 0 | 15.8 | — |
| T3×road | High Warden Sorrel (sorrel) | road-mid-W | 12% | 88% | 0 | 13.3 | — |
| T3×road | High Warden Sorrel (sorrel) | road-mid-B | 14% | 86% | 0 | 16.8 | — |
| T3×road | Thornmother Ysolde (ysolde) | road-mid-W | 20% | 80% | 0 | 11.3 | — |
| T3×road | Thornmother Ysolde (ysolde) | road-mid-B | 22% | 78% | 0 | 14.7 | — |
| T3×road | Magister Quill (quill) | road-mid-W | 8% (25% by library) | 92% | 0 | 10.3 | — |
| T3×road | Magister Quill (quill) | road-mid-B | 18% (39% by library) | 82% | 0 | 14.4 | — |

## 3. Children vs parents (parent mage at tier-1 settings; parent beast at its own)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T2×parent | Mistress Vael (vael) | Sister Oriel (oriel) | 55% | 45% | 0 | 23.3 | -1 |
| T2×parent | Mistress Vael (vael) | Pale Edric (edric) | 57% (2% by library) | 43% (2% by library) | 0 | 22.9 | +0 |
| T2×parent | Kessa Emberhand (kessa) | Brann the Scorched (brann) | 38% | 62% | 0 | 12.6 | +1 |
| T2×parent | Kessa Emberhand (kessa) | A Bloom of Man-o'-War (beast:manowar) | 79% | 21% | 0 | 16.8 | +7 |
| T2×parent | Adept Maelin (maelin) | Pale Edric (edric) | 34% | 66% | 0 | 15.4 | +0 |
| T2×parent | Adept Maelin (maelin) | The Boggart Warband (beast:warband) | 35% | 65% | 0 | 10.4 | +0 |
| T2×parent | Brennor of the Glade (brennor) | Old Hask (hask) | 59% | 41% | 0 | 12.3 | +1 |
| T2×parent | Brennor of the Glade (brennor) | Sister Oriel (oriel) | 32% | 68% | 0 | 14.5 | -4 |
| T2×parent | Pell of the Shallows (pell) | Tessaly Reed (tessaly) | 53% (28% by library) | 47% (91% by library) | 0 | 12.6 | -12 |
| T2×parent | Pell of the Shallows (pell) | Old Hask (hask) | 40% (30% by library) | 60% | 0 | 11.7 | +0 |
| T3×parent | Lord Corvane (corvane) | Pale Edric (edric) | 52% | 48% | 0 | 16.1 | -2 |
| T3×parent | Lord Corvane (corvane) | The Serra Angel (beast:serra) | 14% | 86% | 0 | 16.8 | +2 |
| T3×parent | Varro Flamebrand (varro) | Tessaly Reed (tessaly) | 74% (12% by library) | 26% (88% by library) | 0 | 13.1 | +1 |
| T3×parent | Varro Flamebrand (varro) | Brann the Scorched (brann) | 66% | 34% | 0 | 13.4 | +0 |
| T3×parent | High Warden Sorrel (sorrel) | Brann the Scorched (brann) | 58% | 42% | 0 | 13.8 | -1 |
| T3×parent | High Warden Sorrel (sorrel) | The Hypnotic Specter (beast:specter) | 57% (2% by library) | 43% | 0 | 16.6 | +4 |
| T3×parent | Thornmother Ysolde (ysolde) | Old Hask (hask) | 68% | 32% | 0 | 10.3 | +0 |
| T3×parent | Thornmother Ysolde (ysolde) | A Savannah Lion (beast:lion) | 54% | 46% | 0 | 12.1 | +0 |
| T3×parent | Magister Quill (quill) | Tessaly Reed (tessaly) | 54% (33% by library) | 46% (89% by library) | 0 | 12.9 | +1 |
| T3×parent | Magister Quill (quill) | The Pelakka Wurm (beast:wurm) | 31% (77% by library) | 69% | 0 | 12.8 | -1 |

## Cast counts per mage (every game the deck played in this run; casts per game in brackets; NEVER CAST listed)

- **Sister Oriel (oriel)** — 1100 games — Soul Warden ×4: 1604 (1.46) · Suntail Hawk ×3: 1241 (1.13) · Youthful Valkyrie ×3: 1234 (1.12) · Inspiring Overseer ×2: 776 (0.71) · Master Decoy ×2: 773 (0.70) · Spirit Link ×2: 789 (0.72) · Pacifism ×2: 693 (0.63) · Raise the Alarm ×2: 799 (0.73) · Swords to Plowshares ×1: 386 (0.35) · Glorious Anthem ×1: 324 (0.29) · Restoration Angel ×1: 284 (0.26) — **returned from the graveyard**: Child of Night 0 (0.00) · Typhoid Rats 0 (0.00) · Reassembling Skeleton 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Vampire Nighthawk 0 (0.00) · Blood Artist 0 (0.00) · Soul Warden 0 (0.00) · Suntail Hawk 0 (0.00) · Youthful Valkyrie 0 (0.00)
- **Tessaly Reed (tessaly)** — 1200 games — Hedron Crab ×4: 1476 (1.23) · Cathartic Adept ×4: 1557 (1.30) · Traumatizer ×3: 881 (0.73) · Plumecreed Escort ×2: 773 (0.64) · Thought Scour ×2: 790 (0.66) · Brainstorm ×2: 745 (0.62) · Essence Scatter ×2: 367 (0.31) · Counterspell ×1: 239 (0.20) · Altar of Dementia ×2: 651 (0.54) — **returned from the graveyard**: Typhoid Rats 0 (0.00) · Vampire Nighthawk 0 (0.00) · Reassembling Skeleton 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Child of Night 0 (0.00) · Gravedigger 0 (0.00) · Blood Artist 0 (0.00)
- **Pale Edric (edric)** — 1200 games — Unearth ×3: 969 (0.81) · Zombify ×1: 219 (0.18) · Gravedigger ×2: 560 (0.47) · Vampire Nighthawk ×2: 752 (0.63) · Blood Artist ×2: 637 (0.53) · Indulgent Aristocrat ×2: 993 (0.83) · Reassembling Skeleton ×2: 771 (0.64) · Child of Night ×2: 791 (0.66) · Typhoid Rats ×4: 1803 (1.50) · Terror ×2: 685 (0.57) · Dark Ritual ×1: 290 (0.24) — **returned from the graveyard**: Reassembling Skeleton 1058 (0.88) · Typhoid Rats 476 (0.40) · Indulgent Aristocrat 271 (0.23) · Child of Night 168 (0.14) · Vampire Nighthawk 105 (0.09) · Blood Artist 48 (0.04) · Gravedigger 29 (0.02) · Soul Warden 0 (0.00) · Suntail Hawk 0 (0.00) · Youthful Valkyrie 0 (0.00) · Goblin Piker 0 (0.00) · Skirk Prospector 0 (0.00) · Artisan of Kozilek 0 (0.00) · Serra Angel 0 (0.00) · Restoration Angel 0 (0.00)
- **Brann the Scorched (brann)** — 1200 games — Young Pyromancer ×3: 937 (0.78) · Arc Mage ×2: 496 (0.41) · Lightning Bolt ×3: 1090 (0.91) · Shock ×3: 1123 (0.94) · Abrade ×2: 626 (0.52) · Blaze ×2: 596 (0.50) · Brute Force ×2: 481 (0.40) · Hordeling Outburst ×2: 433 (0.36) · Goblin Piker ×2: 599 (0.50) · Thundersnake ×1: 297 (0.25) · Pyroclasm ×1: 169 (0.14) — **returned from the graveyard**: Reassembling Skeleton 0 (0.00) · Blood Artist 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Gravedigger 0 (0.00) · Vampire Nighthawk 0 (0.00) · Typhoid Rats 0 (0.00) · Child of Night 0 (0.00) · Arc Mage 0 (0.00) · Young Pyromancer 0 (0.00) · Hypnotic Specter 0 (0.00)
- **Old Hask (hask)** — 1200 games — Gladecover Scout ×4: 1472 (1.23) · Blurred Mongoose ×3: 953 (0.79) · Birds of Paradise ×2: 686 (0.57) · Rancor ×3: 1238 (1.03) · Blanchwood Armor ×3: 697 (0.58) · Timberland Guide ×2: 735 (0.61) · Giant Growth ×3: 910 (0.76) · Prey Upon ×2: 583 (0.49) · Wall of Blossoms ×2: 570 (0.47) — **returned from the graveyard**: Indulgent Aristocrat 0 (0.00) · Reassembling Skeleton 0 (0.00) · Blood Artist 0 (0.00) · Child of Night 0 (0.00) · Typhoid Rats 0 (0.00) · Gravedigger 0 (0.00) · Vampire Nighthawk 0 (0.00)
- **Mistress Vael (vael)** — 1300 games — Soul Warden ×3: 1714 (1.32) · Suntail Hawk ×2: 1114 (0.86) · Youthful Valkyrie ×2: 1184 (0.91) · Child of Night ×2: 1073 (0.83) · Vampire Nighthawk ×2: 1129 (0.87) · Blood Artist ×2: 972 (0.75) · Indulgent Aristocrat ×2: 1081 (0.83) · Spirit Link ×2: 971 (0.75) · Unearth ×2: 946 (0.73) · Gravedigger ×1: 472 (0.36) · Swords to Plowshares ×1: 525 (0.40) · Pacifism ×1: 475 (0.37) · Wrath of God ×1: 353 (0.27) — **returned from the graveyard**: Soul Warden 231 (0.18) · Vampire Nighthawk 142 (0.11) · Suntail Hawk 140 (0.11) · Youthful Valkyrie 137 (0.11) · Indulgent Aristocrat 135 (0.10) · Child of Night 135 (0.10) · Blood Artist 26 (0.02) · Typhoid Rats 0 (0.00) · Skirk Prospector 0 (0.00) · Goblin Piker 0 (0.00) · Phyrexian Rager 0 (0.00) · Reassembling Skeleton 0 (0.00) · Gravedigger 0 (0.00)
- **Kessa Emberhand (kessa)** — 1300 games — Young Pyromancer ×3: 1418 (1.09) · Arc Mage ×3: 1126 (0.87) · Man-o'-War ×2: 976 (0.75) · Lightning Bolt ×3: 1385 (1.07) · Shock ×2: 835 (0.64) · Blaze ×1: 347 (0.27) · Hordeling Outburst ×1: 252 (0.19) · Plumecreed Escort ×1: 439 (0.34) · Brainstorm ×3: 1062 (0.82) · Boomerang ×1: 312 (0.24) · Essence Scatter ×2: 481 (0.37) · Counterspell ×1: 197 (0.15) — **returned from the graveyard**: Indulgent Aristocrat 0 (0.00) · Blood Artist 0 (0.00) · Vampire Nighthawk 0 (0.00) · Suntail Hawk 0 (0.00) · Child of Night 0 (0.00) · Soul Warden 0 (0.00) · Youthful Valkyrie 0 (0.00) · Goblin Piker 0 (0.00) · Typhoid Rats 0 (0.00) · Skirk Prospector 0 (0.00) · Phyrexian Rager 0 (0.00)
- **Adept Maelin (maelin)** — 1300 games — Skirk Prospector ×2: 895 (0.69) · Goblin Piker ×2: 887 (0.68) · Hordeling Outburst ×2: 507 (0.39) · Goblin Grenade ×2: 478 (0.37) · Indulgent Aristocrat ×2: 887 (0.68) · Blood Artist ×2: 768 (0.59) · Unearth ×2: 607 (0.47) · Gravedigger ×2: 630 (0.48) · Gallows Djinn ×1: 276 (0.21) · Dark Ritual ×1: 294 (0.23) · Lightning Bolt ×1: 397 (0.31) · Terror ×1: 304 (0.23) · Siege-Gang Commander ×1: 239 (0.18) · Typhoid Rats ×2: 848 (0.65) — **returned from the graveyard**: Goblin Piker 196 (0.15) · Skirk Prospector 172 (0.13) · Indulgent Aristocrat 101 (0.08) · Typhoid Rats 94 (0.07) · Blood Artist 43 (0.03) · Youthful Valkyrie 0 (0.00) · Vampire Nighthawk 0 (0.00) · Soul Warden 0 (0.00) · Suntail Hawk 0 (0.00) · Child of Night 0 (0.00) · Phyrexian Rager 0 (0.00) · Reassembling Skeleton 0 (0.00) · Gravedigger 0 (0.00)
- **Brennor of the Glade (brennor)** — 1300 games — Gladecover Scout ×3: 1287 (0.99) · Blurred Mongoose ×2: 803 (0.62) · Birds of Paradise ×2: 859 (0.66) · Soul Warden ×2: 801 (0.62) · Youthful Valkyrie ×2: 943 (0.73) · Rancor ×2: 1078 (0.83) · Blanchwood Armor ×2: 660 (0.51) · Spirit Link ×2: 723 (0.56) · Giant Growth ×2: 705 (0.54) · Glorious Anthem ×1: 303 (0.23) · Swords to Plowshares ×1: 430 (0.33) · Pacifism ×1: 371 (0.29) · Restoration Angel ×1: 276 (0.21) — **returned from the graveyard**: Soul Warden 0 (0.00) · Suntail Hawk 0 (0.00) · Child of Night 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Youthful Valkyrie 0 (0.00) · Vampire Nighthawk 0 (0.00) · Blood Artist 0 (0.00) · Skirk Prospector 0 (0.00) · Goblin Piker 0 (0.00) · Typhoid Rats 0 (0.00) · Phyrexian Rager 0 (0.00)
- **Pell of the Shallows (pell)** — 1300 games — Hedron Crab ×4: 1473 (1.13) · Traumatizer ×3: 966 (0.74) · Rampant Growth ×3: 823 (0.63) · Wood Elves ×2: 710 (0.55) · Grazing Gladehart ×2: 695 (0.53) · Rumbling Baloth ×2: 567 (0.44) · Rancor ×2: 981 (0.75) · Giant Growth ×2: 522 (0.40) · Birds of Paradise ×1: 368 (0.28) · Brainstorm ×1: 346 (0.27) · Altar of Dementia ×1: 311 (0.24) — **returned from the graveyard**: Vampire Nighthawk 0 (0.00) · Youthful Valkyrie 0 (0.00) · Soul Warden 0 (0.00) · Child of Night 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Suntail Hawk 0 (0.00) · Skirk Prospector 0 (0.00) · Typhoid Rats 0 (0.00) · Goblin Piker 0 (0.00) · Blood Artist 0 (0.00) · Phyrexian Rager 0 (0.00)
- **Lord Corvane (corvane)** — 1300 games — Youthful Valkyrie ×2: 992 (0.76) · Indulgent Aristocrat ×2: 919 (0.71) · Blood Artist ×2: 768 (0.59) · Terror ×1: 318 (0.24) · Dark Ritual ×2: 688 (0.53) · Unearth ×1: 308 (0.24) · Zombify ×3: 854 (0.66) · Buried Alive ×3: 569 (0.44) · Restoration Angel ×1: 316 (0.24) · Serra Angel ×3: 784 (0.60) · Artisan of Kozilek ×1: 34 (0.03) · Swords to Plowshares ×2: 872 (0.67) — **returned from the graveyard**: Serra Angel 266 (0.20) · Indulgent Aristocrat 262 (0.20) · Youthful Valkyrie 255 (0.20) · Artisan of Kozilek 236 (0.18) · Blood Artist 109 (0.08) · Restoration Angel 47 (0.04) · Young Pyromancer 0 (0.00) · Arc Mage 0 (0.00) · Vampire Nighthawk 0 (0.00) · Hypnotic Specter 0 (0.00) · Child of Night 0 (0.00) · Typhoid Rats 0 (0.00) · Phyrexian Rager 0 (0.00) · Reassembling Skeleton 0 (0.00) · Gravedigger 0 (0.00)
- **Varro Flamebrand (varro)** — 1300 games — Hedron Crab ×3: 1242 (0.96) · Young Pyromancer ×2: 911 (0.70) · Arc Mage ×2: 892 (0.69) · Traumatizer ×2: 600 (0.46) · Lightning Bolt ×3: 1440 (1.11) · Shock ×2: 865 (0.67) · Blaze ×1: 351 (0.27) · Brainstorm ×2: 784 (0.60) · Divination ×1: 336 (0.26) · Boomerang ×2: 632 (0.49) · Counterspell ×1: 277 (0.21) · Essence Scatter ×1: 296 (0.23) · Faerie Formation ×1: 242 (0.19) — **returned from the graveyard**: Youthful Valkyrie 0 (0.00) · Artisan of Kozilek 0 (0.00) · Serra Angel 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Blood Artist 0 (0.00) · Restoration Angel 0 (0.00) · Young Pyromancer 0 (0.00) · Hypnotic Specter 0 (0.00) · Vampire Nighthawk 0 (0.00) · Arc Mage 0 (0.00) · Child of Night 0 (0.00) · Typhoid Rats 0 (0.00) · Phyrexian Rager 0 (0.00)
- **High Warden Sorrel (sorrel)** — 1300 games — Young Pyromancer ×3: 1245 (0.96) · Arc Mage ×2: 765 (0.59) · Hypnotic Specter ×2: 587 (0.45) · Hymn to Tourach ×1: 202 (0.16) · Duress ×2: 609 (0.47) · Mind Rot ×2: 380 (0.29) · Lightning Bolt ×3: 1222 (0.94) · Shock ×2: 809 (0.62) · Blaze ×1: 395 (0.30) · Terror ×1: 296 (0.23) · Diabolic Edict ×1: 384 (0.30) · Vampire Nighthawk ×1: 388 (0.30) · Dark Ritual ×1: 286 (0.22) · Unearth ×1: 252 (0.19) — **returned from the graveyard**: Young Pyromancer 96 (0.07) · Arc Mage 64 (0.05) · Hypnotic Specter 60 (0.05) · Vampire Nighthawk 32 (0.02) · Artisan of Kozilek 0 (0.00) · Serra Angel 0 (0.00) · Youthful Valkyrie 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Blood Artist 0 (0.00) · Restoration Angel 0 (0.00) · Child of Night 0 (0.00) · Phyrexian Rager 0 (0.00) · Typhoid Rats 0 (0.00)
- **Thornmother Ysolde (ysolde)** — 1300 games — Savannah Lions ×2: 787 (0.61) · Suntail Hawk ×2: 834 (0.64) · Fencing Ace ×2: 722 (0.56) · Gladecover Scout ×2: 804 (0.62) · Blurred Mongoose ×2: 767 (0.59) · Birds of Paradise ×2: 775 (0.60) · Raise the Alarm ×2: 725 (0.56) · Glorious Anthem ×2: 535 (0.41) · Rancor ×2: 1026 (0.79) · Blanchwood Armor ×2: 612 (0.47) · Giant Growth ×1: 314 (0.24) · Swords to Plowshares ×1: 405 (0.31) · Serra Angel ×1: 197 (0.15) — **returned from the graveyard**: Serra Angel 0 (0.00) · Youthful Valkyrie 0 (0.00) · Restoration Angel 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Artisan of Kozilek 0 (0.00) · Blood Artist 0 (0.00) · Arc Mage 0 (0.00) · Young Pyromancer 0 (0.00) · Hypnotic Specter 0 (0.00) · Vampire Nighthawk 0 (0.00) · Typhoid Rats 0 (0.00) · Phyrexian Rager 0 (0.00) · Child of Night 0 (0.00)
- **Magister Quill (quill)** — 1300 games — Hedron Crab ×4: 1479 (1.14) · Rampant Growth ×3: 712 (0.55) · Llanowar Elves ×2: 870 (0.67) · Wood Elves ×2: 848 (0.65) · Wall of Blossoms ×1: 402 (0.31) · Traumatizer ×1: 419 (0.32) · Gaean Wurm ×2: 702 (0.54) · Pelakka Wurm ×1: 186 (0.14) · Baru, Wurmspeaker ×1: 353 (0.27) · Altar of Dementia ×2: 814 (0.63) · Essence Scatter ×2: 539 (0.41) · Counterspell ×1: 296 (0.23) · Brainstorm ×1: 353 (0.27) — **returned from the graveyard**: Youthful Valkyrie 0 (0.00) · Artisan of Kozilek 0 (0.00) · Serra Angel 0 (0.00) · Restoration Angel 0 (0.00) · Indulgent Aristocrat 0 (0.00) · Blood Artist 0 (0.00) · Vampire Nighthawk 0 (0.00) · Arc Mage 0 (0.00) · Young Pyromancer 0 (0.00) · Hypnotic Specter 0 (0.00) · Child of Night 0 (0.00) · Phyrexian Rager 0 (0.00) · Typhoid Rats 0 (0.00)


   **The reads.**
   - **The mid-road yardstick (part 7) is decisive: every tier-2 and tier-3 mage loses 78–94% to a mid-road starter** (Vael is the one exception — 61% over road-mid-B, 20% under road-mid-W). A journeyman piloting Dawn Levy plus eight shop cards at 12 life beats the tier-3 masters at their tier life in nine games of ten. This is the read ADR-111 wanted before the tier-life argument: the ladder's opponents are not merely below the player's deck, they are two full steps below a mid-road one.
   - **The beasts (part 6) tell the same story from the catalog side**: the tier-1 beasts lose to every starter (Grizzly 10–29%, Man-o'-War 8–31, the Tactician 12–31, the Ogre 11–27, the Rats 16–39, the Gale 13–42, the Specter 20–46, the Recluse 18–46); only the top of the bestiary stands (the Serra 76–86%, the Nighthawk 58–92, the Siege-Gang 47–66, the Wurm 48–66, the Formation 38–71). The starters at journeyman are in the tier-3 beasts' band — the gap is the tiers, not the mage lists.
   - **Tessaly moved at last**: inside the tier 26 / 28 / **35** (+8 / +3 / +12), and her wins are no longer all by library (61–77% — the Escorts and the Traumatizer kill now); against the starters 14 / 52 / 30 / 29 / 23 (blue −15: the blue starter got the same Escorts). The Escort cast 0.64/game. She is in ADR-103's band against black (30) and near it against red (29); white still walls her (14).
   - **Corvane's engine turns and the deck still falls**: returned per game — the Serra 0.20, the Aristocrat 0.20, the Valkyrie 0.20, **the Artisan 0.18**; Dark Ritual cast 0.53/game, Buried Alive 0.44, Zombify 0.66. Inside the tier 66 / 46 / 26 / 50 (−4 / −5 / +1 / −3); against the starters 32 / 32 / 28 / 35 / 38 (white +8, black **−16**, red −11, green −6); 14% against the Serra beast. The Rituals bought the turn-two Buried Alive and the Artisan comes back one game in five, but a reanimated 10/9 on turn four is still losing to the starters' curves; against the black starter the Rituals' card disadvantage shows.
   - **Kessa is the Escort's other winner**: 46 / 39 / 73 inside the tier (+6 / +4 / +12), 30 / 51 / 34 / 33 / 45 against the starters (+7 / −4 / +3 / +6 / +11). **Sorrel's Edict** cast 0.30/game; Sorrel 40 / 59 / 45 / 48 / 40 against the starters (−8 / −2 / −2 / −2 / −1 — noise around the Terror it replaced).
   - **The five roads**: **white 78 / 59 / 64 / 64** (blue −3, black −5, red 0, green −3) — the planner's stop rule ("still over 60% against all four") is met on three of four; against black it is 59. **Blue is a road now**: 55 over black (+19), 50 over red (+6), 61 over green (+14) — the Escorts made Tidal Grimoire close. Inside 40–60: white–black, blue–black, blue–red, black–red, red–green (five); outside: white–blue 78, white–red 64, white–green 64, blue–green 61, black–green 74.
   - **Teachers vs the starters**: Oriel 55 / 76 / 59 / 60 / 52 (white +6 — the Overseer/Decoy step slowed Dawn Levy a little); Hask 24 / 51 / 17 / 30 / 37 (blue −14); Edric and Brann unchanged.
   - **`returned` across the field**: Edric's Skeleton comes back 0.88/game (the S30 add is the most-reanimated card in the pool), the Rats 0.40; Vael's Unearth returns Soul Wardens 0.18; Maelin's Piker 0.15; Sorrel's Unearth 0.07–0.05 (the Pyromancer, Arc Mage, the Specter). Nothing in any list went uncast.

2. **The tier-life lever is the planner's next move** (ADR-111): the yardstick says a mid-road player is two steps above the tier-3 ladder as tuned. If tier life is the lever, the numbers to beat are part 7's 78–94%; if the answer is worldcraft elsewhere (the AI profile, manalinks for the mages, shop cards in the mage lists), the same table is the baseline.
3. **Corvane** remains the tier-3 deck the amendments cannot reach by list turns alone — three sessions of turns have moved him between 22 and 46 against the starters. Either the reanimator is a tier-3 identity the tier's life should carry (Concern 2), or the archetype is wrong for a 40-card deck at 12 life against 10-life aggro starters.
4. **White still walls three roads** (78 / 64 / 64) after two trims; the stop rule is met in spirit — the planner's "take the white road as the gentle one to Chris" is due.
5. **The S28 correction** (Deviation 1) means every blue sweep number before this session was measured with Brainstorm never cast at end step; the S31 baseline carries that. Tessaly's, Kessa's, Pell's, Varro's and Quill's deltas mix the Escort/Edict turns with the window opening — the cast counts (Brainstorm's per-copy rate) are the way to tell them apart next session if it matters.
6. **`facts.returned` counts every graveyard → battlefield move**, the Skeleton's self-return and the Artisan's cast trigger included — read it beside the reanimator casts, not as "Zombify resolved".

## Registry entries added/changed

No R-number (both cards zero words); R-094's row notes the Edict, the Escort, the public stack targets and `facts.returned`. Pool-registry: Session 32 section (+2; the S32 AI corrections noted); printings regenerated (`art:fetch`). ADRs 109–111 in `docs/decision-updates/s32.md`. Knobs unchanged. Engine: `RETURNED` log event, `MatchFacts.returned`, `GameView.stack[].targets`. AI: `flashTimingGated`, `edictWasteGated`, the under-fire target preference, the save credit, the two corrections (the END step name, the pump-waste gate's reach); books 49–50 (+ book 36's pin corrected). Sim: `s32-fuzz.test.ts`, `road-decks` +2, `mage-sweep` parts 6–7 + `returned` + `sweep-baselines/s31.json`. World: the two starters; the mid-road sync test. UI: the gallery's mage filter; the annihilator dialog test. CLAUDE.md: the two art lines. `docs/reference/` regenerated.

## Test status

Default tier **573 passed / 2 skipped** (55 files; +8 S32 fixtures, +2 fuzz tests, +2 book pins, +1 mid-road sync test, +1 annihilator dialog test; baselines: the loader's def count 205 → 207, the shop-tier counts 71/51 → 72/52, the blue starter's pin, three `MatchFacts` literals gained `returned`). `pnpm typecheck` clean. **Fuzz-before-fixtures honoured**: 840 games at the full tier, replays byte-exact, before the S32 fixtures. **The FUZZ_FULL ladder gate held and the 100/cell vs-random ladder PASSES** after the Escort, the Edict, the END-step correction and the pump-gate change. Sweep: 22,000 games (parts 1–7, 220 pairings). Browser: the gallery's mage filter verified live (207 cards; Tessaly's eleven); the annihilator dialog verified headlessly through the controller.

## Suggested next

1. **Chris / planner**: the tier-life argument from part 7 (Concern 2); Corvane's identity (3); the white road as the gentle one (4); Deviations 1–4 to ratify (the S28 correction especially).
2. **Planner (S33)**: whatever the tier-life ruling implies for the sweep's tier settings (`TIER_LIFE` in `mage-sweep-cli`) and the catalog; a re-read of the mill decks' Brainstorm rates now that the window is open.
3. **Implementer smalls**: none outstanding from the brief; the dev "single battle" could take a custom-modifier setup so scenes like the annihilator dialog can be walked in the browser.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--part 1|2|3|4|5|6|7] [--baseline none]   # ~15 min; the delta column reads sweep-baselines/s31.json
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /gallery (dev: every card; printed frames by default; deck filter incl. the mages) · /play → any mage vs any mage
```
