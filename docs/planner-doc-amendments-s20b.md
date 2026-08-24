# Planner-doc amendments — post-S20 playtest rounds (apply to dungeon-design.md and art-direction.md)

*Planner-authored per S20b concern 1: the design docs are planner-owned and were correctly left stale by the implementer. These amendments supersede the named lines; the knobs registry and `docs/knobs.md` remain the live-value authority.*

## dungeon-design.md (v2 → v2.1)

**§1 The shape — grid size line superseded:**
> A dungeon is a mini-world: a fogged grid at **24×18 default** (`dungeonGridWidth`/`dungeonGridHeight` knobs; was ~12×9 — doubled after the round-1 measurement showed a full-loot tour averaging 22 steps against a 60-step empowerment tier, a provably decorative meter). Content scales off one grid-derived factor `s = sqrt(area/108)`: Mox dungeons 4–8 treasure caches / 3–5 minions; lair-dungeons 2–4 caches / 2–3 minions.

**§3 The empowerment clock — tier table superseded:**
> Baseline thresholds **30/60/90 interior steps** (was 60/120/180). Difficulty bundles: easy 60/90 (two tiers); normal 30/60/90; hard 30/60/90 at double life values. Tier *contents* (the modifier packages) are unchanged from the ratified table — the amendment is arrival timing. Measured context at 24×18: speedrun ≈ 27 steps, optimal full-loot ≈ 71 (eats tiers 1–2; sloppy routes brush tier 3). **Chris's re-dive verdicts whether 30/60/90 over-rotated; the knob is the lever.**

**§5 Dungeon classes — lair-dungeon line superseded:**
> Lair-dungeons at the doubled grid run **2–4 caches and 2–3 minions** (was "a couple of twists, 1–2 minions") — scaled commensurately per the round-1 ruling; the lair/Mox gap is preserved by the scaling factor.

## art-direction.md (new §9)

**§9 The two map registers (ratified, S20 playtest rounds):**
> - **Overworld — the campaign map:** per-colour pictorial terrain glyphs over a faint walkability hatch (wheat/standing stones W; waves/reeds U; dead trees/barrows B; cinder cones/lava R; conifers/canopies/roots G), a **torn fog edge** at the explored boundary, and a compass rose. The map reads as a drawn campaign document, not a tile grid.
> - **Dungeon interiors — the dark-stone register:** pale carved corridors on near-black chisel-hatched rock; torch pools at junctions; the guardian door with braziers; the entry stair; **fog rendered as darkness** (the interior inversion of the overworld's blank parchment); dark minimap. One `interior` prop on WorldMapView switches registers.
> - **Guardian battle portraits** front the telegraph modal (the guardian's face leads the stakes). **External-render provenance:** renders produced outside the pipeline (e.g., Chris's Drana) may be adopted as canonical with provenance recorded in MANIFEST and the subject file; image-filter refusal isolation via descriptor rewriting is a sanctioned director-level debugging tool.
> - Banked worldgen-shaped wants: a `river` map layer; multi-building town footprints (**riding S21** with sieges — towns should look worth defending in the session that threatens them).
