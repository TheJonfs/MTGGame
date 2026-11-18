# The Silt Spirit study (post-S72, 2026-11-17)

**The card** (custom, Chris; working name): {1}{U}{U} Creature — Spirit Wizard 0/3. "Creatures you control have '{T}: Target
player mills X cards, where X is this creature's toughness.'" Tier 2 (Chris). It is the Phenax route to a toughness-matters
payoff.

**Rules (R-133).** A new value ref, `sourceToughness`: the creature's toughness as the ability resolves, or, if it has left, its
last-known toughness (CR 608.2h). So a Spirit killed in response still mills three. The {T} cost keeps a summoning-sick
creature from using it (CR 302.6).

**The pilot (book 176).** A creature's {T}-only mill waits for the opponent's end step. The creature untaps in our untap step,
so each one mills once a turn cycle and gives up no block and no attack. It mills at once when the creature is under fire
(an opposing removal on the stack) or when the mill empties the target's library. The predictor reads the creature's
toughness, so a Wall of Air's five outscores the Spirit's three. The rule also moves Cathartic Adept's mill to the
opponent's end step; two old books were re-read in that window. The ladder was unchanged.

**Method.** `open:rr --only <list>` on seed 1177, 160 games a pairing against the list's own format field, the four Spirits
swapped in place.

| list (format) | swap | original | with the Spirit | Δ (±) |
|---|---|---|---|---|
| Sultai Mill (Sultai) | 4 Tome Scour | 46.1 | 53.9 | **+7.9** (2.4) |
| UW Skies, walls (Peasant) | 4 Plumecreed Escort | 49.1 | 47.1 | −2.0 (2.1) |

**Reading.** In the deck it was made for, it is a real upgrade: Tidewall, Clio, Traumatizer and Zinnia each mill four a turn,
and it gains 12 to 15 points against the slower blue and black lists (Depths, Undertow, the Barrow). It does not make the mill
deck dominant (about 54%). In a flier deck that wins by attacking it is slightly worse, because tapping to mill competes with the
attack. A purpose-built walls list (Wall of Reverence 1/6, Moaning Wall 0/5, Wall of Air 1/5, Tidewall 0/4, Wall of Blossoms
0/4) is the untested brew. No tuning indicated.
