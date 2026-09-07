# Session 31 brief — the Traumatizer, the Artisan, Pell and Corvane, and the five roads

*Planner → Implementer. 2026-09-07. Follows the running handoff.md (after S30). Reads starters.md. Process rules unchanged: appends to `docs/decision-updates/s31.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts; re-verify every ⚠ text by curl before encoding.*

## Rulings (Chris, 2026-09-07) — ADR appends for docs/decision-updates/s31.md
- **ADR-106 — The five roads aim at parity.** The starters are tuned toward every pairing inside 40–60; the difficulty dial is worldcraft, not the starting hand. Part 5's amendments go in on that basis and the round-robin re-runs.
- **ADR-107 — The Traumatizer is an archetype anchor.** Retexted (Part 1): every creature the controller has drives the mill; multiple copies stack additively. Chris's design; the planner's attack-trigger version was passed for putting two kinds of mill on one card.
- **ADR-108 — Artisan of Kozilek and Grazing Gladehart enter the pool (190 → 192).** The Artisan is a colourless R-table card and the game's first reanimation target that is not prizeOnly; one copy in Lord Corvane's forty. More castable black and white reanimation targets are planned to ride along on Buried Alive later (Chris).
- The Elemental plate stands; the Skeleton's Archenemy art stands; the Chronicle tease stands until phase two.

---

## Part 1 — The Traumatizer, retexted (Chris)

> **Traumatizer** {2}{U}{U} — Creature — Nightmare — 2/4
> Flying
> Whenever a creature you control deals damage to a player, that player mills twice that many cards.

The card is no longer a flier that mills when it connects; it is the anchor that turns every creature its controller has into a mill engine, the way Gaean Wurm anchors Forests and the Tactician anchors tapping. Rules as encoded:
- *Deals damage*, not combat damage: Arc Mage's activation, a trample overflow, a Thundersnake hit all count. The Traumatizer itself is "a creature you control."
- Each Traumatizer triggers separately: two in play mill twice-plus-twice (additive, four times the damage), not four-times-squared.
- Damage to a player only — not to creatures.
- **Words:** zero. S28's any-recipient DEALS_DAMAGE collector carries the damaged player and the amount; the "creature you control" filter is the collector's controller side. Note for R-094: this is the first *controller-wide* creature trigger on a permanent, the shape future "creatures you control have X" cards will reuse — build it as that shape, not as a Traumatizer carve-out.
- Price 30 stands.

**AI:** with a Traumatizer on the battlefield, every point of player damage is worth its damage *plus* twice that as library damage under the existing mill pricing — the attack planner must add the trigger's mill to each attacker's value (the Blood Artist-observer pattern from Vael's Wrath, on attacks). Pins: with a Traumatizer out the AI attacks with 1/1 Adepts into an empty board; it casts the Traumatizer before a second Crab when both are in hand and the board has attackers; it protects the Traumatizer with a counter when one is up.

**Fixtures:** combat and noncombat damage; two Traumatizers stack additively; damage to a creature does not trigger; a Giant Growth on the attacker doubles the mill; the Traumatizer's own damage triggers itself.

## Part 2 — Artisan of Kozilek (verified on Scryfall 2026-09-07)

{9} Creature — Eldrazi, 10/9. *When you cast this spell, you may return target creature card from your graveyard to the battlefield. Annihilator 2.* Rise of the Eldrazi.

- **Tier R**, price as the R table sets (the duals are R at 10 — the implementer aligns). Not prizeOnly; the point is that it shows up. One copy in Corvane (ADR-108).
- **Words:** the cast trigger is S29's (Pyromancer's word, here on the caster's own creature spell — it triggers on *cast*, so it resolves before the Artisan itself and cannot be stopped by countering the Artisan, CR 603.2). **Annihilator** is one new word: an attack trigger under which the defending player sacrifices N permanents of their choice. That is the *edict* shape — the same word Diabolic Edict would need, so it half-answers the black-removal question at no extra cost (flagged in Part 6).
- **Why it's the right add rather than Nightmare:** reanimated on turn four it's a 10/9 that eats two permanents on every attack — that is a fight that ends in two swings, which is what a reanimator's payoff is supposed to be. Hard-cast at nine it returns a creature for free, which the manalink-heavy endgame deck can actually do. And it's colourless, so a red-white sacrifice deck or a black-green Buried-Alive deck can build toward it the same as Corvane.
- **Counterplay that exists in the pool:** Swords, Pacifism, Control Magic (ouch), Boomerang/Man-o'-War (it goes back to a nine-mana hand), chump-and-race; and the annihilator only fires on attack, so a tapped-down Artisan (Master Decoy, the Tactician) does nothing.
- **AI:** attacks with it every turn it's untapped unless a blocker kills it (only a 10/9 with deathtouch does — Recluse, Rats, Nighthawk: the AI must see deathtouch here). The sacrifice choice for the defending player (AI side): lands last, tokens first, then the least-valued permanents — the existing lowest-value chooser. The reanimation on cast: the best creature in the yard (the Zombify valuation).
- Fixtures: the cast trigger resolves even if the Artisan is countered; annihilator with fewer than two permanents; the defending AI's sacrifice choice; deathtouch blocks kill it.

## Part 3 — Lists amended (final)

**Tessaly Reed (T1, U)** — 16 Island · 2 Evolving Wilds
```
4 Hedron Crab · 4 Cathartic Adept · 3 Traumatizer · 2 Thought Scour · 2 Brainstorm
1 Wall of Air · 2 Essence Scatter · 1 Counterspell · 1 Boomerang · 2 Altar of Dementia
```
40 / 18 / 22. Under a Traumatizer every Adept is a two-card mill on attack as well as a tap; the deck attacks now.

**Pell of the Shallows (T2, UG) — the pump-mill deck** — 7 Island · 6 Forest · 2 Breeding Pool · 2 Evolving Wilds
```
4 Hedron Crab · 3 Traumatizer · 3 Rampant Growth · 2 Wood Elves · 2 Grazing Gladehart ⚠ · 2 Rumbling Baloth
2 Rancor · 2 Giant Growth · 1 Birds of Paradise · 1 Brainstorm · 1 Altar of Dementia
```
40 / 17 / 23. Chris's direction: buffs augment milling. A Rancored Baloth under a Traumatizer is six damage and twelve cards; a Giant Growth in combat is six more. The Gladehart buys the turns; the Crabs and the Altar finish. No counters — the deck is proactive now.

Grazing Gladehart ⚠ (Zendikar; {2}{G} 2/3 Antelope, landfall — you may gain 2 life). Tier 1 / 12. Zero words.

**Lord Corvane (T3, WB)** — unchanged lands
```
2 Youthful Valkyrie · 2 Indulgent Aristocrat · 2 Blood Artist · 1 Gravedigger · 1 Terror
2 Unearth · 3 Zombify · 3 Buried Alive · 1 Restoration Angel · 3 Serra Angel · 1 Artisan of Kozilek · 2 Swords to Plowshares
```
40 / 17 / 23. Buried Alive finds Artisan + Serra + Serra; Zombify the Artisan. The Buried Alive gate (a reanimator in hand) is unchanged.

**Magister Quill (T3, UG)** — −1 Wall of Blossoms, +1 Traumatizer (a Gaean Wurm under it is ten-plus cards a swing).

**Varro Flamebrand (T3, UR)** — unchanged; note his two Traumatizers now turn Elementals and Arc Mage pings into mill. Read him in the sweep.

## Part 4 — Sweep additions
- **Part 5: tier-2 and tier-3 mages against the five starters** (starters at 10 / journeyman) — the library size the mill decks actually face. Read Pell, Quill, Varro there, not in part 1.
- Re-run parts 1–4 with the S30 baseline; cast counts.

## Part 5 — The five roads (ADR-106)

**The read from starters.md.** Dawn Levy: 12 lands, average MV 1.83, eight one-drops, two Swords, two Pacifism, an Anthem and two Tacticians — the fastest curve *and* the most removal of the five. Tidal Grimoire: average MV 3.00, eleven three-drops on twelve lands, no one- or two-drop creatures, no removal beyond bounce — it loses the first four turns to everyone. Verdant Trail: nine two-drops with no evasion and one Prey Upon — a pile of 2/2s that a Suntail Hawk flies over and a Fencing Ace walls. Pallid Court and the Ember Warband are fine.

**Amendments** (small; the starters are also the player's first lesson, so nothing exotic):

- *Dawn Levy* — −1 Swords to Plowshares, −1 Cunning Tactician → +1 Plains (13), +1 Youthful Valkyrie. Less removal, a slightly slower curve, still the aggro road. (Hard mode's "−1 Swords" still has a Swords to remove.)
- *Tidal Grimoire* — −1 Mist Raven, −1 Aven Fisher, −1 Wind Drake → +2 Wall of Air, +1 Brainstorm. Two-and-three drops that hold the early turns; the Air Elemental stays as the finisher; Brainstorm is a good first card to learn.
- *Verdant Trail* — −2 Elvish Visionary, −1 Timberland Guide → +2 Rancor, +1 Prey Upon. Evasion through trample and a second removal spell; the deck the Wardener teaches from.
- *Ember Warband* — −1 Gray Ogre → +1 Lightning Bolt. Marginal; red's 33% against white wants one more answer.
- *Pallid Court* — unchanged.

Easy/hard variants adjust to keep their deltas legal; the implementer reports any that don't. **Re-run sweep parts 2 and 4** after; target every starter pairing inside 40–60, and re-read the tier-1 teachers against the new starters.

## Part 6 — Flagged, not for this session
- **Annihilator is the edict word.** Once it exists, Diabolic Edict ⚠ (Tempest; {1}{B} instant, target player sacrifices a creature) is a zero-word add — the black unconditional-answer question from S28 can be closed with it whenever Chris wants; it also answers a lone Artisan, which is the kind of symmetry the pool likes.
- The Lumberjack's home; phase two.

## Verification & handoff
Fuzz the amended decks and the five starters at the full tier before fixtures; replays byte-exact. FUZZ_FULL ladder gate and the vs-random ladder for the AI changes (the Traumatizer attack valuation, the Artisan's attack and sacrifice policies). Test baselines (def count, shop-tier counts, R-table counts). `pnpm reference` → cards.md (192), enemies.md, starters.md. Handoff in the running handoff.md: sweep parts 1–5 with the S30 baseline, the starter round-robin before and after, cast counts, deviations, concerns, the registry section (190 → 192, R-094: annihilator; the controller-wide creature trigger).
