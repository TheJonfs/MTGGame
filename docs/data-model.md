# Data Model

## 1. Card definition (`data/cards/*.json`, validated at load)

```jsonc
{
  "id": "lightning_bolt",           // stable snake_case; real cards use oracle name
  "name": "Lightning Bolt",
  "source": "real" | "custom",
  "scryfallId": "…",                // real cards only; optional until the art session
  "manaCost": "{R}",                // "{X}{R}", "{3}{W}{W}", "" for lands
  "types": ["Instant"],             // Land, Creature, Instant, Sorcery, Enchantment, Artifact
  "subtypes": ["Goblin"],           // creature types, Aura, Equipment, basic land types
  "supertypes": ["Legendary", "Basic"],
  "power": 2, "toughness": 1,       // creatures only
  "colors": ["R"],                  // optional; derived from manaCost if absent; REQUIRED on token defs (ADR-019)
  "keywords": ["flying", "haste"],  // evergreen keyword list from the manifest
  "abilities": [ /* Ability[] */ ],
  "text": "…",                      // custom cards only (ADR-053): rules text for the frame; real cards use oracle.json
  "spellEffect": [ /* Effect[] */ ],// instants/sorceries; targets declared here
  "targets": [ /* TargetSpec[] */ ],// for spells; abilities carry their own
  "art": { "asset": "art/real/lightning_bolt.jpg", "fallback": "rendered" }
}
```

Every card's `art.fallback` is `"rendered"`: the UI draws a plain frame from card data when `asset` is missing. Custom cards put images in `data/art/custom/`. A build step (`pnpm art:fetch`, later session) fetches only the pool's real-card images from Scryfall into `data/art/real/` (gitignored).

## 2. Abilities

```jsonc
{ "kind": "triggered", "event": "ENTERS_BATTLEFIELD", "condition": {...}, "targets": [...], "effects": [...], "optional": false }
{ "kind": "activated", "cost": { "mana": "{X}{B}{B}", "tap": false, "sacrifice": {"predicate": "creature.subtype:Goblin"} },
  "timing": "instant" | "sorcery", "targets": [...], "effects": [...] }
{ "kind": "static", "effects": [ { "type": "modifyPT", "power": 1, "toughness": 1, "scope": "creaturesYouControl" } ] }
```

Trigger `condition` (ADR-021, optional; default `{source:"self"}`): `{source: "self"|"attached"|"other"|"any", controller: "you"|"opponent"|"any", type?: string[], subtype?: string[], player?: "opponentOfController"|"controller"|"any"}`. `attached` = the object this aura/equipment is attached to (Curiosity). `player` narrows damage/draw events by the affected player, always relative to the ability's controller (CR 109.5, Curiosity rulings). Triggers may be `optional: true` (ADR-027).

Events also include `ATTACHED` (ADR-026; emitted, no trigger uses it yet).

Triggered `event` values: `ENTERS_BATTLEFIELD`, `DIES` (battlefield→graveyard, for any permanent — Rancor is an aura with a DIES trigger), `LEAVES_BATTLEFIELD`, `ATTACKS`, `BLOCKS`, `DEALS_COMBAT_DAMAGE_TO_PLAYER`, `UPKEEP`, `END_STEP`, `LAND_ENTERS_UNDER_YOUR_CONTROL` (landfall), `SPELL_CAST` (opponent casts — for later). Each may carry `condition` predicates (source only, controller only, creature only, etc.).

## 3. Effect vocabulary (v1 — grows only by manifest decision)

