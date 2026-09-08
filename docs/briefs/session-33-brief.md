# Session 33 brief — the tiers against the road

*Planner → Implementer. 2026-09-08. Follows the running handoff.md (after S32). Process rules unchanged: appends to `docs/decision-updates/s33.md`; world-sim before knob arguments — this session measures, and moves no knob until the planner takes the table to Chris.*

## Where we are

S32's part 7 is the number this arc was working toward: every tier-2 and tier-3 mage loses 78–94% to a mid-road starter (a starter plus eight shop cards, one basic in play, 12 life, journeyman). The beasts say the same from the catalog side — only the top of the bestiary stands against raw starters. The lists are done (three sessions of turns moved the tiers where lists could move them); what's left is the tier itself. ADR-106/111 say the dial is worldcraft. This session builds the table the ruling will be made from.

## Part 0 — Ratifications and ADR appends (docs/decision-updates/s33.md)

- **Deviations 1–4 ratified.** Deviation 1 recorded as an **erratum to S28**: the cantrip window compared the step to a name the engine never uses, so Brainstorm's end-step cast never fired live between S28 and S32; every blue sweep number in the S29–S31 baselines was measured with it dead. No decision changes — the blue decks were fixed for other reasons — but the S31 baseline carries the defect and the S32 run is the first clean blue read. Deviation 3 (the view's stack carries targets) is the shape the S29 Altar read needed all along; the Altar's "doomed" gate has been live only since S32.
- **ADR-112 — Tessaly stands.** Inside the tier 26/28/35, wins by damage as well as library, in ADR-103's band against black and near it against red; the white starter walls her as it walls everyone. No further list turns.
- **ADR-113 — Corvane waits for the tier.** Reanimator is a plan that needs turns; three sessions of list turns moved him between 22 and 46 against the starters. He is the deck that will show whether the tier lever works: if a tier-3 mage with the right life and entrance still folds with him, the archetype is wrong for the tier and the planner will say so. No list turns this session.
- **ADR-114 — The white road is the gentle road (Chris).** Dawn Levy stands as the easy way into the game; parity was reached in five of ten pairings and the remainder is weenie beating 30-card decks. The road teaches its own lesson later: a plan that beats 10–12-life foes needs serious upgrading against a Mox, stronghold or petal boss, so the player learns to evolve from the base rather than double down on one- and two-drops. No further starter turns.
- **ADR-115 — The tier lever will be wired through the difficulty dial, not only globally (Chris, in principle).** Whatever Part 2 says, the implementation shape is: an opponent's tier life and entrance are resolved from (tier, difficulty mode) — Easy / Standard / Hard may map to different cells of the matrix — and the same resolver is the hook phase two will use to harden every enemy, to field a second map of stronger ones, or to adapt a matchup to what the player brings (the legacy's ministers and powers). Part 6 below asks the implementer to scope that wiring; nothing is switched on this session.

## Part 1 — The levers

Two worldcraft levers, both already vocabulary:
1. **Tier life** — `mageLife` by tier (8/10/12 today) and the beasts' catalog life by tier.
2. **The mage entrance** — tier-2 and tier-3 mages begin the duel with basics on the battlefield, the player's manalink shape (`permanentOnBattlefield`, the Heart's roots path). The fiction writes itself: the mages have walked the roads too. Beasts don't get roots.

Not levers this session: the AI profile (ADR-103 — the dial is not AI sophistication), the mage lists (done), the mage deck size.

## Part 2 — The matrix

Sweep part 8, against **both mid-road references** (road-mid-W, road-mid-B), 100 games per cell both seats, the mage at its tier's profile:

- **Tier 3** (the five mages): life {12, 16, 20} × entrance {none, 1 basic, 2 basics} — nine cells per mage per reference.
- **Tier 2** (the five mages): life {10, 12, 14} × entrance {none, 1 basic} — six cells.
- **Tier 1**: not measured — the teachers are calibrated against the starters and stay at 8 / none.

The entrance basics are the mage's own colours (a tier-2 mage's two colours → one basic of its primary colour, or one of each for two; the implementer picks the primary by the list's pip count). Untapped, logged, replay-clean, the telegraph/parley line says nothing about it yet (the planner writes the line once the number is ratified).

Report per cell: the reference's win rate, mean turns, wins by library. Then two aggregate tables (tier 3, tier 2): reference win rate by (life × entrance), averaged over the five mages and the two references.

**The read the planner wants:** the cell where the mid-road references win **55–65%** — a fight the player *mostly* wins, because a human plays the road deck better than journeyman and the real mid-road deck is stronger than the reference. Report the nearest cells above and below as well. Also: Corvane's own cells (does the reanimator turn at 16 or 20 life?), and any mage whose curve is flat across life (a deck that dies to a plan, not a race, won't move with life — that's a list problem after all).

## Part 3 — The beasts, the same question

Sweep part 9: the tier-2 and tier-3 beasts (the Warband, the Nighthawks, the Gale, the Baloths, the Siege-Gang, the Specters, the Serra, the Formation, the Wurms, the Tactician at tier 2) against both mid-road references at their catalog life and at catalog +4 and +8. Report as Part 2. The tier-1 beasts are the early ring's fodder and stay where they are.

## Part 4 — The blue re-read
With the cantrip window open for the first time, report Brainstorm's per-copy cast rate and end-step share for Tessaly, Kessa, Pell, Varro and Quill, beside the S31 numbers. If any blue deck's tier standing moved materially from the window alone (not the Escort), say which.

## Part 5 — Director round (Chris)
Both rulings are in (ADR-114, ADR-115). The open question after this session is the number: which cell(s) of the matrix become Standard, and whether Easy and Hard sit one cell either side of it. The planner brings the table.

## Part 6 — Scope the difficulty-dial wiring (no build)
Write up, in the handoff, how an opponent's duel setup is resolved today (where tier life, profile, anteCount and the Heart's roots/entrance come from; where the Easy/Standard/Hard mode is read — the starters' variants, `heartLife` 35/40/45) and what a single **matchup resolver** would look like: `resolveMatchup(opponent, mode, legacy) → {life, profile, entrance[], ante}`, with tier × mode tables in the knobs registry and a hook for a legacy-aware term (phase two: "the player holds N ministers / M powers → +X"). List what moves, what tests it needs, and what the sweep would need to run per mode. Half a page; the planner turns it into the S34 brief once the matrix is read.

## Verification & handoff
No fuzz/fixtures beyond the entrance path (reuse the Heart's roots fixtures at one and two basics for a mage), replays byte-exact. No knob changes; `TIER_LIFE` in the sweep CLI is parameterised, the catalog is untouched. Handoff: parts 8–9 in full with the aggregates, part 4's rates, and the implementer's own read of where the 55–65 cell sits.
