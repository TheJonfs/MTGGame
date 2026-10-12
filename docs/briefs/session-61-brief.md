# Session 61 brief — two debts, paid before the next format

*Planner → Implementer. 2026-10-12. Follows the running handoff.md (after S60 and the week's work, through the revised Mardu Control). One session; the next format's seeds are S62. Process rules unchanged: appends to `docs/decision-updates/s61.md`; probe before rule (ADR-167); every AI change carries a ladder delta or reverts. **Do not push** — Chris holds pushes for one larger push.*

## Part 0 — Rulings and ADR appends
- **S60's deviations and the week's work ratified as a block**: Mardu Control registered with its guide and the `large` shape; the Coin and the Hearth archived; the drifting-loop draw (R-103 amended); book 123; the single match as a match, with its games recorded; the two theft-shell trial rules off; the tables of record at fourteen lists; the merge correction.
- **ADR-175 — The Open's three pillars.** Reaper Clio (71.5), Mardu Control (69.7), the Rabble (64.9), in a triangle (Mardu Control over the Rabble and over Reaper Clio at 900 matches; Reaper Clio over the Rabble). The format's three things to do: go fast, play Clio, loop Ushers. **The Usher returning the Usher stays, deliberately** (Chris); the design observation is recorded — a two-card win of one card that a counter on the first copy sets up — and the lever if the triangle breaks is the Usher's restriction (ADR-160's second). ADR-173's Clio measure is withdrawn: a predator from play reached 55.
- **ADR-174 count**: the Tollgate's begins (thirteenth; its prey archived).
- **The scratch tools live in the repo** (the shard launcher, the paired-comparison scripts; Concern 6).

## Part 1 — The loop that helps the opponent (probe, then rule)
Book 99 asks whether a loop gains nothing for us; the Hearth game that never ended was a loop that gained for them (their larger drain, our Soul Warden giving the difference back). **Probe**: from the recorded match runs and a scratch set (the Usher mirrors; Mardu Control against the Hearth's archived list), every loop the AI started — its net per iteration for each side at the moment of the choice, and who was ahead when the draw or the end came. **Rule**: a loop is started only when its net per iteration is positive for us *and* not more positive for them; a loop already running is stopped (the "may") by the same test each iteration. Measure on the Usher pairings (Mardu Control against the Pall and the archived Hearth; the Pall mirror) and the ladder.

## Part 2 — The sideboarding out-rule (probe, then rule)
Concern 1: "removal in for the lowest-rated creature" takes out the Walls and the token-makers that an aggro matchup needs; the Levy is 2.8 better with no sideboarding; the old Reaper Control was 8 better against the Rabble. **Probe**: `open:rr --deck-guide` with an empty guide for every rules-sideboarded list — the "no sideboarding" number beside the rules' — and `sideboard:show` for the pairings where the rules lose points: which cards left. **Rule** (the planner's expectation, to be confirmed by the probe): against a `small` shape, defenders and token-makers are never the out; the out is the lowest-rated *non-defensive* card (a spell first, then a creature with power ≥ toughness); against `graveyard`, the out is spot removal before creatures. Measure every rules list paired (the rule on against off), the three columns; adopt per list where it gains, since a list under a guide is untouched.

## Part 3 — The journey's Purge
Book 123 means the lord decks and the Heart's deck now cast Phyrexian Purge. `flood-sim --refs postlairs` once and `heart-sim --tide 1 --refs postlairs` once on pilot 123: the lords' and the fount's rates against the baselines (S51's); the Purge's cast rate and what it buys. Report; the planner reads the rows.

## Part 4 — Smalls
- The single match's series and recording: a unit test (the loser chooses; the AI plays; the sideboard round trip; the recording's shape).
- The deployment's size: a note on hosting the art and audio outside the deployment (scoped, not built).
- The matchup grid artifact to fourteen lists.

## Handoff
The two rules with their probes and paired measures; the journey's Purge read; the tools in the repo; deviations, concerns — and the implementer's read on **Pauper** as the next format: what `maxTier: 1` leaves in the pool (count by colour and role), which Open instruments carry over unchanged, and whether the tier-1 shelf has a Limited-score problem the Open's rating didn't (the planner drafts the seeds in S62 against that read).
