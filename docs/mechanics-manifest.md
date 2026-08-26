# Mechanics Manifest — v0.2 (ratified draft)

Working title: *Shandalar-like*. A single-player game with two coupled engines: an MTG rules engine playing a curated pool of real cards, and an overworld/metagame engine handling travel, quests, and collection. This document scopes the **rules engine, its external contract, and the card pool**. The overworld gets its own manifest later.

---

## 1. Design principles (the things we check every decision against)

1. **The pool is designed to the engine, not the engine to the pool.** A card enters the pool only if it is a composition of vocabulary the engine already speaks (or a vocabulary word we agree is worth adding for many cards). No single-card carve-outs. Ever.
2. **Build the skeleton, not the features.** Tier 0 systems exist from the first commit even when no card uses them. Adding a mechanic later should mean adding a rule to an existing step, not restructuring a step. Litmus test: *trample must be a rule about damage assignment, not a rewrite of combat.*
3. **Modern-evergreen mechanics, classical card selection where taste allows.** Serra Angel over a fifty-word modern angel. Mystic Snake over an exotic counter. Simple compositions of straightforward pieces.
4. **Cards are data.** Card definitions are declarative compositions of keywords, costs, targets, and effects. A scripting escape hatch may exist but is treated as a code smell: reaching for it means either add a vocabulary word or cut the card.
5. **Everything is testable as a scenario.** Board state in, assertion out. The scenario suite is both the regression suite and the specification the implementer works from.

---

## 1a. Engine contract — the seam to the overworld

The rules engine is a **library with no main loop and no knowledge of the world**. It never sees inventory, gold, map, quests, or story. The overworld (and the test harness, and Monte Carlo) all drive it through the same contract.

**Inputs (a `MatchSpec`):**
- Two decklists (card IDs + counts), each validated against the pool.
- A player agent per seat: `human` (UI-driven), `ai:<profile>` (heuristic, with deck-archetype hints), `random` (validation), possibly `llm-assisted` later. All agents implement one interface: *given game state + legal actions, return an action*; plus hooks for choices (targets, sacrifice selection, legend-rule keep).
- Match rules: starting life, hand size, mulligan policy, optional overworld-imposed modifiers (e.g., "start with a Mountain in play") — kept to a small enumerated set.
- RNG seed.

**Outputs (a `MatchResult`):**
- Winner / draw, reason (life, decking, concession), turn count, final life totals.
- Full action log (replayable; feeds the replay viewer later).
- A small set of derived facts for quest logic: damage dealt, creatures lost, cards drawn, whether specific cards were cast. Computed from the log, not tracked by the engine.

**Hard rules:** the engine never imports overworld code; the overworld never reaches into engine state during a match except through the agent/UI interface. Card identity is shared via the pool definition file, which both sides read.

---

## 2. Tier 0 — the skeleton (present from day one, regardless of card usage)

