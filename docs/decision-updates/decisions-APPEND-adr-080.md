# decisions.md — APPEND (ADR-080)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-079.*

---

**ADR-080 — S20 close and playtest rounds: ratifications, the handoff process guard, and standing recommendations.**

*S20 close (ratified in absentia — see process note):* the solver (ADR-004 second amendment, R-058), A9, and A8 are landed and gated; pool at the S20 close per registry; the dungeon system with `world-save-v5` and mid-run resume; five Mox dungeons and the lair-dungeon class; the Nighthawk mod applied and measured (17%). The close's narrative handoff was **overwritten by the follow-on playtest handoff** (see process note); its rulings stand as evidenced by repo state.

*Process note — the handoff numbering guard:* handoff documents are **session-numbered files** from now on (`handoff-s20.md`, `handoff-s20b.md`, …); a mutable `handoff.md` may exist only as a copy of the latest. A single overwritable handoff is the silent-overwrite risk class principle 11 guards against, applied to narrative instead of code. **S21 Part 0 carries a reconstruction task:** regenerate a retrospective S20 close summary from repo ground truth — pool-registry S20 rows (resolving the **147-vs-expected-140 count**), rules-registry additions, the save-v5 field list, and kill tables re-emitted under the 30/60/90 labels.

*Playtest-round rulings (Chris, live; ratified):*
- **Dungeon grid 24×18** with content scaling off the grid-derived factor (`s = sqrt(area/108)`; mox 4–8 caches / 3–5 minions, lairs 2–4 / 2–3) — measured before ruled (12×9 full-loot averaged 22 steps against a 60-step tier: a decorative meter). The design doc's 12×9 and "1–2 lair minions" lines are superseded (amendments issued alongside this ADR).
- **Empowerment thresholds 30/60/90** (easy 60/90; hard 30/60/90 at double life); difficulty bundles shifted in step; the S20 kill tables still describe tier *contents* (the relabel is arrival step-counts). **The squeeze is deliberately untested by a human at the new numbers — Chris's re-dive is the verdict; the knob is the lever.**
- **Solver preference: duals before creatures** in both colored matching and the generic pass (the Elves-vs-Breeding-Pool case) — a preference ordering inside R-058, not a rules change; replays unaffected; regression fixtured.
- **Renown is per-colour** (`world-save-v6`); old saves' totals zero rather than falsely split (flagged, accepted). **Multicolour semantics ratified:** defeat credits every colour of the template; fear reads the max over the roamer's colours — currently hypothetical (no multicolour roamer exists), blessed now so future content inherits it.
- **OQ-14 (renown ordering) and OQ-16 (the law rides every interior duel) ruled as listed**; OQ-15's reference set annotated.
- **Art registers ratified into art-direction** (amendments issued alongside): the dungeon interior's **dark-stone register** and the overworld's **campaign-map register** (per-colour pictorial terrain, torn fog edge, compass rose). Guardian battle portraits live; **the external-render provenance precedent** is blessed (Chris's own Drana render adopted as canonical with provenance in MANIFEST — and the isolation method is recorded: image-filter refusals are content-phrase-shaped, and descriptor rewriting is now a director-level debugging tool). The two bug fixes (fog leak; v1/v2 migration early-return) ratified as correctness.

*Worldgen wants (from the concept round):* **rivers bank** as a future map-model layer (`river` alongside `road`); **town footprints ride S21** — sieges are when towns must feel like places worth defending, so the multi-building vignettes arrive with the system that threatens them.

*Standing recommendation for Chris's ruling — the Nighthawk at 17%:* two levers pulled (worldLife 8; the core-dilution mod) for +6 total; still two tiers hot; further surgery dismantles identity to chase a band. **Recommend: accept and price it** — the Nighthawk becomes the world's deliberate famous killer: parley voice drips warning, and its per-opponent reward knobs (gold, ante) bump to pay what it actually risks. Converts the outlier into content; every Shandalar-like needs the enemy players trade stories about.

*Pending Chris (the verdict pile):* the Nighthawk ruling above; the empowerment re-dive verdict; art candidates (Elemental token plate; Reya/Arcanis/Drakuseth/Titania portraits — Drana already kept); the pre-v6 renown seeding alternative (one-liner if wanted).
