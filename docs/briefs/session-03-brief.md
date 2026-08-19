# Session 3 Brief — Vocabulary expansion 2 (M2b)

Read first: `CLAUDE.md` (new principle 9), `handoff.md`, `docs/decisions.md` ADR-019..023, `docs/data-model.md` §1–3 (colors, conditions, scopes, fight), pool registry "Session 3 additions" (append file). Engine-design §7 (effects), §8 (combat).

## Goal

Finish M2: every Tier 0 slot gets a real pool card exercising it. Sacrifice-as-cost, equipment, the remaining combat keywords, fight, mana rocks, and the hexproof/shroud/indestructible hooks that have been live since S1 with nothing using them. Each is meant to be a rule added to an existing step. If anything needs a step restructured, stop and flag — that's the headline Concern.

## Part 0 — Small rulings from the S2 review

1. **`colors` field (ADR-019).** Add to schema and validator: optional on cards, derived from mana cost if absent; **required** on token defs. Backfill `soldier_1_1` as `["W"]`. Color predicates read the field.
2. **Ordering actions carry object ids.** `orderTrigger` / `orderBlocker` log entries include the source object id alongside cardId.
3. **Colorless mana.** Mind Stone produces `{C}`. Confirm the mana pool distinguishes colorless from generic and auto-pay spends `{C}` only on generic costs. R-006's mono-producer interim still holds (Mind Stone is single-output).
4. **Fight legality (ADR-022)** is all-or-nothing in the `fight` resolver.

## Part 1 — Mechanics

- **Sacrifice as cost (R-023):** both forms — `sacrifice: {predicate: "self"}` (Mind Stone) and `sacrifice: {predicate: "creature.subtype:Goblin"}` (Siege-Gang). Choice of which Goblin is a `DecisionRequest` (ADR-011). Sacrificed object goes to graveyard via `moveObject` as part of cost payment, before the ability is on the stack (CR 601.2h / 602.2b) — its DIES trigger, if any, fires and is ordered normally.
- **Equipment (R-019):** `equip` is an activated ability, sorcery timing, target creature you control; attaches via the existing attach system; equipment stays on the battlefield unattached when the creature leaves (SBA unattaches, does not destroy — unlike auras); re-equip moves it. Statics use `attached` scope. Equipment can be attached to a creature that then loses legality (e.g., stolen — M3) — SBA unattaches.
- **Combat keywords:** deathtouch (assignment: 1 damage is lethal for ordering; dealing: destroy on any damage from a deathtouch source — both combat and fight), lifelink (dealing: controller gains equal to damage dealt, simultaneous, for combat and noncombat), double strike (both damage steps; `strikesInStep` already handles — now tested with Fencing Ace), menace (block-legality at "done declaring blockers": 0 or ≥2 blockers).
- **Fight** resolver with ADR-022 semantics; damage is noncombat, from each creature as a source (so deathtouch/lifelink apply).
- **"Can't be countered"** as a static on spells (Blurred Mongoose): `counter` resolver is a no-op against it; the Counterspell still resolves and goes to the graveyard.
- **Hexproof / shroud / indestructible** on real cards: hexproof blocks opponent targeting only (own Giant Growth legal); shroud blocks all (own Giant Growth and equip illegal); indestructible ignores lethal damage and `destroy`/`destroyAll` but dies to toughness ≤ 0.
- **Mana rock:** Mind Stone as the first non-land producer; `{T}: Add {C}` is a mana ability (no stack).

## Part 2 — Cards (all Scryfall-verified by planner; re-verify on encode)

| cardId | Name | Cost | Type | P/T | Text |
|---|---|---|---|---|---|
| siege_gang_commander | Siege-Gang Commander | {3}{R}{R} | Creature — Goblin | 2/2 | ETB: create three 1/1 red Goblin creature tokens. {1}{R}, Sacrifice a Goblin: this deals 2 damage to any target. |
| goblin_1_1 (token) | Goblin | — | Creature — Goblin | 1/1 | colors ["R"] |
| boggart_brute | Boggart Brute | {2}{R} | Creature — Goblin Warrior | 3/2 | Menace |
| bonesplitter | Bonesplitter | {1} | Artifact — Equipment | — | Equipped creature gets +2/+0. Equip {1} |
| loxodon_warhammer | Loxodon Warhammer | {3} | Artifact — Equipment | — | Equipped creature gets +3/+0 and has trample and lifelink. Equip {3} |
| mind_stone | Mind Stone | {2} | Artifact | — | {T}: Add {C}. {1}, {T}, Sacrifice this artifact: Draw a card. |
| darksteel_myr | Darksteel Myr | {3} | Artifact Creature — Myr | 0/1 | Indestructible |
| fencing_ace | Fencing Ace | {1}{W} | Creature — Human Soldier | 1/1 | Double strike |
| prey_upon | Prey Upon | {G} | Sorcery | — | Target creature you control fights target creature you don't control. |
| deadly_recluse | Deadly Recluse | {1}{G} | Creature — Spider | 1/2 | Reach, deathtouch |
| gladecover_scout | Gladecover Scout | {G} | Creature — Elf Scout | 1/1 | Hexproof |
| blurred_mongoose | Blurred Mongoose | {1}{G} | Creature — Mongoose | 2/1 | This spell can't be countered. Shroud |

