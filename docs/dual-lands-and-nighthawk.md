# Dual lands — the two cycles (+ the Nighthawk mod)

*Planner-authored, Chris-directed. Search-verified this round: OLGC set existence and structure (27 cards; duals carry year-coded collector numbers; Scrubland confirmed with two printings — 2018 Mark Poole, 2022 Raoul Vitale), shockland oracle template and type line (Scryfall RTR/RNA). Per-card OLGC numbers and full oracle for all 20 resolve at the implementer's Scryfall fetch (blocker-level as always; the cycle templates below are the expected shape — mismatches flagged, not fixed).*

## Cycle 1 — the ABU duals (×10, R-class)

Tundra (WU) · Volcanic Island (UR) · Underground Sea (UB) · Badlands (BR) · Taiga (RG) · Savannah (GW) · Scrubland (WB) · Tropical Island (GU) · Bayou (BG) · Plateau (RW).

- **Template:** Land — [Type] [Type], "({T}: Add {X} or {Y}.)" No other text. ✔ (verified for Badlands, Underground Sea, Plateau, Scrubland via OLGC pages; remainder to the fetch).
- **`shopTier: R`** (Chris) — never shop stock. These are the R-drawer's second cohort (with Demonic Tutor, Mystic Snake) and a primary customer for the R-acquisition mechanism; natural boss-prize-table entries when those exist.
- **Printing rule (Chris, the first deliberate non-original pick):** the **Legacy Championship (OLGC) printing, earlier of the two where two exist** (e.g. Scrubland 2018 over 2022). Record as explicit `scryfallId` overrides in printings.md with the rule stated — the default-printing resolver won't land on OLGC unaided.
- Sell price: the interim R-sell rule (T3 factor × mv) yields 10g on an mv-0 land — nonsense. **Do not ship a dual sell price**; the R-economy design (banked, planner-side) owns it. Until then duals are unsellable (flag in the collection UI as "priceless" — honest and flavorful).

## Cycle 2 — the Ravnica shocklands (×10, shopTier 2)

Hallowed Fountain (WU) · Steam Vents (UR) · Watery Grave (UB) · Blood Crypt (BR) · Stomping Ground (RG) · Temple Garden (GW) · Godless Shrine (WB) · Breeding Pool (GU) · Overgrown Tomb (BG) · Sacred Foundry (RW).

- **Template:** Land — [Type] [Type], "({T}: Add {X} or {Y}.) As this land enters, you may pay 2 life. If you don't, it enters tapped." ✔ (Hallowed Fountain verified; type line Plains Island etc.).
- **Printing rule (Chris):** the **Ravnica Remastered (RVR) retro-frame variants** (the old-frame run in the #400s — e.g. Temple Garden #414; Hallowed Fountain's retro sits at #404). Explicit `scryfallId` overrides per card, resolved from the RVR listing at fetch; ⚠ per-card numbers to the implementer's verification.
- **`shopTier: 2`** (Chris: buyable in tier-2 and tier-3 towns). **`priceOverride: 45`** — mv-0 breaks the price formula (it would price a shock at 6g); the override column is new, generic, and rides with this batch. 45g sits between the T2 and T3 shelves: a real purchase, not an impulse.
- Stocking: a two-color land stocks in **either** color's region shops at its tier.
- **The Cinquefoil twist, named:** 2 life against world-life 10 is 20% of your total (vs 10% in constructed) — and world life carries between fights. The pay/don't-pay decision is a genuine one here, which is the whole reason the cycle earns its slot.

## Engine items (the honest bill)

1. **ADR-004, second amendment — the payment solver.** The original text: multi-color producers out "until payment enumeration exists"; revisit "if a card makes payment choice strategic." Duals trigger the clause. Required: cast-legality's producer scan and auto-pay's execution both handle either-color producers via **pip-to-producer assignment** — greedy (tap fixed-color producers against matching pips first; duals fill remainder) with a small matching fallback for corner cases (two different duals, two different colored pips — order matters; the instance sizes are tiny, ≤7 producers). The Lotus rule (choice mana never auto-paid) is **narrowed to abilities with side effects or >2-way choices**; plain two-color land taps become auto-payable with the color chosen by the solver. Deliberate `tapForMana` still enumerates both colors. Fixtures: a hand needing {W}{U} with Tundra + Plains auto-pays correctly both ways; the two-duals/two-pips ordering case; a dual's color choice is a logged consequence of the solver, deterministic per state (replay-stable).
2. **Manifest amendment A9 — conditional enters-tapped (the shock clause).** New card-def field `entersChoice: {pay: {life: 2}, else: "tapped"}`: on resolution of the land play, the controller gets a DecisionRequest (pay / don't), the choice is a logged action, life is paid before the permanent's ETB state is fixed, and ETB triggers see the final state. Legality: payable only at life ≥ 2 (CR-honest; paying to exactly 0 is legal and lethal). **Anything put onto the battlefield by other means (modifiers; any future search-to-battlefield beyond basics) enters tapped, no choice** — matches the printed ruling's spirit and keeps initialization request-free. ADR-037 ceremony: this doc is the amendment's proposal text; copy into the manifest's Amendments subsection on ratification.
3. **AI:** pay-2 heuristic — pay when the untapped land enables a cast this step and life > a floor (baseline 4); otherwise enter tapped. **Book of shame 17: never pay 2 at life ≤ 2.** Prediction: the solver's existence means the evaluator's castability checks see duals correctly for free.
4. **Deck editor:** nonbasic lands are ordinary collection cards (4-copy cap, not free/infinite) — the editor's first nonbasic-land customers; validation already generalizes, UI copy shouldn't say "basic lands are free" ambiguously.
5. **No AI decklist changes** — the cycles are player-facing splash enablers today. Note for the boss round: boss decks draw on the full pool and are the natural first AI users of duals.

## Pool arithmetic

105 → **125** (+20 land defs). Ten new `colors`-less land defs per cycle; `subtypes` carry the two basic land types (predicate machinery already reads subtypes — Tendrils' Swamp count will see an Underground Sea, which is correct and delicious).

## The Nighthawk mod (Chris-ruled, this round)

**A Vampire Nighthawk (B,2), revised:** 12 Swamp, **3** Vampire Nighthawk, **4** Child of Night, **3** Typhoid Rats, 2 Indulgent Aristocrat, 2 Blood Artist, **1** Doom Blade, 2 Mind Rot, 1 Tendrils of Corruption. (Was: 4 Nighthawk / 3 Child / 2 Typhoid / 2 Doom Blade.) Intent: dilute the 4× lifelink-deathtouch-flying core to 3× and trade a removal spell for a body — identity intact, nut draws softened. Re-sim at worldLife 8 against the S19 baseline; target is the tier-2 band (~30–45%); report, and the director round rules whether it ships, steps further, or reverts.

## What rides to the implementer (S20 brief material)

ADR-004 second amendment + solver and fixtures; A9 + shock encoding and fixtures; 20 land defs + OLGC/original printings overrides + `priceOverride` column + `art:fetch`; editor nonbasic-land support; shame pin 17 + pay-2 heuristic; Nighthawk mod re-sim; fuzz with dual-bearing test decks (a WU and a BR fixture deck exercising the solver under fuzz before any real deck carries duals — fuzz-before-fixtures applies to the solver especially).
