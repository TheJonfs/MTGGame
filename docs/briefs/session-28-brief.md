# Session 28 brief — the Heart's roots, the legacy's flags, five one-drops

*Planner → Implementer. 2026-09-04. Follows handoff.md (after S27). Reference files in force: cards.md (173), enemies.md.*

## Where we are

v1 shipped and Chris has finished a clean, debug-free run from black. Verdicts that shape this session:

- The Manafleur, met by a tuned end-game deck (four basics in play, Moxen + Lotus, ~30 cards), was a curb stomp *for the player*. The heart-sim references (seven stock decks at journeyman, 16 life) measured the wrong opponent. The Heart gets roots.
- The legacy should be **five flags**, not a ledger. A second road from the same colour must not compound rewards.
- The powers: Chris pursued none in this run and still won; that's fine, they stay as authored.
- The mages are the oldest content in the game and read as such (fifteen names, five decks). The cleansheet is **Session 29**, not this one.
- Five new one-drops enter the pool. Zero-to-small engine work.

Process rules unchanged: decisions.md is append-only (appends below go to `docs/decision-updates/s28.md`); fuzz before fixtures; every AI change carries a ladder delta or reverts; no card facts from memory — the five cards below are Scryfall-verified by the planner, encode the text as given.

---

## Part 0 — ADR appends (docs/decision-updates/s28.md)

**ADR-095 — The legacy is five flags.** A cutting sets its starting colour's flag; a repeated colour sets nothing further. Carryover at new-game is the union of set flags: each cut colour's power, its guardian's card (site pre-cleared), its lord's complement minister, and `legacyGoldPerCutting` × *number of set flags*. The Chronicle still records every cutting as an entry with its honest ordinal — it is a record, not the reward source. The fifth-cutting line fires when the fifth *flag* sets, not the fifth entry. Rationale: Chris's stated intent; each colour "turns its reward on" for future roads.

**ADR-096 — The Heart's roots.** The Manafleur begins the Heart duel with one basic land of each type on the battlefield (its side only), untapped. The five basics leave the sixty; five defensive one-per-colour slots replace them — Disenchant, Counterspell, Doom Blade, Lightning Bolt, Prey Upon (Chris's five; Part 2b). `heartLife` stays 35/30/40 pending the sim. Rationale: the existing entrance (signature in opening hand) plus five colours on the table makes a turn-one flower *certain*, which is the final-boss opening Chris wants; it also answers the jam (the 20–34% of games where the flower never bloomed) without smoothing the sixty's greed, which is its character.

**ADR-097 — The withheld minister pays double the purse.** Ratified as implemented in S27. No separate knob. (This case arises on *every* second road, since each cutting carries a complement minister — it is not the same-colour case ADR-095 addresses.)

**ADR-098 — Five one-drops (pool 173 → 178).** Unearth, Brainstorm, Orcish Lumberjack, Spirit Link, Birds of Paradise — first printings. Chris's cycle; theme: one-drops that widen the decision space (a reanimator, a cantrip, a ritual, an aura that reads as removal on the wrong creature, a fixer). Tiers and bills in Part 3.

**Director smalls closed:** the black petal's purple-grey stands (Chris: strong without over-saturating; will re-read at the Corolla). Profile export still untested by Chris — leave it.

---

## Part 1 — Legacy: set semantics

**Change:** `recordCutting` / `legacyCarry` / `applyLegacy` derive everything from `cutColors` (the set), never from the chronicle length. Gold = `legacyGoldPerCutting * cutColors.size`. The "fifth cutting" trigger = `cutColors.size === 5` on the cutting that set the fifth flag. `migrateLegacy` must be idempotent for saves that already hold a duplicate-colour chronicle: recompute from the set, do not re-pay.

**Tests (scripted):**
1. Two cuttings from black → carryover equals one cutting from black exactly (power, guardian card, minister, +50 gold, not +100). Chronicle shows two entries.
2. Black then red → union; +100.
3. Five distinct colours across six cuttings (one repeat) → the fifth-flag line fires once, on the cutting that set the fifth flag, not on the sixth.
4. `migrateLegacy` on a v7 save with a repeated-colour chronicle yields the set-derived carry.

**Text:** if the Chronicle currently says anything that implies compounding on a repeated colour, the planner will amend the line — flag any such string in the handoff rather than rewriting it.

---

## Part 2 — The Heart's roots + the sixty + heart-sim

### 2a. The entrance
`applyHeartDuel` (R-090): after mulligans, before turn one, put Plains, Island, Swamp, Mountain, Forest onto the battlefield under the Manafleur's control, untapped. The lord's `startsInHand` entrance stays in force for the Heart. Vocabulary is paid for: the court laws' "begin with X in play" (symmetric) and the player's manalink basics (one-sided) — reuse the one-sided path. Logged, deterministic, replay-clean like the lord's entrance. The rail should show the five roots the way it shows the player's manalink basics (kind-aware, per S25).

