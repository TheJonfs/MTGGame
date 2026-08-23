# Handoff — after Session 17 (2026-08-24)

## State of the world

**Expansion 1 — the Bestiary's Arsenal — is encoded and green.** Five manifest amendments are real engine code: **A4 counting value refs** (`count` / `graveyardCount` / `maxPower`; conditional statics; live count P/T), **A5 zone-scoped abilities** (cycling compiled from a `cycling` field; graveyard abilities with exile-self), **A6 modal** (modes on spells and triggers with a `chooseMode` request; 601.2b legality), **A7 additional spell costs**, **A8 blink** (`exileThenReturn`; Restoration Angel encoded CR-accurately as an optional trigger with a required target — "up to one" was *not* added, per Chris's ruling). ADR-076's small systems all landed: predicate filters (`anyOf`, keyword filters, `notSubtype`, `other`) and new base predicates, discard costs, subtype search, Baru's cost reduction, a `DISCARD` event + trigger carrying card types (one discard entry point), an `UPKEEP` trigger, **observed** ETB/DIES triggers (`source: other|any`) with a **look-back batch** so Blood Artist sees simultaneous deaths, scoped `addCounters`, per-effect `if` conditions. **32 cards + 5 tokens** encoded with Scryfall-true values (nine ⚠ rows differed — table below), the Gaean Wurm as custom #2; **28 new fixtures** (13 amendment, 15 card/system); **fuzz clean** (1,320 random + 1,650 heuristic expansion games over the 11 beast decks × slice decks + mirrors; the standard tiers); **259/261 tests, FUZZ_FULL exit 0**; mirrors 200/cell within noise. The AI got only the hygiene pins agreed at kickoff (book of shame 12–14). Beast decklists live in `packages/sim/src/expansion-decks.ts` as sim infrastructure for S18's catalog.

## Done this session

