# Handoff — after Session 24 (2026-08-28)

## State of the world

**The life economy has both halves now, defeat itemizes its bill, and Cinquefoil's towns each sing their region's song.** The recovery package (ADR-086) is live: the manalink class carries a second kind — **life manalinks** (+1 maximum world life, town-tied, sharing the suspension law: an occupied town's link stops counting and current life clamps, Chris-confirmed at kickoff) — under new knobs (`lifeManalinkWeight` 0.5, `lifeManalinkCap` 3, `manalinkRewardChance` 0.30→0.40); the topline reads **current / maximum** now. **The inn** is every town's fifth door: rest trades steps for life at `innStepsPerLife` (5/8/12 by difficulty), three quick options with live prices, and the rest is a true clock transaction — quest deadlines, sieges, respawns, and lord growth all tick per slept step, with any news queued for waking through the news modal. world-sim reports the life economy (first table: a fight-everything green tour loses −71 life and buys back +64 across 10 rests costing 512 steps — the tuning conversation has numbers). The **loss screen** itemizes the toll (world life + the stake as cards) above the existing refill note, with Loseduel firing there. **Audio mapping v3 landed verbatim**: fifteen region tracks (town → colour+ring → LocMus file, the region as musical identity unit), five castle themes on the new **stronghold splash** (the telegraph now banners a painted gate plate per seat and plays its theme through the threshold — browser-verified: Greenholt pours LocMus2, the Verdant Throne pours Gcastle over its root-woven gate), and seven stingers (one Newsflash crier for all news, Reward/Manalink split on quest payoffs, Dueltune at the parley stakes menu, Findcard on caches, Winduel/Loseduel at the result screen). Deliberate silences per v3: overworld, in-duel, interiors, and the menu (TBD — hook kept, Chris's call). The whole Shandalar library (93 files) is mounted at gitignored `assets/audio/`.

## Done this session

- **Part 0**: ADR-085/086 appended (083 had landed during S23 — verified in place); FUZZ_FULL baseline 393/393.
- **Part 1 (recovery)**: `Manalink.kind` ("basic"/"life", absent = basic — every pre-S24 save reads clean); `maxWorldLife`/`clampWorldLife` in state.ts (suspension-aware, structural siege read); the clamp fires at every siege fall; award() handles the life kind with its own cap-to-gold conversion; manalinkModifiers filters to basics (life links never enter duels); the tavern's manalink pointer is kind-aware (life offers muted only by the life cap). The inn: `innRest()` in journey.ts (per-step tick mirroring advance(): quest deadlines, sieges, roamer wander, respawns; heal-then-clamp covers the mid-rest-fall edge — steps stay spent); controller `innRest()` queues waking news (threats, falls, expiries as "While you slept…" popups) and restocks the shelf live (epochs may cross). UI: the inn tab + nav tile (new vignette render), the cur/max topline. world-sim: the life-economy table + a rest-to-full-below-half policy at arrivals.
- **Part 2 (loss screen)**: the defeat bill — "The road exacts its toll: −N world life · your stake of K cards is taken" — leads the loss branch of the result screen; ante cards were already shown as frames (S13), the Winduel/Loseduel hooks were already on duelResult (S23) and v3 maps them.
- **Part 3 (audio v3)**: schema — `music.town.<C><R>` resolution (bare `music.town` kept as global fallback), `splash.stronghold.<id>`, the v3 stinger set (sting.news/reward/manalink/parley/treasure joining win/loss/coin-flip; the S23 quest-complete/siege-news pair retired); mapping.json per v3's tables verbatim (27 bindings, every file asserted present in the mount); the WorldApp effect rewired (region-resolved town cues, splash cues on stronghold telegraphs, popup classification by kind, parley + treasure stings via a controller `treasureSeq` seam); the five gate plates rendered in seat-tempered painterly registers (ghost-queue Charnel Court, eyes-behind-the-roots Verdant Throne…) and wired as full-width telegraph banners.
- **Part 4**: 3 world acceptance tests (life links + cap + duel-exclusion + save round-trip + both kinds rolling in the wild; suspension drops the maximum / clamps current / liberation restores the ceiling; the inn heals-to-max, spends, ticks the clock with a mid-rest threat landing in the queued events, and a full sleeper pays nothing); browser walkthrough (the 4/10 topline, the inn's three live prices, the 48-step rest with the wake notice, LocMus2 at the Greenholt, Gcastle + the gate plate at the Verdant Throne); zero console errors.

## Deviations from the brief

1. **The mid-rest-fall edge ruled simply**: a life-link town falling while you sleep drops the ceiling and the heal clamps to it — the steps stay spent (the innkeeper kept the bed). Escalated-by-doing; one refund line if the feel says robbed.
2. **Life manalinks grant maximum only** (per ADR-086's letter) — current catches up at the inn. If receiving one feels flat in play, granting +1 current alongside is one line.
3. **The inn skips roamer pursuit-contact by construction** (the sleeper is behind walls; roamers never enter towns) but roamers DO wander and respawn during the rest — advance()'s tick minus the movement-contact phase.
4. **The Dueltune sting fires at the parley panel's opening** (the fight/flee/payoff menu) once per encounter — the closest existing seam to v3's "pre-battle stakes menu".
5. **Gate plates shipped as candidates** — five renders in seat-tempered registers, MANIFEST-logged for the director round; re-rolls are cheap if any seat's register reads wrong.

## Concerns

1. **The inn under siege**: resting in a town whose OWN siege deadline passes mid-rest is legal today (you sleep through the fall and wake in an occupied town — the arrival gate only checks on entry). Feel question for Chris; blocking rest-under-threat, or waking early at the fall, are both small.
2. **The sim's life-economy table runs the fight-everything policy** — its −71/+64 numbers are a ceiling on churn, not a portrait of real play. A "flee-when-losing" pilot policy would make the inn table honest; sanctioned-on-demand.
3. **`music.duel` stays registered but v3 silences it** — entering a duel therefore STOPS town music by crossfading to silence (correct per v3's focus doctrine). If a future mapping wants duel music back, one line. The same is true of interiors.
4. **The mapping references OGG town tracks** — Chrome/Firefox fine, Safari silent (container unsupported). Local-only concern; the deploy library (step 3) should be transcoded.
5. **The r2 town-music cadence and the tavern pour share no cue** — the tavern tab currently plays its region track like the rest of the town; if the tavern ever wants its own voice, the resolution has room (`music.town.<C><R>.tavern` is NOT built — flag only).

## Registry entries added/changed

Knobs: `lifeManalinkWeight`, `lifeManalinkCap`, `innStepsPerLife` (+easy/hard overrides), `manalinkRewardChance` 0.30→0.40 (docs/knobs.md regenerated). decisions.md: ADR-085/086 appended (083 verified in place from S23). Manalink type +`kind`; QuestReward +`manalinkKind`; state +`maxWorldLife`/`clampWorldLife`; journey +`innRest`; controller +`innRest`/`treasureSeq`. Audio: cue registry v3 (town/splash resolutions + the stinger set), mapping.json 27 bindings, `assets/audio/` mounted (93 files, gitignored). MANIFEST: +6 rows (the inn vignette kept; five gate plates as candidates). New renders: town-inn, gate-{argent-bastion,spiral-spire,charnel-court,furnace-gate,verdant-throne}.

## Test status

**FUZZ_FULL 396/396** (S23-close 393 → +3: the S24 acceptance trio — life links/cap/kinds, suspension-clamps-restores, the inn transaction incl. the queued mid-rest threat). One S22-r4 pin updated (the tavern-pointer mute now also caps the life kind). Typecheck + Babel parse gate clean. Browser-verified: the 4/10→10/10 inn rest end to end with the 48-step clock spend, LocMus2 (Greenholt = G1) and Gcastle + the gate plate at the Verdant Throne telegraph, zero console errors. world-sim life table smoke-run at 3 seeds.

## Suggested next

1. **Chris (Part 4 human half)**: rest somewhere expensive on hard (12 steps/point), receive a life manalink, lose a fight and read the bill, walk the Duskmoor hearing the Duskmoor, stand at each gate for the splash verdicts — plus concern 1's sleep-through-the-fall feel.
2. **Director round**: the five gate plates (candidates); the inn baselines vs the world-sim table (with concern 2's better pilot policy if wanted); the menu-music TBD; the lord-fell and coin-flip stingers still pending pieces.
3. **Planner**: the ambience layer + terrain classes (deferred by v3); the travel-powers design round (ADR-084's parallel track); lord-deck iteration + watch-flags (the storm round); the sleep-through-a-fall ruling if Chris flags it.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm world-sim --seeds 5              # now prints the life-economy table
pnpm viewer → /world (a town's inn tab; a stronghold gate for the splash; sound after first click)
pnpm knobs:doc                        # after knob edits
```
