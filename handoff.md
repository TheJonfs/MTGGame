# Handoff — after Session 43 (2026-09-22)

## State of the world

**Cinquefoil v1 is live on Vercel; phase two has its manalink economy.** Session 43 — **the flood's lairs** (ADR-136) — is done. A phase-two map carries **fifteen lairs**, three per territory across its approach and wild rings: the **Landing** (a basic of the territory's colour in play, guarded by the tier-3 mage who kept that colour), the **Wellhouse** (+2 maximum world life, guarded by the territory's tier-3 beast) and the **Hearthstead** (+2 maximum world life, guarded by the tier-2 mage who kept the colour — Kessa in red by rule). A lair is the S14 shape again: a certain encounter with its resident (the parley — not buyable — one duel at the tier's phase-two row plus `lairResidentLifeBonus`), and the manalink on the win through `grantManalink`, the S25 award path made one function that quests and lairs both call. A lair's link has no town and no siege can darken it; the rail, the splash and the result screen name the lair. **Part 0 installed**: the three list amendments (regenerated; mirror below), ADR-134/135 stand, the region names and Odile were S42b's. **Part 4 measured**: the post-lairs references, the scripted stronghold run with a deck that earned its lairs (it reaches the Bailiff 18 of 20 times now; he holds 72% live), the ten seats and the fount against that deck, the purse. **Walked in the browser**: a dev "Stand at the nearest lair", the Smokereach Landing (Sorrel) and the Scaldings Hearthstead (Kessa) — parley, duel, ceremony, rail, splash, save. The S43 brief is committed with this session.

