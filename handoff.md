# Handoff — after Session 07 (2026-08-20)

## State of the world

M3.75 is delivered: SanePolicyAgent plays watchable games (a bundled sane-vs-sane sample loads from the viewer's start screen), the `/gallery` route puts all 66 pool cards + tokens in front of Chris with filters, captions, a printed-scan toggle, an inspector modal, and an art-note flow into `docs/art/art-notes.md`, and the ADR-044 riders are done (DAMAGE `targetCardId`, ink transport glyphs, Rager on Apocalypse art, registry hygiene confirmed). A same-day feedback round from Chris added rule 8 (target-side preference — no more Bolting your own face), the retro frame (saturated 93–97-style body color, real-card 63:88 proportions in full mode, 5:4 art window, high-contrast mana chips in costs and rules text), and our own rendered token art. 135 tests green including the new permanent 100-game/pairing sane smoke. `pnpm viewer` serves both routes; `pnpm agent-stats` reproduces every number below.

## Done this session

- **Part 1 (ADR-045):** `SanePolicyAgent` in `packages/agents` — the seven ratified rules as documented filters over the enumerated action set, private PRNG per ADR-015, card defs injected for land/cost/P-T/keyword lookups. `--agents sane,random|…` wired into `pnpm fuzz` and `pnpm play-random` (default stays random,random); fuzz reports now carry win tallies. Engine-correctness suites keep RandomAgent; new committed smoke: 100 games × 10 pairings sane-vs-sane, zero errors, zero MAX_TURNS (~5s). Stats below from `pnpm agent-stats` (committed CLI; in-memory SPELL_CAST counting, nothing saved).
- **Part 2 (ADR-046):** `/gallery` — pool registry is the membership/batch source (served raw by `/__registry`, parsed client-side; `cut` excluded, tokens included); our frame with per-card and global printed-scan toggles; captions name · SET #collector · artist from oracle.json; filters color/type/batch/deck + name search; click → 300px inspector modal; ✎ note buttons POST `/__art-note` → per-card bulleted entries in `docs/art/art-notes.md` (file created with lifecycle header; one demonstration entry under `blaze`; download fallback mirrors the flag button); ADR-043 size-comparison strip (battlefield tile / hand frame without oracle / inspector frame) whose subject follows the last-clicked card.
- **Part 3 (ADR-044):** DAMAGE object payloads carry `targetCardId` (+ schema comment; viewer log now names damaged creatures, "a creature" fallback for pre-S7 logs). Five transport glyphs rendered via the gemini-image skill and potrace-traced to 24px ink SVGs (play/pause/step ▶|/jump ▶▶/end ▶▶|; right-facing masters mirrored in CSS for the left buttons). Phyrexian Rager refetched: APC #49, Mark Tedin, PMEI files replaced, registry row rewritten. R-007/R-025 verified still current (principle 11).
- **DoD 1:** sane-vs-sane A-B bundled as `sample-game-sane.json` + loader button (regenerated at seed 22 after rule 8) — by eye: one mulligan (kept at 6), lands every turn, 23 spells cast, combat with blocks, LIFE win turn 23.
- **Feedback round (same day, Chris-directed):**
  - **Rule 8, target-side preference:** casts/activations classify their targeted effects over the vocabulary (damage/destroy/bounce/counter/restrict/steal/negative pump → prefer opponent-side target tuples; positive pump/keyword grants/equips/draw auras → own side; uniform within the preferred set, fall back to all if none). Verified: 300 games produced 0 self-face burn hits vs 384 at the opponent's face. Trigger targets stay uniform — see Concern 6.
  - **Frame, retro pass:** saturated 93–97-style body colors across the whole frame (gold for multicolor), color-tinted parchment text panels, 5:4 art window matching the classic printed art box (measured from the Scryfall crops — no more top/bottom cropping), full-mode frames at real-card 63:88 proportions with the P/T cartouche clear of text; mini/hand frames keep their compression (ADR-043). Mana symbols everywhere are now chips (parchment disc, ink ring) — in cost rows and substituted inline for `{W}{2}{T}`-style tokens in rules text.
  - **Token art:** our own renders (ink-and-wash goblin and soldier via the gemini-image skill; subjects `docs/art/subjects/token-*.md`), 5:4 crops in `assets/generated/tokens/`, wired through a now-live `art.asset` field on the token defs; battlefield tiles, gallery, and frames all use them. Chose own art over Scryfall pulls: tokens are custom defs (no oracle-grounding stake) and it keeps `art:fetch` real-cards-only.
- **Feedback round 2 (same day, Chris-directed):**
  - **Mana chips recolored in the real-symbol style:** classic pale saturated disc colors (cream/light-blue/gray/salmon/light-green — colors only, not WotC's images) under our ink glyphs; generic/X/tap ride the neutral gray. Contrast problem solved at every size.
  - **Textured frame bodies:** eight rendered seamless textures (W ivory marble, U indigo water-wash, B dark crackle, R mottled red stone, G green-stained wood grain, gold hammered metal, artifact granite, land tan strata) via the skill — subjects `docs/art/subjects/frame-texture-*.md`, 512px tiles in `assets/generated/surfaces/`, tiled at 280px behind the panels. Five needed descriptor tightening and three of those also needed `--force` (conditioning kept reasserting bricks/boulders — the S6 lesson again).
  - **Card face font:** IM Fell English (SIL OFL, bundled woff2, no CDN) for name strips and type lines — old-print flair without WotC's fonts; body text stays in the workhorse faces.
- **Feedback round 3 (same day, Chris-directed, from his screenshot):**
  - **Bold chip glyphs:** the traced mana/tap icons are thin-stroke outlines that vanish at 13–20px chip size; chips now use derived bold variants (`chip-*.svg` — same paths, SVG stroke-width 500 in path space fattens every line). Verified legible at gallery and modal sizes.
  - **Aged text field:** game-text and type-line panels moved to a darker, yellower parchment base (`--parchment-text` #e3d2a4, still color-tinted per identity) — the old-school yellowed text box.
  - **Names directly on the frame:** the name band is gone; card names (IM Fell) sit on the textured body itself, light-on-dark with a soft shadow (ink on white/marble), classic-design style.
- **Feedback round 4 (same day, Chris-directed):**
  - **Red names go ink** like white — the red texture's top is light enough (LIGHT_TEXT is now U/B/G/LAND).
  - **Chip centering root-caused:** measuring glyph geometry showed the ink bbox *was* centered — in a bbox inflated by dozens of paper-speck paths the S6 mana-icon traces carried (invisible at thin stroke, bolded into bubbles by the chip stroke, and shoving the real glyph off-center; the "tiny sun" was exactly this). All seven glyphs retraced with -t 1500 despeckle (-t 250 on mana-white — 1500 ate the sun's detached rays), chip strokes now ~9% of each glyph's size rather than a constant. Verified centered on rendered discs with crosshairs. The base rail/board icons got the clean retraces too.
- **Feedback round 5 (same day, Chris-directed, final):** generic-cost numerals up to 0.95em/weight 800 in the chips; land names go ink like white and red (LIGHT_TEXT is now U/B/G only). Chris is taking the S7 state to the planner — next-brief candidates he named: **first custom card** (the CardDef `text` field, ADR-042's deferred trigger, has arrived) alongside the M4 design conversation.

## Stats (1,000 games/pairing; seeds 1..; reproduce with `pnpm agent-stats`; all numbers are the post-rule-8 agent)

**Sane vs random, per deck** (aggregated over 8 pairing/seating blocks, 4,000 games each): A 99.3%, B 97.3%, C 99.3%, D 100.0%, E 99.2%. No pairing/seating block below 93.0% (B vs D with random D). Sane never loses a D seat. (Pre-rule-8 these were 96.0–100% — targeting sanity was worth ~1–3 points, most of it to red aggro.)

**Sane-vs-sane vs the random baseline** (same 10 pairings, 1,000 games each):

| pairing | random: wins/terminations/turns | sane: wins/terminations/turns |
|---|---|---|
| A-B | 650-350, 942 LIFE/58 DECKED, 42.1 | 505-495, 1000 LIFE, 20.3 |
| A-C | 372-628, 999/1, 32.9 | 388-612, 1000 LIFE, 15.2 |
| A-D | 247-753, 972/28, 41.5 | 81-919, 1000 LIFE, 18.6 |
| A-E | 443-557, 971/29, 39.0 | 633-367, 1000 LIFE, 19.3 |
| B-C | 282-718, 944/56, 38.2 | 402-598, 1000 LIFE, 20.5 |
| B-D | 185-815, 767/233, 49.1 | 143-857, 988/12, 25.0 |
| B-E | 407-593, 818/182, 45.5 | 773-227, 991/9, 25.0 |
| C-D | 321-679, 975/25, 38.0 | 162-838, 1000 LIFE, 18.2 |
| C-E | 471-529, 988/12, 34.2 | 849-151, 1000 LIFE, 16.3 |
| D-E | 817-183, 875/125, 44.3 | 991-9, 1000 LIFE, 18.5 |

Mean turns halve (33–49 → 15–25); DECKED terminations collapse (749 → 21 across 10,000 games).

**≥5-mana casts per game** (the number Chris wanted; 10,000 games each condition):

| card | random | sane | ratio |
|---|---|---|---|
| siege_gang_commander | 0.126 | 0.228 | 1.8× |
| pelakka_wurm | 0.044 | 0.150 | 3.4× |
| serra_angel | 0.139 | 0.325 | 2.3× |
| drana_kalastria_bloodchief | 0.115 | 0.276 | 2.4× |
| wrath_of_god | 0.083 | 0.141 | 1.7× |

## Deviations from the brief

1. **Block rule: the "lethal-threatening" gate wasn't implementable as a pure function** — `GameView` carries no combat state (who's attacking), so total incoming damage can't be computed. Shipped: block when the blocker kills the attacker (trades OK) or safely absorbs ≥2 (attacker power ≥ 2 and blocker survives); never chump. Documented in the agent header. Ruling wanted: accept, or add `combat` to the view and revisit.
2. **The agent carries two pieces of per-instance memory** despite Part 1's "every filter is a pure function over (view, request)": London mulligan count (the view always shows 7 cards) and attackers-already-blocked this combat (keyed by `view.turn` — a purpose-based reset can silently span turns because single-option requests are auto-taken, ADR-014). Both are view gaps, not policy sophistication. Ruling wanted: bless the memory, or add `mulligans`/`combat` view fields.
3. **Menace attackers are never chosen as block targets** (two-blocker planning felt like M4 evaluation); when the enumerator withholds "done" mid-menace-block, the forced second blocker is random. Documented.
4. **`pnpm agent-stats` committed** beyond the brief's letter so the handoff tables are reproducible, matching the "handoff numbers from the CLI" convention.
5. **`ui` now depends on `sim`** via a new browser-safe `@shandalar/sim/decks` subpath (deck-membership filter). Direction is legal (ui → sim), but S6 described ui as engine/cards/core only — flagging the widened dependency.
6. **The size strip's battlefield tile is a def-only re-render** (`StripTile`), not the stateful `CardTile` (which needs a live EngineCtx/GameObject). ~15 duplicated presentation lines; folding them would mean refactoring CardTile beyond scope.
7. **Rule 8 goes beyond the ratified ADR-045 seven rules** (Chris-directed in the feedback round, after watching a Bolt hit its caster). It stays a filter — classify, restrict target tuples to a side, uniform within — but the harmful/helpful table over the effect vocabulary is a first small step of evaluation living in `agents`. Planner should fold it into ADR-045's text or split an ADR.
8. **Token defs gained live `art.asset` values** (`/custom-art/*.png`) — the schema field existed (ADR-008) but was unused; this is the first data/cards edit driven by art rather than rules. Logged since card files are otherwise sacrosanct.

## Concerns

1. **What sane's rules distort most (M4 baseline notes, as the brief requested):** (a) the 80%-cast rule makes it an *activation* machine — the sample game has 22 activations/28 ATTACHED events, mostly Bonesplitter/Warhammer re-equip churn between own creatures; M4's evaluator needs "re-equipping the same host is worth ~0" alongside S6's Control-Magic-self-enchant note (that one still stands — sane targets randomly too). (b) Attack-with-everything + never-chump systematically favors removal-heavy decks: D's win rates jump from 65–82% (random) to 79–94% (sane mirrors). (c) All-in attacking means sane loses creatures to blocks it "should" foresee — fine for a floor, but expect M4's first win to be combat evaluation.
2. **Base P/T only in combat filters:** the view has no live characteristics, so anthem/equipment/counter pumps are invisible to attack/block decisions (a 1/1 wearing +3/+0 still reads 1/1). Same root cause as deviations 1–2: the view is thinner than policies need. Suggest deciding once, at M4 design time, what the agent-facing view owes: `combat`, `mulligans`, live P/T (or a characteristics helper over the view).
3. **Gallery at scale is a non-issue** (expected concern): 66 frames + art on one page render instantly, lazy-loaded, no jank; scrolling and filters feel native. One real finding: at 180px the white-mana glyph at 11px on light wash bands nearly vanishes — an icons/frame contrast note for the planner (visible on any W card's name strip).
4. **`window.prompt` for note entry is functional but crude** — fine for a Chris-only tool; if notes get heavy use, an inline text field is a small follow-up.
5. **Registry parsing is by column position** (`| cardId | name | status |`…) in the gallery; a registry column reorder would silently misread statuses. Acceptable for a dev tool reading a repo-canonical file; noting it because principle 11 has made me suspicious of silent doc/format drift.
6. **Trigger targets can't get rule-8 preference:** `chooseTriggerTargets` requests are issued *before* the stack item exists, and the request carries no source identity — so Nekrataal can still destroy its caster's own creature and Man-o'-War can self-bounce. The clean fix is engine-side (a `sourceCardId` on ActionRequest, or choosing targets after the item is on the stack) — escalating rather than changing the engine unbriefed. Fold into the M4 view/request ADR (Concern 2).
7. **Frame layout notes for the planner after the retro pass:** the 63:88 full frame's fixed text box means long-text cards (Siege-Gang, Vampire Nighthawk reminder text) scroll at 180px gallery size — real-card behavior, the modal at 300px fits everything, but art-direction §3 may want a font-size step-down instead. And the white-mana chip fixed the old contrast complaint — the sun glyph is legible on every band now, but W's *body* color is necessarily light, so white cards are the least "saturated" of the five; that's period-accurate, flagging in case Chris wants W warmer.

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
