# Handoff — after the S20 playtest rounds (2026-08-24, same-day follow-on to Session 20)

## State of the world

Everything in the S20 close stands (solver + A9 + A8, pool 147, the dungeon system with save-v5 and mid-run resume, five Mox dungeons + lair-dungeons, kill tables, Nighthawk at 17%). On top of it, **Chris's human half of Part 7 ran as three live playtest rounds, processed same-day**: dungeons doubled to **24×18** (measured first: at 12×9 a full-loot tour averaged 22 steps against a 60-step tier — the meter was provably decorative; at 24×18 it's speedrun ~27 / full-loot ~71) with branch/minion/treasure counts scaling off one grid-derived factor; **empowerment thresholds cut to 30/60/90** (difficulty bundles shifted to match); the **auto-tapper spends duals before creatures** everywhere (Chris's Elves-vs-Breeding-Pool case — creatures-last now dominates keep-duals-free in both the colored matching and the generic pass; pre-S20 replays unaffected); **renown is credited and felt per colour** (world-save-v6 — beating green enemies scares green enemies; white tier 1s still line up); OQ-14/16 **ruled** (renown ordering stands; the law is the dungeon's table rule). Visually: the **dungeon interior shipped its dark-stone register** (pale carved corridors on near-black chisel-hatched rock, torch pools at junctions, guardian door with braziers, entry stair, fog-as-darkness, dark minimap — one `interior` prop on WorldMapView), the **overworld shipped the campaign-map register** (per-colour pictorial terrain glyphs — wheat/stones W, waves/reeds U, dead trees/barrows B, cinder cones/lava R, conifers/canopies/roots G — plus a torn fog edge and a compass rose), **five guardian battle portraits** are live (Drana's via Chris's own render after he isolated the image-filter trigger — the two-horns phrase), the **telegraph modal leads with the guardian's face**, the 5/3 Elemental token got its plate, and treasure caches draw as brass chest glyphs. Two real bugs found in passing and fixed: the **fog leak** (caches/minions rendered into unexplored fog — camouflaged on parchment since S20 shipped) and the **v1/v2 save-migration early return** that skipped all v3+ field defaulting. FUZZ_FULL green, typecheck clean, everything browser-verified.

## Done this session

- **Round 1:** dungeon scale measured (scratch BFS instrument, 1,000 interiors/config) → 24×18 default with content scaling (`s = sqrt(area/108)`: mox 4–8 caches / 3–5 minions, lairs 2–4 / 2–3); solver creatures-last fix + regression fixture; 5/3 Elemental token plate wired (`art.asset`); treasure chest glyph (marks gained `kind`); OQ-14 ruled as listed, OQ-16 ruled law-on-every-interior-duel, OQ-15 reference set clarified in the table (five starters + slice C/D, journeyman, world life 10, 105 games/cell, guardian at master with the law both sides); renown-by-colour implemented (v6, `renownAgainst`/`creditRenown`, per-colour readout in the status bar).
- **Round 2:** thresholds 30/60/90 (+ easy 60/90, hard 30/60/90 at double life; guardian-sim TIERS mirrored; empowerment fixture now checks 70 steps → 2 tiers); dungeon interior dark register implemented and browser-verified (including the seam-bleed backdrop fix and the fog-leak fix); overworld concept v2 (distinct per-colour terrain) rendered for direction; guardian portraits: Reya/Arcanis/Drakuseth/Titania rendered, grounded against the cached Scryfall art, wired into dungeons.json; Drana refused twice → placeholder held.
- **Round 3:** overworld campaign-map register implemented in the SVG renderer (TERRAIN_GLYPHS per colour, faint hatch underlay for walkability, torn fog edge, compass rose; overworld-only — interior untouched); telegraph modal shows the guardian/resident portrait and names them; Drana resolved — Chris isolated the refusal trigger ("two great curved black horns"), his own chat-interface render of the corrected descriptor was picked over the in-pipeline render and adopted as canonical (square crop for the portrait slot; provenance in MANIFEST + subject file).

## Deviations from the brief

No brief — a director-led playtest-processing session; every change above was a live Chris ruling. Two items worth planner eyes:

1. **Lair-dungeon minions are 2–3 at the doubled size** (the S20 test pin said ≤2; scaled "commensurately" per the round-1 ruling — the lair/mox gap is preserved, but the design doc's "1–2 minions" line is now stale).
2. **Old saves' flee behaviour resets** under renown-by-colour (the v6 migration zeros the per-colour map — a pre-v6 total can't be honestly split). Chris didn't object when flagged; alternative (seed all five colours from the total) is a one-line change if wanted.

## Concerns

