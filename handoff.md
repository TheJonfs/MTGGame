# Handoff — after Session 33 (2026-09-08)

## State of the world

**Cinquefoil v1 is live on Vercel; the deploy playtest continues.** Session 33 — **the tiers against the road** — measured and moved nothing: no knob, no list, no catalog row. The matrix (sweep part 8: every tier-3 mage at life {12, 16, 20} × entrance {0, 1, 2 basics}, every tier-2 mage at {10, 12, 14} × {0, 1}, against both mid-road references) and the beast table (part 9: the tier-2/3 beasts at catalog life, +4, +8) are below with their aggregates; part 4's blue re-read is below; Part 6's scoping of the matchup resolver is below. The mage entrance rides the Heart's roots path unchanged and is fixtured at one and two basics with a byte-exact replay. `--tier-life` parameterises the sweep's tier life for parts 1–7. Pool 194 (unchanged).

## Done this session

- **Part 0**: `docs/decision-updates/s33.md` — the ratifications (S32 deviation 1 as an erratum to S28), ADR-112/113/114/115, the filing note.
- **Part 1**: both levers are already vocabulary — tier life is the sweep's `TIER_LIFE` (now `--tier-life 8,10,12`) and the catalog's `worldLife`; the entrance is `permanentOnBattlefield` (the Heart's roots path). `s33-entrance.test.ts`: one and two basics enter untapped under the mage before turn one (after the mulligans, ADR-002), fire no landfall, and the replay is byte-exact.
- **Part 2**: sweep part 8 — the matrix. The mage's entrance basics are its own colours ranked by the list's pip count (one basic = the primary colour; two = one of each for a two-colour mage; a mono mage repeats its one). Per cell: the reference's win rate, mean turns, wins by library; per tier: the aggregate table (mean over the five mages × two references) and a per-mage table. 150 pairings, 15,000 games.
- **Part 3**: sweep part 9 — the ten tier-2/3 beasts (the Tactician at tier 2) at catalog life, +4 and +8, no roots; 60 pairings, 6,000 games; the aggregate by delta.
- **Part 4**: Brainstorm's per-copy rate and its windows for the five blue decks (200 games each against their tier mates, a scratch script reading the ACTION log's step against the turn's active player) beside the S31 rates.
- **Part 6**: the scoping below.

## Deviations from the brief

None. Nothing moved; the two findings below (Concerns 4–5) are reported, not changed — this being a measuring session.

## Concerns

1. **The matrix (100 games per cell, both seats; the mage at its tier's profile; the references at 12 life with a basic in play, journeyman; the read is the REFERENCE's win rate):**

## 8a. The matrix — tier 3 mages at life {12, 16, 20} × entrance {0, 1, 2 basics} vs the mid-road references (the mage at master; the references at 12 / journeyman with a basic in play)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T3×road | Lord Corvane (corvane) @12/0 | road-mid-W | 10% | 90% | 0 | 11.3 | — |
| T3×road | Lord Corvane (corvane) @12/0 | road-mid-B | 12% (8% by library) | 88% | 0 | 16.6 | — |
| T3×road | Lord Corvane (corvane) @12/1 | road-mid-W | 15% | 85% | 0 | 11.8 | — |
| T3×road | Lord Corvane (corvane) @12/1 | road-mid-B | 26% | 74% | 0 | 17.9 | — |
| T3×road | Lord Corvane (corvane) @12/2 | road-mid-W | 30% | 70% | 0 | 12.9 | — |
| T3×road | Lord Corvane (corvane) @12/2 | road-mid-B | 26% | 74% (1% by library) | 0 | 18.2 | — |
| T3×road | Lord Corvane (corvane) @16/0 | road-mid-W | 11% | 89% | 0 | 12.7 | — |
| T3×road | Lord Corvane (corvane) @16/0 | road-mid-B | 14% (7% by library) | 86% | 0 | 19.7 | — |
| T3×road | Lord Corvane (corvane) @16/1 | road-mid-W | 23% | 77% | 0 | 13.2 | — |
| T3×road | Lord Corvane (corvane) @16/1 | road-mid-B | 32% (3% by library) | 68% | 0 | 21.2 | — |
| T3×road | Lord Corvane (corvane) @16/2 | road-mid-W | 39% | 61% | 0 | 14.0 | — |
| T3×road | Lord Corvane (corvane) @16/2 | road-mid-B | 36% (3% by library) | 64% (2% by library) | 0 | 21.5 | — |
| T3×road | Lord Corvane (corvane) @20/0 | road-mid-W | 13% | 87% | 0 | 13.9 | — |
| T3×road | Lord Corvane (corvane) @20/0 | road-mid-B | 21% (5% by library) | 79% | 0 | 22.4 | — |
| T3×road | Lord Corvane (corvane) @20/1 | road-mid-W | 27% | 73% | 0 | 14.1 | — |
| T3×road | Lord Corvane (corvane) @20/1 | road-mid-B | 37% (8% by library) | 63% | 0 | 23.3 | — |
| T3×road | Lord Corvane (corvane) @20/2 | road-mid-W | 43% | 57% | 0 | 14.8 | — |
| T3×road | Lord Corvane (corvane) @20/2 | road-mid-B | 39% (3% by library) | 61% (2% by library) | 0 | 22.8 | — |
| T3×road | Varro Flamebrand (varro) @12/0 | road-mid-W | 18% (39% by library) | 82% | 0 | 13.4 | — |
| T3×road | Varro Flamebrand (varro) @12/0 | road-mid-B | 14% (50% by library) | 86% | 0 | 15.8 | — |
| T3×road | Varro Flamebrand (varro) @12/1 | road-mid-W | 24% (33% by library) | 76% | 0 | 15.3 | — |
| T3×road | Varro Flamebrand (varro) @12/1 | road-mid-B | 26% (19% by library) | 74% | 0 | 16.9 | — |
| T3×road | Varro Flamebrand (varro) @12/2 | road-mid-W | 36% (19% by library) | 64% | 0 | 14.8 | — |
| T3×road | Varro Flamebrand (varro) @12/2 | road-mid-B | 29% (24% by library) | 71% | 0 | 16.5 | — |
| T3×road | Varro Flamebrand (varro) @16/0 | road-mid-W | 22% (45% by library) | 78% | 0 | 15.4 | — |
| T3×road | Varro Flamebrand (varro) @16/0 | road-mid-B | 19% (53% by library) | 81% | 0 | 18.4 | — |
| T3×road | Varro Flamebrand (varro) @16/1 | road-mid-W | 27% (33% by library) | 73% | 0 | 17.0 | — |
| T3×road | Varro Flamebrand (varro) @16/1 | road-mid-B | 31% (29% by library) | 69% | 0 | 18.5 | — |
| T3×road | Varro Flamebrand (varro) @16/2 | road-mid-W | 42% (21% by library) | 58% | 0 | 15.8 | — |
| T3×road | Varro Flamebrand (varro) @16/2 | road-mid-B | 36% (33% by library) | 64% | 0 | 18.0 | — |
| T3×road | Varro Flamebrand (varro) @20/0 | road-mid-W | 28% (39% by library) | 72% | 0 | 17.1 | — |
| T3×road | Varro Flamebrand (varro) @20/0 | road-mid-B | 24% (50% by library) | 76% | 0 | 20.6 | — |
| T3×road | Varro Flamebrand (varro) @20/1 | road-mid-W | 35% (31% by library) | 65% | 0 | 18.0 | — |
| T3×road | Varro Flamebrand (varro) @20/1 | road-mid-B | 33% (33% by library) | 67% | 0 | 19.9 | — |
| T3×road | Varro Flamebrand (varro) @20/2 | road-mid-W | 45% (27% by library) | 55% | 0 | 16.4 | — |
| T3×road | Varro Flamebrand (varro) @20/2 | road-mid-B | 44% (43% by library) | 56% | 0 | 19.7 | — |
| T3×road | High Warden Sorrel (sorrel) @12/0 | road-mid-W | 12% | 88% | 0 | 13.3 | — |
| T3×road | High Warden Sorrel (sorrel) @12/0 | road-mid-B | 14% | 86% | 0 | 16.8 | — |
| T3×road | High Warden Sorrel (sorrel) @12/1 | road-mid-W | 19% | 81% | 0 | 15.2 | — |
| T3×road | High Warden Sorrel (sorrel) @12/1 | road-mid-B | 33% | 67% | 0 | 17.5 | — |
| T3×road | High Warden Sorrel (sorrel) @12/2 | road-mid-W | 30% | 70% | 0 | 14.9 | — |
| T3×road | High Warden Sorrel (sorrel) @12/2 | road-mid-B | 37% | 63% | 0 | 16.6 | — |
| T3×road | High Warden Sorrel (sorrel) @16/0 | road-mid-W | 13% | 87% | 0 | 15.4 | — |
| T3×road | High Warden Sorrel (sorrel) @16/0 | road-mid-B | 21% | 79% | 0 | 20.5 | — |
| T3×road | High Warden Sorrel (sorrel) @16/1 | road-mid-W | 25% | 75% | 0 | 16.6 | — |
| T3×road | High Warden Sorrel (sorrel) @16/1 | road-mid-B | 39% | 61% | 0 | 18.8 | — |
| T3×road | High Warden Sorrel (sorrel) @16/2 | road-mid-W | 34% | 66% | 0 | 16.1 | — |
| T3×road | High Warden Sorrel (sorrel) @16/2 | road-mid-B | 41% | 59% | 0 | 18.2 | — |
| T3×road | High Warden Sorrel (sorrel) @20/0 | road-mid-W | 16% | 84% | 0 | 17.0 | — |
| T3×road | High Warden Sorrel (sorrel) @20/0 | road-mid-B | 24% (4% by library) | 76% | 0 | 22.4 | — |
| T3×road | High Warden Sorrel (sorrel) @20/1 | road-mid-W | 27% | 73% | 0 | 18.1 | — |
| T3×road | High Warden Sorrel (sorrel) @20/1 | road-mid-B | 42% | 58% | 0 | 20.9 | — |
| T3×road | High Warden Sorrel (sorrel) @20/2 | road-mid-W | 39% | 61% | 0 | 17.0 | — |
| T3×road | High Warden Sorrel (sorrel) @20/2 | road-mid-B | 41% | 59% | 0 | 19.6 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/0 | road-mid-W | 20% | 80% | 0 | 11.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/0 | road-mid-B | 22% | 78% | 0 | 14.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/1 | road-mid-W | 33% | 67% | 0 | 11.5 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/1 | road-mid-B | 41% (2% by library) | 59% | 0 | 15.2 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/2 | road-mid-W | 55% | 45% | 0 | 11.0 | — |
| T3×road | Thornmother Ysolde (ysolde) @12/2 | road-mid-B | 55% (2% by library) | 45% | 0 | 14.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/0 | road-mid-W | 32% | 68% | 0 | 12.4 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/0 | road-mid-B | 36% (3% by library) | 64% | 0 | 16.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/1 | road-mid-W | 45% | 55% | 0 | 12.5 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/1 | road-mid-B | 50% (2% by library) | 50% | 0 | 16.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/2 | road-mid-W | 60% | 40% | 0 | 11.7 | — |
| T3×road | Thornmother Ysolde (ysolde) @16/2 | road-mid-B | 61% (2% by library) | 39% | 0 | 15.2 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/0 | road-mid-W | 43% | 57% | 0 | 13.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/0 | road-mid-B | 41% (2% by library) | 59% | 0 | 18.0 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/1 | road-mid-W | 53% | 47% | 0 | 13.1 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/1 | road-mid-B | 56% (2% by library) | 44% | 0 | 17.3 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/2 | road-mid-W | 67% | 33% | 0 | 12.1 | — |
| T3×road | Thornmother Ysolde (ysolde) @20/2 | road-mid-B | 63% (2% by library) | 37% | 0 | 15.8 | — |
| T3×road | Magister Quill (quill) @12/0 | road-mid-W | 8% (25% by library) | 92% | 0 | 10.3 | — |
| T3×road | Magister Quill (quill) @12/0 | road-mid-B | 18% (39% by library) | 82% | 0 | 14.4 | — |
| T3×road | Magister Quill (quill) @12/1 | road-mid-W | 29% (34% by library) | 71% | 0 | 11.3 | — |
| T3×road | Magister Quill (quill) @12/1 | road-mid-B | 22% (64% by library) | 78% | 0 | 14.6 | — |
| T3×road | Magister Quill (quill) @12/2 | road-mid-W | 43% (40% by library) | 57% | 0 | 12.1 | — |
| T3×road | Magister Quill (quill) @12/2 | road-mid-B | 35% (51% by library) | 65% | 0 | 16.0 | — |
| T3×road | Magister Quill (quill) @16/0 | road-mid-W | 14% (29% by library) | 86% | 0 | 11.8 | — |
| T3×road | Magister Quill (quill) @16/0 | road-mid-B | 27% (52% by library) | 73% | 0 | 16.2 | — |
| T3×road | Magister Quill (quill) @16/1 | road-mid-W | 35% (31% by library) | 65% | 0 | 12.3 | — |
| T3×road | Magister Quill (quill) @16/1 | road-mid-B | 31% (58% by library) | 69% | 0 | 16.8 | — |
| T3×road | Magister Quill (quill) @16/2 | road-mid-W | 50% (36% by library) | 50% | 0 | 12.7 | — |
| T3×road | Magister Quill (quill) @16/2 | road-mid-B | 40% (58% by library) | 60% | 0 | 17.6 | — |
| T3×road | Magister Quill (quill) @20/0 | road-mid-W | 18% (39% by library) | 82% | 0 | 12.9 | — |
| T3×road | Magister Quill (quill) @20/0 | road-mid-B | 30% (53% by library) | 70% | 0 | 17.9 | — |
| T3×road | Magister Quill (quill) @20/1 | road-mid-W | 46% (35% by library) | 54% | 0 | 13.3 | — |
| T3×road | Magister Quill (quill) @20/1 | road-mid-B | 35% (60% by library) | 65% | 0 | 18.4 | — |
| T3×road | Magister Quill (quill) @20/2 | road-mid-W | 57% (35% by library) | 43% | 0 | 13.3 | — |
| T3×road | Magister Quill (quill) @20/2 | road-mid-B | 47% (53% by library) | 53% | 0 | 19.0 | — |

### Aggregate — the references' win rate by life × entrance (tier 3; mean over 5 mages × 2 references)

| life \ basics | 0 | 1 | 2 |
|---|---|---|---|
| 12 | 85% (turns 13.8; by library 0%) | 73% (turns 14.7; by library 0%) | 62% (turns 14.7; by library 0%) |
| 16 | 79% (turns 15.9; by library 0%) | 66% (turns 16.3; by library 0%) | 56% (turns 16.1; by library 0%) |
| 20 | 74% (turns 17.5; by library 0%) | 61% (turns 17.6; by library 0%) | 52% (turns 17.1; by library 0%) |

### Per mage — the references' win rate by cell (tier 3; mean over both references)

| mage | 12/0 | 12/1 | 12/2 | 16/0 | 16/1 | 16/2 | 20/0 | 20/1 | 20/2 |
|---|---|---|---|---|---|---|---|---|---|
| Lord Corvane | 89% | 80% | 72% | 88% | 73% | 63% | 83% | 68% | 59% |
| Varro Flamebrand | 84% | 75% | 68% | 80% | 71% | 61% | 74% | 66% | 56% |
| High Warden Sorrel | 87% | 74% | 67% | 83% | 68% | 63% | 80% | 66% | 60% |
| Thornmother Ysolde | 79% | 63% | 45% | 66% | 53% | 40% | 58% | 46% | 35% |
| Magister Quill | 87% | 75% | 61% | 80% | 67% | 55% | 76% | 60% | 48% |

## 8b. The matrix — tier 2 mages at life {10, 12, 14} × entrance {0, 1 basics} vs the mid-road references (the mage at journeyman; the references at 12 / journeyman with a basic in play)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| T2×road | Mistress Vael (vael) @10/0 | road-mid-W | 20% | 80% | 0 | 15.7 | — |
| T2×road | Mistress Vael (vael) @10/0 | road-mid-B | 61% (26% by library) | 39% | 0 | 30.7 | — |
| T2×road | Mistress Vael (vael) @10/1 | road-mid-W | 31% | 69% | 0 | 16.3 | — |
| T2×road | Mistress Vael (vael) @10/1 | road-mid-B | 63% (19% by library) | 37% | 0 | 29.5 | — |
| T2×road | Mistress Vael (vael) @12/0 | road-mid-W | 25% | 75% | 0 | 17.0 | — |
| T2×road | Mistress Vael (vael) @12/0 | road-mid-B | 65% (29% by library) | 35% | 0 | 32.1 | — |
| T2×road | Mistress Vael (vael) @12/1 | road-mid-W | 34% | 66% | 0 | 17.2 | — |
| T2×road | Mistress Vael (vael) @12/1 | road-mid-B | 65% (18% by library) | 35% | 0 | 29.9 | — |
| T2×road | Mistress Vael (vael) @14/0 | road-mid-W | 31% | 69% | 0 | 19.0 | — |
| T2×road | Mistress Vael (vael) @14/0 | road-mid-B | 69% (35% by library) | 31% | 0 | 34.6 | — |
| T2×road | Mistress Vael (vael) @14/1 | road-mid-W | 39% | 61% | 0 | 17.9 | — |
| T2×road | Mistress Vael (vael) @14/1 | road-mid-B | 69% (22% by library) | 31% | 0 | 31.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/0 | road-mid-W | 7% | 93% | 0 | 12.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/0 | road-mid-B | 9% | 91% | 0 | 16.9 | — |
| T2×road | Kessa Emberhand (kessa) @10/1 | road-mid-W | 21% | 79% | 0 | 13.7 | — |
| T2×road | Kessa Emberhand (kessa) @10/1 | road-mid-B | 16% | 84% | 0 | 17.7 | — |
| T2×road | Kessa Emberhand (kessa) @12/0 | road-mid-W | 11% | 89% | 0 | 13.5 | — |
| T2×road | Kessa Emberhand (kessa) @12/0 | road-mid-B | 12% | 88% | 0 | 18.7 | — |
| T2×road | Kessa Emberhand (kessa) @12/1 | road-mid-W | 24% | 76% | 0 | 14.5 | — |
| T2×road | Kessa Emberhand (kessa) @12/1 | road-mid-B | 17% | 83% | 0 | 19.6 | — |
| T2×road | Kessa Emberhand (kessa) @14/0 | road-mid-W | 14% | 86% | 0 | 14.6 | — |
| T2×road | Kessa Emberhand (kessa) @14/0 | road-mid-B | 14% | 86% | 0 | 20.4 | — |
| T2×road | Kessa Emberhand (kessa) @14/1 | road-mid-W | 27% | 73% | 0 | 14.9 | — |
| T2×road | Kessa Emberhand (kessa) @14/1 | road-mid-B | 19% | 81% | 0 | 20.9 | — |
| T2×road | Adept Maelin (maelin) @10/0 | road-mid-W | 6% | 94% | 0 | 10.0 | — |
| T2×road | Adept Maelin (maelin) @10/0 | road-mid-B | 16% (13% by library) | 84% | 0 | 16.0 | — |
| T2×road | Adept Maelin (maelin) @10/1 | road-mid-W | 11% | 89% | 0 | 10.9 | — |
| T2×road | Adept Maelin (maelin) @10/1 | road-mid-B | 27% (11% by library) | 73% | 0 | 17.8 | — |
| T2×road | Adept Maelin (maelin) @12/0 | road-mid-W | 8% | 92% | 0 | 10.7 | — |
| T2×road | Adept Maelin (maelin) @12/0 | road-mid-B | 20% (10% by library) | 80% | 0 | 17.9 | — |
| T2×road | Adept Maelin (maelin) @12/1 | road-mid-W | 13% | 87% | 0 | 11.8 | — |
| T2×road | Adept Maelin (maelin) @12/1 | road-mid-B | 34% (15% by library) | 66% | 0 | 20.1 | — |
| T2×road | Adept Maelin (maelin) @14/0 | road-mid-W | 10% | 90% | 0 | 11.8 | — |
| T2×road | Adept Maelin (maelin) @14/0 | road-mid-B | 21% (10% by library) | 79% | 0 | 19.2 | — |
| T2×road | Adept Maelin (maelin) @14/1 | road-mid-W | 21% | 79% | 0 | 12.5 | — |
| T2×road | Adept Maelin (maelin) @14/1 | road-mid-B | 37% (11% by library) | 63% | 0 | 21.4 | — |
| T2×road | Brennor of the Glade (brennor) @10/0 | road-mid-W | 16% | 84% | 0 | 11.1 | — |
| T2×road | Brennor of the Glade (brennor) @10/0 | road-mid-B | 21% (24% by library) | 79% | 0 | 20.2 | — |
| T2×road | Brennor of the Glade (brennor) @10/1 | road-mid-W | 22% | 78% | 0 | 11.8 | — |
| T2×road | Brennor of the Glade (brennor) @10/1 | road-mid-B | 23% (4% by library) | 77% | 0 | 18.7 | — |
| T2×road | Brennor of the Glade (brennor) @12/0 | road-mid-W | 18% | 82% | 0 | 11.7 | — |
| T2×road | Brennor of the Glade (brennor) @12/0 | road-mid-B | 22% (18% by library) | 78% | 0 | 21.0 | — |
| T2×road | Brennor of the Glade (brennor) @12/1 | road-mid-W | 31% | 69% | 0 | 12.3 | — |
| T2×road | Brennor of the Glade (brennor) @12/1 | road-mid-B | 24% (4% by library) | 76% | 0 | 19.8 | — |
| T2×road | Brennor of the Glade (brennor) @14/0 | road-mid-W | 24% | 76% | 0 | 12.2 | — |
| T2×road | Brennor of the Glade (brennor) @14/0 | road-mid-B | 22% (18% by library) | 78% | 0 | 22.1 | — |
| T2×road | Brennor of the Glade (brennor) @14/1 | road-mid-W | 35% | 65% | 0 | 12.7 | — |
| T2×road | Brennor of the Glade (brennor) @14/1 | road-mid-B | 25% (4% by library) | 75% | 0 | 20.8 | — |
| T2×road | Pell of the Shallows (pell) @10/0 | road-mid-W | 6% (100% by library) | 94% | 0 | 9.6 | — |
| T2×road | Pell of the Shallows (pell) @10/0 | road-mid-B | 7% (100% by library) | 93% | 0 | 12.0 | — |
| T2×road | Pell of the Shallows (pell) @10/1 | road-mid-W | 17% (53% by library) | 83% | 0 | 10.6 | — |
| T2×road | Pell of the Shallows (pell) @10/1 | road-mid-B | 21% (90% by library) | 79% | 0 | 14.3 | — |
| T2×road | Pell of the Shallows (pell) @12/0 | road-mid-W | 6% (100% by library) | 94% | 0 | 10.2 | — |
| T2×road | Pell of the Shallows (pell) @12/0 | road-mid-B | 12% (100% by library) | 88% | 0 | 13.2 | — |
| T2×road | Pell of the Shallows (pell) @12/1 | road-mid-W | 20% (60% by library) | 80% | 0 | 11.3 | — |
| T2×road | Pell of the Shallows (pell) @12/1 | road-mid-B | 28% (93% by library) | 72% | 0 | 15.4 | — |
| T2×road | Pell of the Shallows (pell) @14/0 | road-mid-W | 11% (82% by library) | 89% | 0 | 11.1 | — |
| T2×road | Pell of the Shallows (pell) @14/0 | road-mid-B | 15% (100% by library) | 85% | 0 | 14.2 | — |
| T2×road | Pell of the Shallows (pell) @14/1 | road-mid-W | 25% (60% by library) | 75% | 0 | 11.9 | — |
| T2×road | Pell of the Shallows (pell) @14/1 | road-mid-B | 32% (94% by library) | 68% | 0 | 16.0 | — |

### Aggregate — the references' win rate by life × entrance (tier 2; mean over 5 mages × 2 references)

| life \ basics | 0 | 1 |
|---|---|---|
| 10 | 83% (turns 15.5; by library 0%) | 75% (turns 16.1; by library 0%) |
| 12 | 80% (turns 16.6; by library 0%) | 71% (turns 17.2; by library 0%) |
| 14 | 77% (turns 17.9; by library 0%) | 67% (turns 18.1; by library 0%) |

### Per mage — the references' win rate by cell (tier 2; mean over both references)

| mage | 10/0 | 10/1 | 12/0 | 12/1 | 14/0 | 14/1 |
|---|---|---|---|---|---|---|
| Mistress Vael | 60% | 53% | 55% | 51% | 50% | 46% |
| Kessa Emberhand | 92% | 82% | 89% | 80% | 86% | 77% |
| Adept Maelin | 89% | 81% | 86% | 77% | 85% | 71% |
| Brennor of the Glade | 82% | 78% | 80% | 73% | 77% | 70% |
| Pell of the Shallows | 94% | 81% | 91% | 76% | 87% | 72% |

## 9. The tier-2/3 beasts vs the mid-road references at catalog life, +4 and +8 (no roots; the beast at its catalog profile)

| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs S31 |
|---|---|---|---|---|---|---|---|
| beast×road | The Cunning Tactician (beast:tactician) @+0 | road-mid-W | 2% | 98% | 0 | 10.1 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+0 | road-mid-B | 15% | 85% | 0 | 13.2 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+4 | road-mid-W | 4% | 96% | 0 | 11.8 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+4 | road-mid-B | 22% | 78% (3% by library) | 0 | 16.4 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+8 | road-mid-W | 8% | 92% | 0 | 13.0 | — |
| beast×road | The Cunning Tactician (beast:tactician) @+8 | road-mid-B | 25% | 75% (4% by library) | 0 | 18.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+0 | road-mid-W | 14% | 86% | 0 | 9.2 | — |
| beast×road | The Boggart Warband (beast:warband) @+0 | road-mid-B | 27% | 73% | 0 | 11.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+4 | road-mid-W | 29% | 71% | 0 | 10.6 | — |
| beast×road | The Boggart Warband (beast:warband) @+4 | road-mid-B | 36% | 64% | 0 | 13.8 | — |
| beast×road | The Boggart Warband (beast:warband) @+8 | road-mid-W | 39% | 61% | 0 | 11.4 | — |
| beast×road | The Boggart Warband (beast:warband) @+8 | road-mid-B | 41% | 59% | 0 | 15.2 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+0 | road-mid-W | 27% | 73% | 0 | 13.5 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+0 | road-mid-B | 62% | 38% (42% by library) | 0 | 26.3 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+4 | road-mid-W | 38% | 62% | 0 | 14.7 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+4 | road-mid-B | 67% | 33% (61% by library) | 0 | 29.4 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+8 | road-mid-W | 45% | 55% | 0 | 15.9 | — |
| beast×road | A Vampire Nighthawk (beast:nighthawk) @+8 | road-mid-B | 68% | 32% (72% by library) | 0 | 30.7 | — |
| beast×road | The Living Gale (beast:gale) @+0 | road-mid-W | 6% | 94% | 0 | 11.0 | — |
| beast×road | The Living Gale (beast:gale) @+0 | road-mid-B | 26% | 74% | 0 | 15.0 | — |
| beast×road | The Living Gale (beast:gale) @+4 | road-mid-W | 15% | 85% | 0 | 12.9 | — |
| beast×road | The Living Gale (beast:gale) @+4 | road-mid-B | 36% | 64% | 0 | 17.5 | — |
| beast×road | The Living Gale (beast:gale) @+8 | road-mid-W | 21% | 79% | 0 | 14.5 | — |
| beast×road | The Living Gale (beast:gale) @+8 | road-mid-B | 47% | 53% (2% by library) | 0 | 19.3 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+0 | road-mid-W | 20% | 80% | 0 | 10.6 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+0 | road-mid-B | 31% | 69% | 0 | 14.2 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+4 | road-mid-W | 33% | 67% | 0 | 11.7 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+4 | road-mid-B | 39% | 61% | 0 | 16.4 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+8 | road-mid-W | 39% | 61% | 0 | 12.6 | — |
| beast×road | The Siege-Gang (beast:siegegang) @+8 | road-mid-B | 49% | 51% | 0 | 18.1 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+0 | road-mid-W | 5% | 95% | 0 | 12.0 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+0 | road-mid-B | 14% | 86% (5% by library) | 0 | 13.9 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+4 | road-mid-W | 10% | 90% | 0 | 13.4 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+4 | road-mid-B | 16% | 84% (7% by library) | 0 | 15.8 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+8 | road-mid-W | 14% | 86% | 0 | 14.6 | — |
| beast×road | The Hypnotic Specter (beast:specter) @+8 | road-mid-B | 17% | 83% (8% by library) | 0 | 17.7 | — |
| beast×road | The Serra Angel (beast:serra) @+0 | road-mid-W | 51% | 49% | 0 | 15.9 | — |
| beast×road | The Serra Angel (beast:serra) @+0 | road-mid-B | 68% | 32% (9% by library) | 0 | 21.1 | — |
| beast×road | The Serra Angel (beast:serra) @+4 | road-mid-W | 61% | 39% | 0 | 17.1 | — |
| beast×road | The Serra Angel (beast:serra) @+4 | road-mid-B | 76% | 24% (13% by library) | 0 | 22.1 | — |
| beast×road | The Serra Angel (beast:serra) @+8 | road-mid-W | 66% | 34% | 0 | 17.4 | — |
| beast×road | The Serra Angel (beast:serra) @+8 | road-mid-B | 78% | 22% (18% by library) | 0 | 22.7 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+0 | road-mid-W | 16% | 84% | 0 | 10.7 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+0 | road-mid-B | 11% | 89% (2% by library) | 0 | 15.0 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+4 | road-mid-W | 26% | 74% | 0 | 12.1 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+4 | road-mid-B | 12% | 88% (2% by library) | 0 | 18.3 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+8 | road-mid-W | 33% | 67% | 0 | 13.0 | — |
| beast×road | A Rumbling Baloth (beast:baloth) @+8 | road-mid-B | 17% | 83% (4% by library) | 0 | 20.9 | — |
| beast×road | The Faerie Formation (beast:formation) @+0 | road-mid-W | 18% | 82% (2% by library) | 0 | 12.8 | — |
| beast×road | The Faerie Formation (beast:formation) @+0 | road-mid-B | 47% | 53% (9% by library) | 0 | 18.2 | — |
| beast×road | The Faerie Formation (beast:formation) @+4 | road-mid-W | 28% | 72% (1% by library) | 0 | 14.9 | — |
| beast×road | The Faerie Formation (beast:formation) @+4 | road-mid-B | 59% | 41% (17% by library) | 0 | 20.2 | — |
| beast×road | The Faerie Formation (beast:formation) @+8 | road-mid-W | 37% | 63% (5% by library) | 0 | 16.1 | — |
| beast×road | The Faerie Formation (beast:formation) @+8 | road-mid-B | 67% | 33% (39% by library) | 0 | 22.1 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+0 | road-mid-W | 30% | 70% | 0 | 10.8 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+0 | road-mid-B | 41% | 59% | 0 | 14.4 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+4 | road-mid-W | 44% | 56% | 0 | 11.9 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+4 | road-mid-B | 54% | 46% | 0 | 16.5 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+8 | road-mid-W | 54% | 46% | 0 | 12.7 | — |
| beast×road | The Pelakka Wurm (beast:wurm) @+8 | road-mid-B | 68% | 32% | 0 | 18.9 | — |

### Aggregate — the references' win rate by life delta (mean over 10 beasts × 2 references): +0: 73% · +4: 65% · +8: 58%

   **The reads the planner asked for.**
   - **The entrance is the stronger lever.** Tier 3, averaged: one basic is worth about twelve points off the reference (85 → 73 at 12 life), two about twenty-two (85 → 62); four life is worth about six (85 → 79), eight about eleven (85 → 74). Turns lengthen with life (13.8 → 17.5) and barely with basics (13.8 → 14.7) — life makes the game longer, the roots make the mage's plan arrive.
   - **Where the 55–65 band sits (tier 3)**: **16 life + 2 basics = 56%**, **20 + 1 = 61%**, **12 + 2 = 62%**. Nearest above: 16 + 1 (66%), 12 + 1 (73%); nearest below: 20 + 2 (52%). Three cells qualify; 16/2 is the one where the mage plays its own game rather than a longer one.
   - **Corvane turns on the roots, not on life**: at no basics he is flat across life (89 / 88 / 83 — the reference's win rate) — a deck that dies to a plan, not a race; with two basics he moves (72 / 63 / 59). The Rituals plus two roots put Buried Alive on turn one and Zombify on turn two. He reaches the band only at 20/2 (59%); at 16/2 he is 63%. ADR-113's question — does the reanimator turn at 16 or 20 — is answered "at 20 with two roots, nearly at 16 with two". The archetype is not wrong for the tier; it is a two-root deck.
   - **Flat across life (list problems after all)**: Corvane at 0 basics (89 → 83) and Sorrel at 0 basics (87 → 80) — both black-red/white-black decks that lose to the road's curve before their plan; both move with basics (Sorrel 87 → 67 at 12/2). **Ysolde moves most** (79 → 58 across life; 45 → 35 with two basics — already past the band at 12/2: the aggro mage wants life, not roots). Quill and Varro sit in between (87 → 48, 84 → 56 at the corners).
   - **Tier 2 does not reach the band in the cells measured**: the best aggregate is 14/1 = 67%; Vael alone is inside it everywhere (60 → 46 — the lifegain deck beats the road already; 14/1 puts her BELOW the band), while Kessa, Maelin, Brennor and Pell sit 70–94. Two basics were not in the tier-2 grid; the tier-3 slope (−10 to −12 per basic) puts 14/2 near 57 and 12/2 near 61 — the cells to measure next (the sweep takes `--part 8` with the grid edited in one line).
   - **The beasts (part 9)**: aggregate 73% at catalog life, 65% at +4, 58% at +8 — the beasts do reach the band on life alone (+8), which the mages do not. Per beast: the Serra is past the band already (49 / 32 at +0 — the top of the bestiary is a real fight for a mid-road player); the Nighthawks and the Wurm reach it at +4 (62 / 33, 56 / 46); the Siege-Gang and the Warband at +8 (61 / 51, 61 / 59); the Specter and the Tactician are flat (95 → 86, 98 → 92 against the white road — plan decks that die to the curve; they would need something other than life); the Baloths and the Gale never get there against the black road.
   - **The white road is the harder reference everywhere** (the mage-side columns run 10–20 points worse against road-mid-W than road-mid-B) — the same weenie-over-40-cards read as the five roads.

2. **The implementer's read of the number.** Standard tier 3 = **16 life + 2 basics** (56%; the mage's own game, 16 turns); Hard one cell harder = 20 + 2 (52%); Easy one cell easier = 16 + 1 (66%) or 12 + 2 (62%). Tier 2 needs the two-basic cells measured before its number is picked; on the slope, Standard tier 2 ≈ 14 + 2 or 12 + 2. Beasts: +8 at Standard puts the aggregate at 58% with the plan beasts still folding and the Serra already past the band — the beasts may want per-beast deltas rather than a tier one (the Specter and the Tactician are the cases). Tier 1 stays 8 / none (the brief).
3. **Part 4 — the blue re-read.** Brainstorm per copy: Tessaly 0.33 (S31: 0.32), Kessa 0.25 (0.27), Pell 0.31 (0.28), Varro 0.35 (0.30), Quill 0.35 (0.28) — no material change from the window opening. Where it is cast now: their END step 8–28%, in response to their spell 29–49%, their turn elsewhere 2–6%, **our own turn 17–59%** — and of the own-turn casts, **56–92% are cast over the caster's OWN spell on the stack** (Concern 4). No blue deck's tier standing moved from the window alone; the S32 deltas were the Escort.
4. **The S28 window has a second defect**: the "in response" test is `view.stack.length > 0`, which is true right after we cast our own spell and get priority back — so Brainstorm (and the Escort's gate, which copies the rule) fires on our own turn over our own Crab. The fix is one clause (an opponent's item on the stack) plus a ladder run; not made this session. The S32 numbers carry it as the S31 numbers carried the first defect.
5. **`facts.returned` is not in the matrix tables** — part 8 reports win rates, turns and library wins per the brief; Corvane's return rates per cell would sharpen the "two-root deck" read (a two-line addition to `pairing()` if wanted).
6. **The white road as the harder reference** (read 1, last bullet) means a Standard cell picked on the aggregate is ~5 points easier against a black-road player and ~5 harder against a white-road one; if the dial wants a per-road term that is the legacy hook's sibling (Part 6).

## Part 6 — Scoping the matchup resolver (no build)

**How a duel's setup is resolved today.** (a) *Encounter duels* (`prepareDuel`, `packages/world/src/journey.ts`): the enemy's life is the catalog template's `worldLife` (`data/world/opponents.json`, per row — tier-1 8, tier-2 8–10, tier-3 12, the Heart's petals and lords by their own rows) plus situational terms (`lairResidentLifeBonus` for a lair resident; the Barrage's negative delta, floored at 1); the AI profile is the template's `difficulty` (apprentice / journeyman / master) through the `heuristic:<difficulty>` agent factory (`difficultyProfile` in the agents package); the ante is `knobs.anteCount`; the modifiers are the enemy's `startingLife` plus the PLAYER's manalinks (`manalinkModifiers(world)` — the player's roots; the enemy has none). (b) *Dungeon interiors* (`dungeonDuelSpec`): the same template life plus the empowerment clock (`dungeonEmpowermentTiers` by steps — life, a basic, a token, a card; lords read `lordEmpowermentTiers` and the global `lordGrowthLife`). (c) *Sieges* (`siegeDuelSpec`): template life, no bonus. (d) *The Corolla* (`petalDuelSpec` / `mirrorDuelSpec` / `heartDuelSpec`): the petals at their rows; the Heart at the `heartLife` knob — **the one place the difficulty mode sets an enemy's life today (35 / 40 / 45)** — with the five roots (`heartRootModifiers`) and the card in hand. (e) *The mode itself*: `world.difficulty` (easy / standard / hard) reaches duels only through the `DIFFICULTIES` knob bundle (`anteCount`, `lossLifePenalty`, `heartLife`, the empowerment tables, `lordGrowthLife`, prices) and the starters' variants (`starterDecklist`); **an enemy's tier life and profile do not read the mode anywhere.** (f) *The sweep*: `TIER_LIFE` / `TIER_PROFILE` in `mage-sweep-cli` (now `--tier-life`), independent of the catalog.

**The resolver.** `resolveMatchup(opponent: OpponentTemplate, mode: DifficultyName, legacy: Legacy | null, knobs: KnobValues) → { life: number; profile: Difficulty; entrance: string[]; ante: number }` in `packages/world/src/matchup.ts`:
- **Tables in the knobs registry** (the registry's per-mode bundles already exist): `tierLife: Record<1|2|3, number>` and `tierEntrance: Record<1|2|3, number>` (basics count) for mages, `beastLifeDelta: Record<1|2|3, number>` for beasts (no entrance — Part 1), each with an easy/standard/hard value in `DIFFICULTIES`; the registry renders them into `docs/knobs.md` as today.
- **life** = the table's cell for a mage (or the catalog `worldLife` + the beast delta for a beast, the lords/petals/Heart untouched), and the situational terms (lair bonus, empowerment, the Barrage) stay in their callers, applied to the resolver's result.
- **profile** = the template's `difficulty`, unchanged (ADR-103: the dial is not AI sophistication).
- **entrance** = N basics of the mage's colours by pip count (the sweep's `mageColorsByPips` moves into `sim/mage-decks` as data — a `primaryColors` per mage computed once — so world and sweep read the same order), emitted as `permanentOnBattlefield` modifiers for player 1 (the S33 fixture's path).
- **ante** = `knobs.anteCount` (already mode-bundled).
- **The legacy hook**: `legacyTerm(legacy, opponent) → { lifeDelta: number; entranceDelta: number }`, called inside the resolver, returning zeros today; phase two fills it ("the player holds N ministers / M powers → +X"), and a per-road term (Concern 6) is the same shape.

**What moves**: `prepareDuel`, `dungeonDuelSpec`, `siegeDuelSpec` call the resolver for the enemy's life/entrance/ante (the Corolla keeps `heartLife` and its roots); the catalog's `worldLife` stays as the beasts' base and the mages' rows become documentation (or are dropped from the mage rows — planner's call); the telegraph/parley gains the entrance line the planner writes; `docs/reference/enemies.md` renders per mode.

**Tests it needs**: the resolver's table lookup per mode and tier (a table test); a prepared encounter duel carrying the mage's two basics in colour order and the right life at each mode (the world.test pattern at line ~857, which already asserts `permanentOnBattlefield` modifiers on a dungeon spec); the replay byte-exact fixture (S33's, re-pointed at `prepareDuel`); the `enemies.md` sync test per mode; the existing `worldLife` pins re-based.

**What the sweep needs**: `--mode easy|standard|hard` reading the same tables through the resolver (replacing `--tier-life` and the CLI's `TIER_LIFE`), so a sweep row is "the catalog at this mode" and parts 1–9 can be run per mode without editing the CLI; the S33 baseline files keyed by mode.

## Registry entries added/changed

None (no words, no cards, no knobs). ADRs 112–115 in `docs/decision-updates/s33.md`. Sim: `mage-sweep` parts 8–9, `--tier-life`, `mageAt`/`beastAt`/`mageColorsByPips`, `pairing()` returns its numbers; `s33-entrance.test.ts`. Implementer-notes: S32–S33 lessons.

## Test status

Default tier **576 passed / 2 skipped** (56 files; +3 entrance tests). `pnpm typecheck` clean. No fuzz beyond the entrance path (the brief); the entrance replays byte-exact. No AI change, so no ladder run. Sweep: parts 8 (15,000 games) and 9 (6,000); part 4's 1,000-game read.

## Suggested next

1. **Chris / planner**: the number — tier 3 at 16/2 (Standard), 20/2 (Hard), 16/1 or 12/2 (Easy) from the table; tier 2's two-basic cells to measure first; the beasts' per-beast vs per-tier delta.
2. **Planner (S34)**: the resolver brief from Part 6; the S28 window's second defect (Concern 4 — one clause + a ladder run); Corvane's return rates per cell if the "two-root deck" read wants sharpening.
3. **Implementer smalls**: tier-2 cells at two basics (`--part 8` with the grid edited); `facts.returned` in the matrix rows.

## How to run

```
pnpm test / FUZZ_FULL=1 pnpm test
pnpm typecheck
pnpm mage-sweep --games 100 --part 8      # the matrix (~12 min); --part 9 the beasts (~5 min); parts 1–7 as before, --tier-life 8,10,12
FUZZ_FULL=1 pnpm exec vitest run packages/sim/src/ladder-smoke.test.ts / pnpm ladder --games 100
pnpm reference / pnpm knobs:doc / pnpm art:fetch
pnpm viewer → /gallery · /play → any mage vs any mage
```
