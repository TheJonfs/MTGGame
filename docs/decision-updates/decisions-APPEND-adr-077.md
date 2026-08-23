# decisions.md — APPEND (ADR-077)

*Planner-authored append file per the standing rule: decisions.md updates ship as APPEND only. Add the following entry after ADR-076.*

---

**ADR-077 — S17 rulings (Expansion 1 encoded).**

*Ratifications of kickoff defaults and deviations:*

- **Scryfall-true encoding** for the nine ⚠ rows that differed from the planner draft (Mother Bear {3}{G}{G} sorcery-only graveyard ability; Mist Raven {2}{U}{U}; Waterfront Bouncer {1}{U}; Aven Fisher {3}{U}; Scepter of Dominance {1}{W}{W}; Youthful Valkyrie 1/3; Restoration Angel as printed — optional trigger, one required target; Indulgent Aristocrat "sacrifice a creature," Vampire Noble; Blood Artist {1}{B}; Bitterblossom Kindred Enchantment — Faerie, encoded Enchantment + subtype). Flagged-not-fixed protocol worked as designed; principle 9 scoreboard now stands at 9 catches in one batch.
- **"Up to" targeting (A8) is shelved without a customer.** Restoration Angel as printed needs an optional trigger with a required target, not "up to one." Amendment 8's ratified text stands for a future customer; no code exists and none is owed until one enters.
- **`GameView` gains `graveyardObjects` and `manaPool` as public fields** (AI needs for graveyard-zone activations and the mana-burst rule). Both are public-information zones; the no-peeking pin is updated and remains the redaction authority.
- **`untapTarget` resolver** (vocabulary since S1, first customer Little Bear) — and the new **loader assertion that every non-static vocabulary word has a resolver** is blessed as a permanent guard. A vocabulary word without a resolver is now a structural impossibility, not a latent surprise.
- **A4 amended: `maxPower{predicate}` is a third value-ref kind** alongside `count` and `graveyardCount`. The implementer's read was correct — Baru's cost-reduction input is a max over a predicate set, not a count, and bending `count` to carry it would have been the worse shape. Amendment 4's text in the mechanics manifest gains the third kind; copy this clause there.
- **Restoration Angel printing override to AVR** (Johannes Voss original; the default resolved to the PAVR prerelease promo). Rager precedent; recorded in printings.md.
- **Pool arithmetic corrected: 72→104** (+5 tokens = 109 loader entries). The expansion doc's "74→106" double-counted the ADR-074 anchors; the doc header is corrected to match.
- **AI hygiene pins 12–14 ratified** (mana bursts only when enabling a cast this step; cycling only when the spell has no board use; Channeler mode preference). No evaluator work occurred; ADR-062's parked workstream is untouched.
- **`pnpm fuzz:expansion` joins the standing suite tiers** (beast decks × slice decks + mirrors) as the expansion-coverage analog of the ADR-034/055 structure.

*Director rulings (Chris):*

- **Beast decks are 30 cards.** ADR-074's "40 cards" is amended to 30 — the drafted lists, the S17 fuzz coverage, and the checked-in sim decks are all 30, matching the starter scale and the 30-card deck floor. The 40 was contamination from the slice-deck scale.
- **No pre-tuning for the cost shifts.** The nine corrections shift the beast curves (Mother Bear's ability is a five-mana play; Raven is a double-blue four-drop; Bouncer, Blood Artist, Scepter each cost one more). Decklists stand as encoded; S18's world-sim tables are the instrument, per the world-sim-before-knob-arguments rule. The shifts are recorded here so skewed tier results get read as *possibly cost-driven* rather than mysterious.
- **Boss authoring round deferred toward S19 prep** — deliberately scheduled, not drifting; the stronghold residents should exist before quest/rumor text wants to reference them.

*Post-close director round (recorded):* **Gaean Wurm art is candidate 1** (classical oil, rearing mossy wurm in golden canopy light), cropped and wired per ADR-052 ceremony, kept/rejected logged in MANIFEST. The five Expansion 1 tokens rendered in house style, wired, MANIFEST-logged. The S18 brief's Gaean Wurm candidates item is struck. Render-skill note banked: default aspect is now 16:9; pass `--aspect 1:1` for token/card-class subjects.

*Banked watch items (not rulings):*

- **Skirk Prospector gating** (S17 concern 3): the S15 no-auto-pay rule plus burst pin 12 means the Warband AI only sacs a Goblin for mana when it enables a cast this step. Intended behavior; if S18 world-sim shows the Warband under-tier, this is the first suspect.
- **Blood Artist trigger chattiness** (concern 2): five simultaneous triggers issue five target requests in the play client. Correct, potentially tedious; a batching polish item if Chris feels it in play.
- **Cycling's DISCARD fires Waste Not** (concern 6): correct per the CR's cycling rules — the discard is a cost of an activated ability (⚠ section number unverified; implementer to cite on entry); recorded so S18 deck tuning doesn't misread it.
- **Generic-dialog fallback for `chooseMode` / `discardCost` / A7 sacrifice** (concern 5): promoted to an S18 rider — Chris's first Channeler/Bouncer/Grenade plays get looked at in the director round.
