# Handoff — after Session 45 (2026-09-30)

## State of the world

**Cinquefoil v1 is live on Vercel; the tier-3 round is in (pool 227 → 233, bestiary 17 → 23).** Session 45 added six tier-3 cards — Dragon Mage, Guttersnipe, Dread Presence, Emeria Angel, Seedborn Muse (real, Oracle verified, the printings Chris chose) and **Tidewall** (custom; the classical oil, Chris's printed face) — each fielding as a roaming tier-3 beast on both maps with its own thirty-card list, row, parley and portrait. The engine grew R-099's four small words. **ADR-141**: the newer tier-3 beast guards each colour's Wellhouse (all five change guard). The AI learned five shapes (books 74–77). The six beasts were swept against the starters and the post-lairs references, and Chris tuned three (the Guttersnipe, the Dread Presence, the Emeria Angel). The lairs' Chronicle lines are in. `pnpm test` = 783 green; `pnpm typecheck` clean. **Not pushed** (Chris's call).

## Done this session

- **Part 0**: `docs/decision-updates/s45.md` — ADR-140, ADR-141, the lairs' fall lines (as `fall` on the kinds; the Chronicle prefers them), and Chris's kickoff answers (price by formula; ADR-141 in all five colours; the parley field; the printings; the tuning; the portraits).
- **Part 1 — the cards**: six defs (`data/cards/`); `art:fetch` overrides — Guttersnipe **RVR #332**, Dragon Mage SCG #87, Seedborn Muse LGN #138 (old frames), Emeria Angel ZEN #11, Dread Presence M20 #96; `docs/art/printings.md` rows. **R-099**: `damage.to: "opponent"` (Guttersnipe), `discard.count: "all"` (Dragon Mage), `condition.subtype` on the land-enters collector (Dread Presence — a dual's Swamp type counts), the static `untapDuringOthersUntap` read by the untap step (Seedborn Muse; summoning sickness untouched). **Fuzz first** (2,640 random + 1,320 heuristic expansion games, zero errors), then ten fixtures (`packages/engine/test/s45-tier3.test.ts`). Tidewall: four card-art candidates (oil kept), printed face verified word-for-word and installed.
- **Part 2 — the beasts**: six lists in `EXPANSION_DECKS` (the brief's, tuned — below), six `opponents.json` rows (tier 3, master, worldLife 12, anteCount 2; buy-off verbs / refusals per Chris), twelve portrait candidates → six kept with their chips. **ADR-141** in `floodLairResidents`: the catalog's order is the rows' age, the last top-tier beast of a spoke guards the spring — Emeria (W), Tidewall (U), Dread Presence (B), **Guttersnipe (R)**, Seedborn Muse (G).
- **Part 3 — AI** (probe-measured first; books 74–77, each failing on the old agent): Dread Presence's mode by the board (was the draw 95/95 → the burn 76, the draw 9); Tidewall's block trigger priced (`blockReturnValue` — the defender's gain, the attacker's cost) and **graveyard-return trigger targets scored, never random** (the dearest spell back — Counterspell first; Gravedigger and the Usher gain too); the spell-payoff hold (a face spell waits for a Guttersnipe/Pyromancer in hand — removal, lethal, low life and a payoff already out never wait); Seedborn Muse's attack pays no deterrence. Ladder PASS; mirror delta 0 (D ±1).
- **Part 4 — measure**: `mage-sweep --part 6` extended (6b: the tier-3 beasts vs the post-lairs references), run at both phases before and after the tuning; the density read (below); the Wellhouse tie rule pinned.

## The sweep — the starters' win rate against each tier-3 beast (phase one; the band is 30–45)

| beast | as listed | tuned (Chris) | post-lairs refs, phase two (WR / UB) |
|---|---|---|---|
| Dragon Mage | 32% | — | 88 / 79 |
| Tidewall | 45% | — | 88 / 92 |
| Seedborn Muse | 28% | — | 80 / 86 |
| Guttersnipe | 21% | **30%** (row −4 life) | 84 / 63 → 89 / 71 |
| Dread Presence | 12% | **30%** (−Doom Blade −Terror +2 Swamp; −6 life) | 78 / 73 → 91 / 79 |
| Emeria Angel | 8% | **27%** (−2 Pacifism −Swords −Anthem +4 Plains; −4 life) | 68 / 72 → 90 / 85 |
| *Serra / Formation / Specter / Siege-Gang / Wurm (unchanged)* | *22 / 28 / 59 / 28 / 26* | | |

Chris: the Emeria Angel stays a hard fight on purpose — a player first dropped into the world should fear a tier-3 beast. The old tier-3 beasts mostly sit under the band too (the Serra at 22 with her −4 offset); the band is a floor the bestiary as a whole does not yet meet.

## The Wellhouse re-measure (ADR-141; the post-lairs references' win rate against the guard at its phase-two row, WR / UB — the lair's own life bonus not included)

W Serra 63/78 → Emeria 90/85 · U Formation 77/82 → Tidewall 88/92 · B Specter 96/85 → Dread Presence 91/79 · R Siege-Gang 84/82 → Guttersnipe 89/71 · G Wurm 63/81 → Seedborn 80/86. The springs got easier for the finished deck except black and red's UB row.

## Density (the brief's Part 4 question)

**Unchanged.** `rollTemplate` over 4,000 rolls per ring × colour, the catalog with and without the six rows: the beast share (35 / 50 / 50%) and the tier-3 beast share (0 / 8 / 24%) are identical in every cell — the share is `beastShare`'s and the split the ring weights'; the new rows only divide a colour's tier-3 slot (red three ways, the others two). Red's wilds are not denser; nothing for the planner to rule. The S37 spawn pin was re-baselined for the same reason (its tier split identical, only the templates filling tier 3 moved).

## Deviations from the brief

1. **The price is the formula** (40–80 gold), not "60 gold, the tier's price" (Chris).
2. **The parley verbs** are the player's buy-off actions, not the beasts' approach; three beasts are not buyable (Chris's pen from the implementer's drafts).
3. **Guttersnipe's printing** is Ravnica Remastered #332 (Chris) — the brief's "M13" was an error.
4. **Two more words than the brief counted** (damage to each opponent; the subtype filter on landfall) — small, in R-099.
5. **ADR-141 changes all five Wellhouses**, not only red's (Chris: apply it; re-measure).
6. **Phase one's bestiary lairs now pick among a spoke's tier-3 beasts** (seeded) — the S18 rule was already "a random top-tier beast", and each spoke now has two (red three). Not ruled by the brief; a consequence of the rows roaming both maps.
7. **The Dragon Mage's AI line** ("keeps burn in hand under it — the wheel refills") was not built: the probe showed it attacks whenever it can (a 7-drop on twelve lands rarely lands), and the line reads both ways (spend before the wheel discards, or hold because it refills). For the planner to restate if wanted.

## Concerns

1. **The old tier-3 bestiary sits under the 30–45 band** (Serra 22, Formation 28, Siege-Gang 28, Wurm 26; the Specter over at 59). The new six are tuned into it or held there by Chris's choice; the old five were not touched.
2. **Graveyard-return trigger targets were random until now** (the classification table calls the return "neutral") — Gravedigger's and the Usher's choices change with this session; the ladder moved ±1 on one mirror only, but the lord/court sims that use those cards were not re-run.
3. **The Tidewall mirror decks itself** in heuristic play (Hedron Crab mills the opponent every time — correct — so two Crab decks mill each other out); a beast-vs-beast pairing only, never met in the world.
4. **A sed in my own session renumbered "ADR-104" inside five unrelated files** while renaming a draft R-number; caught the same minute from the diff and restored from git (no commit carried it). The lesson is principle 11's: a scripted replace must be scoped to the files meant.

## Registry entries added/changed

R-099 (rules). Pool rows: the six S45 cards (`## Session 45 additions`). Knobs: none. Data: six cards, six rows (three with `worldLifeOffset`: Guttersnipe −4, Dread Presence −6, Emeria −4), six `EXPANSION_DECKS`, `quests.json` lair `fall` lines. Types: `damage.to "opponent"`, `discard.count "all"`, effect `untapDuringOthersUntap`; `blockReturnValue`, `spellPayoffHoldGated`.

## Test status

**783 passed / 2 skipped** (from 768: +10 fixtures, +4 books, +1 portraits installed; pins updated with reasons — the pool 242 → 248, the catalog 32 → 38 opponents / 17 → 23 beasts, the T3 tally 11 → 17, the Wellhouse names, phase one's lair residents as a set, the spawn pin re-baselined). Ladder PASS (mirror delta 0, D ±1). Sweeps: part 6 at both phases, before and after tuning (100 games per pairing each).

## Suggested next

1. The old tier-3 beasts against the band (Concern 1) — the same sweep, a life offset or a list trim per beast.
2. Re-run the lord/court sims whose decks carry Gravedigger or the Usher (Concern 2).
3. Chris's next run: a tier-3 beast early (the Emeria Angel's fear), a Wellhouse under its new guard.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm exec vitest run packages/engine/test/s45-tier3.test.ts
pnpm fuzz:expansion --games 20 --agents random     # and --agents heuristic
pnpm mage-sweep --games 100 --part 6 --baseline none              # + --phase 2
pnpm ladder --games 100 ; pnpm reference ; pnpm knobs:doc
pnpm build:web && git push                           # a push deploys to Vercel
```
