# Roadmap

Milestones are engine-facing until M6. Each milestone is one or two sessions.

| M | Name | Content | Exit criterion |
|---|---|---|---|
| M1 | Skeleton + slice | Packages, state, zones, moveObject, turn structure, stack/priority, costs/mana, SBAs, combat (flying/reach/first strike/haste/vigilance), continuous effects (P/T, restrict), targeting, ETB triggers, legal-action enumerator, RandomAgent, match runner, replay test. Slice decks from manifest §6. | Random vs random completes thousands of games, no illegal states, replay byte-identical. |
| M2 | Vocabulary expansion 1 | Tokens, anthems, +1/+1 counters, X costs, dies/LTB triggers (Pelakka Wurm), sacrifice-as-cost (Siege-Gang), equipment, trample/deathtouch/lifelink/double strike/menace, fight, rocks. | Every Tier 0 slot has a real card exercising it; scenario suite covers each. |
| M3 | Vocabulary expansion 2 | Control Magic (control change), reanimation, regrowth, discard (both modes), hexproof/shroud/indestructible, legend rule SBA, repeatable draw triggers, mass removal. Pool reaches ~100 cards. | Full ceiling implemented except reserved words. |
| M4 | Heuristic agent v1 | Evaluator + one-ply lookahead for combat; archetype hints from decklist; beats RandomAgent ≥95%. Monte Carlo harness for deck-vs-deck. | Measured win rates; AI plays aggro and midrange credibly. Control is allowed to be bad. |
| M5 | Browser UI | Playable human vs AI in the browser. Rendered-fallback card frames; art fetch build step. | Chris can play a full game. |
| M6 | Overworld manifest + first slice | Separate manifest; map, one quest, one shop, collection; calls `runMatch` with modifiers. | One loop: travel → duel → reward. |
| M7+ | AI v2, pool to ~150, overworld depth, replay viewer | | |

Status: pre-M1. Session 1 brief cut.
