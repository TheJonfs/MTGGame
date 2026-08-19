# Session 6 Brief — Replay viewer, art pass, Scryfall fetch (M3.5)

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-037..041, `docs/art-direction.md` (all), `docs/prompts/*.md`, `docs/art/printings.md`, `docs/data-model.md` §6 (log) and §8 (fixtures inbox), ADR-008, ADR-014, ADR-026. The imagegen skill under `.claude/skills/imagegen/` (read its SKILL.md first; if absent, stop and ask Chris).

## Goal

A read-only browser viewer for saved game logs that is built as the seed of the game UI, in the art direction decided in `art-direction.md §0`; a first generated-asset pass (icons, surface, parchment, frame ornaments, card back, two placeholder portraits); and the Scryfall fetch step that populates `data/art/real/`. No interactive play. No heuristic AI.

## Part 0 — Prerequisites and plumbing

0. **Registry check.** Confirm R-025 reads `implemented (S5)` and R-007 no longer says the legend rule is M3 (the planner's copy of the registry showed both stale).
0b. **Event sequencing (ADR-040).** Add `seq` and `afterAction` to EVENT entries; replay unaffected.

1. **Log export.** `pnpm fuzz --save <dir>` writes each game's `MatchSpec` + action log (+ EVENT stream) as JSON. Also `pnpm play-random --seed S --decks A,B --save file.json` for one game.
2. **Viewer state source is the engine.** The viewer never re-implements rules: it loads a log, and for action index *k* obtains state by `replay(log, k)` (add a prefix-replay entry point if absent). Alternatives in the decision panel come from `legalActions(state, player)` at that point (ADR-014 logs only the chosen action). Cache states per index.
3. **`packages/ui`**: Vite + React + TypeScript; depends on `engine`, `cards`, `core` only. No state duplication; components read `GameView`-shaped data for both seats (the viewer is omniscient but uses the per-seat view shape so play mode can redact later).
4. **Art assets**: `assets/generated/` (committed) and `data/art/real/` (gitignored). Rendered frame is a React component drawing our frame (art-direction, prompts/surfaces-and-frame.md) around an `art_crop` or a generated placeholder.

## Part 1 — Art pass (imagegen skill)

Order: (a) generate 3 style samples (one icon, one portrait, one surface) and **stop for Chris's approval** before generating the full set; (b) icons per `prompts/icons.md`, traced to SVG (24px grid, 2px stroke), committed as `assets/generated/icons/*.svg`; (c) `surface-wood`, `panel-parchment`, `frame-corner`, `card-back`; (d) `portrait-you`, `portrait-opponent`. Log every generation in `assets/generated/MANIFEST.md`. Mana glyphs are ours — never reproduce WotC symbols.

## Part 2 — Scryfall fetch

`pnpm art:fetch`: for each pool-registry card, resolve per `docs/art/printings.md` (default rule + overrides), download `art_crop` and `normal` to `data/art/real/<cardId>.{art,full}.jpg`, write the resolved `scryfallId` + artist + set back into the pool registry, and **flag** unresolved/ambiguous rows in the handoff. Honor Scryfall's request spacing and identify the client. Idempotent; skips existing files.

## Part 3 — Viewer

Layout per `art-direction.md §2`: board ≈2/3 left, rail ≈1/3 right, bottom transport. Combat lane = two rows (P1 combatants / P2 combatants) aligned by column. Rail: opponent status (portrait, name, life, zone counts with icons, mana pool with our glyphs) · stack (with target arrows/labels) · decision panel (decision taken + legal alternatives) · your status · inspector (our frame + oracle text; "printed card" toggle to `normal`). Log: implement as a rail tab first; leave a bottom-row variant behind a flag for Chris to compare.

Card presentation per `art-direction.md §3`: battlefield = art crop + name strip + P/T badge reflecting current characteristics (deltas colored), tapped rotated, sick desaturated, attachments beside host at reduced width; hand = full frame; hover → inspector.

Transport: first/prev-step/prev-action/play/next-action/next-step/last; speed; scrub. Keyboard: ←/→ action, shift+←/→ step, space play. "Flag this" writes a fixtures-inbox entry per data-model §8 (ADR-040); it must not require the dev server (plain file write via a tiny local endpoint in the Vite dev server or a download).

Replay toggle: reveal opponent hand (default off).

## Definition of done

1. Style samples approved by Chris before the full art pass; MANIFEST complete.
2. `pnpm art:fetch` run once; pool registry carries ids/artists; flagged rows listed in handoff.
3. Viewer loads any saved log, scrubs to any action, shows correct board/stack/decision at every index (spot-check against fixtures: S1-4 Pacifism fizzle, S3-1 Siege-Gang, S5-1 Control Magic sickness), renders our frame for all cards, shows generated icons/portraits/surface.
4. Flag-this produces a file a later session can turn into a fixture.
5. `handoff.md`; Concerns expected: anything the viewer revealed about the log/EVENT stream (missing payloads), frame typography at small sizes, performance of prefix replay on long games.

## Out of scope

Interactive play, AI, overworld, animations beyond simple transitions, mobile layout.

## Escalate, don't decide

Any rules-engine change motivated by the viewer (report; don't patch); any style drift from `prompts/style.md`; WotC iconography.
