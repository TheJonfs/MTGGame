# Handoff — after Session 28 (2026-09-04)

## State of the world

**Cinquefoil v1 is live on Vercel and the deploy playtest is running** (rounds 4–5 of Chris's notes landed the same day the brief did; those sections are in git at `bfc598c`). Session 28 (the brief: the Heart's roots, the legacy's flags, five one-drops) is **done**: the Manafleur begins the Heart duel with one basic of each type on its side (ADR-096 — the five basics left the sixty for Disenchant / Counterspell / Doom Blade / Lightning Bolt / Prey Upon), the legacy is five flags (ADR-095 — a repeated colour compounds nothing; carryover is the union; the fifth-cutting line fires on the fifth FLAG), the withheld minister's double purse is ratified (ADR-097), and **Unearth, Brainstorm, Orcish Lumberjack, Spirit Link, Birds of Paradise** are in the pool (ADR-098; 173 → 178; every text re-verified on Scryfall, first printings fetched). Engine words: R-091 (a DEALS_DAMAGE collector for any recipient, `putOnTop`, `land.subtype:<X>` sacrifice, `anyCombinationOf` mana, `manaValueAtMost`). heart-sim is rebuilt around Chris's real end-game deck (`chris-road-B`) and the full matrix is below with a `heartLife` recommendation. Pool 178 cards (190 defs with tokens and test cards); `docs/reference/` regenerated (cards.md 178; enemies.md carries the Heart's sixty with roots). The handoff is the RUNNING FILE again (Chris, S28 kickoff: the numbered handoffs were a desync).

## Done this session

