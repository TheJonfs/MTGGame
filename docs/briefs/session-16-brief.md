# Session 16 Brief — worldgen round 2: roaming enemies, mono starters, the one-drops

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions-append-S16.md` (append to decisions.md first, verified; ADR-069..071 are the spec), `docs/world-design-round-1.md` v2 §2/§4/§5, `docs/overworld-manifest-v0.3.md` §5 (the clock ticks it retunes). Oracle texts (planner-verified; re-verify): Llanowar Elves "{G} Creature — Elf Druid 1/1 — {T}: Add {G}."; Cathartic Adept "{U} Creature — Human Wizard 1/1 — {T}: Target player mills a card."

## Part 0 — Docs + amendment

Append ADRs; mechanics-manifest Amendments subsection gains amendment 3 (mill — copy ADR-070's text verbatim); knobs doc regenerated after Part 2's knobs.

## Part 1 — Engine + cards

1. **`mill` resolver** per ADR-070: top-N to owner's graveyard via moveObject; not a draw (no empty-draw loss from mill; decking still loses on the *draw*). Fixtures: targeted mill; mill-to-empty then the draw loses; mill fires zone-change events (a milled Pelakka does NOT trigger DIES — battlefield→graveyard only; assert); replay.
2. **Creature mana producers:** the mana-ability/auto-pay path gates creature producers on summoning sickness (602.5g); Elves untapped+sick contributes nothing; next turn it does. Fixtures: T1 Elves → T2 three-drop; sick-Elves excluded from canPay; Elves as a Doom Blade target (it's a creature — dies like one).
3. Cards encoded + Scryfall re-verified; `art:fetch` (Elves: default rule resolves early Maddocks; Adept: ALA Critchlow). Pool 70→72. **Agent note:** the evaluator already prices mana producers (Mind Stone precedent); confirm Elves' board-material value isn't zero and the AI casts it early (fuzz-observe; a book-of-shame entry only if it misbehaves). Mill valuation v1: tiny nuisance value; the Adept is a starter check, not an archetype yet.

## Part 2 — Worldgen round 2 (ADR-071)

1. **Map scale:** `regionScale`, `townSpacingMin` knobs (registry-first); bigger grid; **scrolling viewport** centered on the player (the SVG becomes a window; minimap optional — implementer's call, report).
2. **Roaming enemies:** instances get positions (spawned in-region, seeded); each player step, each roamer moves one cell — toward the player if within `sightRadius` and not fleeing; away if the renown rule triggers; random-drift otherwise; contact = parley. Player *sees* roamers within their own sight radius (chips on the map, chip-crop portraits); rough terrain reduces sight (`roughSightPenalty` knob) — the only surviving "ambush." Lairs unchanged (stationary, certain). Encounter-rate knobs retire; spawn-density knobs replace them (per region tier). world-sim rewritten for the new model (tours now dodge/pursue; report the new encounter economics honestly — steps per fight by region tier).
3. **Renown + fleeing** per design doc §5: saved integer, `renownFleeFactor` knobs; fleeing roamers move away and are pursuable (contact still = parley, player-initiated).
4. **Home-region start + uniform towns:** region↔colour invariant (every colour has a civilized-or-approach region), player spawns in their colour's town; town spacing uniformized under the new scale. Generator fuzz extended (200 seeds, new invariants: colour coverage, roamer spawn legality, sight/pursuit determinism).
5. **`world-save-v3`:** roamer positions + `decks: Record<name, Decklist>` + `activeDeckName` + `provenance` (all defaulted in migration; the editor gains the deck picker per S14 concern 3's costing — new/duplicate/delete, spares subtract the active deck only). v1/v2 migration chain tested.

## Part 3 — Starters

The five §2 lists (one-drops in) as authored catalog starter decks per colour; difficulty adjustments per the doc; slice decks A–E demoted to enemy/ladder infrastructure (world newWorld reads starters). **world-sim per starter, 30 seeds, journeyman pilot: report the table vs the S14/S15 baselines — targets tier-1 ≥70%, tier-2 in the 40s; say honestly which starters miss.**

## Part 4 — Acceptance

Scripted: roamer pursuit → contact → parley; flee-from-player at high renown with pursuit; sight radius honoured; home-region start per colour; v2 save migrates and plays; deck picker (create/duplicate/switch/delete, active deck duels). Human: **Chris wanders the new map** — sees an enemy coming, dodges one, pursues a fleeing one, starts a green world with Elves on turn 1 — and files the felt-wrong list (map scale and sight radius above all).

## Out of scope

Bestiary/anchors (S17), quests (S18), sieges/dungeons/bosses, mill-archetype cards beyond the Adept, AI work beyond the Part-1 note.

## Escalate, don't decide

Any roamer behaviour beyond toward/away/drift; any new save field beyond Part 2.5; map-render rewrites beyond the viewport (art pass rides later); starter list edits (report world-sim, planner adjusts).
