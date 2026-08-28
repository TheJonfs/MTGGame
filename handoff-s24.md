# Handoff — after Session 24 (2026-08-28)

## State of the world

**The life economy has both halves now, defeat itemizes its bill, and Cinquefoil's towns each sing their region's song.** The recovery package (ADR-086) is live: the manalink class carries a second kind — **life manalinks** (+1 maximum world life, town-tied, sharing the suspension law: an occupied town's link stops counting and current life clamps, Chris-confirmed at kickoff) — under new knobs (`lifeManalinkWeight` 0.5, `lifeManalinkCap` 3, `manalinkRewardChance` 0.30→0.40); the topline reads **current / maximum** now. **The inn** is every town's fifth door: rest trades steps for life at `innStepsPerLife` (5/8/12 by difficulty), three quick options with live prices, and the rest is a true clock transaction — quest deadlines, sieges, respawns, and lord growth all tick per slept step, with any news queued for waking through the news modal. world-sim reports the life economy (first table: a fight-everything green tour loses −71 life and buys back +64 across 10 rests costing 512 steps — the tuning conversation has numbers). The **loss screen** itemizes the toll (world life + the stake as cards) above the existing refill note, with Loseduel firing there. **Audio mapping v3 landed verbatim**: fifteen region tracks (town → colour+ring → LocMus file, the region as musical identity unit), five castle themes on the new **stronghold splash** (the telegraph now banners a painted gate plate per seat and plays its theme through the threshold — browser-verified: Greenholt pours LocMus2, the Verdant Throne pours Gcastle over its root-woven gate), and seven stingers (one Newsflash crier for all news, Reward/Manalink split on quest payoffs, Dueltune at the parley stakes menu, Findcard on caches, Winduel/Loseduel at the result screen). Deliberate silences per v3: overworld, in-duel, interiors, and the menu (TBD — hook kept, Chris's call). The whole Shandalar library (93 files) is mounted at gitignored `assets/audio/`.

## Done this session

- **Part 0**: ADR-085/086 appended (083 had landed during S23 — verified in place); FUZZ_FULL baseline 393/393.
- **Part 1 (recovery)**: `Manalink.kind` ("basic"/"life", absent = basic — every pre-S24 save reads clean); `maxWorldLife`/`clampWorldLife` in state.ts (suspension-aware, structural siege read); the clamp fires at every siege fall; award() handles the life kind with its own cap-to-gold conversion; manalinkModifiers filters to basics (life links never enter duels); the tavern's manalink pointer is kind-aware (life offers muted only by the life cap). The inn: `innRest()` in journey.ts (per-step tick mirroring advance(): quest deadlines, sieges, roamer wander, respawns; heal-then-clamp covers the mid-rest-fall edge — steps stay spent); controller `innRest()` queues waking news (threats, falls, expiries as "While you slept…" popups) and restocks the shelf live (epochs may cross). UI: the inn tab + nav tile (new vignette render), the cur/max topline. world-sim: the life-economy table + a rest-to-full-below-half policy at arrivals.
- **Part 2 (loss screen)**: the defeat bill — "The road exacts its toll: −N world life · your stake of K cards is taken" — leads the loss branch of the result screen; ante cards were already shown as frames (S13), the Winduel/Loseduel hooks were already on duelResult (S23) and v3 maps them.
- **Part 3 (audio v3)**: schema — `music.town.<C><R>` resolution (bare `music.town` kept as global fallback), `splash.stronghold.<id>`, the v3 stinger set (sting.news/reward/manalink/parley/treasure joining win/loss/coin-flip; the S23 quest-complete/siege-news pair retired); mapping.json per v3's tables verbatim (27 bindings, every file asserted present in the mount); the WorldApp effect rewired (region-resolved town cues, splash cues on stronghold telegraphs, popup classification by kind, parley + treasure stings via a controller `treasureSeq` seam); the five gate plates rendered in seat-tempered painterly registers (ghost-queue Charnel Court, eyes-behind-the-roots Verdant Throne…) and wired as full-width telegraph banners.
- **Part 4**: 3 world acceptance tests (life links + cap + duel-exclusion + save round-trip + both kinds rolling in the wild; suspension drops the maximum / clamps current / liberation restores the ceiling; the inn heals-to-max, spends, ticks the clock with a mid-rest threat landing in the queued events, and a full sleeper pays nothing); browser walkthrough (the 4/10 topline, the inn's three live prices, the 48-step rest with the wake notice, LocMus2 at the Greenholt, Gcastle + the gate plate at the Verdant Throne); zero console errors.

## Playtest round 1 (S24 — Chris's first hearing; eight notes, all landed)

1. **The sting channel**: stingers are ONE VOICE now — a new sting fades whatever still rings (the Dueltune+Winduel stack on a fast auto-win cannot recur), and the parley's Dueltune fades the moment a stakes choice is made (the encounter screen closing triggers it). Also fixed underneath: a music element whose play() was refused no longer SQUATS on its cue — the next request retries instead of no-opping forever (the likely "cue failed to fire" report).
2. **The lords speak rightly**: `lord.gender` in dungeons.json (the Usher and the Sower are she; Chris-ruled), `lordPronouns()` in stronghold.ts, and the telegraph + victory ceremony thread it ("…feed her. Her signature always looms: it starts in her hand" — browser-verified at the Verdant Throne).
3. **Implementer hygiene**: the looping Gcastle was my preview server left running post-verification — server stopped, habit noted.
4. **Charnel Court plate: kept** (Chris's verdict recorded in MANIFEST); the other four stay candidates.
5. **Town music carries into the deck editor and collection when opened FROM the town** — the cue holds (single fetch, no restart; verified), so you never left the building. Opened from the map they stay silent as before.
6. **The town square is 2×3 now**: five doors + the sixth utility cell (Edit deck / Collection / Save / brass Leave town). One CSS ambush en route: `.town-nav button` reached the utility buttons as descendants and repainted the primary parchment-on-parchment — scoped rules restore them.
7. **Boss cards are priceless and untradeable**: prizeOnly refuses the buyer's stall ("there is exactly one, and it is yours") and `cardMatches` refuses them for card-courier contracts — one predicate covers the offer list, acceptance validation, and the UI's spare picker.
8. **Waking occupied is RATIFIED** (concern 1 resolved): sleeping through your own town's fall stands as designed pressure.

## Playtest round 2 (S24 — the SFX package lands its first pieces)

1. **The coin toss found its piece**: `sting.coin-flip` → `sfx/Toss.wav` — the pending hook (PlayMatch's ceremony, wired since S23) simply received its file.
2. **The SFX channel** (the third audio channel): fire-and-forget and freely OVERLAPPING — rapid card plays layer naturally and never touch the one-voice sting or the music. Cues key by colour identity: `sfx.cast.W…G` wired now; guild pairs (`sfx.cast.WU` — the package has all ten), `sfx.cast.artifact`, and `colorless` resolve by the same rule and are mappable by DATA alone the day they're wanted.
3. **The in-game hook**: SPELL_CAST and LAND_PLAYED (both seats — hearing the opponent's plays is feedback) ring the card's colour; a basic rings what it taps for (a Swamp is B). Browser-verified: playing a Mountain fetched Red.wav.
4. **Per-cue volume in the mapping**: a value may be `{"file": "...", "volume": 0.5}` — a 0..1 multiplier on the channel baseline, clamped, backward-compatible with bare strings. The five colours ship at 0.5.
5. **The `/sound` board** (dev surface; better than a five-basics test deck): every mapped cue playable in place, with LIVE volume sliders on the SFX family — drag, click, read the number off, and the keeper values go into mapping.json (the board persists nothing; the mapping stays the one source of truth). The whole 73-file SFX set is mounted at `assets/audio/sfx/`, so future hooks (Draw, Tap, Shuffle, Attack…) are one mapping line + one seam each — the worksheet's in-duel micro-stinger workstream now has its delivery mechanism.

## Playtest round 3 (S24 — the SFX wave: types, colours, and the obvious actions)

1. **Colours at Chris's 0.2** — and moved to their right moment: per the ruled sequencing, the CAST rings the card's TYPE (`sfx.cast.creature`=Summon, artifact, enchantment=Enchant, instant, sorcery — creature-first priority, so an artifact creature is a Summon and the laws ring Artifact) and the COLOUR rings when the permanent ENTERS play (`sfx.enter.W…G`, resolved through the one zone-move event — so resolved creatures, played lands, fetched lands, tokens, and reanimations all ring; a land's colour is what it taps for). Browser-verified as a literal script: Red (Mountain enters) → Tap (auto-pay) → Summon (Goblin cast) → Red (Goblin enters).
2. **The obvious actions**: `sfx.draw` (throttled — an opening hand's seven-draw burst rings once), `sfx.shuffle` (a new `SHUFFLED` engine event — mulligans and post-search shuffles emit; the setup shuffle deliberately does not, pre-game noise), `sfx.tap` (every TAPPED — mana payments ring, as Shandalar's did), `sfx.untap` (one ring per untap-step burst, 150ms throttle; isolated effect untaps ring individually), `sfx.attack` (ONE ring at the commit, either seat), `sfx.end-turn` (the turn-number rollover, silent at the game's first turn).
3. Volumes: colours 0.2 (ruled); the rest are implementer first guesses (types 0.35, attack 0.5, shuffle 0.4, draw/end-turn 0.3, tap/untap 0.25) — all on the /sound board for the next pass. Note for the feedback round: the attack commit both rings Attack AND taps each attacker (Tap × n) — if that stacks muddy, suppressing tap-during-commit is a small change.

## Playtest round 4 (S24 — SFX second pass)

1. **The louds potted to 0.3** (Chris's verdict): the five type-cast sounds, attack, and shuffle all sit at 0.3 now (colours stay 0.2; tap/untap 0.25; draw/end-turn 0.3).
2. **The ten guild pairs are live** — pure mapping, zero code (the enterSfxCue resolver already emits sorted pair keys): `sfx.enter.WU…RG` → the package's pair files at 0.3. A Tropical Island entering play rings GreenBlue.wav (board-verified fetch); every dual land and two-colour permanent resolves the same way.
3. **Damage rings** (`sfx.damage` → Damage.wav at 0.3): one ring per simultaneous batch (combat's several DAMAGE events land in one instant — the burst-throttle pattern), covering combat and spell damage alike.

## Playtest round 5 (S24 — Block/Destroy/Discard/Sacrifice, and the manalink's own stage)

1. **Four more SFX at 0.3**: `sfx.block` (ONE ring at the block commit), `sfx.discard` (batch-throttled — a Mind Rot's two cards ring once), and the death pair — a new `SACRIFICED` engine event marks the cause just before the zone move at every sac site (both cost sites, the effect word, end-step dues), so the UI rings **Sacrifice** for marked deaths and **Destroy** for the rest (SBA deaths, destroy effects, the legend rule), each batch-throttled for wraths. The per-cue throttles refactored into one helper. (The package's own filename typo — `Sacrfice.wav` — is preserved faithfully.)
2. **The manalink splash** (Chris's design): any manalink earned — basic, life, or future boon — gets its OWN ceremony screen: the new talisman plate (first-try render; Chris invited the piece) over kind-specific prose, queued and rendered above everything. **Grant detection is a diff on `world.manalinks`** around the award seams (arrival + duel application), so every current and future grant path splashes with zero reward-plumbing. The Manalink sting fires per splash shown — and one-voice means it FADES Winduel, which was the whole point. Popups now ring reward/news only.
3. **Early exit ends the music** — leaving the win/loss result screen fades whatever result sting still rings (the parley-fade pattern generalized to a screen-transition watcher).
4. Browser-verified: the splash ceremony with Manalink.flac fetching, the queue advancing life→basic with kind-correct prose; FUZZ_FULL 398/398 with SACRIFICED replay-clean.

## Deviations from the brief

1. **The mid-rest-fall edge ruled simply**: a life-link town falling while you sleep drops the ceiling and the heal clamps to it — the steps stay spent (the innkeeper kept the bed). Escalated-by-doing; one refund line if the feel says robbed.
2. **Life manalinks grant maximum only** (per ADR-086's letter) — current catches up at the inn. If receiving one feels flat in play, granting +1 current alongside is one line.
3. **The inn skips roamer pursuit-contact by construction** (the sleeper is behind walls; roamers never enter towns) but roamers DO wander and respawn during the rest — advance()'s tick minus the movement-contact phase.
4. **The Dueltune sting fires at the parley panel's opening** (the fight/flee/payoff menu) once per encounter — the closest existing seam to v3's "pre-battle stakes menu".
5. **Gate plates shipped as candidates** — five renders in seat-tempered registers, MANIFEST-logged for the director round; re-rolls are cheap if any seat's register reads wrong.

## Concerns

1. ~~RESOLVED in playtest r1 (Chris: waking occupied is good pressure — ratified)~~ — original text kept for the record: **The inn under siege**: resting in a town whose OWN siege deadline passes mid-rest is legal (you sleep through the fall and wake occupied).
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
