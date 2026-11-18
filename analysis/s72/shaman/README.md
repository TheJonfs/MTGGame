# The Storm Shaman study (post-S72, 2026-11-17)

**The card** (custom, Chris; working name): {1}{R}{R} Creature — Elemental Shaman 2/2. "Whenever you cast an instant or
sorcery spell, add {R}." Tier 2 (Chris). It is meant as the one extra piece for an RU "Storm" brew with no Storm payoff.

**Rules.** No new vocabulary: Waste Not's triggered `addMana` with Guttersnipe's SPELL_CAST condition. The ability is not a
mana ability (CR 605.1b: it triggers on a cast, not on a mana ability), so it uses the stack and resolves before the spell.
Its {R} empties as the step or phase ends (CR 500.5, 106.4).

**The pilot.** No new AI was needed. In a 40-game probe (RUW Spells with four Shamans against the Minefield), the Shamans
made 56 red. Only about 12 more went unspent at step changes than in the same list without them (68 against a baseline of
56, which comes from Highland Ritual's floating mana), and that remainder is mostly a turn's last floating {R}. The list cast
384 instants and sorceries against 314 without the Shaman, so the AI does chain off it.

**Method.** Chris's RUW Spells sixty (`analysis/s72/ruw/deck.json`) as `br` in the Nothing Dear field, `open:rr --only br`,
seed 1176, 160 games a pairing (1,920 games a version), the four Shamans swapped in place.

| version | win % (±2.2) | Δ |
|---|---|---|
| RUW Spells as is | 45.2 | — |
| Shaman ({1}{R}{R}) for the 4 Seasoned Pyromancer | 36.1 | −9.1 |
| Shaman ({1}{R}{R}) for the 4 Young Pyromancer | 37.3 | −7.9 |
| Shaman at {1}{R} for the 4 Young Pyromancer | 42.7 | −2.5 |

**Reading.** As designed it is under the bar for the deck it was made for. With no Storm payoff in the pool, the extra red
is only a discount on the next spell, and a 2/2 that does nothing else loses to either Pyromancer, whose bodies (or card
flow) are real. Even at two mana it trails Young Pyromancer. A design ruling for Chris: cheaper, a bigger body, or a rider.

## Round 2 — Chris's rider (2026-11-17)

Chris added "When this creature enters, return target instant or sorcery card from your graveyard to your hand." The rider is
Experimental Overload's regrowth and Revivalist's trigger shape: no new word. Same method and seed (the round-1 files are in
`v1/`).

| version | win % (±2.2) | Δ vs as is | without the rider |
|---|---|---|---|
| RUW Spells as is | 45.2 | — | |
| Shaman + rider for the 4 Seasoned Pyromancer | 41.9 | −3.3 | 36.1 |
| Shaman + rider for the 4 Young Pyromancer | 43.6 | −1.6 | 37.3 |
| Shaman + rider for the 4 Ponder | 45.8 | +0.6 | — |

**Reading.** The rider is worth about six points. The card is now a peer of the Pyromancers, and as a fourth threat beside
them (in Ponder's slots) it is even with the list. The worst matchup stays the Rabble (−9 to −15), where a 2/2 is a poor
blocker next to tokens. Playable and fair, not a pillar-maker.
