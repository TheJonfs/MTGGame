# decisions.md — APPEND (ADR-081)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-080.*

---

**ADR-081 — S21 ratifications and directions.**

*Ratified as shipped:*
- **Siege rewards follow the standard defeat law** — ante, gold, and renown pay immediately; no escrow. The implementer's phrase enters the record: *"a town is not a mountain."* The doctrine is now explicit: **escrow is dungeon law** (anti-scum for resettable spaces); **the open world pays as it goes**. Loss = ordinary costs; the party regroups.
- **Defense engagements carry life like liberation** (the brief's planner extension) — Chris exercised both sides; ratified.
- **Boons are next-battle-only consumables**; treasure economy v2 (cache weights, four cache kinds, class retune) ratified as ruled live.
- **The quest & rumor text pack's canonical home is `data/world/quests.json`**; the prose pack is an authoring artifact — future text ships as planner pack deliveries that the implementer wires, and each superseded pack version is marked. (v1 marked alongside this ADR.)
- Nighthawk pricing shipped (T2 gold 50); `anteCount` awaits Chris's taste. The S20 reconstruction stands; the 147-vs-140 count resolved as counting basis (140 acquirable + basics + Lotus + the Elemental token def).
- **Gate hardening blessed** (concern 7): a build/lint check joins the default gate so a Babel-breaking-but-tsc-clean edit can't reach the browser-verify step unannounced.
- The time-to-liberation sim extension is sanctioned **on demand** — build it the first time a tuning round wants the number, not before.

*Directed for S22 Part 0 — the prizeOnly unification (closes concern 1's five channels at once):* all **guardian and lord cards are `prizeOnly`** — excluded from quest R-rolls, retrieval-item predicates, lair cache rolls, `lairPrizeRoll`, and `colorPrizeRoll`; each is obtainable solely as the guaranteed drop from its own bearer's defeat (per Chris's sole-mechanism ruling in the lords round). Retrieval MacGuffin predicates exclude `prizeOnly` generally.

*Ruled (planner recommendation, pending Chris's nod):* **quest deadlines pause while the giver's or destination's town is occupied**, resuming on liberation — the world's disruption never fails a contract, and "liberate the town to complete the delivery" is a quest chain the systems write themselves. (The fail-with-sympathy alternative is rejected as story-poorer.)

*Banked to S23 — "wilds polish" is now a real session:* **wild towns** (the generator's 0–1-per-region roll never places any — a planner-authored rumor references them, so either the line goes or the towns arrive; the towns arrive: propose a ≥2-per-world guarantee, cashing the dormant `siegeIntervalSteps.wild` knob and the danger gradient's deepest rung), **rivers** (the `river` map layer), **town-footprint variety**, the dungeon interior's smoothing pass, and **audio scaffolding** (per Chris's incoming note).

*Chris's open verdict pile (carried):* the 19 map sprites + the Elemental token plate; `anteCount` for the Nighthawk; the empowerment re-dive verdict; the priced-Nighthawk fight with the **Blood Artist chattiness feel-check (outstanding since S19)**; a rumor-chain and a tavern-whisper witnessed in play; manalink-loss-under-occupation feel.

*Noted for the S22 brief (to be cut after Chris's art/audio note):* the session likely **splits — S22a** (A10's nine words + riders, the ADR-038 amendment, the SPELL_CAST and land-play activations, the full card batch: seven customs + eight real adds + Abrade + three token defs, fixtures and fuzz) and **S22b** (the stronghold dungeons at maximum scale, the five laws as Artifact Enchantments, the entrance rule, the life formula, the decks, the sims, and Chris meets a lord). The card art is already picked and cropped — S21's Part 5 removed the art load entirely.
