# decisions.md — APPEND (ADR-088)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-087.*

---

**ADR-088 — The powers program: design, the great swap, the Mox court.**

*The five powers are ratified per `docs/five-powers-design.md`:* colour-matched card-sacrifice fuel from spares (count-denominated; gold cards fuel either colour; prizeOnly burnable, sole-mechanism double-confirmed; the picker on the auto-pay philosophy) — **the Stride** (G: 4 cards, double speed 40 steps → 80 advanced), **the Crossing** (U: 5 cards → 3, instant travel to threatened/occupied towns, zero clock cost), **the Balm** (W: 3 cards per life → 2, field healing capped at maximum), **the Quietus** (B: 3/6/10 by tier → 2/4/8, lone regular-tier roamers only; ante-roll loot, no gold, fear-only renown), **the Barrage** (R: 1 card per damage, cap 10 → 15, enemy floors at 1, legal against everything). All rates knobs; the exchange-table rationale recorded in the doc. Surfaces: the Powers rail panel (Stride/Crossing/Balm) and the parley stakes menu (Quietus/Barrage). Powers are knowledge — unlock flags, no inventory.

*Acquisition (the hybrid):* five authored **power-dungeons** in the approach rings at Moxen-class difficulty, each granting its power at the prize room under escrow law; **each stronghold lord's fall upgrades its colour's power automatically** — the seals live from the moment they're won (W/U/B cost reductions; G/R duration/cap raises).

*The great swap (Chris-ruled):* **the five real legends move to the power-dungeons** — Reya/the Balm, Arcanis/the Crossing, Drana/the Quietus, Drakuseth/the Barrage (his trigger *is* the power), Titania/the Stride — their S20-tuned decks and sole-mechanism drops traveling with them; **the Moxen pass to a custom gem-titled court.** Existing saves grandfather (worldgen data; implementer confirms the seam).

*The Mox court is ratified per `docs/mox-court.md`:* **the Pearl Cleric** ({1}{W}{W} 3/3; exile-top costs for lifegain and until-EOT indestructible), **the Sapphire Sage** ({1}{U}{U}{U}{U} 2/2 flash flier; symmetric ETB bounce — the Sage-loop recorded), **the Jet Witch** ({B}{B}{B} 2/2; pay 2 life: draw), **the Ruby Tyrant** ({2}{R}{R}{R} 4/4 flying haste; the recoil gun), **the Emerald Keeper** ({X}{X}{G}{G} 2/2 trample; X counters to each of yours). **The register recorded:** every court card charges its wielder — the lords tax the opponent's verbs; the court taxes its own bearer; the Witch and the Cleric are mirror twins (life for cards; cards for life). Court decklists v1 in the doc; guardian-sim tunes.

*The program's engine bill (five small words, catalogued):* double-X cost support; `{ref: xPaid}` persisting announced X onto the permanent (ref-family member seven); life as an activation cost (the A9/Purge primitive priced into tap-abilities); exile-top-of-library as a parameterized activation cost; keyword-grant-until-EOT **verified-or-built** (word 3's haste grant × the pump-duration machinery — flagged in case they never met). Pins: pin-17's family grows (Witch life floor; Tyrant recoil floor; Cleric library floor) plus the Sage own-side-target and Cleric-responds-to-Wrath watches.

*Pending at S25 kickoff (Chris):* the five power-dungeon names; any rate that reads wrong on the eve.