Prey Upon's targets need predicates `creatureYouControl` and `creatureYouDontControl` — add to the predicate set if absent.

## Part 3 — Deck changes (40 each; record in pool registry)

- **A (red):** −3 Gray Ogre, −2 Hill Giant, −1 Goblin Piker, −1 Brute Force; +3 Boggart Brute, +2 Siege-Gang Commander, +2 Bonesplitter.
- **B (white-blue):** −2 Suntail Hawk, −2 Wind Drake, −1 Savannah Lions, −1 Boomerang, −1 Plains; +3 Fencing Ace, +1 Loxodon Warhammer, +2 Mind Stone, +1 Darksteel Myr.
- **C (green):** −3 Grizzly Bears, −2 Centaur Courser, −1 Rumbling Baloth, −2 Giant Growth; +3 Prey Upon, +2 Deadly Recluse, +2 Gladecover Scout, +1 Blurred Mongoose.

## Scenario fixtures (minimum)

1. Siege-Gang ETB makes three red Goblin tokens (`colors` = R); activating with a token as the sacrifice: token gone before ability is on the stack; ability resolves for 2 to face; sacrificing Siege-Gang itself is legal (it's a Goblin).
2. Siege-Gang activation with a Goblin that has a DIES trigger (test-only) — trigger fires during cost payment and is ordered against nothing else.
3. Mind Stone: taps for {C}, which pays generic but not {R}; sac-draw ability: Mind Stone gone, card drawn; can't activate both abilities in one turn (tap cost).
4. Bonesplitter: equip at sorcery speed only (illegal during combat / opponent's turn); equipped 2/1 is 4/1; creature dies → Bonesplitter stays unattached; re-equip to another creature moves it.
5. Warhammer on a 2/2: 5/2 trample lifelink; blocked by a 1/1 → 1 to blocker, 4 to player, controller gains 5.
6. Deadly Recluse blocks a 5/5 trampler: attacker must assign only 1 as lethal, 4 tramples over; Recluse's 1 damage kills the 5/5 via SBA.
7. Prey Upon: Recluse fights Baloth → both die (deathtouch, 4 ≥ 2). Prey Upon with the opponent's creature bounced in response → no damage either direction (ADR-022).
8. Fencing Ace with Bonesplitter: 3/1 double strike deals 3 in first-strike step and 3 in regular step; blocked by a 3/3, kills it in the first step, takes no damage back; unblocked deals 6.
9. Boggart Brute cannot be blocked by exactly one creature (enumerator: "done" is illegal with one blocker assigned to it); two blockers legal; zero legal.
10. Gladecover Scout: opponent's Bolt can't target it (not enumerated); own Giant Growth can; Pyroclasm-style `damageAll` (test-only) still hits it.
11. Blurred Mongoose: Counterspell targets it (legal), resolves, Mongoose is still cast; on battlefield, own Giant Growth and equip are both illegal.
12. Darksteel Myr: Bolt ×2 doesn't kill; test_wrath doesn't kill; −X/−X (test-only) to toughness 0 does.
13. Lifelink on noncombat damage: Warhammer-equipped creature in a Prey Upon fight gains life equal to damage dealt.
14. Replay ×3 seeds on all pairings; fuzz 1,000/pairing clean; fuzz summary table in handoff.

## Definition of done

1. Part 0–3 complete; fixtures 1–14 green; unit tests per keyword/resolver.
2. Rules registry: R-010 double strike, R-014, R-015, R-019, R-023, R-026 → `implemented`; new rows for fight, "can't be countered", colorless mana, equipment-unattach SBA; R-006 note updated for `{C}`.
3. Pool registry: S3 rows `tested`; deck changes recorded.
4. `handoff.md` per template. Concerns expected: whether the cost-payment ordering (sacrifice before stack) interacts cleanly with trigger collection; whether equipment and aura attachment logic wanted to diverge more than "destroy vs unattach".

## Out of scope

`destroy` single-target, Control Magic, reanimation, discard, legend rule, trigger conditions beyond `self`, parameterized scopes (all M3). UI, art, heuristic AI, replay viewer (M3.5).

## Escalate, don't decide

New effect words; any card needing text simplification; payment-model changes beyond the `{C}` check; anything that makes equipment need its own attach system.
