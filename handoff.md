# Handoff — after Session 44 (2026-09-29)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two is polished from Chris's first full run.** Session 44 — **the flood, polished** — is done except Part 2's installation, which waits on Chris's art verdict (the candidates are rendered, ledgered and committed). The playtest week's rulings are filed (`docs/decision-updates/s44.md`): a flood lair's prize room holds **one R card and the purse** (ADR-137), `floodClockSlack` 1.5 is ratified (ADR-138), and a fallen lord's territory stocks **+2 ordinary rows** in every ring (ADR-139, `floodShelfBonus`). A phase-two run's **Chronicle** now lists its lords', courts' and lairs' falls in order under the Flood entry, mirrored into the profile's ledger so it outlives the run. The flood's **sixteen rumours** pour in phase-two taverns (Chris's amended Bailiff line), and the rail's footer names both link kinds. The flood references sit at the world's **10 life** (post-lairs 14), and `flood-sim --refs postlairs` is re-baselined below. `pnpm test` = 767 green; `pnpm typecheck` clean.

*Before this session (the playtest week, 2026-09-26…29, all pushed and ratified in the brief's Part 0): the lairs as lair-dungeons, the Altar, the clock slack, the art round, the menace flag carrying the duel log, the Ritual/Restoration/Snake/sink AI corrections (books 70–73), the golds off the shelves and Shadow Summoning at R, the flood's gate plates and castle themes, the Deep Water's threshold, the High Grounds' "cleared" on the rail.*

## Done this session

- **Part 0 — rulings**: `docs/decision-updates/s44.md` (the brief's appends + the kickoff answers). **ADR-137**: `floodLairPrizeRoll` (dungeon.ts) — the first of `lairPrizeRoll`'s two R cards on the same stream, the 30-gold purse kept (Chris); the controller picks it for a flood lair. **ADR-138**: the knob's text says ratified. **ADR-139**: `floodShelfBonus` = 2 (knobs.ts); `rollShopStock` widens a phase-two town's shelf when `lordSealed(world, region.color)` — every ring of the colour (Chris), not cumulative, the ordinary pool (R out); read-only (the S44 fix of my own first draft, which called the mutating `strongholdState`). **The references at 10**: the six `salvage-*` yardsticks 12 → 10, the post-lairs pair 16 → 14 (the world's 10 + two life lairs); `road-mid-*` (phase one) unchanged.
- **Part 1 — the Chronicle of the falls**: `ChronicleEntry.falls` (`ChronicleFall`: kind, site, name, line, step); `floodChronicleFalls(world, catalog)` merges `floodRun.falls` (lords and courts, in order) with `floodRun.lairs` by step, each with the pack's line — a seat's `fall`, a lair kind's `prize` (the kinds have no fall line); `withFloodFalls(legacy, seed, falls)` writes onto the run's own flood entry, idempotent. The controller syncs on every autosave and on load (backfilling a pre-S44 run — Chris's current save fills on load). The page nests the falls under "The Flood"; the fount's entry follows as before.
- **Part 2 — the Calyx and the lairs, drawn (candidates)**: eighteen renders, zero refusals — the Calyx's deep / ford / High Ground washes (house style, storm-light palette) ×2, the Landing / Wellhouse / Hearthstead glyphs (ink, the map-sprite pipeline) ×2, the three lair splashes (storm-light oil, 16:9) ×2; the five court splashes as 16:9 bands of the High Grounds' woodblock card art (no renders). Review sheets built as the map paints them (hue × wash at 50%; glyphs multiplied on the map paper). **Installation and the map wiring wait on the verdict** (see Suggested next).
- **Part 3 — the rumours**: `quests.json` `flood.rumors`, sixteen lines (Chris's Bailiff amendment); pinned — every line reaches some phase-two tavern over forty epochs, none in phase one.
- **Part 4 — the footer**: "A quest's link is town-tied … A lair's link is the lair's own: no siege can darken it."
- Docs: `knobs.md`, `docs/reference` regenerated.

## Deviations from the brief

1. **The Chronicle is the profile's ledger, not the world's** — the brief's sources (`gauntlet.flood.falls`, `floodRun.lairs`) live in a save that does not outlive its run; the falls are mirrored onto the run's flood entry (Chris, kickoff).
2. **A lair's Chronicle line is its kind's `prize` line** — the lair kinds carry no `fall` line (Chris, kickoff). A planner fall line per kind would drop in with no code.
3. **Part 2's register split** (Chris, kickoff): the map's pieces in the house ink-wash under the storm-light palette (oil cannot multiply into the parchment); the glyphs are INK ONLY like every map sprite (the palette lives in the washes); the splashes in storm-light oil.
4. **The Bailiff's rumour amended by Chris**: "Nothing that goes in comes out free." (the brief's "the same size" matched nothing at the seat) — for the planner's awareness.

## Concerns

1. **The references at 10 move the flood's seats 0–10 points up** (table below): the Fordkeeper against the UB pilot 77 → 86%, Ovna 74 → 84%; the Reaper and Meliyan stay above 80 against both salvage pilots. Odile is still the soft court (20–41%).
2. **`chris-road-B`'s rows moved without its life moving** (Ovna 49 → 55%, the Dredger 50 → 48%) — the week's AI gates (the Snake, the idle sinks, the burst) are in this baseline too; it is the new baseline for both reasons, not the 10-life ruling alone.
3. **ADR-139 can fall short of +2 on a thin pool**: a civilized ring's single-colour tier-1 pool is small and the "not last seen" rule plus the artifact cap fill first; the seed tested gave every white town its +2, but a short pool gives fewer rows, never an error. Not measured beyond that.
4. **A mirror-tiled wash can show its seams**: candidate "deep 1" reads as kaleidoscope X-shapes at swatch scale (the 2×2 mirror of a bloomy texture); "deep 2" tiles clean. The map scale (256 px per tile) will show which.
5. **Not walked in the browser**: the Chronicle page with falls, the rail footer, the widened shelf. Pinned headless (the merge, the writer, a controller run across two controllers; the shop sizes).

## flood-sim --refs postlairs at the world's 10 (S44 baseline; 100 games per seat per pairing — the seat's win rate: WR / UB / road-B)

Bailiff 70 / 72 / 58 · Reeve 55 / 42 / 53 · Fordkeeper 69 / 86 / 48 · Dredger 57 / 47 / 48 · Reaper 84 / 81 / 54 · Odile 27 / 41 / 20 · Zinnia 69 / 46 / 42 · Ovna 79 / 84 / 55 · Isaura 78 / 78 / 68 · Meliyan 91 / 89 / 67. (S43 at 16: Bailiff 67/68/58 · Reeve 53/42/54 · Fordkeeper 66/77/48 · Dredger 56/43/50 · Reaper 82/80/54 · Odile 24/39/20 · Zinnia 66/48/42 · Ovna 76/74/49 · Isaura 75/74/68 · Meliyan 91/87/67.) `results/` is gitignored; the full table is in `results/s44/flood-sim-postlairs-10life.txt` locally.

## The tier-3 round — what it would cost (the implementer's read)

**Where it starts**: one tier-3 beast per colour today (Serra Angel W, Faerie Formation U, Hypnotic Specter B, Siege-Gang Commander R, Pelakka Wurm G), and the tier-3 shelf is thin — W 3, U 2, B 3, **R 1**, G 2 cards. Red is the round's first need.

**Per card (a plain body with keywords — the cheap case)**: Scryfall verification and the def (minutes); four card-art candidates in distinct styles (ADR-052) and the crop; a 40-card beast list in `EXPANSION_DECKS` built around it (the S18 pattern); an `opponents.json` row (tier 3, worldLife 12, spoke, `buyable`, the parley verb and line — **Chris's pen**); a battle portrait (two house-style candidates) and its chip, following the kept card art; fuzz, then a book entry only if the AI misplays it. **Per card with a new shape** (an ETB, an activation, a static): add the engine word, its fixture and R-entry, and usually an AI pin — this is what makes a round expensive, not the count.

**Five cards (one per colour)**: one session plus two verdict rounds (card art, portraits). **Ten**: a heavy session or two, and the placement weights (`rollTemplate`) with a second tier-3 beast per colour change the wild ring's density — a `world-sim` re-read. **The flood**: beasts already roam both maps (the Nighthawk's rule), so a new beast row fields in phase two for free; but **the Wellhouse's resident rule picks "the territory's tier-3 beast"** — a second per colour needs a tie rule (the stronger, the newer, or a seeded pick). **Phase one optionally**: nothing extra, the same rows roam.

## Registry entries added/changed

No R-numbers (no rules). No new cards. Knob `floodShelfBonus` (2). Types: `ChronicleEntry.falls`, `ChronicleFall`. Functions: `floodLairPrizeRoll`, `floodChronicleFalls`, `withFloodFalls`. Data: `quests.json` `flood.rumors` (16). Road decks: the flood references' `life`. Art: eighteen candidate renders (MANIFEST rows, pending).

## Test status

**767 passed / 2 skipped** (from 762: +2 ADR-137/139, +1 Chronicle merge, +1 rumours, +1 controller Chronicle; two S39 pins moved 12 → 10 by the ruling; one S43 shop pin now allows the widened shelf). `pnpm typecheck` clean. No AI change this session (no ladder run needed); the baseline sim ran 3,000 games.

## Suggested next

1. **Part 2's verdict → install**: the chosen washes to `public/map-tex/map-wash-{deep,ford,ground}.jpg` and the Calyx drawn through masks as the regions are (the flat hue under a 50% multiply); the glyphs to `public/map-sprites/sprite-lair-{landing,wellhouse,hearthstead}.png` and the map picking by the lair's kind (`parseFloodLairId`); the lair splashes and the court bands to `public/gate-plates/` and the lair / court telegraphs showing them (the stronghold splash's `onError`-hidden image).
2. The planner's call on the tier-3 round (above), and on lair fall lines for the Chronicle.
3. Chris's next run tests ADR-139 and refuses land-granting quests (the watch item).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/world/src/flood.test.ts
pnpm exec vitest run packages/ui/src/world/world-controller.test.ts -t "Chronicle"
pnpm flood-sim --games 100 --refs postlairs          # S44 baseline at the world's 10
pnpm reference ; pnpm knobs:doc
pnpm build:web && git push                             # a push deploys to Vercel
```