| System | Requirement | Why now |
|---|---|---|
| **Game objects & zones** | Library, hand, battlefield, graveyard, stack, exile. One `moveObject(obj, fromZone, toZone)` primitive that fires events. Objects get a new identity on zone change. | Half of Magic is zone-change triggers; exile needed for Swords. |
| **Owner vs. controller** | Every permanent tracks owner and controller separately; "you control" predicates resolve via controller. Control change resets summoning sickness. | Control Magic is in the ceiling. Retrofit is ruinous. |
| **Turn structure** | Untap, upkeep, draw, main 1, combat (begin, declare attackers, declare blockers, damage — with first/double strike sub-steps as a rule, not a special case — end), main 2, end, cleanup. Priority passes at every step where the rules say it does. | Haste, vigilance, flash, "until end of turn," and the AI all depend on this being real. |
| **The stack & priority** | A real stack; both players receive priority; spells and abilities resolve LIFO; targets re-checked on resolution (fizzle if all illegal). | Counterspell, Boomerang-in-response, pump-in-response-to-Bolt. |
| **Mana & costs** | Mana pool with colors; cost parsing including generic, colored, and **X** (in both spell costs and activated-ability costs); tap-as-cost; **sacrifice-[type]-as-cost**; costs paid before effect. | Blaze-style X, Drana, Siege-Gang. |
| **Event bus + triggered abilities** | Triggers subscribe to events (ETB, dies, attacks, deals damage, draw, upkeep…). Triggers go on the stack. Persistent listeners live as long as their source. | ETB creatures, "whenever X, draw a card," Siege-Gang. |
| **State-based actions** | One function: lethal damage, 0 toughness, 0 life, aura/equipment attached to illegal object, **legend rule (controller chooses which to keep)**. Called whenever a player would receive priority. SBAs may ask the controller a question via the agent interface. | Never let combat code decide who's dead. Legend rule is the first SBA requiring a player choice; the same hook serves sacrifice selection. |
| **Continuous effects & characteristics** | `characteristics(obj)` computes current values from printed values + applied effects in a defined order. Must handle P/T modification (anthems, counters, pump), keyword granting (Rancor, equipment), **restrictions** (Pacifism: can't attack/block), and control (Control Magic). Effects have durations (static-while-present, until end of turn). | Anthems, Drana, Pacifism, equipment. This is the honest minimum of the layer system. |
| **Targeting** | Declared at cast/activation with legality predicates (creature, nonblack creature, "any target," etc.); re-checked at resolution. | Doom Blade's color awareness, Bolt's "any target." |
| **Combat** | Explicit steps. Damage **assignment** is a separate step from damage **dealing**. Blockers ordered; assignment rules are pluggable (trample, deathtouch modify assignment). | The trample principle. |
| **Attachments** | Auras and equipment share one attach/detach system with legality checks in SBAs. Equip is an activated ability with sorcery-speed timing. | Pacifism, Rancor, Warhammer. |
| **Legal-action enumerator** | Given a game state and priority holder, return all legal actions. | Random-move AI for validation; the real AI consumes the same API. |
| **Deterministic RNG + replay** | Seeded shuffles; full action log; replayable games. | Monte Carlo balancing (SFB approach transfers directly). |

---

## 3. Tier 1 — the ceiling (everything we intend to support, eventually)

**Keywords (evergreen):** flying, reach, first strike, double strike, trample, haste, vigilance, deathtouch, lifelink, menace, defender, flash, hexproof/shroud, indestructible, "can't be countered."

**Spell/ability effects vocabulary:** damage (to any target, to creature, to player, mass to all creatures), destroy (targeted, mass, with predicates like nonblack), exile (targeted; with rider like Swords' lifegain), bounce, counter (spell / ability), draw N, discard (targeted / random / opponent chooses), gain/lose life, pump ±P/±T until EOT, grant keyword until EOT, tokens (create N of a defined token type), counters (+1/+1, −1/−1), tap/untap target, reanimate (spell- or ETB-trigger-based, **own graveyard**), regrowth (graveyard to hand), tutor (basic land only, if at all), fight (creature-sourced damage, both directions).

**Permanent-based effects:** static anthems ("creatures you control get +1/+1"), keyword-granting statics, ETB / dies / attacks / upkeep / end-step triggers, "whenever [event], draw a card" repeatable triggers, activated abilities with tap/mana/X/sacrifice costs, auras (buffs, restrictions, **control change**), equipment (buffs, keyword grants; equip cost).

**Zones exercised:** all six. Graveyard used for reanimate/regrowth/dies-triggers only — **no ordering, no counting cards in graveyard, no "target card in a graveyard" beyond own graveyard for reanimate/regrowth.**

**Archetypes the ceiling must support:** mono/dual aggro, go-wide tokens + anthem, midrange fatties, control (counters + removal + finisher), tempo (bounce + fliers), light aristocrats (Siege-Gang, sac outlets), light reanimator, tribal via type predicates (Goblins).

### Amendments (ADR-037 process; dated)

**2026-08-21 — ADR-068 Amendment 1 — search scope:** `searchLibrary` widens from "basic land only" to `predicate` ∈ {basicLand, anyCard}, destination ∈ {battlefield(+entersTapped), hand}. Search is a find-may-fail: the chooser sees their library in the DecisionRequest payload (ADR-032 pattern — request-scoped, no view change), may take a matching card or decline; **shuffle after search always (CR 701.19), via the logged game RNG**. Nothing reveals the chosen card's origin context to the opponent beyond what the card's destination makes public.

**2026-08-21 — ADR-068 Amendment 2 — mana-ability choices:** a mana ability may carry a bounded choice (Lotus: "add three mana of any one colour" = a five-option DecisionRequest). Still no stack; the choice is a logged action; the enumerator offers one action per colour when the ability is activated deliberately, and auto-pay never activates choice-bearing mana abilities implicitly.

**2026-08-23 — ADR-070 Amendment 3 — mill:** new effect word `mill {count, target|who}`: top N of the library to its owner's graveyard via `moveObject` (per-card zone-change events fire; an empty library mills what it can; **milling is not drawing** — no empty-draw loss from mill). First card: **Cathartic Adept** ({U} Creature — Human Wizard 1/1, "{T}: Target player mills a card" — Scryfall-verified, ALA, Carl Critchlow; note: Human, not Merfolk).

**2026-08-24 — ADR-075 Amendment 4 — counting value refs:** Value references gain `{"ref":"count", "predicate":…}` over battlefield permanents (e.g. Swamps you control, other attacking Goblins) and `{"ref":"graveyardCount","who":"you"}`. The manifest's "graveyard counting — out" exclusion is **narrowed to ordering only**; counting is an array length and is in. Customers: Tendrils of Corruption, Gaean Wurm, Werebear (threshold as a conditional static keyed on graveyardCount ≥ 7), Baru's X. *ADR-077 amendment:* `{"ref":"maxPower", "predicate":…}` is a third value-ref kind alongside `count` and `graveyardCount` — Baru's cost-reduction input is a max over a predicate set, not a count.

**2026-08-24 — ADR-075 Amendment 5 — zone-scoped activated abilities:** Abilities may declare `zone: battlefield (default) | hand | graveyard`. **Cycling** enters as a keyword compiling to a hand-zone ability `{cost, discard self; draw 1}`. Customers: Airship Crash (cycling {2}), Mother Bear (graveyard, exile-self cost, sorcery timing).

**2026-08-24 — ADR-075 Amendment 6 — modal "choose one":** Spell/trigger effects may be `modes: [effects[]]` with a controller DecisionRequest at cast/resolution per CR 601.2b (modes chosen at cast for spells, at put-on-stack for triggers; targets chosen after mode). Customer: Aether Channeler.

**2026-08-24 — ADR-075 Amendment 7 — additional spell costs:** The cast path's cost step gains optional `additional: {sacrifice: predicate}` (extends ability sac-cost machinery to spells; paid at 601.2h with triggers ordering normally). Customer: Goblin Grenade.

**2026-08-24 — ADR-075 Amendment 8 — blink + optional targets:** New effect `exileThenReturn {target, under:"yourControl"}` (returns as a new object; ETBs fire) and targeting gains `count: {min:0, max:N}` ("up to"). Customer: Restoration Angel.

**2026-08-24 — ADR-079 Amendment 9 — conditional enters-tapped (the shock clause):** Card-def field `entersChoice: {pay: {life: 2}, else: "tapped"}`: on resolution of the LAND PLAY the controller gets a DecisionRequest (pay / don't; a logged action); life is paid before the permanent's ETB state fixes, ETB triggers see the final state; payable only at life ≥ the cost (paying to exactly 0 is legal and lethal). Anything PUT onto the battlefield by other means enters tapped, no choice (initialization stays request-free). Customers: the ten Ravnica shocklands. *(Same session: A8's "up to" range counts + inter-target distinctness were finally implemented with their first customer, Drakuseth — a range-count spec must be the last of its list; the unconditional `entersTapped` land flag (cycling lands) rode as a small system.)*

**2026-08-25 — Amendment A10 — the Lords' Expansion (ADR-081 ratification; formal text `docs/manifest-amendment-a10.md`):** *The ADR-037 ceremony: every word below was earned by a named customer during the stronghold design rounds (ADR-079..082 era; full design record in `docs/stronghold-bosses.md`). A10 is the largest single expansion since the ceiling froze — deliberately: boss-tier custom design is the exception ADR-037 was written to permit.*

*New words:*
1. **`RETURNED_TO_HAND` trigger event** — fires on battlefield→hand zone changes; observed form (any controller, any cause); rides the ZONE_CHANGE payload; S17 lookback covers self-observation. *Customer: the Unwinder's ping.*
2. **`returnToHand` activation cost** — `{predicate}`: bounce-own-permanent-as-cost, structurally parallel to sacrifice costs (choose from set, move, then stack). *Customer: the Unwinder's engine.*
3. **`returnFromGraveyard temporary: true`** — the reanimated object gains haste and is sacrificed at the beginning of the next end step. A self-contained package rule, not a delayed-trigger subsystem. *Customer: the Usher's entrance.*
4. **Any-number targeting via request-loop** — a spell may declare `targets: {variable: true}`: casting enters a logged choose-target/done DecisionRequest loop (the chooseMode/ADR-013 precedents fused); costs computed at CR 601.2h from the final count. Companion: **`additionalCost: {life: n, perTarget: true}`** (A7 family; paid at cast; no refund on counter/fizzle). *Customer: Phyrexian Purge.*
5. **`UNTAPPED` trigger event** — fires when a permanent untaps (untap step or effect); observed form. *Customer: the Warden's law.*
6. **`tapCreature` activation cost** — `{predicate, count}`: tap-an-untapped-creature-you-control as cost; chooser machinery parallels sacrifice costs. *Customer: Glare of Subdual.*
7. **`unlessPay` — the punisher package** — a trigger consequence may fork on an opponent-facing DecisionRequest: pay the stated cost or suffer the stated effect; single request, logged. *Customer: the Stoker's trigger (Browbeat's class rides in).*
8. **`grantAbility` static** — a battlefield permanent's static may confer an activated ability on cards/permanents in a stated zone and scope: `{zone: hand}` (enumeration-time grant on A5's hand-ability machinery; no ADR-003 layer contact) and the battlefield-scope sibling `{zone: battlefield, scope}`. *Customers: the Stoker's cycling grant; Frondland Felidar.*
9. **Zone-scoped triggered abilities** — A5's `zone` field extends to triggered abilities (first zone: graveyard); with a **pay-on-resolution rider** on ADR-027 optional triggers (`optionalCost: {mana}` — a yes/no whose yes pays). *Customer: Tainted Phoenix.*

*Activations of reserved vocabulary (not new words):* **`SPELL_CAST`** (reserved in the data model since S1: "opponent casts — for later") — activated with controller conditions (*customer: the Stoker*). **A land-play event emission** — the play-land special action announces itself (distinct from enters-the-battlefield; effect-placed lands do not fire it) (*customer: the Sower*).

*ADR-038 amendment:* graveyard targeting generalizes: `returnFromGraveyard` (and graveyard target candidates) accept `who: you | any`. Every existing card remains `you`; the Usher is the sole `any` customer. The own-graveyard architectural assumption is retired in favor of an explicit per-card field.

*Small pieces (catalogued riders — each named to its customer):* `targetManaValue` value-ref (Aether Mutation) · `createToken` count-as-ref and `pt: <value-ref>` locked at resolution (Aether Mutation; Experimental Overload) · typed `graveyardCount` (Overload) · `instantOrSorcery` graveyard predicate (Overload) · spell self-exile resolution rider (Overload) · `powerAtMost` target predicate and counter-rider on `returnFromGraveyard` (Graceful Restoration) · `bounce {to: libraryTop}` (Temporal Spring) · `anyPermanent` target predicate — the pool's first land destruction (Vindicate) · **additional-land-drops** rules counter read by land-play legality (the Risen Tide) · **enters-tapped imposed on creatures by static** (the Intake) · new token defs `saproling_1_1_g`, `sphinx_4_4_wu`, `weird_x_x_ur`.

---

## 4. Explicit exclusions (written down so we don't drift)

| Excluded | Reason |
|---|---|
| Planeswalkers | Whole subsystem: loyalty, redirection, attack targets. |
| Copy effects (Clone, Fork) | Deferred to "much later." Copiable values are a layer-1 subsystem. |
| Regeneration | Old subsystem; Wrath just says "destroy all creatures." |
| Protection | Bundle of four rules (DEBT). Use hexproof/shroud/indestructible instead. |
| Type/color/text changing (Turn to Frog, Blood Moon) | Layers 4–5. |
| Replacement effects generally (incl. damage prevention, "enters tapped" is OK as a special-cased ETB rule) | Whole subsystem. Revisit only if a *class* of cards demands it. |
| Alternative costs, kicker, morph, cascade, storm, flashback, buyback | Each a mini-game. |
| Banding, phasing, rampage, mana burn, interrupts | Historical. Nobody can explain banding. |
| Non-land mana producers beyond simple rocks (Sol Ring-style "T: add") | Mana abilities that trigger/target are excluded; simple ones allowed. |
| Graveyard ordering/counting (Nether Spirit, Delve, Threshold) | Explicitly out. |
| Fireball-style split X damage, Ward, Prowess-family | Split assignment / reactive taxes / triggered stat changes each add a system for few cards. |
| Legendary — *not excluded* | On-board legend rule implemented as an SBA with controller choice. |

---

## 5. Representative cards by role (calibration anchors, not a decklist)

| Role | Card(s) | Vocabulary exercised |
|---|---|---|
| Red burn | Lightning Bolt, Shock, Blaze (XR: X to any target) | any-target damage, X costs |
| Red mass | Pyroclasm | mass damage |
| Black spot removal | Doom Blade, Terror | destroy w/ color predicate |
| White removal suite | Swords to Plowshares, Pacifism, Wrath of God | exile+lifegain, restriction aura, mass destroy |
| Blue interaction | Counterspell, Boomerang, Mystic Snake, Man-o'-War | counter, bounce, ETB-counter, ETB-bounce |
| Blue finisher | Control Magic / Mind Control | control change |
| White finisher | Serra Angel | flying, vigilance |
| Black finisher | Drana, Kalastria Bloodchief | flying, XBB activation, −0/−X, +X/+0 EOT |
| Green finisher | Pelakka Wurm | trample, ETB lifegain, dies-draw |
| Green removal | Prey Upon | fight |
| Mana rocks | Mind Stone–style simple rocks | T: add mana (no Sol Ring power level) |
| Go-wide | Raise the Alarm, Siege-Gang Commander, Glorious Anthem | tokens, sac-as-cost, tribal predicate, anthem |
| Card advantage | Divination, Phyrexian Rager, Curiosity / Coastal Piracy | draw, ETB draw, persistent trigger |
| Auras | Rancor, Pacifism | keyword grant, graveyard-return trigger, restriction |
| Equipment | Loxodon Warhammer, Bonesplitter | equip, keyword grant, P/T |
| Reanimation | Zombify; a Karmic Guide–style ETB reanimator (no Echo) | own-graveyard reanimate, ETB w/ graveyard target |
| Discard | Duress-style targeted, Hymn-style random | discard, RNG in effects |
| Protection substitutes | hexproof / shroud / indestructible creatures | targeting predicates, SBA exemption |
| Pump | Giant Growth, Brute Force | ±P/T until EOT |

---

## 6. Vertical slice (implementation session 1–2 target)

**Goal:** two decks play complete, legal games against a random-legal-move AI with zero illegal states, exercising every Tier 0 system at least once.

**Deck A — mono-red aggro (~40 cards):** Mountain; Raging Goblin (haste), Goblin Piker, Hill Giant, Bloodrock Cyclops (vanilla bodies at 1–4 mana); Lightning Bolt, Shock; Brute Force (pump); one 1R 2/1 first strike or menace body if we want a keyword beyond haste.

**Deck B — white/blue skies (~40 cards):** Plains, Island; Savannah Lions, Suntail Hawk, Wind Drake, Serra Angel; Man-o'-War (ETB bounce), one ETB-draw flier (e.g., Cloudkin Seer or Sea Gate Oracle); Counterspell, Boomerang, Pacifism, Divination.

**Systems validated by this slice:** turn structure, priority, stack (Counterspell), targeting + fizzle (Bolt vs. Brute Force in response), combat with flying/first strike/haste/vigilance, ETB triggers via event bus (Man-o'-War), attachments + restriction effect (Pacifism), two-color mana, SBAs, legal-action enumerator, deterministic replay.

**Dies-trigger test cases (slice-adjacent, first batch after slice):** a dies trigger must fire identically whether death comes from combat damage, a spell, SBA 0-toughness, or Wrath. Pelakka Wurm is the canonical fixture.

**Deliberately absent from slice:** X costs, tokens, anthems, equipment, control change, sacrifice costs, graveyard interaction, activated abilities other than equip. Each is a small subsequent session and each should slot into an existing step. If any of them requires restructuring a step, the skeleton failed and we fix the skeleton, not the card.

---

## 7. Card representation (proposal)

- A card is a data record: name, cost, types/subtypes, P/T, keywords[], abilities[] where each ability is `{trigger | activation | static, cost?, targets[], effects[]}` composed from a fixed effect vocabulary.
- Every card record carries an `art` field: a local asset path or asset ID, plus a **rendered fallback** generated from the card data itself (name, cost, type line, P/T, rules text in a plain frame). The game is fully playable with zero images present; custom cards without art look intentional, not broken.
- A build step walks the pool, fetches **only** the needed Scryfall images for real cards into the asset folder, and merges with a custom-card art folder. Nothing fetched at runtime.
- Tokens are card records that live only on the battlefield.
- The vocabulary is enumerated in a single file. Adding a word is a design decision logged in this manifest.
- Card definitions are the primary artifact Claude (planner) produces; the implementer builds the vocabulary.

---

## 8. Testing & analysis

- **Scenario tests:** JSON/TS fixtures describing a board state, a sequence of actions, and expected end state. Written by planner as part of every card batch.
- **Fuzzing:** random-legal-move vs. random-legal-move for thousands of games; assert no exceptions, no illegal states, games terminate.
- **Monte Carlo:** seeded deck-vs-deck runs for balance and AI evaluation, same methodology as SFB.
- **Replay viewer:** deferred, but the action log is designed for it from day one.

---

## 9. Resolved questions (v0.2)

1. Green finisher: **Pelakka Wurm**.
2. Reanimation: spell-based and ETB-trigger-based, own graveyard only; no Animate Dead–style auras.
3. Fight: **in** (each color gets a removal approach).
4. Mana rocks: simple "T: add" rocks **in**.
5. Discard: targeted and random both **in**; RNG is a first-class engine service (also used for shuffling).
6. Hexproof / shroud / indestructible: **in**, serving as protection's replacement.
7. Legendary: on-board legend rule via SBA with controller choice.
8. AI: accept that early AI will play control poorly (Control Magic, Wrath). Revisit at AI milestones.
9. Art: build-time Scryfall fetch of only the pool's images; `art` pointer + rendered fallback on every card record.

## 10. Still open

- Exact slice decklists (40 cards each) — to be written as the first planner deliverable for the Claude Code handoff.
- Effect vocabulary v1 — enumerate the words the slice needs, then the words the full ceiling needs, in one file.
- Whether the overworld can impose match modifiers (Section 1a) at all in v1, or whether `MatchSpec` modifiers are deferred.

---

*Next step: convert Tier 0 + Section 1a + Section 6 into the first Claude Code handoff, following the SFB registry format.*
