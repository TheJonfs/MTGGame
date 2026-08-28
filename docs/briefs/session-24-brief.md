# Session 24 Brief — Recovery, the Loss Screen, and the Voice of the Plane

Read first: `handoff-s23.md`, ADR-085..086 (`docs/decision-updates/` — apply as Part 0 ceremony), **`docs/audio-mapping-v3.md`** (the landing spec — Chris-authored assignments; wire, don't re-map), art-direction §9. Budget a director round (inn feel, the loss screen, the splash panels, first hearings). **Kickoff confirms from Chris:** the life-manalink suspension consequence (occupation drops maximum, current clamps — planner-recommended keep) and anything the front-menu-music TBD resolves to.

## Parts

**Part 0 — Housekeeping.** ADR-085/086 appends; FUZZ_FULL baseline.

**Part 1 — The recovery package (ADR-086).**
- **Life manalinks:** the manalink reward class gains the +1-maximum-world-life kind — town-tied, permanent, sharing the class's suspension law (per the kickoff confirm). Knobs: kind-split weight, `lifeManalinkCap` (baseline 2–3), `manalinkRewardChance` 0.30 → 0.40. Quest-offer text: reuse the pointer line's register; one new line if wanted (planner supplies on request).
- **The inn:** every town's new service — rest trades steps for life at `innStepsPerLife` (baseline **5/8/12** by difficulty), quick options (*rest a little +2 / rest well +5 / recover fully*) with live step prices, restoration capped at current maximum. **The rest is a transaction bulk-advancing the world clock** — sieges, lord growth, deadlines, respawns all tick; events landing mid-rest queue their news for waking (no popups interrupting the dialog).
- **Instrument:** world-sim gains life-economy reporting — losses vs recoveries per tour, inn usage, life-manalink flow — the tuning tables for the knobs above.

**Part 2 — The loss screen (Chris-directed).** A post-battle loss screen symmetric with the win screen: itemizing what the defeat cost — the world-life penalty, the ante cards taken (shown as cards), stripped buffs or other stakes as they apply — then returning to the world. `Loseduel` fires here. (The win screen presumably already hosts `Winduel` — confirm the hook while adjacent.)

**Part 3 — The audio landing (mapping v3).**
- Schema: flat cue→file + the two resolutions (`music.town` by region colour+ring; `splash.stronghold` by id); the v3 cue additions registered; **pools deleted from the plan** (v2's ask superseded).
- Data: `mapping.json` per v3's tables verbatim — fifteen region tracks, five castle themes, seven stingers. Deliberate silences per v3 (no overworld, no in-duel, no interiors, menu TBD).
- **The stronghold splash panel:** entering a seat presents a custom panel — gate/exterior plate + the castle theme — visually distinct from a lair mouth. Five gate plates rendered (the bestiary-plate pattern: implementer renders in a register suiting each seat — the campaign map's painted world seen close; director-round verdicts; MANIFEST-logged). The splash is the threshold moment: panel, theme, the entry telegraph's stakes.
- Crossfade/stop behavior: town music ends at the gate (the road is silent); splash theme plays through the telegraph and yields to interior silence.

**Part 4 — Acceptance.** Scripted: inn transaction advances clocks and queues news; a life manalink raises maximum and survives save/load; suspension clamps per the confirm; the loss screen itemizes a real defeat; region music resolves correctly for a town in each ring; a stronghold splash plays its theme once. Human: Chris rests somewhere expensive and feels the clock spend, receives a life manalink, loses a fight on purpose and reads the bill, walks Duskmoor hearing Duskmoor, and stands at a stronghold gate while it announces itself — verdicts throughout.

## Definition of done

Recovery live with tables; loss screen shipped; mapping landed with every v3 assignment audible in place; splash panels rendered and verdicted; felt-wrong harvest. Concerns wanted: inn pricing feel vs the tables, suspension-clamp edges (a life-manalink town falls mid-rest?), any cue that fired somewhere unexpected, gate-plate register wants.

## Out of scope

The ambience layer and terrain classes (deferred); per-action duel stings; coin-flip and lord-fell stings (pending); front-menu music (TBD); meta-progression; travel powers; deck iteration and watch-flags (the storm round); the gauntlet.

## Escalate, don't decide

Suspension-clamp edge cases; inn/event-queue collisions; any audio-schema growth beyond the two resolutions; anything discovered that's travel-power- or gauntlet-shaped.
