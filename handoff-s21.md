# Handoff — after Session 21 (2026-08-24)

## State of the world

**Sieges, both quest shapes, the lore turn, the lords' art, and the map's transformation are live.** S21 ran the full brief plus three director-led playtest rounds and a five-round map-art program, all same-day. **Sieges** (the milestone): seeded per-town timers on the step clock, visible threat telegraphs (rail/map/in-town), unrelieved towns fall and suspend shopping/board/manalinks (one suspension-aware source), defense and liberation as life-carrying engagements on the dungeon machinery, all state in the reserved `sieges` array — **no save bump**; the world-sim pressure instrument filed its tables (`--min-steps`). **Retrieval quests** (lair-dungeons only; the item escrowed — the quest is the dive; keep-or-deliver with the trade stated and map markers end to end) and **rumor-chains** (five seeded trails that reveal the Mox doors; discovery aids, never quests) ride the **quest & rumor text pack as catalog data** (`data/world/quests.json`, validated); every town has a tavern, every heard line feeds the rail's rumor journal, the Vault tease gates on five Moxen. The **Nighthawk is priced** (T2 gold 50 via per-opponent override; warning-register parley; `anteCount` held for the round). **Part 5 rendered 28 card-art candidates** (five lords + Aetherbolt + Tainted Phoenix) and **Chris picked all seven** — crops staged for the S22 defs. Playtest rounds retuned the **treasure economy** (cache weights mox 15/lair 10; mox caches T3-or-R, lair caches T2-or-T3; life and **consumable boon** caches — next-battle-only, the hold-or-spend tension), fixed the **retrieval UX** (target/buyer markers, named rail lines, ceremony notes) and the **mox-cleared rail bug**, rebuilt the **town as a square** with art-tiled second-layer pages, and made the **Cinquefoil menu the app's top level** (vignette doors; viewer at /viewer). The **map-art program** (rounds 1–4.5) turned the overworld from a colored grid into a painted campaign document: chained-Chaikin-wobbled boundaries over parchment gutters, blob-scattered features, meandering roads, pigment-wash textures through cell masks on a paper ground (fog = untouched paper), the double-rule frame with corner ornaments and name cartouches, and nineteen **pictorial ink sprites** (terrain/hamlets/POIs) composited by multiply — before/after snapshots banked in `docs/art/snapshots/` via the new `/__snapshot` dev endpoint. **FUZZ_FULL green, typecheck clean**, everything browser-verified.

## Done this session