- **Part 0**: `docs/decision-updates/s28.md` — ADR-095/096/097/098 as the brief gave them, plus the director smalls and the operations note (running handoff).
- **Part 1 (legacy = five flags)**: `applyLegacy` pays `legacyGoldPerCutting × cutColors.length` (was × victories); `setsFifthFlag(before, after)` decides the fifth-cutting line (the controller reads it — was "≥ 5 colours and ≥ 5 victories"); `recordCutting`/`migrateLegacy` unchanged in shape (the chronicle keeps every entry with its honest ordinal; `victories` remains the entry count). Tests: the brief's four (two black = one black exactly, chronicle of two; black + red = union +100; five colours across six cuttings with one repeat → the line fires once, on the sixth entry, and never on a seventh; a duplicate-colour profile migrates to the set-derived carry, idempotent), plus the S27 legacy test re-baselined.
- **Part 2a (roots)**: `HEART_ROOTS` + `heartRootModifiers(player)` (five one-sided `permanentOnBattlefield` basics — the manalink path, untapped, logged, replay-clean) in `heartDuelSpec` beside the entrance; the Heart's telegraph says it ("Its roots are already in the ground…"). The rooted heart fuzz ran FIRST (60 games × 5 references × 3 law modes = 900 games, zero exceptions, replays byte-identical), then the fixtures: a turn-one flower with roots and no other land; the Intake at its first end step.
- **Part 2b (the sixty)**: five basics out, Chris's five in (`heart-deck.ts`); enemies.md regenerated. **AI guard**: Disenchant on its own law is already the misaim cliff (harmful → own side, −100) — pinned; Chris's wider ruling ("never target an artifact or enchantment I control with removal") is exactly rule 8's cliff, so nothing new was built; an opposing Control Magic or a law the player stole stays fair game. **Prey Upon**: view-sim now prices `fight` (it was the default 0) — the flower fights a 4/4 for its full value; pinned. **The turn-one flower bug the brief predicted was real**: the master priced Faerie Formation (16.7) a hair above the Manafleur (15.9) with five roots up and bloomed a turn late in ~15% of games; a permanent that grows laws (a `createLaw` trigger — data-driven, not a card carve-out) now carries +2.5 in the cast prediction; pinned (the flower outscores Formation and the Cleric beside it).
- **Part 2c (heart-sim)**: rewritten — `--lives 35,40,45 --lands 20,18 --refs all|stock|road --games 30`; `chris-road-B` reconstructed (30 cards, every id validated against the pool, no substitutions; master profile; life 17; Plains/Island/Swamp/Mountain in play); the 18-land variant drops the two Ravnica duals whose colour pair the nonland cards demand least; per cell: kill rate, first-own-turn bloom rate, mean turns, the standing petal at the player's death (from the canonical final state — the EVENT log carries no zone changes), the flower's removals (DIES events; exile/bounce invisible — a floor) and by what (the player's last spell before it). The table is in Concerns 1.
- **Part 3 (five one-drops)**: defs encoded from the Scryfall text verbatim (re-verified by curl against api.scryfall.com; the fetch tool is 403'd there); tiers/prices per the brief (Unearth 2/12, Brainstorm 2/12, Lumberjack 1/8, Spirit Link 1/8, Birds 2/12); art and oracle fetched (ULG/ICE/ICE/LEG/LEA first printings, MANIFEST section regenerated). Engine (R-091): `manaValueAtMost` beside `powerAtMost`; the `DEALS_DAMAGE` collector (any recipient, S23 shape, amount + damaged player in the context; `eventDamage` confined to the three damage events); `putOnTop {count}` (a logged pick per card, request purpose `putOnTop`, the FIRST pick ends on top, a short hand puts back what it has); `land.subtype:<X>` in the sacrifice grammar; `addMana.choice.anyCombinationOf` (every multiset of `count` symbols as a logged variant with `colors` on the action; the resolution adds the multiset). **Birds rides the dual path** (five fixed tap abilities) so auto-pay's pip matching fixes colours for both seats — zero words. UI: the put-on-top dialog (title says the first pick ends on top; the ×N count badge applies), the combination chooser (RRR · RRG · RGG · GGG on the existing colour modal), the harness's `putOnTop` and `colors` script steps. AI (each pinned; the FUZZ_FULL ladder gate held): Unearth's graveyard target is worth its card (MV + body + ETB); Brainstorm at the opponent's end step or in response only (book 36), put-back = the two lowest-valued, lands first at ≥ 4 lands between play and hand; Lumberjack's burst only when its multiset enables a cast, never the last Forest with a green card waiting and no other green source; Spirit Link on our best evasive creature, on THEIR biggest when it out-powers ours (book 35 — Chris's neutralizer line); Birds needs no policy (auto-pay). Fixtures (7): the rooted turn-one flower; Unearth's MV ceiling + cycling offered; Brainstorm's order + the short hand; the Lumberjack's four variants and the Forest fed; Spirit Link on an opposing creature (player damage, creature damage, and the LETHAL ORDERING — the aura's controller at 2 dies before the gain resolves: a trigger, not lifelink); Prey Upon with the flower; Birds paying a white spell.
- **Part 4**: nothing built (black's removal stays with Chris); the `heartLife` read is below.
- **Post-brief (Chris, same day): the Heart as a dev-only single battle.** `/play` (dev server, or `?dev=1` on the deploy) shows "Dev · the Heart": pilot `chris-road-B` against the rooted Manafleur with BOTH entrances in place — your four basics in play and 17 life, its five roots + the card in hand + the law sequence, master profile, zero ante — at a chosen heartLife (35/40/45). The road deck moved to `@shandalar/sim/road-decks` (`ROAD_DECKS.chrisRoadB`, with its life and entrance) so heart-sim and the UI read one source; adding a second road deck is one entry there. Browser-verified: both battlefields seeded after the mulligans, 17 vs 35, the Manafleur's portrait on the rail. Chris's human-piloted rate is the read the sim cannot give (the AI pilots road-B worse than he does — the honest direction of error).
- **Registries**: rules R-091; pool-registry Session 28 section (+5 rows) and the regenerated printings section; knobs unchanged (no new knob); `docs/reference` regenerated and sync-tested.

## Deviations from the brief

1. **Handoff filename**: the running `handoff.md`, per CLAUDE.md and Chris's kickoff ruling — not `handoff-s28.md`.
2. **Spirit Link was not zero words** — the engine had only "deals damage to a player" collectors; a new any-recipient `DEALS_DAMAGE` event was added (Chris approved at kickoff; "will come in handy").
3. **Birds of Paradise is encoded as five fixed tap abilities** (the dual path), not the Lotus `anyOneColor` choice: the choice shape is deliberate-activation-only (never auto-paid), which would have made Birds a manual fixer for the human and near-useless for the AI. The def's abilities list five lines; the rendered text is Scryfall's. Flagged in the pool-registry row.
4. **The Lumberjack's combinations are four logged variants**, no picker (Chris approved at kickoff).
5. **The removal guard** is rule 8's existing misaim cliff, verified by pin rather than a new gate (Chris's wider formulation is what the cliff already does).
6. **The roots are said on the Heart's telegraph**, not the duel rail (Chris's choice).
7. **Ladder deltas**: the AI changes (fight pricing, the law-engine bonus, the cantrip window, the Lumberjack burst, Spirit Link's aura pricing, Unearth's target value) carry the FUZZ_FULL ladder gate (held: every mirror cell > 40%, overall majority, zero surprises) and the 100/cell vs-random ladder (unchanged at 100% in every cell) rather than a before/after per-cell table — the ladder CLI reports no finer grain, and none of the five cards sits in a ladder deck yet.

## Concerns

1. **The heart-sim matrix (30 games per cell; the Manafleur master with roots + entrance; stock references journeyman at 16; chris-road-B master at 17 with four basics):**

| lands | heartLife | reference | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | flower removed (games; by) |
|---|---|---|---|---|---|---|---|
| 20 | 35 | starter:white | 100% | 97% | 10.8 | 8/5/10/2/3/2 | 0 |
| 20 | 35 | starter:blue | 97% | 97% | 9.8 | 2/7/12/3/5/0 | 0 |
| 20 | 35 | starter:black | 100% | 97% | 13.5 | 2/8/6/6/8/0 | 13; Vampire Nighthawk ×6, Mind Rot ×2, Child of Night ×2 |
| 20 | 35 | starter:red | 100% | 97% | 8.0 | 1/9/13/1/6/0 | 1; Gray Ogre ×1 |
| 20 | 35 | starter:green | 100% | 97% | 7.3 | 2/8/19/0/1/0 | 0 |
| 20 | 35 | slice:C | 100% | 100% | 7.8 | 0/11/15/1/3/0 | 6; Prey Upon ×5, Elvish Visionary ×1 |
| 20 | 35 | slice:D | 100% | 100% | 9.6 | 0/10/13/1/6/0 | 6; Vampire Nighthawk ×3, Gravedigger ×1, Duress ×1 |
| 20 | 35 | chris-road-B | 67% | 77% | 12.2 | 2/7/4/2/3/2 | 15; Vindicate ×12, Blaze ×2, Serra Angel ×1 |
| 20 | 40 | starter:white | 100% | 97% | 12.2 | 11/3/5/5/6/0 | 0 |
| 20 | 40 | starter:blue | 100% | 100% | 9.8 | 1/7/9/9/4/0 | 0 |
| 20 | 40 | starter:black | 97% | 100% | 11.9 | 4/6/12/4/3/0 | 7; Duress ×2, Typhoid Rats ×2, Mind Rot ×1 |
| 20 | 40 | starter:red | 100% | 100% | 8.4 | 1/6/11/3/9/0 | 0 |
| 20 | 40 | starter:green | 100% | 100% | 8.0 | 1/6/15/2/6/0 | 0 |
| 20 | 40 | slice:C | 100% | 100% | 8.0 | 1/14/12/1/2/0 | 7; Prey Upon ×4, Rancor ×1, Deadly Recluse ×1 |
| 20 | 40 | slice:D | 100% | 100% | 10.2 | 2/10/15/2/1/0 | 8; Vampire Nighthawk ×4, Typhoid Rats ×2, Phyrexian Rager ×1 |
| 20 | 40 | chris-road-B | 80% | 87% | 11.1 | 2/11/7/1/3/0 | 11; Vindicate ×8, Blaze ×3 |
| 20 | 45 | starter:white | 100% | 100% | 12.2 | 14/3/9/1/1/2 | 0 |
| 20 | 45 | starter:blue | 100% | 100% | 9.1 | 0/6/12/8/4/0 | 0 |
| 20 | 45 | starter:black | 97% | 100% | 13.8 | 3/6/12/4/4/0 | 12; Typhoid Rats ×4, Duress ×3, Vampire Nighthawk ×2 |
| 20 | 45 | starter:red | 100% | 100% | 8.2 | 0/6/15/1/8/0 | 0 |
| 20 | 45 | starter:green | 100% | 100% | 7.8 | 0/7/19/2/2/0 | 0 |
| 20 | 45 | slice:C | 100% | 97% | 7.9 | 1/12/14/0/3/0 | 6; Prey Upon ×3, Rancor ×2, Blurred Mongoose ×1 |
| 20 | 45 | slice:D | 97% | 97% | 10.2 | 3/11/11/1/3/0 | 8; Vampire Nighthawk ×3, Nekrataal ×2, Demonic Tutor ×1 |
| 20 | 45 | chris-road-B | 80% | 90% | 9.8 | 2/10/10/0/1/1 | 13; Vindicate ×8, Vampire Nighthawk ×2, The Ruby Tyrant ×1 |
| 18 | 35 | starter:white | 97% | 100% | 11.6 | 6/6/6/6/4/1 | 0 |
| 18 | 35 | starter:blue | 100% | 100% | 10.0 | 3/4/13/5/5/0 | 0 |
| 18 | 35 | starter:black | 100% | 100% | 13.0 | 3/8/7/4/8/0 | 10; Vampire Nighthawk ×4, Mind Rot ×2, Child of Night ×2 |
| 18 | 35 | starter:red | 100% | 100% | 8.0 | 0/8/15/2/5/0 | 0 |
| 18 | 35 | starter:green | 100% | 100% | 7.9 | 0/9/13/1/7/0 | 0 |
| 18 | 35 | slice:C | 100% | 100% | 7.9 | 0/10/13/1/6/0 | 4; Prey Upon ×2, Blurred Mongoose ×1, Giant Growth ×1 |
| 18 | 35 | slice:D | 97% | 100% | 10.8 | 1/8/13/3/4/0 | 6; Drana, Kalastria Bloodchief ×2, Nekrataal ×1, Vampire Nighthawk ×1 |
| 18 | 35 | chris-road-B | 90% | 90% | 10.3 | 6/8/8/1/4/0 | 14; Vindicate ×8, Blaze ×4, Vampire Nighthawk ×1 |
| 18 | 40 | starter:white | 93% | 97% | 13.9 | 14/1/5/2/3/3 | 0 |
| 18 | 40 | starter:blue | 100% | 97% | 11.1 | 4/6/8/2/9/1 | 0 |
| 18 | 40 | starter:black | 100% | 97% | 13.5 | 9/10/5/3/3/0 | 9; Duress ×4, Vampire Nighthawk ×2, Mind Rot ×1 |
| 18 | 40 | starter:red | 100% | 97% | 8.6 | 3/6/15/1/5/0 | 0 |
| 18 | 40 | starter:green | 100% | 97% | 8.0 | 2/7/18/0/3/0 | 2; Giant Growth ×2 |
| 18 | 40 | slice:C | 100% | 100% | 8.0 | 1/13/11/1/4/0 | 3; Prey Upon ×3 |
| 18 | 40 | slice:D | 100% | 100% | 9.8 | 1/12/9/6/2/0 | 5; Vampire Nighthawk ×1, Gravedigger ×1, Hymn to Tourach ×1 |
| 18 | 40 | chris-road-B | 87% | 77% | 10.5 | 2/7/12/1/0/4 | 10; Vindicate ×7, Blaze ×2, Lumen, the Hearth Fire ×1 |
| 18 | 45 | starter:white | 100% | 93% | 13.2 | 13/5/6/4/1/1 | 0 |
| 18 | 45 | starter:blue | 100% | 100% | 9.3 | 2/9/12/3/4/0 | 0 |
| 18 | 45 | starter:black | 100% | 100% | 13.3 | 8/8/6/3/5/0 | 5; Mind Rot ×3, Vampire Nighthawk ×2 |
| 18 | 45 | starter:red | 100% | 100% | 7.9 | 0/8/15/1/6/0 | 0 |
| 18 | 45 | starter:green | 100% | 97% | 8.3 | 0/4/15/2/8/1 | 0 |
| 18 | 45 | slice:C | 100% | 100% | 8.0 | 1/14/12/0/3/0 | 10; Prey Upon ×6, Giant Growth ×2, Deadly Recluse ×1 |
| 18 | 45 | slice:D | 100% | 100% | 10.1 | 3/7/12/3/5/0 | 8; Vampire Nighthawk ×2, Typhoid Rats ×2, Child of Night ×1 |
| 18 | 45 | chris-road-B | 83% | 80% | 11.1 | 4/7/7/2/3/2 | 13; Vindicate ×8, Blaze ×2, Vampire Nighthawk ×2 |

**Aggregates** (stock = the seven references pooled; road = chris-road-B):

| lands | heartLife | vs | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | flower removed |
|---|---|---|---|---|---|---|---|
| 20 | 35 | stock | 100% | 98% | 9.6 | 15/58/88/14/32/2 | 26/210 |
| 20 | 35 | road | 67% | 77% | 12.2 | 2/7/4/2/3/2 | 15/30 |
| 20 | 40 | stock | 100% | 100% | 9.8 | 21/52/79/26/31/0 | 22/210 |
| 20 | 40 | road | 80% | 87% | 11.1 | 2/11/7/1/3/0 | 11/30 |
| 20 | 45 | stock | 99% | 99% | 9.9 | 21/51/92/17/25/2 | 26/210 |
| 20 | 45 | road | 80% | 90% | 9.8 | 2/10/10/0/1/1 | 13/30 |
| 18 | 35 | stock | 99% | 100% | 9.9 | 13/53/80/22/39/1 | 20/210 |
| 18 | 35 | road | 90% | 90% | 10.3 | 6/8/8/1/4/0 | 14/30 |
| 18 | 40 | stock | 99% | 98% | 10.4 | 34/55/71/15/29/4 | 19/210 |
| 18 | 40 | road | 87% | 77% | 10.5 | 2/7/12/1/0/4 | 10/30 |
| 18 | 45 | stock | 100% | 99% | 10.0 | 27/55/78/16/32/2 | 23/210 |
| 18 | 45 | road | 83% | 80% | 11.1 | 4/7/7/2/3/2 | 13/30 |

   **Reads.** (a) Against the stock references the rooted flower wins ~100% and blooms on its first own turn 98–100% of the time (the brief's ≥ 95% holds where the roots stand). (b) Against `chris-road-B` at **20 lands** the kill rate is **67% / 80% / 80%** at heartLife 35 / 40 / 45 — a clear majority, not all; **the fight lives in the petals**: deaths spread Tithe → Toll with Intake rare (2 of 30) and Season/Barrage reached in a handful — no wall at the Intake. (c) **The bloom rate against road-B (77–90%) is bounded by ROOT REMOVAL, not hesitation**: every late-bloom game examined (7 of 30 at 35/20) had four roots — the road deck Vindicated a basic on its own first turn (four basics + a Mox make turn-one Vindicate routine), breaking WUBRG until a dual arrived; two of those games never bloomed. That is the road deck playing well; the master's own hesitation (Formation over the flower) was real and is fixed. (d) The flower is removed in a third to a half of road games, almost always by **Vindicate** (8–12 of 30), then Blaze — the sixty's Counterspell is the only answer to Vindicate and it is one card in sixty. (e) 18 lands is stronger against road-B (83–90%) — the flood is real — but Chris asked for the 20-land symmetry; keep 20.
   **`heartLife` recommendation: 40 (easy 35 / hard 45).** At 35 the road deck wins one game in three (a coin's edge); 40 and 45 read the same at this sample (±8% at n = 30) and 40 is the lighter number. Not changed — the planner takes it to Chris. **Swap candidates**: the sim does not say the five screw or flood in a way the swaps would fix; what it says is that Vindicate is the fight, and the sixty's second answer to it would be a second Counterspell or Mystic Snake-class card — a planner question, not a swap on win rate.
2. **The Chronicle's fifth-cutting line says "Five cuttings."** Under ADR-095 it fires on the fifth FLAG, which with a repeated colour is the sixth (or later) cutting — the word "cuttings" is then off by the repeats. No other string implies compounding (`newRoad`, `newRoadAll`, `withheld`, the dev panel's "victories N" are all fine). The planner's pen.
3. **The EVENT log is a viewer's stream** — no ZONE_CHANGE, so the sim's "flower removed" reads DIES only (exile and bounce invisible). If a future sim needs exits by any path, log a lean ZONE_CHANGE event for the battlefield or read the final state.
4. **The put-on-top and combination dialogs are typechecked and engine-tested but not walked in a browser** — no deck the UI can currently reach holds Brainstorm or the Lumberjack (they are shop finds). A shop with them stocked, or the S29 mage cleansheet placing them, will be the first live look.
5. **Birds' five-ability encoding** renders five "{T}: Add {X}" lines nowhere (the frame shows Scryfall's text) but any future tooling that lists abilities will see five. If the planner prefers one honest choice ability, the auto-pay would need an any-colour producer (a Kuhn edge per colour) — ~half a day.
6. **The Unearth cycling nuance** ("cycle only with ≥ 3 spare mana") is not built: cycling rides the S17 "dead card" rule (only when Unearth has no legal cast), which already never cycles with a target in the yard. The mana-spare half is a refinement if it misplays.
7. **Root removal as counterplay**: Vindicate on a root is now the road deck's best turn-one play against the Heart. If that reads as the Heart being too easy to colour-screw, the design lever is the entrance (roots as indestructible? a sixth root?) — not built, not recommended without Chris's read of the fight.

## Registry entries added/changed

R-091 (S28's words + the roots). Pool-registry: Session 28 section (173 → 178: unearth, brainstorm, orcish_lumberjack, spirit_link, birds_of_paradise) + the Heart's sixty note + the printings section (art:fetch). ADRs 095–098 in `docs/decision-updates/s28.md`. Knobs: none new (knobs.md unchanged). `docs/reference/` regenerated (sync-tested). CLI: `pnpm heart-sim` (new flags). Engine: `TriggerEvent` +`DEALS_DAMAGE`; Effect +`putOnTop`; `addMana.choice` +`anyCombinationOf`; Action `activateAbility` +`colors`, +`putOnTop`; RequestPurpose +`putOnTop`; TargetSpec +`manaValueAtMost`; sacrifice grammar +`land.subtype:<X>`; `heartRootModifiers`, `setsFifthFlag` (world). Book of shame 35–36 + the roots pin.

## Test status

Default tier **514 passed / 2 skipped** (48 files; +7 engine fixtures in `s28-one-drops.test.ts`, +3 agent pins, +1 world legacy test; baselines: the loader's def count 185 → 190, the shop-tier counts 60/44 → 62/47, the S27 legacy gold ×2 → ×1). `pnpm typecheck` (project + UI) clean. **Fuzz-before-fixtures honoured**: the rooted heart fuzz at the full tier (900 games, three law modes, replays byte-exact) before any S28 fixture. **The FUZZ_FULL ladder gate held** (every mirror cell > 40%, overall mirror majority, zero surprises); the 100/cell vs-random ladder unchanged at 100%. heart-sim: 1,440 games (the table above). No skipped or flaky additions.

## Suggested next

1. **Chris**: `heartLife` (the read says 40); the fifth-cutting line's wording; whether Vindicate-on-a-root is the texture wanted (concern 7); a live look at Brainstorm's put-back and the Lumberjack's chooser once a shop stocks them.
2. **Planner (S29, the mage cleansheet)**: place the five one-drops; the sixty's second answer to Vindicate (concern 1d); the Chronicle string.
3. **Implementer smalls**: a lean ZONE_CHANGE in the EVENT log if sims keep wanting exits; the Unearth mana-spare refinement if it misplays.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm heart-sim --games 30 --lives 35,40,45 --lands 20,18 --refs all   # the S28 matrix (~3 min); --refs road for chris-road-B alone
pnpm ladder --games 100 / FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts   # the gate
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /world → Dev: complete all 15 + fell the five petals → the Corolla → the heart's town → Enter (the telegraph names the roots)
pnpm viewer → /play → Dev · the Heart → pilot chris-road-B vs the Manafleur (heartLife 35/40/45)   # Chris's human-piloted read
```
