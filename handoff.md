# Handoff — after Session 39 (2026-09-16)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two has a shipped start.** Session 39 — **the salvage** — is done: `newWorld({ salvage })` (phase 2; the collection = the ten legends + the five picks + the fifty-five-card pack + the deck's basics, provenance `salvage`; the purse `salvagePurse` = 100 ⚠ replacing both gold terms; no manalinks; the flood's town names; the centre as **the deep water** instead of the Corolla), the pack (`data/world/salvage-pack.json`, the planner's fifty-five — every id in the pool at tier 1–2, none substituted, rendered as `docs/reference/salvage.md`), the two yardsticks (`salvage-WR` / `salvage-UB`), sweep **part 10** at both phases, and the whole start-to-first-duel path through the controller: the start screen's "Enter the Flood" (once every colour is cut) or the fifth cutting's third button → **the scene** (the planner's lines; Chris: what was lost is metaphorical, no deck shown) → **the picks** (five colour tabs on the stronghold prize picker's shelf; a pick banks when its tab is left) → **the pair** (ten guild-named pairs) → the world, the chronicle's line, and **the editor on the first deck** (Chris: the twelve-land shape — each colour's ten minus its two highest mana values, the picks in the pair, colourless artifacts to eighteen nonland cards, basics to thirty by pips; Cancel is "Keep this deck", refused while illegal). The flood's map draws in a **flood register** (Chris: a distinct look, every colour kept, the plane darker and cooler — not a water world). The dev "set phase" toggle ships. Pool 198 unchanged.

## Done this session

