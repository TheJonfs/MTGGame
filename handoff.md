# Handoff — after Session 36 (2026-09-09)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 36 — **four cards for the blue road** — is done: Thawing Glaciers, Library of Alexandria, Arcane Collector (custom) and Angel of the Ruins (ADR-121; pool 194 → 198), the brief's "three small words" as six vocabulary entries (R-096: the cleanup return, an activation condition on hand size, name-a-card + reveal-at-random, typed cycling, the artifact-or-enchantment predicate, exile's fan-out — none a carve-out), the five placements exactly as given, four AI policies (books 52–53 + the Collector's name and the Library's window) with both ladder gates green, ten fixtures after an 840-game fuzz, Part 5's deltas against the S35 baseline, and **the Collector's four art candidates for Chris's verdict** (the as-printed render follows once picked). Pool 198 (211 defs with tokens and test cards); `docs/reference/` regenerated.

## Done this session

- **Part 0**: `docs/decision-updates/s36.md` — ADR-121 and the parked phase-two note, filing notes. All three real cards re-verified by curl (Glaciers ALL 1996; Library ARN 1993; the Angel C21 2021 — the earliest printing Scryfall carries, as the brief flagged).
- **Part 1 — the words (R-096)**: (1) `returnSelfAtCleanup` — a due list on the state (`cleanupReturns`, the temporary guest's shape), consumed at the top of `cleanup()` before the hand-size discard; created during a cleanup → the next turn's; the view exposes `pendingCleanupReturns` (public). (2) `activateOnlyIf: { handSize: N }` — an enumeration rule (the Library's draw is simply not offered outside a seven-card hand). (3) `revealRandomIfNamed { onHit }` — a `chooseName` request over the hand's distinct names (`nameCard` actions; forced and unlogged when one), a random hand card by the game RNG (purpose `reveal`), a `REVEALED` event (the name and the card are public; the card stays in hand), `onHit` resolved through a fresh effect context. (4) `cyclingSearch` beside `cycling` — plainscycling compiles to a search-to-hand (revealed). (5) `artifactOrEnchantment`. (6) `exile.targetSpec` fans out over a range spec. The harness gained a `nameCard` verb.
- **Part 1 — the cards**: the four defs (the Library at the R formula, no override; the others at the brief's prices).
- **Part 2 — AI**: book 52 (the Glaciers: the drop only as the only land, with a landfall permanent out, or when the lands already meet the hand's curve — otherwise the real land; the fetch at their end step or for a colour we lack); the Library's draw at their end step only; the Collector at their end step, every turn at one card, naming the most-duplicated card (four Crabs and a land names the Crab — pinned); book 53 (the Angel: plainscycle with a reanimator in hand or short on lands by turn three, hold at seven lands; the ETB takes their aura on OUR creature first — Control Magic before their Anthem — never our own; zero allowed). View-sim prices the reveal as the best name's share of the hand times the draw's worth. The FUZZ_FULL ladder gate held and the vs-random ladder PASSES.
- **Part 3**: Pell −1 Island +1 Glaciers; Quill −1 Forest +1 Glaciers; Tessaly −1 Adept +1 Collector; Kessa −1 Shock +1 Collector (her pip order tied 13/13 — `primaryColors` "UR" now, the colours' order); Corvane −1 Serra +1 Angel of the Ruins.
- **Part 4 — fixtures** (after `s36-fuzz.test.ts`, 840 games at the full tier, replays byte-exact): the Glaciers' fetch enters tapped and the Crab mills three; no second fetch; home at cleanup; the drop again next turn, entering tapped so no fetch that turn. The Library: nothing at six or eight, the draw at seven (eight after). The Collector: the name among the hand's names, the reveal logged, the card stays, a miss draws nothing; one card in hand hits every time, unlogged. The Angel: plainscycling fetches a Godless Shrine (revealed); the ETB exiles a law token and an opposing Control Magic (our Serra comes home); zero targets resolves; Disenchant destroys it.
- **Part 5**: the five touched mages against the stock starters at Standard (`--mode standard --part 2/5`, 100 games both seats, the S35 baseline). Below.
- **The Collector's art**: `docs/prompts/card-art.md` entry (the wager and the collection; no proper nouns) and four subject files (`card-arcane-collector-1..4`: classical oil, ink-and-gouache action, watercolor storybook, chiaroscuro portrait), rendered `--no-style` 1:1; thumbnails sent to Chris.

## Deploy playtest r8 (Chris, 2026-09-14): the Crab trigger "aimed at the opponent" milled the player

**The finding.** The engine mills exactly the chosen player and the board's plates map seats correctly; the fault was the shared action label: `actionLabel` named player targets with "you" hardcoded to seat 0, so from **seat 1** (on the draw in the dev setup; a coin flip) every dialog option, the "Staged: Trigger targets → …" confirmation and the play-by-play line said "Opponent" for the player and "You" for the opponent. Pick what reads as the opponent and you mill yourself. (In the world the human is always seat 0, so the campaign never showed it; the dev `/play` setup and its coin flip did.) **The fix**: the human's seat is threaded through `actionLabel` at every dialog, staging and log call site (the replay viewer keeps its player-0-as-You convention). Tests: `labels.test.ts` (player targets named relative to the seat); a controller regression in `match-controller.test.ts` — from EITHER seat, a Crab's trigger targeted by clicking the opponent's plate mills the opponent's library by three, never ours, and the staged and logged labels read "→ Opponent". UI suite 43 passed; typecheck clean.

## Deviations from the brief

1. **Six words, not three.** The brief named the cleanup return and the activation condition and called the rest existing; encoding found the Collector needs an action (`nameCard`) and an event (`REVEALED`), plainscycling needs the search form of cycling, and the Angel's "artifacts and/or enchantments" needs one predicate for a range spec plus exile's fan-out. All six are general (R-096), no carve-outs.
2. **The Glaciers' first fetch is the turn AFTER it lands** (it enters tapped) — the fixture models that; the brief's "activating twice in a turn is impossible (tapped)" holds on both turns for different reasons.
3. **The Library's R price is the formula's** (no override, like the Artisan).

## Concerns

1. **Part 5 — the five touched mages vs the stock starters at Standard (the MAGE's win %, Δ vs S35):**

| mage | white | blue | black | red | green | read |
|---|---|---|---|---|---|---|
| Tessaly (T1, +Collector) | 19 (+3) | 57 (−2) | 37 (+2) | 34 (+3) | 26 (+5) | the Collector cast 0.33/game; +2 on average — noise-sized, the right sign |
| Kessa (T2, +Collector) | 63 (+7) | 76 (−3) | 63 (+8) | 55 (+0) | 58 (+0) | +2 on average; the Collector 0.28/game |
| Pell (T2, +Glaciers) | 53 (−7) | 63 (−8) | 64 (−8) | 64 (−2) | 62 (−8) | **−7 on average** — the one placement that cost: an Island became a land that enters tapped and fetches only from the next turn; the landfall pays back too slowly at 40 cards |
| Corvane (T3, +Angel) | 67 (+0) | 70 (−5) | 62 (−2) | 82 (−3) | 81 (−4) | −3 on average (noise-edge); the Angel hard-cast 0.23/game, reanimated 0.10 |
| Quill (T3, +Glaciers) | 74 (+11) | 84 (+0) | 79 (+10) | 89 (+2) | 79 (−2) | +4 on average; Quill's ramp uses the extra land |

   The noise floor at 100 games is about ±10 on a cell and ±4 on a five-cell mean. **Pell is the read**: the Glaciers slowed him (−7); the planner may want the Island back or the Glaciers in place of a Rampant Growth rather than a land. Everything else is inside the floor.
2. **The Collector's reveal is priced by the best name's SHARE of the hand** — at four Crabs and a land it is 0.8 × 1.8; at a diverse seven it is ~0.25 × 1.8, so the AI activates it mostly late (one card in hand) as the brief intended.
3. **The Angel's cycling gate reads "a reanimator in hand" as a `returnFromGraveyard → battlefield` spell** (Zombify, Unearth — the latter cannot return a seven-drop; the gate does not check the target's mana-value ceiling). A small; Corvane's Unearth is one copy.
4. **The Library is shop-only and unmeasured** — R never stocks; it enters play only through ante/quest/treasure. Its AI is pinned by construction (enumeration) rather than by a book.
5. **The art verdict is in — round 2, number 3 (the art nouveau poster).** The card art is the render punched in past its rounded beige border (a 64px inset, Chris's instruction for our frames) and then the house 5:4 crop; the as-printed render (Chris) is installed at 745px and `printedAsset` is wired; round 1 and the other three of round 2 are rejected in the MANIFEST. Nothing is pending on the Collector. History of the round, for the record: Chris rejected round 1 (nothing spoke; the cards themselves de-emphasized) — round 2's four (`card-arcane-collector-r2-1..4`: stained glass, illuminated manuscript, art nouveau poster, dark surrealist oil — the wager carried by sealed jars, tagged drawers and a hand choosing by touch) are rendered and logged (MANIFEST: round 1 rejected, round 2 candidates). The as-printed render (Chris) follows the pick, then `printedAsset` on the def and the MANIFEST row.
6. **The Angel's printing is the Brothers' War Commander one** (BRC #68, Viko Menezes — the retro 1997 frame, Chris's default aesthetic pending specific choices like the ABU duals): an `art-fetch` override + a printings.md row + the def's `scryfallId`; the earliest printing (C21) stays in the pool-registry note. Lesson for the fetch: a card already in `oracle.json` is never re-resolved — to re-pin a printing, drop its oracle entry and its `data/art/real/<id>.*` files, then `pnpm art:fetch` (documented in implementer-notes).

## Registry entries added/changed

R-096. Pool-registry: Session 36 section (+4; the placements). ADR-121 in `docs/decision-updates/s36.md`. Knobs unchanged. Engine: `cleanupReturns` (state, view), the cleanup step's due list, `activateOnlyIf` (enumerator), `REVEALED` event, `nameCard` action, `chooseName` purpose, the `reveal` RNG purpose, `artifactOrEnchantment`, `exile.targetSpec`. Cards: the six vocabulary entries, `cyclingSearch`. AI: books 52–53 + the Collector pin; `landOnlyCandidates` untouched. UI: the `nameCard` label, the REVEALED line, the typed-cycling label, the `chooseName` dialog title. Sim: `s36-fuzz.test.ts`, `primaryColors` for Kessa. Art: `card-art.md` entry, four subject files, four renders (MANIFEST rows by the script). `docs/reference/` regenerated (cards.md 198). Implementer-notes S36 lessons.

## Test status

Default tier **595 passed / 2 skipped** (59 files; +10 fixtures, +3 book pins, +2 fuzz tests; baselines: the loader's def count 207 → 211, the shop-tier tally 72/52/10/23 → 72/54/11/24, the no-peeking view-key pin gained `pendingCleanupReturns`, Kessa's `primaryColors`). `pnpm typecheck` clean. **Fuzz-before-fixtures honoured** (840 games). **Both ladder gates green.** Sweep: parts 2 and 5 at Standard (10,000 games).

## Suggested next

1. **Chris**: the Collector's art verdict (1–4); the as-printed render; Pell's Glaciers (Concern 1).
2. **Planner**: the blue-road run (the brief's purpose); the parked phase-two question (chris-road-B against a Simic/Sultai road).
3. **Implementer smalls**: the Angel's reanimator gate to respect Unearth's ceiling; a Library book pin if it ever reaches a mage list.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 [--mode easy|standard|hard] [--part 1..9] [--baseline packages/world/src/sweep-baselines/s35.json|none]
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/card-arcane-collector-N.md --no-style --aspect 1:1
pnpm viewer → /lab · /play (dev) · /gallery · /world
```
