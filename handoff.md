# Handoff — after Session 48 (2026-10-02)

## State of the world
**A Sealed Convocation of eight can be played start to finish.** `/convocation` (a door on the main menu): six Classic packs from the Plane, the deck editor over the sealed pool, three Swiss rounds of best-of-three against seven AI seats built by the Limited builder, sideboarding between games, standings, a finish written to a ledger. The event saves under its own key and resumes after a reload, including mid-series; the campaign's save is never read or written. The card rating is at v1 (the Sealed sim's 20,000 games joined the lift term). S46, S47 and S48 are committed locally and **not pushed**. `pnpm typecheck`, `pnpm test` (825) and `pnpm build:web` pass.

## Done this session
- **Part 0 — rulings applied** (`docs/decision-updates/s48.md`): Rich's slots; the series ends at two wins and a 1–0–2 series is now a **draw**; game one's coin winner **chooses**; a spent tier **rolls down**; ADR-146 (the Manafleur and the Cinquefont on the power list — fourteen ids, thirty legends draft); R-101 amended.
- **Part 1 — the editor's source**: the editor is `components/DeckEditor.tsx` over a `DeckEditorHost` (the collection it draws from, the saved deck, the draft's verbs; the deck picker and the door picker optional). The world passes its own through `worldEditorHost`; the event passes its pool and its one deck. **Pinned**: the world's S37/S38 controller tests pass untouched; the world's editor walked in the browser (picker, Save deck, Cancel all present); `convocation-controller.test.ts` — an event's editor saves to the event, a world save in the same storage keeps its exact bytes.
- **Part 2 — the builder and the Sealed sim**: `buildLimitedDeck` (`world/limited-builder.ts`) — the pair by rated playables, a bomb-only splash with two fixers, the curve mended to five two-drops, four three-drops and thirteen creatures, seventeen lands (sixteen at a low curve) split by pips. `pnpm sealed-sim` — 200 pools, 20,000 games; the report and **the rating's v1** below. A 150-pool test: forty cards, legal, at least fifteen lands, no unfixed third colour, deterministic.
- **Part 3 — the event engine** (`world/event.ts`, pure state): `newSealedEvent`, `registerDeck`, `pairRound` (round one by seed, then Swiss with no rematch), `playSeriesHeadless` / `playFieldRound`, `standings` (3 / 1 / 0; opponents' match-win share), `advanceEvent`, `ledgerEntry`, `serializeEvent` (`convocation-event-v1`). The knob `convocationEntrance` and the resolver's `convocationSeat` are wired and all zeros. **Tests**: a full event headless with a heuristic in every seat (three rounds, twelve series, no rematch, the standings add up, the ledger's line, the same seed the same event); saved and resumed mid-round — the human's series one game in and a field series already recorded — ending as the uninterrupted event.
- **Part 4 — the four screens**, walked in the browser as the human with the dev concession (seed 48, a full three-round event): the pool and the build ("Register the deck"); the pairings ("Round 1. You are paired with Hesper Lune."); the series banner over `PlayMatch` (game N of 3, the record, play or draw) with the play/draw choice and the sideboard editor between games; the standings ("The table after round 1."); the prize ("You finish first of eight. The Umbel is yours."), a card kept, the ledger's line on the door. A reload mid-series resumed at one game played. No console errors.
- **Part 5 — text**: the brief's lines, verbatim, on the door, the pairings, the standings and the finish.

## The Sealed sim — what it found

200 pools, each deck against twenty others, ten games a pairing, master both.

| | decks built from v0 | decks built from v1 |
|---|---|---|
| the builder's checks (under forty; under fifteen lands; an unfixed third colour) | 0 / 0 / 0 | 0 / 0 / 0 |
| splashing | 90 of 200 | 59 of 200 |
| a colour's share of decks (even = 40%) | W 49 · U 35 · **B 73** · **R 6** · G 38 | W 52 · U 36 · **B 65** · **R 10** · G 39 |
| the commonest pairs | WB 26% · UB 23% · BG 21% | WB 25% · UB 20% · BG 18% |
| deck win rates: 10th percentile / median / 90th | 38 / 51 / 63% | 39 / 49 / 62% |
| a deck's mean rating against its win rate | r = 0.43 | r = 0.35 |
| curve (cards at 1 / 2 / 3 / 4 / 5 / 6+); creatures | 3.7 / 6.1 / 5.4 / 5.6 / 1.5 / 0.9; 14.6 | 3.5 / 5.8 / 5.6 / 5.8 / 1.5 / 0.9; 15.0 |

Games average 19.5 turns; 8–9% end by decking; under ten of 20,000 are drawn.

**The pairs under v1, and how each fared**: WB 49 pools, 52% · UB 40, 51% · BG 35, 47% · WG 28, 50% · WU 21, 57% · UG 8, 54% · RG 6, 41% · WR 6, 38% · BR 5, 39% · UR 2, 42%.

**The twenty that moved most from v0 to v1** (the planner reads these):

| card | tier | v0 | v1 | change | sealed seen | sealed lift |
|---|---|---|---|---|---|---|
| Waste Not | 2 | 1.38 | 0.72 | −0.65 | 4708 | −4.0 |
| Entomb | 2 | 1.26 | 0.67 | −0.60 | 1984 | −4.8 |
| Cathartic Adept | 1 | 1.22 | 0.69 | −0.53 | 2591 | −2.9 |
| Gravitational Shift | 2 | 1.86 | 1.35 | −0.51 | 4187 | −2.7 |
| Buried Alive | 2 | 1.23 | 0.78 | −0.45 | 2370 | −3.9 |
| Darksteel Myr | 1 | 1.00 | 0.56 | −0.44 | 1061 | −3.5 |
| Drana, Kalastria Bloodchief | legend | 3.31 | 3.65 | +0.35 | 620 | +7.4 |
| Angelic Destiny | 3 | 2.23 | 2.57 | +0.34 | 5292 | +3.1 |
| Birds of Paradise | 2 | 1.47 | 1.80 | +0.33 | 3621 | +2.3 |
| Rampaging Baloths | 3 | 2.70 | 3.02 | +0.32 | 3973 | +4.5 |
| Tendrils of Corruption | 2 | 1.95 | 1.65 | −0.31 | 6271 | −0.8 |
| Gladecover Scout | 1 | 1.28 | 0.97 | −0.30 | 2579 | −2.1 |
| Zombify | 2 | 1.74 | 1.45 | −0.30 | 6497 | −0.5 |
| Indulgent Aristocrat | 1 | 1.62 | 1.34 | −0.28 | 8046 | +0.0 |
| Wrath of God | 3 | 2.47 | 2.20 | −0.27 | 3918 | +0.0 |
| Gaean Wurm | 2 | 2.36 | 2.10 | −0.26 | 4757 | +1.4 |
| Mind Stone | 1 | 1.33 | 1.09 | −0.24 | 7636 | −1.6 |
| Angel of the Ruins | 3 | 1.46 | 1.68 | +0.22 | 3747 | +0.4 |
| Bonesplitter | 1 | 1.12 | 0.90 | −0.22 | 1134 | −3.5 |
| Tainted Phoenix | R | 2.81 | 2.59 | −0.22 | 308 | −2.8 |

The direction is right: cards that need a deck built around them (Entomb, Buried Alive, Zombify, Cathartic Adept, Waste Not, the Aristocrat) fall; cards that are good on their own (Drana, the Baloths, Angelic Destiny, Birds) rise. `pnpm rating:view --compare data/convocation/card-rating-v0.json` shows every card's change.

## After the handoff (2026-10-02, Chris)

- **Concern 3 fixed**: `recordCutting` keeps what the profile already holds — a Manafleur victory after the flood no longer drops `floodSurvived` (replaying phase one never costs phase two's credit). Nothing reads the flag yet (it is phase three's), so no player lost anything visible; the chronicle's entries were never affected. One test.
- **The menu**: the journey and the Convocation are the top two doors, the single match and the gallery the next two; the replay viewer and (dev) the lab are a quiet row of links beneath. Deviation 9's missing plate is made: three candidates (`docs/art/subjects/menu-convocation-{a,b,c}.md`); **a** — the round hall from above — is installed pending Chris's verdict.

## Deviations from the brief
1. **The editor's source object is wider than the brief's shape** — a host carrying the source (`collection`, `savedDeck`, `activeDeckName`), the draft and its verbs; the world's adapter passes its controller's editor methods through unchanged rather than re-implementing them over `save(decks)`. The world's editor logic was not moved, so its pins could not break. *Rule on*: nothing, unless the planner wants the world's editor logic itself lifted out.
2. **The Lab's worker was not timed; the field runs on the main thread.** Measured in the browser (dev build): the field's three series took **1.6 s in round one (cold) and 0.2–0.3 s in rounds two and three**, behind an "other tables finish their matches" screen. For eight seats that is enough and avoids the worker's lifetime question. *Rule on*: nothing now; sixteen seats (seven series) is about twice this and still fine; a hundred needs the worker and its timing.
3. **The ledger is its own storage key**, not a field of the campaign's profile object (ADR-147 says "the profile's `convocation` record"). The profile's writers rebuild that object field by field (`migrateLegacy`, `recordCutting`) and would silently drop an unknown field. The ledger is per-browser, beside the profile; a linkage reads it the same way. *Rule on*: whether to move it inside the profile object once those writers are fixed.
4. **The v1 blend is the implementer's** — the brief says "at the brief's weights" and names none. The Sealed sim's sightings are pooled with the authored lists' into the one lift term; presence is unchanged; half and half as before.
5. **The AI does not sideboard** (the brief allowed "or none this session — say which"). The player can.
6. **"Suggest a deck"** on the build screen fills the draft with the builder's deck — not in the brief; it made the browser walk possible without hand-building, and it is a fair convenience. Say if it should go.
7. **`poolIsCap`** — a new `DeckRule` field so a sealed deck may run five of a common; `addCopy` takes a cap.
8. **The splash rule is stricter than the brief's sketch** — the brief asks two fixers; with Evolving Wilds at tier 1 that alone let 80% of decks splash. It is now also bombs only (rated 2.0+, 0.75 over the card replaced, one pip, at most two cards): 45% of decks under v0, 30% under v1.
9. **No Convocation door plate** — the menu's door is text only (the other four have art). The names of the field are twelve placeholders, as the brief marks.

## Concerns
1. **The builder plays black two times in three and red one time in ten — and red loses when it is played.** The rating carried the authored lists' colour skew into Sealed (the mono-black slice was the rating run's best list; the red lists its worst). v1 moved it a little (black 73 → 65%, red 6 → 10%). But the red pairs' decks win 38–42% (on only 19 decks), so this may not be the rating alone: red's cards in this pool may be weak in forty-card games under this pilot — burn the heuristic aims at faces, small creatures outclassed by turn five. I cannot separate those from this data. It matters for the field: seven AI seats will mostly be W/B/U/G, and a player who reads that can draft… nothing yet, but will in S50.
2. **The update did not make the rating a better predictor.** A deck's mean rating against its win rate went from r = 0.43 (v0 decks) to 0.35 (v1 decks). The two runs are different decks, so they are not a clean comparison, but v1 is not shown to be better — only less wrong on the synergy cards. The honest read: the lift term is noisy, and one round of updating on decks the rating itself built is partly circular (a card the builder never plays gets no new evidence). A fix worth scoping: build a share of sim decks with rating noise, so under-rated cards get played.
3. **`recordCutting` drops `floodSurvived`** (`world/corolla.ts`): it returns a new profile object without the flag, so a player who beat the flood's capstone and then wins a Manafleur run loses the flag. Found while reading the profile's writers for the ledger; not touched (campaign code, outside the brief). Flagged as a separate task.
4. **The legality panel says the same thing twice** in a short sealed deck: "deck has 0 cards; the floor is 30" and "0 cards; Sealed asks 40". The base floor should stand down when a rule asks more; left alone because the Open's editor has shown both since S46 and a test may pin the text.
5. **The tiebreak's one-third floor is from memory** of the tournament rules, not verified (they are not the Comprehensive Rules). It only matters for ordering tied seats.
6. **A game abandoned mid-play restarts from its seed** — the same opening hand. A player who dislikes a hand can reload for the same hand, not a new one, so there is nothing to exploit; but a reload during a lost game replays it. The campaign has the same property.
7. **The builder's suggestion for seed 48's pool averaged 3.39 mana value** — heavier than the field's 2.97 mean. The six-drop cap holds the top end; nothing caps the four- and five-drops together. Worth a look when the builder is next touched.
8. **Under four three-drops in 4–5 of 200 decks, under thirteen creatures in 1** — the pool did not have them in the pair; the mend does not change the pair to find them.

## Registry entries added/changed
- **R-101** amended — the S48 rulings (two wins; a drawn series without a majority; the coin's winner chooses; the tiebreak and its unverified floor).
- **Knobs**: `convocationEntrance` (new; `docs/knobs.md` regenerated).
- Pool registry: no rows changed (no cards this session).

## Test status
`pnpm test`: 87 files passed, 1 skipped; **825 tests passed, 2 skipped** (the standing two). New: `event.test.ts` (6 — the builder over 150 pools; the field; registration; the full event; save and resume; the ladder), `convocation-controller.test.ts` (4 — the event's editor and the world's bytes; the pool as the cap; the series over the match with a reload; the finish and the ledger). Amended: `series.test.ts` (the 1–0–2 draw; the coin's chooser), `packs.test.ts` (fourteen power ids; the roll-down). No fuzz — no new card entered a deck; the Sealed sim's 40,000 games over built decks raised no engine error.

One false alarm: the world generator's 200-seed fuzz timed out during a full run while six sim processes were going; it passes alone and in the clean full run above.

Not verified: the Lab worker's rate; the production build in a browser (the walk was the dev server); a full event played by hand without the dev concession; the editor's world side beyond rendering and its existing controller tests.

## Suggested next
**S49 — the series and standings at sixteen seats, and the drafter's data.** Estimate: **one session.**
- Sixteen seats, five rounds: the engine already takes `seats` and `rounds`; byes are written but untested (no odd field yet). A Top-8 bracket is new (single elimination over `MatchSeries`).
- The AI's sideboarding (shape-keyed), and the human's play/draw screen are small.
- The tiebreak verified against the tournament rules.
- The drafter's data: a pick-order view of the rating, a colour-commitment term, and a `pnpm draft-sim` that reports how many seats fight over black — which, from Concern 1, will be most of them. I would fix the colour skew first: a rating-noise option in the Sealed sim, one more update, and a check that red's share rises without its win rate falling further.
- A door plate for the menu, and the field's real names, are Chris's and the planner's.

## How to run
```
pnpm viewer                    # then /convocation — or the menu's "The Convocation"
pnpm sealed-sim --pools 200 --games 10 --shard 0/6    # six shards → analysis/runs (local)
pnpm sealed-sim --report                               # the builder's checks, pairs, curve, win rates
pnpm rating:build --sealed                             # v1 → data/convocation/card-rating.json
pnpm rating:view --compare data/convocation/card-rating-v0.json   # the page, with each card's change
npx vitest run packages/world/src/event.test.ts packages/ui/src/convocation
pnpm typecheck && pnpm test
```
In the browser console, `__cc` is the controller: `__cc.newEvent(48); __cc.suggestDeck(); __cc.register(); __cc.playMatch(); __cc.match.autoWin()`.
