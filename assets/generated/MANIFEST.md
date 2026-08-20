# Generated asset manifest

Every generation logged per art-direction §6. Machine ledger: `assets/manifest.json`
(the render skill's cache — includes descriptor hashes). Prompts live in the locked
descriptor blocks under `docs/art/subjects/`, composed with `docs/prompts/style.md`
(mirrored in `assets/style.md`).

## Renders

| file | subject file | variant | model | date | status |
|---|---|---|---|---|---|
| assets/images/card-back/canonical.png | docs/art/subjects/card-back.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/frame-corner/canonical.png | docs/art/subjects/frame-corner.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-counter-minus/canonical.png | docs/art/subjects/icon-counter-minus.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-counter-plus/canonical.png | docs/art/subjects/icon-counter-plus.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-black/canonical.png | docs/art/subjects/icon-mana-black.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-blue/canonical.png | docs/art/subjects/icon-mana-blue.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-colorless/canonical.png | docs/art/subjects/icon-mana-colorless.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-green/canonical.png | docs/art/subjects/icon-mana-green.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-red/canonical.png | docs/art/subjects/icon-mana-red.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-mana-white/canonical.png | docs/art/subjects/icon-mana-white.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-stat-life/canonical.png | docs/art/subjects/icon-stat-life.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-status-attacking/canonical.png | docs/art/subjects/icon-status-attacking.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-status-blocking/canonical.png | docs/art/subjects/icon-status-blocking.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-status-sick/canonical.png | docs/art/subjects/icon-status-sick.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-status-tapped/canonical.png | docs/art/subjects/icon-status-tapped.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-ui-flag/canonical.png | docs/art/subjects/icon-ui-flag.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-ui-inspect/canonical.png | docs/art/subjects/icon-ui-inspect.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-zone-exile/canonical.png | docs/art/subjects/icon-zone-exile.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-zone-graveyard/canonical.png | docs/art/subjects/icon-zone-graveyard.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-zone-hand/canonical.png | docs/art/subjects/icon-zone-hand.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-zone-library/canonical.png | docs/art/subjects/icon-zone-library.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-zone-stack/canonical.png | docs/art/subjects/icon-zone-stack.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/icon-transport-end/canonical.png | docs/art/subjects/icon-transport-end.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/icon-transport-jump/canonical.png | docs/art/subjects/icon-transport-jump.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/icon-transport-pause/canonical.png | docs/art/subjects/icon-transport-pause.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/icon-transport-play/canonical.png | docs/art/subjects/icon-transport-play.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/icon-transport-step/canonical.png | docs/art/subjects/icon-transport-step.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept (re-roll 1: first render was a desk scene, not a glyph) |
| assets/images/panel-parchment/canonical.png | docs/art/subjects/panel-parchment.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/portrait-mage-female/canonical.png | docs/art/subjects/portrait-mage-female.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/portrait-you/canonical.png | docs/art/subjects/portrait-you.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |
| assets/images/token-goblin/canonical.png | docs/art/subjects/token-goblin.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/token-soldier/canonical.png | docs/art/subjects/token-soldier.md | canonical | gemini-3.1-flash-image | 2026-08-20 | kept |
| assets/images/surface-wood/canonical.png | docs/art/subjects/surface-wood.md | canonical | gemini-3.1-flash-image | 2026-08-19 | kept |

## Derived assets (post-processed)

| file | source | processing |
|---|---|---|
| assets/generated/icons/*.svg (25) | assets/images/icon-*/canonical.png | sips→mkbitmap(-f4 -s1 -t0.48)→potrace(-s --tight, -t60 despeckle on exile/tapped/plus; -t1500 on transport-pause/end); normalized to 24px, ink #2B2520. S7: five transport glyphs (play/pause/step/jump/end), right-facing masters mirrored in the UI for the left-facing buttons (ADR-044) |
| assets/generated/surfaces/surface-wood.png | assets/images/surface-wood/canonical.png | center-crop 88%x72% to the saturated band (house style's unpainted-paper edges removed) |
| assets/generated/tokens/{goblin_1_1,soldier_1_1}.png | assets/images/token-{goblin,soldier}/canonical.png | 5:4 center crop (35% upward bias) for the frame art window; copied to packages/ui/public/custom-art/, referenced by the token defs' art.asset (S7 feedback round) |

## Conventions (S6, pending planner ratification)

The gemini-image skill owns `assets/images/` (canonical renders) and `assets/manifest.json`
(machine ledger: prompt hashes, conditioning, dates). This file is the human ledger; derived,
UI-ready assets live in `assets/generated/`. Icon PNGs composite over parchment via
`mix-blend-mode: multiply` where the traced SVG isn't used. Subject descriptor files (the
locked prompt contracts) live in `docs/art/subjects/`.
