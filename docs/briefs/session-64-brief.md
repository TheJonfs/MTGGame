# Session 64 brief — white's play, Peasant's triangle, and the first triad

*Planner → Implementer. 2026-10-15. Follows the running handoff.md (after S63). One session and a half: the AI study and the Peasant round first, the triad's seeds after. Process rules unchanged: appends to `docs/decision-updates/s64.md`; re-verify every ⚠ real card by curl; probe before rule; a guide measured row by row; every AI change carries a ladder delta or reverts; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S63's deviations ratified**: the `hexproof` shape with a self-set size; Retribution's guides; the out-rule word unbuilt (the guides name what leaves); the three cards at tier 2 with their word (R-109) and book 128. **A note on Peasant's door**: its tiers are the shop's power tiers, not rarity.
- **ADR-179 — Peasant's triangle.** Dungrove Auras beats the black lists; White Skies beats Dungrove Auras (60); the black lists beat White Skies. Three pillars with the Open's shape, a day old. The second pool round does not give black an approach to the Elder (it would flatten the triangle); it gives white the card advantage it lacks against black. The red-white aggro decks' Elder problem (23–25) is texture; their answer is Retribution from the board.
- **ADR-180 — One card for Peasant, tested first (pool 281 → 282)**: Mentor of the Meek (⚠ M12; {2}{W} 2/2 Human Soldier; whenever another creature with power 2 or less enters under your control, you may pay {1}; if you do, draw a card — a trigger with an optional cost: half a word; tier 2) — a payoff for the small white fliers and the token makers. Wall of Omens is withdrawn (a colour-shifted Wall of Blossoms adds nothing new — Chris). If the Mentor does not move White Skies against the black lists, the next card is decided then; the triangle (ADR-179) means the needle need not move far.
- **ADR-181 — The triads' lands.** A land is legal in a triad if every colour it can produce is in the triad: off-colour duals and basics are out; colourless utility lands are in; a High Ground is in where its pair is. The census re-run under it before any seed.
- **The Elder's matchup is play, not the list** (Chris 8–1 where the pilot is 54): the white play study (Part 1) is the lever, as S63 Concern 2 says.

## Part 1 — The white play study (probe → rules; from Chris's two logs)
From `PeasantWhiteSkies.json` (8–0) and the UW Skies file, the three habits the play diff named, each measured on the white lists paired, then the ladder:
- **Book 129 — removal is matchup-relative.** Swords (and Pacifism, Doom Blade) waits for a creature whose worth is at or above the opponent's *list's* best threat tier: against a list with a 6/6 hexproof trampler, nothing under a Wurm earns a Swords; against the Rabble a Chieftain does. The floor reads the opponent's registered list (as the guides do), not an absolute (book 117's absolute floor failed). Off: `removalmatchup`.
- **Book 130 — a flash creature is protection.** Plumecreed Escort (and the Forerunner, Restoration Angel) is held when our best creature is the opponent's removal's target and we have the mana open; book 115's end-step hold stays. Off: `flashguard`.
- **Book 131 — a pump is spent to win.** Dawnwing Marshal's anthem (and Giant Growth) only to win a combat, to make lethal, or to save a creature from damage on the stack. Off: `pumpwin`.
Measure on White Skies, UW Skies, BW, RW Tokens, the Muster, paired, three columns; the Auras pairing called out (White Skies 54–60 today; Chris 8–1).

## Part 2 — The Mentor into Peasant
Mentor of the Meek into White Skies (for the two Marshals; also tried for two Valkyries), UW Skies (for the Pacifisms) and RW Tokens (for the Soul Wardens); the AI pays the {1} when it has it idle and the draw is worth more than the mana's next use (a small rule, pinned). Each by ADR-168's bar; the Peasant score rebuilt; the table of record re-run (three columns). The read: White Skies against the black lists (45–49 today), and the Mentor's cast and trigger-paid rates.

## Part 3 — Naya, the first triad (`formats/naya/`)
- **The rule**: `colorsWithin: RGW` with ADR-181's land rule; 60 cards, 4-of; the Open's restricted list (the power, the High Grounds of its pairs — the Tollgate's Shevelport is in), the laws banned.
- **The seeds** (the planner's; built to sixty by the implementer from the Open list named, with the additions named, legal under the rule; each a working name):
  1. **The Rabble** — whole (mono-red is Naya-legal).
  2. **The Tollgate** — whole.
  3. **Naya Flash Snakes** — the Open-tier version of Peasant's: the Forerunner, Manaba, Rage Cobra, Baru at the top. **The Reaper is Jund and not legal here** (Chris); **the Fordkeeper** is the triad's lord and the candidate top end — and one thing the triad will teach is whether its stronghold boss is a must-play or a card some decks want (the Fordkeeper tops the Tollgate already; try him in the Snakes and the Lifegain list and report his cast rate and his lists' numbers with and without).
  4. **The Muster** and **the Warband** — whole.
  5. **RW Tokens, promoted** — Peasant's list with Captain of the Watch ×4, Lumen, Emeria Angel, Glorious Anthem.
  6. **GW Auras reborn** — Dungrove Elder ×4, Gladecover Scout, Blurred Mongoose, Rancor, Blanchwood Armor, Angelic Destiny ×4, Ovna, Shevelport.
  7. **Mono-Green Wurms** — the Wurmspeaker whole (Seedborn Muse, Baru, Pelakka, Rampaging Baloths).
  8. **Naya Lifegain** — the old Ford's shape with Vitalist ×4, the Fordkeeper, Soul Warden, Sacred Helix, Lightning Helix? (not in pool) — Char and Bolt.
  9. **Gruul Stompy, promoted** — Peasant's with the Kavu, Baru, the Reaper.
- The table of record (three columns); the seat draw by its match table; the door's chooser gains "Naya — red, green and white; no counterspell in the format" (the census's own line).
- **Plans**: none (no combo). **Guides**: the builder's fifteens; the Open's guides match by cards where a list is whole.

## Part 4 — Text
- Peasant's note gains: *"Tiers are the shop's, not rarity."*
- Naya's door line: *"Naya — red, green and white. No counterspell lives here; the creatures decide it."*
- The format's seed names in the plane's register follow when the seeds settle.

## Handoff
The three books with their paired reads and the ladder; the two cards and Peasant's new table; the census under ADR-181; Naya's seeds, table and door; deviations, concerns — and the implementer's read of the next triad by contrast (the one with the most of what Naya lacks: a counterspell, a sweeper, card draw — WUB by the census).
