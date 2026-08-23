# Handoff — after Session 18 (2026-08-23)

## State of the world

**The Bestiary is live in Cinquefoil.** The world catalog carries **twelve spoke-bound signature opponents** — ten beasts plus the mage-voiced Cunning Tactician at tiers 1 *and* 2 — on the 30-card beast decks (`beast:<key>` deck refs resolving to `packages/sim/src/expansion-decks.ts`), with parley voices (verb/line/refusal; the Serra Angel takes a *tithe*), tier AI profiles inherited from the mage mapping, and **one house-style bestiary plate + chip crop each** (ten renders, all first-try, candidates pending Chris's verdicts). **Spawn tables** replace the mage-only roll: every roamer (generation and respawn) is a spoke-bound signature of the region's colour with probability `beastShare[ring]` (0.35/0.5/0.5 baseline), tier-blended per Chris's rings (civilized 85/15/0, approach 33/50/17, wild 0/50/50), falling back to a *mage of the rolled tier* when the spoke lacks a beast of that tier (`beastTierFallback` knob; `nearest` is the alternative); lair residents are the spoke's top-tier signature. **Riders:** fog renders (blank-paper cells incl. washes, POIs spawn into view, one-cell road stubs, fog-honest path planning with re-plan, rail lists filtered); the **Cinquefoil title plate** (the S6 rose); ADR-073 starter swaps measured — **White 83% tier-1 (gate ≥68 PASS), Blue 35% (FAIL — escalate)**; deck-picker ops are in-page. **Part 5 dialogs** for `chooseMode` / `discardCost` / the A7 sacrifice are dedicated (source card, hint, mode rows, the staged cast with its target), and `/play` now offers the beast decks so Chris can run Channeler/Bouncer/Grenade by hand. World-sim tables for the full roster are in `docs/world-sim-s18.md` (summary below). **265/267 tests, FUZZ_FULL exit 0**, typecheck clean incl. `packages/ui`.

## Done this session

- **Part 0:** ADR-077 appended to `decisions.md` (verified); manifest A4 gains the `maxPower` clause; expansion doc header corrected (72→104; 30-card decks); R-049 cites **CR 702.29a / 701.9a** (cycling's discard is a discard — ADR-077 watch item closed); the five `decisions-append-*` files moved to `docs/decision-updates/`; brief v2 checked in.
- **Part 1 — riders:** **Fog** — `WorldMapView` takes `explored`; unexplored cells render `--fog` (a shade paler than parchment — the W civilized wash *is* the parchment colour, see concern 5), no hatching/borders/names; towns/lairs/castles only when explored; roads through explored cells + faded 0.8-cell stubs into fog; minimap fogged; the controller plans paths treating unexplored cells as passable (`planPath`) and **re-plans mid-walk** when fogged ground turns out rough ("Rough ground ahead — going around" / "no way through"); the rail names only seen fixed points/regions; "N/15 regions seen · M/10 towns found". **Title:** "CINQUEFOIL — five petals · three rings · one journey" over the rose crop of the card back; `<title>` too. **Starters:** W −1 Plains +1 Swords (12/2), U −1 Divination +1 Man-o'-War (1/4); **blue's easy variant add swapped Man-o'-War → Cloudkin Seer** (the 4-copy cap — deviation 2). Gate, mage-only roster, 30 seeds avoid: **white 83/45/32 (was 69/44/27), blue 35/19/10 (was 40/12/9)**. **Deck picker:** in-page new/duplicate (name field, Enter/Escape, duplicate-name guard), delete (select + Delete), **unsaved-draft guard when switching**, "unsaved" marker; no `prompt()` left.
- **Part 2 — catalog:** `OpponentTemplate` gains `spoke` (colour ring binding; required for beasts), `parley {verb, line, refusal}`, and `beast:<key>` deck refs (validated against the sim export `@shandalar/sim/expansion-decks`). Entries: A Grizzly Bear (G1), The Deadly Recluse (G1), A Bloom of Man-o'-War (U1), **A Cunning Tactician (W1) / The Cunning Tactician (W2)** — `kind: mage`, spoke W, field-guide plate — The Boggart Warband (R2), A Vampire Nighthawk (B2), The Living Gale (U2), The Siege-Gang (R3), The Hypnotic Specter (B3), The Serra Angel (W3), the Pelakka Wurm (G3, re-pointed from slice C to `beast:wurm`; aligned to the tier-3 mapping — deviation 3). Tier mapping apprentice/journeyman/master, world life 8/10/12, tier-3 `anteCount 2`. `buyable`: Warband/Grizzly/Nighthawk/Siege-Gang/Serra/Wurm yes; Recluse/Man-o'-War/Gale/Specter no (defaults for verdict — OQ-5).
- **Part 3 — renders:** ten subject files (`docs/art/subjects/beast-*.md`), ten 1:1 renders, 82%-centre chip crops (256px), UI copies, 20 MANIFEST rows (candidate), `docs/prompts/portraits.md` registry table. Verdict round pending.
- **Part 4 — world integration:** knobs `beastShare`, `beastTierBlend`, `beastTierFallback`; `rollTemplate(rng, catalog, region, knobs)` = signature roll (spoke + blend) else mage roll (spoke-less roster, any colour) — shared by generation and respawn; nearest-tier ties break *down* in civilized rings, *up* elsewhere; lair host = spoke's top-tier signature (W Serra, U Gale, B Specter, R Siege-Gang, G Wurm). world-sim: **per-opponent W/L table** + `--no-beasts`. Tables below.
- **Part 5 — dialogs:** `DialogModal` branches: *Choose one — Aether Channeler* (numbered mode rows, source card, "targets next" hint), *Discard a card to pay — Waterfront Bouncer* (hand cards, cost hint), *Additional cost — Goblin Grenade* (source card + **"Staged: Cast Goblin Grenade → Opponent"** from the new `MatchController.lastCast`, sacrifice options as cards). `/play` lists the eleven beast decks under the slice decks (explicit-spec path, 20 life, no ante). Controller tests drive all three to the dialog and through it; browser-verified Grenade and Channeler.
- **Part 6 — scripted acceptance:** Warband contact → fight → `beast:warband` decklist, journeyman, world life 10, aggro profile → duel → result applied → roamer removed; Living Gale refuses with its own line; Serra tithe = buy-off at the beast multiplier and removes the roamer. **Human half (Chris): pending** — meet the Warband and a tier-3, wander fogged Cinquefoil from home, play the new-dialog cards, verdict renders/names/buyables.

## World-sim tables (30 seeds × 5 starters, journeyman pilot, avoid, towns tour; full in `docs/world-sim-s18.md`)

Shipped default (`beastTierFallback: mage`):

| Starter | tier 1 | tier 2 | tier 3 | deaths/30 | steps per fight civ/app/wild |
|---|---|---|---|---|---|
| white | 67% | 57% | 30% | 1 | 55/29/20 |
| blue | 48% | 26% | 15% | 3 | 47/33/14 |
| black | 71% | 40% | 22% | 1 | 52/29/25 |
| red | 80% | 40% | 33% | 0 | 56/34/25 |
| green | 55% | 36% | 31% | 0 | 56/28/22 |

Per signature opponent (player W-L summed over the five starters; mages for comparison in the doc):

| T | Opponent | W-L | player win % | read |
|---|---|---|---|---|
| 1 | A Bloom of Man-o'-War | 28-16 | 64% | at tier (mages 52–72%) |
| 1 | A Grizzly Bear | 16-9 | 64% | at tier |
| 1 | A Cunning Tactician | 15-7 | 68% | at tier |
| 1 | The Deadly Recluse | 12-5 | 71% | at tier |
| 2 | **A Vampire Nighthawk** | **8-41** | **16%** | **far over tier** (mages 20–53%); under `nearest` it was 12-77 / 13% — the most-met opponent on the map |
| 2 | **The Boggart Warband** | 5-17 | 23% | **over tier** (the watch item predicted *under*; under `nearest` 23-35 / 40%) |
| 2 | The Cunning Tactician | 27-25 | 52% | at tier |
| 2 | The Living Gale | 18-11 | 62% | at/under tier |
| 3 | The Siege-Gang | 0-8 | 0% | brutal (n small) |
| 3 | The Serra Angel | 1-9 | 10% | brutal |
| 3 | the Pelakka Wurm | 2-8 | 20% | at tier (mages 0–45%) |
| 3 | The Hypnotic Specter | 4-12 | 25% | at tier |

Cost-shift candidates (ADR-077): the Nighthawk deck carries two of the +1 cards (Blood Artist {1}{B}, Aristocrat unchanged) and is *still* brutal — the signature card itself (lifelink + deathtouch + flying ×4 against a journeyman-piloted starter) is the likelier cause than the shifts; the Gale (Aven Fisher {3}{U}, Channeler) sits slightly under tier, where the Fisher/Raven shifts *could* be biting; the Man-o'-War deck (Raven {2}{U}{U}, Bouncer {1}{U}) is fine at tier 1. The Warband's strength says the Prospector gating is not starving it.

## Deviations from the brief

1. **`beastTierFallback` knob (default `mage`)** — my first fallback ("nearest tier on the spoke") put tier-2 decks in civilized rings for black/red (no tier-1 beast) and the Nighthawk hit 13% over 89 fights; the default now spawns a mage of the intended tier instead, which keeps Chris's ring blends honest but lowers beast presence where a spoke has gaps (civilized realised beast share ≈0.22 vs the 0.35 knob). Planner's call (OQ-4).
2. **Blue easy variant** adds Cloudkin Seer instead of Man-o'-War (the swap made Man-o'-War a 4-of; the 5th copy is illegal).
3. **The Pelakka Wurm aligned to the tier-3 mapping** (master, world life 12, anteCount 2; was journeyman/14 in the S14 PoC) and its deck is `beast:wurm` (was slice C). Restore the harder lair boss if that was the point (OQ-8).
4. **Tactician is two catalog entries** sharing the deck and plate (A/The Cunning Tactician) — per Chris's kickoff answer; names are suggestions (OQ-6).
5. **Lair residents also roam** (the spoke's top signature serves both) — the S14 wurm was held out; not changed without a ruling (OQ-3).
6. **Knob baselines I picked:** `beastShare` 0.35/0.5/0.5; `beastTierBlend` as Chris described; `--fog` tone; chip crop 82% centre. Arguing baselines, not rulings.
7. **`/play` setup always takes the explicit-spec path** (so beast decks mix with slice decks); controller API unchanged.
8. **Test grid kept to subsets** (Chris): no N×N over the 16 decks — world-sim is the instrument; fuzz tiers unchanged (`fuzz:expansion` not re-run: no card/engine change).

## Concerns

1. **Vampire Nighthawk is the over-performer** (16% player win at tier 2; 13% under `nearest`). The planner's first deck adjustment target; the cost shifts are not the cause. **The Warband over-performs too** (23%) — the Prospector watch item is moot in the other direction.
2. **Roster gaps make the spawn table lie or thin**: no B/R tier-1 beast, no U tier-3, no G tier-2, no W tier-1/2 *beast* (Tactician covers). With `mage` fallback the civilized B/R rings are mage-heavy; with `nearest` they host tier-2 decks. Filling the gaps (a Typhoid Rats / Goblin Piker-class tier-1 beast for B/R; a blue tier-3) is the real fix. Chris flagged W tier-1/2 and U tier-3 at kickoff; the table adds B/R tier-1 and G tier-2.
3. **Blue starter still fails the gate** (35% mage-only; 48% on the full roster because tier-1 beasts are softer than tier-1 mages for it). S16 concern 2 stands: a control/tempo shell the journeyman pilot can't drive. Escalated (OQ-9).
4. **Fog + path planning**: the plan goes through fog as if passable and re-plans on rough ground — it can't leak terrain, but a long fogged route may zig-zag on contact. Alternative is "click only explored cells" (OQ-7). Also: roamers are only drawn when in sight (unchanged), so fog doesn't change that; **region names appear once the heart is explored** — a big region's name can lag its discovery.
5. **The W civilized wash equals the parchment colour** — fog needed a distinct `--fog` tone. Art direction should say whether fog is "paler paper", a stipple, or whether the W civilized wash should warm up.
6. **Tier-1 beasts are comparable to tier-1 mages for the gate** but the *full-roster* tier-1 numbers are lower than mage-only for white (67 vs 83) — mostly the Man-o'-War bloom (blue tempo) at 64%. Fine; noted so the two tables aren't read as contradictory.
7. **Lair residents** share a template with roamers — "The Serra Angel guards this place" and "The Serra Angel blocks your way" can both happen on one tour. Held-out vs roaming is a feel question for the director round.
8. **Beast decks on the AI at tier 1** are apprentice-piloted — the Recluse/Grizzly numbers look right, but the Man-o'-War deck's bounce lines are piloted by the weakest profile; if Chris finds them toothless, the tier AI profile (not the list) is the lever.
9. **Request chattiness** (Blood Artist) not exercised by hand this session — the Nighthawk deck has two Artists; Chris's Nighthawk fight is where to feel it.

## Registry entries added/changed

No rules-registry entries (R-049 gained the CR citation); no pool changes. Knobs: `beastShare`, `beastTierBlend`, `beastTierFallback` (docs/knobs.md regenerated). Catalog schema (world-side, documented in implementer notes): `OpponentTemplate.spoke`, `.parley`, `beast:` deck refs. New docs: `docs/open-questions.md` (standing director questions OQ-1..9), `docs/world-sim-s18.md` (tables), `docs/prompts/portraits.md` bestiary registry table. MANIFEST +20 rows (candidates). `docs/decision-updates/` is the append-file home.

## Test status

Default tier: **265 passed / 2 tier-skipped (267)** — +2 world (spawn tables, respawn), +1 world (Part 6 beast acceptance), +3 controller (dialogs); catalog/beast/lair tests updated for the roster. **FUZZ_FULL: 267 passed, exit 0.** Typecheck clean (+ `packages/ui`). Browser-verified: title plate; fog (home region + sight trail, POIs spawn in, road stubs), fog-honest walk; deck ops; beast parley (Grizzly — plate, voice, "Toss it your rations"); Warband chip on the map; Grenade and Channeler dialogs in `/play`. world-sim: 3 × 5 starters × 30 seeds (nearest / mage / mage-only for W+U).

## Suggested next

1. **Director round (this session's pending half):** renders verdicts (ten plates), names, buyables, the Nighthawk/Warband feel, fog feel, the three dialogs, the Serra tithe line; OQ-1..9.
2. **Planner:** deck adjustments from the tables (Nighthawk first; Warband; Siege-Gang/Serra are brutal but tier 3); roster gaps (B/R tier-1 beasts, U tier-3, G tier-2) — new cards are S19+; `beastTierFallback` ruling.
3. **S19 as planned:** quests; the boss authoring round for the strongholds (ADR-077 deferred it here); the blue starter question.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm world-sim --seeds 30 --starter white --policy avoid [--no-beasts]   # per-opponent table at the end
pnpm fuzz:expansion --games 30 [--agents heuristic]
pnpm viewer → /world (Cinquefoil title, fogged map) · /play (beast decks selectable; dev handle __mc) · /gallery
python3 .claude/skills/gemini-image/render.py --entity-file docs/art/subjects/beast-<slug>.md --aspect 1:1   # re-render a rejected plate (edit the descriptor first)
```
