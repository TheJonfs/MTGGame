# The Five Powers — design (Chris + planner; the world-magic ceiling item arrives)

*The fuel model, forms, and tuning for the five colored world powers. Ratified in shape across the design rounds (ADR-084's deferral now spent); rates are knob-forward arguing baselines pending play. The guardian slate (§6) awaits Chris's five legends. Implementation session TBD after the slate lands.*

## 1. The fuel model (ratified)

Powers burn **cards from the collection's spares** — colour-matched, count-denominated (no symbol accounting), the active deck never fuel. Gold cards fuel either of their colours (the shop-stocking rule reapplied). `prizeOnly` cards are burnable — torching a dual for a desperate Crossing is a story — but **sole-mechanism cards (guardian/lord cards) double-confirm with the permanent-loss warning**: her dungeon is cleared ground; there is exactly one, and it was yours. **The picker rides the auto-pay philosophy**: cheapest spares auto-suggested (shopTier ascending, then price), deliberate override always available. The arbitrage floor (~10g per tier-1 card at shops) is embraced, not fought: every cost below has a gold shadow, and that shadow is a deliberate gold sink.

## 2. The five (initial → advanced forms; all rates are knobs)

| Power | Colour | Effect | Initial cost | Advanced (on its lord's fall) |
|---|---|---|---|---|
| **The Stride** | G | Double movement (2 cells/step) for a duration | 4 green cards → **40 steps** | duration **80 steps** |
| **The Crossing** | U | Instant travel to any town under siege warning or occupation — **zero clock cost**; arrive at the gate | **5 blue cards** | **3 blue cards** |
| **The Balm** | W | Restore world life in the field, capped at maximum | **3 white cards per life** | **2 per life** |
| **The Quietus** | B | In the parley menu: destroy a lone roamer of the three regular tiers outright | **3 / 6 / 10** black cards by tier | **2 / 4 / 8** |
| **The Barrage** | R | In the parley menu: the coming duel opens with damage already dealt | **1 red card per damage, cap 10**; enemy life floors at 1 | cap **15** |

Sanity frame (the exchange table: inn = 8 steps/life normal; shops ≈ 10g/T1 card): the Stride buys clock-steps at ~1g each; the Balm's field heal runs ~4× the inn's rate (anywhere-instantly priced as premium); the Quietus at tier 3 ≈ 100g to skip a signature fight whose prize roll justifies it; the Barrage's full cap ≈ 100g to carve a quarter from a lord.

**Boundaries:** the Quietus never touches lairs' residents, guardians, lords, or siege parties (named beings don't die to a gesture; armies aren't lone). The Barrage is legal against *everything* — softening a 45-life Stoker is its endgame identity; the floor-at-1 means red always leaves a fight standing. Quietus loot: **the ante roll the fight would have paid — no gold, and renown lands as fear only** (killing without battle breeds whispers, not respect).

## 3. Surfaces

The Stride, Crossing, and Balm live on a **Powers rail panel** (world-side transactions); the Quietus and Barrage join the **parley stakes menu** beside fight/flee/payoff (the menu the Dueltune already announces — its option set grows by up to two, each showing its card cost live, greyed with reason when illegal). Powers are knowledge, not items — unlock flags in the save, no inventory. Costs always visible; the panel shows each power's form (initial/advanced) and its lord's seal state.

## 4. Acquisition (the hybrid, ratified)

**Five authored power-dungeons** at Moxen-class difficulty, **placed in the approach rings** (one per colour's middle region) — mid-game arrival is the design's origin: run-saving powers must exist when runs need saving. Each ends in a fresh-legend guardian and grants its colour's power at the prize room (escrow law applies; the power pays out with the treasure). **Each stronghold's fall upgrades its colour's power automatically** — the seals do something at last, alive from the moment they're won: W/U/B upgrade as cost reductions, G/R as duration/cap raises, per the table.

## 5. Instruments & knobs

Knobs: every rate above (`stride{Cells,Duration,Cost}`, `crossingCost{,Advanced}`, `balmCostPerLife{,Advanced}`, `quietusCosts[3]{,Advanced}`, `barrage{CostPerDamage,Cap,CapAdvanced}`), plus placement counts. world-sim gains power-usage columns when implemented (activations per tour, fuel burned by colour, Quietus tier mix, Barrage sizes) — the tuning tables. The spare-card economy now has three competing demands (card-courier contracts, shop liquidity, power fuel); the sim should report spare-pool depth by colour so scarcity is measured, not guessed.

## 6. The guardians (Chris-ruled: the great swap)

**The five existing real legends move from the Moxen to the power-dungeons** — the powers taught at sites their guardians embody: **Reya guards the Balm** (she who mends the dead each upkeep), **Arcanis the Crossing** (the legend whose own ability removes him from danger), **Drana the Quietus** (the drain that ends), **Drakuseth the Barrage** (his attack trigger *is* the power), **Titania the Stride** (the Protector of Argoth presiding over the art of crossing the land she keeps — the loose fit of the five, accepted: guardians guard the teaching; embodiment is a bonus). **Their S20-tuned decks travel with them** — the power-dungeons open with battle-tested, kill-tabled fights; sole-mechanism card drops travel too.

**Five new custom legends guard the Moxen** — a matched gem-titled court for the matched cycle (working pattern: the Pearl Cleric, the Sapphire Sage, the Jet Witch, the Ruby Tyrant, the Emerald Keeper — Chris coins final names/vocations). Mechanically **lighter than the lords**: guardian-class, mono-colour, one or two lines in the Rorix-to-Titania complexity band, minimal lifts per the fun-batch discipline; ADR-052/053 ceremony + printed JPGs per the pipeline; planner audits each design and drafts the five decks (tuned via the existing guardian-sim instrument). Existing saves grandfather (worldgen data; fresh worlds get the new court — implementer confirms the seam).

*Open: the five Mox-court designs (Chris authoring, planner auditing); dungeon names for the power sites; the rumor pointer lines ("something is taught here") in the next text pack.*
