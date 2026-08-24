# Art Direction — viewer and game UI

Planner-maintained. Read before any UI or asset work (M3.5 onward). The replay viewer is the seed of the game UI; design it as the game.

## 0. Decisions (2026-08-19)

- **Style: ink and wash.** Warm black ink line art with limited watercolor washes (2–3 colors per image). Applies to portraits, icons, UI ornament, surfaces, the card frame, and later the overworld map. Rationale: sits beside painterly card art as a different layer rather than a weaker imitation; scales from icon to map; field-notebook/cartographic lineage suits a traveling-wizard world.
- **Surface: aged wood**, warm and slightly desaturated, with parchment panels. Not felt.
- **One frame, ours, for every card.** Real cards render in our ink-and-parchment frame with the real `art_crop` set in; the printed card (`normal` image) is available in the inspector. Unifies the table, makes custom cards first-class, and makes printing selection purely an art choice.

## 1. Direction: tabletop

Warm, physical, card-first. The cards are the art; the chrome recedes. Not a dark-mode dashboard: saturated but restrained colors, a real-feeling play surface, panels that read as objects on or beside the table (a ledger, a stack of cards, a life counter) rather than as UI widgets. Lineage is Shandalar's table without 1997's chunkiness; contrast is the SFB viewer, which is deliberately analytic and cool — this is not that.

**Palette (working):** surface = deep felt green or aged wood (pick one in concepting; felt keeps card art legible, wood is warmer); panels = parchment/cream; ink = near-black warm gray; accents = the five mana colors at card-frame saturation (white-cream, blue, black-purple, red, green) used *only* to encode color identity, never as decoration; one UI accent (brass/gold) for selection and focus. Danger/warning states borrow red/amber from the mana palette sparingly.

**Type:** a humanist sans for UI and oracle text on rendered frames; a serif display face for names, headers, and the overworld later. Two weights. Sentence case.

## 2. Layout (desktop first)

Board left ≈ 2/3, rail right ≈ 1/3. Bottom row: transport/controls (replay) or the prompt bar (play).

**Board, top to bottom:** opponent hand (face-down by default; replay toggle to reveal) · opponent permanents (lands compact; creatures; other) · **combat lane** · your permanents · your hand (full frames, oracle text legible).

**Combat lane:** two rows, *Player 1's combatants* above *Player 2's*, attackers and blockers aligned in the same column so pairs read vertically — how players actually arrange it at a table. Unblocked attackers get an empty column opposite. Multi-block stacks the blockers in the column. This is a direct rendering of the engine's per-attacker block assignments.

**Rail, top to bottom:** opponent status · stack · decision panel · your status · card inspector (full card + oracle text for the hovered/selected object). The play-by-play log is either the bottom row's right side or a rail tab — decide in concepting; it must stay visible during combat.

**Decision panel** is the mode-switching region: in replay it shows the decision taken and the alternatives that were legal; in play it shows the same list as controls. Everything else is identical across modes.

## 3. Card presentation

- Battlefield: art crop + name strip + P/T badge (counters and EOT modifiers reflected in the badge, delta-colored); tapped = rotated 90°; summoning sick = desaturated; attacking/blocking = moved to the lane; attached auras/equipment sit beside their host at reduced width.
- Hand: full frame **without oracle text** (name/art/cost/P&T; ADR-043) — the inspector carries rules text. Inspector: full frame — **always our frame** (ADR-008's rendered frame is now the only frame) with the Scryfall `art_crop` as art. Inspector offers a "printed card" toggle showing the `normal` image.
- Hover anywhere → inspector updates. Click → pins.

## 4. Iconography (generate via the imagegen skill; SVG-traceable, single-color, 24px grid)

Zones: library (stack of cards), graveyard (tombstone), exile (sun/eclipse or void ring), hand (fanned cards), stack (vertical pile with arrow). Stats: life (heart or blood drop — avoid Arena's exact heart), mana per color (the five mana symbols are WotC IP — use our own glyphs: e.g., sun, droplet, skull, flame, leaf in a common style; colorless = diamond). Status: tapped, summoning sick, attacking, blocking, counters (+1/+1, −1/−1). Transport: standard play/step icons. Flag: a flag.

## 5. Player identity

Each seat has a portrait (opponent portraits are overworld content later; for the viewer, two neutral placeholders — "you" and "opponent" — generated in the same style so the slot exists). Name plate + life + portrait form the status block.

## 6. Asset pipeline

- `docs/art-direction.md` (this) + `docs/prompts/*.md` — style prompts per asset class; the implementer generates from these, not from improvisation.
- `assets/generated/{icons,ui,portraits,surfaces}/` — committed (ours).
- `data/art/real/` — Scryfall images, gitignored, fetched by the build step (ADR-008); selection of printings recorded in the pool registry (`scryfallId`).
- Every generated asset: filename, prompt used, and date logged in `assets/generated/MANIFEST.md` so we can regenerate consistently.

## 7. Open decisions for concepting

Log placement (rail tab vs bottom row). Everything else in this section is decided (§0).

## 8. Fog of war (ADR-078, S19)

Unexplored ground is an **absence, not a texture**: canonically "paler paper" (`--fog`, a shade lighter than the parchment washes) — no wash, no hatching, no borders, no names; POIs appear on first sight; roads end in a one-cell faded stub ("invitation, not information", ADR-073). Whether the white civilized wash warms slightly (so parchment ≠ wash) stays open to Chris's eye in play.

## §9 The two map registers (ratified, S20 playtest rounds; planner-issued per `docs/planner-doc-amendments-s20b.md`)

> - **Overworld — the campaign map:** per-colour pictorial terrain glyphs over a faint walkability hatch (wheat/standing stones W; waves/reeds U; dead trees/barrows B; cinder cones/lava R; conifers/canopies/roots G), a **torn fog edge** at the explored boundary, and a compass rose. The map reads as a drawn campaign document, not a tile grid.
> - **Dungeon interiors — the dark-stone register:** pale carved corridors on near-black chisel-hatched rock; torch pools at junctions; the guardian door with braziers; the entry stair; **fog rendered as darkness** (the interior inversion of the overworld's blank parchment); dark minimap. One `interior` prop on WorldMapView switches registers.
> - **Guardian battle portraits** front the telegraph modal (the guardian's face leads the stakes). **External-render provenance:** renders produced outside the pipeline (e.g., Chris's Drana) may be adopted as canonical with provenance recorded in MANIFEST and the subject file; image-filter refusal isolation via descriptor rewriting is a sanctioned director-level debugging tool.
> - Banked worldgen-shaped wants: a `river` map layer; multi-building town footprints (**riding S21** with sieges — towns should look worth defending in the session that threatens them).
