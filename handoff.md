# Handoff — after Session 53 (2026-10-06)

## State of the world
**The full Convocation is playable at `/convocation`:** four days at 128 seats, sixteen Swiss rounds and the Umbel. Day 1 is a draft (three rounds inside your pod of eight), Day 2 is a Constructed format (five rounds), Day 3 is a second draft (your pod is the seven seats nearest your record), Day 4 is a second Constructed format (five rounds), and then the Umbel in the last format. The door chooses both Constructed days from the seven formats. The record carries across days, there's a day's-end screen between stages, and the field's sixty-three series a round play on web workers (1.5–3.7 s a round in the browser). The finish gives a title and kept cards (the champion keeps two, the rest of the eight one, from the last draft), and the door has a trophy room. The save is `convocation-event-v2`; v1 saves still load. **The card rating is v1.4**: the Limited score re-measured on 147,200 games, with the Constructed score unchanged. The three single events (Draft, Sealed, the Open) are unchanged, except that the Sealed field now varies its pair (ADR-154). Walked in the browser from the door to the trophy room at 128 seats. `pnpm typecheck`, `pnpm test` (895) and `pnpm build:web` pass. **S46–S53 are committed locally and not pushed.**

## Done this session

### Kickoff — Chris's rulings (`docs/decision-updates/s53.md`)
- **128 seats**, not the brief's 32 (Chris: a 16-round Swiss wants 100–200 seats so it doesn't rematch). Measured on the event's own pairer over 100 random 16-round events per row:

| seats | draft rounds room-wide | in-pod, 2nd pods random | in-pod, 2nd pods by standings |
|---|---|---|---|
| 32 | 0 rematches, but pairings 0.49 wins apart; search up to 141k steps | 17% of events | 91% |
| 64 | 0 · 0.17 | 1% | 29% |
| **128** | 0 · 0.07 | 0% | **1%** |

- **Draft rounds pair inside the pod** (MTR 7.6, verified: "Players within a pod may play only against other players within that pod").
- **The second draft's pods are formed by standings.** MTR 7.6's text says "random drafting circles". By standings is the Pro Tour's Day-2 practice as I understand it, **not verified** against a published document.
- Also verified: MTR 10.4 names the Swiss algorithm without detail (no written no-rematch line), and has early Top-8 lock-ins with byes at a Pro Tour (not built). Appendix E recommends 8 Swiss rounds for 129–226 players.

### Part 0 — rulings and measures
- Filed: S52 ratified, ADR-153 (two scores), ADR-154, the draft target against three-pack Sealed, red tracked.
- **ADR-154 built** (`LimitedBuildOptions.pairChoice`; the Sealed field chooses over its top three pairs, weighted by score). It is applied to the single Sealed event's AI seats and to a Convocation's Sealed stage. **Measured: it moves little and costs a little.**
  - Blue's share of Sealed decks went 67% → 63% and decking 17% → 16%.
  - Varied-pair decks win **48.0% ± 0.8** head to head against best-pair decks.
- **The noise run on v1.3 → v1.4 adopted.** Three new runs (sealed55, noise55, draft55) were pooled with S52's three.
  - Against v1.3: **draft 52.8% ± 0.5**, **Sealed 51.3% ± 0.8**. The colours' draft win rates went from 47–54% to 49–52%.
  - The twenty movers are in `s53.md`. Mostly they're cards v1.1 avoided (Gray Ogre, Disenchant, Hill Giant, Orcish Lumberjack): v1.3 rated them at their tier's mean, played them, and v1.4 measured them losing.

### Part 1 — the staged event (`world/event.ts`)
- **`newConvocation` / `beginStage` / `nextStage`.**
  - `formatId` is always the current stage's, so every single-event path works unchanged. `rounds` is the whole event's. The results accumulate, so the standings carry across stages without extra work.
  - Every per-stage roll is salted by the stage; unstaged events roll exactly as before.
- **A draft stage:**
  - The first draft's pods are random; a later draft's are formed by standings.
  - Every pod but the player's drafts headless at the stage start. The player's pod drafts live, and it can be any pod (`draft.pod`).
  - Rounds pair inside the pods (`pairRound` over `event.pods`).