1. **Planner-owned docs are now stale on three numbers**: dungeon-design v2 §1 (~12×9) and §3 (60/120/180 tier table), ADR-079's empowerment baseline, and dungeon-design §5's "1–2 minions" for lair-dungeons. The knobs registry and `docs/knobs.md` carry the live values (24×18, 30/60/90); the design docs should be amended planner-side rather than edited by me.
2. **`guardian-sim`'s TIERS table hand-mirrors the knob** (steps + cumulative packages in two places). Fine at this size; fold the CLI onto `dungeonEmpowermentTiers` if it drifts once more. Kill tables were NOT re-run after 30/60/90 — the tier *contents* are unchanged (the same packages arrive sooner), so the S20 tables still describe the tiers; the per-tier arrival is a step-count relabel. Re-run `pnpm guardian-sim` if the round wants fresh numbers labelled by the new thresholds.
3. **The empowerment squeeze is now real and untested by a human**: optimal full-loot (~71 steps) eats tiers 1–2; sloppy routes will brush tier 3. Chris's next dive is the verdict on whether 30/60/90 over-rotated (the knob is the lever; the difficulty bundles took the same shift).
4. **The overworld concept's remaining signatures are worldgen features, not renderer features**: rivers and multi-building town vignettes need map-model support (a `river` layer like `road`; town footprints). Flagged for the planner rather than faked in the UI.
5. **Renown-by-colour semantics for multicolour opponents**: defeat credits EVERY colour of the template; fear reads the MAX over the roamer's colours. Simple and monotone, but a deliberate choice the planner may want to ratify (alternatives: split credit, or min-based fear).
6. **Image-filter refusals are content-shaped**: the Drana trigger was a specific phrase ("two great curved black horns"), not the register. The subject file records the isolation; descriptor rewrites are now a director-level debugging tool, and externally-supplied renders can be adopted as canonical with provenance (precedent set — see MANIFEST).

## Registry entries added/changed

Knobs: `dungeonGridWidth` 12→**24**, `dungeonGridHeight` 9→**18**, `dungeonEmpowermentTiers` → **30/60/90** (easy 60/90; hard 30/60/90 double-life), `renownFleeFactor` description amended (per-colour); `docs/knobs.md` regenerated. **world-save-v6** (`renownByColor`; v1/v2 migration fall-through fix). OQ table: **OQ-14 ruled**, **OQ-16 ruled**, OQ-15 annotated (reference set). MANIFEST: token-elemental (candidate), concept-map-overworld v2 + concept-map-dungeon (concepts), guardian-reya/arcanis/drakuseth/titania (candidates), guardian-drana (kept — Chris's render, external provenance). `docs/prompts/portraits.md`: guardians section. `data/world/dungeons.json`: five portrait slugs. No pool or rules-registry changes (no new cards, no CR-mechanic changes — the solver fix is a preference ordering inside R-058's solver, not a rules change).

## Test status

**FUZZ_FULL: 304 passed / 0 failed** (302 + the two playtest regressions: solver creatures-last, renown-by-colour incl. v5→v6 migration); typecheck clean; fuzz:duals 600 games zero errors after the solver change. World tests 47 (empowerment fixture re-aimed at 70 steps; lair minion pin ≤3 with scale note; interior-movement test reveals fog first — walk-stops-at-unexplored-rock is the client's re-plan case, not the test's subject). Browser-verified: 24×18 interior in the dark register (fogged and revealed), chest glyphs, telegraph with portrait + 30/60/90 copy + reset counter, overworld glyphs across all five wedges, compass, torn fog edge, all six portrait URLs, walk-out reset. Step-count instrument (scratch): 12×9 loot mean 22 → 24×18 speedrun 27 / loot 71 / tier-1 crossing 71% of optimal full-loot routes.

## Suggested next

1. **Chris: the re-dive** — the doubled interior + 30/60/90 under real fog (does the meter bite without over-rotating?), the escrow's bite at the new cache counts (4–8/dungeon is richer), the guardian portraits in play, and the OQ-15 base-life ruling (kill tables in the S20 handoff still apply per-tier).
2. **Planner**: amend dungeon-design/ADR-079 for the ruled numbers (concern 1); ratify renown-by-colour semantics (concern 5); the overworld's worldgen-shaped wants (rivers, town vignettes — concern 4); art verdict round for the candidates (Elemental token, four guardian portraits; Drana already kept).
3. **S21 per the roadmap** (sieges + retrieval/rumor quests) — nothing this session moved touches the reserved `sieges: []` or stronghold threads.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm fuzz:duals [--shocks | --guardians]
pnpm guardian-sim --games 15     # per-tier kill tables (tiers now land at 30/60/90 steps)
pnpm ladder --games 1000
pnpm viewer → /world (campaign-map overworld; dungeons in the dark register; telegraph shows the guardian)
pnpm knobs:doc                   # regenerate docs/knobs.md after knob edits
```
