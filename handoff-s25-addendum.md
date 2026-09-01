# Handoff addendum — Session 25, playtest round 4 (2026-09-01)

*For the planner, following the already-delivered S25 handoff (rounds 1–3 are in it). Nine notes
from Chris's continued walk, all landed and pushed; suite 433 green. Sections mirror the handoff's
discipline: what changed, what was ruled by doing, what the planner should look at.*

## Fixed

1. **Cycling was unreachable from the hand** (Chris: Airship Crash glowed, click did nothing). The
   click path consulted lands and casts only; hand-zone ACTIVATIONS lived in the `activatable` map
   unreached — the glow came from the same map making the window "meaningful", so the highlight was
   honest and the click was broken. Now: activation-only → straight to it; cast AND cycle both
   legal → a **cast-or-cycle chooser** (the requested behavior); hand duplicates alias for
   activations too (the S10/S22 aliasing, third verse). *Watch: verified by typecheck/parse/suite,
   not yet by a live browser duel — worth thirty seconds of Chris's next game.*
2. **Quest rows now state the pursuit** (note 2): card-couriers name their cargo ("carrying
   Boomerang"), and **every row ends with its reward** ("pays 50g + a life manalink") — the reward
   is the pursuit, so it's on the row, not just the offer board.
3. **Manalink offers name their kind up front** (note 3): "+ a Life Manalink (+1 max life,
   town-tied)" vs "+ a Manalink (a Swamp in play, town-tied)" — no more colour-tagged surprises.
4. **Renown moved into the five-lords panel** (note 4): per-colour bars with pips and counts plus
   the total, under the lords it frightens — the Journey line's text band is gone. Rationale text:
   "fear spreads by colour."
5. **"Years" retired from lord growth** (note 5): the growth clock is the player's own road, and
   the display now says so — "+N grown while you walked" (rows), "has grown while you walked"
   (voice). **Planner note:** the rumor text-pack may carry sibling phrasings worth aligning.
6. **The dungeon rail shows what's held for the next fight** (note 6): boons list by name (tokens
   and lands included, "fights beside you, spent when it's fought"), and the armed Barrage shows
   its damage. Explicit line: everything held dies with the run.
7. **Over-cap basic manalinks fall back to a LIFE manalink, not gold** (note 7 — reading Chris's
   "lifepoint" as the life-kind link, the same currency his note 3 called "a point of life"; life
   links are uncapped since r2, so the fallback always lands. If he meant +1 CURRENT life instead,
   it's a three-line change). Only an over-cap life link still coins out — currently impossible at
   the uncapped default.
8. **Lord growth rates re-set** (note 8): **0.5 / 1 / 2 life per 100 steps** by easy/standard/hard
   (was a flat 2/100 — `+5 per 250`). Standard = +1/100 (increment granularity finer, so growth
   reads smoother); easy stretches to +1/200; hard doubles the increment. `lordGrowthCap` (20)
   untouched. A standard dawdler at ~1000 steps now meets lords at base+10, not the cap.
   **Interior empowerment untouched** — Chris's note 8 named the world clock; the in-dungeon
   schedule (`dungeonEmpowermentTiers`/`stronghold…`) is a separate dial if his next dive still
   reads hot.
9. **The Barrage reaches the interiors** (note 9 — closing the handoff's concern 5 surface gap):
   an **"arm the Barrage"** control on the dungeon rail burns the fuel NOW and opens the NEXT
   interior fight (minion or boss) with the damage — the boons' hold-or-spend shape exactly, and
   the armed state rides the save (`DungeonRun.armedBarrage`). Cap shared with the overworld form
   (armed total ≤ cap); spent by whichever battle comes, win or lose; dies with the run at
   walk-out/defeat like everything held. Regression-tested through dungeonDuelSpec and
   applyInteriorDuel.

## Rulings made by doing (planner sanity-check wanted)

- **The interior Barrage arms the NEXT fight, not a chosen fight** — no pre-boss confirm screen
  exists, and boons set the precedent; arming right before stepping onto the guardian is the
  boss-softening line. If the design wants a per-fight prompt instead, that's a new screen.
- **The over-cap-basic → life-link fallback** (above): the "lifepoint" reading.
- **The reward suffix on quest rows** treats reward-visibility as the fix for "what are we
  pursuing" on courier-class quests; if the planner wants richer pursuit text (the text pack's
  voice), the row has room.

## Standing items the addendum touches

- The handoff's **concern 5 (interior Barrage surface)** is now CLOSED by note 9's control.
- The handoff's **basic-manalink constraints escalation** (r2) gains a data point: with over-cap
  basics converting to life links, the basic cap is now purely a board-state constraint — the
  reward stream never wastes. The 1/colour question stands.
- **Lord difficulty watch** (r3 observation): the growth-rate change is the first pull on that
  thread; kill tables and Chris's next stronghold dive are the evidence for whether interior
  empowerment needs the second pull.

## Test status

Suite 433 passed / 2 skipped after the round (was 431): +2 (the interior-Barrage spec/spend test;
the over-cap fallback test through the questsOnArrival seam). Typecheck + parse gate clean.
knobs.md regenerated (lordGrowth rates, prior siege knobs). No engine words this round — the
takeback (r3) remains the session's last engine surface.
