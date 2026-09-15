# Session 38 brief — phase two's groundwork

*Planner → Implementer. 2026-09-16. Follows the running handoff.md (after S37). Reads `phase-two-design-draft-1.md` §5, §7, §8 and the S37 handoff's Concern 2. Process rules unchanged: appends to `docs/decision-updates/s38.md`; world-sim before knob arguments — the phase-two column is encoded but nothing in the shipped game reads it yet; fuzz before fixtures where duels change; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S37 Deviations 1–4 ratified.** The save's deck record stays; the bosses join the production picker behind the unlock rule; the spawn roll's layout; the parley refuses the fight only.
- **ADR-124 — The single-game unlock is card-grained by design (Chris).** Meeting a boss once unlocks its deck for casual play; the rule exists to preserve the surprise through one pass of the campaign, not to reward the win. No won-duel store.
- **ADR-125 — Phase two's doors live on the sites.** Strongholds and courts are fixed sites reached through the telegraph, where the editor is reachable; `deckRule` lives on the site defs (or the site def names a template) and the telegraph carries the door — Fight shut, the refusal line, "edit your deck" beside it, the door pre-selected in the editor. The parley path stays wired for a ruled roamer; none is planned.
- **ADR-126 — The salvage start (Chris, 2026-09-15; built in S39, recorded now).** A phase-two run begins with: the ten legends (five carried ministers, five power guardians); one free pick per colour from the pool at any tier below prizeOnly, through the stronghold prize picker's rule (a card counts for any colour it carries; gold included); a **prescribed pack** — a fixed list of ten tier-1/2 cards per colour plus five colourless (fifty-five); a purse (knob); **no manalinks**. Then: choose two colours → the editor opens with a default deck assembled from those twenty plus basics, legal and editable. The pack is a fixed list so the Lab can measure it. Nothing salvages from the phase-one deck (the last-colour-last player must not be punished); `lastDeck` is not written to the legacy.

## Part 1 — The resolver's phase-two column
A `phaseTwo` bundle on `mageTierLife` / `mageTierEntrance` / `beastTierLifeDelta`, orthogonal to Easy/Standard/Hard (the mode picks the column; the difficulty shifts it as today). **Proposed values, ⚠ unratified**: mages T1 12/1 · T2 16/2 · T3 20/3; beasts +4 / +8 / +12; lords, courts and the Heart untouched here (their phase-two rows come with their content). The resolver reads `world.phase` (new, `1 | 2`, default 1; the legacy write at the fifth flag does *not* set it — the flood scene will). `pnpm mage-sweep --phase 2` and the Lab's mode selector expose the column; `enemies.md` renders it. **No shipped path sets `phase = 2` this session.** Tests: the table lookup; a prepared duel at phase 2 for one mage per tier; the sweep flag.

## Part 2 — Doors on the sites
- `deckRule?` on the site defs the phase-two lords and courts will use (`StrongholdContentDef`, `CorollaDef`'s petal entries — or a `templateId` on them that resolves to an `OpponentTemplate` carrying the rule; the implementer picks the cheaper honest shape and says which). Validation and `enemies.md` rendering as S37.
- **The telegraph door**: `dungeonTelegraph` / the petal telegraph call `doorCheck`; a failing active deck shows the refusal line and the rule, shuts Fight, and offers "edit your deck" which opens the editor with the door pre-selected (`setEditorRule`). Returning from the editor re-checks. The controller test in the S10 pattern: a ruled test site, a failing deck, the editor round trip, entry with a legal deck.
- The editor's door picker keeps its list for planning ahead; the pre-selected door is the default when arriving from a site.
- No shipped site carries a rule.

## Part 3 — The accumulating Heart
- `heartLawsPersist` (knob, default `false`; `true` under phase two): the Manafleur's law sequence keeps every prior law on the battlefield — the ring accumulates instead of rotating; the exile-on-next-law step is skipped; the sequence order and cadence are unchanged. The fifth law joins four. Fixtures: the second law lands beside the first; the copies' legend rule unaffected; a Disenchant on the oldest law leaves the newer; the ring's tokens count for the Angel's ETB.
- **heart-sim read**: `--persist` × `heartLife` {40, 45, 50} × roots {5} against `chris-road-B` (master, 17 life, four basics) and the stock references; 100 games a cell. Report kill rate, bloom rate, the petal at death, and the law count on the battlefield at the player's death. The read wanted: how much harder the accumulating ring is at 40 than the rotating one (S28: 80% at 40) — that number sets the phase-two Heart's life. No knob move; the planner takes it to Chris.
- AI: the Manafleur-aware master stays on the shelf; if the accumulating ring makes the flower passive (laws doing the work, the body not attacking), describe it.

## Part 4 — The world-UI reference page
`docs/reference/world-ui.md`, hand-kept (S37 Concern 1): a paragraph per screen — the map, the town, the shop, the quest board, the editor (decks, spares, legality, the door picker), the parley, the telegraphs, the duel rail, the Chronicle, the settings — what each shows, what the player can do there, what gates it, and where the editor is and isn't reachable. Plus the dev surfaces in one paragraph each (`/play`, `/lab`, `/gallery`). The planner reads it before any brief that names a screen; the implementer updates it in the session that changes a screen.

## Part 5 — Smalls
- The Lab's mode selector shows the phase column beside the difficulty.
- `world.phase` on the dev panel and in the save's summary line.

## Part 6 — For S39 (the salvage), so the implementer sees what's coming
- `newWorld({ salvage: SalvageSpec })` beside `newWorld({ starter })`: the legends from the legacy, the five picks, the pack, the purse, no manalinks, `phase = 2`, the phase-two seed and name list.
- The **pick screen** (a new controller screen kind): five colour-tabbed picks through the prize picker's rule, then "choose your two colours," then the editor with the assembled default deck; the editor must be left with a legal deck.
- The **pack** as a catalog list (`data/world/salvage-pack.json`, fifty-five ids, validated against the pool and the tier rule) — the planner authors it in S39's brief.
- A **salvage reference** for the sim: two decks the planner builds from the pack plus one pick set (the two most natural pairs), 12 life, journeyman, no basics in play — the phase-two yardstick, as `road-mid-W/B` was phase one's.
- The flood scene's text (planner) and the phase-two town-name list (Chris/planner).

## Verification & handoff
Fuzz the Heart with `heartLawsPersist` before fixtures (replays byte-exact); the resolver's phase-two lookups; the door round trip; ladder gates untouched unless AI moved. Handoff: the heart-sim table with the accumulating ring, the phase column as rendered, the door shape chosen, the UI page written, deviations, concerns — and the implementer's estimate for S39's pick screen and `newWorld({ salvage })`.

## Out of scope
The ten legends, the mage inversion, the courts' shape rules, the map's phase-two seed and names, the flood scene, the pack's contents — content rounds, S39+.
