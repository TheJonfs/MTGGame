# The Convocation — the build plan (S47)

*Implementer, 2026-10-01. The S47 brief's Part 1: a build order with estimates for the overview's seven pieces, in the staged order. Grounded in a survey of the code as it stands after S47 (the series, the packs and the rating exist; nothing has a screen yet). An estimate is in implementer sessions of the S44–S46 size. ADR-145 is the architecture this follows.*

## What S47 left standing

| piece | where | state |
|---|---|---|
| the series | `world/series.ts` — `MatchSeries` (the state machine), `runSeries` (headless over `runMatch`) | built, tested headless |
| sets and recipes | `data/convocation/{sets,recipes}.json`, `world/packs.ts`, `pnpm booster`, `pnpm sealed-pool` | built, validated; the legends at tier R, the power out |
| the card rating | `data/convocation/card-rating.json`, `world/rating.ts`, `pnpm rating:run` / `rating:build` / `rating:view` (a standalone page) | v0, measured |
| every authored list | `world/authored-lists.ts` (112 lists) | built — the Constructed builder's library |
| the Open | `world/formats.ts` (`OPEN_FORMAT`), `sim/open-decks.ts` | S46 |

## The overview's six questions

1. **Where does a match series live?** A wrapper, built: `MatchSeries` holds the record, the chooser and the game seeds and knows nothing of how a game is played. Headless it drives `runMatch`; in the UI it drives one `MatchController` per game (the controller builds its `Game` in the constructor and memoizes `start()`, so a second game is a second controller — the world's `startX → match.start().then(finishX)` pattern one level up). The single match needs no change.
2. **Can the Lab's pool run the background field while the human plays?** Yes for the engine, with one risk. A sixteen-seat round is seven other best-of-threes (~18 games); the rating run measured **~125 games/s across six Node processes (~20 a process)** on mixed lists (33,600 games in four and a half minutes), so a sixteen-seat round is about a second on one thread and a hundred-seat round (~125 games) a second or two across a pool. **The browser's rate is not measured**: the S46 read quoted ~7.5 games/s on six workers and cited implementer-notes, but no such figure is in the notes — treat it as unverified, and time the worker in S48 before sizing the field. The risk is the workers' lifetime, not the throughput (see Risks).
3. **What does the AI builder need?** A rating (v0 exists), a **curve target per deck size** (40: sixteen-seventeen creatures-and-spells by mana value 1–2 / 3 / 4 / 5+ ≈ 7 / 6 / 5 / 4, seventeen lands), a **colour choice by rated playables** (the two colours whose best N playables sum highest), and **lands by pips** (the salvage assembler's rule, kept). No synergy table in the first version: the rating's lift term already carries some of it, and the Lab's stats are the check. A synergy term is the builder's v1, after Sealed plays.
4. **What does a Format carry?** One object the editor, the Lab, the builder and the ladder read:
   ```ts
   type Format =
     | { id; name; note; kind: "constructed"; rule: DeckRule }                       // today's
     | { id; name; note; kind: "limited"; set: string; recipe: string; packs: number;  // a set and recipe id from data/convocation
         shape: "sealed" | "draft"; rule: DeckRule /* minCards 40; the copy cap is the pool */ };
   ```
   The pool filter is the set for Limited and the `rule.banned`/`restricted` lists (plus a future `maxTier`) for Constructed. The editor already takes a `Format`; `checkDeck` already takes a collection — a Limited deck is checked against the sealed pool as its collection.
5. **What does the save hold, and can an event resume?** Its own key, `convocation-event-v1` (below). Resumable at every boundary: between rounds, between games of a series (the `MatchSeries` constructor takes the games played), and — because every game is a seed — a game in progress is replayed from its seed rather than saved mid-stack (the campaign's rule).
6. **The draw rule.** Built in `series.ts`: a game with no winner (the engine's `MAX_TURNS`, or `DRAW` — both players losing at once, CR 104.4a) is a drawn game; a series ends at a majority or after N games, the seat with more wins takes it, level wins are a drawn series; standings score 3 / 1 / 0.

## The stages

### Stage 1 (S48) — Sealed, a single event · **BUILT (S48)** — see handoff.md for what it found
Six Classic packs from the Plane, the AI builder, seven AI seats, three Swiss rounds at a flat entrance, a prize screen.

- **New code (world, pure):** `limited-builder.ts` — `buildLimitedDeck(pool: string[], rating, cards) → Decklist` (colours by rated playables, curve fill, lands by pips); `event.ts` — `ConvocationEvent` (the state below), `startEvent`, `pairRound` (round one random by seed, then by record), `recordSeries`, `standings`; `Format` grows `kind: "limited"`.
- **New code (ui):** `convocation/ConvocationApp.tsx` (the mode's shell, beside `WorldApp` / `LabApp` in `App.tsx`), `convocation-controller.ts` (owns the event, the save, the series, the pool worker), and four screens: **the pool and the build** (the deck editor with a pool source — see Risks: the editor reads `world.player.collection` and writes `world.decks`; it needs a `{collection, decks, onSave}` source object rather than the world), **the pairings and standings**, **the match** (`PlayMatch` unchanged, a series banner over it; a between-games screen that is "next game" only — no sideboarding yet), **the prize**.
- **Reused as is:** `PlayMatch` and `MatchController`; the legality panel; `resolveMatchup` with one new branch; the Lab worker for the other seats' series.
- **Knobs:** `convocationEntrance` (a `Record<round, {life, basics}>`; stage 1 fills three flat rows), `convocationFieldGames` (1 = a real best-of-three per background pairing).
- **Tests:** the builder (legal, forty, two colours, a curve inside bounds, deterministic by seed) over 200 seeded pools; Swiss pairing (no rematch in three rounds of eight; a bye never needed at eight); an event headless end to end (eight seats, three rounds, standings sum to the points played); save → load → continue equals an uninterrupted run.
- **The Lab measures:** the builder's decks against each other and against the yardsticks (`pnpm sealed-sim`: N pools → N decks → a round-robin — the deck's floor is what the entrance compensates); land counts and colour splits by pool; how often a pool has no two-colour deck of 23 playables.

### Stage 2 — series and standings generalised; sixteen seats · **BUILT (S49)** — sixteen seats, five rounds, byes, the Top 8, the AI's sideboarding, the tiebreaks verified
- Sideboarding: the human's screen in the `betweenGames` hook (the editor against pool-minus-deck); the AI's is "unused playables" plus a few shape-keyed rules (more removal against a creature-heavy list; counters out against aggro) — keyed on the opponent's *shape*, never a card id.
- Swiss to N rounds with tiebreaks (opponents' match-win percentage, then game-win percentage — the tournament rules' order, which are not the Comprehensive Rules; **to be verified at build**), byes for odd fields, a Top-8 single-elimination bracket.
- Play/draw: the human's choice screen (the AI always plays).
- **Tests:** tiebreak arithmetic against a hand-worked table; a sixteen-seat, five-round event headless; a bracket.
- **The Lab measures:** the field's record distribution by entrance row; how often a drawn series occurs.

### Stage 3 — the drafter · **1 session** (the data is built — S49: `world/drafter.ts`, `pnpm draft-sim`)

**The pick rule (S49 Part 3; `DRAFT_TERMS`).** A card's worth to a seat at pick *n* (1–45 across the three packs) is its rating plus:
- **Colour commitment.** Picks 1–3: the rating alone. From pick 4: a bonus of `0.1 × (n − 3)` (capped at 1.2) to a card castable in the seat's two colours with the most rated picks so far (a gold card counts to each of its colours; a colourless card is castable). Until pick 8 a card that needs the seat's *third* colour draws half the bonus; at pick 8 that is cut. A land earns the bonus when it taps for two of the seat's colours and loses it when it taps outside them.
- **The curve.** From pick 20: a two-drop (mana value ≤ 2) in the seat's colours earns +0.3 while the seat holds fewer than five.
- What the first run shows (50 pods): a seat's colours last change at pick 4.9 on average and 88% are settled by pick 8 — the bonus locks a seat the moment it starts. If later reading wants seats to stay open longer, the lever is the bonus's slope before the cut, not the cut.

- `drafter.ts`: pick = rating + a colour-commitment bonus (grows with picks made in the colour) + a curve term; eight seats, three packs, pass left/right/left; the human's pick screen (a pack, the picks so far, the timerless pass).
- **Tests:** a draft is deterministic by seed; every seat ends with 45 cards; the AI's colours settle by pick ~8 in most seats.
- **The Lab measures:** the drafted decks against Sealed decks from the same set (the drafter should beat the builder alone); colour over- and under-drafting across 200 drafts — the first read of whether a set is draftable.

### Stage 4 — Constructed by select-and-repair · **1 session**
- `constructed-builder.ts` over `authoredLists()`: choose the lists that fit the format (`checkDeck` passes or nearly), cut what the rule forbids, fill by rating within colour, noise (same-role swaps, a land ±1) so five seats on one archetype are five variations. Formats past the Open: the tier formats (`maxTier` on the rule), the gate formats (rules that exist).
- **Tests:** every built deck is legal in its format; noise is seeded; no two seats in a field share a list exactly.
- **The Lab measures:** each format's metagame (the S46 round-robin, per format) before it is offered.

### Stage 5 — the full ladder · **1–2 sessions**
- Mixed stages in one event (Limited rounds, then Constructed, the second draft), `convocationEntrance` filled for sixteen rounds and the Top 8, prizes by finish, the field's names and faces, a hundred-seat field (the background rounds batched across the pool).
- **Tests:** a full event headless; resumability at each stage boundary; the entrance never applied to the human seat.
- **The Lab measures:** the human-proxy's finish distribution by AI profile — the mode's difficulty curve.

**Total: 5–6½ sessions after S47** (S48–S53).

## The save key — `convocation-event-v1`

```ts
interface ConvocationEventSave {
  version: 1;
  seed: number;                       // everything derives from it: packs, pairings, series seeds
  format: { stages: { formatId: string; rounds: number }[] };   // S48: one Sealed stage of three rounds
  stage: number; round: number;       // where the event stands
  phase: "build" | "pairings" | "series" | "between-games" | "standings" | "prize" | "over";
  field: {                            // seat 0 is the human
    name: string; face?: string;      // a portrait slug (the mages' and beasts' art is the first pool of faces)
    pool?: string[];                  // Limited: the cards opened
    deck: Decklist; sideboard: Decklist;
    list?: string;                    // Constructed: the authored list it was built from
    points: number; wins: number; losses: number; draws: number; gameWins: number; gamesPlayed: number;
    opponents: number[];              // for the pairing's no-rematch rule and the tiebreaks
  }[];
  pairings: [number, number | null][];           // this round's; null = a bye
  results: { round: number; a: number; b: number; series: SeriesState }[];  // every series, game seeds and outcomes
  current?: SeriesState;              // the human's series in progress (games played; the next is replayed from its seed)
  prize?: { place: number; claimed: boolean };
}
```

- **Its own localStorage key** (`shandalar-convocation`), beside `shandalar-world-save` and `shandalar-legacy`; the campaign's save is never read or written by the mode. The world's `serialize`/`deserialize` pattern (a version field, optional fields for growth, a load that refuses a newer version) is copied, not shared.
- **Size:** eight seats × (90-card pool + deck) + 12 series ≈ 15 KB; a hundred seats without pools (Constructed) ≈ 60 KB. Fine for localStorage.
- **Resuming:** `phase` names the screen; `current` rebuilds the `MatchSeries`. A game abandoned mid-play restarts from its seed (the same opening hands — the campaign's behaviour on reload).

**What the world's UI lends:** `PlayMatch` + `MatchController` (whole); the deck editor and the legality panel (with the source object); the Lab's worker pool and deck stats; the rail's portrait and life header; the parley screen's two-column layout for the pairings; the Chronicle page's table style for the standings. New: the pool view (a pack-sorted grid), the standings table's logic, the prize screen.

## Risks

1. **The workers' lifetime inside the mode's screens.** `LabWorkerPool` is owned by `LabApp` and disposed with it; workers are terminated on dispose and a terminated job is lost. The Convocation controller must own its own pool for the life of the event and treat a background round as **resumable work**: each pairing's series is a pure function of its seed, so a lost job is re-run, and the save records only finished series. The cheap alternative for eight seats — run the three other series (~8 games) on the main thread at the round's end, under half a second in Node and not yet timed in the browser — avoids workers altogether and is what I would ship in S48; the pool comes in at sixteen seats or a hundred.
2. **The card rating.** v0 is coarse in known ways (below). The builder should be tested for *sanity* (plays its bombs, does not play Disenchant main), not for strength; the Lab's Sealed sim is the correction loop, and the table is designed for updates (`seen`, `lists` and the raw terms are stored beside the rating).
3. **The draw rule.** Built, but two calls are interim: a series is capped at N games (paper Magic plays on until time is called, so a 1–0–2 series there is also a win, but a 0–0–3 never happens in three games); and game one's coin picks the starting player outright (CR 103.1 has the coin's winner *choose*; the series reads that as choosing to play, so the human never gets a game-one play/draw choice until a screen offers one). The loser's choice and the same seat choosing again after a drawn game are CR 103.1, verified.
4. **The editor's source.** The editor's spares read `world.player.collection` and its save writes `world.decks`. Extracting a source object is a refactor of a large component inside S48; it is the part of S48 most likely to overrun.
5. **Small tiers.** Tier 3 is nineteen cards in the Plane (eleven in the First Bloom) and the pair sets hold seven or eight; a pod's rare slots will repeat. Tier R is 67 with the legends in (32 of them). Packs avoid duplicates within a pack only (ruled, S47). Whether tier 3 wants more cards is a pool question for after Sealed plays.
6. **Lopsided authored lists as a library.** The 112 lists span thirty to sixty cards; the Constructed builder must select by format size, not treat them as one field.

## What the rating is, and is not (v0)

`rating = prior(tier) + 0.5 × ½(presence′/σP + lift′/σL)` — see `data/convocation/card-rating-report.md`.

- **Presence** (a list's win rate against the field, spread over its cards) is list-confounded: Forgotten Cave is the pool's lowest card because the lists that play it lose. A card in one list inherits that list.
- **Lift** (the pilot's result when the card was seen, less the list's own rate) is the within-list term and the better one, but it leans to cards seen in long games and is noisy below a few hundred sightings — hence the shrinkage.
- **The field is uneven**: thirty-card beasts and sixty-card Open lists in one pool; mill reads strong against thirty-card decks (the Undertow is 66% here and 38% in the Open).
- **Two cards are in no list** (Airship Crash, Darksteel Myr) and read their prior. Prize cards read R's prior (2.5).
- **The update path** (Chris, S47 kickoff): each row keeps its sample (`seen`, `lists`) beside the raw terms, so a later playtest process can treat v0 as a prior and update it — the Sealed sim's per-card lift from built decks is the natural first evidence, and it is free of the authored lists' confound.
