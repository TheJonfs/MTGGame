# Handoff — after Session 07 (2026-08-20)

## State of the world

M3.75 is delivered: SanePolicyAgent plays watchable games (a bundled sane-vs-sane sample loads from the viewer's start screen), the `/gallery` route puts all 66 pool cards + tokens in front of Chris with filters, captions, a printed-scan toggle, an inspector modal, and an art-note flow into `docs/art/art-notes.md`, and the ADR-044 riders are done (DAMAGE `targetCardId`, ink transport glyphs, Rager on Apocalypse art, registry hygiene confirmed). 135 tests green including the new permanent 100-game/pairing sane smoke. `pnpm viewer` serves both routes; `pnpm agent-stats` reproduces every number below.

## Done this session

- **Part 1 (ADR-045):** `SanePolicyAgent` in `packages/agents` — the seven ratified rules as documented filters over the enumerated action set, private PRNG per ADR-015, card defs injected for land/cost/P-T/keyword lookups. `--agents sane,random|…` wired into `pnpm fuzz` and `pnpm play-random` (default stays random,random); fuzz reports now carry win tallies. Engine-correctness suites keep RandomAgent; new committed smoke: 100 games × 10 pairings sane-vs-sane, zero errors, zero MAX_TURNS (~5s). Stats below from `pnpm agent-stats` (committed CLI; in-memory SPELL_CAST counting, nothing saved).
- **Part 2 (ADR-046):** `/gallery` — pool registry is the membership/batch source (served raw by `/__registry`, parsed client-side; `cut` excluded, tokens included); our frame with per-card and global printed-scan toggles; captions name · SET #collector · artist from oracle.json; filters color/type/batch/deck + name search; click → 300px inspector modal; ✎ note buttons POST `/__art-note` → per-card bulleted entries in `docs/art/art-notes.md` (file created with lifecycle header; one demonstration entry under `blaze`; download fallback mirrors the flag button); ADR-043 size-comparison strip (battlefield tile / hand frame without oracle / inspector frame) whose subject follows the last-clicked card.
- **Part 3 (ADR-044):** DAMAGE object payloads carry `targetCardId` (+ schema comment; viewer log now names damaged creatures, "a creature" fallback for pre-S7 logs). Five transport glyphs rendered via the gemini-image skill and potrace-traced to 24px ink SVGs (play/pause/step ▶|/jump ▶▶/end ▶▶|; right-facing masters mirrored in CSS for the left buttons). Phyrexian Rager refetched: APC #49, Mark Tedin, PMEI files replaced, registry row rewritten. R-007/R-025 verified still current (principle 11).
- **DoD 1:** sane-vs-sane A-B seed 14 bundled as `sample-game-sane.json` + loader button — by eye: one mulligan (kept at 6), lands every turn, 21 spells cast, combat with blocks and 12 deaths, LIFE win turn 21.

## Stats (1,000 games/pairing; seeds 1..; reproduce with `pnpm agent-stats`)

**Sane vs random, per deck** (aggregated over 8 pairing/seating blocks, 4,000 games each): A 96.1%, B 96.0%, C 99.2%, D 100.0%, E 98.5%. No pairing/seating block below 89.7% (B vs D with random D). Sane never loses a D seat: 100.0% in all four D blocks.

**Sane-vs-sane vs the random baseline** (same 10 pairings, 1,000 games each):

| pairing | random: wins/terminations/turns | sane: wins/terminations/turns |
|---|---|---|
| A-B | 650-350, 942 LIFE/58 DECKED, 42.1 | 391-609, 1000 LIFE, 21.4 |
| A-C | 372-628, 999/1, 32.9 | 324-676, 1000 LIFE, 15.2 |
| A-D | 247-753, 972/28, 41.5 | 60-940, 1000 LIFE, 18.2 |
| A-E | 443-557, 971/29, 39.0 | 470-530, 1000 LIFE, 19.9 |
| B-C | 282-718, 944/56, 38.2 | 377-623, 1000 LIFE, 20.4 |
| B-D | 185-815, 767/233, 49.1 | 156-844, 990/10, 25.5 |
| B-E | 407-593, 818/182, 45.5 | 708-292, 993/7, 25.5 |
| C-D | 321-679, 975/25, 38.0 | 207-793, 1000 LIFE, 18.1 |
| C-E | 471-529, 988/12, 34.2 | 784-216, 1000 LIFE, 16.4 |
| D-E | 817-183, 875/125, 44.3 | 988-12, 1000 LIFE, 18.8 |

Mean turns halve (33–49 → 15–26); DECKED terminations collapse (749 → 17 across 10,000 games).

**≥5-mana casts per game** (the number Chris wanted; 10,000 games each condition):

| card | random | sane | ratio |
|---|---|---|---|
| siege_gang_commander | 0.126 | 0.234 | 1.9× |
| pelakka_wurm | 0.044 | 0.156 | 3.5× |
| serra_angel | 0.139 | 0.330 | 2.4× |
| drana_kalastria_bloodchief | 0.115 | 0.262 | 2.3× |
| wrath_of_god | 0.083 | 0.146 | 1.8× |

## Deviations from the brief

1. **Block rule: the "lethal-threatening" gate wasn't implementable as a pure function** — `GameView` carries no combat state (who's attacking), so total incoming damage can't be computed. Shipped: block when the blocker kills the attacker (trades OK) or safely absorbs ≥2 (attacker power ≥ 2 and blocker survives); never chump. Documented in the agent header. Ruling wanted: accept, or add `combat` to the view and revisit.
2. **The agent carries two pieces of per-instance memory** despite Part 1's "every filter is a pure function over (view, request)": London mulligan count (the view always shows 7 cards) and attackers-already-blocked this combat (keyed by `view.turn` — a purpose-based reset can silently span turns because single-option requests are auto-taken, ADR-014). Both are view gaps, not policy sophistication. Ruling wanted: bless the memory, or add `mulligans`/`combat` view fields.
3. **Menace attackers are never chosen as block targets** (two-blocker planning felt like M4 evaluation); when the enumerator withholds "done" mid-menace-block, the forced second blocker is random. Documented.
4. **`pnpm agent-stats` committed** beyond the brief's letter so the handoff tables are reproducible, matching the "handoff numbers from the CLI" convention.
5. **`ui` now depends on `sim`** via a new browser-safe `@shandalar/sim/decks` subpath (deck-membership filter). Direction is legal (ui → sim), but S6 described ui as engine/cards/core only — flagging the widened dependency.
6. **The size strip's battlefield tile is a def-only re-render** (`StripTile`), not the stateful `CardTile` (which needs a live EngineCtx/GameObject). ~15 duplicated presentation lines; folding them would mean refactoring CardTile beyond scope.