- **A Sealed stage** deals every seat a pool, and the field varies its pair. **A Constructed stage** builds the field by select-and-repair.
- One face a seat for the whole event. The `interlude` phase sits between stages. The player's pool and deck per stage go in `history`.
- **The Umbel** takes the top eight by the carried standings, in the last stage's format.
- **The save is `convocation-event-v2`**; v1 still loads. It's resumable at any transition: tested by serializing after every one of 100+ transitions, including mid-draft, between stages and in the bracket.
- **The field on workers** (`ui/convocation/convocation-worker.ts`, `field-pool.ts`): one series a job, each job sent the event with only its two seats. Results are identical to the main thread (a series is its seed's). Tests in Node keep the main thread.
- **The door:** "The Convocation — four days, 128 seats" with Day two and Day four format choosers. **Screens:** the day's end, the trophy room, and a big-field table (the top sixteen plus the rows around you, with "all 128 seats" on request). Pairings and match lists show the top tables plus yours.

### Part 2 — prizes by finish
- **Titles** (`finishTitle`): "Champion of the Umbel", "the Umbel's second stalk", "a semi-finalist", "an Umbel seat", else "21st of 128".
- **Kept cards** (`keepAllowance`, `lastLimitedPool`): the champion keeps two, the other seven of the eight one each, from the last draft's pool.
- **The ledger line** gains the stages, the title, every registered deck and the kept cards.
- **The trophy room** shows the Convocations played, their titles, the kept cards and the champion's four decks.

### Part 3 — smalls
- **"Start from a list"** in the Constructed editor: the twelve lists that format's field is drawn from (`selectCandidates`, extracted from the builder's select step), repaired to the format and played as written.
- **Walked in the browser** at 128 seats, seed 5301 (Day 4 Pauper):
  - **Door, Day 1 draft and build:** the door; the event created in 1.2 s; the first draft (one pick by click, the rest driven); the build with "Suggest a deck" and Register.
  - **Rounds and the day's end:** the pairings and the match screen; a reload mid-event, resumed; the standings; the day's end.
  - **Days 2–4:** Day 2's editor with the list picker (the Levy, a legal 60); Day 3's pod checked to be exactly the top eight; Day 4 Pauper (every field deck legal, from 12 source lists).
  - **The Umbel and the finish:** the Umbel's opening line; the champion's finish with two cards kept; the trophy room.
  - **Results:** no console errors, no rematches, every draft round inside its pod. The save peaked at 452 KB.
  - **Found and fixed during the walk:** the live pod was dropped by every draft pass. Any pod other than seats 0–7 would build the wrong seats and leave its own empty. A test now checks every seat's 45 cards and deck after a draft; it fails without the fix.
  - Also fixed: a faceless seat now shows its initials instead of "you".

### Part 4 — measured (`pnpm convocation-sim`; 4 full events at 128 seats, a heuristic in the player's seat)
- **Clean:** 0 rematches, 0 draft-round pairings outside their pod. The heuristic finished 21st, 81st, 4th and 1st.
- **Time:** about 5 min an event in Node on one thread (alongside other sims). Per stage: 80, 91, 66 and 52 s; the Umbel 1 s. In the browser, a field round on eight workers took 1.2–3.7 s. A stage's start (fifteen pods drafted headless) took about 2.7 s on the main thread.
- **The save:** 268 KB at creation; 300–520 KB in play (the draft stages, every seat holding 45 cards). A ledger line is about 12 KB.
- **Does the carried record find the strong seats? Barely.** A seat's deck quality (its percentile in the field, by the stage's own score) against its finish gives r = −0.09.

| finish | mean deck percentile across the four days |
|---|---|
| the champion | 0.38 |
| 2nd–8th | 0.54 |
| 9th–32nd | 0.52 |
| 33rd–64th | 0.50 |
| 65th–128th | 0.49 |

### Part 5 — text
All four lines are in place:
- The door: "The Convocation — four days: a draft, the Open, a draft, {format}; the Umbel of Eight."
- The day's end: "Day one ends. The table stands at 3–0. Tomorrow: the Open."
- The Umbel: "Eight remain. The Umbel opens in Pauper."
- The finish: "Champion of the Umbel."

## After the handoff — Chris's two rulings (2026-10-03)
- **Decklists up front, locked through the Umbel.** A full Convocation now opens on registration: the player registers one deck per Constructed format (stage order) before the first draft (`registerDecklist`; `decklists`, `registering` in the save). A Constructed day seats the registered deck and posts its round directly; the AI seats' decks are built from the roll of the format's first stage, so Day 4 in the same format (and the Umbel) plays the same decks. Tested: Day 2 and Day 4 decks identical for every seat; two formats register two decks in stage order. Later shapes (a Sealed day, a different Day-4 format) work from the stage list; a Top 8 in a format of its own (a draft or Sealed Umbel) is the next piece if wanted — not built.
- **Portraits recycle** across the 128 seats (38 portraits; every opponent has a face).
- 896 tests pass.

