# decisions.md — APPEND (ADR-084)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-083.*

---

**ADR-084 — The fun batch; the five-powers direction; the audio plan; small confirmations.**

*The fun batch (Chris-designed, planner-audited; `docs/fun-batch-s23.md` is the spec):* **Thundersnake** ({R}{R} 4/1 Elemental Snake — the Ball Lightning family rescaled to the 10-life world; the design record preserves the 8/1→4/1 halving argument), **Gallows Djinn** ({2}{B}{B} 5/5 Djinn — the Juzam homage with the upkeep tax redesigned as an aggression tax; named per the original-names rule, typed Djinn to preserve the Stoker's efreet uniqueness), **Traumatizer** ({2}{U}{U} 2/4 Nightmare flier — mill's first player identity). Bills: two tiny pieces (a surfaced self-`sacrifice` effect word; value-ref member six `{ref: eventDamage, times: N}` with **ADR-028's no-arithmetic doctrine explicitly reaffirmed** — a bounded literal multiplier is a param, not a calculator). All three tier 2; ADR-052/053 ceremony; printed JPGs follow Chris's pipeline at leisure. Rides S23. *Future breadcrumb recorded: Unearth as a later real add (bill essentially paid).*

*The travel powers — direction set, design deferred:* the cycle is **five powers, one per color** (the fives' symmetry — and Shandalar's own precedent: its five colored active world magics). Two seats are claimed (the Stride; the Crossing); three await original designs. Acquisition **probably stronghold-clear, possibly Moxen-style special lairs** — Chris noodling; the design round follows S23. Nothing ships before it.

*The audio plan (formalized from Chris's three steps):* (1) **S23 scaffolding, cue-first** — game code speaks named cues, never file paths; a cue→file mapping and a gitignored local `assets/audio/` mount; the prominent front-page toggle, persisted; silent-if-unmounted is the deploy's natural state. (2) **The mapping** — Chris + planner authoring against the Shandalar library, locally (a later round, text-pack pattern). (3) **The deploy library** — a repo-safe file set repointed under the same cues, down the road. The cue indirection built in step 1 is what makes step 3 a data change.

*Confirmations:* **Lightning Bolt and Goblin Grenade stay tier 2** (Chris — the wild-ring red town adds a third shelf that can stock them; the upgrade arc stands). **Storm verdicts parallelize**: S23 kicks off on the slate below while Chris runs a standard/easy sprint for the stronghold feel-checks; lord-deck iteration and the watch-flag rulings follow in that round, not this session.