**Expected consequence, by design:** on its first turn the Manafleur has WUBRG available and the card in hand → cast → the Intake copy at its first end step. The player's creatures enter tapped from turn one. The Tithe follows a round later. Confirm in the fuzz that this is what happens ≥95% of games (the remaining cases: mulligan to a hand the AI keeps but misplays, or the AI's cast heuristic hesitating — if the master ever *declines* to cast a turn-one Manafleur with the mana up, that's a bug, fix it).

### 2b. The sixty (amendment for enemies.md)
Remove: 1 Plains, 1 Island, 1 Swamp, 1 Mountain, 1 Forest → 20 lands (ten ABU duals, ten Ravnica duals) + five Moxen.

Add five action slots — **Chris's five, one per colour, all defensive** (the flower's job is to buy time for the petals, not to race):
- Disenchant (W) — the counter-answer to Control Magic and Pacifism *on the flower*. **AI guard:** the AI must never target a law with Disenchant (its own or otherwise) — the `law: true` flag should already exclude laws from the AI's removal targeting; verify.
- Counterspell (U) — protects the flower on the stack and stops Control Magic before it resolves.
- Doom Blade (B) — nonblack only; fine, the player's threats are mostly not black.
- Lightning Bolt (R)
- Prey Upon (G) — a 7/7 that fights is removal; the AI should reach for this when the flower is on the table and the player's best creature has toughness ≤7 (and the flower survives the exchange).

**Swap candidates** only if the sim says the deck screws or floods with this exact five: Restoration Angel, Man-o'-War, Wrath of God. Do not swap on "win rate" alone — report and let the planner take it to Chris.

### 2c. heart-sim: the end-game reference
Add reference **`chris-road-B`** — Chris's actual final-fight deck, reconstructed, 30 cards:

```
2 Badlands · 2 Plateau · 1 Scrubland
1 Mox Jet · 1 Mox Ruby · 1 Mox Pearl · 1 Mox Emerald · 1 Mox Sapphire · 1 Black Lotus
2 Lightning Bolt · 1 Abrade · 2 Blaze · 2 Vindicate
1 Thundersnake · 1 The Ruby Tyrant · 1 Restoration Angel · 2 Serra Angel
1 The Jet Witch · 2 Vampire Nighthawk · 1 The Usher · 1 The Stoker
1 Lumen, the Hearth Fire · 1 Clio, Lady of the Depths
```
Entrance: Plains, Island, Swamp, Mountain in play (no Forest). Starting life 17. Drive it with the **master** profile — the AI will play it worse than Chris did, which is the honest direction of error. If any card in the reconstruction fails validation against the pool, substitute the nearest pool card and note it in the handoff.

**Matrix** (30 games per cell minimum; more if the variance is wide):
- the sixty with roots × {20 lands / 18 lands} × `heartLife` {35, 40, 45}
- vs `chris-road-B` and the seven stock references
- report: kill rate, turn-one-flower rate, mean turns, the *petal at which the player died* (histogram — Intake/Tithe/Toll/Season/Barrage/none), and whether the player's deck ever removed the flower and by what

**Read we're after:** against `chris-road-B` the Manafleur should win a clear majority but not all — Chris's phrase is "properly difficult," and the fight should live in the petals (deaths spread across Tithe → Barrage, not a wall at Intake). Against the stock references it may win nearly always; that's acceptable, they're not the end-game. Recommend a `heartLife` from the table; don't silently change it — the planner takes the number to Chris.

### 2d. Do not touch
The Manafleur-aware master stays on the shelf unless the sim shows the fight passive *with* roots (the flower on the table, the AI not attacking into an open board). If it does, describe the read; don't build it this session.

---

## Part 3 — Five one-drops (pool 173 → 178)

All five verified on Scryfall by the planner on 2026-09-04. Encode the Oracle text exactly. Tiers by analogy with the pool's existing one-drops (tier 1 / 8 gold: Llanowar Elves, Curiosity, Savannah Lions; tier 2 / 12 gold: Dark Ritual, Duress).

