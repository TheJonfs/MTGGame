# Overworld Manifest — v0.3 (ratified)

Companion to `mechanics-manifest.md`. The second engine: the world the duels happen in. Same method as the first manifest: principles, a Tier 0 skeleton that exists from day one, a ceiling, explicit deferrals, and open questions for Chris. The rules engine is consumed **only** through the ADR-002 contract (`MatchSpec` → `runMatch` → `MatchResult`); the overworld never reaches inside a duel.

## 1. Design principles

1. **Difficulty is worldcraft, not just AI.** The AI will trail a strong human in a fair fight; the world compensates through opponent deck quality (bosses draw on the full pool before the player can), starting buffs (the modifiers hook), and stakes (ante). Losing must matter.
2. **Authored inventory, procedural placement.** We author the catalog — opponents, decks, boss identities, dungeon types, keystone locations; each new game seeds an arrangement. Fixed points exist (the five color strongholds); the land between them varies.
3. **Danger has geography.** Safe-ish civilized regions → color-boss approaches with themed, stronger enemies → remote wilds with exotic dungeons and the best prizes. The player always knows roughly how much risk they're walking into by where they're standing.
4. **The collection is the character sheet.** Progression is cards: ante won, prizes taken, shops, dungeon vaults. Power 9-class cards exist in the world as boss trophies, not shop stock.
5. **Parameterize everything (the knobs registry).** Every tunable — encounter rates, ante counts, shop stock curves, life penalties, boss clocks, prize odds — lives in one documented knob schema. Difficulty settings, regions, dungeons, individual opponents, and the procedural generator are all just *sources of knob values* with a defined precedence (world defaults < difficulty < region < dungeon < opponent < one-off event). "This dungeon is harder" and "this fight antes three cards" are the same mechanism.
6. **Everything replayable from seed.** World generation, encounter rolls, and shop stock all flow from the world seed + the same logged-RNG discipline as the engine.

## 2. Tier 0 — the overworld skeleton

| System | Requirement |
|---|---|
| **World state & save/load** | One serializable `WorldState`: seed, map, player (position, collection, decks, gold, life, flags), opponent/dungeon instances, clock. Save = the state + log; versioned like `shandalar-log-v1`. |
| **Map & movement** | Continuous 2D wander (Shandalar-style): terrain regions, towns, dungeon entrances, roads as fast/safe-ish paths. Player moves in real-ish time; region determines encounter table and rate. |
| **Encounter system** | Seeded rolls by region: enemy appears with a visible identity (name, portrait, color/archetype signal) and pursuit on the map. Pre-fight parley: fight, flee (position/speed contest), or **buy off** (gold and/or offered cards, priced by enemy tier). |
| **Duel handoff** | Build `MatchSpec` from world state: player deck, opponent instance's deck + AI profile (difficulty per tier), **modifiers from the opponent/dungeon definition** (the ADR-002 hook's first real use), **ante rule on**, world-life starting life (ratified). Consume `MatchResult`: apply ante transfer, rewards, life/clock consequences; every duel log saved and viewable. |
| **Ante (engine ask)** | Engine addition: `rules.ante: n` (default 1; 0 = off) → at initialization each library's top *n* nonland cards are set aside (after shuffle, before hands); `MatchResult.facts.ante` reports both sides' card ids. Win claims both stakes; **fleeing forfeits yours**; the overworld moves cards between collections. Ante applies everywhere, dungeons included. (Small; existing zones/moveObject; brief item + fixtures.) |
| **Collection & deck editor** | Collection with acquisition provenance; a deck editor UI over the gallery components (this is a real M6+ workstream of its own): build/edit decks from owned cards, legality = 30-card floor, 4-copy cap, basic lands free and infinite (nonbasic collectible lands are future pool content). |
| **Towns & shops** | Towns as safe nodes: shop (seeded stock by region color, refresh rules open), healer/other services (life restoration interacts with world life below), rumor hooks for quests later. Gold is the currency. |
| **Dungeons** | Enterable sites with authored structure: a short gauntlet of themed fights (with per-room modifiers) ending in a prize room; color-boss dungeons as capstones; exotic dungeons in the wilds. Dungeon fights ante like everything else (greatest risk beside greatest reward); no-flee and per-room knob overrides are dungeon-definition content. |
| **Opponent instances** | Instantiated from the authored catalog: identity (name, portrait, taste), deck (authored or template-rolled), AI profile, tier, region binding, modifier package, ante/prize table. Bosses are hand-built decks from the **full pool** + buffs; color bosses guard color strongholds, archetype bosses the remote wilds. |
| **Reward resolution** | Win: keep your ante, take theirs, + gold by tier, + possible bonus card roll. Boss wins: choose 1–3 from the color's prize list (color boss) or a Power-class trophy (archetype boss). Lose: ante gone, plus a possible permanent world-life penalty per the life system below. |

## 2a. World life (ratified)