- **Part 0**: `docs/decision-updates/s39.md` — the S38 ratifications, ADR-127 (the ring is texture; ⚠ heartLife 50 proposed, nothing moved), the refusal-lines note, the dev toggle. The dev toggle: `devSetPhase(1|2)` on the Dev panel.
- **Part 1 — `newWorld({ salvage })`**: `SalvageSpec { legends, picks, pair, deck, deckName? }`; `starter` is optional on `NewWorldOptions` (either, or throw); the salvage branch shares one `worldFrom` tail with the starter path; the legacy is NOT applied (the legends arrive in the spec; the purse replaces `startingGold` and `legacyGoldPerCutting`; `manalinks: []`; `powers.unlocked: []` — Concern 1); `phase: 2`; `generateWorld(…, { phase: 2 })` names towns from `townNamesPhaseTwo` (towns.json `namesPhaseTwo`, twenty placeholder flood names) and places `placeCentreDeep` (a new `FixedPointKind` `deep`) instead of the Corolla's doors; `migrateWorld` grows the doors only at phase < 2. Eligibility `floodEligible(legacy)` = five cut colours. Tests: the composition (10 + 5 + 55 + basics, one copy each, provenance salvage), the purse, no manalinks, phase 2, the first deck legal and active, the map (flood names, the deep water, no Corolla/Vault), the save round-trip keeping the deep water; the phase-one path unchanged; the ineligible case; the flood's chronicle entry (`recordFlood`, `kind: "flood"`, no cutting counted).
- **Part 2 — the flood, the picks, the first deck**: screens `flood` and `salvage` (stage picks/pair; `tab`, `picks`, `banked`, `pair`, `notice`); controller `floodEligible`, `enterFlood(choice)`, `floodContinue`, `salvageTabCandidates` (the stronghold prize picker's list minus the ids already picked), `salvageTab` (banks the tab being left), `salvagePick` (free on an unbanked tab; a banked tab refuses; off-shelf refuses), `salvageToPair` (all five or the missing colours named), `salvagePairs`/`salvagePair`, `salvageBegin` (the world; the chronicle's line to the profile's ledger and the run's `gauntlet.chronicle`; autosave; the editor with `mustLeaveLegal`); `editorClose` refuses an illegal draft when `mustLeaveLegal` (the notice names the problems; Reset always works). `assembleSalvageDeck` + `pickInPair` in `salvage.ts`. The quests pack gained `flood` (scene, picks, pair, chronicle, deep, offer — the planner's Part 6 text verbatim; validated). Tests (the S10 pattern): ineligible until five cuttings; a change of mind on the tab; the bank on leaving; a gold card on either tab once (Vindicate on W, then off the B shelf); an Island Swamp on the B tab; the missing-colours refusal; the pair; the world's numbers; the assembled deck (30/12, the WB pick in, a Plains-typed dual in, a Forest Island out); Cancel refused until legal then Reset + Keep → the map; the Chronicle line in both ledgers; the deep water's knock; the dev toggle persisting. Browser-verified end to end on the dev server (no console errors): the offer, the scene, the shelf (the R drawer first), the banks, the pair buttons, the editor ("Orzhov salvage", 30 cards · 12 lands · legal, 49 spares), the flood map at 100 gold.
- **Part 3 — the pack**: `salvage-pack.json` (structure validated by the catalog loader; `salvagePackProblems` against the pool: every id known, mono-colour at tier 1–2, the colourless five colourless, never prizeOnly — pinned; a bad pack names its problems); `salvage.md` rendered and sync-tested.
- **Part 4 — the yardsticks and part 10**: `ROAD_DECKS.salvageWR` / `salvageUB` exactly as the brief lists them (30 / 12 lands / 12 life / no entrance; **Sacred Foundry is tier 2** — no Badlands substitution); pinned (every id in the pool, in the pack or a dual). Sweep part 10 at `--phase 2` and `--phase 1`, 100 games both seats. Below.
- **Part 5 — the map**: the flood names, the deep water (`doorHere() === "deep"`, knock → the pack's `deep` line; the Corolla door sprite as its glyph for now), the `flood` register in `WorldMap.tsx` (`FLOOD_WASH`: each tier×colour darker and cooler evenly; the same sprites tinted) — the outer map passes it at phase ≥ 2.
- **Part 6**: the texts in `quests.json` `flood.*` verbatim.
- `docs/reference/world-ui.md` updated (the Flood's screens, the deep water, the dev toggle, the salvage editor); implementer-notes S39 lessons; knobs.md regenerated (`salvagePurse`).

## Deploy playtest r9 (Chris, 2026-09-16): eight notes, eight fixes

Chris's notes after S39 (a ninth came through empty). All fixed, pinned, and gated; recorded here as the r8 round was.

1. **Multi-target picks had to go left to right** (the Warden's "tap up to two"). The engine enumerates target COMBINATIONS in battlefield order (`[Bears, Courser]`, never `[Courser, Bears]`) and the match client matched clicks positionally against that list — clicking the later creature first left only the one-target variant and committed it. The client now matches as a multiset (`compatible` / `exactVariant` over the targets' keys) and commits the enumerated variant in its own order; the next-pick highlights are every target a still-compatible variant carries beyond what is chosen. Every multi-target spell, ability and trigger goes through the same path (the audit Chris asked for: there is one matcher, and it was the matcher). Test: the Courser first, then the Bears — both tapped.
2. **A second Pacifism on a pacified creature; a Spirit Link on one.** The AI's aura prediction priced only the host's live power and toughness and never looked at what already hung on it. Now (`view-sim.ts`): the same aura twice, or ANY aura on a creature a restrict aura already holds (it neither deals damage nor needs neutralizing), is "unchanged" — strictly below passing, the re-equip rule; a steal aura on a pacified creature still steals. Book 54.
3. **Giant Growth at declare attackers (or at random).** The pump gate keyed on `combat.attackers.length > 0` with no step test, so the moment attackers were declared the trick was live — telling the opponent what to block. The gate now opens at the DECLARE_BLOCKERS priority round and the damage steps (the blocks are final), on either player's turn, or in response to an opponent's spell. Book 22 amended (its combat view is now at DECLARE_BLOCKERS), book 55.
4. **The Crab after the land drop.** No land-before-spell ordering existed; the softmax preferred the two-drop and the landfall trigger was missed. `landfallFirstCandidates`: while a castable candidate is a permanent with a landfall trigger, the land drop is withheld from the decision (it returns the moment the permanent is cast or stops being castable; turn one with no mana still plays the land). Book 56 (forty picks never take the land while the Crab is castable).
5. **Tapping the Birds in response.** The engine always offered `tapForMana` at priority; the client dropped it on the floor (only casts, lands and activations were clickable). In a RESPONSE window (something on the stack) an untapped producer now glows dashed and taps on click (a many-coloured producer asks the colour), and a window with floating mana never auto-passes (the player floated it on purpose). Note the engine's own rule: a window whose only action is a lone pass is auto-taken without a request — so tapping the Birds when nothing could use the mana ends the window, correctly. Test: the tap floats the mana and the Growth becomes castable.
6. **Cancel left the lands tapped.** Manual-tap taps are engine actions submitted one per request, so cancel had nothing local to discard. Cancel now takes this session's taps back through `untapForMana`, one request at a time (the same queue pattern as combat declarations), then returns to the base phase. Test: the Forest untaps, nothing floats.
7. **The player's portrait.** The two S6 traveling mages (`portrait-you`, the hooded one, and `portrait-mage-female`, the woman with the staff — resized from the canonical to the 160px chip) are a radio on the start screen; the slug rides `PlayerState.portrait` (absent = the hooded one; old saves unchanged), the map chip, and the duel rail through `CustomMatch.human.portrait`; the Flood's start carries it too.
8. **Clear on blocks did nothing** — the button called `cancel()`, which re-dispatched the request, and `enterBlockers` read the staged pairs off the phase it was replacing. `clearStaged()` resets the local staging (attackers and blocks; staging is local until Confirm, ADR-058). Test: stage, clear, stage again.

**Gates**: every AI change carried the ladder — the FUZZ_FULL ladder smoke 2/2 and `pnpm ladder --games 100` mirror gate PASS. Default tier **645 passed / 2 skipped (67 files)**; `pnpm typecheck` clean. `docs/reference/world-ui.md` and implementer-notes carry the round.

## Part 10 — the phase column's first read (the yardsticks' win rate; 100 games both seats)

| tier | mage | vs salvage-WR (p2 / p1) | vs salvage-UB (p2 / p1) |
|---|---|---|---|
| 2 | Vael | 28 / 42 | 27 / 38 |
| 2 | Kessa | 33 / 48 | 28 / 46 |
| 2 | Maelin | 48 / 58 | 30 / 46 |
| 2 | Brennor | 36 / 55 | 45 / 52 |
| 2 | Pell | 35 / 42 | 32 / 49 |
| 3 | Corvane | 19 / 32 | 38 / 52 |
| 3 | Varro | 24 / 35 | 29 / 38 |
| 3 | Sorrel | 22 / 33 | 15 / 28 |
| 3 | Ysolde | 21 / 23 | 15 / 16 |
| 3 | Quill | 16 / 27 | 27 / 27 |
| **mean** | | | **tier 2: 34% at phase 2 / 48% at phase 1 · tier 3: 23% / 31%** |

**The read.** At phase one's tables the floor is where the brief hoped for phase two — tier 2 near even (48%), tier 3 unfavourable (31%). The phase-two column (+4 life and +1 basic at every tier) takes fourteen points off tier 2 (34%) and eight off tier 3 (23%). The yardsticks are the *floor* (no legends, journeyman, the pack's spells one-of); the flood's actual player carries ten legends and picks from the R drawer, so the lived number sits above these — how far above is the next measurement (a "salvage plus legends" reference, the two yardsticks with their pair's ministers and guardians, is one deck entry each). If the intent is "tier 2 near even for the floor", the phase-two column is one cell too hot at tier 2; if the intent is the lived deck near even, it may be right. No knob moved.

## Deviations from the brief

1. **The first deck is the twelve-land shape** (Chris, 2026-09-16), not "twenty + picks + basics to thirty": each colour's ten minus its two highest mana values (ties: the later in the planner's list leaves first), the picks in the pair, colourless artifacts to eighteen nonland cards, basics to thirty split by pips (each colour at least three). Sixteen from the pack halves + up to two picks + colourless — the yardstick's 18/12 shape whether the picks are spells or duals.
2. **No phase-one deck is shown at the flood** (Chris): the scene is the planner's five lines only; nothing reads the autosave. The Heart victory's third button and the start screen's offer are the two entry points; both carry the difficulty/name/seed (the victory screen reuses the world's difficulty and name).
3. **The flood register is a distinct look, not water** (Chris): every colour keeps its identity, the plane reads darker and cooler evenly; no blue/black lean. The real tiles are art-round work; the sprites are the phase-one ones tinted.
4. **The pick shelf is `strongholdPrizeList` verbatim** (`salvageCandidates` is an alias) — "shopTier ≤ 3 && !prizeOnly (R included)" is exactly that list (every card with a shopTier, tokens and prizeOnly out); colourless cards sit on no tab (they carry no colour — the brief's "one of each colour").
5. **The Chronicle entry keeps its `color`** (the type requires one): the flood's entry carries `kind: "flood"` and the pair's first colour; the page renders it unchanged ("The sixth cutting · the white road …" — Concern 4).
6. **`ProvenanceSource` gained `"salvage"`** (additive; the collection page's "new since last visit" reads sources by name and ignores unknown ones).

## Concerns

1. **The five powers do not carry into the flood.** ADR-126 names the legends and the purse; `applyLegacy` (which unlocks the powers and pre-clears the power sites) is the starter path's carryover and the salvage branch does not call it. The Powers rail is empty on a phase-two map — and the map still generates phase-one power dungeons (which would teach them again). The planner should rule: carry the powers (one call), or leave them as phase-one machinery the flood replaces.
2. **A phase-two world is phase-one content on a phase-two map.** The lords' rail lists the five phase-one lords at 30 life, the strongholds are the phase-one seats, the quest text and rumours are phase one's, the region NAMES are phase one's (only the towns are renamed), and the mages are the phase-one roster at the phase-two column. Everything the design's content rounds replace is still there — expected this session (out of scope), but Chris will see it if he walks the flood; the deep water is the only phase-two site.
3. **The purse at 100 buys two tier-1 buy-offs and little else** against phase-two mages at 12+ life; the shop prices are phase one's. Unmeasured; the knob is ⚠.
4. **The Chronicle page's wording** for a flood entry is the cutting's ("The sixth cutting · the white road"); a `kind`-aware line ("The Flood · the Orzhov salvage") is a two-line change in `ChroniclePage` once the planner words it.
5. **The salvage editor's "Keep this deck" is a courtesy**: the assembled deck is committed and legal before the editor opens, so the world never lacks a legal deck; the guard only stops a player leaving with an unsaved illegal draft. If the planner wanted the editor to be *mandatory* (no leaving without a save), that is a different flag.
6. **The pick shelf is one long grid** (the W tab lists ~60 cards, the R drawer first). Fine on a desktop; a tier filter or the editor's search box would help on a laptop; not built.
7. **The part-10 yardsticks measure the floor only** (no legends); the read the brief wanted needs a "salvage + legends" reference before the column is ratified (above).
8. **`find` on the dev browser could not match card images or button text reliably** — irrelevant to the game, but the browser walk needed refs from `read_page`; noted for future verifications.

## Registry entries added/changed

No R-numbers. Knobs: `salvagePurse` (docs/knobs.md regenerated). ADR-127 and the S38 ratifications in `docs/decision-updates/s39.md`. Data: `data/world/salvage-pack.json` (new), towns.json `namesPhaseTwo` (placeholders), quests.json `flood.*`. World: `salvage.ts` (new: `SalvagePack`, `validateSalvagePack`, `salvagePackProblems`, `salvageCandidates`, `pickInPair`, `assembleSalvageDeck`, `SALVAGE_PAIRS`, `pairName`), `SalvageSpec` + `newWorld`'s salvage branch + `worldFrom`, `ProvenanceSource` `salvage`, `Catalog.salvagePack` / `townNamesPhaseTwo`, `FloodTextPack`, `FixedPointKind` `deep` + `placeCentreDeep`, `GenerateExtra.phase`, `ChronicleEntry.kind`, `floodEligible`, `recordFlood`, `renderSalvageReference` + `salvage.md` (sync-tested), `mage-sweep --part 10`. Sim: `ROAD_DECKS.salvageWR` / `salvageUB`. UI: screens `flood` / `salvage`, `FloodChoice`, the salvage methods, `mustLeaveLegal`, `devSetPhase`, `doorHere` `deep` + the knock line, `FloodScene` / `SalvageScreen`, the start screen's offer, the Heart victory's third button, the `flood` register (`FLOOD_WASH`), the deep sprite; engine-bridge bundles the pack. Docs: world-ui.md, implementer-notes S39.

## Test status

Default tier **640 passed / 2 skipped (67 files)** (from 630 / 2: +8 salvage — the pack, the shelf, the assembler over all ten pairs, the world's composition, the phase-one path, eligibility and the chronicle, the yardsticks, the ten-encounter fuzz per yardstick with byte-exact replays; +1 salvage.md sync; +1 the flood controller path). `pnpm typecheck` clean. **Fuzz before fixtures**: the phase-two world's first encounters with both yardsticks as pilots (heuristic agents, ≥ 5 fights each, every replay byte-exact) ran before the controller test. Ladder gates untouched (no AI moved). Sweep: part 10 at both phases (4,000 games each). Browser: the whole path walked on the dev server.

## Suggested next

1. **Planner/Chris**: the powers' carry (Concern 1); the part-10 read and the "salvage + legends" reference (Concern 7); the flood entry's Chronicle wording (Concern 4); the region names in the flood (Concern 2).
2. **S40**: the content rounds can start on a shipped path — the phase-two lords/courts (with their `deckRule`s on the site defs and the resolver's rows), the mage inversion, the real flood names and tiles.
3. **Smalls**: a tier filter on the pick shelf; the `door.byRule` lines when the courts' content lands.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/world/src/salvage.test.ts packages/ui/src/world/world-controller.test.ts packages/world/src/reference-docs.test.ts
pnpm mage-sweep --games 100 --part 10 --phase 2 --baseline none   # then --phase 1
pnpm knobs:doc / pnpm reference
pnpm viewer → /world (five cuttings in the profile — the Dev panel's "+ cutting" ×5, or the legacy blob — then "Enter the Flood"; the Dev panel's "set phase")
```
