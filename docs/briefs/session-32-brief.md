# Session 32 brief — the Escort, the Edict, the last list turns, and the tier yardstick

*Planner → Implementer. 2026-09-07. Follows the running handoff.md (after S31). Process rules unchanged: appends to `docs/decision-updates/s32.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts; re-verify every card text by curl before encoding.*

## Rulings (Chris / planner, 2026-09-07)
- **Deviation 1 ratified** (the search-to-graveyard chooser; `reanimationWorth` as the one valuation) — correctness, not tuning. **The Artisan at 100g by the R formula stands.**
- **ADR-109 — Plumecreed Escort and Diabolic Edict enter the pool (192 → 194).** The Escort is blue's missing two-drop: a flash flier that lets blue hold up its instants and answers a removal spell on a key creature; chosen over Mischievous Mystic and Kitesail Corsair (Chris's three candidates). The Edict closes the S28 black-removal question the way that keeps black's identity — you cannot destroy the flower, you can make its owner give it up — and is the classical answer to a lone Artisan; it rides S31's edict word.
- **ADR-110 — Four lists and two starters turn once more** (Parts 3–4). Tessaly gains power under the anchor; Corvane gets his Rituals back; Dawn Levy slows a step; Tidal Grimoire gets bodies that close.
- **ADR-111 — Tiers 2–3 are read against mid-road references, not starters.** Part 5's headline (tier-3 masters losing to journeyman starters in 17 of 25 cells) is consistent with the world — the real tier-3 opponent has manalinks, life and shop cards and plays better than journeyman, so the gap is wider than the sweep shows — and the lever, if one is pulled, is tier life (worldcraft), not the lists. No knob moves this session; the yardstick gets built first (Part 6).
- **CLAUDE.md**: `data/art/real/` is tracked. Amend the two lines (Part 7).

---

## Part 1 — Plumecreed Escort (verified on Scryfall 2026-09-07)

{1}{U} Creature — Bird Scout, 2/1. *Flash. Flying. When this creature enters, target creature you control gains hexproof until end of turn.* Bloomburrow.

- **Tier 1 / 12.** Not prizeOnly.
- **Words:** flash and flying exist; the ETB is a *keyword grant until end of turn* on a targeted creature you control — Giant Growth's until-end-of-turn duration with a keyword instead of a pump. If the engine has no timed keyword grant, this is the one small word (Rancor grants permanently; check whether the duration path is shared). It may target the Escort itself.
- **AI (each pinned; ladder delta):** the Escort is an instant, not a creature spell — cast at the opponent's end step by default (book 36's cantrip window); **in response to a removal spell or aura targeting our creature, flash it in targeting that creature** (the counterspell-response path with a creature-save payoff); on our own turn only when nothing else uses the mana. Never target the opponent's creature (illegal anyway).
- **Fixtures:** the save (a Bolt on a Crab fizzles when the Escort resolves first); Pacifism on a hexproofed creature fizzles; the grant ends at cleanup; the Escort saving itself from a Shock in response; flash at the end step.

## Part 2 — Diabolic Edict ⚠ (verify)

{1}{B} Instant. *Target player sacrifices a creature.* Tempest.

- **Tier 2 / 16.** Not prizeOnly. Zero words: S31's edict sacrifice at `count 1, predicate creature`, on a targeted player.
- **AI:** cast when the opponent's board is one creature (or one that matters and the rest are tokens — the opponent's choice picks the token, so the AI values the Edict by the *least* creature the opponent would give up, not the best); as the defender the existing chooser (tokens first). Pin: it does not Edict into a board of a 5/5 and two Goblin tokens.
- **Fixtures:** one creature; no creatures (no effect); the defender's pick.

## Part 3 — Lists amended (final)

**Tessaly Reed (T1, U)** — 16 Island · 2 Evolving Wilds
```
4 Hedron Crab · 4 Cathartic Adept · 3 Traumatizer · 2 Plumecreed Escort · 2 Thought Scour · 2 Brainstorm
2 Essence Scatter · 1 Counterspell · 2 Altar of Dementia
```
40 / 18 / 22. (−1 Wall of Air, −1 Boomerang → +2 Escort.) Two-power fliers under the anchor are four cards a swing, and the Escort saves a Traumatizer from a Bolt.

**Lord Corvane (T3, WB)** — unchanged lands
```
2 Youthful Valkyrie · 2 Indulgent Aristocrat · 2 Blood Artist · 1 Terror · 2 Dark Ritual
1 Unearth · 3 Zombify · 3 Buried Alive · 1 Restoration Angel · 3 Serra Angel · 1 Artisan of Kozilek · 2 Swords to Plowshares
```
40 / 17 / 23. (−1 Gravedigger, −1 Unearth → +2 Dark Ritual.) Turn-two Buried Alive, turn-three Zombify.

**High Warden Sorrel (T3, BR)** — (−1 Terror → +1 Diabolic Edict.)

**Kessa Emberhand (T2, UR)** — (−1 Boomerang → +1 Plumecreed Escort.) Flash holds up the counters and saves a Pyromancer.

Pell, Quill, Varro, the rest: unchanged.

## Part 4 — The five roads, one more turn (ADR-106)

- **Dawn Levy**: −1 Fencing Ace, −1 Raise the Alarm → +1 Inspiring Overseer, +1 Master Decoy. (The curve rises a step; the removal count holds.)
- **Tidal Grimoire**: −1 Aether Channeler, −1 Cloudkin Seer → +2 Plumecreed Escort. (The Walls hold; the Escorts close and teach flash.)
- Others unchanged. Easy/hard deltas stay legal; report any that don't.

Planner's stop rule, for the record: if white is still over 60% against all four after this, the planner stops trimming it and takes the white road as the gentle one to Chris.

## Part 5 — Sweep
Full re-run (parts 1–5) against the S31 baseline; cast counts; **`facts.returned`** (graveyard → battlefield by card, per deck) so the reanimator decks read honestly. **Part 6: the beasts against the five starters** (each beast at its catalog life/profile; 100 games both seats) — is the part-5 gap the mage lists, or the tiers?

## Part 6 — The mid-road references (the tier yardstick)
Build two reference decks in `@shandalar/sim/road-decks` beside `chrisRoadB`, as a mid-road player would hold them, and add **part 7: every tier-2 and tier-3 mage against both**:
- **`road-mid-W`**: the (amended) Dawn Levy plus eight tier-1/2 shop cards a white player would buy (planner's pick: 2 Swords to Plowshares, 1 Glorious Anthem, 1 Serra Angel, 1 Restoration Angel, 1 Soul Warden, 1 Master Decoy, 1 Plains → 38 cards), one Plains in play at duel start (a manalink), 12 life, journeyman.
- **`road-mid-B`**: the Pallid Court plus 2 Doom Blade, 1 Hymn to Tourach, 1 Vampire Nighthawk, 1 Gravedigger, 1 Unearth, 1 Dark Ritual, 1 Swamp → 38 cards, one Swamp in play, 12 life, journeyman.
Report win rates and mean turns. This is the read the tier-life argument will be made from next session — no knob moves now.

## Part 7 — Smalls
- CLAUDE.md line 58: `data/art/real/` — Scryfall images (**tracked**; `art:fetch` adds scans, commit them with the def). Line 61: `data/art/` — images (**tracked**). Chris has the current CLAUDE.md; the implementer edits.
- The gallery's deck filter on the mages.
- A browser walk of the annihilator dialog on the human seat.

## Verification & handoff
Fuzz the amended decks and starters at the full tier before fixtures; replays byte-exact. Ladder gate + vs-random for the Escort and Edict policies. Baselines (def count, shop-tier counts). `pnpm reference`. Handoff in the running handoff.md: parts 1–7 with deltas, `returned` counts, the beasts-vs-starters table, the mid-road tables, deviations, concerns, registry (192 → 194; R-095 if the keyword grant is a word).
