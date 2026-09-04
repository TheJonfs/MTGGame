# decisions.md — APPEND (ADR-094)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-093.*

---

**ADR-094 — Cinquefoil v1: shipped. S27 ratifications and the afterlife ledger.**

*The milestone:* **the run is finishable and v1 is deployed** (Vercel; Chris: "version 1 is a go"). The Manafleur is the pool's 185th and last card; the Heart fight, the chronicle's first phase, and the profile store are live; Chris cut the flower from all five roads in one playtest round and the all-five ending landed.

*Ratified as shipped:* the Manafleur's riders exactly as billed (`law: true` + the `laws` scope + scoped exile; `createLaw` as manifest-from-def — **"a copy of the next law" trimmed to "create the next law" on def and face alike**, no rules difference; the game-level `lawSequence` with `random`/`accumulate` as dormant data hooks); **the five laws are `Artifact Enchantment — Law`** (subtype beside flag); the Heart's spec (`heartLife` 35/30/40 as a knob with overrides; zero ante; a loss leaves you at the heart's town); the ceremony, the sole drop, the ordinal chronicle entry, the fifth-cutting line; **the profile store** (`Legacy` v1 outside the save; carryover applies **every** cut colour at new-game, per the doc's stacking clause; +50 gold per cutting; carried cards never duplicate — **the withheld minister pays the purse twice**, a number the doc owed; one knob if it wants its own); the Chronicle page on the journey's start screen, gated until a first cutting (its header names the ending); the dev menu's fell-the-petals and legacy toggles, dev-gated in deploy; **the gallery's progressive reveal** (prizeOnly cards hidden until encountered — the bosses, the Moxen, the Lotus, the laws — the memory per-browser); the Corolla at 33 with the logo's hues, paper between the lobes, and stems to the heart; the `.tsx` typecheck fold; **the AI pins 29–32** (deterrence scaled by race risk for safe attackers — the 7/7 that never attacked; tap-cost discipline; the Witch's budgeted faucet; legend copies held as insurance) with the ladder gate held; **Experimental Overload out of the Manafleur's sixty, Faerie Formation in** (Chris — the "every gold" conceit bends by one); "start from scratch" beside the new road; the deploy configuration (committed Scryfall art; the audio mount in-repo under private repo and private deploy per Chris's ruling — **the handoff's "silent by construction" sentence is stale against this and should be reconciled**).

*The findings that seed the afterlife:*
- **The jam, not the body** (heart-sim): kill rate 51/63/56% at 30/35/40 while the Manafleur reaches the battlefield in only 80/74/66% of games — a third of hard-mode fights never bloom. The Arzakon texture measured. **The planner's first afterlife pass: the flex-slot conversation with this table** — how much mess is the right mess (more duals? a second Mox line? Formation's arrival already smooths one seam).
- **The master never plans around its own petals** (concern 3) — holds no creatures for the Intake, attacks into no Tithe on purpose; the ladder held without an AI touch, but if the Heart reads passive, this is the next AI seam.
- The rotating cadence's *feel* is Chris's continuing verdict (the first two petals punish creature decks hardest by ring order).

*The afterlife ledger (unscheduled; the game is complete without any of it):*
1. The Manafleur flex-slot pass (the jam table); `heartLife` on Chris's read.
2. The Manafleur-aware master (if passive); the Jet Witch's budget on Chris's thoughts (concern 9).
3. Director-round smalls: the withheld purse figure; **a profile export** beside the save download (the chronicle lives only in browser storage); the black petal's hue (toward the sampled #2d221e if it should read blacker); `newRoadLine()`'s static name table.
4. The storm round's lord-deck iteration and the watch-flags (Toll/Season/Tithe); the court-deck spread; the Corolla decks against the petal-sim tables.
5. The overworld ambience slice (wind bed, terrain footsteps); the pending stingers (`lord-fell`, `power-learned`); the menu music TBD; the Heart's cues.
6. **Phase two** — the inversion (lords to WUB/WUR/WRG/UBG/BRG, petals to the flowing pairs, the Manafleur strengthened) — the data hooks exist; the content does not.
7. The ascension modes beyond hooks: `random`, `accumulate`, the Root; the Wild Bloom (Momir); the chronicle's truth — the disposition Chris still owes the flower, written into the ledger one cutting at a time.
8. Meta-progression beyond phase one; the R-economy design; Unearth; the Jund card Chris shelved with love.

*Recorded for the record:* twenty-seven sessions and six days from "two coupled engines" to a deployed game. The skeleton-first doctrine, fuzz-before-fixtures, the ladder gates, the append-only ledger, and Chris's authoring carried it. The name of the flower appears once, on its card, as ruled.
