# Session 36 brief — four cards for the blue road

*Planner → Implementer. 2026-09-09. Follows the running handoff.md (after S35). Small session: four cards, three small words, four placements, a roster re-read of the five decks touched. Process rules unchanged: appends to `docs/decision-updates/s36.md`; re-verify every ⚠ text by curl; every AI change carries a ladder delta or reverts.*

## Part 0 — ADR appends
- **ADR-121 — Four cards (pool 194 → 198).** Thawing Glaciers, Library of Alexandria, Arcane Collector (custom), Angel of the Ruins. Chris's picks ahead of the blue-road run; all shop finds, none in a starter. Library is R beside the Tutor, not prizeOnly: its power scales with game length and hand size, and a 10-life world with 30-card starters keeps both short — it matters most at the Heart, which is the right shape for an R find. The Collector's ceiling (at one card in hand it is "{1}{U}, T: draw two" every turn) is accepted as the reward for hand management that runs against a control deck's other instincts (Chris).
- **Phase-two note, parked**: two runs, two roads, one final deck — the Mardu ministers pull because they're the strongest late unlocks. A Lab question (chris-road-B against a Simic/Sultai road deck) once the blue run says whether the pull is the cards or the road.

## Part 1 — The cards

| Card | Text (verified) | Tier / price | Words |
|---|---|---|---|
| **Thawing Glaciers** (Alliances) | Land. This land enters tapped. {1}, {T}: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle. Return this land to its owner's hand at the beginning of the next cleanup step. | 2 / 20 | enters-tapped exists; the fetch is Wood Elves' with `tapped` and a basic predicate; **the return is the Usher's delayed trigger at the cleanup step** — one small word if cleanup isn't a trigger point yet (CR 514.1a). The replay is a land drop; both the Glaciers and the fetched basic are landfall. |
| **Library of Alexandria** (Arabian Nights) | Land. {T}: Add {C}. {T}: Draw a card. Activate only if you have exactly seven cards in hand. | R / by the R formula | **an activation condition on hand size** — one small word (`activateOnlyIf: handSize === 7`). Not in the Manafleur's sixty (its lands are its roots). |
| **Arcane Collector** (custom) | {U} Creature — Human Wizard, 1/1. {1}{U}, {T}: Name a card. Then reveal a card at random from your hand. If it's the named card, draw two cards. | 2 / 16 | **name-a-card** (the UI offers the hand's distinct names — naming a card not in hand is never right; the AI names the most-duplicated card in hand) and **reveal at random from hand** (Hymn's random pick with a REVEAL log event, the card stays in hand). Custom: no proper nouns; mono-U, so the sixty carries it by the conceit. Art: the ink-and-wash pipeline, subject file to Chris. |
| **Angel of the Ruins** (earliest printing Scryfall carries — ⚠ Commander 2021 / Strixhaven Commander) | {5}{W}{W} Artifact Creature — Angel, 5/7. Flying. When this creature enters, exile up to two target artifacts and/or enchantments. Plainscycling {2}. | 3 / 50 | plainscycling = Barren Moor's cycling with a typed search-to-hand (the Tutor's word + a Plains predicate — Scrubland and Godless Shrine are Plains cards); the ETB is Arc Mage's up-to-two targeting on an exile. **Design note:** it's an artifact creature whose ETB exiles artifacts and enchantments — the laws are artifact-enchantment tokens, so a player who Zombifies it at the Corolla exiles two laws; and Disenchant answers it. Both intended. |

## Part 2 — AI

- **Glaciers (three rules, no theory):** *play it* as the land drop when it is the only land in hand, or a landfall permanent is on our board, or lands in play already meet the hand's top mana value (the drop is spare); *activate* at the opponent's end step whenever it's untapped with a mana spare, or on our turn when the hand needs a colour we lack; *fetch* the colour most short, ties to the primary. Pin: with another land in hand and none of the three reasons, the real land is played. Book 52.
- **Library:** tap for {C} by default; draw only at the opponent's end step with exactly seven in hand. (It will be rare; that's fine.)
- **Collector:** activate at the opponent's end step with the mana spare; name the most-duplicated card in hand; at one card in hand, every turn. Pin: a hand of four Crabs and a land names the Crab.
- **Angel:** plainscycle when the hand holds a reanimator (Zombify) or lands in play + hand < 5 by turn three; hard-cast at seven. ETB targets: the opponent's auras on our creatures first (Control Magic, Pacifism), then their artifacts/enchantments by value; never our own; "up to" means zero is allowed. Book 53.

## Part 3 — Placements (final)
- **Pell of the Shallows**: −1 Island → +1 Thawing Glaciers (lands stay 17; landfall).
- **Magister Quill**: −1 Forest → +1 Thawing Glaciers.
- **Tessaly Reed**: −1 Cathartic Adept → +1 Arcane Collector (four Crabs to name).
- **Kessa Emberhand**: −1 Shock → +1 Arcane Collector.
- **Lord Corvane**: −1 Serra Angel → +1 Angel of the Ruins (Buried Alive finds Artisan + Angel + Serra; plainscycling on turn two, Zombify on three behind a Ritual).
- Library of Alexandria: shop-only (R table).

## Part 4 — Fixtures
Glaciers: enters tapped; the fetch is tapped and triggers a Crab (twice, with the Glaciers' own entry); returns to hand at cleanup, replayable next turn as the land drop; activating twice in a turn is impossible (tapped). Library: no draw at six or eight; draw at seven; the colourless tap. Collector: the name from the hand's names; the random reveal is logged and the card stays; a miss draws nothing; one card in hand hits every time. Angel: plainscycling fetches a Godless Shrine; the ETB exiles a law token and an opposing Control Magic; zero targets chosen resolves; Disenchant destroys it.

## Part 5 — Measure
The five touched mages against the stock starters at Standard (`--mode standard --part 2/5`, 100 games both seats) with the S35 baseline; the deltas are the read. Fuzz the five before fixtures; replays byte-exact; ladder gates for the four policies.

## Handoff
Registry section (194 → 198; R-096 for the words), the five deltas, deviations, concerns. The Collector's art subject file for Chris's verdict.
