# Session 5 Brief — Control change, reanimation, legend rule (M3b — closes the ceiling)

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-031..036, `docs/data-model.md` §3 (gainControl, returnFromGraveyard), engine-design §2 (owner/controller), §7 (control layer), §9 (SBAs). Pool registry "Session 5 additions" (append file).

## Goal

Cash in the Session-1 owner/controller split with Control Magic, bring the graveyard into play with Zombify and Gravedigger, land the first SBA-with-a-choice (legend rule), and finish the ceiling with Drana, Rancor, and Mystic Snake. After this session every mechanic in the manifest's ceiling has a real card. Deck E (Simic) joins; fuzz moves to the ADR-034 structure.

**Note before you start:** Mystic Snake does **not** need a SPELL_CAST event. It is flash + an ETB trigger whose target predicate is `spell`. The whole behavior is stack timing: cast Snake with a spell on the stack, the ETB trigger goes above it and counters it. With an empty stack the trigger has no legal target and is never placed (603.3d). Gravedigger is an optional ETB (ADR-027) returning to hand; only Zombify is reanimation to the battlefield.

## Part 0 — Suite structure (ADR-034)

Default suite: 100 games × 10 pairings. `FUZZ_FULL=1`: 500/pairing. CLI unchanged; handoff table at 1,000/pairing. Replay determinism test stays in the default suite at ×2 seeds × 10 pairings.

## Part 1 — Mechanics