## After the handoff — a single-card playtest, and Rage Cobra re-costed (Chris, 2026-10-03)
- **`pnpm card-test`** (`world/card-test-cli.ts`): variants of a card (cost, P/T, keywords — sim-only, never in `data/cards`) swapped into the SAME slot of red Sealed host decks (the host's lowest-rated singleton nonland card), played on the same seeds against a fixed forty-deck gauntlet. The headline is the **paired change** per host against a baseline variant (± is across hosts); a game in which the test card is never drawn replays identically, so the noise comes only from the games where it shows up. Also: lift, cast when drawn, the game turn cast, and (observed from the life totals) the opponent's life gained while the card was out.
- **Its controls** (400 hosts, 8,000 paired games a variant, against Gray Ogre): an identical copy **+0.0** (0 of 4,266 undrawn games diverged); a vanilla 3/2 Ogre **+0.9 ± 0.2**; Boggart Brute **+1.6 ± 0.3** (menace alone +0.7 ± 0.2); both halves of the hosts agree. Lift ranks the same way at about three times the noise.
- **Rage Cobra's grid** (207 hosts, against the old {2}{R} 1/1; Ogre and Brute as yardsticks): 2R 2/1 +0.8 · 2R 2/2 +1.3 · 1R 1/1 +0.7 · 1R 2/1 +1.6 · **1R 2/2 +2.5 ± 0.4** · R 1/1 +1.7 · R 2/1 +3.2 · R 2/2 +3.9; Gray Ogre −0.8, Boggart Brute +1.6. A mana is worth ~0.8–0.9 points, a point of power ~0.5–0.8. The old Cobra loses to Gray Ogre when the opponent gains no life (+0.9 to the Ogre) and beats it by 2.2 when they do. The trigger fired in about 30% of the games the Cobra was cast, ~7 counters when it did. Mapped by the two yardsticks' measured Limited scores (≈0.48 a point), 1R 2/2 sits at ≈2.3 — above Boggart Brute (1.80), among red's better commons.
- **Chris's ruling: Rage Cobra is {1}{R} 2/2** (the trigger unchanged). The def, the printed face (Chris's re-print — verified word for word: {1}{R}, Summon Snake, the trigger, 2/2 — resampled and installed), the pool registry, the manifest and `docs/reference/cards.md`. One fixture re-baselined by the card (the Warden-fed Cobra is 3/3, was 2/2). **Its Limited score is the card test's estimate, 2.31, until the next Limited re-measure** (its old card's 11,058 sightings cleared); its Constructed `rating` is still the old card's. *For the planner*: the card change itself, and whether `card-test` becomes the standard check before a custom card enters the pool.

