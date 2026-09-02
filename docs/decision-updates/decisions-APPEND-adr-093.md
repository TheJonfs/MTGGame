# decisions.md — APPEND (ADR-093)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-092.*

---

**ADR-093 — The Manafleur; the chronicle's first phase; three S26 rulings.**

*S26 rulings (Chris):* **prizeOnly cards are never stakes for either side** (the engine's `setAside` skips them — the crown jewels are neither kindling nor stakes; closes the lords' and the court's ante exposure and protects the player's trophies symmetrically); **the petals wear the logo's own five hues**, brighter than the wilds; **`corollaGridSize` 33**.

*The Heart's card (closed; `the-bloom-gauntlet-v1.md` v1.3–1.4 is the record):* **The Manafleur** — {W}{U}{B}{R}{G} Legendary Creature — Avatar, 7/7: "At the beginning of your end step, exile all laws, then create a copy of the next law." Chris's wording over the planner's strawman for reasons recorded (end-step: blooms the turn it's cast, each petal one full round; exile-all: the Control Magic and reanimation corners handled, recursion closed; "the next law" as a game-level sequence pointer, so copies and thefts continue the sequence). The cost is the grammar's terminus — one of each, nothing generic. One ability by discipline; the fight's difficulty lives in the petals. Bill ~1.5 riders (manifest-from-def; the sequence pointer; exile-by-predicate). Ascension hooks by data (`lawSequence`; `random`; `accumulate` — the reserved all-five climax); the Root (from-turn-one persistence) resolves as an ascension mechanic. **Zero ante; regroup and retry; the entrance rule; `heartLife` 30/35/40 by difficulty, flat.** The name broke the namelessness once, at its face, as ruled.

*The Manafleur's deck (v2):* sixty — the ten ABU duals, the ten shocks, one of each basic; the Manafleur ×3, the five ministers, the five court, the five mono customs, the five Moxen, the ten flowing-pair golds, two flex. Every authored card in the game in one pile — the design document as a decklist. heart-sim tunes.

*The chronicle's first phase (Chris-designed; framing installable ahead of content):* a Manafleur victory grants a **permanent, per-starting-colour carryover** — the colour's power pre-unlocked, its teaching guardian's card (site pre-cleared), its lord's complement minister — persisting across all runs; five colours' victories stack to five powers and ten legends. Planner rules: **carried cards never duplicate** (petal drops withheld when held; gold in lieu); **speed-up extras modest and knob-forward** (starting gold +50 per victory proposed; nothing else pre-granted). Implementation world-side only: a versioned **profile store outside the world save**, carryover as collection injection + flags + pre-clearing, the per-run chronicle copied into the profile's at victory, the new-game screen showing what's carried, a dev toggle. **Phase two banked**: after five victories the plane inverts — lords to the five non-Cinquefoil triples (WUB, WUR, WRG, UBG, BRG), petals to the flowing pairs, the Manafleur strengthened.

*Standing:* the S27 brief (the Heart's fight; heart-sim; the victory ceremony and the chronicle's first lines — planner text, written to survive any disposition; the profile framing) on Chris's word.
