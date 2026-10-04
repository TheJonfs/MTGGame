# Handoff — after Session 54 (2026-10-04)

## State of the world
The Convocation at `/convocation` now has three new choices at the door.
- **Normal or Hard:** every event carries a difficulty. Hard adds ADR-148's life to your opponents, by Swiss round and in the Umbel, scaled by the day.
- **A short Convocation:** a draft (three rounds in the pod), then a Constructed day (five rounds), then the Umbel.
- **The field's strength:** seeded per seat, recorded and never shown.

The ledger keeps the field's top sixteen and the player. A draft stage's other pods now draft on the page's workers (15 pods in about 2 s, start-up included), with the main thread as the fallback.

Walked in the browser: the door (short, Hard) → register the Sweep → "the other pods draft… 0 of 15" → Day 1's draft. No console errors.

`pnpm typecheck`, `pnpm test` (912) and `pnpm build:web` pass. The card rating stays **v1.4**: the v1.5 candidate failed its head-to-head. **S54 is committed locally, not pushed.** Before S54, everything through `4845e4e` was pushed.

## Done this session

### Part 0 — rulings (`docs/decision-updates/s54.md`)
- The brief's ADRs (155–158), plus Chris's five kickoff rulings:
  1. Normal and Hard only.
  2. The day scale.
  3. Master pilots everywhere; journeyman to be tested.
  4. Pilot data reported only if journeyman joins the field.
  5. Retirement is a review sent to the planner, counted from the pilot-97 round-robin.

### Part 1 — build
- **ADR-157, the difficulty** (`event.ts`):
  - `eventDifficulty`, `hardLife`, `dayScale` and `HARD_ENTRANCE` (Swiss +0/+2/+4/+4/+6 by round within a day; bracket +4/+6/+8).
  - The day scale: the four-day event ×0 / ×0.5 / ×1 / ×1 and ×1 in the Umbel. A single event ×1. The short event's Day 1 ×0, then ×1.
  - `seriesSetup` adds it to the seat's life.
  - Saved "easy" or "standard" events load as Normal.
  - The door's chooser carries the brief's lines. The ledger line and the trophy room show "(Hard)" or "· Hard".
- **ADR-158 as amended, the field's strength** (`seatStrength`):
  - Every pilot is master.
  - Builders: stock ¼, light ½, heavy ¼.
  - Limited rating noise: σ 0 / 0.2 / 0.4 by thirds.
  - Drawn from `sub(seed, 13, seat)` when any event is created, and kept on the seat across stages.
  - The Constructed builds pass the seat's builder as `tinker`. The Limited builds apply the seat's noise from its own stream.
- **The short Convocation:** `shortStages(first)` returns `[draft ×3, constructed ×5]`. The door's text is from the brief, and the Day-four chooser is hidden for it.
- **Concern 6, the pod drafts on the workers.**
  - `stagePodDrafts(event, k)` names a draft stage's pods, and each non-human pod's job and seed. `beginStage`, `nextStage` and `registerDecklist` take optional precomputed picks.
  - The worker gained a draft job, and `FieldPool.draft` serves it.
  - The controller's `register` (the last decklist starts Day 1) and `toNextStage` draft on the workers first, under the field screen's "The other pods draft… n of m pods drafted." They stay synchronous without workers.
  - A failure disposes the pool and drafts on the main thread.
  - A test checks the worker-drafted field is identical to the main thread's.
- **The ledger trim:** `LEDGER_FIELD = 16`, plus seat 0. The trophy room reads the same line.

