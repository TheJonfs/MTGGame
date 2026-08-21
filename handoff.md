# Handoff — after Session 15 (2026-08-21)

## State of the world

**The tutor half-session is delivered.** Two manifest amendments are real code: `searchLibrary` is a find-may-fail search (predicate basicLand | anyCard, destination battlefield(+entersTapped) | hand) whose chooser sees the matching library cards in the request payload and may take one or decline — **with a shuffle after every search through the logged RNG** (R-044); and mana abilities may carry a colour choice (R-045) — **Black Lotus** offers five deliberate colour actions, no stack, never auto-paid. Three cards encoded and Scryfall re-verified (**Rampant Growth**, **Demonic Tutor**, **Black Lotus** — LEA, Christopher Rush, `prizeOnly`), decks C and D swapped per ADR-068, the AI has a ranked tutor policy (book-of-shame 9), the play client has a card-grid search dialog and a colour picker, the world honours `prizeOnly` in shops and gained `shopRowCopies`. **Fuzz-before-fixtures clean**, fixtures green, **full gates re-run at 1,000/cell: PASS** (C's mirror moved +4, which triggered them). `decisions.md` is now append-only (planner process change) — ADR-067/068 appended here and the manifest amendments copied verbatim.

## Done this session

- **Part 0 — Docs:** `decisions-append-S15.md` appended to `decisions.md` (verified; ADR-058's amended wording intact for once); `mechanics-manifest.md` §3 gained a dated **Amendments** subsection with the planner's two amendment texts verbatim; `docs/knobs.md` regenerated (`shopRowCopies`).
- **Part 1.1 — `searchLibrary` resolver (R-044):** vocabulary `predicate: basicLand|anyCard`, `to: hand|battlefield`, `entersTapped`; `EffectContext.searchLibrary` (engine): matching library cards deduped by cardId (like R-029), `declineSearch` first (ADR-014 auto-takes it when nothing matches), `searchPick` moves via `moveObject` (tapped when asked; ETB triggers and landfall fire naturally), **shuffle always follows (CR 701.19) through `ctx.rng.shuffle` — logged, replay-covered**. New `RequestPurpose "searchLibrary"`, actions `searchPick`/`declineSearch`, the `EffectRequester` seam widened. Fixtures (`s15-scenarios.test.ts`): Growth basic→battlefield tapped (tapped asserted; candidates = basics only, deduped; decline first; shuffle logged); Tutor any→hand; decline still shuffles; no-match library issues **no request** and still shuffles; a searched ETB creature (test-only any-card→battlefield spell) fires its ETB; **the log never contains an unchosen candidate**; a full Growth/Tutor game **replays byte-identical**.
- **Part 1.2 — mana-ability colour choice (R-045):** `addMana.choice {count, anyOneColor}`; `isChoiceManaAbility` (choice OR sacrifice cost) — excluded from `producibleSymbols`/`tapForMana`/auto-pay; the enumerator emits one `activateAbility` per colour (`color` on the action); `applyPriorityAction` pays costs (tap, sacrifice via moveObject → DIES pends) and adds the mana immediately (CR 605: no stack). Fixtures: **turn-2** Serra Angel off Lotus + two Plains (the brief said turn-1 — at one land drop Lotus+Plains is four mana, Angel costs five; flagged, Deviations 2), five colour actions offered and no bare `tapForMana` for the Lotus, choice logged; a Lotus-shaped test artifact with a DIES trigger proves ordering (mana first, trigger's draw at the next check).
- **Part 2 — cards/pool/decks:** three defs (oracle re-verified via Scryfall's API: Growth {1}{G} sorcery; Tutor {1}{B} sorcery; Lotus {0} artifact "{T}, Sacrifice: Add three mana of any one color"); `prizeOnly` on `CardDef` (validated boolean) mirrored by the registry's new column; `art:fetch` resolved **Lotus LEA #232 Christopher Rush**, **Tutor LEA #104 Douglas Shuler** (explicit overrides), Growth MIR Pat Lewis (default rule); registry Session-15 table + printings rows; deck swaps C −1 Forest −1 Courser +2 Growth, D −1 Zombify +1 Tutor. Loader count 67→70.
- **Part 3.1 — agent tutor policy v1:** `searchChoice`: Growth → the basic of the colour most needed (coloured symbols in hand minus lands of that colour on the battlefield); Tutor → if land-light (<2 in hand) a needed basic, else the best castable-soon nonland (mv ≤ lands+1), highest mv first, never a land while holding ≥3; **the AI never activates a choice-bearing mana ability proactively** (Lotus is a human's prize). Book-of-shame 9: Tutor never fetches a land at ≥3 lands in hand; Growth picks the needed colour; Lotus activation scores −∞.
- **Part 3.2 — play client:** search dialog (card grid of candidates + a dashed "Find nothing"; the revealed strip suppressed there since the grid is the reveal; the inspector snaps to the searching spell); Lotus **colour picker** (`chooseColor` phase → five colour buttons → confirm); play-by-play masks the opponent's pick ("Searches their library and shuffles"); `labels` for the viewer.
- **Part 3.3 — world:** `shopRowCopies` knob (registry-first; rows roll 1..N); shop generation skips `prizeOnly`; world-sim re-baselined (below).
- **Part 4 — acceptance:** scripted human plays C (Growth) and D (Tutor) through the dialog path — a search resolves in the log; the Lotus line runs through the play client (cast → activate → chooseColor → confirm → three mana floating, Lotus in the graveyard); replay byte-identical (fixture). **Ladder**: mirrors 200/cell pre→post swap **C 68.5/74.0 → 72.5/75.0 (+4.0/+1.0), D 75.5/75.5 → 75.5/78.5 (0/+3.0)**; C seat0 exceeded the 3-point trigger → **full gates 1,000/cell: mirror PASS** (A 67.5/74.8, B 69.2/69.6, C 77.3/71.9, D 74.6/78.4, E 62.3/58.0), baseline floor held in every pairing cell (vs the S11 sane-vs-sane floors), vs random PASS. **Fuzz-before-fixtures:** 300/pairing random + 100/pairing heuristic, zero errors. **world-sim (30 seeds, journeyman pilot): C post-swap 50/38/33% by tier (pre 60/33/36), 1 death, end life 6.0 — Growth did NOT meaningfully soften C's tier-2 wall (+5 at tier 2 is noise at 30 seeds, tier 1 dipped); D post-swap 89/79/74%, 0 deaths, end life 8.7 (no pre-swap D baseline existed — this is the baseline).**

## Deviations from the brief

1. **Manifest amendments copied from the append file's ADR-068 bullets** (the brief said "planner text in the append file" — that is where it was).
2. **Lotus fixture is the turn-2 line, not turn-1** (Lotus + one Plains is four mana; Serra Angel is five). Arithmetic, not rules — flagging per principle 10's spirit.
3. **`prizeOnly` lives on `CardDef`** (validated) as well as the registry column — the world's shop filter needs it at runtime; the registry is markdown.
4. **Shop rows roll 1..`shopRowCopies`** (the S14 1–3 made a knob, default 3).
5. **Search candidates are deduped by cardId** in the request (one action per distinct card) — Tutor over a 30-card library offers ~12 choices, not 30; nothing in the amendment forbids it and the dialog needs it.

## Concerns

1. **Growth didn't move C's tier-2 wall** (the brief asked for an honest answer): world-sim shows noise-level change; C's problem is the deck's top end against tier 2/3, not its mana. The ADR-064 design-round items (30-card mono starters, home-region start) remain the real lever.
2. **Search dedup vs. "see your library":** the chooser sees one of each distinct matching card, not every copy — right for the dialog, but a future "search for two" or a count-sensitive effect would need per-copy actions.
3. **Tutor policy v1 is shallow** (castable-soon + mv): it does not weigh removal vs threats or the opponent's board; good enough to not embarrass itself (book-of-shame pinned), and Lotus is never touched by the AI — if a future AI deck carries a choice-bearing mana ability, `scorePriorityAction` needs a real floating-mana model.
4. **The dev-server bundle doesn't pick up new card JSON without a restart** (`import.meta.glob` at start) — cost me a confusing "unknown card" mid-verification; noted in implementer notes.
5. **Lotus as treasure is unreachable** until lair/boss prize tables exist (M6b content) — it's in the gallery (printed, Rush) and nowhere else, by design.

## Registry entries added/changed

R-044 (library search, 701.19), R-045 (mana-ability colour choice, 605); pool registry Session-15 table (+`prizeOnly` column) and three printings rows; knob `shopRowCopies`; manifest §3 Amendments subsection; ADR-067/068 appended.

## Test status

Default tier: **204 passed / 2 tier-skipped (206), ~11s — +6 engine fixtures (s15), +1 book-of-shame (9), +1 controller (Lotus line), loader count 70**. FUZZ_FULL: **206 passed (206), exit 0**. Typecheck clean. Gates 1,000/cell PASS (tables above). Browser-verified: the search dialog (seed 4, Growth T5) and the world unaffected; the Lotus picker headless (controller test).

## Suggested next

Chris casts Demonic Tutor for exactly the card he wants (the brief's human half) and says whether the dialog felt real; then per the roadmap the M6b world-design round (ADR-064 backlog + more beasts) — world-sim is the instrument — and clocks/sieges, dungeons/bosses (where Lotus becomes reachable).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm ladder --games 1000          # gates
pnpm world-sim --deck C           # tour baselines
pnpm art:fetch                    # (Scryfall) — Lotus LEA #232 is already fetched
```