- **Part 0:** `handoff-s20-reconstructed.md` from repo ground truth — the **147-vs-140 pool count resolved** (140 = acquirable pool; +5 basics +Lotus +Elemental token def = 147); R-057..062 summarized; save-v5 blessed list; kill tables re-emitted at 30/60/90 (same gradients, earlier arrival); numbered handoffs adopted (ADR-080).
- **Part 1:** Nighthawk priced (per-opponent `goldRewardByTier` T2 50 vs base 25); parley in the warning register; regression pins the override riding `encounterKnobs`.
- **Part 2 — sieges:** `siege.ts` (timers ±25% jitter via throwaway streams; ring-sized parties, leader last; engagements with the interior-life law; ante/gold/renown pay immediately — **no escrow, my call, flagged**; loss = ordinary costs + party regroups); StepEvents; suspension through `manalinkModifiers` (dungeon specs included); resume-aware telegraph with party portraits; town footprints (later superseded by Round-4 sprites); Sieges rail panel; minimap danger; world-sim `--min-steps` + pressure table (~3.2 threats/tour at 440 steps, first fall ~500, exposure 0.55; **no wild towns exist** — wild interval dormant).
- **Parts 3–4:** the pack as `Catalog.questText` (validated: five guardian/lord keys, nonempty tables; both loaders; built-in fallback for test catalogs); all offer text pack-driven; **retrieval** (living-lair targets, R item escrowed, `retrievalOnDungeonClear` → payout, keep-or-deliver with honest refusal); **rumor-chains** (5 seeded, hear/advance/reveal — the reveal explores the door's cells); **tavern** rotation (guardians/lords/Nighthawk/warp/texture; heard journal in the rail; Vault tease gated); `quests.rumors` defaulted lazily (**v7-shaped need dodged — flagged**).
- **Part 5:** 28 candidates in the ADR-052 ceremony (registry entries implementer-authored from the ruled seeds), zero refusals, one no-text re-roll; **all seven picks ruled and recorded**; 5:4 crops staged in `assets/generated/card-art/` + `custom-art/`.
- **Playtest rounds:** treasure economy v2 (weights knob, four cache kinds, class swap, **boons as next-battle consumables**); retrieval UX (map marks, named rail, victory note); mox-cleared status fix (rail + map greying read `world.dungeons`); town square + buyer's-stall sell grid; top-level Cinquefoil menu + eight menu/town vignettes; guardian portrait verdicts recorded (4× kept).
- **Map-art rounds 1–4.5:** de-gridding geometry (chain/Chaikin/wobble, gutters, blobs, roads); pigment washes + paper (6 surfaces, mirror-tiled, multiply through masks; fog = blank paper); frame/corners/cartouches; 19 pictorial ink sprites (multiply — no alpha needed; levels-to-white pipeline; r-cone re-cropped after a rendered palette-swatch strip); town clearing halo + size; `/__snapshot` endpoint; five-stage progression + v0-vs-4.5 composites banked and delivered.

## Deviations from the brief

1. **Siege engagement rewards follow the standard defeat law** (ante/gold/renown immediately; no escrow — "a town is not a mountain") — my call; planner/Chris ratify.
2. **Defense uses the same life-carry as liberation** (the brief's planner extension) — shipped; Chris exercised both sides and reports they play well.
3. **Lair-dungeon minions run 2–3** at the doubled grid (the S20 doc said 1–2; superseded by the v2.1 amendment's scaling).
4. **Part 6's human half is partially complete**: Chris exercised sieges both ways, lair dives, retrieval, and the town/menu flows. Still open: the empowerment re-dive verdict, a rumor-chain followed end-to-end in play, the lords whispered in a tavern (wired, unwitnessed), the priced Nighthawk fight with the **Blood Artist chattiness feel-check (outstanding since S19)**, and manalink-loss-under-occupation feel.

## Concerns

1. **The guardian-card leak now has multiple channels** awaiting the boss doc's pending `prizeOnly` unification: quest R-rolls, retrieval items (a Taiga — or a Reya — can be a retrieval MacGuffin), lair cache R-rolls (now rarer), `lairPrizeRoll`, `colorPrizeRoll`. One ratification closes them all.
2. **Siege × quest deadlines**: a courier to an occupied town cannot deliver (the gate routes to the telegraph) and its deadline keeps ticking — the brief's predicted "besieged quest-giver" case, real. Flagged for a planner rule (pause deadlines under occupation? fail with sympathy?).
3. **The pack now lives twice**: `docs/quest-text-pack-v1.md` (planner prose) and `data/world/quests.json` (wired data). The data file is canonical for the game; pack edits must land in both or the doc should be marked superseded.
4. **Time-to-liberation is unmeasured** — the sim tour never fights; the pressure table reports falls/exposure only. A fighting policy is a small sim extension if the round wants the number.
5. **No towns exist in wild rings**, so `siegeIntervalSteps.wild` is dormant — worldgen decision for the planner (wild towns would also cash the rumor line about them).
6. **19 map sprites + the Elemental token await verdicts**; `anteCount` for the Nighthawk awaits its ruling; rejected sprites fall back to the in-file SVG glyph vocabulary.
7. **tsc-vs-Babel gate hole**: a JSX brace error typechecked clean but broke Vite (Chris caught it live). The browser-verify step covers it, but only after the edit lands — worth a lint/babel check in the gate if it recurs.
8. **The map program's remaining wants are worldgen-shaped**: rivers (`river` layer), town-footprint variety, wild towns; plus the dungeon interior's own smoothing pass; plus audio scaffolding when Chris's Shandalar collection lands.

## Registry entries added/changed

Knobs: `siegeIntervalSteps` / `siegeWarningSteps` / `siegePartySize` (+easy/hard overrides), `dungeonTreasureWeights` (+r3 retune), earlier-round values per `docs/knobs.md` (regenerated). **world-save-v6** (renownByColor) stands; sieges/rumors/boons all rode existing fields (no v7). `data/world/quests.json` + `Catalog.questText` (+validation). OQ-14/16 ruled (S21 kickoff commit). MANIFEST: ~70 rows this session (28 card candidates → 7 kept/21 rejected; 4 guardians kept; 8 menu/town vignettes; 6 map surfaces; 19 sprite candidates; concepts). `docs/prompts/card-art.md` + `portraits.md` sections. Dev endpoints: `/__snapshot`. world-sim `--min-steps`.

## Test status

**FUZZ_FULL: 312/312** (the +8 since the S20 close: solver creatures-last, renown-by-colour, Nighthawk pricing, sieges ×3, pack/retrieval/chains ×3, treasure economy — some superseding earlier pins); typecheck clean. Browser-verified across the session: siege cycle (telegraph/duel/loss/regroup), town square + stall + tavern, retrieval markers, main menu, map rounds at the posterity vantage (revealed + fogged). Instruments: siege pressure table filed; kill tables re-emitted at 30/60/90; step-count instrument results in `handoff-s20b.md`.

## Suggested next

1. **Chris:** the outstanding Part 6 items (empowerment verdict, Nighthawk + Blood Artist chattiness, a chain in play); the 19-sprite + Elemental verdicts; the `anteCount` taste.
2. **Planner:** the ratification pile (siege reward law, `prizeOnly` unification, besieged-quest-giver rule, defense carryover, boon-consumable ruling — Chris ruled live, wants ADR ink); worldgen wants (rivers, wild towns, footprint variety); the pack's two-home resolution.
3. **S22 per the roadmap:** the strongholds and the five lords — A10's nine words, the laws, decks, the entrance, the life formula; the card art is picked and cropped, waiting.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm world-sim --seeds 30 --min-steps 1200 --policy avoid   # siege pressure table
pnpm guardian-sim --games 15                                # kill tables (30/60/90 labels)
pnpm viewer → / (the Cinquefoil menu) · /world · /play · /gallery · /viewer
pnpm knobs:doc                                              # after knob edits
# docs/art/snapshots/ — the map program's before/after ledger (POST /__snapshot from the page)
```