*Pushed to origin/main on 2026-09-25 (the three playtest reports of the 25th, the four first-flood tweaks, the powers' load-time restore); `pnpm build:web` run clean first — a push deploys to Vercel.*

## Done this session

- **Part 0**: `docs/decision-updates/s43.md`. The three amendments in `docs/mage-inversion-lists.md` + `pnpm mage-inversion:gen`; `enemies.md` regenerated.
- **Part 1 — the lairs**: `packages/world/src/flood-lairs.ts` (the resident rule, `lair:<kind>:<colour>` ids, `FLOOD_LAIR_PRIZE`, the map name); `generateWorld` step 5e (three per territory, the wild ring takes two when it has room, spacing relaxed a step at a time, never adjacent to the seat or the ground; phase one's bestiary-lair loop skipped on a flood map); the threshold in `journey.advance` (a flood lair raises the S14 `encounter` with `contact: "lair"`, not a `dungeonEntry`); the parley refuses buy-off at a lair; `awardFloodLair` on the win inside `applyDuelResult` (`DuelRecord.lairPrize`); `Manalink.lair` (+ `town: -1`); `FloodRunState.lairs`; `grantManalink` in quests.ts (the S25 branch extracted; the quest path calls it); the text pack `quests.json` `flood.lairs` (the planner's three names, lines and prize lines; validated). UI: the parley's lair line + "holds a manalink: …", the result's "The lair is yours — …", the rail names the lair, the splash's lair wording, the three-basic entrance clause, the resolved life on the parley card.
- **Quests**: every kind (courier, cardCourier, bounty) rolls a manalink at tier 2+ as phase one's rules say (`manalinkRewardChance` 0.40, life weight 0.5): 21% of one map's offers across three epochs paid one. **Retrieval quests are off the flood's board** (Deviation 3).
- **Part 2 — fuzz and fixtures** (`flood-lairs.test.ts`): generation over eight seeds (and 200 in a probe); the resident table; **fuzz before fixtures** — the fifteen lair duels on two maps with the post-lords references as pilots, replays byte-exact, the results applied; the prize paths (the basic in play at the next duel, +2 maximum at once, once only, no siege suspension, the save round trip); the quest board. `world-controller.test`: the post-lairs scripted run (twenty seeds) as an instrument.
- **Part 3 — AI**: none; ladder gate PASS.
- **Part 4 — measure**: below. `ROAD_DECKS.salvageWRLordsLairs` / `salvageUBLordsLairs`; `flood-sim --refs postlairs`; `heart-sim --refs postlairs`.
- **Part 5**: the planner's text installed as data.
- **Dev**: "Stand at the nearest lair" (phase two; a teleport beside the nearest un-felled lair with the one-step path previewed — the next step is the real threshold).
- Docs: implementer-notes S43, knobs.md/enemies.md regenerated.

## The amended lists — `mage-sweep --part 12 --phase 1` (the mirror)

Kessa **35 → 43%** (over the bar), Brennor **33 → 32%** (the Walls did not change his mirror — the WG healer's Anthem and Links still outlast him), Sorrel 74 → 73%. Mean 48, min 32. Vael 36 and Varro 36 as accepted.

## The lairs — what they cost

The lair fuzz (post-lords pilots at the salvage world's life, journeyman): **1 win in 30** — a lair's resident at the phase-two column + 2 (Ysolde 18 with her ADR-119 offset, the others 22; beasts 24 + 2; tier 2 at 18) against a 43-card deck at 10 life is a lord-shaped fight. The lairs are "harder to earn than phase one's parcels" as ratified; the read for the planner is that the floor deck earns none of them by AI standards, and the first link a real player earns will be the one they can pick (a Hearthstead's tier-2 mage at 18 is the soft door).

## ADR-134 re-read with a deck that earned its lairs — the scripted run, twenty seeds

`salvage-WR+lords+lairs` in the world's own terms (three basic links in play, four life links → maximum 14, life at the maximum): **reaches the Bailiff 18 / 20** (S42b's post-lords deck: 1 / 20), life at the lord 6–30 (median 20; the interior's caches lift it), **the Bailiff holds 13 / 18 = 72% live**, the run fell 5 / 20. The brief's band was 50–70%; 72% at n = 18 sits on its top edge. **ADR-134 stands by the brief's own rule**; the interior does not need looking at — the economy answered S42b Concern 1.

## The ten seats vs the post-lairs references — `flood-sim --games 100 --refs postlairs` (the seat's win rate: WR / UB / road-B)

Bailiff 67 / 68 / 58 · Reeve 53 / 42 / 54 · Fordkeeper 66 / 77 / 48 · Dredger 56 / 43 / 50 · Reaper 82 / 80 / 54 · Odile 24 / 39 / 20 · Zinnia 66 / 48 / 42 · Ovna 76 / 74 / 49 · Isaura 75 / 74 / 68 · Meliyan 91 / 87 / 67. The post-lords numbers (S42b) were 54–93 for the lords; the lairs move each lord 8–15 points toward road-B's line. The courts had not been measured since S41: Odile soft, Meliyan and Isaura hard, as ratified; the Reaper and Meliyan are the two seats above 80 against everything but a finished deck.

## The fount vs the post-lairs references — `heart-sim --tide 1 --roots 5 --refs postlairs`

| floodHeartLife | salvage-WR+lords+lairs | salvage-UB+lords+lairs |
|---|---|---|
| 45 | 93% (T1 fount 95%) | 83% (97%) |
| 50 | 95% (99%) | 89% (99%) |
| 55 | 94% (98%) | 92% (100%) |

Three basics and 16 life do not touch a turn-one 7/7: the fount is where ADR-135 left it (five roots, the card in hand) and its life is not the lever. For the planner: the honest deck at the deep water is still the one that removes the fount (Wrath ×17 of 19 removals in the WR rows).

## The purse — 100 gold at the home town, three visits (`results/s43/purse.md`)

The home town's shelf is **tier 1 only** (the civilized ring; the R shelf empty until a lord falls) at 8–20 gold a card, eight rows of 1–3 copies: **100 gold buys 9–11 copies cheapest-first, 8–12 per visit across three epochs** (WR: Spirit Link, Lions, Soul Warden, Hawk, Wilds, Raise the Alarm, Disenchant, Mind Stone …; UB: Bonesplitter, Thought Scour, Crab, Wilds, Divination …). The tier-2 shelf is the approach ring's — a walk away, and the purse is spent by then. Report only, as asked.

## Deviations from the brief

1. **The lair's map name is the region it sits in** ("The Saltings Landing", "The Smokereach Wellhouse"), not the territory's inner-ring name; the brief's "the Chalkwater Landing" would put a wild-ring lair under the civilized ring's name. One line to change (`floodLairName`) if the planner wants the territory's.
2. **The scripted run's "16 life" is 14 in the world's terms** — the salvage world's base is 10, and two life lairs are +4; the sim reference keeps the brief's 16 on the S42b post-lords base of 12.
3. **Retrieval quests no longer post on a phase-two map** — their target is a lair-dungeon's prize room and a flood lair has none. Not a re-tune; a consequence the brief's "nothing re-tuned" did not foresee.
4. **The lair is the S14 certain encounter, not a telegraph-with-decline** — the brief's "the resident's parley, the fixed duel"; stepping onto a lair opens the parley (fight / flee at the roamer's odds and stake / buy-off shut). A court-style "step back" costs the flee stake here. The planner may want the court's shape instead (a telegraph, decline free); it is a small change at the threshold.
5. **The dev teleport** ("Stand at the nearest lair") was not asked for; the lairs are in fog a long walk from the start and a hand read needed it.

## Concerns

1. **Kessa's flood list beats the mirror at 43% but the Walls did nothing for Brennor (32%).** His RG list is all-in; the planner's amendment slowed it without giving it a long game. If the bar is kept, the lever is his mirror opponent's Spirit Links, not his own forty.
2. **The lairs are lord-shaped fights for the floor** (1 in 30 by AI). A player who walks to the nearest lair on day one meets a tier-3 mage at 22 with three basics in play. The Hearthstead (tier 2 at 18, one basic) is the first door a salvage deck can open; nothing on the map says which lair is which kind until the rail names it after discovery — the map name does ("Hearthstead"), if the player knows the three words. The threshold line tells them ("A fire kept lit … does not share"), but only once they are standing on it.
3. **The manalink rail's footer still says "Town-tied: an occupied town's link goes dark"** — true of quest links, not lair links; the rail names the lair but the footer is one sentence for both kinds.
4. **The salvage world's start life (10) and the references' 12** keep diverging in every read; the post-lords/post-lairs sim references sit two life above what the world hands out. Either the world's `startingWorldLife` at phase two is 12 (a knob), or the references drop to 10 — one of the two should move before the next read is compared to this one.
5. **A phase-one save's lairs are untouched**, but `Manalink.town: -1` is a new value in a shared type: any future reader that indexes `towns[m.town]` without the guard will read `towns[-1]` (undefined) — the three readers today are guarded.
6. **The Chronicle does not note the link** (the brief's "the Chronicle notes the link"): the profile Chronicle is the ledger of foldings; a lair's link is on the world's `floodRun.lairs`, the rail and the Recent-duels record (`lairPrize`). If the planner meant the Chronicle page, it is a line per lair on the run's record — say so and it is small.

## Post-session (Chris's playtest report, 2026-09-22): the Clear button

Reported: Clear on the declare-attackers bar may not cancel a staged attacker (and the blockers' Clear to check). **Not reproducible** — walked in the browser on this build (stage the Hawk → Clear empties the combat zone, "Confirm attackers (0)" declares nothing and the Hawk stays untapped; stage a block → Clear → "Confirm blocks (0)", the Angel's damage lands) and pinned through the click path in `packages/ui/src/play/clear-staged.test.ts` (Clear, the click-again un-stage, and a real Confirm on both bars, read off the action log and the life totals). The deployed build carries the same code (the r9 fix at `9a81d20` is before the 2026-09-21 push). One thing seen on the way that could READ as Clear failing: on a narrow viewport (~1024 px) clicking any prompt-bar button scrolls the play area sideways so the board's left edge is cut off — the staged creature has left the zone, but the zone itself has moved; at 1440 px there is no scroll. If it recurs, the duel log (Recent duels → replay → Download) shows whether a `declareAttacker` was logged after the Clear.

## Post-session (Chris's playtest report, 2026-09-22): Aetherbolt's targets

Reported and **confirmed** — the hypothesis was exactly right. The r9 multiset matcher took the enumerator's first variant with the two chosen targets, which is battlefield order, so with Aetherbolt the newer creature clicked first for the bounce took the 3 damage instead. Fixed in the controller: the matcher is SLOT-wise (`slotsFor` reads the source's target specs — a spell's, an ability's, a trigger's through the request's `source`); within a slot the order is free (the Warden's "up to two" — the r9 rule stands), between slots the click order is the slot order. The prompt now names the effect each pick serves ("Choose a target for: return to its owner's hand (target 1 of 2)" → "3 damage (target 2 of 2)"). Walked in the browser (the Courser clicked first was bounced; the Bears died) and pinned in `packages/ui/src/play/target-order.test.ts` (Aetherbolt both orders, the same permanent in both slots, Drakuseth's 4-then-3 trigger with a range slot); the Warden test still passes. Four cards have two slots today — Aetherbolt, Prey Upon, Drakuseth, the Sapphire Sage — one rule covers them.

## Post-session (Chris's playtest reports, 2026-09-25): the Usher's guest, the Lions, the petals' signatures

1. **The Usher's reanimated guest, stolen by Lumen, sacrificed at end step — "failed to trigger"**: not reproducible; the engine fires the Usher's drain whoever controls the guest when it dies (`packages/engine/test/usher-stolen-guest.test.ts`). The likeliest reading: Chris ALSO controlled an Usher (under a Pacifism, per the second report) — both drained, and the totals netted to zero (pinned: 20 / 20 with an Usher each side). If the play-by-play shows no drain at all, the log will say.
2. **The Lions that would not attack into a Pacified Usher — confirmed**: the AI's blocker model counted a can't-block creature as a wall, and the deterrence / race-risk terms counted a can't-attack creature as a counter-swing. Fixed: the view carries a public `cantBlock` / `cantAttack` (from characteristics), `greedyBlocks` skips the one, the attack score's deterrence skips the other. Book 69 pins it (a 2/1 attacks into a lone Pacified 5/5; the same 5/5 unpacified holds it home). Ladder PASS, both gates (no delta on the finished-deck references — Pacified walls are rare in the sims).
3. **The petal bosses' signature in hand**: the Corolla's five (Seraphina, Lumen, Clio, Yuloke, Faldor) have NEVER had `signatureToHand` — the Heart, the fount and the stronghold lords do; the petals run three copies in forty. `petal-sim` now prints the cast rate: the signature is cast in 66–90% of games (0.8–1.3 per game; Lumen lowest at 66% under the law) — one game in four to one in ten never sees it. Whether the petals should loom the signature like the lords is a design call (`{ type: "signatureToHand", player: 1, cardId: petal.boss.cardId }` in `petalDuelSpec` is the one-line change); not made.

## Post-session (Chris's first phase-two play, 2026-09-25): four tweaks

1. **The salvage picks lock only at the commit.** Leaving a colour tab no longer banks its pick; all five are open to change until "Choose colours" (`salvageToPair`), where they bank together. A card of two colours still sits on one shelf only (taken on W, not offered on B — and offered again if W lets it go). The screen's copy says so; the controller test re-pinned.
2. **Phase-two rumours.** A phase-two tavern no longer pours phase one's lore — the Mox guardians, the five lords (the Spire, the Bastion…), the crossed currents, the Vault; the Mox chains never post there (S41). It pours the planner's **`flood.rumors`** (a new optional list in `quests.json`'s flood pack — **empty today: content for the planner**) plus the phase-neutral texture lines and the Nighthawk's legend (the beast roams both maps). Until the planner writes them a phase-two mill is thin (two or three lines a town). Pinned: every town × four epochs on a flood map, none of the phase-one names.
3. **The +2 lair's result line said +1** — two identical notes were de-duplicated. The line now counts them ("two life manalinks — your maximum world life rises by 2"); the splash and the maximum were already right.
4. **The five powers ride into the flood.** `newSalvageWorld` never applied the legacy's powers (only cards and gold reach a salvage start by design, but powers are knowledge — ADR-088); `SalvageSpec.powers` (the profile's cut colours) now pre-unlocks them; the controller passes `cutColors(legacy)`. Pinned through the controller: five cuttings → all five unlocked on a flood world. **And a load-time restore for the save made before the fix**: `loadText` on a phase-two world unlocks the profile's cut colours that are missing (once; idempotent; "Loaded. The five powers are yours again (…)"), autosaves; a phase-one save is untouched. Pinned.

## Registry entries added/changed

No R-numbers (no rules changed). ADR-136 and the rulings in `docs/decision-updates/s43.md`. No new cards (pool 227). Data: `quests.json` `flood.lairs` (three kinds: name, line, prize). Types: `FloodLairKind`, `FLOOD_LAIR_KINDS`, `FloodTextPack.lairs`, `Manalink.lair`, `DuelRecord.lairPrize`, `FloodRunState.lairs`. Functions: `floodLairResidents`, `floodLairId` / `parseFloodLairId`, `floodLairName`, `FLOOD_LAIR_PRIZE`, `awardFloodLair`, `grantManalink`. Generator: step 5e. Journey: the lair threshold, the parley's lair refusal. Quests: retrieval targets exclude flood lairs. Sim: `ROAD_DECKS.salvageWRLordsLairs` / `salvageUBLordsLairs`; `flood-sim --refs postlairs`; `heart-sim --refs postlairs`. UI: the parley (lair line, holds, resolved life, three-basic clause, buy-off shut), the result's lair line, the rail, the splash, dev "Stand at the nearest lair", `floodLairAt`, `devStandAtNearestLair`.

## Test status

Default tier **741 passed / 2 skipped (77 files)** (from 735 / 2: +5 `flood-lairs.test.ts`, +1 controller S43 run). `pnpm typecheck` clean. **Fuzz before fixtures**: the thirty lair duels (post-lords pilots, both pairs) with byte-exact replays ran before the prize fixtures. Ladder PASS (no AI change). Sims: mage-sweep 1,000 (the mirror); flood-sim 3,000; heart-sim 600; the scripted run 20 seeds (~50 live duels). **Walked in the browser**: the dev teleport, two lairs (the Landing and a Hearthstead) through parley → duel (the dev concession) → ceremony → rail and splash → save and continue; the parley card's life and entrance clause corrected on the way.

## Suggested next

1. **Planner/Chris**: Deviation 1 (the lair's name), Deviation 4 (the threshold's shape), Concern 4 (10 vs 12), Concern 2 (which door first — a rail hint before discovery?), Concern 6 (the Chronicle).
2. **Chris**: a hand read — Dev → "Stand at the nearest lair" three times on a fresh phase-two world, then a stronghold.
3. **S44 candidates** (the brief's own list): the Calyx's tiles and the flood's art round (the lairs want three map glyphs and perhaps a splash each); the shops' phase-two stock (the purse read says tier 1 for 100 gold — whether that is the design); the Chronicle page for the falls (and the lairs, if Concern 6 says so).

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/world/src/flood-lairs.test.ts
pnpm exec vitest run packages/ui/src/world/world-controller.test.ts -t "S43"
pnpm mage-inversion:gen                      # after editing docs/mage-inversion-lists.md
pnpm mage-sweep --games 100 --part 12 --phase 1 --baseline none
pnpm flood-sim --games 100 --refs postlairs
pnpm heart-sim --games 100 --tide 1 --roots 5 --lives 50,45,55 --lands 20 --refs postlairs
pnpm ladder --games 100 ; pnpm reference ; pnpm knobs:doc
results/s43/                                 # this session's outputs (the purse read: purse.md)
```
