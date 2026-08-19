# Session 4 Brief — Removal, discard, conditions and scopes (M3a)

Read first: `CLAUDE.md` (protocol: fuzz before fixtures; principles 9–10), `handoff.md`, `docs/decisions.md` ADR-024..030, `docs/data-model.md` §2–3 (conditions, scopes, discard modes, value refs, ATTACHED), pool registry "Session 4 additions" (append file).

## Goal

Land the removal suite, discard, the first trigger conditions beyond `self`, parameterized static scopes, and optional triggers — and bring black into the pool with a fourth slice deck. Everything here should slot into the existing stack/trigger/characteristics machinery. Fuzz across six pairings before fixtures.

## Part 0 — Small items

1. **`ATTACHED` event (ADR-026)** on attach / unattach / re-attach, with `{object, previousHost, newHost, cause: "aura-enter"|"equip"|"sba-unattach"|"host-left"}`. No trigger consumes it; EVENT stream only.
2. **Optional triggers (ADR-027):** `optional: true` → yes/no DecisionRequest for the controller at resolution (CR 603.5, 608.2b). Silent-if-forced does not apply (two options always exist).
3. **Value refs (ADR-028):** `{"ref":"targetPower","target":i}` resolved with last known information (CR 608.2h); `who: "controllerOfTarget"` uses the target's controller as last known.
4. **Six pairings** (A–B, A–C, A–D, B–C, B–D, C–D) in fuzz and replay. If the committed suite's time grows past ~30s, drop to 500 games/pairing in the suite and keep 1,000 in the CLI run reported in the handoff.

## Part 1 — Mechanics

- **`destroy` (targeted)** with predicates composed from `creature`, `nonblack`, `nonartifact`. Indestructible ignores it (704.5 / 702.12b). "Can't be regenerated" text is ignored (regeneration excluded by manifest §4).
- **`exile` (targeted)** — Swords: exile then `gainLife` to `controllerOfTarget` for `targetPower`. Exile is not "dies": no DIES trigger (700.4).
- **`destroyAll` / `damageAll`** already exist; Wrath and Pyroclasm are the first pool cards. Wrath: simultaneous; indestructible survives; auras go to graveyard via SBA; equipment stays.
- **Discard (ADR-029):** `ownerChooses` → DecisionRequest for the discarding player (choose N, or all if fewer); `random` → game RNG, logged; `casterChooses` with filter → the caster's DecisionRequest over the revealed hand filtered by predicate; if no card matches, nothing is discarded. Hand reveal: the caster's `GameView` includes the revealed hand for that decision only.
- **Trigger conditions:** `source: "attached"` and `player: "opponentOfController"` on `DEALS_DAMAGE_TO_PLAYER`. Curiosity's rulings: "you"/"opponent" are relative to the aura's controller; any damage (combat or not) counts; it does not trigger when the enchanted creature damages Curiosity's controller.
- **Parameterized scopes:** `{scope:"creaturesYouControl", subtype:"Goblin", other:true}` for P/T and keyword grants (Goblin Chieftain grants haste — summoning sickness must consult `characteristics()` for haste, which it should already).
- **Black:** `colors` field and `nonblack` predicate get real exercise, including against red Goblin tokens (legal Doom Blade targets) and black creatures (illegal).

## Part 2 — Cards (Scryfall-verified by planner; re-verify on encode)

| cardId | Name | Cost | Type | P/T | Text |
|---|---|---|---|---|---|
| swamp | Swamp | — | Basic Land — Swamp | — | {T}: Add {B}. |
| doom_blade | Doom Blade | {1}{B} | Instant | — | Destroy target nonblack creature. |
| terror | Terror | {1}{B} | Instant | — | Destroy target nonartifact, nonblack creature. It can't be regenerated. |
| swords_to_plowshares | Swords to Plowshares | {W} | Instant | — | Exile target creature. Its controller gains life equal to its power. |
| wrath_of_god | Wrath of God | {2}{W}{W} | Sorcery | — | Destroy all creatures. They can't be regenerated. |
| pyroclasm | Pyroclasm | {1}{R} | Sorcery | — | Pyroclasm deals 2 damage to each creature. |
| duress | Duress | {B} | Sorcery | — | Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card. |
| mind_rot | Mind Rot | {2}{B} | Sorcery | — | Target player discards two cards. |
| hymn_to_tourach | Hymn to Tourach | {B}{B} | Sorcery | — | Target player discards two cards at random. |
| phyrexian_rager | Phyrexian Rager | {2}{B} | Creature — Phyrexian Horror | 2/2 | When this creature enters, you draw a card and you lose 1 life. |
| nekrataal | Nekrataal | {2}{B}{B} | Creature — Human Assassin | 2/1 | First strike. When this creature enters, destroy target nonartifact, nonblack creature. That creature can't be regenerated. |
| vampire_nighthawk | Vampire Nighthawk | {1}{B}{B} | Creature — Vampire Shaman | 2/3 | Flying, deathtouch, lifelink |
| child_of_night | Child of Night | {1}{B} | Creature — Vampire | 2/1 | Lifelink |
| typhoid_rats | Typhoid Rats | {B} | Creature — Rat | 1/1 | Deathtouch |
| goblin_chieftain | Goblin Chieftain | {1}{R}{R} | Creature — Goblin | 2/2 | Haste. Other Goblin creatures you control get +1/+1 and have haste. |
| curiosity | Curiosity | {U} | Enchantment — Aura | — | Enchant creature. Whenever enchanted creature deals damage to an opponent, you may draw a card. |

