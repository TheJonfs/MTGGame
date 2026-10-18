# Session 67 brief — the deep triads, as a batch

*Planner → Implementer. 2026-10-19. Follows the running handoff.md (after S66 and the post-S66 work). One session for the batch; the pilot probes alongside. Process rules unchanged: appends to `docs/decision-updates/s67.md`; probe before rule; a guide measured row by row; every AI change carries a ladder delta or reverts; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S66's deviations and the post-S66 work ratified**: the Pall seeding whole; BR Removal as built; the Usher as Mardu's lord (the one lord whose card is a combo piece); ADR-186 general (every format frozen at its first field; Peasant 20/4); `wide`; the Writ out of the sweeper round; the Ossuary archived; Faldor not adopted; the Barrow's count at one; Vigil Keeper (R-116, T2 interim) and the bottoming set aside (R-115, `cards-proposed`); the Witch registered with its Dranas; the Watch's Keepers; book 140.
- **ADR-187 — Mardu's reading.** A triad with an engine reproduces the Open's shape; the loop is beatable without an Usher (Chris's Witch, 16–4) and the gap left is the pilot's. Mardu stands at twelve.
- **ADR-188 — Guides key by list, and generation validates first.** A guide belongs to its list (`key`), not to the exact fifteen; `open:rr` warns when a fifteen under test matches no guide its list had. `open:gen` validates every shape and reference before it writes a file.
- **The pilot terms** are probes this session, rules the next (Part 3).
- **Mardu's names** (the plane's register; keys unchanged): BR Removal → **the Ashen**; Mono-Red Burn → **the Kindling**; the Witch, the Pall, Mardu Control, the Rabble, the Muster, the Warband, the Levy, the Roll, the Chancel and the Watch keep theirs.

## Part 1 — Vigil Keeper in the Open (before the batch)
An exile-instead-of-dying static answers the Usher's loop and is castable by any white deck — the Open's first in-pool answer to the Pall and Mardu Control. Measured paired, 160 matches a pairing: in the Watch's shape (the Open has no Watch — the Muster: three for the Fencing Aces); Emerald Snakes (two on the white splash for two Rage Cobras); Reaper Clio's fifteen (three for the Essence Scatters, a guide row against the Usher lists); Countersnake's fifteen. The read: the Usher lists' numbers against the Keeper lists; whether a fifth shape (the exile) joins the Open's four. Adopt by ADR-168; the Open's table re-run if anything is adopted.

## Part 2 — The batch: Grixis (UBR), Jund (BRG), Jeskai (URW)
For each: `formats/<id>/`, the rule (`colorsWithin`, `manaWithin`, the restricted list where it applies, the laws banned), a door line, ten to twelve seeds — **whole where legal** (the handoff's counts: Grixis 15, Jund 13, Jeskai 13) **plus the built lists the census says the field lacks**, the tables (three columns), the thresholds frozen at the first field (ADR-186), a reference page, the lord read (the census names each: ⚠ the implementer — Grixis's, Jund's, Jeskai's three-colour legends) in two lists each. The planner's notes per triad:
- **Grixis** — the Writ, the Eddy, the Undertow, the Pall, the Barrow?, the Kiln, the Tally (archived — revive here), the Rabble, the Kindling, the Ashen, BR Removal… the lists are mostly whole; **build**: a Grixis Clio control (the Writ with Kavu and Char) and a Grixis reanimator *only if* the Ossuary's read says the field's removal allows it (Concern 3 — read the field's Swords/Vindicate count first; Grixis has neither).
- **Jund** — the Sweep, the Ashen, the Rabble, the Stampede, the Thicket?, Emerald Snakes (Jund-legal? ⚠ its Tundras — the land swap), the Wurmspeaker, Black Forest Ham (Chris's, unregistered — his call), the Kindling; **build**: Jund Snakes with the Reaper (Reaper Control's shape — the Reaper is Jund's lord) and a Jund aristocrats list (the Coin's shape without white: Blood Artist, the Aristocrat, Meliyan's cousins).
- **Jeskai** — the Kiln, the Tally, the Aerie, the Watch, the Muster, the Warband, the Tollgate (its green — no: the Tollgate is Naya; out), Countersnake?, the Locks (minus black: a UW control), the Rabble, UR Pyroclasm Control; **build**: a Jeskai sweeper control (Wrath, Pyroclasm, the Wave, Control Magic, Kavu — the deck the Open never got) and a Jeskai Lumen-theft list (Lumen, Restoration Angel, Protocol, Control Magic — the S60 theft shell, now with a sweeper behind it).
- The read across six triads for the handoff: which have an engine, a race, a lock; which reproduce the Open; **Jeskai is the contrast** (counters and sweepers both).

## Part 3 — The pilot terms (probes; ADR-167)
- **The Witch's life**: from the Mardu tables and Chris's Umbel, every Witch activation — our life, the opponent's untapped attackers and burn seen, and whether the paid life was lost within two turns. The candidate rule: pay while life after payment exceeds the board's reach plus the burn count seen; never into an untapped racer. Book 113's shape extended from burn to the board.
- **The Manaba engine**: every Manaba tap — into what, and the mana floated or wasted; the gap between a sink and a wide board (Chris's 13–1 vs the pilot's 60).
- **Racing**: games where the human attacked and the pilot held (the Emerald Snakes diff): the board state, and the playout from each.
Report the three; the rules are S68's with the ladder.

## Part 4 — Measure
Three triads' tables; the Open's Keeper read; the six-triad read; the batch's actual cost against the estimate (for the shallow four).

## Handoff
The three triads (seeds, tables, doors, lords, names pending), the Open's Keeper read, the three probes, the tooling rulings built, deviations, concerns — and the shallow batch's plan (Sultai first by contrast — no sweeper; then Abzan, Temur, Bant).