- **Part 0:** ADR-073..076 appended in order (verified, ADR-058 intact); manifest Amendments 4–8 copied verbatim from ADR-075; both briefs + the expansion doc checked in.
- **Part 1 — A4:** `ValueRef` = `targetPower | count{predicate} | graveyardCount{who} | maxPower{predicate}` (`CountPredicate`: cardType/subtype/controller/other/attacking); `EffectContext.amount` evaluates at resolution (`evaluateValueRef`); statics take count refs (live, from the source's view) and `condition: {value, atLeast}` (`staticActive`); `ActivatedCost.reduceBy` with `effectiveAbilityCost` (generic floored at 0, coloured pips intact) used by enumerator and payment. Fixtures: Tendrils X shrinks when a Swamp is bounced in response (608.2h), life gained matches; Gaean grows/shrinks live — a Forest bounced mid-combat recomputes trample damage; Werebear 1/1 → 4/4 at exactly seven (Adept self-mill); Baru {7}{G} → {G} off a 9/9 Pelakka, full cost with no Wurm, token 6/6 trample.
- **Part 2 — A5:** `zone: hand|graveyard` on activated abilities; costs `discardSelf` / `exileSelf`; `CardDef.cycling` → loader compiles the hand-zone ability (`asCardDef`, also used by the UI bridge); enumerator offers hand/graveyard abilities with zone-legal costs; payment moves the card first (the new identity is the stack source). Fixtures: Crash cycles at instant speed (triggers nothing); Crash's or-predicate targets; Mother Bear {3}{G}{G} exile-from-graveyard sorcery-only, two Bears; a milled Mother Bear is activatable.
- **Part 3 — A6:** `modes[{label, targets?, effects}]`; spells enumerate one `castSpell {mode}` per legal mode × targets; triggers pick via `chooseMode` (legal modes only, targets after); `StackItem.mode`; UI label. Channeler: all three modes fixtured; "no other nonland permanent → bounce not offerable"; mode logged.
- **Part 4 — A7:** `additionalCost.sacrifice`: not castable without a legal sacrifice; paid after mana at cast; the Goblin's DIES trigger resolves above the Grenade (log order asserted); no Goblin → no cast.
- **Part 5 — A8:** `exileThenReturn` via `moveObject(exile)` then `moveObject(battlefield, {controller})` (new `MoveOptions.controller`); blinked Rager draws+drains again, is summoning-sick (new object), Angels never offered (`notSubtype`), no legal target → trigger never placed, Angel still enters.
- **Part 6 — ADR-076 + the rest:** targeting filters + predicates; `discardCard()` (effects, cleanup, costs, cycling) emitting `DISCARD {player, cardId, types}`; `UPKEEP_BEGIN` event; observed triggers with `ctx.lookback` (set by `moveBatchToGraveyard` for SBA batches and `destroyMany` for Wrath); `addCounters` scope form; `Effect.if`; `searchLibrary` `subtype:X`; `untapTarget` resolver (first customer Little Bear — it had no resolver since S1); Prospector-style sacrifice mana abilities are one action (the Lotus fan-out was colour-only). Fixtures: Bouncer discard cost (+ empty hand), Matron search incl. fail-to-find, Essence Scatter vs creature spell/instant, Disenchant, Gravitational Shift both sides, Little Bear Bear/non-Bear/alone, Blood Artist under Wrath (5 drains incl. itself) and single death, Bitterblossom yours/theirs, Waste Not's three payloads (+ own discards don't trigger), Specter random discard, Dark Ritual same-step Specter, Scepter on a land + Decoy, Aristocrat (sac another / itself), Prospector → Shock, Valkyrie (+ opponent's Angel doesn't count), Overseer, Fisher, Raven, Hordeling, Air Elemental/Viper/Treetop.
- **Agent (kickoff default — pins only):** book of shame **12** mana bursts (Ritual, Prospector's sac) only when they enable a cast this step, never otherwise; **13** cycling only when the spell has no legal use on the board; **14** Channeler bounces a real threat (≥2.5), else draws, else the bird; blink classified helpful (targets own best, prefers ETB/hostile-aura hosts); Grenade/Aristocrat/Prospector sacrifices priced in prediction; zone-ability activations predicted from hand/graveyard; `GameView` gained `graveyardObjects` and `manaPool` (public; no-peeking pin updated).
- **Part 7 — sanity:** `pnpm fuzz:expansion` (new: 11 beast decks × A–E + mirrors) 1,320 random + 990 + 660 heuristic, zero errors; default/FUZZ_FULL green; mirrors 200/cell A 63/72.5, B 69/72, C 79/69, D 77/74, E 62.5/58 (S15 1,000/cell: 67.6/74.8, 69.4/69.7, 77.7/72.0, 74.6/78.4, 62.6/57.9 — within ±3.5 noise; no slice card changed); `art:fetch` for all 31 real cards (defaults; **Restoration Angel overridden to AVR** — the default resolved to the PAVR prerelease promo with Wesley Burt's alternate art; Johannes Voss is the original, Rager precedent); pool registry Session-17 table + printings rows; rules registry **R-048..R-056**; data-model schema additions; implementer notes.

## Scryfall re-verification (every ⚠ row — the brief's blocker check)

| Card | Planner draft | Scryfall (encoded) |
|---|---|---|
| Werebear | as written | ✔ confirmed |
| Mother Bear | ability {1}{G} | **{3}{G}{G}**, exile from graveyard, two 2/2 Bears, sorcery only |
| Moss Viper | as written | ✔ |
| Mist Raven | {2}{U} | **{2}{U}{U}** |
| Waterfront Bouncer | {U} | **{1}{U}** |
| Essence Scatter | as written | ✔ |
| Aven Fisher | {2}{U}? | **{3}{U}**, flying, "when this dies, you may draw" |
| Master Decoy | as written | ✔ |
| Scepter of Dominance | {W}{W} | **{1}{W}{W}** |
| Disenchant | as written | ✔ |
| Youthful Valkyrie | 1/1? | **1/3** |
| Restoration Angel | "exile up to one other target non-Angel creature" | **"you may exile target non-Angel creature you control, then return it"** — optional trigger, one required target |
| Inspiring Overseer | as written | ✔ |
| Skirk Prospector | as written | ✔ |
| Hordeling Outburst | as written | ✔ |
| Goblin Grenade | as written | ✔ |
| Goblin Matron | as written | ✔ ("you may search") |
| Indulgent Aristocrat | "sac another creature" | **"Sacrifice a creature"** (itself legal); Vampire **Noble** |
| Blood Artist | {B} | **{1}{B}** |
| Bitterblossom | Enchantment | **Kindred Enchantment — Faerie** (encoded Enchantment + subtype Faerie) |
| Dark Ritual | as written | ✔ |
| Tendrils of Corruption | as written | ✔ |
| Air Elemental / Hypnotic Specter (✔ rows) | — | ✔ confirmed |
| ✔ rows (Little Bear, Treetop, Airship Crash, Baru, Gravitational Shift, Aether Channeler, Waste Not) | — | ✔ confirmed (Channeler: "another target nonland permanent") |

Decklist consequences (planner's): Mother Bear's ability is a five-mana play; Raven is a four-drop; Bouncer, Blood Artist, Scepter each cost one more than drafted — the beast curves shift.

## Director round (post-close): Gaean Wurm art

Chris asked for the ADR-052 candidate review in-session: four directions written into `docs/prompts/card-art.md` (implementer-authored; the S18 brief had assigned the entry to the planner — adjust freely), four subject files, four renders (`--no-style`). **Chris picked candidate 1, the classical oil** (rearing mossy wurm in golden canopy light). Cropped 5:4 (35% upward bias) to `assets/generated/card-art/gaean_wurm.png`, copied to `packages/ui/public/custom-art/`, `art.asset` wired on the card def, MANIFEST kept/rejected rows logged; verified in the gallery. The S18 brief's "Gaean Wurm's four art candidates" item is done.

## Deviations from the brief

1. **"Up to" targeting (A8) not implemented** — no customer once Restoration Angel is encoded as printed (optional trigger + required target). Ruled at kickoff (Chris: "concur on the defaults"); the amendment text remains ratified for a future customer.
2. **Scryfall-true values encoded** for the nine differing rows (ruled at kickoff) — flagged above, not silently fixed; the beast decks inherit the cost shifts.
3. **`GameView` gained two public fields** (`graveyardObjects`, `manaPool`) — needed by the AI for graveyard-zone activations and the mana-burst rule; no hidden information (no-peeking pin updated).
4. **`untapTarget` resolver added** (vocabulary since S1, never implemented — the loader test now asserts every non-static word has a resolver).
5. **Beast decklists checked in as sim infrastructure** (`packages/sim/src/expansion-decks.ts`, 30 cards as listed) for fuzz coverage now; S18's catalog adopts them. **ADR-074 says 40 cards; the doc's lists sum to 30** — the planner should reconcile before S18.
6. **Arithmetic nit:** the doc says pool 74→106; it's 72→**104** cards (+5 tokens = 109 loader entries).
7. **AI hygiene pins** (kickoff default): 12/13/14 + the small prediction/classification changes above; no evaluator work.

## Concerns

1. **Which amendment fought back:** A6 (modal) was the cleanest; **A4's `maxPower`** wasn't in the amendment text (it names "counting refs" and "Baru's reduction input") — I added it as a third ref kind rather than bend `count`; **ADR-076's observed triggers** were the real engine work (the self/other/any split, the look-back batch for Wrath, and the mover observing its own death — the first version missed exactly that and the Wrath fixture caught it). Keyword-filtered statics needed an explicit recursion cut (`baseKeywords`, R-053 simplification).
2. **Blood Artist's trigger target choice** — the AI's `targetChoice` classifies `loseLife who:target` as harmful and aims at the opponent (fuzz exercised it); no dedicated pin. Five simultaneous Blood Artist triggers each issue a target request — chatty in the play client; fine for the AI.
3. **Skirk Prospector** works but is gated by the S15 rule (choice/sacrifice mana abilities are never auto-paid) plus the new burst rule — the Warband AI will only sac a Goblin for mana when it enables a cast *this step*. That's the intended "never pop it for nothing"; if the S18 world-sim shows the Warband under-performing, this is where to look.
4. **Aven Fisher's and Goblin Matron's optional triggers** default to accept (existing ADR-027 policy) — Matron then uses the tutor policy over Goblins (castable-soon, highest mv). Adequate.
5. **`chooseMode`, `discardCost` and the A7 sacrifice request are new `RequestPurpose`s the play client has no dedicated dialogs for** — they fall into the generic dialog path (actions as options), so nothing blocks; Chris's first Channeler/Bouncer/Grenade plays should be looked at in the S18 director round for polish.
6. **Cycling's DISCARD fires Waste Not** (correct per CR) — noted so S18's deck tuning doesn't read it as a bug.
7. **No world changes** this session; `pnpm world-sim` tables are unchanged from S16's close.

## Registry entries added/changed

R-048 counting refs, R-049 zone abilities/cycling, R-050 modal, R-051 additional costs, R-052 blink, R-053 predicate filters + keyword-filtered statics, R-054 observed triggers + look-back, R-055 upkeep/discard triggers, R-056 discard cost / scope counters / `if` / subtype search / single-action sac mana abilities; pool registry Session-17 table (32 rows + tokens) + printings rows (31); `printings.md` Restoration Angel override + batch note; data-model S17 schema additions; ADR-073..076 appended; manifest Amendments 4–8.

## Test status

Default tier: **259 passed / 2 tier-skipped (261)** — +13 (s17-amendments), +15 (s17-cards), +3 book of shame (12–14), loader 109, no-peeking pin updated. **FUZZ_FULL: 261 passed, exit 0.** Typecheck clean (+ `packages/ui`). `pnpm fuzz:expansion`: 1,320 random / 990 + 660 heuristic games, zero errors. Mirrors 200/cell within noise of S15's 1,000/cell (no slice card changed; full gates not re-run).

## Suggested next

S18 as briefed (bestiary catalog, renders, riders, world integration) — with the planner's reconciliation of the 30-vs-40-card beast decks and the cost shifts first; the play-client dialogs for `chooseMode` / `discardCost` / A7 sacrifice as a rider; Gaean Wurm art candidates (ADR-052).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm fuzz:expansion --games 30 [--agents heuristic]     # beast decks × slice decks + mirrors
pnpm fuzz:starters --games 50 [--agents heuristic]
pnpm ladder --games 200 --mirrors                        # quick mirror sanity
pnpm art:fetch                                           # (Scryfall) all batch cards already fetched
```
