# Engine Design — rules engine

Companion to `mechanics-manifest.md` (what) and `data-model.md` (schemas). This is *how*.

## 1. Packages (TypeScript, pnpm workspaces, vitest)

```
packages/
  core/      RNG service, event bus, ids, action-log types, utility types. No game rules.
  cards/     Effect vocabulary (types + resolvers), card definition loader/validator, pool registry reader.
  engine/    Game state, zones, turn structure, stack, priority, SBAs, combat, continuous effects, targeting,
             legal-action enumerator, match runner (MatchSpec → MatchResult).
  agents/    Agent interface; RandomAgent (Session 1); HeuristicAgent (later); HumanAgent adapter (UI phase).
  sim/       Fuzzer (random vs random), Monte Carlo harness, replay verifier.
  ui/        (later) Browser UI. Nothing here in Sessions 1–3.
```

Dependency direction: `ui → agents/sim → engine → cards → core`. Nothing points backward. `engine` does not import `agents`; it receives an `Agent` instance per seat.

## 2. Game state

A single immutable-by-convention `GameState` object (copy-on-write is fine; no need for structural sharing in v1). Contains: players (life, mana pool, counters, flags), zones per player (library, hand, graveyard, exile) plus shared battlefield and stack, the turn structure pointer (turn number, active player, step), the priority holder, the continuous-effects list, pending triggers queue, and the RNG state.

Every `GameObject` has: `id` (fresh on every zone change), `cardId` (what it was printed as), `owner`, `controller`, `zone`, and zone-specific fields (tapped, damage, counters, attachedTo, summoningSick, etc.). Tokens are GameObjects with a `isToken` flag whose cardId points at a token definition.

**Controller is distinct from owner from day one** (Control Magic is in the ceiling). All "you control" predicates resolve through `controller`.

## 3. The zone-move primitive

`moveObject(state, objectId, toZone, options)` is the *only* way objects change zones. It: creates a new object id, strips zone-specific state (damage, counters, attachments, tapped) unless the destination is the battlefield and options say otherwise, detaches anything attached to it (attachments get SBA-handled), emits `ZONE_CHANGE` with from/to so ETB/dies/LTB triggers can subscribe, and handles tokens ceasing to exist when leaving the battlefield.

## 4. Events and triggers

`core` provides a typed event bus. The engine emits events at the Comprehensive-Rules-meaningful moments: zone changes, damage dealt, life changed, spell cast, ability activated, step begun/ended, attackers declared, blockers declared, card drawn, counter placed, tapped/untapped, control changed.

A triggered ability is `{source, event predicate, effects, optional?}`. On each event, the engine collects matching triggers from all permanents (and from spells/cards in other zones only where the manifest allows — currently only "when this dies" style, which is handled as a leaves-the-battlefield look-back). Collected triggers are put on the stack the next time a player would receive priority, APNAP order; controller chooses order among their own simultaneous triggers (Session 1: deterministic order by object id; a proper choice hook is a later session).

## 5. Stack and priority

The stack holds `StackItem = Spell | ActivatedAbility | TriggeredAbility`, each with its source, controller, chosen targets, chosen X, and paid costs. Priority passes per CR 117: active player first after each resolution; both players passing in succession with an empty stack advances the step; with a non-empty stack resolves the top item.

Casting a spell: announce → choose targets (legality checked) → choose X → determine cost → pay cost (mana, tap, sacrifice) → spell is on the stack → SBAs → priority. Activating an ability is the same path without the zone move. Mana abilities do not use the stack.

Resolution: re-check every target; if all illegal, the item is countered by rules ("fizzles"); otherwise effects apply in order and illegal targets are skipped. Then SBAs, then priority.

## 6. Costs and mana

Cost = `{mana: ManaCost, tap?: boolean, sacrifice?: Predicate, X?: boolean}`. `ManaCost` supports generic, WUBRG, and X. Payment in Session 1 is "auto-pay": the engine finds a legal payment from the pool after the agent taps lands; agents tap lands as explicit actions. The auto-pay must be deterministic. Later an agent can specify payment explicitly.

