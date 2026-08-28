# The Fun Batch — three customs for S23 (Chris-designed; planner-audited)

*Pure fun-first additions per Chris's direction — no boss synergy mandate, no gauntlet role; composable from paid-for machinery. Total novel bill across all three: two tiny pieces. All three take the ADR-052/053 ceremony (text field, four art candidates, Chris picks). Pool 171 → 174.*

## Thundersnake — {R}{R} Creature — Elemental Snake, 4/1
- Trample, haste
- At the beginning of the end step, sacrifice Thundersnake.

*The Ball Lightning family rescaled to a 10-life world (the design conversation is recorded: 4 into 10 ≈ the original's 6 into 20; the drafted 8/1 was a 16/1 in swing terms and was rightly cut down). Family templating exact — "the end step" is every end step, correctly killing an off-turn reanimated copy same-turn. Joins the pool's accidental serpent gallery.*
- **Bill:** `sacrifice` (self) surfaced as an effect word — A10 word 3's internal delayed-sac machinery exposed; near-zero.
- **AI:** waste-gate sibling — never cast in main 2 or without an attack live (the r3 all-EOT-buff gate's shape).
- **Tier 2, 12g** (the burn arc's shelf, beside Bolt and Grenade).
- *Future breadcrumb (Chris):* **Unearth** as a later real add — its bill is returnFromGraveyard + an mv-at-most predicate (powerAtMost's sibling) + cycling: essentially paid for. The snake designs its own second act.

## [Gallows Djinn / Debtor's Djinn / Chris's name] — {2}{B}{B} Creature — Djinn, 5/5
- Whenever this creature attacks or blocks, it deals 1 damage to you.

*The Juzam homage, redesigned for the world's scale — and the redesign is the point: the upkeep metronome becomes an aggression tax, so each combat costs 10% of a life total and the drawback finally scales with use. Above pool curve (5/5 beside Hill Giant's 3/3) and honestly paid at this life total; lifegain matchups punish it doubly.*
- **Naming flag (Chris rules):** "Juzam" is the real card's proper name (against our original-names pattern, and colliding if Juzam Djinn ever enters the pool from the classical shelf) and **Efreet is the Stoker's type** — the world's efreet is the Furnace Gate's lord. Proposed: **Djinn** typing (the truer homage lineage) + an original name — Gallows Djinn (the Gallows Fen's own), Debtor's Djinn, Famished Djinn, or Chris's coinage.
- **Bill: zero** — ATTACKS + BLOCKS triggers and self-damage compose today (two triggered abilities).
- **AI:** shame pin (pin 17's sibling) — never attack or block at life 1; attack-pricing includes the 1 self-damage (prediction machinery; watch, likely free).
- **Tier 2, 30g.**

## Traumatizer — {2}{U}{U} Creature — Nightmare, 2/4
- Flying
- Whenever Traumatizer deals combat damage to a player, that player mills twice that many cards.

*Mill's first real player identity (the Adept has carried the mechanic alone since A3). The math against the world: enemy decks run 30–40 cards, so ~4 per connection makes DECKED a genuine build-around at roughly six hits — real with support (Adept, bounce walls, pumps scale it), slow enough that the 10-life race stays the default.*
- **Bill:** value-ref family member six — `{ref: eventDamage, times: N}`: the trigger event's damage payload with a **bounded literal multiplier**. ADR-028's no-arithmetic doctrine is reaffirmed around it: a fixed `times` param is not a calculator, and general arithmetic remains excluded.
- **AI:** none needed — no enemy deck carries it; mill-progress valuation stays a someday-workstream note.
- **Tier 2, 30g.**

## Batch logistics
Rides S23 alongside wilds polish and audio scaffolding: three defs + Scryfall-free (all custom), art ceremony ×3, fixtures per card (the Thundersnake off-turn case; the Djinn at life 1; the Traumatizer's mill-on-trample-partial — trample assigns 1 to the player, mills 2), the two tiny words, ladder-gated pins. Chris's printed-JPG pipeline (ADR-082) applies — three more printed faces whenever he makes them.