## After the handoff — Chris's first Convocations (2026-10-03)
- **Chris went 19–0** (16–0 in the Swiss and the Umbel, the Open on both Constructed days, a separate run from one lost to the block bug). The event's data is in `docs/debug_logs/convocation-19-0.json`.
- **Fixed — a block skipped after attacking with everything** (fatal twice): the controller's declaration queue survived an auto-taken "done" and answered the tapped-out player's next request, the opponent's declare-blockers. The queue now carries its stage; reproduced on Chris's own decks; regression test.
- **Fixed — the field hung at "0 of 63"** after a redeploy (a stale page's worker file is gone): the pool breaks instead of respawning forever and the round plays on the main thread. Four tests with fake workers.
- **Book of shame 95** — the AI no longer attacks into Voracious Cobra (its destroy-on-combat-damage trigger is a deathtoucher in the attack simulator). Ladder PASS.
- **Not a bug — the High Ground payments** Chris saw: Shevelport taps for {W}. A regression test pins that a High Ground's own tap never pays its own colour.
- **The Beast token's art**, and **all sixteen token arts promoted to Convocation portraits** (38 faces → 54).
- **The metagame grows from play.** Lists contributed from Convocations live in `data/convocation/open-contributed.json`; `pnpm open:gen` validates and appends them. The first: **the Sweep** (Chris's 19–0 Jund Aristocrats; the name provisional). The field draws on every list with a measured strength (`candidateCount`). The Open's round-robin re-measured with thirteen lists on pilot 95 (7,800 games): levy 66 · **sweep 61** · wurmspeaker 61 · coin 59 · muster 55 · warband 54 · ford 52 · loop 50 · enchantress 49 · tally 38 · undertow 35 · locks 35 · larder 34. *For the planner*: contributed lists are a new source beside the planner's document; whether they want a ruling (how many, how chosen, when retired).

### The Sweep — the list that went 19–0 (Chris's exact sixty, the Open on Days 2 and 4 and in the Umbel)

- **Creatures (25):** 4 The Reaper, 3 Meliyan, the Torment, 4 Blood Artist, 4 Birds of Paradise, 4 Shocking Sharpshooter, 2 Seasoned Pyromancer, 2 Vampire Nighthawk, 2 Voracious Cobra
- **Noncreature spells (11):** 4 Bitterblossom, 3 Putrefy, 2 Rancor, 1 Prey Upon, 1 Lightning Bolt
- **Mana: Moxen and the Lotus (6):** 1 Black Lotus, 1 Mox Emerald, 1 Mox Jet, 1 Mox Ruby, 1 Mox Sapphire, 1 Mox Pearl
- **Lands (18):** 1 Cairnbrand, 4 Badlands, 4 Bayou, 4 Taiga, 1 Tallyflame Court, 1 Obsidian Observatory, 1 Shevelport, 1 Underground Sea, 1 Savannah
- **Measured** in the Open's round-robin (pilot 95, 100 games a pairing): 61% against the field — the Coin 44 · the Levy 49 · the Wurmspeaker 50 · the Ford 50 · the Muster 58 · the Loop 60 · the Enchantress 61 · the Warband 61 · the Tally 71 · the Locks 71 · the Undertow 77 · the Larder 77.
- **A second Convocation, 19–0 again** (seed 186842; 32–3 in Swiss games) with **the Depths** — Sultai control around Clio (4 Clio, 4 Counterspell, 4 Tidewall, 2 Control Magic, 2 Traumatizer, 2 Undermine, 2 Temporal Spring, the Reeve, Drana, Seraphina, Zinnia, Mystic Snake, Time Walk, Demonic Tutor; 4 Birds; the Power; 4 Bayou, 4 Tropical Island, 4 Underground Sea, Library of Alexandria, Wrackroot, Watery Grave, Breeding Pool) — added as the second contributed list. The fourteen re-measured on pilot 97 (9,100 games): levy 65 · wurmspeaker 62 · coin 59 · sweep 59 · **depths 57** · muster 53 · warband 53 · loop 53 · ford 51 · enchantress 50 · tally 37 · undertow 35 · locks 35 · larder 28. In that event the field's Constructed results tracked the round-robin (the coin 65%, the levy 60% … the tally 32%).
- **Books of shame 96–97** (Chris: the field never killed Clio; its locked board never blocked): counters in the view, a removal's prediction lifting the removed permanent's static P/T, a debuffed creature worth less, a growing lock's next step credited. Ladder PASS. **Chris's third note (too cautious on wide boards) did not reproduce** on the board he described — the AI attacks with all six at every life total, and is reckless where it should hold (it swings out at 6 life into a 9/9 trampler). The Convocation's match screen now has **"save this game's log"** (a mid-game snapshot that replays) so the real boards can be captured and pinned.


## Deviations from the brief
1. **128 seats** (Chris), not thirty-two; the default stages are otherwise the brief's.
2. **Draft rounds inside the pod; the second draft's pods by standings** (Chris). The brief said only "the Swiss pairs on [the carried record]".
3. **Both Constructed days are chosen at the door.** The brief's door line names only the second, so the line now names both.
4. **The Umbel plays in the last stage's format only**; `top8Format` as a separate choice isn't built (the brief's default is the last stage's).
5. **No sideboarding for the player in a Constructed event** ("if cheap"). The field doesn't sideboard in Constructed either; a player's sideboard needs a registered fifteen and an editor for it, which isn't cheap.
6. **The thirty-two-seat single Draft and the single Open were not walked separately.** The full Convocation walk covers both formats: two drafts, the Open and Pauper, and the Umbel. The series were auto-won through the controller; one match screen was checked, not a game played by hand.
7. **ADR-154 also applies to the single Sealed event's AI seats** (the ruling reads "the Sealed builder").
8. **Only 38 portraits for 127 seats:** recycled (Chris).

## Concerns
1. **The Convocation is close to a lottery among the AI seats.** Deck quality barely predicts finish (r = −0.09). The champions' decks averaged the 38th percentile and the Umbel's 54th. The field is built by one set of rules, so its decks come out close in strength, and sixteen best-of-three rounds among near-equal decks are mostly variance. The player's edge over the field matters, but "the Umbel finds the best" isn't what happens. Options: a field of varied strength (stronger and weaker builders and pilots by seat), or accept it as the format's drama. (In Constructed, a deck's mean card score is a weak proxy, since the list matters more.)
2. **ADR-154 is a weak lever on blue** (67% → 63% of Sealed decks) and costs two points a deck. Blue's strength is in its cards: Control Magic, Traumatizer, Cloudkin Seer and Faerie Formation sit at the top of the Limited score. This is a pool question.
3. **The rating feeds back on itself through unseen cards.** The Limited score shrinks a little-seen card to its tier's mean, the mean of cards that are played. An avoided card belongs below that, so each rebuild plays the last one's avoided cards and corrects them next time (v1.3 → v1.4: Gray Ogre 1.95 → 0.65). A lower shrink target for little-seen cards, or a noise run after every rebuild, would damp it.
4. **Red in Sealed is 15% of decks under v1.4** (24% under v1.3), though its decks win 54% head to head. In draft, red seats win 49%.
5. **The save is 300–520 KB** at 128 seats (the plan estimated 60 KB for a hundred seats without pools), within localStorage's ~5 MB. A full Convocation's ledger line is about 12 KB, because it lists the whole field. A hundred events would be 1.2 MB; trim the field to the top 16 plus the player if that matters.
6. **A stage's start freezes the page for about 2.7 s** (fifteen pods drafted headless on the main thread). It could move to the workers.
7. **A full Convocation is long for a player:** two drafts of 45 picks, four builds, sixteen rounds of up to three games, and the Umbel. Save and resume work at every step; Chris's play-through will say whether it wants a shorter shape (the stage list makes any shape a data change).
8. **Names repeat their given names** across 127 seats (two Xanthes, two Cyprians); harmless, noted.

## Registry entries added/changed
- No R-numbers (tournament policy, not the rules). No pool changes; no knobs changed (the entrance stays flat).
- **Data:** `card-rating.json` v1.4 (the Limited fields; `run.limited` lists six runs).
- **Save:** `convocation-event-v2` (`stages`, `stage`, `pods`, `draft.pod`, `history`, `keptCards`, the `interlude` phase); the v1 format still loads.
- **Ledger:** `stages`, `title`, `decks`, `keptCards` on a full Convocation's line.

## Test status
`pnpm test`: 93 files passed, 1 skipped; **895 tests passed, 2 skipped** (the standing two). New:
- `convocation.test.ts` (6): the default shape; four stages headless (pods, in-pod pairing, second pods by standings, every seat's deck after a draft, the carried record, no rematch, faces, the Umbel, titles, kept cards); save and resume after every transition; Sealed and Constructed stages; v1 → v2; the titles.
- The controller's full Convocation (door → draft → interlude reloaded → the list picker → the Umbel → champion → two kept cards → trophies).
- One pin updated: the save's format string is now v2 (by the brief).

No AI heuristic changed (no ladder run); no new card (no fuzz). About 330,000 sim games this session raised no engine error.

**Not verified:** a game of the Convocation played by hand (auto-won through the controller in the walk); the single 32-seat Draft and Open walked separately; the production build in a browser.

## Suggested next
**Chris plays a full Convocation.** Then, for the planner, the implementer's read of what remains of the Convocation plan:
- **The worker for a hundred seats is done** (the field's series). The stage start's headless drafts could join it (Concern 6).
- **The campaign linkage's hooks, as they stand:**
  - The ledger (`shandalar-convocation-ledger`) holds every finish with its title, decks and kept cards.
  - `keptCards` is the collection's future input.
  - The trophy room is the shape a linkage page would read.
  - What's missing is the write into the journey's collection and any entry cost or prize from the world. Both are one-way, from the ledger into the world save, and the event never reads the world except for saved decks.
- **Field strength** (Concern 1) is the design question that most changes how the Convocation feels.
- **The pool:** blue's dominance in Sealed, and red.
- **The rating loop** (Concern 3): a lower prior for little-seen cards.

## How to run
```
pnpm viewer                                                    # /convocation — "The Convocation" is the door's first option
pnpm typecheck && pnpm test
pnpm convocation-sim --events 4 --seed 53 --shard i/4          # full 128-seat Convocations headless; then --report <shards>
pnpm sealed-sim --pools 200 --games 10 --seed 49 --vary 3       # the Sealed sim with ADR-154's varied pair
pnpm rating-ab --sealed a.json b.json --vary-b 3               # varied-pair decks against best-pair decks
pnpm rating:build <authored shards> --limited a,b,c --candidate <name>   # a rating candidate (then merge `limited` into card-rating.json)
pnpm draft-cards --pods 200 --games 4 --seed 56 [--rating x.json] --shard i/5   # the per-card draft study
npx vitest run packages/world/src/convocation.test.ts
```
