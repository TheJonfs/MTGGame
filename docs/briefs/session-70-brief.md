# Session 70 brief — the still-pair High Grounds

*Planner → Implementer. 2026-10-29. Follows the running handoff.md (after S69 and the post-S69 work). One session, maybe a half more. The five grounds are studied for Convocation play first; their flow into the journey as prizes is a later design. Process rules unchanged: appends to `docs/decision-updates/s70.md`; ADR-182 for every card (the single-factor sweep, the corners, a combo probe where a loop is possible); every AI change carries a ladder delta or reverts; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **The post-S69 work ratified**: books 149–151 and the auto-aim; the five registrations; BW Massacrats and BW Aristocrats both standing; Temur's threshold at 2; `blockloss` on trial.
- **ADR-191 — The consequence-model rule**: a registered list whose pilot number is far below its author's record is the first probe to run; the consequence-model session (death payoffs of every kind, sacrifice outlets, tokens, a spell's own trigger chain) is the next pilot work after this round.
- **ADR-192 — The still-pair High Grounds enter as Convocation cards.** Five legendary lands, the still pairs (WU, UB, BG, RG, RW), the first cycle's grammar: a dual that enters untapped, one activated ability with the land's tap. **Where they live**: the pool, prizeOnly like the first five; the Open's restricted list (one copy); legal in the triads whose pair they match under `manaWithin`; **in the power slot** — never drafted, never a kept card. Their flow home (the Umbel's prize cycle; phases one, two and three) is the next design conversation, not this session. Each is tied to its phase-one minister: RW Lumen, UB Clio, BG Seraphina, UW Faldor, RG Yuloke.
- **Chris's archetype candidates** for the pool: slots in Part 3 for the cards he names; the planner's one is Cloudshift.

## Part 1 — The five, their nominal text, and each study's axes
| ground (working name ⚠ Chris) | nominal text | the lists that want it (the Open; the triads by pair) | the axes |
|---|---|---|---|
| **RW — the Hearthway** (Lumen) | {2}{R}{W}, {T}: ~ deals 2 damage to any target. You gain that much life. | the Muster, Mardu Control, the Tollgate; the Watch (Naya, Mardu, Jeskai) | 2 at {2}{R}{W} / 3 at {3}{R}{W} |
| **UB — the Drowning Stair** (Clio) | {2}{U}{B}, {T}: Target player mills six cards. | the Writ, the Undertow, Mono-Black Clio; the Eddy (Esper, Grixis, Sultai) | 4 / 6 at {2}{U}{B}; 8 at {3}{U}{B} |
| **BG — the Gallows Garden** (Seraphina) | {X}{1}{B}{G}, {T}: Destroy target nonland permanent with mana value X or less. | Reaper Clio, the Sweep, Black Forest Ham; Massocrafts (Sultai), Abzan, Jund | the +1 against +0; a read of what it kills (X by turn) |
| **UW — the Muster Field** (Faldor) | {1}{W}{U}, {T}: Create a token that's a copy of target creature token you control. | the Depths, Countersnake, the Aerie (Esper, Jeskai, Bant), UW Skies promoted | one copy at {1}{W}{U} / up to two at {2}{W}{U}; **the word**: a token copy is `createToken` of the target's def — counters not copied (CR 707.2), a Season-grown Snake copies as a 1/1 |
| **RG — the Scorchbank** (Yuloke) — *two cards in the trade space* | (a) {2}{G}{R}, {T}: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. ~ deals 1 damage to any target. (b) {1}{G}{R}, {T}, Sacrifice another land: Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle. | Emerald Snakes, the Stampede, the Wurmspeaker, Reaper Clio; Naya, Jund, Temur | (a) the ping at 1 / 2; (b) "another land" (never itself) at {1}{G}{R} / {2}{G}{R}; both in the same seats — the landfall lists (the Crab, Dread Presence, Emeria, the Gladehart) and the ramp lists say which they hold |

**The method per ground** (ADR-182): in two or three Open lists at one copy (restricted) for a land of the pair (paired by seed, 160 matches a pairing), the activation rate and what it did; then the nominal against its corners; the ground's two or three triads the same way in their best-fit lists. **Two caveats, written into the study**: the BG and UW grounds reward patience (holding mana open; a token to copy), which the pilot does badly — their numbers are floors, and Chris's hand read is the ceiling; the AI's activation pricing is Part 2.

## Part 2 — AI
- The Hearthway: priced as a Helix on a land (book 88's face rule for the damage; the gain as the Fordkeeper's); the Drowning Stair as a clock (the mill lists' value of six; held against a deck with Crabs of its own? — their library is the target); the Gallows Garden as repeatable removal at X (the X-spell pricing; a target worth the mana each turn — book 117's floor); the Muster Field: copy the best token (the Beast, the Soldier under the Captain, a Snake) at end step or before combat; the Scorchbank (a): the fetch when a land drop is missed or a landfall payoff is out, the ping by `burnkills`; (b): the sacrifice when the two basics are worth the land (a landfall payoff out, or a colour missing) — never the last land of a colour.
- Books as needed; the ladder after each.

## Part 3 — Archetype candidates for the pool
- **Cloudshift** ⚠ (Avacyn Restored; {W} instant: exile target creature you control, then return it to the battlefield under your control; zero words — the blink; tier 1): the blink line's cheap enabler (the Kavu, the Forerunner, Karmic Mentor, Restoration Angel, Lumen's theft made permanent). Study in the Watch, Mardu Control, Naya's Brood; the Lumen line's rate.
- **Chris's candidates**: ⚠ slots for the cards he names (the brief is open here); each by ADR-182.

## Part 4 — Measure
Each ground's nominal and corners in the Open and its triads; the Scorchbank's two cards against each other in the same seats; Cloudshift's; the pool registry rows; the Open's restricted list grown by five (its first growth); the triads' `manaWithin` reads for each ground; the Open's table re-run once if any ground is adopted into a registered list.

## Part 5 — Text
Working names ⚠ for Chris: the Hearthway, the Drowning Stair, the Gallows Garden, the Muster Field, the Scorchbank. The grounds' flavour lines follow the first cycle's (a place, in the flood's register) once the names settle; their seats, if any, are phase three's.

## Handoff
The five grounds' texts as adopted with their studies; the RG choice (or both — ⚠ a cycle of six is a ruling); the copy word (R-117); Cloudshift and Chris's cards; the AI books; deviations, concerns — and the implementer's read on the prize flow's build (the outbox already carries cards; a High Ground as a champion's prize is one row in the prize table and one line in the fence, since the power slot is the fence's list).