### Part 2 — measured (reports, untracked: `results/s54/` and `analysis/runs/convocation_sim54.md`, `h2h15_*.md`)
- **`convocation-sim --events 8` (ADR-158), 1,016 AI seats.**
  - r = **−0.25** between a seat's mean deck percentile and its finish (lower finish is better, so negative is the good direction). S53's was −0.09. The brief wanted a magnitude of 0.3.
  - The Umbel's eight averaged the **61st percentile**, above the median as the brief wanted. The champions averaged the 62nd.
  - By day: Day 1 −0.12, Day 2 −0.21, Day 3 −0.09, Day 4 −0.21. The Open's days carry most of it.
  - **The strength draws themselves do nothing measurable.** Mean finish by builder: stock 64.0, light 64.6, heavy 65.3. By noise: σ 0 64.7, σ 0.2 65.5, σ 0.4 63.7. An even field is 64.5. See Concern 1.
  - Event health: 0 rematches; 0 draft-round pairings outside the pod; the save 359–544 KB; 211 s an event in Node (one process).
  - The heuristic in the player's seat finished 21, 21, 43, 43, 58, 90, 34, 61.
  - The sim's day-quality snapshot was fixed: a registered Constructed day skips the build phase, so the first run read Day 1's quality again for Day 2. S53's table had the same flaw for any registered day.