| type | params | notes |
|---|---|---|
| `damage` | `amount` (number or `"X"`), `target` ref | any target / creature / player |
| `damageAll` | `amount`, `scope` | Pyroclasm |
| `destroy` | `target` ref | |
| `destroyAll` | `scope` | Wrath |
| `exile` | `target` ref | |
| `bounce` | `target` ref | to owner's hand |
| `counter` | `target` ref (spell) | |
| `draw` | `count`, `who` | `who` ∈ `you` / `opponent` / `eachPlayer` / target |
| `discard` | `count`, `who`, `mode`: `ownerChooses` / `random` / `casterChooses`, `filter?` | ADR-029 |
| `mill` | `count`, `who` (incl. `target` with a player target) | ADR-070 Amendment 3; top N library → owner's graveyard via `moveObject`; **not a draw** (no empty-draw loss) |
| `gainLife` / `loseLife` | `amount` (literal, `"X"`, or value ref — ADR-028), `who` (incl. `controllerOfTarget`) | |
| `modifyPT` | `power`, `toughness`, `scope` or `target`, `duration` | pump, anthems, Drana |
| `grantKeyword` | `keyword`, `target`/`scope`, `duration` | Rancor, equipment, pump-with-rider |
| `restrict` | `what`: `attack` / `block` / `both`, `target`, `duration` | Pacifism |
| `createToken` | `tokenId`, `count`, `who` | |
| `addCounters` | `kind`, `count`, `target` | +1/+1, −1/−1 |
| `tapTarget` / `untapTarget` | `target` | |
| `returnFromGraveyard` | `target` (predicate `creatureCardInYourGraveyard`), `to`: `battlefield` / `hand` | Zombify (battlefield), Gravedigger (hand, optional ETB) |
| `fight` | `targets: [i, j]` (two target indices) | all-or-nothing legality (ADR-022) |
| `gainControl` | static with `scope: attached` (Control Magic, ADR-033); targeted/EOT variant reserved for Threaten-style cards (not in ceiling) | |
| `searchLibrary` | `predicate` ∈ {basicLand, anyCard}, `to` ∈ {battlefield(+entersTapped), hand} | ADR-068 Amendment 1; find-may-fail via request-payload reveal (chooser only); **always shuffle after (CR 701.19, logged RNG)** |
| `addMana` | `mana`, or `choice: {count, anyOneColor}` | lands, rocks; Lotus-style colour choice is a no-stack DecisionRequest (ADR-068 Amendment 2) |
| `exileThenReturn` | `target`, `under: "yourControl"` | ADR-075 A8 blink: exile then back as a new object under the controller (ETBs fire). Restoration Angel |

