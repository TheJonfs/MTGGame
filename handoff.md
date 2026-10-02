# Handoff — after Session 50 (2026-10-03)

## State of the world
**Red has six new cards for Limited and plays far better for it.** Pool 238 → 244: Flametongue Kavu, Furnace Whelp, Shocking Sharpshooter, Dragon Fodder, Seasoned Pyromancer and the custom Rage Cobra, with one new engine word (R-102). In Sealed the builder now plays red in 22% of decks (was 10%); forced red pairs win 41–45% (were 33–37%); in drafts red seats win 45% (were 38%). The AI's burn misuse (found after S49) is fixed and shows in the numbers — Lightning Bolt's Sealed lift went from −3.7 to +2.0. The Convocation event itself is unchanged apart from a five-row entrance table and a label. **Rage Cobra's art is four candidates with Chris; Shocking Sharpshooter has no art** (Scryfall has no high-resolution scan yet). S46–S50 are committed locally and **not pushed**. `pnpm typecheck`, `pnpm test` (861) and `pnpm build:web` pass; ladder mirror gate PASS.

## Done this session
- **Part 0**: rulings filed (`docs/decision-updates/s50.md`); the entrance table at five rows (Standard +0 / +2 / +4 / +4 / +6); the prize screen's columns read "Swiss record" / "Swiss points" after a bracket.
- **Part 1 — the six cards**, Oracle re-verified on Scryfall; fuzz first (960 random + 320 heuristic games over two mixed lists, 0 errors; `s50-fuzz.test.ts`), then eleven fixtures (`s50-red.test.ts`): the Kavu killing, the Kavu alone shooting itself, the Kavu with only our creature; the Whelp's pump and its end of turn; the Sharpshooter on tokens, on its twin, not on itself or the opponent's; the Pyromancer's count at 2 / 1 / 0 nonland and with an empty hand, and its graveyard activation; the Cobra on the opponent's Soul Warden and not on ours. Art fetched for four of the five real cards.
- **Part 2 — the AI** (books 89–92; ladder PASS):
  - *Flametongue Kavu* — the four goes at the best creature it **kills** (it took the biggest creature before, killable or not); with only our own side to hit, at the one that survives or costs least; the cast is held when the trigger could only hurt us, and credited when it kills.
  - *Furnace Whelp* — the pump scored +0.2 at any moment and would have drained the lands in the first main phase (the Warhammer's churn again). It is now a combat play only: on an unblocked attacker, or in a single fight it then wins and survives.
  - *Seasoned Pyromancer* — our own discard gives up a land first once five lands are in play and hand together; the graveyard activation waits for idle mana.
  - *Shocking Sharpshooter*, *Rage Cobra* — already right under books 87 and 83; pinned.
  - *The burn investigation* — done after S49 and reported there (book 88; the builder's tribe rule); its effect is in the tables below.
- **Part 3 — the pick rule**: lands are flat and low until pick 8, then their rating inside the seat's colours; the colour bonus runs at half its slope from pick 4 and full from pick 8.
- **Part 4 — measured**: tables below.

## The six cards, in Sealed (200 pools, 20,000 games, at their tier priors)

| card | tier | seen | lift (points) | cast when drawn |
|---|---|---|---|---|
| Flametongue Kavu | 2 | 1,966 | **+4.6** | 85% |
| Shocking Sharpshooter | 1 | 594 | **+4.4** | 90% |
| Furnace Whelp | 2 | 2,232 | −0.1 | 78% |
| Seasoned Pyromancer | 3 | 2,519 | −0.4 | 76% |
| Rage Cobra | 2 | 2,189 | −0.7 | 84% |
| Dragon Fodder | 1 | 355 | −2.9 | 86% |

Two move up clearly (the Kavu and the Sharpshooter are now red's two best cards by lift); three sit at their decks' average; Dragon Fodder is below it on a small sample. Red's older cards, on the same run: Lightning Bolt **+2.0** (was −3.7), Char **+2.0** (was −2.2), Hordeling Outburst +1.3, Goblin Chieftain +0.2, Siege-Gang Commander +0.2 (was −4.6), Guttersnipe −0.7 (was −5.9).

## Sealed — before (S49, v1 decks) and after

| | before | after |
|---|---|---|
| a colour's share of decks | W 52 · U 36 · B 65 · **R 10** · G 39 | W 45 · U 33 · B 56 · **R 22** · G 45 |
| red pairs chosen | 19 of 200 | 44 of 200 |
| red pairs' win rates (chosen) | RG 41 · WR 38 · BR 39 · UR 42 | RG 40 · WR 46 · BR 43 · UR 41 |
| splashing | 59 | 60 |

## Forced red pairs — forty decks a pair, against a fixed field

| pair | forced, before | forced, after | forced − chosen, before | after |
|---|---|---|---|---|
| WR | 35% | **41%** | −7.7 | −3.2 |
| UR | 37% | **45%** | −8.2 | −4.5 |
| BR | 35% | **45%** | −7.9 | −3.9 |
| RG | 33% | **41%** | −7.6 | −5.7 |

Red's forced mean: 35% → 43%. The gap to the deck the builder would rather make has roughly halved. (This is the six cards, the burn rule and the builder's tribe rule together; the burn rule alone was worth about a point when measured on its own.)

## The draft — 50 pods, with the two pick-rule changes and the six cards

| | before (S49) | after |
|---|---|---|
| seats per colour | W 43 · U 38 · B 51 · **R 27** · G 42 | W 42 · U 37 · B 47 · **R 33** · G 42 |
| a colour's seats win | W 54 · U 54 · B 49 · **R 38** · G 51 | W 52 · U 55 · B 48 · **R 45** · G 50 |
| pods with four or more seats on black | 33 of 50 | 27 of 50 |
| a seat's colours last change at pick | 4.9 | 5.6 |
| seats whose colours change after pick 8 | 12% | **16%** (wanted 20–30%) |
| the pod's spread (best seat − worst) | 53 points | 50 |

## The Open's two red lists (the lists unchanged; the AI changed)
Warband 60% → **59%**; Tally 39% → **37%** against the field (1,100 games each). Both inside the noise. Neither list was amended, and neither new card was tried in them — whether the Kavu or the Whelp earns a slot is untested and the planner's call.

## Deviations from the brief
1. **Shocking Sharpshooter is encoded as Scryfall has it, not as the brief does**: Tarkir: Dragonstorm #121, a **1/3 Human Archer** (the brief: a 2/2 Lizard Archer from Bloomburrow), and "target opponent" (the brief: "each opponent"). No Bloomburrow card of that name exists.
2. **Its targeting is simplified** to each opponent — the pool has no player-targeting word for a trigger and nothing that makes a player an illegal target, so the two read the same in play.
3. **Flametongue Kavu's printing is Planeshift #60** (the brief: Invasion).
4. **The Kavu is not "cast regardless"** on an empty table: its mandatory trigger would hit our own creature or itself (CR 603.3d). The AI holds it unless one of ours survives four. With any creature across the table it is cast whatever it can kill, as the brief says.
5. **The commitment share missed its target**: 16% of seats change colours after pick 8 against the 20–30% wanted. The slope before the cut is half, as the brief specified; the step up at pick 8 (0.20 → 0.50) then locks the seat. *Rule on*: a lower full slope, or a later cut.
6. **Hard's entrance rows four and five** (+6, +8) are mine; the brief gives Standard only.
7. **The rating was not updated.** The six read their tier priors. A candidate built by pooling this run with the older Sealed runs still marks red *down*, because those older games were played before the burn fix (see Concern 2); I did not adopt it.
8. **The "racing with a low-toughness board" term was not built** — the probe does not support it (below).

## Concerns
1. **Red is better, not level.** Forced red pairs are at 41–45% where white-blue is 51%; red seats in a draft win 45%. The new cards closed about half the gap. What is left is spread across red's old commons (Goblin Piker, Raging Goblin, Gray Ogre, Hill Giant are still in the packs) rather than in one fault.
2. **The rating's Sealed evidence is now of two kinds and should not be pooled.** Every Sealed game before this session was played with the burn misuse and with Goblin Grenade in Goblin-less decks; red's cards carry that in their lift. The honest next rating is measured on post-fix runs only (this session's 20,000 games, plus a fresh noise run), not added to the old sample. Until then v1 under-rates red and the builder under-plays it — 22% of decks is with red's old cards still marked down.
3. **The racing probe found no pilot fault** (720 games, red decks against others): red attacks with 42% of its ready creatures against 46%; 16% of its attackers face an untapped blocker that would kill them and live, against 17%; it loses 4.0 creatures a game to 3.3 and kills 3.5 to 2.9. Red's attackers average 2.4/2.2 against 2.7/2.6. The pilot treats red's creatures as it treats anyone's; they are simply smaller. I would not build a racing term on this.
4. **Dragon Fodder at −2.9** is a small sample (355), but two 1/1s for two mana may just be weak in this pool's Sealed — unless a Sharpshooter is out, which is rare. Worth a second look after more games.
5. **The Tally is an aggro list**, so the face-burn hold (book 88) does not touch it; a red *midrange or control* Constructed list would now hold its burn for creatures until the opponent is at eight. No authored list is in that position that I know of, and the campaign's sims were not re-run.
6. **Shocking Sharpshooter has no art** and will show our rendered frame until Scryfall has a high-resolution scan; `pnpm art:fetch` will pick it up when it does.
7. **Seats still fight over black** in half the pods (27 of 50). The rating still favours black; see S49's Concern 2.

## Registry entries added/changed
- **R-102** — "for each nonland card discarded this way" (`discardedNonland`), with CR 608.2c / 608.2h / 701.8, and 603.3d → 601.2c for the Kavu's forced target — verified against the Comprehensive Rules this session.
- **Pool registry** — the Session 50 section (six rows); the printings section regenerated by `art:fetch`.
- **Knobs** — `convocationEntrance` at five rows; `docs/knobs.md` and `docs/reference/` regenerated.

## Test status
`pnpm test`: 89 files passed, 1 skipped; **861 tests passed, 2 skipped** (the standing two). New: `s50-fuzz.test.ts` (2), `s50-red.test.ts` (11), books 89–92. Amended pins: the pool size (260 with tokens), the shop tiers' tally, the entrance values, the pick rule. Ladder mirror gate PASS (run alone, 244 s).

Not verified: the six cards played by hand in the browser; Rage Cobra's printed face (it does not exist yet); the campaign's sims after books 88–91; the Lab worker's rate (still).

## Suggested next
**S51 — the drafter as a screen.** Estimate: **one session.** Pick-and-pass with seven AI seats on the pick rule, the human's 45 picks becoming the event's pool, then the existing build → rounds → Umbel flow. Two things first, both small:
- a clean rating update from post-fix Sealed runs only (Concern 2) — it will lift red's share again and is the fairest field to draft against;
- the commitment slope (Deviation 5).

**For Chris**: pick the Cobra's art (four sent), then the printed face follows the usual way; and the standing request — build or draft red by hand once, now that it has cards worth playing.

## How to run
```
pnpm viewer                                   # /convocation; the six are in the Plane's packs
FUZZ_FULL=1 npx vitest run packages/sim/src/s50-fuzz.test.ts
npx vitest run packages/engine/test/s50-red.test.ts packages/agents/src/book-of-shame.test.ts
pnpm sealed-sim --pools 200 --games 10 --seed 48 --shard 0/6 --out analysis/runs/sealed50_shard0.json   # ×6
pnpm sealed-sim --forced --games 4 --pairs WR,UR,BR,RG --tag forced50 --shard 0/6                        # ×6, then --forced-report
pnpm draft-sim --pods 50
pnpm open:rr --games 100 --only tally --shard 0/4 --out analysis/runs/open50_tally_0.json                # ×4, then --merge
pnpm ladder
pnpm typecheck && pnpm test
```