- **Journeyman against master** (Chris's test; `open:rr --journeyman`). Four lists against the other thirteen, 650 games each, paired with the master twin on the same seed:

| list | master | journeyman | change |
|---|---|---|---|
| the Levy | 64.6% | 63.2% | −1.4 ± 2.8 |
| the Muster | 53.8% | 53.1% | −0.7 ± 1.9 |
| the Depths | 55.5% | 58.6% | +3.1 ± 2.9 |
| the Undertow | 35.8% | 36.2% | +0.4 ± 3.4 |

  Journeyman (temperature 0.35) and master (0.12) are indistinguishable. Between 6% and 19% of games change hands, but they change in both directions. **Journeyman has no play, so the field stays master**, per Chris's ruling.
- **The noise run after v1.4 → v1.5 not adopted.**
  - Three runs on v1.4's decks at pilot 97: sealed57, noise57 and draft57, 73,600 games.
  - Head to head against v1.4, the v1.5 candidate's decks won **44.1% ± 0.5 in draft and 42.3% ± 0.8 in Sealed** (43.8% and 42.4% from the same packs).
  - It moved 124 of 234 cards more than 0.25 (v1.4 moved 58). The risers are the rarely-seen cards shrinking to their tier's mean: Waste Not seen 13 times, +2.06; Entomb, Demonic Tutor, the Pearl Cleric, Altar of Dementia. See Concern 2.
  - The candidate is archived in `analysis/runs/s54/`.
- **The Open round-robin baseline** for the retire rule is the pilot-97 run of 2026-10-03, filed in `s54.md`. Its first bottom three are the Larder, the Locks and the Undertow (one of three re-measures).

### Part 3 — text
- The door's short line and the difficulty lines are as briefed. The field's strength is never announced.

## After the handoff — Chris's third Convocation (2026-10-04): books 98–99
- **Book 98 — a Reassembling Skeleton activated three times in one upkeep.**
  - The cause: the card stays in the graveyard while its return waits on the stack, so the engine offers the ability again; each further activation pays {1}{B} and finds nothing.
  - Measured over 40 games with a Skeleton deck: the AI took **111 of 117** such offers. Now 0 of 93.
  - The rule (`yardReturnPending`): a graveyard card's ability that returns the card itself is refused while one of ours from that card is on the stack. An ability that exiles its card as a cost (Mother Bear) is never offered twice, so it is untouched. Another Skeleton's return is its own.
  - The view's stack items now carry `sourceId` (public).
  - Found on the way: the predictor's view clone shared the graveyard-object lists, so predicting a Skeleton's return removed the card from the real view for the rest of the decision. Fixed.
- **Book 99 — the Usher's loop** (Chris; found by the field in an Usher mirror).
  - Confirmed in the engine: an Usher entering with a second Usher in either graveyard returns it, the legend rule puts one in the graveyard, and the newcomer's trigger returns it again. Both Ushers see each death: **4 life a pass**, a kill on the turn it starts. Against an opposing Usher on the battlefield it nets 2 a pass and still ends.
  - The AI already tended to take the Usher (its reanimation worth is high), but an Artisan of Kozilek outranked it. Now `legendLoopWorth` (evaluator) adds a game-sized bonus wherever a reanimation target is priced: the enter trigger's target, a reanimation spell (Zombify, Unearth), the Reeve's activation, and Buried Alive's pick when the first Usher is in hand or on our battlefield.
  - It is data-driven, not a card rule: a Legendary creature whose enter trigger returns a creature card to the battlefield and which drains on a creature's death, with a second copy on our battlefield or in a graveyard its trigger reaches.
  - A loop that gains nothing is avoided: when the opponent's drain per death matches ours, the copy is priced *below* every other target.
- **Measured** (100 games a pairing against the other thirteen lists, the old AI and the new on the same seeds): **the Coin 58.7% → 59.7% (+1.1 ± 0.8)**, **the Loop 50.9% → 52.1% (+1.2 ± 0.8)**. A small gain for both Usher lists.
- **Ladder mirror gate PASS.** Tests 914 (books 98 and 99 added).
- The S54 tests moved to `convocation-s54.test.ts`: `convocation.test.ts` had passed 60 s of synchronous work, which is what raised vitest's "Timeout calling onTaskUpdate". The run is clean again.

## Deviations from the brief
1. **Two difficulties, not three; every pilot master** (Chris's rulings 1 and 3). The seat records `pilot: "master"` for when that changes.
2. **v1.5 not adopted.** The head-to-head failed, as the rule allows.
3. **The noise run could not pool with v1.4's runs.** Books 96–97 moved the pilot, and ADR-150 refuses to mix pilots. So the candidate stood on 73,600 fresh games, half of v1.4's evidence.
4. **The field's per-stage time on workers was measured only in the browser walk's draft start** (15 pods, about 2 s). The sim's stage times are Node, one process an event. The workers' round times stand from S53 (1.5–3.7 s).
5. **Hard was not simulated.** Its effect on a player is untested beyond the life table's test. A heuristic in the player's seat against a Hard field would measure it.

## Concerns
1. **ADR-158's spread is not a strength spread.**
   - The builders (stock/light/heavy tinkering) and the Limited noise up to σ 0.4 leave every group's mean finish within a place of even. And journeyman is master.
   - The deck-quality correlation that exists (−0.25) comes from what the seat draws: the list chosen, the packs opened. It doesn't come from the seat's drawn strength.
   - If the field should have strong and weak seats, the lever has to be one that moves results:
     - draw a Constructed seat's **list** by its strength (weak seats more often from the round-robin's bottom);
     - widen the Limited noise (σ 0.8–1.2);
     - or give weak seats a build that misses the curve.
   - Each is measurable with this sim. Which one is a design call.
2. **The rating's feedback loop is now the binding problem.**
   - Each pilot change discards every Limited run (ADR-150). So each rebuild stands on fewer games, and the shrink-to-tier-mean lifts every rarely-seen card, here enough to lose 6–8 points.
   - Two fixes, either sufficient:
     - a lower shrink target for little-seen cards (the tier mean minus the "avoided" penalty the last rebuilds measured);
     - or a noise run sized to match the evidence it replaces (about 150,000 games, roughly two hours on ten cores).
   - Until then a rebuild after a book of shame is a regression. v1.4 (pilot 95's games) is a better rating than a pilot-97 rebuild of this size.
3. **The campaign linkage's one-way write** — the implementer's read, as it would be built:
   - **The Convocation never writes the world save; it posts to a mailbox.** The journey's controller rewrites the whole save on every autosave (`world-controller.ts` `autosave`). A Convocation tab writing the save while a journey tab is open would be silently overwritten. So the Convocation appends `{ id, kind: "kept" | "prize" | "spent", cards, gold }` to its own key (`convocation-outbox`). The world drains it on load and on focus. It records each id once (a new provenance source `"convocation"`), and removes an entry only after its own save succeeds.
   - **The entry cost is paid in the journey.** Taking gold from the Convocation page has the same race. So an *invitation* is bought or earned in the world: a town board or a quest reward, held in an additive reserved field. The door reads unspent invitations (read-only, as it reads decks today). Entering posts "spent", and the Convocation's ledger records the id so a reload can't spend it twice. An invitation could carry the shape: a draft ticket, or a sealed letter for the four days.
   - **What comes home must be fenced, and this is the design question.** The packs' power slot (`sets.json` `power`) holds Black Lotus, the five Moxen, Time Walk, the five High Grounds, **the Manafleur** and the Cinquefont. The Vault's lock counts Moxen in the collection (`moxenHeld`), and the Manafleur is the Heart's prize. A champion's two kept cards could skip the campaign's spine.
   - Options: (a) kept cards exclude the power slot; (b) power comes home as a proxy that counts for no lock; (c) a campaign-entered Convocation drafts a campaign-safe set. I'd take (a): one filter at the finish, and the campaign's keys stay the campaign's.
   - **The prize** (gold or a card by place band) rides the same outbox, as a knob table like the campaign's other rewards.
   - **Cost:** about one session — the outbox and drain (~150 lines with tests), an additive save field, a provenance source, the door's invitation chooser and the kept-card filter, with the fence decided first.
4. **The engine has no rule for a mandatory loop** (CR 104.4b / 732.4: a loop of mandatory actions that nobody can stop is a draw). The Usher's loop always ends today because the looping side drains twice a death. A board where the drains cancel and the only legal target is the other Usher would never end: the game, a field worker, or the page would hang. The AI avoids choosing into it (book 99), but cannot when the choice is forced. A cap on stack items resolved without a change in life or board, ending in a draw, would close it. Escalated, not built.
5. **The pilot is now 99.** Every rating run is stale again (Concern 2).

## Registry entries added/changed
None. No card or rules change.

## Test status
`pnpm test`: 99 files passed, 1 skipped; **914 tests passed, 2 skipped** (the standing two).

New tests:
- `convocation.test.ts` (3):
  - Hard's life table, with the day scale and the retired names;
  - the seat's strength (seeded, kept across stages, noise changes a deck);
  - the ledger trim and the short Convocation headless to its Umbel.
- `field-pool.test.ts` (1): the pods drafted on (fake) workers give the field the main thread drafts.

No AI heuristic changed (no ladder run); no new card (no fuzz). About 110,000 sim games this session raised no engine error.

## Suggested next
- **Chris plays the short Convocation on Hard.**
- **For the planner:**
  - the lever for field strength (Concern 1);
  - the rating loop's fix before the next rebuild (Concern 2);
  - the linkage's fence (Concern 3) — the build is about a session once it is chosen.
- **The retire count** advances at the next Open round-robin.

## How to run
```
pnpm viewer                                                    # /convocation — the door: the four-day, the short, the single events; Normal/Hard
pnpm typecheck && pnpm test
pnpm convocation-sim --events 8 --seed 54 [--short] --shard i/8 --out analysis/runs/convocation54_shard$i.json   # then --report <shards>
pnpm open:rr --games 50 --seed 54 --only levy [--journeyman levy] --out x.json   # a list against the field, master or journeyman, paired by seed
pnpm sealed-sim --pools 200 --games 10 --seed 57 [--noise 0.4] --shard i/5      # the rating's Limited runs (pilot-versioned)
pnpm draft-cards --pods 300 --games 4 --seed 57 --shard i/9
pnpm rating:build <authored shards> --limited a,b,c --candidate <name>   # then merge `limited` into a copy of card-rating.json and run rating-ab
pnpm rating-ab --sealed a.json b.json --pools 200 --opponents 4 --games 4 --seed 59 --shard i/10
npx vitest run packages/world/src/convocation.test.ts packages/ui/src/convocation
```
