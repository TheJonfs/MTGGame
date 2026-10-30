# Handoff — after Session 70 (2026-10-29)

## State of the world
The still-pair High Grounds are in the pool, named, drawn and tuned: **Hearthspire** (RW), **Volmaw** (UB), **Nightbower** (BG), **Ranksmere** (UW), **Burnfallow** (RG) — custom legendary lands, prize-only, restricted in the Open (and so every triad), in the power slot. Beside them, five cards of Chris's: **Thought Replacement** (custom, T2), **Valakut, the Molten Pinnacle** (real, T2 — Burnfallow's payoff), and the restricted cycle's other three colours — **Wheel of Fortune** (LEB, R), **Balance** (LEB, prize-only in the power slot) and **Earthrise** (custom {1}{G}, R). The pilot times a land's ability for the opponent's end step (book 152) and prices the caster's discard pick (book 153). Pool 297. Tests: `pnpm test` (1,172 passed). Ladder PASS after books 152 and 153.

## Done this session
- **Part 5 first — names** (Chris): Hearthspire, Volmaw (Volition Maw), Nightbower, Ranksmere, Burnfallow for the planner's five.
- **Art**: four styles across all five (oil, ink-and-gouache, copperplate, woodblock); Chris chose **the woodblock row** (Hearthspire after four rounds — its second, the most successful tower and the plains-and-mountains motif). Chris's printed faces for all five, read against the defs and installed.
- **Part 1 — the cards and the words**: nominal defs; R-118 the token copy; R-119 a mana-value ceiling that reads X; `otherLand`; restricted in the Open and in the power slot. Fuzz (384 games) then fixtures.
- **The Open stage** (Part 1/4): two runs of paired trials. The first found the pilot spending its turn in its upkeep; Part 2's rule fixed it and the stage was re-run.
- **Part 2 — book 152 `groundtiming`** (Chris's rule: the opponent's end step unless something must die sooner) — ladder PASS.
- **Chris's tuning rulings**: the nominals stand — Hearthspire 2 damage, Nightbower {X}{B}{G}, Volmaw mill six, Ranksmere one copy, **Burnfallow card (b)** ({1}{R}{G}, sacrifice another land: two basics tapped). The triad stage was not run.
- **Post-brief, Chris's cards**: Thought Replacement (the `nonland` discard filter; book 153 — ladder PASS); Valakut (R-120, the intervening if); Balance (R-121, the per-player count) and Wheel of Fortune (no new word; book 154 pins the predictor); Earthrise (the search's `landCard`; studied in Temur at {1}{G} and {2}{G}, calibrated against one Time Walk; Chris's name and art pick).
- Part 3 (Cloudshift and Chris's archetype cards) was replaced by Chris's own cards. The prize flow's build read is below.

## Deviations from the brief
1. **The copy word is R-118, not R-117** — R-117 is the Meathook Massacre's `xPaid × −1` (post-S68).
2. **Names and art were done before the studies** (Chris), and the style ceremony was four styles across the five, not four candidates per card.
3. **The triad stage was not run** (Chris: enough for the main tuning pass). Volmaw, Ranksmere and Burnfallow have no real Open seat (no mill list, no WU dual, the Open's RG lists are dual-land decks) — their triad reads are owed.
4. **Nightbower's nominal is {X}{B}{G}** and **Burnfallow's is card (b)** (Chris), not the brief's {X}{1}{B}{G} and card (a). Card (a) stays a study def (`data/cards-study/burnfallow_ping.json`).
5. **Cloudshift and the brief's archetype slots were not done**; Chris's five cards took the session's second half (Thought Replacement, Valakut, Wheel, Balance, Earthrise).
6. Valakut's fixtures were written before its fuzz (the order reversed; noted).

## Concerns
1. **One restricted copy moves this pilot about a point** (Time Walk +0.6/+0.8 in Temur) — so every restricted card's study reads near the noise at 100–200 games a pairing. The High Grounds' Open numbers (+1 to +10) and Earthrise's (+1.6) should be read against that scale, not against a four-of's.
2. **Hearthspire is the strongest of the five** (+6.1, +2.8, +9.6 in the Open at the nominal; the 3-at-five corner a point stronger) — Chris kept 2 damage.
3. **Burnfallow (b) has had no fair seat yet**: the Open's RG lists are dual-land decks with no basics (the pilot rightly never sacrifices for nothing) or lack red. Its read is a Valakut or landfall list's.
4. **The intervening if is read at trigger placement, not at the event** (R-120's named simplification); Balance's players choose in seat order, not active player first (R-121's).
5. **The predictor prices a land search flat (0.5)** whatever it fetches — Earthrise's two lands and a Wilds' one alike; a ramp list's value of two lands is under-read.
6. **The `--deck-guide` drift** (S69 Concern 3) and the consequence model (ADR-191) are unchanged.

## Registry entries added/changed
- **Rules**: R-118 (copyToken), R-119 (manaValueAtMostX), R-120 (interveningIf), R-121 (overFewest; the edict's `land`); `otherLand` (no number). Discard filter `nonland`; search `landCard`.
- **Pool**: hearthspire, volmaw, nightbower, ranksmere, burnfallow (prize-only, restricted, power slot); thought_replacement (T2); valakut_the_molten_pinnacle (T2, real ZEN #228); wheel_of_fortune (R, LEB #184); balance (prize-only, LEB #3, power slot); earthrise (R); burnfallow_ping (study). The Open's restricted list: + the five grounds, Balance, Wheel, Earthrise. The power slot 14 → 20.

## Test status
**1,172 passed**, 2 skipped. New: `sim/s70-grounds(-fuzz)`, `s70-thought-replacement(-fuzz)`, `s70-valakut(-fuzz)`, `s70-balance-wheel(-fuzz)`, `s70-earthrise`; books 152–154. Re-pinned: pool count, the shop tally, the power slot (20), the Peasant score's unscored list (Thought Replacement, until the next `rating:format --write`). The vitest "onTaskUpdate" errors are pre-existing load errors; `world.test.ts` can time out under the full suite's load and passes alone.

## Suggested next
- **The prize flow** (the brief's last item): the outbox already carries cards, and the power slot is the fence's list — a High Ground (or Balance) as a champion's prize is one row in the prize table and one line in the fence. The design conversation (which Convocation pays which ground) is the planner's.
- **The triad reads owed**: Volmaw in the Undertow and Sultai Mill; Ranksmere in the Aerie and the Roll; Burnfallow (b) and Valakut in a Valakut list — **a Valakut archetype list** is the natural next build (Chris's "future archetype").
- **The Peasant score** for Thought Replacement (`pnpm rating:format --write`).
- The consequence model (ADR-191) remains the next pilot work.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~5 min
python3 scripts/open/trials.py analysis/s70/trials-open-2.txt   # paired game-one trials (tag|list|swap|flags|baseline)
pnpm open:rr --only <list> --swap "<list>:<from>:1:<card>~acost=…~n=…" --extra-cards data/cards-study   # a card's corner in a list
pnpm art:fetch                                       # after adding a real card (oracle text + scan; OVERRIDES pin a printing)
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/<file>.md --no-style   # a card-art candidate
pnpm open:rr --off groundtiming,teamcounters,shrinkplan,payoffcost,sweepwait   # rules off for a paired read
```