## Concerns

1. **What sane's rules distort most (M4 baseline notes, as the brief requested):** (a) the 80%-cast rule makes it an *activation* machine — the sample game has 22 activations/28 ATTACHED events, mostly Bonesplitter/Warhammer re-equip churn between own creatures; M4's evaluator needs "re-equipping the same host is worth ~0" alongside S6's Control-Magic-self-enchant note (that one still stands — sane targets randomly too). (b) Attack-with-everything + never-chump systematically favors removal-heavy decks: D's win rates jump from 65–82% (random) to 79–94% (sane mirrors). (c) All-in attacking means sane loses creatures to blocks it "should" foresee — fine for a floor, but expect M4's first win to be combat evaluation.
2. **Base P/T only in combat filters:** the view has no live characteristics, so anthem/equipment/counter pumps are invisible to attack/block decisions (a 1/1 wearing +3/+0 still reads 1/1). Same root cause as deviations 1–2: the view is thinner than policies need. Suggest deciding once, at M4 design time, what the agent-facing view owes: `combat`, `mulligans`, live P/T (or a characteristics helper over the view).
3. **Gallery at scale is a non-issue** (expected concern): 66 frames + art on one page render instantly, lazy-loaded, no jank; scrolling and filters feel native. One real finding: at 180px the white-mana glyph at 11px on light wash bands nearly vanishes — an icons/frame contrast note for the planner (visible on any W card's name strip).
4. **`window.prompt` for note entry is functional but crude** — fine for a Chris-only tool; if notes get heavy use, an inline text field is a small follow-up.
5. **Registry parsing is by column position** (`| cardId | name | status |`…) in the gallery; a registry column reorder would silently misread statuses. Acceptable for a dev tool reading a repo-canonical file; noting it because principle 11 has made me suspicious of silent doc/format drift.

## Registry entries added/changed

- pool-registry: `phyrexian_rager` printings row → `apc / 49 / Mark Tedin / 3addf34c…` (art:fetch rewrite of the whole printings section; only that row changed).
- rules-registry: untouched — no new rules (ADR-045 keeps policies out of the engine); R-007/R-025 verified current.

## Test status

135 passing / 0 skipped / 0 flaky, 12 files: the S6 134 plus `sane-smoke.test.ts` (100 games × 10 pairings sane-vs-sane, zero errors, zero MAX_TURNS). `pnpm typecheck` + `tsc -p packages/ui` clean. Suite ~12.5s.

Fuzz this session: 3,000 mixed-agent smoke games during development (sane,sane / sane,random / random,sane × 1,000) — zero exceptions; the 20,000-game sane-vs-random and 20,000-game uniform-agent stats runs above were also error-free. No engine changes beyond the DAMAGE payload field, no new cards, so no random-agent re-baseline was needed.

## Suggested next

Per the roadmap: the **M4 design conversation**. Inputs this session produced for it: the view-owes-policies question (Concern 2 / Deviations 1–2 — decide `combat`, `mulligans`, live-P/T access as one ADR), the evaluator seed notes (equip churn, self-Control-Magic, chump/no-chump), and sane as the sparring floor with per-deck baselines to beat. Small rider candidates for whichever brief comes next: inline note field in the gallery (Concern 4), W-glyph contrast on light bands (Concern 3), and a `pnpm gallery` alias that just prints the `/gallery` URL. For Chris meanwhile: `pnpm viewer` → "Load the sane-agents sample (S7)" to watch sane play, and `/gallery` to browse and annotate — notes land in `docs/art/art-notes.md` for the planner.

## How to run

```
pnpm install
pnpm viewer                          # viewer at /, gallery at /gallery
pnpm play-random --seed 14 --decks A,B --agents sane,sane --save results/g.json
pnpm fuzz --games 100 --seed 1 --agents sane,random   # any of random|sane per seat
pnpm agent-stats                     # the handoff's stats tables (~4 min); --games 20 for a quick pass
pnpm test                            # 135 tests incl. sane smoke (~12.5s)
```
