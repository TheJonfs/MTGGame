# Session 25 Brief — The Five Powers

Read first: `handoff-s24.md`, ADR-087..088 (`docs/decision-updates/` — apply as Part 0 ceremony), **`docs/five-powers-design.md`** and **`docs/mox-court.md`** (the binding specs — design and court are Chris-ratified; wire, don't redesign), `docs/dungeon-design.md` (as amended — the swap banner). Budget director rounds: court art verdicts, power feel, the first Quietus. **Kickoff inputs from Chris:** the five power-dungeon names; any eve-of-session rate flinches.

## Parts

**Part 0 — Housekeeping.** ADR-087/088 appends; FUZZ_FULL baseline.

**Part 1 — The five small words (ADR-088's catalogue), fixtures at their customers.** Double-X costs (the Keeper announces 2X; X=0 legal); `{ref: xPaid}` riding the permanent to its ETB (the Keeper's trigger; removal-in-response leaves the team unpumped only if the trigger's gone — fixture the timing); life as activation cost (the Witch at life 3, 2, 1 — the last illegal); exile-top-as-cost (the Cleric with a one-card library: mode one legal, mode two not); keyword-until-EOT verified-or-built (the Cleric's indestructible through a Wrath — the fixture that matters). Fuzz-before-fixtures per doctrine.

**Part 2 — The fuel system.** Colour-matched spare-card costs with the picker (auto-suggest cheapest by shopTier-then-price; deliberate override; active deck never listed); gold cards fuel either colour; `prizeOnly` burnable with the warning, sole-mechanism cards double-confirm ("there is exactly one, and it was yours"). Unlock flags + power forms in the save (implementer proposes the version bump; consider reserving gauntlet-adjacent fields while in there — escalate the list).

**Part 3 — The powers, wired.**
- **Rail Powers panel:** the Stride (activation, duration countdown visible on the rail), the Balm (per-point with live card cost, capped at max), the Crossing (destination list = towns under warning or occupation; arrival at the gate; **zero clock ticks** — fixture that).
- **Parley menu grows:** the Quietus and the Barrage beside fight/flee/payoff — costs live, greyed-with-reason when illegal (wrong target class for the Quietus; no red spares; cap reached). Quietus resolution: the ante roll pays, no gold, **fear-only renown**; the roamer dies without a duel (Dueltune rings, then the quiet). Barrage: a one-shot startingLife delta on the MatchSpec (the dungeon-law hook), floored at 1.
- **Upgrade wiring:** each lord's fall flips its colour's power to advanced automatically; the Powers panel shows form and seal state; retroactive for already-fallen lords on migration.

**Part 4 — The swap + the sites.** Five **power-dungeons** authored in the approach rings (Moxen-class per dungeon-design; lawless like lair-dungeons; escrow applies; the power grants at the prize room alongside the standard roll); **the real legends re-pointed** to them with their S20 decks and drops intact; **the Mox court installed** at the five Mox dungeons — five card defs per `mox-court.md`, the v1 court decks, ADR-052 ceremony ×5 (four candidates each, director-round verdicts; `printedAsset` JPGs follow Chris's pipeline on receipt). Existing saves grandfather (confirm the worldgen seam; escalate if guardian identity leaks into world state beyond templates).

**Part 5 — Instruments.** guardian-sim over the five court decks (kill tables vs the reference set); world-sim gains power-usage columns (activations per tour, fuel burned by colour, Quietus tier mix, Barrage sizes) and **spare-pool depth by colour** (three demands now compete for spares — measure the scarcity). The pin-17 family additions ladder-gated as ever.

**Part 6 — Acceptance.** Scripted: each power activates, charges correctly, and respects its bounds; the Sage-loop runs; the Witch stops at life 2; a lord's fall upgrades a power; a Crossing lands at an occupied gate with the clock untouched. Human: **Chris learns a power at its dungeon, burns cards he never sleeved, quietuses something that deserved it, barrages something that didn't die, crosses to a burning town, and meets the court** — verdicts on feel, rates, art, and the fuel picker's suggestions.

## Definition of done

Words landed with fixtures; fuel live with the picker; five powers active on both surfaces with upgrade wiring; the swap complete and the court installed with decks and tables; sims filed; felt-wrong harvest. Concerns wanted: rates that played wrong, picker suggestions that annoyed, any Quietus/Barrage UI friction at the parley menu, spare-scarcity readings, court decks vs their intent.

## Out of scope

The gauntlet (the seals now upgrade — they still do not unlock; the ending remains undesigned and untouched); the overworld ambience slice; menu music and pending stingers; meta-progression; deck iteration for the lords (the storm round); the R-economy.

## Escalate, don't decide

The save-version field list; any word resisting its catalogue entry; Crossing destination edge cases (a town relieved mid-flight?); anything the power-dungeon authoring wants that resembles a law; all things gauntlet.
