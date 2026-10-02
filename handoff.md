# Handoff — after Session 51 (2026-10-04)

## State of the world
**The Convocation can be drafted.** `/convocation` now opens on a Draft event: a pod of eight, three Classic packs picked and passed left-right-left against seven AI seats on the pick rule, the human's forty-five picks becoming the pool, then the existing build → five rounds → the Umbel. The two Sealed events remain beside it. The draft saves and resumes mid-pick. The card rating was rebuilt from post-fix games only and **adopted** (v1.1 — the brief's v1′); a pooling bug in the rating builder was found and fixed on the way, and it invalidates one thing reported in S49 (below). The campaign's three baselines were re-run after books 88–92. S46–S51 are committed locally and **not pushed**. `pnpm typecheck`, `pnpm test` (865) and `pnpm build:web` pass.

## Done this session
- **Part 0 — rulings applied** (`docs/decision-updates/s51.md`): ADR-150 (post-fix evidence only; Sealed runs carry `pilotVersion`; the older runs archived); the commitment slope; the campaign re-baselined.
- **Part 1 — the draft**:
  - *Engine* (`world/event.ts`): `newDraftEvent`, `draftStep` (the human's pick, the seven AI picks, the pass; the next pack; at the end the picks are the pools and the AI decks are built), `draftPack`, `draftDirection`, `suggestedPick`. The draft is `event.draft` while `phase === "draft"`; after it the event is an ordinary one at the build.
  - *Screen*: the pack in hand (cards shown larger than the editor's grid), "Pick {n} of 45 — pack {p}.", "The pack goes left." / "right.", the picks so far by colour, hover to inspect, one click to take — no take-backs. The build's banner reads "Forty-five picks. Build from them."
  - *The door*: "A Convocation — Draft, eight seats: three packs, five rounds, the Umbel." (the default), and the two Sealed events.
  - **Walked in the browser** (dev build): a card taken by click, the pass line, a reload at pick 22 resuming at pick 22 with 21 picks, the draft finished, the build over the 45 picks, five rounds and the Umbel won with the dev concession — "first of eight", the ledger's line `draft-plane`. The field's four series a round took 0.2–0.5 s. No console errors.
- **Part 2 — measured**: tables below. A headless draft event end to end (the pod drafts, eight decks, five rounds with no rematch, the Umbel), saved and resumed mid-draft (pick 21) and mid-round, ending as the uninterrupted event.
- **Part 3 — text**: the brief's lines, verbatim.

## A correction to S49: the "v2 candidate" was wrong, and why
`pnpm rating:build` pooled several Sealed runs by deck name, and every run names its decks `pool:0 … pool:199`. Two runs' decks therefore shared one win record, so each deck was measured against the average of two unrelated decks and the lift came out meaningless. **v0 and v1 were single-run builds and are unaffected.** The S49 "v2 candidate" (and S50's `--also` candidate) pooled two or three runs and were wrong. So S49's statement that "the update's movers are mostly red cards going down" was an artefact of this bug, not evidence. The forced-pair experiment — the thing S49's conclusion rested on — never went through the rating builder and stands. The candidate files are deleted; the builder now keeps each run's deck records apart.

I found it because the first v1′ again marked red down hard while the same cards' lifts, computed run by run, were near zero or positive.

## The rating — v1.1 (v1′), adopted
The authored presence term (unchanged) + the lift from S50's 20,000 games and a fresh noise run (20,000 games, σ 0.4 on a third of the decks), both played on pilot 92. v1 is kept as `card-rating-v1.json`.

**The brief's test**: red's share of Sealed decks rises without red's win rate falling.

| | v1 (S50's run) | v1.1 |
|---|---|---|
| red's share of Sealed decks | 22% | **27%** |
| red pairs chosen | 44 of 200 | 54 of 200 |
| red pairs' win rate (weighted) | 42% | **46%** |
| a colour's share | W 45 · U 33 · B 56 · R 22 · G 45 | W 45 · U 30 · B 56 · R 27 · G 43 |

Passed; v1.1 is the live table. The six new cards now have measured ratings: Flametongue Kavu 2.41 (prior 1.5), Shocking Sharpshooter 1.52 (1.0), Seasoned Pyromancer 2.05 (2.0), Furnace Whelp 1.45 (1.5), Rage Cobra 1.34 (1.5), Dragon Fodder 0.87 (1.0).

**The twenty that moved most (v1 → v1.1)**: Entomb +0.61 · Waste Not +0.57 · Cathartic Adept +0.39 · Titania −0.27 · Bonesplitter +0.26 · Gladecover Scout +0.25 · Goblin Chieftain −0.22 · Guttersnipe −0.21 · Aven Fisher −0.19 · Tidewall −0.19 · Putrefy −0.18 · Goblin Grenade −0.17 · Blanchwood Armor −0.17 · Reya Dawnbringer +0.16 · Voracious Cobra −0.16 · Arcanis +0.15 · Altar of Dementia −0.15 · Phyrexian Purge −0.14 · Cunning Tactician −0.13 · Mother Bear −0.13. (See Concern 2 on the first three.)

## The draft sim — 50 pods at v1.1 with the slope

| | S50 | S51 |
|---|---|---|
| seats per colour | W 42 · U 37 · B 47 · R 33 · G 42 | W 41 · U 38 · B 48 · R 32 · G 42 |
| a colour's seats win | W 52 · U 55 · B 48 · R 45 · G 50 | W 54 · U 53 · B 46 · **R 47** · G 51 |
| pods with four or more seats on black | 27 of 50 | 29 of 50 |
| seats whose colours change after pick 8 | 16% | **23%** (the target: 20–30%) |
| a seat's colours last change at pick | 5.6 | 6.5 |
| the pod's spread (best − worst seat) | 50 points | 48 |

**The field's pick quality — the check failed.** Drafted decks against Sealed decks at the same seeds (3,200 games): **the drafted decks win 46%**. Their mean card rating is 1.57 against the Sealed decks' 1.77. The brief expected the drafter to build the better deck; it does not. A Sealed seat chooses 23 cards from 90 uncontested; a draft seat ends with 45, taken one at a time against seven others — and half the pods have four seats fighting over black.

## The campaign's new baselines (after books 88–92; `results/s51/`, local)
- **`mage-sweep --part 5`, Standard** (tier-2 and tier-3 mages against the five starters, 50 cells): the mages win **72.8%** on average, +1.8 against the S35 baseline the sweep compares to. One mage moved: **Kessa Emberhand +9** (70% — her Lightning Bolts are removal now); the rest are within about ±5 (Magister Quill +5, Varro +3, Sorrel +3, Pell −3).
- **`flood-sim --refs postlairs`** (30 cells): the seats win 60.6% on average against 61.8% at S45. The largest moves are against the stronger reference deck: Emberford 49 → 41, the Tallyflame Court 21 → 13.
- **`heart-sim --tide 1`** at 50 life: the Manafleur's kill rate against the stock references is 92%, as at S45.

## Deviations from the brief
1. **"Full slope 0.50 → 0.35" is read as the bonus at the cut**: 0.10 → 0.07 a pick (and 0.035 a pick before the cut). The share landed at 23%, inside the target, so the cut stays at pick 8.
2. **The field's pick-quality check failed** (46%) and nothing was changed in response — the brief asks for the measure, not a fix. *Rule on*: whether the drafter wants work before S52, or whether a weaker draft field is acceptable.
3. **The S49 candidate files were deleted** (`card-rating-v2-candidate.*`) — they were wrong (the pooling bug).
4. **S50's Sealed run was stamped `pilotVersion: 92` after the fact** so it could be pooled under ADR-150; it was played after books 88–92 were in.
5. **A draft of eight puts every seat in the Umbel** — the brief's event; the Swiss rounds decide only the seeding.
6. **The sweep's part five is compared with its S35 baseline** (the only one the sweep carries); there is no S45 part-five run to compare with.
7. **No rating-builder test** for the pooling fix: the builder reads local run files. The fix is described here and in the notes; a small fixture-driven test would be worth an hour.

## Concerns
1. **The AI drafts worse than it builds Sealed.** 46% against Sealed decks, and a 48-point spread inside a pod. A human who drafts sensibly should beat this field more easily than the Sealed field — and Chris swept the Sealed field. The levers, in the order I would try them: (a) the colour fight (29 of 50 pods have four or more seats on black — a seat that read "black is being cut" would move; the pick rule cannot see what was passed); (b) the builder on 45 cards (it was tuned on 90 — with fewer playables its curve mends cost more); (c) the entrance (life is the mode's own lever for a weak field).
2. **ADR-150 threw away some true evidence.** The archived runs were the ones that said Entomb, Waste Not and Cathartic Adept are poor in Sealed; the builder now rarely plays them, so the post-fix runs hardly saw them (81 to 304 sightings) and they drift back up toward their authored-list numbers (+0.4 to +0.6). They are still low (1.1–1.3), but the next noise run should be watched for them.
3. **A pick is one click with no confirmation.** That is the brief, and a draft's rule; it is also an easy misclick on a fifteen-card grid. A two-step pick (select, then "take it") would cost one click a pick. Chris's playtest will say.
4. **The player sees nothing of what the table took.** As specified (a real draft). The picks pane is the player's only memory; there is no view of the pack as it was when first seen.
5. **The rating builder had a silent bug for two sessions.** Nothing failed; the numbers were simply wrong, and I reported them. The check that caught it was computing the same statistic a second way. The rating's pipeline has no tests; it should have at least one.
6. **Black is still over-drafted** (48% of seats, winning 46%) — S49's Concern 2, unchanged by the rebuilt rating.
7. **Kessa at +9 against the starters** is a tier-2 mage a new player meets early. The burn rule made her a better pilot; whether her row wants a point of life back is the planner's.

## Registry entries added/changed
- No R-numbers (no rules mechanics this session). Pool registry unchanged. Knobs unchanged.

## Test status
`pnpm test`: 89 files passed, 1 skipped; **865 tests passed, 2 skipped** (the standing two). New in `event.test.ts`: the pod and the first pick; three packs left-right-left to the build; the full draft event with both resumes. New in `convocation-controller.test.ts`: the draft through the controller (the view, a refused pick, the pass, a reload mid-draft, the build over the picks, the event after). Amended: the pick rule's slope values.

No AI heuristic changed this session (the pick rule is the drafter's, in the world package), so no ladder run. No fuzz — no new card. Over 60,000 sim games raised no engine error.

Not verified: a draft made by hand, pick by pick, in the browser (one real click, the rest through the controller); the production build in a browser; the campaign's lord, guardian and petal sims (the brief named three; these were not re-run).

## Suggested next
**S52 — Constructed by select-and-repair** against the Open's library. Estimate: **one session** for the builder (`authoredLists()` → the lists that fit a format → cut what the rule forbids → fill by rating within colour → seeded noise), a Constructed event (the player brings a saved deck or builds one in the editor against the format's rule; the build screen is the editor with the world's collection or an open pool — a question for the brief), and the Open's metagame through the event's field.

Before or beside it, if the planner agrees: one pass at the draft field's strength (Concern 1) — a "what is being cut" term for the pick rule is small and measurable with `pnpm draft-sim --vs-sealed`.

## How to run
```
pnpm viewer                                   # /convocation — the Draft is the default event
pnpm sealed-sim --pools 200 --games 10 --seed 5101 --noise 0.4 --shard 0/6 --out analysis/runs/noise51_shard0.json   # ×6
pnpm rating:build --prefixes sealed50,noise51 --candidate v1p --version 1.1     # exact runs, one pilot; writes card-rating-v1p.json
pnpm draft-sim --pods 50 --vs-sealed           # the colour table, the commitment share, drafted against Sealed
pnpm rating:view --compare data/convocation/card-rating-v1.json
npx vitest run packages/world/src/event.test.ts packages/ui/src/convocation
pnpm typecheck && pnpm test
```
In the browser console: `__cc.newEvent(51, { draft: true }); while (__cc.screen.kind === "draft") __cc.pickCard(__cc.suggestedPick())`.
