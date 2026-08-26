# decisions.md — APPEND (ADR-082)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-081.*

---

**ADR-082 — Wild towns; custom-printed card art; the audio program.**

*Wild towns (Chris-ratified):* the generator guarantees wild-ring towns (proposed ≥2 per world; 0–1 per wild region per the ADR-072 roll, now with a world-level floor). Cashes the dormant `siegeIntervalSteps.wild` knob, the danger gradient's deepest rung, and the standing texture rumor. Rides S23's wilds-polish session with rivers and footprint variety.

*Custom-printed card art (Chris-directed; S22a):* the nine custom cards (Cunning Tactician, Gaean Wurm, the five lords, Aetherbolt, Tainted Phoenix) gain **printed-view images** — Chris-produced PNGs via an external card creator, delivered as a folder at the S22a kickoff. **ADR-066 is amended:** custom cards no longer fall back to our frame on printed-default surfaces; they show their `printedAsset` (a new CardDef field for `source: custom`), the parallel of real cards' Scryfall `normal`. Assets commit (they are ours); MANIFEST rows carry the external-provenance form blessed in the Drana precedent. The one-global-toggle rule is unchanged — custom cards simply now have something on both sides of it.

*The audio program (scheduled S23+):* Chris holds the complete Shandalar soundscape (FLAC). Two workstreams when it lands: (1) **scaffolding** (implementer) — an audio manager with per-context music (menu / overworld / town / dungeon / duel) and event stingers, a **prominent audio toggle on the front page**, preference persisted; note the browser reality that sound begins only after first user interaction regardless of default. (2) **The mapping** (Chris + planner authoring) — a track-to-context mapping document in the text-pack pattern: planner-format delivery, implementer wires, iterated in director rounds. Neither rides before S23.

*Carried, still pending Chris's nod:* the ADR-081 deadline-pause-under-occupation rule.
