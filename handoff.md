# Handoff — after Session 29 (2026-09-05)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues (rounds 4–6 in git).** Session 29 — **the mage cleansheet** — is done: the fifteen mages play fifteen distinct decks (ADR-099; `@shandalar/sim/mage-decks`, `mage:<key>` catalog refs; the slice decks A–E retired from the catalog and kept as sim/test infrastructure), the Cunning Tactician is a beast (ADR-100), six cards entered the pool (ADR-101; 178 → 184, plus the Elemental token), the Altar loop is fixtured as a designed line (ADR-102), `heartLife` is 40 (Part 0), the Chronicle's fifth line counts colours. Engine words in R-092 (modal activated abilities; the sacrificed creature's power as X). Each mage has an epithet on the parley line and **a new portrait** (fifteen faces, two candidates each, candidate 1 wired provisionally — the contact sheet is with Chris). The Part 5 sweep ran in full (6,500 games) — the tables and the read are in Concerns 1. Pool 184 cards (197 defs with tokens and test cards); `docs/reference/` regenerated (cards.md 184 + a tokens table; enemies.md carries the fifteen lists and the epithets).

## Done this session

- **Part 0**: `heartLife` 35 → 40 (easy 35 / hard 45); the Chronicle line leads "A cutting from every colour." (the phase-two tease that followed it stands — see Deviations 5); `docs/decision-updates/s29.md` with ADR-099–102 and the kickoff rulings.
- **Part 1 (R-092)**: `modes` on activated abilities (Arc Mage — one activation per mode × its targets; the stack item carries the mode's targets/effects; the UI's up-to-N targeting presents them: one click + Done = 2 to one, two clicks = the split); `{ref: "sacrificedPower"}` (the Altar — LKI at payment, validator-confined to sacrifice-cost abilities). Young Pyromancer, Soul Warden, Hedron Crab and Blanchwood Armor rode existing collectors (zero words, as billed); the Elemental token def.
- **Part 2**: the six defs from Scryfall verbatim (re-verified by curl; two wordings newer than the doc: the Crab's "a land you control enters", the Altar's "mills cards equal to…"), first printings fetched (EXO/ZEN/M14/NEM/TMP/USG), tiers and prices per the brief (priceOverride where the formula differs).
- **Part 3**: the fifteen lists encoded exactly (every id validated; **one substitution, Chris-ruled**: Reya Dawnbringer out of Lord Corvane's list for a third Serra Angel — she is prizeOnly); `opponents.json` rewired (deck refs, colours per pair, epithets, the Tactician `kind: beast`); `enemyDeck` resolves `mage:`; the single-battle picker lists the mages and the beasts (A–E gone from the player's view); Reya's "tier 1 / 40" was a REFERENCE bug (a prizeOnly card rendered its missing tier as 1) — fixed; Siege-Gang and Serra Angel are tier 3 as stated.
- **Part 4 (AI; each pinned; the FUZZ_FULL ladder gate held, the vs-random ladder PASS)**: mill as damage against the library (quadratic in the fraction milled; emptying it is a win) — generic to every mill effect, so the Crab, the Adept and the Traumatizer share it; the Altar's gate (lethal mill takes the biggest body; otherwise only a doomed creature — blocked/blocking into lethal or targeted on the stack; never the last blocker while behind) and its prediction (the chooser's pick priced by power); Arc Mage's split (kill over face, two X/1s over one — falls out of the damage pricing; pinned); the Pyromancer as the engine (comes down before the cheap spells it feeds); Wrath with a drain observer (Blood Artist / the Usher) counts the drain (Vael); auras on hexproof/shroud hosts and Blanchwood's Forest count (Hask, Ysolde). Books 37–40.
- **Part 5**: `pnpm mage-sweep` — the three round-robins, 100 games per pairing both seats, the tier's profile and life; the table below.
- **Part 6**: eight fixtures — the Altar loop (four iterations by script; the "may" stops it; the end-step sacrifice drains once more, no tangle), the Pyromancer (a countered Bolt still makes the token; no token for a creature), Arc Mage (both modes; never zero targets; the discard), the Altar's X (a resolved Growth counts; one on the stack does not), the Crab (Wilds twice; Rampant Growth), Soul Warden (their creatures; tokens), Blanchwood (Temple Garden), the Chronicle string. Fuzz first: 720 games at the full tier across the fifteen, replays byte-exact.
- **Portrait round (Chris, kickoff ruling 3)**: fifteen subject files × two candidates, thirty renders through the skill, a contact sheet delivered, candidate 1 installed (`/portraits/portrait-mage-<key>.png`, 512px) and wired; MANIFEST rows and the portraits prompt registry updated.

