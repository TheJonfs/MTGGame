# Session 23 Brief — The Fun Batch, the Wilds, and the Sound of Cinquefoil

Read first: `handoff-s22.md`, ADR-081..084 (`docs/decision-updates/` — apply 083/084's appends as Part 0 ceremony), `docs/fun-batch-s23.md` (the card spec), `docs/planner-doc-amendments-s20b.md` (already applied; context for the map registers), art-direction §9. Budget one director round (river feel, footprints, the fun cards in hand, audio smoke). **Not in this session** (parallelizing deliberately): lord-deck iteration, watch-flag rulings, travel powers — all follow Chris's standard-mode stronghold sprint in their own round.

## Parts

**Part 0 — Housekeeping.** ADR-083/084 appends ceremonied; **the empowerment TIERS three-place sync folds onto the knob** (the S20 trigger fired at the third copy — guardian-sim and lord-sim both read `dungeonEmpowermentTiers`/`strongholdEmpowermentTiers` directly); FUZZ_FULL baseline.

**Part 1 — The fun batch (pool 171 → 174).** Per `fun-batch-s23.md`: Thundersnake, **Gallows Djinn** (named), Traumatizer — three defs with `text`, the two tiny words (self-`sacrifice` effect surfaced from A10 word 3's machinery; `{ref: eventDamage, times: N}` as ref-family member six), fixtures per the spec **including the named ones** (Thundersnake's off-turn entry dies same turn; the Djinn's triggers at life 1; the Traumatizer's trample-partial — 1 assigned to the player mills 2), pins ladder-gated (the Thundersnake waste-gate sibling; the Djinn's never-at-life-1), tier-2 registry rows, ADR-052 art ceremony ×3 (four candidates each, Chris verdicts in the round; `printedAsset` JPGs arrive from Chris's pipeline whenever — wire on receipt, not blocking).

**Part 2 — Wilds polish.**
- **Rivers:** the `river` map layer — 2–4 seeded meandering ribbons per world, **impassable except where roads bridge them** (bridge sprite at road crossings) **plus 1–2 natural fords per river** (knobs); the connectivity carve extends its invariant (every town/lair/stronghold reachable — escalate if rivers fight the generator rather than compromising reachability). Rendered in the campaign register (the S21 program's flowing-water want); roamers respect them (region-bound pathing already handles impassables).
- **Town footprint variety:** multi-building vignettes varied by ring and size through the sprite pipeline (civilized towns sprawl; wild towns huddle) — the r2 town placements get faces worth defending.
- **The interior smoothing pass:** the dungeon dark register's deferred refinement (the S21 program's last unspent item) — junction/chamber rendering polish at the implementer's judgment, snapshot-ledgered like the overworld program.

**Part 3 — Audio scaffolding (cue-first; ADR-084's step 1 only).**
- A **cue registry**: named cues, not file paths, everywhere in game code — proposed initial taxonomy: `music.menu / music.overworld / music.town / music.dungeon / music.stronghold / music.duel`, stingers `sting.quest-complete / sting.siege-news / sting.duel-win / sting.duel-loss / sting.coin-flip` — extend as the wiring reveals wants, escalate if the taxonomy balloons.
- An **audio manager**: per-context music switching with crossfade, stinger playback, volume; a cue→file mapping read from `data/audio/mapping.json` against a **gitignored `assets/audio/` mount** — every cue silently no-ops when unmapped or unmounted (the deploy's natural state; ADR-083's ruling).
- **The front-page toggle**: prominent on the Cinquefoil menu, preference persisted; sound begins at first user interaction per browser reality regardless of default.
- Acceptance: with any placeholder file mounted and mapped, the menu cue plays post-interaction, context switches crossfade on entering a town and a dungeon, and the toggle kills and persists across reload. **The mapping itself is out of scope** — step 2 is a Chris + planner authoring round against his library.

**Part 4 — Acceptance.** Scripted: batch fixtures green; a river-bridged road walked; audio smoke per Part 3. Human: Chris casts all three fun cards in anger, crosses a river at a ford, sees a wild town huddle, hears Cinquefoil make its first sound, and verdicts the art candidates.

## Definition of done

Batch encoded, gated, ceremonied; rivers/footprints/smoothing shipped in the registers with snapshots; audio scaffolding smoke-tested with the toggle honest; TIERS folded; felt-wrong harvest. Concerns wanted: river-generator fights, cue-taxonomy gaps discovered in wiring, anything the batch words resisted, footprint-sprite wants that are worldgen-shaped.

## Out of scope

Travel powers (design round pending); lord-deck edits and the watch-flag rulings (Chris's sprint round); the audio mapping (step 2) and deploy library (step 3); the gauntlet; the R-economy; Unearth (breadcrumbed, unscheduled).

## Escalate, don't decide

River-vs-reachability compromises; cue taxonomy growth beyond the obvious; any batch fixture revealing a word wants more than its tiny bill; anything travel-power- or gauntlet-shaped discovered in passing.