- **Control change (ADR-033, R-020):** static `gainControl` scope `attached`, control layer of ADR-003. On change: summoning sickness set for the new controller (302.6); "you control" predicates and statics recompute (opponent's Anthem stops, yours starts); activated abilities/sacrifice costs available to the new controller; equipment controlled by the former controller stays attached and keeps buffing (301.5c — only *equipping* requires control); auras stay. On reversion (aura leaves): control returns, sickness set again. Zone moves route by owner (400.3).
- **Legend rule (704.5j, R-025):** SBA; a player controlling two or more legendary permanents with the same name chooses one, rest to owners' graveyards; DecisionRequest with the candidates (never silent — ≥2 options). Applies per controller (two players each with a Drana: no rule).
- **Reanimation / regrowth:** `returnFromGraveyard` with `to: battlefield` (Zombify) and `to: hand` (Gravedigger); predicate `creatureCardInYourGraveyard`. Returned-to-battlefield objects are new objects, enter under the effect controller's control, and fire ETB triggers. Tokens never exist in graveyards.
- **Rancor's return trigger:** a DIES-class trigger on an *aura* (`ZONE_CHANGE` battlefield→graveyard, source self) returning it to its owner's hand. Fires when its host dies (SBA sends Rancor to graveyard) or when Rancor is destroyed; does not fire when Rancor is countered or fizzles (never on the battlefield — Scryfall ruling).
- **Drana:** `{X}{B}{B}` activated, target creature: `modifyPT(0, −X, EOT)` on the target and `modifyPT(+X, 0, EOT)` on self, in that order; may target itself; if the target is illegal at resolution the ability fizzles and Drana gets no bonus (608.2b; Scryfall ruling). X enumeration 0..max exists (ADR-017).
- **Flash** on a creature (R-? confirm existing flash path is exercised — instant timing for a creature spell, enumerator offers it on opponent's turn and with a non-empty stack, 702.8).

## Part 2 — Cards (Scryfall-verified by planner; re-verify on encode)

| cardId | Name | Cost | Type | P/T | Text |
|---|---|---|---|---|---|
| control_magic | Control Magic | {2}{U}{U} | Enchantment — Aura | — | Enchant creature. You control enchanted creature. |
| zombify | Zombify | {3}{B} | Sorcery | — | Return target creature card from your graveyard to the battlefield. |
| gravedigger | Gravedigger | {3}{B} | Creature — Zombie | 2/2 | When this creature enters, you may return target creature card from your graveyard to your hand. |
| rancor | Rancor | {G} | Enchantment — Aura | — | Enchant creature. Enchanted creature gets +2/+0 and has trample. When this Aura is put into a graveyard from the battlefield, return it to its owner's hand. |
| drana_kalastria_bloodchief | Drana, Kalastria Bloodchief | {3}{B}{B} | Legendary Creature — Vampire Shaman | 4/4 | Flying. {X}{B}{B}: Target creature gets −0/−X until end of turn and Drana gets +X/+0 until end of turn. |
| mystic_snake | Mystic Snake | {1}{G}{U}{U} | Creature — Snake | 2/2 | Flash. When this creature enters, counter target spell. |

## Part 3 — Decks (40 each; record in pool registry)

- **E (Simic, new):** 9 Forest, 8 Island, 3 Mystic Snake, 2 Counterspell, 2 Boomerang, 2 Wind Drake, 2 Man-o'-War, 2 Cloudkin Seer, 2 Curiosity, 3 Grizzly Bears, 3 Elvish Visionary, 2 Deadly Recluse.
- **B:** −1 Fencing Ace, −1 Savannah Lions; +2 Control Magic.
- **C:** −1 Giant Growth, −1 Grizzly Bears; +2 Rancor.
- **D:** −1 Typhoid Rats, −1 Child of Night, −1 Phyrexian Rager, −1 Terror, −1 Duress, −1 Mind Rot; +2 Drana, +2 Gravedigger, +2 Zombify. (Two Dranas so the legend rule is fuzz-exercised.)
- **A:** unchanged.

## Fuzz smoke first (protocol), then fixtures

## Scenario fixtures (CR cited)

1. Control Magic on opponent's Grizzly Bears: you control it; it cannot attack this turn (302.6); next turn it can; your Glorious Anthem buffs it and the opponent's no longer does. Boomerang on Control Magic → control reverts; Bears is sick for its original controller this turn (302.6).
2. Stolen Pelakka Wurm dies to your own Wrath → owner's graveyard (400.3); DIES trigger belongs to you as controller at death (ADR-016, 603.3a) — you draw.
3. Stolen Goblin token: you may sacrifice it to your Siege-Gang (you control it); it ceases to exist; Boomerang on a stolen non-token → owner's hand.
4. Stolen creature wearing the opponent's Bonesplitter and Pacifism: Bonesplitter stays attached and still buffs (301.5c); Pacifism still restricts; the opponent cannot re-equip Bonesplitter onto it (equip needs `creatureYouControl`), and you cannot equip it either (you don't control the Bonesplitter).
5. Legend rule: you control Drana and cast a second → SBA DecisionRequest; the unchosen one goes to the graveyard (704.5j). Control Magic stealing the opponent's Drana while you control one → same request. One Drana each → no rule.
6. Drana X=3 on an opponent's 2/3 → toughness 0 → dies (704.5f); Drana is 7/4 until cleanup. X=3 on herself → 7/1. Target bounced in response → fizzles, Drana stays 4/4 (608.2b).
7. Zombify on Pelakka → new object, ETB gains 7, DIES trigger later still works; Zombify on Nekrataal → ETB destroy trigger fires; target exiled in response (Swords can't hit graveyards — use test-only exile-from-graveyard or Gravedigger racing it) → fizzles.
8. Gravedigger: optional ETB; decline leaves the card; accept returns it to hand; empty graveyard → trigger not placed (603.3d).
9. Rancor: host dies in combat → Rancor to graveyard via SBA → trigger returns it to owner's hand; Rancor countered → stays countered (no trigger); Rancor's target bounced in response → fizzles to graveyard, no return.
10. Mystic Snake cast in response to opponent's Lightning Bolt (flash, 702.8) → ETB trigger targets Bolt → countered; Snake cast with empty stack → no trigger; Snake's trigger targeting a Blurred Mongoose spell → resolves, does nothing (R-032); Snake in response to an opponent's Counterspell that targets your Serra Angel → Snake counters the Counterspell, Angel resolves.
11. Two Counterspells vs. Snake: opponent Counterspells the Snake itself in response to its cast → Snake countered, no ETB.
12. Replay ×2 seeds × 10 pairings (default suite); `FUZZ_FULL` clean; CLI 1,000/pairing table in the handoff.

## Definition of done

1. Parts 0–3; fuzz-first done; fixtures 1–12 green.
2. Rules registry: R-020 (control change), R-025 (legend rule) → implemented; new rows for reanimation/regrowth, aura DIES triggers, flash-on-creatures if not already; R-011's control-change note closed.
3. Pool registry: S5 rows `tested`; Deck E + swaps; ceiling-anchors list emptied with a note that the manifest ceiling is complete.
4. `handoff.md` per template. Concerns expected: whether the control layer's recomputation wants caching (performance), whether legend-rule-with-choice exposed any SBA-loop ordering subtlety, anything the graveyard targeting revealed about zone-aware predicates.

## Out of scope

Replay viewer (M3.5 — next), UI, art, AI. Any card not listed.

## Escalate, don't decide

Targeted/temporary control change (Threaten-style — not in ceiling); reanimating from an opponent's graveyard; any new zone predicate beyond `creatureCardInYourGraveyard`; caching changes to `characteristics()` beyond what fuzz timing forces.
