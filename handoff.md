# Handoff — after Session 27 (2026-09-02)

## State of the world

**The run is finishable.** The Manafleur — {W}{U}{B}{R}{G} Legendary Avatar 7/7, "At the beginning of your end step, exile all laws, then create a copy of the next law" — is the pool's last card (184→185), landed with its ~1.5 riders exactly as ADR-093 billed: `law: true` on the five laws + a `laws` scope + `exile` taking a scope (the Wrath-class machinery), `createLaw` as manifest-from-def (a token of the next law under the effect's controller), and the **game-level law sequence** in `GameState.lawSequence` (order + pointer + mode), set by a `lawSequence` match modifier — the WBRUG ring beginning with white by default, `random` (logged RNG, replay-exact) and `accumulate` (no exile) as data hooks, off. Eight fixtures cover the named lines: blooms the turn cast, one petal per round, the ring closing W→B→R→U→G→W, exile-all taking both sides, the Disenchant tempo (lawless, then the NEXT petal), Wrath stopping growth until a second copy continues the sequence, Zombify, the Control Magic theft (petals for the thief at THEIR end step), accumulate and random. The Heart fight is live end to end: the Corolla town's door opens at five petals, the telegraph and stakes speak in the v4 pack's voice, the Manafleur's sixty (every authored card; legal under the never-stakes rule) fights under the master profile at `heartLife` 30/35/40 flat with the entrance and zero ante; a loss leaves you at the heart's town; victory rings Winduel, shows the card, writes the run's chronicle entry (the starting road's line with the running "Nth cutting" header), copies it into the **profile** (`Legacy` v1 under the UI's `shandalar-legacy` key, outside the save), and offers stay or a new road. A new road carries every cut colour's power, its teaching guardian's card with the site pre-cleared, its lord's complement minister, and +50 gold per cutting; carried cards never duplicate (a held minister's petal pays coin in lieu). The Chronicle page sits on the start screen; the dev menu grants/clears cuttings and fells the five petals. The Corolla's own voice (the v3 pack) replaced every S26 placeholder through data (`quests.json`'s `corolla` and `heart` sections, validated key by key). Part 0's rulings landed: prizeOnly never stakes (engine `setAside`), the petals wear the logo's five hues on a 33 grid with paper between the lobes (stems join them to the heart), `pnpm typecheck` covers the React screens. heart-sim is filed. Art: four card candidates (the fourth stained glass, a new register) and **four portrait candidates** (Chris's ask) — candidate 1 of each wired provisionally; the printed face on Chris's pipeline.

## Done this session

- **Part 0**: ADR-092/093 appended (asserted); `setAside` skips prizeOnly (regression: a library of Moxen antes nothing; a mixed library skips the Mox); `corollaGridSize` 33 with narrowed lobes (b 0.21→0.17, d 0.575→0.6) and a two-cell stem per spoke so every tip stays reachable; the petals' washes from the card back's cinquefoil (sampled, lifted one step for ink legibility: W #f1e8cf U #6b86a0 B #5a4a52 R #b85e4c G #8a9a63); the `.tsx` fold (`pnpm typecheck` = project + UI); FUZZ_FULL baseline 478/478 once two mid-run artifacts were excluded (a knob doc regenerated after the run started; a test file written after).
- **Part 1**: the Manafleur (R-089); fuzz-before-fixtures — the sixty against five references × three law modes, 300+ games, zero exceptions, replays byte-identical in every mode; 8 fixtures; the ADR-052 ceremony (four candidates) + four portrait candidates; card-art.md entry; MANIFEST +8.
- **Part 2**: `heartDuelSpec` / `applyHeartDuel` (R-090); `heartLife` knob 35 (easy 30, hard 40); dungeons.json `corolla.heart`; the town's door → the Heart's telegraph → the fight (`corollaDuel` against `{heart}`); the Heart's cue rows (`splash.heart`, `music.heart.victory`) registered, silent.
- **Part 3**: the ceremony (`heartVictory`: the pack's postponement text, the card as a frame, the entry with the ordinal header, the fifth-cutting line when five roads are held, the offer); the card drops once; `gauntlet.completed`; the per-run `gauntlet.chronicle` typed.
- **Part 4**: `Legacy` v1 (`emptyLegacy`/`migrateLegacy`/`recordCutting`/`cutColors`/`legacyCarry`/`applyLegacy`, world-side; the controller owns the key); carryover at new-game with the pack's new-road line on the start screen and in the first notice; the Chronicle page; the dev toggles; `legacyGoldPerCutting` 50.
- **Part 5**: `pnpm heart-sim` — see Concerns 1 for the table.
- **Part 6**: scripted acceptance — engine (8), sim (2), world (4: the spec, victory/loss/ledger, the legacy end to end incl. withheld + migration, the text packs), controller (1 long: four petals shut / five open, the fight's spec, loss, win, the profile written, stay, a new road carrying the right three things + gold, the withheld petal, the dev toggles); the human half is Chris's.

## Deviations from the brief

1. **Four portrait candidates** as well as four card candidates (Chris's kickoff ask) — candidate 1 of each wired provisionally so the fight has a face; the sheet is with Chris.
2. **The withheld minister pays the purse twice** ("coin in lieu" needed a number; the doc gave none). One knob away if it should be its own figure.
3. **The carryover applies every cut colour at new-game**, not only the road being started (the doc: "five colours' victories stack to five powers and ten legends at the start of the sixth run").
4. **`heartLife` is a knob with difficulty overrides** (35; easy 30; hard 40) rather than three literals.
5. **The Chronicle page lives on the journey's start screen** (a "Chronicle" link beside New game / Continue), not the app's top-level menu — it needs the profile store, which is the world screen's storage.
6. **The dev menu grew "fell the five petals"** — the Heart cannot be tested without it.
7. **"A copy of the next law" is a fresh token from the def**, no copiable-values machinery (the laws have no printed variance) — R-089 names it.

## Concerns

1. **heart-sim (30 games × 7 references; the Manafleur master with the entrance at 30/35/40; references journeyman at 16):** kill rate **51% / 63% / 56%**; the Manafleur reaches the battlefield in **80% / 74% / 66%** of games (never cast = the jam: 20 / 26 / 34%); mean length ~20 turns. The life column barely moves the kill rate — **the body is not where the fight lives; the jam is.** A third of games at 40 never see the flower bloom: five-colour greed with singletons stumbles exactly as the doc predicted. Whether that texture is wanted (a magnificent mess) or the flex slots should smooth it (more duals? a second Mox line?) is the planner's call with this table; the numbers are noisy at 30 games.
2. **The rotating-law cadence** (one petal per round, at the Manafleur's end step): the fixtures prove the mechanism; whether it FEELS right is Chris's fight. Watch: with the Manafleur cast on turn 3–4, the Intake lands the same turn (the intruder's next creatures enter tapped), the Tithe the round after — the first two petals are the punishing ones for a creature deck.
3. **The evaluator sees laws as permanents** (no AI touch was needed — the ladder gates hold), but the master profile never *plans* around its own petals (it does not hold creatures for the Intake or attack into the Tithe on purpose). If the fight reads passive, that is the next AI seam.
4. **The chronicle's `when`** is a wall-clock ISO string written at victory — the profile's ledger, not game state (replays untouched) — but two victories in one second would share it; `n` is the key.
5. **The profile has no export.** The save downloads; the legacy lives only in the browser's storage. A "download profile" beside Download is a small ask if Chris plays on two machines.
6. **The Corolla register's lobes at 33** show paper between petals; the black petal reads purple-grey (lifted for ink). If it should read blacker, drop `COROLLA_WASH.B` toward the sampled #2d221e and let the ink go lighter over it.
7. **`newRoadLine()` reads a power's name through `powerRates` on a stub world** when no world exists yet (the start screen) — a small hack; a static name table would be cleaner.
8. **The Manafleur's flavor text** lives only on the printed face (defs carry no flavor field) — the pack's line is in `quests.json` (`heart.flavor`) for a future frame that wants it.

## Playtest round 1 (S27 — Chris's first notes)

1. **Art verdicts**: candidate 1 for both the portrait and the card — the provisional wiring is now the wiring (MANIFEST flipped: 1 KEPT, 2–4 rejected, on both rows). The printed face follows on Chris's pipeline.
2. **The Manafleur's printed face installed** (745px, printedAsset wired). Verified against the def: cost, type, P/T, the trigger and its reminder — exact. One wording difference: the face says **"create the next law"**, the def and the doc **"create a copy of the next law"**. No rules difference (R-089's mechanism is manifest-from-def either way; the print is arguably the more honest text). Installed as delivered, MANIFEST flagged; Chris rules re-drop or a one-word def trim.
3. **Auto-victory over the five petal bosses** (Chris: speed-run to the final fight with a starter deck): `devFellPetals` now fells every standing petal AS A WIN — the signature (withheld if held), both duals, the purse; no stake — and is reachable inside the flower (the petals rail panel and the heart's town carry the link, since the ribbon's Dev tab is suppressed there) as well as from the Dev tab. Controller-tested (four petals paid after one real fall; idempotent). The stated purpose: if the Heart reads easily winnable even from a fresh starter because of the jam, the Manafleur gets tuned on the planner's next pass.

## Playtest round 2 (S27 — Chris cut the flower from all five roads)

**The walk**: green won (a turn-5 Manafleur notwithstanding), white lost, blue crushed it, black won easily, red lost slowly; the carryover behaved road to road, and the all-five ending landed. Chris's read: the Manafleur's deck wants tuning, but several losses hid behind bad AI play around specific cards. Landed:

1. **The def trimmed to the printed face** ("create the next law"); **the five laws are `Artifact Enchantment — Law`** (a `Law` subtype beside the `law` flag).
2. **The 7/7 that never attacked** — the attack search deducted each attacker's full deterrence (what it could kill on defense), which for a 7/7 facing any real creature outweighed a midrange-weighted 7-damage swing. Deterrence is now scaled by the RACE RISK (the opponent's untapped power over our life above a margin) — but only for a SAFE attacker (no single block can kill it; no opposing deathtouch): at 35 life facing six power the flower swings, at 6 it holds, and a deathtouch 1/1 keeps its full deterrence (the ADR-060.1 pin caught the first cut over-reaching). Book 29. **Watch**: this touches every attack decision — the default ladder smoke passed; the FUZZ_FULL ladder is the gate (see Test status).
3. **Glare of Subdual tapping its own board instead of attacking** — the tapper discipline (S26 r3) now covers tap-a-creature COSTS: never on our own turn (the cost spends an attacker), only before attackers on the opponent's. Book 32.
4. **The Jet Witch as a faucet** — life-for-cards is a budgeted purchase now: only with ≤ 2 cards in hand, only while life after paying clears the opposing untapped power by 3, at most twice a turn (per-instance memory keyed by turn). Book 31. **Chris asked for thoughts** — see Concerns 9.
5. **Legend copies thrown to the legend rule** — a legendary permanent we already control is never cast again (the copy is insurance against removal). Book 30.
6. **Experimental Overload into an empty graveyard** — two fixes: the view-sim's graveyardCount ref reads the actual public graveyard (typed) instead of a flat "some" (3), and a locked-P/T token at 0 prices as no token; and **Overload is out of the Manafleur's sixty, Faerie Formation in** (Chris's call; the "every gold" conceit bends by one).
7. **Start from scratch** — the start screen's carried-legacy panel offers "Start from scratch instead…" with a confirm (wipes the chronicle and every carried thing), beside the default new road.

## Playtest round 3 (S27 — the deploy)

**Vercel.** `pnpm build:web` + `vercel.json` (install / build / output / SPA rewrites). Verified locally: the static build carries the fetched Scryfall art under `/real-art/*` (the dev middleware's job), the pathname routes rewrite to the app, the dev endpoints 404 cleanly. **The deploy is silent by construction** — the audio mount is Chris's local library and stays gitignored; every cue falls through to silence. See implementer-notes "Deploying the viewer". Chris's side: a Vercel project pointed at the repo (the config is in `vercel.json`, no dashboard settings needed beyond that), and `ENABLE_EXPERIMENTAL_COREPACK=1` only if the install balks at pnpm 11. Saves and the chronicle are per-browser (localStorage) — a save file downloads/uploads through the start screen for moving between machines.

## Registry entries added/changed

R-089 (the Manafleur's words), R-090 (the Heart, the chronicle's first phase, the profile). Pool-registry: Session 27 section (184→185). Knobs: `heartLife`, `legacyGoldPerCutting`; `corollaGridSize` 33; knobs.md regenerated. Save: v7 unchanged; `gauntlet` +`completed`, `chronicle` typed (ChronicleEntry). Engine: `GameState.lawSequence` + `DEFAULT_LAW_ORDER`; Modifier +`lawSequence`; RngPurpose +`lawSequence`; SCOPES +`laws`; Effect `exile` +scope, +`createLaw`; CardDef +`law`. Catalog: `CorollaDef.heart`, `QuestTextPack.corolla/heart` (+validation). UI: screens `heartTelegraph`/`heartVictory`; `corollaDuel.against.heart`; the Chronicle page; the legacy key; dev toggles. Audio: `splash.heart`, `music.heart.victory`. Sim: `@shandalar/sim/heart-deck`; `pnpm heart-sim`. MANIFEST +8. card-art.md +1 entry.

## Test status

**FUZZ_FULL 497/497 after playtest round 2** (the ladder gate held through the attack-search change — every mirror cell above the floor, the 100/cell smoke unchanged; the four new pins 29–32 included). At the session's close proper: **493/493** (45 files; S27-open baseline 478 → +15: 8 Manafleur fixtures, 2 heart-fuzz tests, 4 world Heart/legacy/text-pack tests, 1 controller acceptance test; the ante regression joined the baseline count). Default tier 491 passed / 2 skipped (pre-existing skips). Fuzz-before-fixtures honored (the sixty against five references × three law modes, 300+ games, before any fixture; replays byte-exact in `sequence`, `random`, and `accumulate`). `pnpm typecheck` (project + UI) clean. knobs.md in sync. Browser walkthrough (zero console errors): the Corolla's door with the plate and the pack's line, the 33 flower with the logo's hues and paper between the lobes, the heart's town with the door open and the pack's strip, the Heart's telegraph with the Manafleur's portrait, the fight at 35 with the sixty (the Manafleur at three lands by turn six — the greed as designed); the bloom itself is proven by fixture and fuzz rather than the live walk. Server stopped; the crafted save removed from public/.

## Suggested next

1. **Chris (Part 6 human half)**: cut the flower — or try, rest, return — read the first cutting, begin a second road carrying what he carried out; verdicts on the cadence, `heartLife`, the jam, the art sheet (portraits ×4, cards ×4).
2. **Director round**: the withheld purse (deviation 2), the profile export (concern 5), the black petal's hue (concern 6).
3. **Planner**: the flex-slot pass with the heart-sim table (concern 1); the Manafleur-aware master (concern 3) if the fight reads passive; the printed face; phase two's data hooks are in place (`lawSequence` order/mode) when the inversion is designed.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck                        # project + the React screens (S27 fold)
pnpm heart-sim --games 30 --life 16   # the Manafleur at 30/35/40 vs the seven references
pnpm petal-sim / pnpm mirror-sim / pnpm guardian-sim
pnpm viewer → /world → Dev: complete all 15 + fell the five petals → the centre → the Corolla → the heart's town → Enter
pnpm knobs:doc                        # after knob edits
```
