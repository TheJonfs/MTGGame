# Handoff — Session 20 close, RECONSTRUCTED (filed S21 Part 0, 2026-08-24)

*Per ADR-080's process note: the S20 close's narrative handoff was overwritten by the
same-day playtest handoff (`handoff-s20b.md`) before the numbered-handoff rule existed.
This document regenerates the close's ground truth from the repo — the pool census, the
registry additions, the save-v5 field list, and the kill tables re-emitted under the
current 30/60/90 labels. The close commit is `4adbb8b`; its rulings stand as evidenced
by repo state (ADR-080). Nothing here is remembered; everything is derived.*

## The pool at S20 close — and the 147-vs-140 resolution

Loader census (`data/cards`, ground truth): **147 defs** = 127 shop-tiered (T1 59 · T2 41 · T3 11 · R 16) + 9 token defs + 6 prizeOnly (Black Lotus + the five Moxen) + 5 basics.

The predicted "pool → 140" (dungeon-design §10 / ADR-079: 105 + 20 duals + 6 enablers + 4 legendaries + 5 Moxen) reconciles exactly:

- The **105 base was the S19 acquirable pool** — the S19 def count (111) minus the 5 basics and the prizeOnly Black Lotus, which the prediction's arithmetic never carried.
- The **batch prediction (35) omitted the Elemental token def** (`elemental_5_3_g`, Titania's token — a def, not a pool card).
- **140 + 5 basics + 1 Lotus + 1 token def = 147.** The S20 batch was 36 defs (10 ABU duals + 10 shocklands + 5 cycling lands + Evolving Wilds + 4 legendaries + 5 Moxen + the token); 147 − 36 = 111 at S19 close. ✓

No card is missing or surplus — the two numbers count different classes (acquirable pool vs loader defs). Recommend future pool statements name which count they use.

## Rules-registry additions (S20, verbatim ground truth in `docs/registries/rules-registry.md`)

- **R-057** — unconditional hand reveal on caster-chooses discard (S19 round 2 behavior; row backfilled S20 per ADR-079).
- **R-058** — the payment solver (ADR-004 second amendment): pip-to-producer assignment (Kuhn's), WUBRG pip order, mono-first, deterministic/replay-stable; the pre-S20 per-color count admitted Hall violations. *(Post-close playtest amendment rides in the same solver: creatures-last dominates keep-duals-free — a preference ordering, not a rules change; ADR-080.)*
- **R-059** — A9 conditional enters-tapped: the land play asks (logged), life ≥ cost gate, paying to 0 legal+lethal, every put path enters tapped choice-free; simplification: play-time request, not a replacement layer.
- **R-060** — A8 "up to" targeting: `count: {min,max}` last-spec rule, subset combos, `distinctFromPrior`, `targetSpec` fan-out with per-target fizzle.
- **R-061** — ATTACKS trigger collection (first collector; observed shapes await a customer).
- **R-062** — dungeon duels world-side: interior life as startingLife with finalLife carry, the law on both seats of every interior duel, cumulative empowerment packages, escrow, ordinary world penalty on loss — all ADR-002 modifiers, no engine changes.

## world-save-v5 — the blessed field list (from `packages/world/src/state.ts` at the close)

Top level: `catalogVersion, seed, difficulty, map, player, opponents, rng, duels, gameOver, shops, visits, lastTownIndex, decks, activeDeckName, provenance, explored, quests, manalinks, sieges (reserved, []), dungeons (v5: per-dungeon {cleared, resets}), activeDungeon (v5: DungeonRun | null — reload resumes mid-dungeon), strongholds (v5, reserved, [])`.
Player: `name, position, worldLife, gold, collection, basicLand, stepsTaken, renown, starterId`.
DungeonRun: `dungeonId, kind, enteredFrom, grid{width,height,passable}, explored, position, entry, guardianAt, steps, interiorLife, escrow{gold,cardIds}, minions, treasures, residentCatalogId?`.
*(The playtest follow-on added v6: `player.renownByColor` — see `handoff-s20b.md`; listed here only to mark the v5 boundary.)*

## Guardian kill tables — re-emitted under the 30/60/90 labels (`pnpm guardian-sim --games 15`, 2026-08-24, post-thresholds change)

Guardian win % vs the 7-deck reference set (five starters + slice C/D, journeyman, world life 10; law both sides; 105 games/cell):

| Guardian | @0 | @30 | @60 | @90 |
|---|---|---|---|---|
| Reya Dawnbringer (mox_w, life 16) | 70 | 72 | 83 | 90 |
| Arcanis the Omnipotent (mox_u, life 14) | 39 | 55 | 86 | 93 |
| Drana, Kalastria Bloodchief (mox_b, life 15) | 78 | 79 | 96 | 99 |
| Drakuseth, Maw of Flames (mox_r, life 16) | 71 | 70 | 92 | 98 |
| Titania, Protector of Argoth (mox_g, life 15) | 46 | 44 | 80 | 94 |

Tier *contents* are unchanged from the S20 tables (60/120/180 labels — Reya 70/75/78/92 · Arcanis 39/52/82/91 · Drana 78/82/93/99 · Drakuseth 71/81/79/97 · Titania 46/49/72/95); the relabel is arrival timing, and the fresh run reproduces the same gradients within 15-game noise. Dawdling now bites at 30 steps; OQ-15 (base lives at @0) remains the open tuning question.

## Test baseline

At the close commit (`4adbb8b`): FUZZ_FULL 302/302. Current baseline at S21 start (`ba1ad72`): **FUZZ_FULL 304/304** (the playtest rounds added the solver creatures-last and renown-by-colour regressions), typecheck clean, fuzz:duals 600 games clean.
