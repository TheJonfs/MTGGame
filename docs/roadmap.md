# Roadmap

Milestones are engine-facing until M6. Each milestone is one or two sessions.

| M | Name | Content | Exit criterion |
|---|---|---|---|
| M1 | Skeleton + slice | Packages, state, zones, moveObject, turn structure, stack/priority, costs/mana, SBAs, combat (flying/reach/first strike/haste/vigilance), continuous effects (P/T, restrict), targeting, ETB triggers, legal-action enumerator, RandomAgent, match runner, replay test. Slice decks from manifest §6. | Random vs random completes thousands of games, no illegal states, replay byte-identical. |
| M2a (S2) | Protocol fixes + expansion 1 | Incremental declarations (ADR-013), choice-as-action for trigger order / blocker damage order / bottoming, ZONE_CHANGE controller capture, effectAtStart context; dies/LTB triggers (Pelakka), tokens, anthems, +1/+1 counters, X costs (Blaze), trample; third slice deck. | Fuzz clean on three decks; ordering tests pass. |
| M2b (S3) | Expansion 2 | Sacrifice-as-cost (Siege-Gang), equipment, deathtouch/lifelink/double strike/menace, fight, rocks; hexproof/shroud/indestructible cards (hooks already live per R-026). | Every Tier 0 slot has a real card exercising it; scenario suite covers each. |
| M3a (S4) | Removal, discard, conditions/scopes | `destroy`/`exile` targeted with color/type predicates, Wrath, Pyroclasm, Swords (value refs), discard ×3 modes, trigger conditions beyond `self` (attached/player), optional triggers, parameterized scopes + Goblin Chieftain, ATTACHED event, Deck D mono-black; pool ~57. | Fuzz clean ×6 pairings. |
| M3b (S5) | Control change, reanimation, legend rule | Control Magic, Zombify, Gravedigger-style regrowth, legend rule SBA, Drana (activated X), Mystic Snake (flash + ETB counter), Rancor (graveyard-return trigger); pool toward ~80. Remaining pool growth to ~100 is card-batch sessions with no new vocabulary. | Full ceiling implemented except reserved words. |
| M3.5 | Replay viewer | Read-only browser viewer over the action/event log: board per step, stack, life, decision made, step-through; rendered-fallback card frames; "flag this" writes seed+turn to a fixtures-inbox file. Art fetch optional. | Chris can watch fuzz games and file oddities as reproducible fixtures. |
| M4 | Heuristic agent v1 | Evaluator + one-ply lookahead for combat; archetype hints from decklist; beats RandomAgent ≥95% (note: RandomAgent's attack-set distribution changed with incremental declarations — S2 concern 6; re-baseline before measuring). Monte Carlo harness for deck-vs-deck. | Measured win rates; AI plays aggro and midrange credibly. Control is allowed to be bad. |
| M5 | Browser UI | Playable human vs AI in the browser. Rendered-fallback card frames; art fetch build step. | Chris can play a full game. |
| M6 | Overworld manifest + first slice | Separate manifest; map, one quest, one shop, collection; calls `runMatch` with modifiers. | One loop: travel → duel → reward. |
| M7+ | AI v2, pool to ~150, overworld depth, replay viewer | | |

Status: M4c complete (S11) — gates hold; +8% closed by measurement; surgical 2-ply parked in the standing AI workstream (ADR-062). Overworld manifest ratified through v0.3. **Session 12 brief cut: M6a — the world slice** (engine ante, knobs registry, worldgen, wander, parley, ante duel, town+shop, save/load). Then M6b (deck editor, clock consumers, dungeons). Parked: pool balance/curation (ADR-054), tutor card batch (Growth + Demonic Tutor amendment + Lotus).

| M3.75 (S7) | Instrumentation | SanePolicyAgent (ADR-045), card gallery + art notes (ADR-046), ADR-044 riders (DAMAGE targetCardId, ink transport glyphs, Rager refetch). | Chris can watch sane games and browse/annotate every card. |
