# decisions.md — APPEND (ADR-086)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-085.*

---

**ADR-086 — The recovery package (the §2a debt paid).**

*Diagnosis recorded:* world life as implemented was a one-way ratchet — §2a (v0.2) specified up-channels ("amulet-class rewards, quest payoffs, or services") and none ever shipped; the snowball was a missing half, not a tuning error. Chris's play evidence localizes the run-killer to the life track (ante/collection losses recover through shops and spoils, with the accidental virtue of forcing build variety).

*Life manalinks (Chris-directed; S24):* the manalink reward class gains a second kind — **+1 maximum world life**, permanent and town-tied like its basic-in-play sibling; Shandalar's bog-standard life amulets arriving through the vessel §2a was unknowingly describing. No new currency (amulets stay unminted unless the five powers ever want a consumable). Knobs: a kind-split weight (life vs basic), a separate **`lifeManalinkCap`** (baseline 2–3), and **`manalinkRewardChance` raised** (0.30 → ~0.40 baseline) so the class shows up; world-sim reports the flow. **Consequence ratified as a feature, flagged for Chris's confirm:** town-tied means **suspension under occupation drops the maximum** (current life clamps) — your capacity is anchored to places, and sieges gain a new terror; exempting life-links is one flag if play says too harsh.

*The inn (Chris-ratified in shape; planner-settled in form):* towns' long-promised service arrives — **rest trades steps for life, priced per point** (`innStepsPerLife`, baseline **5 / 8 / 12** by difficulty). Per-point over flat-full-heal on the perverse-incentive argument: a flat price teaches players to *delay* recovery to maximize its value, deepening the exact spiral the mechanism exists to stop; per-point makes every life a granular purchase. UI: quick options (rest a little / rest well / recover fully) with live step prices. **The rest is a transaction that bulk-advances the world clock** — lords grow, sieges tick, deadlines run, and events landing mid-rest queue their news for waking. Restoration caps at current maximum (10 + active life manalinks).

*Meta-progression (deferred with intent, direction recorded):* Cinquefoil's identity remains the single long journey until the gauntlet is beatable — no meta design before a run can succeed. The long-term direction is affirmed: a post-gauntlet roguelike layer (ascension-style difficulty laddering; some benefit carried home even from failed runs), with the planner's shape-spectrum on file (chronicle → legacy currency → heirloom; start at the chronicle end). The overworld manifest's "meta-progression (far)" ceiling entry now has Chris's intent attached.

*Sequencing:* both S24 items are knob-forward by design — tuning belongs downstream, via world-sim tables and Chris's runs. The audio mapping round proceeds alongside; the S24 brief is cut when its contents (recovery + whatever the mapping round produces) are settled.