**S17 (ADR-075/076) schema additions.** *Value refs* (amounts and static P/T): `{ref:"count", predicate:{cardType?, subtype?, controller?: you|opponent|any, other?, attacking?}}`, `{ref:"graveyardCount", who}`, `{ref:"maxPower", predicate}`; statics may carry `condition: {value: <ref>, atLeast: n}` (Werebear). *Activated abilities*: `zone: battlefield|hand|graveyard`; costs gain `discard: n`, `discardSelf`, `exileSelf`, `reduceBy: <ref>` (generic part, floored at coloured pips — Baru). `CardDef.cycling: "{2}"` compiles into a hand-zone ability `{cost, discardSelf; draw 1}` in the loader. *Modal*: `modes: [{label, targets?, effects}]` on a spell (no `spellEffect`/`targets`) or a trigger (empty `effects`); spells pick at cast (`castSpell.mode`), triggers via a `chooseMode` request. *Additional spell costs*: `additionalCost: {sacrifice: {predicate}}`. *Targets*: `anyOf: TargetSpec[]`, `withKeyword`, `withoutKeyword`, `notSubtype`, `other`; base predicates `artifact`, `enchantment`, `nonlandPermanent`, `creatureSpell`. *Effects*: any effect may carry `if: {target, subtype?|cardType?}`; `addCounters` takes `scope`(+`subtype`/`cardType`/`other`) as an alternative to `target`; `modifyPT`/`grantKeyword` scopes accept `withKeyword`/`withoutKeyword`; `searchLibrary.predicate` accepts `subtype:<X>`. *Triggers*: event `DISCARD` (condition `player` = who discarded, `type`/`notType` = the card's types); `UPKEEP` fires (controller condition = whose upkeep); conditions gain `notType`; ETB/DIES with `source: other|any` observe other permanents.

**Reserved, not implemented:** `copy`, `setPT`, `preventDamage`, `changeType`.

Effects reference targets by index into the declared `targets` array (`"target": 0`). Amounts may be value references `{"ref": "targetPower", "target": i}` (ADR-028) or by scope (`"scope": "creaturesYouControl" | "allCreatures" | "opponent" | "you" | "attached"` …). `attached` is the object an aura/equipment is attached to; required for Pacifism, Rancor, equipment statics. Scopes may be parameterized (ADR-020): `{"scope": "creaturesYouControl", "subtype": "Goblin", "other": true}` (`other` excludes the source — Goblin Chieftain). `"X"` resolves from the stack item.

## 4. Token definitions

Same schema as cards with `"isTokenDef": true`, no manaCost, and a **required `colors`** field. E.g. `goblin_1_1` (R), `soldier_1_1` (W), `beast_4_4` (G).

## 5. MatchSpec / MatchResult

```ts
interface MatchSpec {
  seed: number;
  players: [PlayerSpec, PlayerSpec];   // { name, decklist: {cardId, count}[], agent: AgentSpec }
  rules: { startingLife: 20; handSize: 7; mulligan: "london"; maxTurns: 100; ante: number };  // ante: top-n-nonland stake per side (0 = off; R-043)
  modifiers: Modifier[];                // applied at initialization only; empty in v1
}

type Modifier =
  | { type: "startingLife", player: 0|1, value: number }
  | { type: "extraCards", player: 0|1, count: number }
  | { type: "permanentOnBattlefield", player: 0|1, cardId: string }   // uses moveObject, same as Zombify
  | { type: "effectAtStart", player: 0|1, effects: Effect[] };        // escape hatch: any vocabulary effect; resolved via the
                                                                      // stack-item-less EffectContext (ADR-012)

interface MatchResult {
  winner: 0 | 1 | null; reason: "LIFE" | "DECKED" | "CONCEDE" | "MAX_TURNS" | "DRAW";
  turns: number; finalLife: [number, number];
  log: ActionLogEntry[];
  facts: { damageDealt: [n,n]; creaturesLost: [n,n]; cardsDrawn: [n,n]; spellsCast: Record<cardId, [n,n]>;
           ante: { 0: cardId[], 1: cardId[] } };   // set-aside stakes per seat (may be short/empty on land-heavy tops)
}
```

Modifiers must be expressible in the same effect vocabulary as cards; no modifier-only mechanics. The overworld is the only producer of `modifiers`; the engine's initializer is the only consumer.

## 6. Action log

```ts
type ActionLogEntry =
  | { t: "ACTION", turn, step, player, action: Action }
  | { t: "RNG", purpose: "shuffle"|"discard"|"coin", value }
  | { t: "EVENT", name, payload, seq, afterAction }   // viewers only (ADR-040); not needed for replay
```
Ordering/choice actions (`orderTrigger`, `orderBlocker`, …) carry the source **object id** as well as cardId so logs are human-readable (S3). Replay consumes ACTION and RNG entries only. Per ADR-014, single-option decisions are not logged; `EVENT` entries are the full transcript for viewers.

## 7. Pool registry row

`| cardId | status (planned/implemented/tested/cut) | vocabulary words | sessions | notes |`

## 8. Fixtures inbox entry (ADR-040)

`fixtures-inbox/<seed>-t<turn>-a<actionIndex>.json`:
```ts
{ matchSpec: MatchSpec; actionIndex: number; turn: number; step: string;
  note: string;                 // free text from the flagger ("why did Piker not block?")
  expected?: string;            // optional: what the flagger thinks should have happened
  flaggedAt: string; viewerVersion: string; }
```
A later session reads the inbox, reproduces via `replay(matchSpec.seed…, actionIndex)`, and either files a scenario fixture (and a rules-registry note) or records "working as intended" in the entry and moves it to `fixtures-inbox/closed/`.
