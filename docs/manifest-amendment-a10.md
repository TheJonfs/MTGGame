# Manifest Amendment A10 — the Lords' Expansion (formal text; copy into mechanics-manifest Amendments on S22a ratification)

*The ADR-037 ceremony: every word below was earned by a named customer during the stronghold design rounds (ADR-079..082 era; full design record in `docs/stronghold-bosses.md`). A10 is the largest single expansion since the ceiling froze — deliberately: boss-tier custom design is the exception ADR-037 was written to permit.*

## New words

1. **`RETURNED_TO_HAND` trigger event** — fires on battlefield→hand zone changes; observed form (any controller, any cause); rides the ZONE_CHANGE payload; S17 lookback covers self-observation. *Customer: the Unwinder's ping.*
2. **`returnToHand` activation cost** — `{predicate}`: bounce-own-permanent-as-cost, structurally parallel to sacrifice costs (choose from set, move, then stack). *Customer: the Unwinder's engine.*
3. **`returnFromGraveyard temporary: true`** — the reanimated object gains haste and is sacrificed at the beginning of the next end step. A self-contained package rule, not a delayed-trigger subsystem. *Customer: the Usher's entrance.*
4. **Any-number targeting via request-loop** — a spell may declare `targets: {variable: true}`: casting enters a logged choose-target/done DecisionRequest loop (the chooseMode/ADR-013 precedents fused); costs computed at CR 601.2h from the final count. Companion: **`additionalCost: {life: n, perTarget: true}`** (A7 family; paid at cast; no refund on counter/fizzle). *Customer: Phyrexian Purge.*
5. **`UNTAPPED` trigger event** — fires when a permanent untaps (untap step or effect); observed form. *Customer: the Warden's law.*
6. **`tapCreature` activation cost** — `{predicate, count}`: tap-an-untapped-creature-you-control as cost; chooser machinery parallels sacrifice costs. *Customer: Glare of Subdual.*
7. **`unlessPay` — the punisher package** — a trigger consequence may fork on an opponent-facing DecisionRequest: pay the stated cost or suffer the stated effect; single request, logged. *Customer: the Stoker's trigger (Browbeat's class rides in).*
8. **`grantAbility` static** — a battlefield permanent's static may confer an activated ability on cards/permanents in a stated zone and scope: `{zone: hand}` (enumeration-time grant on A5's hand-ability machinery; no ADR-003 layer contact) and the battlefield-scope sibling `{zone: battlefield, scope}`. *Customers: the Stoker's cycling grant; Frondland Felidar.*
9. **Zone-scoped triggered abilities** — A5's `zone` field extends to triggered abilities (first zone: graveyard); with a **pay-on-resolution rider** on ADR-027 optional triggers (`optionalCost: {mana}` — a yes/no whose yes pays). *Customer: Tainted Phoenix.*

## Activations of reserved vocabulary (not new words)

- **`SPELL_CAST`** (reserved in the data model since S1: "opponent casts — for later") — activated with controller conditions. *Customer: the Stoker.*
- **A land-play event emission** — the play-land special action announces itself (distinct from enters-the-battlefield; effect-placed lands do not fire it). *Customer: the Sower.*

## ADR-038 amendment

Graveyard targeting generalizes: `returnFromGraveyard` (and graveyard target candidates) accept `who: you | any`. Every existing card remains `you`; the Usher is the sole `any` customer. The own-graveyard architectural assumption is retired in favor of an explicit per-card field.

## Small pieces (catalogued riders — each named to its customer)

`targetManaValue` value-ref (Aether Mutation) · `createToken` count-as-ref and `pt: <value-ref>` locked at resolution (Aether Mutation; Experimental Overload) · typed `graveyardCount` (Overload) · `instantOrSorcery` graveyard predicate (Overload) · spell self-exile resolution rider (Overload) · `powerAtMost` target predicate and counter-rider on `returnFromGraveyard` (Graceful Restoration) · `bounce {to: libraryTop}` (Temporal Spring) · `anyPermanent` target predicate — the pool's first land destruction (Vindicate) · **additional-land-drops** rules counter read by land-play legality (the Risen Tide) · **enters-tapped imposed on creatures by static** (the Intake) · new token defs `saproling_1_1_g`, `sphinx_4_4_wu`, `weird_x_x_ur`.