## Part 3 — Decks (40 each; record in pool registry)

- **D (mono-black, new):** 17 Swamp, 3 Typhoid Rats, 3 Child of Night, 3 Vampire Nighthawk, 3 Phyrexian Rager, 3 Nekrataal, 2 Doom Blade, 2 Terror, 2 Duress, 1 Mind Rot, 1 Hymn to Tourach.
- **A (red):** −1 Hill Giant, −1 Brute Force, −1 Goblin Piker; +2 Goblin Chieftain, +1 Pyroclasm.
- **B (white-blue):** −1 Suntail Hawk, −1 Wind Drake, −1 Savannah Lions, −1 Mind Stone, −1 Darksteel Myr; +2 Swords to Plowshares, +1 Wrath of God, +2 Curiosity.
- **C (green):** unchanged.

## Fuzz smoke first (protocol)

After Part 3: `pnpm fuzz --games 300` across all six pairings. Fix anything it finds with a regression unit before any fixture below.

## Scenario fixtures (minimum; CR cited where non-obvious)

1. Doom Blade: Vampire Nighthawk is not a legal target (color predicate reads `colors`); a red Goblin token is; Darksteel Myr is a legal Doom Blade target but survives (702.12b) — Terror can't target it at all (artifact).
2. Swords on a Bonesplitter-equipped Child of Night (4/1): exiled; its controller gains 4 (608.2h last known info); Bonesplitter stays unattached; no DIES trigger fires for an exiled Pelakka (700.4).
3. Wrath: Pelakka + Nighthawk + Darksteel Myr + Pacified creature on board → all but Myr die simultaneously; Pelakka's controller draws; Pacifism to graveyard via SBA; equipment remains.
4. Pyroclasm: kills 2-toughness creatures, not Nighthawk (2/3) nor Myr; spell is the source so no deathtouch/lifelink interactions; Gladecover Scout dies (not targeted).
5. Duress: opponent's hand revealed to caster's decision only; caster chooses among noncreature-nonland; hand of all creatures/lands → no discard; chosen card to graveyard.
6. Mind Rot: target player's DecisionRequest to choose two; one-card hand discards one; empty hand does nothing.
7. Hymn: two random via game RNG; log entries present; replay byte-identical.
8. Rager at 1 life: draws then loses 1 → SBA loss (or draw from empty + lose — order of losses is moot: player loses).
9. Nekrataal: ETB destroy requires a target; with no legal target the trigger never goes on the stack (603.3d); legal target destroyed; Nekrataal targeting an opponent's black creature is not offered.
10. Goblin Chieftain: other Goblins +1/+1 and haste, itself unaffected by its own static; a Goblin token created this turn can attack; Chieftain dies → token loses haste and (still summoning sick) can no longer attack; Siege-Gang tokens are 2/2.
11. Curiosity on own Fencing Ace dealing combat damage to opponent → optional trigger, yes draws / no doesn't (both orders in test); Curiosity on an opponent's creature that damages you → no trigger; Prey Upon damage to a creature → no trigger; a Curiosity'd Siege-Gang activation hitting the opponent → triggers (noncombat).
12. Nighthawk blocked by a 4/4: 4/4 destroyed by deathtouch, Nighthawk survives? No — 4 damage kills a 2/3; both die, controller gains 2 from lifelink. (Pure keyword composition; no new rules.)
13. ATTACHED events appear for aura entry, equip, re-equip, and SBA unattach.
14. Replay ×3 seeds × 6 pairings; fuzz 1,000/pairing clean; summary table.

## Definition of done

1. Parts 0–3; fuzz-first done and noted in handoff; fixtures 1–14 green.
2. Rules registry: R-016 conditions beyond `self`; R-017 parameterized scopes; new rows for `destroy`/`exile` targeted, discard modes, optional triggers, value refs, ATTACHED; R-021 token-color note closed.
3. Pool registry: S4 rows `tested`; Deck D and swaps recorded.
4. `handoff.md` per template. Concerns expected: whether the condition object wants to grow toward a general predicate (resist; report the pressure), how hand-reveal interacts with `GameView` redaction, whether value refs want arithmetic.

## Out of scope

Control change, reanimation, regrowth, legend rule, Drana, Mystic Snake, Rancor (S5). UI, viewer, art, AI.

## Escalate, don't decide

Any new scope parameter beyond `subtype`/`type`/`other`; any condition field beyond the documented object; any value ref beyond `targetPower`; any discard mode beyond the three; regeneration (never).
