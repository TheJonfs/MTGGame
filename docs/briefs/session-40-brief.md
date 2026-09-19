# Session 40 brief — the flood's twenty-two cards and the rule engine

*Planner → Implementer. 2026-09-19. Follows the running handoff.md (after S39). Rides with `phase-two-legends-working.md` (the content: ten legends, ten golds, five High Grounds, two pool adds, five gates, ten seats, ten lists) — the document is authoritative for texts and lists. This session is the cards and the rules; the seats, entrances, lists and map sites are S41. Process rules unchanged: appends to `docs/decision-updates/s40.md`; re-verify every ⚠ real card by curl and encode Oracle verbatim from the printing named; customs encoded from the document's text exactly; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — ADR appends
- **ADR-128 — The flood's content is ratified as `phase-two-legends-working.md`** (Chris, 2026-09-19): five lord/court pairs under the five laws; the High Grounds as the courts' prizes; the courts fight on their own ground; the five gates; the ten seats; the ten lists. §7–§8 are Chris-final after his pass; §9's two adds included.
- **Placements**: none of the new cards enter any phase-one list. All twenty-two are shop/prize stock per the document's tiers; the ten legends and the five grounds prizeOnly.

## Part 1 — The words (R-097)
| word | for | shape |
|---|---|---|
| every-upkeep trigger (both players' upkeeps) | Static Sphere, the Reaper | the Season's upkeep collector with `who: any` |
| "mana spent to cast" as an amount | Sacred Helix | a spell-cost total on the stack item (X included), read by an effect amount; reused later |
| leaves-the-battlefield collector with LKI power | Zinnia | the wider zone-change event beside DIES; the Altar's LKI |
| class-grant on lands | the Fordkeeper | Frondland Felidar's grant with a land filter |
| any-graveyard reanimation | the Reeve | the Zombify target scoped to either graveyard |
| negative pump | Isaura | Giant Growth's word with a negative value (may already hold) |
| a stat predicate on the deck | the Wrackroot gate | `minCreaturePower: 2` — every creature card's power ≥ N |
| a fraction on the deck | the Observatory gate | `minLandFraction: 0.5` — lands ÷ cards ≥ N |
| a type ban on the deck | the Shevelport gate | `bannedTypes: ["Instant"]` |
Also: three token defs (1/1 green Snake; 1/1 white Spirit, flying; the static counter kind on Static Sphere via Clio's word). Menace exists (Boggart Brute); the DRAW collector exists (the Bloom Gauntlet); flash, lifelink, haste, deathtouch, reach, first strike exist.

## Part 2 — The cards
Encode all twenty-two from the document: the ten legends (§1–§5 texts, types, P/T; prizeOnly; the lords at the stronghold price convention, the ministers at the court's), the ten golds (§1–§5; the eight real ones ⚠ by curl — Glimpse the Unthinkable, Putrefy, Powerstone Minefield, Savage Twister, Undermine, Absorb, Poison-Tip Archer, Voracious Cobra; R-tier), the five High Grounds (§6; prizeOnly; Legendary Land with the two mana abilities and the third ability as written; Shevelport with "artifact, enchantment, or land card"), Char and Shadow Summoning (§9, both real, ⚠ by curl; tier 2). Rulings to encode: the Reeve's reanimation from *a* graveyard; the Reaper's grant is team-wide until end of turn with no trample; Cairnbrand returns from *your* graveyard; Odile's damage is hers (LKI power on the leaving creature is Zinnia's and Meliyan's — the document says whose damage each is).

**Art**: the ten legends and the five grounds through the image skill's card-art pipeline (subject files from the document's flavour lines; the ink-and-wash house style; candidates to Chris). **Meliyan's art is already delivered** — Chris dropped a piece in `assets/generated/card-art`; use it, no candidates for her. The real cards through `art:fetch` from the printings named (the document's ⚠ lines carry the sets).

## Part 3 — AI (each pinned; the ladder gates)
- The Bailiff: attack when a tapped creature is worth bouncing or the way is clear; bounce the highest-value tapped opposing creature; self-bounce only an ETB creature of ours when its re-entry is worth more than its attack (or never, if the evaluator can't price it — say which).
- Odile: the draw-step damage is automatic; instant-speed draws (Brainstorm, Thought Scour) at the opponent's end step when their attackers are tapped; hold them on our own turn after we've tapped.
- Static Sphere: mark their best creature; the AI never marks its own.
- Sacred Helix: X for lethal or for a kill; face when the gain matters.
- The Reeve: mill our own library when a reanimation target is likely and a reanimator is up; mill theirs when their library is short (the S29 mill curve); reanimate the best creature in either graveyard.
- Zinnia: prefer bounce and fights on their biggest creature (the mill is priced by power).
- The Fordkeeper: pings from spare lands at their end step (face when nothing dies); burn priced with the gain.
- Ovna: cast enchantments before creatures when she's on the table; auras on hexproof hosts first (S30's rule).
- The Dredger: sacrifice a spare land (lands in play > the hand's top mana value + 1) to rebuy the best spell in the yard; Undermine/Absorb over Counterspell when both are up.
- Isaura: −1/−1 on X/1s at their end step; the team counters on our own turn with three or more creatures.
- The Reaper: sacrifice the oldest snake for a lethal or near-lethal alpha, the freshest for haste when a fresh token would otherwise sit; never his last blocker while behind.
- Meliyan: the trigger's target is the opponent (forced); the AI blocks with counters-bearing creatures more freely under her.
- The grounds: Tallyflame at their end step with mana spare; Wrackroot on their best attacker; Shevelport when a returnable card is in the yard; the Observatory for an alpha with three or more creatures; Cairnbrand as Zombify with the cheapest body as the cost.

## Part 4 — The rule engine
`checkDeck` gains the three fields (Part 1) with sentences for each ("6 creatures have power less than 2: …", "lands are 12 of 30; the gate asks half", "3 instants: …"); `validateDeckRule` and `describeDeckRule` extended; the refusal pack's `door.byRule` map with the planner's five lines:
- minCreatures (Odile): *"Bring bodies to the fire. Twelve, at the least."*
- minCreaturePower (Zinnia): *"Nothing small. The water takes the small things first."*
- bannedTypes Instant (Ovna): *"No sudden things. The Green does not answer in the moment."*
- minLandFraction (Isaura): *"Half of what you bring must be ground. The rest can be yours."*
- maxManaValue (Meliyan): *"Nothing dear. What you bring here, you will lose."*
(The colour gate's line stays the S37 one.) No shipped site carries a rule yet — S41 attaches them.

## Part 5 — Measure
Fuzz every new card in a mixed pool (the S36 pattern, 840 games, replays byte-exact) before fixtures. Fixtures per word (Part 1) and per legend's ruling (Part 2). Then the Lab: the five stronghold lists and the five court lists from the document as custom decks (the grounds as a side entrance), each against `salvage-WR`, `salvage-UB` and `chris-road-B`, 100 games both seats, at the phase-two mage T3 row for the lords and the court row (⚠ unauthored — use 30 life, the phase-one court's) for the ministers. Report win rates, turns, and per-legend cast/activation counts; no changes — the lists are Chris's, the planner amends.

## Handoff
The registry section (198 → 220), R-097, the art candidates (fourteen) and Meliyan's installed piece, the Lab tables, deviations, concerns, and the implementer's estimate for S41 (the seats as `StrongholdContentDef`/`CorollaPetalDef` entries with `deckRule`s and entrances, the phase-two map's sites, the lists as catalog decks, the lords' and courts' life rows).
