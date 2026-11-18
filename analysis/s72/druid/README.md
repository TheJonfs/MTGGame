# The Order Druid study (post-S72, 2026-11-17)

**The card** (custom, Chris; working name): {1}{G}{G} Creature — Elf Druid 2/2. "{G}, {T}, Sacrifice this creature: Search
your library for a green creature card, put it onto the battlefield, then shuffle." Tier 2 (Chris).

**The question.** Is it too strong? A gold green card is a green card, so it fetches the wedge legends (The Reaper, The
Sower, The Reeve, The Warden) and the big green bodies (Pelakka Wurm, Rampaging Baloths) at instant speed for {G} beyond its
cost. Three wordings were tried: as written, mono-green only, and mana value 5 or less.

**Method.** `open:rr --only <list>` on seed 1175, 160 games a pairing against the nineteen other Open lists (3,040 games a
version), master pilots both seats. Four Druids replace, in place:

- **Wurmspeaker:** 3 Gaean Wurm and 1 Treetop Snarespinner. Its finds are Pelakka, the Baloths, Seedborn and Baru.
- **Reaper Clio:** 4 Rage Cobra. Its finds are The Reaper, Mystic Snake, The Reeve and Reaper's Forerunner.
- **Countersnake:** 2 Deadly Recluse and 2 Wall of Blossoms. Its finds are The Sower, Mystic Snake and Reaper's Forerunner.

## Results (win % of the list over the field, ±1.8 at 95%)

| list | original | as written | mono-green only | mana value ≤ 5 |
|---|---|---|---|---|
| Wurmspeaker | 35.8 | 34.3 (−1.5) | 33.8 (−2.0)* | 25.5 (−10.3)* |
| Reaper Clio | 66.7 | 57.4 (−9.3) | 56.7 (−10.0)* | 57.6 (−9.1)* |
| Countersnake | 47.9 | 50.2 (+2.3) | 46.8 (−1.1)* | 50.1 (+2.2)* |

\* Run with the first pilot, before the two fixes below. Those fixes moved the as-written column by half a point or less.

## Reading

- **As written, it is not too strong in any shell.** It is roughly even in the green lists and costs Reaper Clio nine
  points: Rage Cobra is better there than a tutor for a third or fourth Reaper.
- **Mono-green** changes nothing in Wurmspeaker, which is already all green. It costs Countersnake its Sower, three points.
- **A mana-value cap at 5** guts Wurmspeaker (−10), because Pelakka and the Baloths *are* the card there. It changes
  nothing in the gold lists, since the legends are mana value 5.
- **The real limiter is summoning sickness.** In a probe of 40 games, Wurmspeaker with Druids against the Tollgate cast
  60 Druids and fetched with 9. Of the Druids that died unused, 27 of 35 died still summoning-sick, during the opponent's
  turn right after they were cast, to Pyroclasm, Wrath, Savage Twister and the Kavu. The {T} cost cannot be paid until
  the Druid has survived a full turn cycle (CR 302.6), so removal-heavy decks catch it every time. That is the card, not
  the pilot.
- **Where it shines:** against slower, creature-light decks. In Reaper Clio it fetched The Reaper 18 times in 30
  activations against the Fun Police, nearly always at their end step.

## The pilot (book 175)

- **The search pick:** the search onto the battlefield takes the best body (the reanimator's worth), not the cheapest card.
- **The library:** the AI knows its remaining library as its decklist less what it can see, and the activation is priced
  at the best find.
- **Timing:** it fetches at the opponent's end step, or in answer to removal on the stack — removal aimed at the Druid,
  or a sweeper, damage, exile, bounce or edict.
- **Payment:** while a ready Druid stands, casts are paid so that its {G} stays open.
- **The two fixes** marked above are the second answer (a sweeper, not only a targeted kill) and the payment rule.
  Neither moved the numbers, which confirms that the deaths are summoning sickness, not mana.

Files: `<list>-<version>.json/.md` (merged runs); `v1/` holds the as-written runs under the first pilot.
