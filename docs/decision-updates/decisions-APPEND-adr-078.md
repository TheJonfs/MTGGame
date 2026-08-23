# decisions.md — APPEND (ADR-078)

*Planner-authored append file; home is `docs/decision-updates/`. Add after ADR-077.*

---

**ADR-078 — Inter-session rulings (post-S18): blue starter, shop tiers, bestiary round 2.**

*Blue starter:* **List C adopted** (current −2 Curiosity −1 Divination −2 Counterspell −2 Cathartic Adept +2 Aether Channeler +1 Aven Fisher +2 Essence Scatter +1 Mist Raven +1 Air Elemental — per the S18 audit table). The 68% tier-1 gate is not met (C measured 57% mage-only); adopted as best-measured with an explicit **revisit when the pool expands**. The audit's structural finding is recorded: the Adepts alone cost ~15 points (S16 concern 6 confirmed — the self-mill clock is real), and a control/tempo shell under the journeyman pilot is capped; the gate remains aspirational for blue rather than relaxed.

*Shop tiers (OQ-10 closed):* the `shopTier: 1|2|3|R` schema is **ratified** — availability by `shopTier ≤ ring`; price × `shopTierMultiplier` (1.0/1.5/2.5, knobs, arguing baselines pending an S19 gold-flow world-sim check); **R = never shop stock** (ante/quest/treasure circulation; a dedicated R-acquisition mechanism is planned), distinct from `prizeOnly`. Verdicted: **Demonic Tutor is the sole R for now** (more will join deliberately); **gold cards are R by rule** (Mystic Snake moves); starter membership does **not** force tier 1 (Swords at T2 stands); Mother Bear and Little Bear promoted to T2; Restoration Angel demoted to T2. The full table is `docs/card-tier-audit-v2.md`; the pool registry adopts the column from it.

*Bestiary round 2 (roster gaps):* five entries fill the spoke × tier signature grid — **A Plague of Rats (B1, Typhoid Rats), A Gray Ogre (R1, Gray Ogre), A Savannah Lion (W1, Savannah Lions), A Rumbling Baloth (G2, Rumbling Baloth), The Faerie Formation (U3, Faerie Formation)** — names are planner suggestions pending Chris's kickoff verdicts. Four build entirely from the existing pool; one new card:

- **Faerie Formation** — {4}{U} Creature — Faerie 5/4, Flying; "{3}{U}: Create a 1/1 blue Faerie creature token with flying. Draw a card." Planner search-verified (Scryfall ELD #316); **⚠ activation cost carries a specific re-verification flag** (a Gatherer rendering shows bare {3}; Scryfall shows {3}{U} — implementer's check settles it, flag-don't-fix). Zero new vocabulary; one new token def (`faerie_1_1_u`, colors required per ADR-019). Pool 104→105; shopTier 3, 60g.
- **Chosen over the planner's Mahamoti Djinn draft** (Chris's suggestion, planner concurs): the Djinn slot risked world-simming under tier for *pilot* reasons — counter-wall blue is the AI's historic weakness (ADR-010) — while Formation is a proactive engine the existing evaluator already prices (tokens + draws) and the master profile's mana-sink behavior exploits (Drana's proven shape). The reasoning is recorded so a future "why not the classical pick?" has its answer: principle 3 prefers classical *where taste allows*, and a card the AI can actually pilot is the taste that matters.
- The grid's completion makes `beastTierFallback` a no-op for signature rolls; **OQ-4 resolves as `mage` default retained** (now costless) pending Chris's formal nod at kickoff.

*Sequencing discipline (S18 concern 0, ratified):* the pin-16 attack-search change invalidated the S18 world-sim tables as a tuning baseline. **S19 opens with the full 1,000/cell gate re-run and a fresh world-sim baseline before any of this round's content lands**; the Nighthawk/Warband deck adjustments happen only against post-fix tables, in-session via the director round. No deck surgery shipped from S18 numbers.

*Art direction (S18 concern 5):* **fog is canonically "paler paper"** — the `--fog` tone as shipped is blessed; unexplored ground is an absence, not a texture. Whether the W civilized wash warms slightly (so parchment ≠ wash) is Chris's eye in play; art-direction.md gains the fog rule either way.

*Pending Chris at S19 kickoff (the verdict list):* the five display names; buyable flags (incl. the Formation's trinkets-not-coin framing); the ⚑ floor promotions (Boggart Brute and Rumbling Baloth to T2 — planner recommends yes); W1 Tactician retire-or-keep beside the Lion (planner leans keep, as a second civilized-ring face); lair-host reassignment U → Formation (mechanical consequence of the top-signature rule); OQ-4 formal nod.

*Banked design threads (planner-side):* lesser vs. greater lairs (OQ-3 rider); the R-acquisition mechanism; future R-drawer additions; **the boss authoring round — scheduled alongside S19, Chris + planner co-authoring the five stronghold residents so S19+ quest and rumor text can name them.** Implementer does not touch strongholds in S19.
