# World Design Round 2 — the radial world (proposal for ADR-072; S16 mid-session)

**Status:** implementer proposal, written at Chris's direction during S16; needs the planner's ADR + catalog content. It *replaces* the S16 brief's Part 2.1 / 2.4 items (`regionScale`, `townSpacingMin`, "bigger grid", home-region start, uniform towns) with a generator redesign of the same size. Roaming, sight, renown/flee, save-v3, starters are unaffected by it and are being built in parallel.

## 1. Chris's rulings folded in (S16 Q&A)

- Default roamers are **region-bound** (spicier chase-anywhere roamers are a later catalog flag).
- Roamer speed is a **knob** (terrain-keyed, below) so effects can modify it.
- **Any parley outcome removes the roamer** from the map (Shandalar rule): fight (any result), buy-off, flee success. No evading; no accumulation.
- Spawn density is **per area** (per 100 passable cells), by ring.
- World scale is a **variable**: regions may carry several towns as the world grows (each town later differs in quests/manalinks/stock).
- Map read: smaller viewport + minimap; exploration feel; **fog of war** — off-road points of interest are invisible until within sight radius; generally, towns/dungeons/castles are uncovered by walking (§6).

## 2. Geometry — five spokes, three rings, one hub

A world is still `(catalogVersion, seed)`. The map is `W×H` cells (scale variable, below); centre `C`. Work in **elliptically normalised coordinates** (`u = (x−Cx)/(W/2)`, `v = (y−Cy)/(H/2)`) so the pentagram fills the rectangle.

- **Spokes:** five colour sectors `W U B R G` at base angles `θ_i = θ0 + i·72°`; `θ0` and each `θ_i` jittered by the seed (±`spokeJitterDeg`, default 12°). Colour→spoke order is also seed-shuffled (the red lands aren't always north-east).
- **Rings:** normalised radii `r_civ` (≈0.18), `r_appr` (≈0.45), `r_wild` (≈0.78), each jittered per sector (±`ringJitter`, default 0.06). Hearts are placed at `(θ_i + small jitter, r_ring + jitter)` → **15 region hearts** (colour × tier). Region assignment stays the existing **L1-Voronoi with per-heart weight jitter**, so borders wobble organically while the radial structure holds. A sixth "hub" region is *not* needed: the five civilized hearts sit close to the centre and meet there.
- **Strongholds (boss castles):** one fixed point per spoke at `r ≈ 0.92`, placed, carved reachable, `kind: "stronghold"` (the existing fixed-point API) — present, unused in S16 (sieges/dungeons/bosses S19–S21).
- **Towns:** per region, count = `townsPerRegion[tier] × areaFactor` (knobs; defaults civilized 1, approach 1, wild 0–1 by roll), placed with spacing on passable cells of that region. The **player spawns in the civilized town of their starter's colour** (invariant: every colour has ≥1 civilized town). With the world-scale variable, a big world gives 2–3 civilized towns per colour (each later carries its own quest/manalink/stock flavour).
- **Rough terrain** as now (impassable, carved for connectivity: every town, lair, stronghold reachable from every civilized town).
- **Lairs** (S14 pattern) per approach/wild region by knob (`lairsPerRegion[tier]`), unchanged in behaviour.

Invariants (generator fuzz, 200 seeds): 15 regions present with the right colour/tier grid; every colour has a civilized town; every town/lair/stronghold reachable from every civilized town; strongholds pairwise spaced; region gradient monotone along each spoke (civilized → approach → wild → stronghold); determinism per seed.

## 3. Scale as a variable

`mapScale` (knob, default 2.0 ⇒ 80×56 from today's 40×28). Everything that is a count scales by `areaFactor = mapScale²` (towns, roamer density is per-area already, lairs); everything that is a distance scales by `mapScale` (town spacing, sight radius stays *absolute* — the world gets bigger, your eyes don't). The viewport is an absolute cell window (~29×19), the minimap is the whole map shrunk. Chris's felt-wrong list tunes the default.

## 4. Roads and speed-by-terrain

Roads = shortest passable paths between each town and its nearest neighbours (ring-neighbour and spoke-neighbour; the five civilized towns form the hub ring), flagged per cell (`road: boolean[]`). Render: a dotted ink line. Mechanics: **roamer speed is keyed by the player's terrain** — knob `roamerStepsPerPlayerStep { road: 0.5, open: 1 }` (fractional = accumulates; a later slow terrain class — marsh, deep forest — is just another key with >1, and a "boots" effect is a modifier on the knob). That is the Shandalar tension (roads are safe-ish and fast, the wild is slow and dangerous) with no new mechanism. Roamers themselves ignore roads for pathing (they walk 4-neighbour toward/away, region-bound).

## 5. Roamers on this map (S16 Part 2.2/2.3 — unchanged, stated for completeness)

Per player step: each roamer moves per its speed — toward the player if within `sightRadius` and not fleeing; away if `tier × renownFleeFactor[tier] < renown`; random drift otherwise — never onto towns, never out of its region. Contact (same cell) = parley. Player sees roamers within `sightRadius` minus `roughSightPenalty` per rough cell on the straight line. **Respawn:** a region below its density gains one roamer every `roamerRespawnSteps[tier]` steps at a random in-region cell outside the player's sight (the first clock consumer). Density/respawn/speed all ring-tiered.

## 6. Fog of war + points of interest (design note — *not* S16 build; needs a ruling)

Chris's direction: the map is uncovered by walking. Proposal: an `explored` bitset over cells (cells within sight radius of any visited position); unexplored cells render as blank parchment; towns/lairs/strongholds/roads are drawn only once explored; **points of interest** (a new fixed-point kind: cache of gold/cards, surprise fight) are placed by the generator off-road and *spawn into view* when the player's sight first covers them. Regions' colour washes could be revealed too, or known from the start (a map you bought) — open. **Save impact:** `explored` is a new save field → either reserve it in `world-save-v3` now (implementer's recommendation: add `explored: number[]` (packed bits), default "all explored" on migration, so S17 doesn't need a v4) or take a v4 later. Escalated, not decided.

## 7. What I need from the planner / Chris

1. **ADR-072** text for the append file ratifying §2–§5 (or amending them).
2. **Catalog content:** 15 region templates (name + 1–3 town names each; colour × tier) and 5 stronghold names. I'll ship `data/world/regions.json` with **placeholder names** (e.g. "Red Approach", "Crimson Keep") flagged in the handoff if these aren't back in-session — the code doesn't care, and the catalog version bumps either way (v0 → v1).
3. A ruling on §6's save question (reserve `explored` in v3, yes/no).
4. Defaults to argue from later: `mapScale` 2.0, rings 0.18/0.45/0.78, `roamerStepsPerPlayerStep` road 0.5 / open 1, densities per 100 cells civilized 1.0 / approach 1.5 / wild 2.0, respawn 40/30/20 steps, `sightRadius` 6, `roughSightPenalty` 2 — all knobs, all reported by world-sim.