## 7. Continuous effects and characteristics

`characteristics(state, objectId)` computes the object's current values. Order (a deliberate simplification of the layer system, recorded as ADR-003): printed values → copy effects (unused, slot reserved) → control-changing effects → P/T-setting effects (unused, slot reserved) → P/T modifications from static abilities (anthems, equipment) → P/T modifications from resolved spells/abilities (pump) in timestamp order → counters → restrictions/grants (keyword grants, can't attack/block). Restrictions are consulted by the legal-action enumerator and combat, never stored on the object.

Effects carry a `duration`: `WHILE_SOURCE_ON_BATTLEFIELD` (static), `UNTIL_END_OF_TURN`, `UNTIL_SOURCE_LEAVES` (auras' effects are static with the aura as source). The cleanup step removes EOT effects and damage.

## 8. Combat

Steps: beginning, declare attackers, declare blockers, first-strike damage (only if any first/double striker is in combat), regular damage, end. Each step gives priority. Declare attackers validates: untapped, no summoning sickness unless haste, not restricted; taps unless vigilance. Declare blockers validates flying/reach/menace/restrictions and records blocker assignments and order.

**Damage assignment is a separate function from damage dealing.** `assignCombatDamage` produces a list of `{source, target, amount}`; `dealDamage` applies it and emits events. Trample, deathtouch, double strike, and lifelink each modify one of those two functions and nothing else. Session 1 implements: flying, reach, first strike, haste, vigilance. The others are listed in the rules registry as "slot exists, not implemented."

## 9. State-based actions

One function, run whenever a player would receive priority, looped until no changes: 0-or-less life loses; drew from empty library loses; toughness ≤ 0 → graveyard; lethal damage → destroy; aura/equipment attached illegally → graveyard / unattached; legend rule (ask controller via agent hook). Simultaneous with the rule that all SBAs in one pass are applied at once.

## 10. Targeting

`TargetSpec = {count, predicate, zone}`. Predicates compose: `creature`, `nonblack`, `anyTarget` (creature | player), `opponent`, `youControl`, `spell`, `cardInYourGraveyard`. Hexproof/shroud are checked in the predicate layer ("can be targeted by this controller"). Targets are re-validated at resolution.

## 11. Legal-action enumerator

`legalActions(state, playerId)` returns every action the player may take right now: pass priority, play land, cast spell (with all legal target combinations — bounded; see ADR-004), activate ability, tap land for mana, declare attackers (as one composite action with the set), declare blockers (composite). The RandomAgent picks uniformly; the HeuristicAgent evaluates; the UI presents. Everything the engine accepts must come from this list.

## 12. Agents

```ts
interface Agent {
  chooseAction(view: GameView, actions: Action[]): Promise<Action>;
  chooseTargets(view, spec, candidates): Promise<Target[]>;   // may be folded into actions in v1
  chooseOne(view, prompt, options): Promise<option>;          // legend rule, sacrifice selection, trigger order
  mulligan(view): Promise<boolean>;
}
```
`GameView` is the state as seen by that player (hidden hands/libraries redacted). Session 1 ships `RandomAgent` only.

## 13. Match runner

`runMatch(spec: MatchSpec): Promise<MatchResult>`: build decks from pool, validate, seed RNG, shuffle, draw 7, mulligan (London, simplified: draw 7, bottom N), **apply `spec.modifiers`** (empty in v1, but the hook runs), then the turn loop until a win condition or `spec.maxTurns`. Emits the full action log. Initialization is the only place modifiers are read.

## 14. Action log and replay

Every agent decision and every RNG draw is logged with the step it occurred in. `replay(log)` reconstructs the game without agents and asserts identical final state. This is a permanent test from Session 1.

## 15. What is deliberately not here

UI, art, the heuristic AI, Monte Carlo output analysis, the overworld. The brief says which session brings each.
