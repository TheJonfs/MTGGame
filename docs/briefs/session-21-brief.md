# Session 21 Brief — Sieges, Rumors, and the Lore Turn

Read first: `handoff-s20b.md` (adopt the numbered-handoff rule from ADR-080 this session), ADR-077..080 (`docs/decision-updates/`), `docs/planner-doc-amendments-s20b.md` (apply to the two named docs first), `docs/dungeon-design.md` (as amended), `docs/quest-text-pack-v1.md` (planner content — wire, don't rewrite), **`docs/stronghold-bosses.md` with this standing guidance: it is a LORE AND REFERENCE document this session — names, laws-as-story, whispers, and the world's shape are canon and quotable in rumor text; its MECHANICS (cards, A10, decks, the entrance rule, the life formula) are S22-pending and must not be encoded, stubbed, or anticipated in code.** Overworld manifest §5 (sieges). Budget two director rounds (art verdicts + siege feel; empowerment re-dive verdict).

## Parts

**Part 0 — Reconstruction + baselines.** Regenerate a retrospective S20-close summary (`handoff-s20-reconstructed.md`) from repo ground truth: pool-registry S20 rows — **resolving the 147-vs-expected-140 pool count** — rules-registry additions with numbers, the save-v5 field list, and `pnpm guardian-sim` kill tables re-emitted under the 30/60/90 labels. FUZZ_FULL baseline. Adopt numbered handoffs.

**Part 1 — The Nighthawk, priced (ADR-080 ruling).** The famous killer stands at tier 2: bump its per-opponent reward knobs (gold toward the tier-3 payout band; `anteCount` per Chris's taste in the round) and give its parley voice the warning register (the quest-text pack carries its legend line — wire it). No further deck or life changes.

**Part 2 — Sieges (the milestone).** Per manifest §5, on the reserved `sieges: []` field:
- **Siege timers** on the step clock (consumer #3): seeded schedules per knobs (`siegeIntervalSteps` by ring/difficulty); a town under threat telegraphs visibly (visible-schedules law) — warning states in the rail, on the map chip, and in town.
- **The strike:** an occupier (or a **party** — a multi-enemy gauntlet reusing the dungeon system's sequential-fight machinery at town scale) takes the town if unrelieved by the deadline.
- **Liberation gauntlets carry life (Chris-ruled):** breaking a siege is consecutive battles with life gain and loss persisting between them, dungeon-style — that's the price of letting a town fall; the engagement telegraph states it before commitment. Defense engagements (relieving before the fall) use the same carryover rule for consistency (planner extension — flag in the round if it plays wrong).
- **The fall:** shopping, quests, and the town's granted manalinks **suspend** (manalinks carry their granting town since S19 — the suspension hook cashes); the map chip and rail show occupied state.
- **Liberation:** defeat the occupier(s) at the town; suspended benefits restore; durability autosaves at every siege consequence. Save impact: fills the reserved `sieges` field; escalate any v7-shaped needs.
- **Town footprints** (the ADR-080 rider): towns render as multi-building vignettes in the campaign-map register — a place worth defending, in the session that threatens it.
- **Instrument:** world-sim gains siege-pressure reporting (falls per 30-seed tour by ring/difficulty; time-to-liberation; manalink-suspension exposure). Tables argue the knob baselines.

**Part 3 — Retrieval and rumor-chain quests (the deferred shapes).**
- **Retrieval:** targets **lair-dungeons** (Chris-ruled; Mox dungeons and future challenge sites are never quest targets — rumors only point at them). The quest item sits in the lair's prize room, **escrowed like everything else** — the quest is the dive. Completion offers the manifest's keep-or-deliver choice (keep: the item; deliver: the quest reward — make the trade legible at the choice).
- **Rumor-chains:** town-board rumor entries that point onward (a rumor names a region or site; visiting/exploring advances the chain) terminating at a real prize location — including **pointer rumors at the Mox dungeons and (post-five-Moxen) the Vault tease**, which are discovery aids, not quests. Text from the pack.
- Quest templates externalize to `data/world/quests.json` per the S19 seam; the pack's templates and rumor lines load as data.

**Part 4 — The lore turn.** Wire the pack's lore rumors into town boards/tavern surfaces: guardian legends, the five lords' whispers (names are canon per the boss doc), the Nighthawk's legend, world texture. Frequency/dedup by seed; a rumor heard is a rumor logged (a small "heard rumors" journal in the rail is in scope if cheap, escalate if not). **The warp is deliberately nameless (Chris-ruled)** — the pack ships final; no naming language beyond it.

**Part 5 — Parallel art rider (droppable if the session runs long).** ADR-052 ceremony for the five lords' card art — **all five visual seeds are ruled**: the Usher (vampire duchess — haughty, seductive, deadly; luxurious backdrop), the Warden (silver-barked treefolk soldier; thorned-canopy reach), the Unwinder (merfolk wrought in spirals; restrained warped-mana weirdness), **the Stoker (an efreet dealing in magic, heat, and energy)**, **the Sower (a dryad that evokes the sphinx-making — the dreamer and the dreamed)**. Subject files, four candidates each, MANIFEST-logged, verdicts in the director rounds. Aetherbolt and Tainted Phoenix candidates ride only if the five complete.

**Part 6 — Acceptance.** Scripted: full siege cycle (telegraph → strike → fall → suspension incl. a manalink → liberation → restoration → autosaves throughout); retrieval end-to-end at a lair-dungeon incl. keep-or-deliver both branches; a rumor-chain followed to a Mox dungeon discovery. Human: Chris defends one town and liberates another, follows a chain, hears the lords whispered in a tavern, re-dives a dungeon for the **empowerment verdict** (ADR-080 pending), and finally fights the priced Nighthawk (**the Blood Artist chattiness feel-check, outstanding since S19**).

## Definition of done

Reconstruction filed; Nighthawk priced; sieges live end-to-end with tables; both quest shapes live; pack wired with the aether ruling applied; town vignettes shipped; art candidates rendered or explicitly shrunk; felt-wrong harvest. Concerns wanted: siege pacing feel vs the tables, party-fight life question if it arose, rumor repetition/dedup quality, anything the sieges field forced into a v7.

## Out of scope

Strongholds and all lord mechanics (A10, customs, decks, entrance, life formula — S22), the final gauntlet, the Lotus Vault beyond its tease rumor, new cards, AI evaluator work beyond the Nighthawk knob pricing.

## Escalate, don't decide

Party-gauntlet life persistence; any save-v7 field list; siege interactions with quest deadlines (a besieged quest-giver?) — flag the cases found, planner rules; anything touching stronghold fixed points or the reserved mechanics; rumor text edits beyond wiring (the pack is planner-owned content).