One persistent value. Player starts at **10** (implemented as duel `startingLife` from world life — the engine's default 20 is simply overridden every match). Semantics, stated precisely: duels **start** at current world life; damage taken inside a duel never persists to the map; only defined overworld events move the value — **down** via loss penalties (some/all losses cost 1, per knobs) and **up** via amulet-class rewards, quest payoffs, or services. The loss floor is a knob: floor = starting value (only gained life is ever at risk) through floor = 0 (world life 0 is game over) — a difficulty dial, not a one-time design decision. Enemy starting life is per-opponent catalog data (mooks may be 8; bosses 20+ plus modifiers).

## 2b. New game & difficulty (ratified)

New game: pick a color → an authored starter deck for that color, possibly adjusted by difficulty; difficulty is a named bundle of knob values (enemy tier curves, clock speed, ante counts, loss-life floor, starter quality, shop prices…). Nothing in the difficulty system exists outside the knobs registry.

## 3. Ceiling (intended, not first-slice)

Quest grammar and the ticking clock (§5), world magic and amulet-class items (ratified in-scope, later), enemy party encounters beyond sieges, NPC variety in towns, campaign meta-progression (far), difficulty settings at new-game, world events (roaming high-tier hunters), the Power 9 trophies with their engine amendments (Lotus cheap; Time Walk = turn queue; Timetwister = batch zone ops — each a manifest amendment when scheduled).

## 4. Explicitly deferred

Multiplayer anything; overworld combat other than duels; crafting; card trading with NPCs beyond shops/buy-offs (maybe later); weather/day-night; food/supply mechanics **(permanently cut — ratified; not even a good money sink)**.

## 5. Time, quests, sieges, endgame (ratified v0.3)

**The clock is player steps.** Every step on the open map advances world time; **town and dungeon interfaces are clock-free** (deliberation is never taxed — deckbuilding, shopping, and dungeon-room decisions cost nothing). What time punishes is grinding in safety while threats grow. Every world process — boss escalation schedules, siege timers, quest deadlines — is a clock keyed to steps, and **each clock's rate is a knob** (principle 5): low difficulty = pressure without stress; highest difficulty = nearly overwhelming from the jump, survivable only through tradeoffs. Determinism note: world time is a discrete tick; a world seed + step log replays exactly, and the generator fuzz harness asserts clock invariants over seeded journeys.

**Boss escalation:** bosses accrue power on visible step-schedules (deck/buff upgrades at thresholds) — the core speed-vs-thoroughness tension.

**Sieges:** enemies — including **parties** (a siege may be a multi-enemy gauntlet) — periodically strike towns on siege timers. Unrelieved, the town falls: shopping, quests, and any persistent benefits it granted (manalinks etc.) are **suspended** until the player liberates it by defeating the occupier(s).

**Quest shapes** (each town offers ≥1 per game): courier (A→B through danger), bounty (a named roaming enemy), retrieval (dungeon dive; choose to keep or deliver), rumor-chains (pointing at dungeon prizes). *Escort is dropped.* Rewards: gold/cards, or **persistent buffs** — manalink-class bonuses tied to the granting town (suspended if it falls).

**Manalinks (implementation note):** zero engine work — a manalink is a `permanentOnBattlefield` modifier referencing a custom non-card permanent def (e.g. "Manalink: Mountain," artifact, `{T}: Add {R}`), pure existing vocabulary; the AI's evaluator already prices it.

**What losses cost (stakes model):** every loss forfeits ante; life penalties per §2a knobs. **Buff-stripping is per-enemy stakes, not a universal loss rule** (default): specific hunters/siege leaders threaten your manalinks, telegraphed in the parley screen so the risk is chosen; a universal-stripping mode exists as a high-difficulty knob. (Rationale: prevents triple-penalty feel-bad spirals on ordinary losses while keeping terror where it's dramatic.)

**Endgame:** defeat the five color bosses → a final boss/gauntlet unlocks → victory. Story dressing may diverge from Shandalar. **Meta-progression** (persistent unlocks between campaigns, a higher roguelike layer) is noted for the far ceiling.

## 6. Procedural generation contract

Authored catalog files (opponents, decks, dungeon templates, town names, prize tables) + a seeded generator that: places five color strongholds with spacing constraints, grows regions around them, scatters towns/roads/dungeons by region rules, instantiates opponents into regions by tier table. A world is `(catalogVersion, seed)` — regenerable, shareable, testable. Generator gets the same fuzz treatment as everything: N seeds, invariants asserted (all strongholds reachable, region gradients monotone along approach paths, etc.).

## 7. Resolved (v0.2) and still open

**Resolved:** ante everywhere incl. dungeons; flee forfeits ante; ante quantity is a knob (`rules.ante: n`); world life linked, start 10, penalties/floor per §2a; food cut; deck floor 30 / cap 4 / basics free-infinite, nonbasic lands collectible later; world magic ceiling'd; new-game color choice + difficulty bundles per §2b; parameterize-everything as principle 5.

**Resolved v0.3:** the step-clock and clock-free interiors; sieges with parties and suspension/liberation; quest shapes (escort dropped) with town-tied persistent buffs; per-enemy buff-stakes default with universal-stripping as a difficulty knob; endgame = five color bosses → final gauntlet; meta-progression far-ceiling'd.

**Still open:** enemy life/tier tables, prize lists, quest text (authoring, not design); default knob values (from slice playtesting); loss-penalty schedule's starting value; final-boss identity and story framing.

---
*Process: v0.2 ratified 2026-08-20; v0.3 (time/quests/sieges/endgame) ratified same day. Next: M6a slice brief after the S11 (M4c) handoff — generate a world, walk it, get ambushed, parley or fight an ante duel in the existing client, spend gold in one shop, save/load. The `rules.ante: n` engine item and the knobs-registry schema ride in that brief. Quest grammar/clock is the following design round.*