| Card | Cost | Type | Text | Tier / price | Engine bill |
|---|---|---|---|---|---|
| **Unearth** | {B} | Sorcery | Return target creature card with mana value 3 or less from your graveyard to the battlefield. Cycling {2} | 2 / 12 | Zombify's effect + an MV≤3 predicate on the graveyard target (new predicate only if MV isn't already one — Graceful Restoration filters by power, so the shape exists) + cycling (Barren Moor). ~0–½ word. |
| **Brainstorm** | {U} | Instant | Draw three cards, then put two cards from your hand on top of your library in any order. | 2 / 12 | Draw-N exists. "Put cards from hand on top in any order" is likely **one new word**: a choose-N-from-hand step with ordering. Temporal Spring puts a *permanent* on top; the hand-source and the ordering UI are the new parts. Player UI: pick two, then order (default: pick order = top-first; a single "which goes on top" toggle is enough). |
| **Orcish Lumberjack** | {R} | Creature — Orc 1/1 | {T}, Sacrifice a Forest: Add three mana in any combination of {R} and/or {G}. | 1 / 8 | Sacrifice-a-permanent-of-type as a cost (do we have "sacrifice a [type]" as a *cost*? Lotus sacrifices itself; if sacrificing another permanent of a named type as a cost is new, it's the one word here). Mana: two-colour combination choice — Lotus has "any one colour"; the combination picker is a small UI extension. Note it's a red card that wants Forests: an RG incentive in red's skin, consistent with the multi-colour push. |
| **Spirit Link** | {W} | Enchantment — Aura | Enchant creature. Whenever enchanted creature deals damage, you gain that much life. | 1 / 8 | Curiosity's trigger shape (enchanted creature deals damage) minus the "to an opponent" clause, gaining life equal to the damage. Triggered, goes on the stack (not lifelink; see the Scryfall ruling — if the enchanted creature's damage kills you simultaneously, you lose before the gain). Enchant *any* creature — the opponent's is the point. ~0 words. |
| **Birds of Paradise** | {G} | Creature — Bird 0/1, Flying | {T}: Add one mana of any color. | 2 / 12 | Llanowar's tap-for-mana + Lotus's any-one-colour choice. 0 words. |

**Rulings to encode (planner; ⚠ one for Chris):**
- **Ratified (Chris):** manalink basics are real permanents in a duel. Orcish Lumberjack can sacrifice a manalink Forest; it returns next duel like any manalink.
- prizeOnly is not set on any of the five. All five are kindling and stakes like any tier-1/2 card.

**AI notes (journeyman/master; each carries a ladder delta or reverts):**
- Unearth: cast when the best MV≤3 creature in the yard is worth more than the card; cycle when there's no target and it holds ≥3 mana spare. Never cycle turn one with a target in the yard.
- Brainstorm: cast at instant speed end of the opponent's turn or in response; put back the two lowest-valued cards, lands first if it has ≥4 lands in play and hand. (This is a heuristic, not Legacy-grade Brainstorm; that's fine.)
- Lumberjack: activate only when the resulting mana casts a spell it otherwise couldn't this turn; never sacrifice its last Forest if it holds a green card and no other green source.
- Spirit Link: default — enchant its own best evasive creature. **Neutralizer line (Chris):** when the opponent's biggest creature has greater power than the AI's biggest, enchant the opponent's creature instead (the damage it deals heals the AI). Keep the rule simple and legible; this is a first step toward cleverer lines, not the last.
- Birds: play turn one on curve; tap for the colour it's short.

**Decklists:** no enemy list changes this session beyond the Heart (Part 2b). The starters do **not** gain these cards — they're shop finds. (The mage cleansheet in S29 will place them.)

**Reference regen:** `pnpm reference` → cards.md (178) and enemies.md (the Heart's sixty). Return both.

---

## Part 4 — Director round (Chris, mid-session or after)

1. **Black's unconditional removal.** Chris's own note: black cannot touch the Manafleur (Terror, Doom Blade, Nekrataal all say nonblack), which is old-school black's identity doing real work and pushes players toward a second colour — and he'd consider *one* unconditional black answer that doesn't require Tendrils at seven Swamps. Two classical shapes for reaction, ⚠ texts to verify before any encoding: **Diabolic Edict** ({1}{B} instant, target player sacrifices a creature — dodgeable by a chump, so it's an *answer to a lone 7/7* rather than clean removal; the edict word may be new) or **Murder** ({1}{B}{B} instant, destroy target creature — clean, but 2011, not classical). Planner's lean: Edict — it keeps black's identity (you can't *destroy* it, you can only make its owner give it up) and the Manafleur usually stands alone. Not for this session unless Chris rules now.
2. `heartLife` — the number, from the 2c table.

---

## Verification & handoff expectations

- Fuzz the Heart with roots before any fixture; then fixtures for: turn-one flower, the AI casting with five roots and no other land, Disenchant never targeting a law, Lumberjack on a manalink Forest (and its return next duel), Spirit Link on an opposing creature (the AI's gain, not the owner's) and its trigger ordering (stack, not static), Prey Upon with the flower as the fighter, Brainstorm's put-back with fewer than two cards in hand (put back what you have — CR 701.? not needed; just don't crash).
- Ladder deltas for every AI change in Part 3, apprentice/journeyman/master.
- Legacy tests (Part 1) green; `migrateLegacy` exercised on a duplicate-colour chronicle.
- Handoff as `handoff-s28.md`: the heart-sim table in full, deviations, concerns, the registry section (173→178), knobs regenerated, and any Chronicle/world-text strings that need the planner's pen.

## Out of scope (S29+)
The mage cleansheet (15 decks: five mono tier-1, five flowing-pair tier-2, five upgraded flowing-pair tier-3, portraits retained). Phase two. The deckbuilder for single-game mode. Ascension modes, the Wild Bloom, the R-economy, Unearth-the-mechanic, the Jund card.
