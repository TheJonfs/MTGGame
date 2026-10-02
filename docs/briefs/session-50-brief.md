# Session 50 brief — red for Limited

*Planner → Implementer. 2026-10-03. Follows the running handoff.md (after S49). A pool round with the Convocation's sims as its check; the drafter's screen is S51. Process rules unchanged: appends to `docs/decision-updates/s50.md`; re-verify every ⚠ real card by curl; the custom from its text; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S49 Deviations 1–8 ratified**: v2 as a candidate (v1 stands); a drawn bracket series to the higher seed; the AI sideboards on the registered list (open lists are the tournament's norm for the AI — a human's list is not shown to the player); "auras seen" as noncreature artifacts and enchantments; the two events and the difficulty select; Hard's and Easy's bracket rows; the forced-pair field; the bracket's one screen.
- **ADR-149 — Red's Limited pool (ADR-140's lesson).** Red's tiers 1–2 were built as Constructed packages (the Goblin tribe, the spell payoffs) and its plain bodies were the pool's weakest; no mono-red card had a positive lift in Sealed. Six cards that are good alone — bodies with evasion or an effect that is removal, a two-drop that is two bodies, an engine that draws and makes bodies, an anti-lifegain threat — enter the pool (233 → 239, with S46's five: 238 → 244). The rating is not the cause (S49's forced pairs); the pool is half of it and the pilot's burn the other half (the implementer's open investigation).
- **The entrance table grows to five rows** (S49 Concern 7): Standard +0 / +2 / +4 / +4 / +6 for the Swiss, the bracket as ADR-148 — ⚠ provisional with the rest.
- **The prize screen's record columns** label themselves "Swiss record" (Concern 8).

## Part 1 — The cards
| card | printing ⚠ | text as the planner has it ⚠ | tier | words |
|---|---|---|---|---|
| Flametongue Kavu | Invasion | {3}{R} 4/2 Kavu. When it enters, it deals 4 damage to target creature. | 2 | zero (ETB damage) |
| Furnace Whelp | Fifth Dawn | {2}{R}{R} 2/2 Dragon. Flying. {R}: +1/+0 until end of turn. | 2 | a pump as an activated ability (half if not already a form) |
| Shocking Sharpshooter | Bloomburrow | {1}{R} 2/2 Lizard Archer. Reach. Whenever another creature you control enters, it deals 1 damage to each opponent. ⚠ (text to the curl) | 1 | zero (the Sharpshooter's own-side ETB watcher; damage to each opponent exists) |
| Dragon Fodder | Shards of Alara | {1}{R} Sorcery. Create two 1/1 red Goblin creature tokens. | 1 | zero (the Goblin token) |
| Seasoned Pyromancer | Modern Horizons | {1}{R}{R} 2/2 Human Shaman. When it enters, discard two cards, then draw two cards. For each nonland card discarded this way, create a 1/1 red Elemental creature token. {3}{R}{R}, Exile it from your graveyard: Create two 1/1 red Elemental creature tokens. | 3 | a counted conditional on the discarded cards (half); the graveyard-exile activation is Mother Bear's word; the Elemental token exists |
| **Rage Cobra** (custom) | — | {2}{R} Creature — Snake, 1/1. Whenever an opponent gains life, put that many +1/+1 counters on target creature. | 2 | zero (Vitalist's LIFE_GAINED collector at `who: opponent`) |

Art: the five real cards through `art:fetch`; Rage Cobra through the image skill (a snake that swells on another's relief), four candidates to Chris.

## Part 2 — AI (pinned; ladder gates)
- Flametongue Kavu: the ETB at their best creature the 4 kills; with none, at the biggest (the Kavu is cast regardless — its body is the point).
- Furnace Whelp: the pump priced as combat damage (attack unblocked, or to win a block) with idle red mana; never into a block that kills it anyway.
- Shocking Sharpshooter: the ping is automatic; the AI casts it before other creatures when both are in hand (the watcher-first rule, book 87).
- Seasoned Pyromancer: discard the two lowest-valued cards (lands when the board has enough — the Elementals reward nonlands, so a land is "free"); the graveyard activation with idle mana.
- Rage Cobra: the counters on our best evasive creature, else itself (Vitalist's rule mirrored).
- **The burn investigation** (S49, open): report what the heuristic does with Bolt at −3.7 lift — whether it holds burn, aims it at the wrong creature, or spends it at the face when a creature was the play — and fix what is a rule, not a card. The Limited term the ledger wants: racing with a low-toughness board (small attackers spent, not used, when their blockers outclass ours).

## Part 3 — The pick rule's two smalls (before the human drafts)
- **Lands' draft value**: a flat low value before a seat's colours settle (picks 1–8), then the rating within the seat's colours; a dual never a first pick over a playable.
- **A slower commitment**: the colour bonus starts at pick 4 at half its slope and reaches full at the cut (pick 8); a third colour's bonus dies at the cut. Report the share of seats whose colours change after pick 8 (was 12%; wanted: 20–30%) and the pod's spread (was 53 points).

## Part 4 — Measure
- **Fuzz** the six in a mixed pool before fixtures; then fixtures per word (the Kavu with no legal target; the Whelp's pump; the Sharpshooter on a token entering; the Pyromancer's count; the Cobra on the opponent's Soul Warden trigger).
- **`pnpm sealed-sim`** at v1 with the six in the Plane: red's share of decks, red pairs' win rates, the twenty movers (the six should move up from their priors or not — say which).
- **`pnpm sealed-sim --forced`** for the four red pairs only: forced − chosen before/after (S49: UR −8.2, WR −7.7, BR −7.9, RG −7.6).
- **`pnpm draft-sim --pods 50`** with the two pick-rule changes: seats per colour, red's seats' win rate (was 38%), the pod's spread, the commitment shares.
- The Open's round-robin for the two red lists only (`--only tally,warband`) — the Kavu and the Whelp may want a slot there; report, don't amend.

## Handoff
The six cards; the burn investigation's finding and fix; the pick rule's two changes and their numbers; the three sims' tables; deviations, concerns; the estimate for S51 (the drafter as a screen: pick-and-pass against the pod on the pick rule, the human's picks into the pool, then the existing flow).
