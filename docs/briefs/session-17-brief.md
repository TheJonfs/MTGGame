# Session 17 Brief — Expansion 1: the Bestiary's Arsenal (REPLACES the earlier S17 brief — do not run that one)

Read first: `CLAUDE.md`, `handoff.md`, appends in order (`decisions-append-S17.md` [ADR-073/074] then `decisions-append-S17-expansion.md` [ADR-075/076] — append both, verified), `docs/expansion-1-cards-and-decks.md` (the batch; **⚠ rows are unconfirmed planner memory — Scryfall re-verification is a blocker-level check this session, mismatches flagged not fixed**), mechanics-manifest (add A4–A8 verbatim from ADR-075).

## Goal

The engine work and card encoding for the 32-card expansion (incl. ADR-074's two): five amendments (counting refs, zone abilities/cycling, modal, additional spell costs, blink/up-to), the ADR-076 small systems, all cards with fixtures, both custom-card encodes (Gaean Wurm data; art rides S18), ladder/fuzz sanity. **No bestiary catalog, no renders, no world changes, no riders** — that's S18.

## Parts

1. **A4 counting:** count refs in amounts, statics (Gaean, Werebear-threshold as conditional static), and Baru's reduction input. Fixtures: Tendrils X tracks Swamps at resolution (608.2h); Gaean grows/shrinks live with Forests (Boomerang a Forest mid-combat → assignment recomputes); Werebear flips at exactly 7 (mill self as the driver — Adept synergy); Baru token at {7}{G} down to {G} floor.
2. **A5 zone abilities:** enumerator offers hand-zone (cycling) and graveyard-zone abilities with zone-legal costs; cycling = discard-self + draw. Fixtures: cycle at instant speed; cycled card triggers nothing on-battlefield; Mother Bear from graveyard sorcery-only, exile-self, two tokens; a milled Mother Bear is activatable (Adept synergy again).
3. **A6 modal:** mode DecisionRequest at cast/trigger placement, targets after mode; Channeler's three modes each fixtured incl. "no other nonland permanent → bounce mode not offerable" (601.2b legality).
4. **A7 additional costs:** Grenade sacs at cost time; the Goblin's DIES trigger orders normally (S3 fixture-2 pattern); no Goblin → not castable.
5. **A8 blink:** Restoration Angel exile-return as new object, ETBs refire (blink a Rager: draw+lose again), up-to-zero targets legal (flash blocker mode); non-Angel predicate enforced.
6. **ADR-076 systems + all remaining cards** with per-card fixtures where nontrivial (Bouncer's discard cost; Matron search-by-subtype incl. fail-to-find; Blood Artist on both players' creatures incl. itself and simultaneous Wrath deaths; Bitterblossom upkeep; Waste Not's three payloads incl. triggered mana; Dark Ritual same-step spend; Scepter tapping a land).
7. **Sanity:** full suites green; fuzz smoke on existing pairings unchanged; `art:fetch` for the batch (defaults; UB printings fine per ADR-076); pool registry rows.

## Definition of done

All fixtures green; every ⚠ row's verification outcome listed in the handoff (even "confirmed as written"); registries updated; honest Concerns on which amendment fought back.

## Out of scope / Escalate

Beast catalog/decks/renders, riders, world (all S18). Any sixth amendment; any card the verification breaks (flag, skip, continue).
