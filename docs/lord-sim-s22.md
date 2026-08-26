# lord-sim tables — S22b Part 6 (2026-08-25)

`pnpm lord-sim --games 10` (700 games/lord: 10 × 7 references × 3 life points × 3+ tiers…; the
guardian-sim conventions: reference set = the five starters + slice C/D, journeyman pilots at
world life 10; the lord at master with his PARTISAN LAW in play and his ENTRANCE applied).
Read against the S20 guardian tables (Reya 70–92 / Arcanis 39–91 / Drana 78–99 / Drakuseth
71–97 / Titania 46–95% across their empowerment range).

## Kill tables (the lord's win %, by life point × interior-steps tier)

| Lord (law) | life | @0 | @60 | @90 |
|---|---|---|---|---|
| The Warden (the Intake) | hunted 15 | 30% | 44% | 74% |
| | base 30 | 46% | 70% | 80% |
| | grown 50 | 70% | 77% | 91% |
| The Unwinder (the Risen Tide) | hunted 15 | 49% | 77% | 97% |
| | base 30 | 80% | 79% | 94% |
| | grown 50 | 84% | 90% | 91% |
| The Usher (the Tithe) | hunted 15 | 87% | 99% | 97% |
| | base 30 | 97% | 99% | 99% |
| | grown 50 | 99% | 97% | 100% |
| The Stoker (the Toll) | hunted 15 | 77% | 93% | 100% |
| | base 30 | 97% | 97% | 99% |
| | grown 50 | 97% | 100% | 99% |
| The Sower (the Season) | hunted 15 | 66% | 99% | 100% |
| | base 30 | 91% | 100% | 100% |
| | grown 50 | 100% | 100% | 99% |

## The brief's three observations

- **The Usher's launder line: 0 of 630 games.** She does NOT find it unaided — but the line's
  preconditions are rare by construction, not (only) by AI blindness: her ETB reanimation needs a
  creature card already in a graveyard when she resolves (early references' yards are thin), her
  deck runs ONE Restoration Angel, and both must be live at once. The launder pin (view-side
  `pendingEndStepSacrifices` pricing) is in and fixture-verified; whether the CARDS give her
  enough chances is a deck-iteration question for the director round.
- **The Stoker's library race: 0 DECKED terminations of 630.** At reference world-life 10 the
  damage race ends games long before libraries do. The deck-out path is a HUMAN puzzle path
  against a high-life lord (his interior fight starts ≥15); the sim's reference conditions cannot
  observe it. If the round wants the number, a life-100 no-damage-policy probe is a small
  extension (the time-to-liberation precedent: build it when a tuning round asks).
- **The Sower's sphinx at {3}{W}{U}: 1.00 activations/game.** The mana-sink is exercised
  exactly as designed at ? = 3. Nothing in the tables argues for 2: he already posts 91–100%
  from base life, and the doc's player-side degeneracy argument against {2} stands untouched.
  **Table's answer to the ?-question: keep 3** — Chris rules.

## Readings for the director round (implementer's, not rulings)

1. **The Tithe is the sleeper.** The watch-flags went to the Toll and the Season, but the COURT
   posts the cycle's hottest floor: 87% at life 15, tier 0 — every reference deck is creatures,
   and each death is −1 (law) −2 (drain) +2 (her purse). The Usher may need her own watch-flag.
2. **The Toll's turn-1 bite looks real** at low life (77% at the floor) — consistent with the
   shipped watch-flag. At interior life ~10 arriving burned, every spell costs a tenth of you.
3. **The Warden reads as intended**: the beatable-with-his-own-shops lord (30% at the floor —
   hunting the white spoke genuinely opens the Bastion) with a real ceiling (91% grown+fed).
4. **The hunt lever works**: every lord's hunted row sits well under his grown row (30→70,
   49→84, 87→99, 77→97, 66→100 at tier 0). The pace war differentiates as designed.
5. Caveat: references fight at world life 10 with journeyman pilots — these are RELATIVE
   numbers (lord vs lord, row vs row), not player-experience predictions; Chris's storm is the
   felt-difficulty instrument.