## Deviations from the brief

1. **Reya → a third Serra Angel** in Lord Corvane's list (Chris, kickoff): ADR-099 admits no prizeOnly card and Reya is the Dawnfast's sole-channel prize. The brief's Reya AI item is therefore moot.
2. **A–E retired from the catalog only** (Chris, kickoff): the fuzz pairings, the ladder gate and the replay tests keep them; heart-sim's stock references keep slice C and D.
3. **Portraits were NOT retained** (Chris, kickoff): a portrait round replaced the five shared faces; names retained.
4. **The Pyromancer's end-of-turn cheap-spell timing and Ysolde's Anthem-vs-Armor hand read were not built**: the engine-first bonus and the hexproof/Forest aura pricing cover the parts the sim can see; a "hold burn for EOT with the Pyromancer out" line trades information for nothing the evaluator prices — deferred with a note. Arc Mage's "discard lands first" rides the existing lowest-value discard chooser (lands ARE the lowest); "never the Pyromancer" holds by value.
5. **The Chronicle string**: the brief said the line "becomes" *A cutting from every colour.*; I replaced the counting sentence ("Five cuttings.") and kept the phase-two tease that followed it. If the whole line was meant, it is a one-string edit.
6. **The tokens doc lives in cards.md** (a "Tokens" table at the end) rather than a separate tokens.md.
7. **Ladder deltas** are the gate + the vs-random ladder (both held) — the per-cell before/after table the CLI cannot give.

## Concerns

