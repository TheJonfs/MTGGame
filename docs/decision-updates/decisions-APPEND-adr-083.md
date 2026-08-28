# decisions.md — APPEND (ADR-083)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-082.*

---

**ADR-083 — S22 and playtest rounds 1–4: the ratification pile.**

*Ratified as shipped:*
- **A lord's fall credits renown 3 in his colour** (the lair-boss precedent, correctly applied). **Gold opponents bleed both their lords at full tier** (r1) — deliberate, mirroring renown's own attribution.
- **Identical pending triggers auto-order without a request** (same card + ability; R-067) — ADR-014's spirit at trigger scale, outcome-equivalent; also the sanctioned shape of the Blood Artist chattiness fix.
- **The entrance's all-lands edge returns a random land** (R-078) — the spec's gap, closed sensibly.
- **Stronghold floors and the r1 seat rebuild** (36×26, twin mirrored routes, 3×3 chambers, 6–7 minions, `strongholdEmpowermentTiers` 50/75/100), pending only the storm's feel verdict. Lord archetype assignments (Unwinder/Stoker control; Usher/Warden/Sower midrange) stand.
- **Interior ante applies in lord fights** — ante-everywhere is manifest law; the `anteCount` taste question stays in Chris's pile.
- **The r3 package**: bounty purses price the mark's tier via the standard roll (a hunt premium above it stays available as one multiplier, unadded); siege grace 300/500/200 as arguing baselines; **news-everywhere + rail-everywhere** over visited-towns-only (the living-world reading); **the misaim cliff's forbidden exotic saves accepted** (self-Boomerang rescues, self-Aether-Mutation) with the carve-in path documented in R-080 for any future deck that wants the line.
- **The r4 package**: bounty twins pay anywhere (the head is the head; region-locking remains one predicate if ever wanted); `cardCourierGoldFactor` 2× as arguing baseline; turn-register colours as tuned. **The manalink pointer line is reworded** (planner text, replacing the placeholder): *"There's work in {town} that pays in something better than coin. That kind of work doesn't wait."*
- **ADR-082 amended: `printedAsset` ships JPGs** (Chris-approved live).
- Wild towns arrived early (r2, Chris's instruction) — the five planner-named wild towns placed at mapScale 2.5; ADR-082's S23 item is partially cashed; **S23's wilds-polish scope shrinks to rivers, footprint variety, and the interior smoothing pass**.

*Known-deviations entry (the ADR-003 ledger grows):* **Experimental Overload's "may return" is encoded as an A8 up-to-one target chosen at cast** (R-074); CR-accurately it is resolution-time selection with no target. Observable delta: the pick is public earlier and can fizzle. Accepted as a documented approximation; revisit only if a card class demands resolution-time zone selection (the Amendment-1 request pattern is the shape it would take).

*Recommendations recorded (Chris's word overrules):*
- **Lightning Bolt and Goblin Grenade stay shopTier 2.** The felt absence is the deliberate upgrade arc (Shock→Bolt, Terror→Doom Blade, Scatter→Counterspell): civilized shelves sell the honest version, approach shelves sell the upgrade. Named here so the arc is flattened knowingly if Chris's feel says re-tier.
- **The Tithe joins the Toll and the Season on the watch-flag list** — 87% at floor/tier-0 is the cycle's hottest floor, but the reference set is all creature decks and the Tithe is a creature tax; "the fight that teaches you to bring spells" may be correct for one lord of five. The storm and the tables' director round rule it; levers are scoping (nontoken / intruder-nontoken), never the lord.
- **Audio lives outside the public repo**: a gitignored `assets/audio/` mount the scaffolding reads if present and stays silent without — keeps a Vercel deploy lean, and keeps Chris's personal collection personal rather than redistributed. `assets/temp/`'s ignore stands and generalizes.

*Banked design threads:*
- **Travel powerups** (r4, Chris's flag): faster stride and/or falling-cost teleportation as unlockable progression — the player-power fantasy and the cascading-siege management tool in one; design questions are the unlock path (item, renown perk, or stronghold spoil), pricing, and whether stride and teleport are one track or two. Joins the hard-mode comeback-levers question (r2 item 11) as one design conversation — **scheduled beside the final-gauntlet round**, since both are endgame-pacing tools.
- The empowerment TIERS three-place sync folds onto the knob at the next schedule-touching session (the third copy exists; the S20 trigger has fired).
- The Stoker deck-out probe and the time-to-liberation number remain sanctioned on demand.

*Carried to Chris (the standing pile):* the storm (with the empowerment-at-stronghold-scale verdict); the tables' director round — the ? = 3 formal nod (tables say keep), the Toll/Season/Tithe flags, the Usher's launder deck question (a second Restoration Angel? Zombify count?), lord-deck iteration generally; `anteCount`; the S21 leftovers (Nighthawk + Blood Artist chattiness, a tavern whisper heard live).
