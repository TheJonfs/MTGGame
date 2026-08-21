# Session 13 Brief — M6a, the visible half: walk the world

Read first: `CLAUDE.md`, `handoff.md`, `docs/overworld-manifest-v0.3.md` §2–2b, `docs/decisions.md` ADR-063 (rulings incl. the parley-telegraph requirement), `docs/art-direction.md` (the cartographic direction now gets its map), `docs/knobs.md`. The S12 core (generator, WorldState, journey, duel seam, save format) is **frozen**: the UI reads and drives it; any needed schema field is a versioned `v2` migration, escalated first (S12 concern 2).

## Goal

`/world`: new game → wander the map → encounter → parley → duel in the play client → consequences applied → town, shop, save/load, game-over — Chris plays the whole loop. Budget two director rounds; the map is new art and will draw them.

## Part 1 — The map

Ink-and-wash cartography per art-direction: region washes by tier (civilized calm, approach saturated toward its colour, wild dark), ink region borders, rough-terrain hatching, town glyphs (icon pipeline; label on hover), player as a portrait chip. Click-to-walk: BFS path preview (dotted ink), confirm or click elsewhere; steps tick visibly (a step counter in the chrome — the clock is real even though nothing consumes it yet). Encounters interrupt the walk at the encounter cell with a reveal: portrait, name, tier badge (S12 concern 4 — the badge carries tier visually), colour identity.

## Part 2 — Parley

Fight / Flee / Buy off with **real numbers shown before choosing**: buy-off price (greyed with reason when unaffordable), flee odds by tier **and the ADR-063 telegraph — "forfeit your stake either way; if caught you fight and stake again."** Fight launches the play client via the `custom` path (already built); on return, `applyDuelResult` consequences are *narrated* (ante cards shown moving by name/frame, gold delta, world-life change, defeat mark) — the sting should be legible, not a silent state change.

## Part 3 — Town, shop, collection

Town screen (clock-free, stated in the chrome): shop with **seeded stock** (this is the one headless piece S12 didn't build — stock rolled from region colour + knob size/pricing, buy only, persistent per town per visit-count or per world — implementer proposes, escalates if it needs a schema field), gold displayed; collection browser = gallery filtered to owned counts (read-only; active deck marked); leave.

## Part 4 — Shell

New-game screen (colour → starter deck per manifest §2b, difficulty bundle, seed field), autosave on town entry + manual save, load from start screen, download/upload, world-life display with game-over screen at the floor (offer: view the fatal duel's replay). Portrait verdicts: show Chris the five S12 candidates in situ during a director round; kept/rejected to MANIFEST.

## Part 5 — Acceptance

Scripted: drive the UI-layer controller through new-game → walk → parley branches → duel-and-return → shop purchase → save/load round-trip → game-over. Human: **Chris plays** — a new world, several encounters, at least one deliberate loss, a purchase, a save/quit/resume, and (if the dice allow) a game-over. His felt-wrong list is S13's primary output alongside the code.

## Definition of done

1. Parts 1–5; the two director rounds folded in; acceptance both halves.
2. No `world-save-v2` unless escalated and migrated; all suites green both tiers.
3. `handoff.md`; Concerns expected: knob defaults that felt wrong in play (encounter rate above all), what the shop wants for M6b (sell? refresh rules?), map-rendering fights, and the list of world-state fields the UI wished for.

## Out of scope

Quests, sieges, clocks-with-consumers, dungeons, bosses, deck editor, manalinks, card buy-offs, meta-progression, AI work, new cards.

## Escalate, don't decide

Any schema change (versioned migration only); any knob default change beyond what Chris directs live (record his directions as director-round entries); any engine or agents change at all.