1. **The sweep (100 games per pairing, both seats; mages at the tier's profile and life — 8/10/12; starters at 10 life piloted at journeyman; beasts at their catalog life/profile):**

## 1. Tier by tier

| part | A | B | A wins | B wins | draws | mean turns |
|---|---|---|---|---|---|---|
| T1 | Sister Oriel (oriel) | Tessaly Reed (tessaly) | 74% | 26% (92% by library) | 0 | 12.7 |
| T1 | Sister Oriel (oriel) | Pale Edric (edric) | 78% | 22% | 0 | 13.9 |
| T1 | Sister Oriel (oriel) | Brann the Scorched (brann) | 74% | 26% | 0 | 12.5 |
| T1 | Sister Oriel (oriel) | Old Hask (hask) | 69% | 31% | 0 | 11.0 |
| T1 | Tessaly Reed (tessaly) | Pale Edric (edric) | 31% (48% by library) | 69% | 0 | 13.3 |
| T1 | Tessaly Reed (tessaly) | Brann the Scorched (brann) | 19% (53% by library) | 81% | 0 | 12.2 |
| T1 | Tessaly Reed (tessaly) | Old Hask (hask) | 21% (43% by library) | 79% | 0 | 10.6 |
| T1 | Pale Edric (edric) | Brann the Scorched (brann) | 46% | 54% | 0 | 12.2 |
| T1 | Pale Edric (edric) | Old Hask (hask) | 47% | 53% | 0 | 12.2 |
| T1 | Brann the Scorched (brann) | Old Hask (hask) | 50% | 50% | 0 | 8.9 |
| T2 | Mistress Vael (vael) | Kessa Emberhand (kessa) | 65% | 35% | 0 | 19.6 |
| T2 | Mistress Vael (vael) | Adept Maelin (maelin) | 67% | 33% | 0 | 16.3 |
| T2 | Mistress Vael (vael) | Brennor of the Glade (brennor) | 65% | 35% | 0 | 19.0 |
| T2 | Mistress Vael (vael) | Pell of the Shallows (pell) | 89% | 11% (82% by library) | 0 | 15.6 |
| T2 | Kessa Emberhand (kessa) | Adept Maelin (maelin) | 41% | 59% | 0 | 14.4 |
| T2 | Kessa Emberhand (kessa) | Brennor of the Glade (brennor) | 39% | 61% | 0 | 13.1 |
| T2 | Kessa Emberhand (kessa) | Pell of the Shallows (pell) | 71% | 29% (34% by library) | 0 | 15.1 |
| T2 | Adept Maelin (maelin) | Brennor of the Glade (brennor) | 55% | 45% | 0 | 12.6 |
| T2 | Adept Maelin (maelin) | Pell of the Shallows (pell) | 82% | 18% (61% by library) | 0 | 14.1 |
| T2 | Brennor of the Glade (brennor) | Pell of the Shallows (pell) | 78% | 22% (73% by library) | 0 | 13.8 |
| T3 | Lord Corvane (corvane) | Varro Flamebrand (varro) | 77% | 23% (26% by library) | 0 | 18.3 |
| T3 | Lord Corvane (corvane) | High Warden Sorrel (sorrel) | 71% | 29% | 0 | 18.3 |
| T3 | Lord Corvane (corvane) | Thornmother Ysolde (ysolde) | 41% | 59% | 0 | 13.0 |
| T3 | Lord Corvane (corvane) | Magister Quill (quill) | 74% | 26% (19% by library) | 0 | 15.8 |
| T3 | Varro Flamebrand (varro) | High Warden Sorrel (sorrel) | 51% (6% by library) | 49% | 0 | 18.3 |
| T3 | Varro Flamebrand (varro) | Thornmother Ysolde (ysolde) | 30% (7% by library) | 70% | 0 | 13.8 |
| T3 | Varro Flamebrand (varro) | Magister Quill (quill) | 56% (13% by library) | 44% (32% by library) | 0 | 16.4 |
| T3 | High Warden Sorrel (sorrel) | Thornmother Ysolde (ysolde) | 34% | 66% | 0 | 12.6 |
| T3 | High Warden Sorrel (sorrel) | Magister Quill (quill) | 72% | 28% (14% by library) | 0 | 15.1 |
| T3 | Thornmother Ysolde (ysolde) | Magister Quill (quill) | 84% | 16% (13% by library) | 0 | 11.6 |

## 2. Teachers vs starters (tier-1 mages at 8 / apprentice; starters at 10 / journeyman)

| part | A | B | A wins | B wins | draws | mean turns |
|---|---|---|---|---|---|---|
| T1×starter | Sister Oriel (oriel) | starter:white | 44% | 56% | 0 | 14.9 |
| T1×starter | Sister Oriel (oriel) | starter:blue | 77% (9% by library) | 23% | 0 | 20.2 |
| T1×starter | Sister Oriel (oriel) | starter:black | 57% (5% by library) | 43% | 0 | 19.4 |
| T1×starter | Sister Oriel (oriel) | starter:red | 59% | 41% | 0 | 12.8 |
| T1×starter | Sister Oriel (oriel) | starter:green | 70% | 30% | 0 | 12.8 |
| T1×starter | Tessaly Reed (tessaly) | starter:white | 10% (80% by library) | 90% | 0 | 10.1 |
| T1×starter | Tessaly Reed (tessaly) | starter:blue | 56% (100% by library) | 44% | 0 | 13.4 |
| T1×starter | Tessaly Reed (tessaly) | starter:black | 23% (87% by library) | 77% | 0 | 12.5 |
| T1×starter | Tessaly Reed (tessaly) | starter:red | 30% (83% by library) | 70% | 0 | 11.1 |
| T1×starter | Tessaly Reed (tessaly) | starter:green | 35% (91% by library) | 65% | 0 | 11.3 |
| T1×starter | Pale Edric (edric) | starter:white | 4% | 96% | 0 | 10.7 |
| T1×starter | Pale Edric (edric) | starter:blue | 25% | 75% | 0 | 14.8 |
| T1×starter | Pale Edric (edric) | starter:black | 22% (14% by library) | 78% | 0 | 18.0 |
| T1×starter | Pale Edric (edric) | starter:red | 27% | 73% | 0 | 12.2 |
| T1×starter | Pale Edric (edric) | starter:green | 32% | 68% | 0 | 14.1 |
| T1×starter | Brann the Scorched (brann) | starter:white | 20% | 80% | 0 | 12.0 |
| T1×starter | Brann the Scorched (brann) | starter:blue | 65% | 35% | 0 | 12.9 |
| T1×starter | Brann the Scorched (brann) | starter:black | 36% | 64% | 0 | 13.8 |
| T1×starter | Brann the Scorched (brann) | starter:red | 33% | 67% | 0 | 10.5 |
| T1×starter | Brann the Scorched (brann) | starter:green | 30% | 70% | 0 | 12.5 |
| T1×starter | Old Hask (hask) | starter:white | 24% | 76% | 0 | 9.9 |
| T1×starter | Old Hask (hask) | starter:blue | 75% | 25% | 0 | 10.9 |
| T1×starter | Old Hask (hask) | starter:black | 22% | 78% | 0 | 13.3 |
| T1×starter | Old Hask (hask) | starter:red | 38% | 62% | 0 | 10.1 |
| T1×starter | Old Hask (hask) | starter:green | 40% | 60% | 0 | 11.0 |

## 3. Children vs parents (parent mage at tier-1 settings; parent beast at its own)

| part | A | B | A wins | B wins | draws | mean turns |
|---|---|---|---|---|---|---|
| T2×parent | Mistress Vael (vael) | Sister Oriel (oriel) | 53% | 47% | 0 | 22.6 |
| T2×parent | Mistress Vael (vael) | Pale Edric (edric) | 78% (1% by library) | 22% | 0 | 16.7 |
| T2×parent | Kessa Emberhand (kessa) | Brann the Scorched (brann) | 43% | 57% | 0 | 12.4 |
| T2×parent | Kessa Emberhand (kessa) | A Bloom of Man-o'-War (beast:manowar) | 75% | 25% | 0 | 16.3 |
| T2×parent | Adept Maelin (maelin) | Pale Edric (edric) | 57% | 43% | 0 | 13.9 |
| T2×parent | Adept Maelin (maelin) | The Boggart Warband (beast:warband) | 32% | 68% | 0 | 9.4 |
| T2×parent | Brennor of the Glade (brennor) | Old Hask (hask) | 54% | 46% | 0 | 11.1 |
| T2×parent | Brennor of the Glade (brennor) | Sister Oriel (oriel) | 36% | 64% | 0 | 14.6 |
| T2×parent | Pell of the Shallows (pell) | Tessaly Reed (tessaly) | 55% (42% by library) | 45% (82% by library) | 0 | 14.1 |
| T2×parent | Pell of the Shallows (pell) | Old Hask (hask) | 18% (28% by library) | 82% | 0 | 11.7 |
| T3×parent | Lord Corvane (corvane) | Pale Edric (edric) | 86% | 14% | 0 | 14.5 |
| T3×parent | Lord Corvane (corvane) | The Serra Angel (beast:serra) | 14% (7% by library) | 86% | 0 | 19.9 |
| T3×parent | Varro Flamebrand (varro) | Tessaly Reed (tessaly) | 77% (10% by library) | 23% (87% by library) | 0 | 14.5 |
| T3×parent | Varro Flamebrand (varro) | Brann the Scorched (brann) | 63% | 36% | 1 | 13.4 |
| T3×parent | High Warden Sorrel (sorrel) | Brann the Scorched (brann) | 58% | 42% | 0 | 13.3 |
| T3×parent | High Warden Sorrel (sorrel) | The Hypnotic Specter (beast:specter) | 53% (4% by library) | 47% | 0 | 16.4 |
| T3×parent | Thornmother Ysolde (ysolde) | Old Hask (hask) | 61% | 39% | 0 | 9.7 |
| T3×parent | Thornmother Ysolde (ysolde) | A Savannah Lion (beast:lion) | 54% | 46% | 0 | 12.1 |
| T3×parent | Magister Quill (quill) | Tessaly Reed (tessaly) | 60% (28% by library) | 40% (85% by library) | 0 | 14.6 |
| T3×parent | Magister Quill (quill) | The Pelakka Wurm (beast:wurm) | 18% (78% by library) | 82% | 0 | 13.0 |


   **Reads for the planner.**
   - **Dominants and folds within a tier (over 80/20 or under 20/80):** T1 Tessaly–Brann 19/81; T2 Vael–Pell 89/11 and Maelin–Pell 82/18; T3 Ysolde–Quill 84/16. Broader: **Sister Oriel dominates tier 1** (69–78% against all four); **Mistress Vael dominates tier 2** (65–89%); **Thornmother Ysolde is the strongest tier-3** (59–84%) and **Lord Corvane** the second (71–77% except against Ysolde). **The three mill decks fold**: Tessaly (19–31%), Pell (11–29%), Quill (16–44%) — and when they win, they win by library (Tessaly 43–92% of her wins), so the plan executes but too slowly: at 8/10/12 life the opponent's damage closes first.
   - **Teachers vs starters — the table mostly DISAGREES with the intent**, with a caveat: a tier-1 mage fights at 8 life on apprentice against a starter at 10 on journeyman, which is the world's actual asymmetry but tilts every row toward the starter. Within that: Oriel beats the red starter (59%) but not the white one (44%) — half her brief; Tessaly punishes only the blue starter (56%, all by library) and folds to white (10%); **Pale Edric loses to everything** (4–32%), including the removal-heavy white and black starters he was built to punish — recursion needs turns an 8-life apprentice does not get; Brann punishes blue (65%) as intended and loses the rest; Hask punishes blue (75%) but loses to the white and black removal decks he was built against (24% / 22%). **The white starter (Dawn Levy) beats every tier-1 mage** — the Pride's curve at 10 life is the wall.
   - **Children vs parents**: every tier-2/3 child beats at least one parent. The crosses that lose to a parent: Kessa < Brann (43%), Maelin < the Warband (32%), Brennor < Oriel (36%), Pell < Hask (18%), **Corvane < the Serra Angel (14%)** and **Quill < the Pelakka Wurm (18%)** — the beast parents at tier-3 settings out-muscle the crosses that borrowed their bodies. Varro, Sorrel and Ysolde beat both parents.
   - **Surprises**: Pell plays like neither parent (a mill deck with ramp that neither mills fast enough nor ramps into anything); Kessa's tempo half reads as a worse Brann; Ysolde's width plan carries her tier without the Armor plan needing to. **The AI's mill execution is the seam**: the library clock is priced now, but a 40-card deck milling 3 a trigger needs ~10 triggers while an aggro opponent needs ~6 attacks — the decks may want more Crabs/Adepts or fewer air cards, or the mill decks are the ones that should carry the tier-3 titles. No decklist changed; the planner amends.
   - **Not measured**: cards never cast and per-card cast counts (the sweep reports wins/turns/library; `facts.spellsCast` per deck is a small addition if the planner wants it before the amendments).
2. **The Elemental token has no plate** — it renders the placeholder icon; an art-round item (the Goblin/Bird/Faerie/Bear/Soldier tokens have plates).
3. **Corvane's eight angels are seven** (the Reya swap) — Chris's call; if the reanimator identity wants its ninth-drop back, an un-prizeOnly Reya is the planner's conversation.
4. **The portrait round awaits verdicts**: candidate 1 is wired for all fifteen; the MANIFEST rows say so; flipping to candidate 2 is a file copy + a MANIFEST edit. The subject descriptors are mine from the deck identities — the planner may want a pass on the faces once the names/epithets are final.
5. **The Lumberjack** remains shop-only (ADR-101) — the picker shows every deck a player can face, and none holds him.
6. **The parley header** shows "Name, the Epithet" (Chris's ruling 4); the duel rail keeps the name alone (the epithet would crowd the status block) — say if it should ride there too.

## Registry entries added/changed

R-092. Pool-registry: Session 29 section (+6 cards + the Elemental token; the cleansheet note); printings regenerated. ADRs 099–102 + kickoff rulings in `docs/decision-updates/s29.md`. Knobs: `heartLife` 40 (35/45); knobs.md regenerated. Catalog: `OpponentTemplate.epithet`; `mage:<key>` deck refs; the Tactician `kind: beast`; fifteen portrait slugs. Sim: `@shandalar/sim/mage-decks`. Engine: `ActivatedAbilityDef.modes`; `ValueRef` +`sacrificedPower`; `activateAbility` +`mode`; the stack item's `eventContext` carries the sacrificed creature. CLI: `pnpm mage-sweep`. Art: thirty portrait candidates in MANIFEST; `docs/prompts/portraits.md` S29 table. Book of shame 37–40. `docs/reference/` regenerated (cards.md + Tokens; enemies.md).

## Test status

Default tier **529 passed / 2 skipped** (50 files; +8 S29 fixtures, +2 mage fuzz tests, +5 book pins; baselines: the loader's def count 190 → 197, the shop-tier counts 62/47 → 65/50, the catalog's beasts 15 → 17, the heart's life 35 → 40). `pnpm typecheck` clean. **Fuzz-before-fixtures honoured**: 720 games at the full tier across the fifteen decks (both seats, a beast and a mage reference each), replays byte-exact, before any S29 fixture. **The FUZZ_FULL ladder gate held** (every mirror cell > 40%, overall majority, zero surprises) and the 100/cell vs-random ladder PASSES. Sweep: 6,500 games (Concerns 1). Browser: the single-battle picker lists the fifteen mages with epithets and starts a Brann–Edric match clean (zero console errors); the parley header with an epithet and the new portraits are typechecked but not walked to a live mage encounter.

## Suggested next

1. **Chris**: the portrait verdicts (the sheet); a live mage encounter for the epithet line and a face; whether the Chronicle's tease should have gone with the counting sentence.
2. **Planner**: the amendments the sweep argues — the mill decks' clocks (more triggers or the tier-3 titles), Pale Edric's tier-1 viability, the white starter as a wall (or is that the intended lesson?), Pell's identity, the beast-parent gaps (Corvane vs Serra, Quill vs the Wurm); per-card cast counts if wanted first.
3. **Implementer smalls**: the Elemental token plate; `facts.spellsCast` in the sweep; the epithet on the duel rail if wanted.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--part 1|2|3]   # the S29 round-robins (~3 min at 100/pairing)
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /play → any mage vs any mage (the picker)
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/portrait-mage-<key>-<n>.md --aspect 1:1   # re-render a candidate
```
