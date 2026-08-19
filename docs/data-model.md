# Data Model

## 1. Card definition (`data/cards/*.json`, validated at load)

```jsonc
{
  "id": "lightning_bolt",           // stable snake_case; real cards use oracle name
  "name": "Lightning Bolt",
  "source": "real" | "custom",
  "scryfallId": "…",                // real cards only; used by the art fetch step
  "manaCost": "{R}",                // "{X}{R}", "{3}{W}{W}", "" for lands
  "types": ["Instant"],             // Land, Creature, Instant, Sorcery, Enchantment, Artifact
  "subtypes": ["Goblin"],           // creature types, Aura, Equipment, basic land types
  "supertypes": ["Legendary", "Basic"],
  "power": 2, "toughness": 1,       // creatures only
  "keywords": ["flying", "haste"],  // evergreen keyword list from the manifest
  "abilities": [ /* Ability[] */ ],
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

Triggered `event` values: `ENTERS_BATTLEFIELD`, `DIES`, `LEAVES_BATTLEFIELD`, `ATTACKS`, `BLOCKS`, `DEALS_COMBAT_DAMAGE_TO_PLAYER`, `UPKEEP`, `END_STEP`, `LAND_ENTERS_UNDER_YOUR_CONTROL` (landfall), `SPELL_CAST` (opponent casts — for later). Each may carry `condition` predicates (source only, controller only, creature only, etc.).

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
| `draw` | `count`, `who` | |
| `discard` | `count`, `who`, `mode`: `choose` / `random` | |
| `gainLife` / `loseLife` | `amount`, `who` | |
| `modifyPT` | `power`, `toughness`, `scope` or `target`, `duration` | pump, anthems, Drana |
| `grantKeyword` | `keyword`, `target`/`scope`, `duration` | Rancor, equipment, pump-with-rider |
| `restrict` | `what`: `attack` / `block` / `both`, `target`, `duration` | Pacifism |
| `createToken` | `tokenId`, `count`, `who` | |
| `addCounters` | `kind`, `count`, `target` | +1/+1, −1/−1 |
| `tapTarget` / `untapTarget` | `target` | |
| `returnFromGraveyard` | `target` (own graveyard), `to`: `battlefield` / `hand` | Zombify, Regrowth |
| `fight` | `target` (two creatures) | |
| `gainControl` | `target`, `duration`: `UNTIL_SOURCE_LEAVES` | Control Magic |
| `searchLibrary` | `predicate` (basic land only), `to` | maybe |
| `addMana` | `mana` | lands, rocks (mana ability) |

**Reserved, not implemented:** `copy`, `setPT`, `preventDamage`, `changeType`.

Effects reference targets by index into the declared `targets` array (`"target": 0`) or by scope (`"scope": "creaturesYouControl" | "allCreatures" | "opponent" | "you"` …). `"X"` resolves from the stack item.

## 4. Token definitions

Same schema as cards with `"isTokenDef": true` and no manaCost. E.g. `goblin_1_1`, `soldier_1_1`, `beast_4_4`.

## 5. MatchSpec / MatchResult

```ts
interface MatchSpec {
  seed: number;
  players: [PlayerSpec, PlayerSpec];   // { name, decklist: {cardId, count}[], agent: AgentSpec }
  rules: { startingLife: 20; handSize: 7; mulligan: "london"; maxTurns: 100 };
  modifiers: Modifier[];                // applied at initialization only; empty in v1
}

type Modifier =
  | { type: "startingLife", player: 0|1, value: number }
  | { type: "extraCards", player: 0|1, count: number }
  | { type: "permanentOnBattlefield", player: 0|1, cardId: string }   // uses moveObject, same as Zombify
  | { type: "effectAtStart", player: 0|1, effects: Effect[] };        // escape hatch: any vocabulary effect

interface MatchResult {
  winner: 0 | 1 | null; reason: "LIFE" | "DECKED" | "CONCEDE" | "MAX_TURNS" | "DRAW";
  turns: number; finalLife: [number, number];
  log: ActionLogEntry[];
  facts: { damageDealt: [n,n]; creaturesLost: [n,n]; cardsDrawn: [n,n]; spellsCast: Record<cardId, [n,n]> };
}
```

Modifiers must be expressible in the same effect vocabulary as cards; no modifier-only mechanics. The overworld is the only producer of `modifiers`; the engine's initializer is the only consumer.

## 6. Action log

```ts
type ActionLogEntry =
  | { t: "ACTION", turn, step, player, action: Action }
  | { t: "RNG", purpose: "shuffle"|"discard"|"coin", value }
  | { t: "EVENT", name, payload }          // optional, for viewers; not needed for replay
```
Replay consumes ACTION and RNG entries only.

## 7. Pool registry row

`| cardId | status (planned/implemented/tested/cut) | vocabulary words | sessions | notes |`
