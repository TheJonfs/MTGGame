# Session 12 Brief — M6a: the world slice

Read first: `CLAUDE.md`, `handoff.md`, **`docs/overworld-manifest-v0.3.md` (the spec of record for this session)**, `docs/decisions.md` ADR-061..062, ADR-002 (the contract you'll finally consume from the other side), `docs/art-direction.md` (the cartographic direction extends to the map). This session builds the second engine's vertical slice: generate a world, walk it, get ambushed, parley or fight an ante duel in the existing client, spend gold in a shop, save and load. Quests, clocks-with-consumers, dungeons, and the deck editor are M6b+.

## Part 0 — Engine: ante + riders

1. **`rules.ante: n`** (default 0): after shuffle, before hands, each library's top *n* nonland cards move to a new dedicated `ante` zone — not exile; invisible to every predicate, scope, and zone count; via `moveObject` (new zone in the enum). All-lands library edge: fewer/zero ante cards, reported as found. `MatchResult.facts.ante = {0: [...cardIds], 1: [...]}`. Fixtures: n=1, n=2, all-lands, replay determinism, ante cards absent from draws/searches/counts.
2. Riders: `gate/aggregate` → `info/per-deck` (ADR-061); master → `DEFAULT_CONSTANTS` (one line, verify per principle 11); default-off per-step stop "pause at declare blockers while I control untapped creatures" (S11 concern 4, Chris to trial).

## Part 1 — Knobs registry (manifest principle 5)

`packages/world/src/knobs.ts` + `docs/knobs.md` (generated or hand-synced — implementer's call, documented): the schema of every tunable with defaults, and a precedence merge (world < difficulty < region < dungeon < opponent < event). v0 knobs: `encounterRatePerStep` (per region tier), `anteCount`, `goldRewardByTier`, `buyOffBase` (× tier), `lossLifePenalty` + `lifeFloor`, `shopStockSize`, `shopPriceMultiplier`, `startingWorldLife` (10), `starterSpares`. Difficulty bundles `easy/standard/hard` as knob-value sources — only `standard` needs tuned values now.

## Part 2 — World generation + state (`packages/world`)

- **Catalog v0** (`data/world/`): region templates (3 tiers: civilized / approach / wild — approach+wild sparse in the slice), town names, and an opponent catalog instantiating from what exists: decks A–E × profiles as tiered enemies (tier 1 apprentice, 2 journeyman, 3 master) with names, portrait refs (generate 4–6 opponent portraits per `docs/prompts/portraits.md`, washes by color identity), knob overrides (a tier-3 might carry `anteCount: 2`).
- **Generator:** seeded; passability grid (square, click-to-walk pathfinding; a traversed cell = 1 step; granularity is a knob) with 2–3 civilized regions, 2+ towns (spacing constraints), region-tiered encounter tables. No strongholds/dungeons in the slice — the generator's *shape* must accommodate them (fixed-point placement API present, unused). Invariant fuzz: N seeds → all towns reachable, no orphan regions, generation deterministic per seed.
- **`WorldState`:** seed, map, player (position, world life, gold, collection, active deck, steps taken), opponent instances, RNG state. `world-save-v1`: serialize/deserialize round-trip test; steps counter advances on movement only (towns are clock-free per manifest §5 — no consumers yet, but the counter is real).

## Part 3 — The loop (UI route `/world`)

- **Map:** ink-and-wash cartographic rendering — flat wash per region tier, ink borders, town glyphs (icon pipeline), player as a portrait chip; click-to-walk with the path previewed; steps tick visibly.
- **Encounters:** seeded roll per step by region table; enemy appears with name/portrait/tier and closes; **parley screen**: Fight / Flee (seeded contest, knob odds; success = escape, **ante still forfeit** — manifest) / Buy off (gold price = buyOffBase × tier; card-offer variant deferred to M6b).
- **Duel handoff:** MatchSpec from world state — player's deck, enemy's deck+profile, `startingLife` = world life both sides (enemy world life from catalog), `rules.ante` from knobs, enemy modifier package (empty for slice enemies except any catalog overrides). Existing play client runs the match. Resolution: ante transfer both directions against the **collection** (win claims theirs; loss/flee forfeits yours), gold by tier on wins, `lossLifePenalty` to world life on losses (floor per knob; at floor 0 world life 0 = game-over screen). Duel logs saved into the world save.
- **Collection & deck (slice scope):** collection = starter deck + `starterSpares` basics-and-commons; the active deck is fixed for the slice (no editor — M6b). Duel start validates the 30-floor: below it, dueling is blocked with an honest message naming the missing editor. Collection browser = gallery components filtered to owned (read-only).
- **Town:** enter (clock-free), shop with seeded stock by region color and knob pricing — buy only (sell M6b); gold displayed; leave.
- **Save/load:** autosave on town entry + manual save; load from the start screen; download/upload the save file.

## Part 4 — Acceptance

Scripted: generate (seed) → walk → forced encounter → each parley branch (fight-win with ante gain verified in collection; fight-loss with ante loss + life penalty; flee with ante loss; buy-off with gold deduction) → shop purchase lands in collection → save → load → world state identical. Human: **Chris plays the loop** — new world, wander, at least one ante duel each way (win and lose one on purpose), a purchase, save/quit/resume.

## Definition of done

1. Parts 0–3; acceptance both halves; generator invariant fuzz over ≥200 seeds clean.
2. All prior suites green both tiers; ante fixtures in the engine suite; no rules-registry changes beyond a new R-row for the ante rule.
3. `handoff.md`; Concerns expected: what the WorldState schema wants that the manifest didn't name, whether the parley/encounter pacing feels right at default knobs, what M6b's deck editor needs from the collection model, and anything the map rendering fought.

## Out of scope

Quests, sieges, clock consumers, dungeons, strongholds/bosses, deck editor, card-based buy-offs, manalinks, world magic, meta-progression. New cards (tutor batch queued separately). Any AI work (ADR-062 parks it).

## Escalate, don't decide

Any engine change beyond Part 0; any knob not in the registry (add to the registry first — that's the point); any deviation from the ante-forfeit-on-flee rule; save-format changes after the first save ships (version it instead).
