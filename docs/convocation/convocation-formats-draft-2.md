# The Convocation — formats (draft 2, Chris's rulings of 2026-09-30 applied)

*Planner, 2026-09-30. The pre-work for the tournament mode (working name: the Convocation — five colours convene; the final table's name open). A format is data: for Constructed, a `deckRule` set plus a card-pool filter and a restricted/banned list; for Limited, a set (a pool subset), a pack recipe, a pool shape and build rules. Everything here rides the door-rule engine (S37/S40), the tier structure, and the resolver's entrance vocabulary. Nothing is decided; the Open format and the tier formats are the ones I'd build first. Pool: 233 (after S45).*

---

## 0. The rule vocabulary (what a format can say)

Existing (`checkDeck` today): `colorsWithin`, `minCreatures`, `maxLands`, `maxManaValue`, `singleton`, `minCards`, `minCreaturePower`, `minLandFraction`, `bannedTypes`.

Needed for formats (small, all counts or filters on the list):
- `maxCopies` (4 by default; basics uncapped) and a **`restricted`** list (max one) and a **`banned`** list.
- `maxTier` / `minTier` (the pool's tiers as rarity: 1 common, 2 uncommon, 3 rare, R mythic-ish).
- `maxCards` (a ceiling, for the formats that want the mill-buffer question closed).
- `poolFilter` — which cards are legal at all: a set name (phase one's cards, the flood's, all), `prizeOnly` in or out, the laws out.
- **The player-pool hook**: the player's pickable pool is a subset of the AI's legal pool (the gallery's unlock rule is already this shape). Leave it as a parameter; the campaign linkage decides its value later (Chris: deferred; the construction stays).

Universal in every format below unless stated: **the five laws are banned** (not player cards until phase three); **legends are legal at four** (the legend rule caps the battlefield, not the deck); **basics uncapped**; tokens are not cards.

---

## 1. Constructed formats

### 1.1 The Open (the Vintage of the plane) — build first
- 60-card minimum, 4-of, every card in the pool legal — **prizeOnly included, for the player too** (Chris; subject to a future campaign filter).
- **Restricted (one copy)**: Black Lotus; the five Moxen; Time Walk; the five High Grounds (legendary anyway — restriction is consistency); Demonic Tutor; Library of Alexandria. **Legal and watched (Chris)**: **the Manafleur and the Cinquefont** — the two law-makers are legal; restriction or a ban if the Lab or play says so. Sacred Helix at four is fine.
- ABU duals and shocklands unrestricted (the mana is the texture; power is what's restricted).
- **The lines the pool supports** (the library's seed, ~ten): aristocrats · mill · reanimator · weenie-and-tokens · Pyromancer burn · Esper control · ramp-into-wurms · lifegain · hexproof auras · landfall. Suspects: five-colour Moxen goodstuff (tamed by the list); Pyromancer-Guttersnipe burn.

### 1.2 The tier formats — build second (cheap, and the pool's own structure)
- **Pauper** — `maxTier: 1`; 60 cards, 4-of. ~110 cards; honest creatures and spells; resists a single best deck. Lines: weenie, elves, burn, rats, skies, Crabs-and-Adepts mill.
- **Peasant** — `maxTier: 2`; adds the customs' mono anchors (Traumatizer, Gaean Wurm, the Tactician, Thundersnake, the Djinn), the shocklands, the archetype pieces. The format where the campaign's *shop* metagame lives.
- **Rare-restricted** — tier 3 and R at one copy each, everything else 4-of. A middle between Peasant and the Open.

### 1.3 The gate formats — the courts' five, as tournaments (the rules exist; the refusal lines exist)
- **Bodies** (Odile's) — `minCreatures: 12` (at 60: scale to 24, or keep 12 and let it bite less; decide by the Lab).
- **Nothing Small** (Zinnia's) — `minCreaturePower: 2`.
- **Nothing Sudden** (Ovna's) — `bannedTypes: [Instant]`.
- **Half Ground** (Isaura's) — `minLandFraction: 0.5`, **no `maxCards`** (Chris: a player adding fifty basics makes every tradeoff a larger deck makes, and the game's history calls that a construction mistake).
- **Nothing Dear** (Meliyan's) — `maxManaValue: 4`.

### 1.4 The triads — a family of ten
- `colorsWithin: <triad>` + the Open's restricted list promoted to a **banned** list (Chris). 60 cards, 4-of.
- The seed lists exist: each lord's forty is legal in its triad; each court's, mage's and beast's list fits every triad containing its colours. Two to three credible decks per triad is reachable now for most; the thin triads will name the cards the pool wants.
- Named in the plane's register by the triad's phase-one and phase-two lords (Abzan is "the Warden's colours"; Jeskai "the Bailiff's").

### 1.5 The pairs — a family of ten (optional)
- `colorsWithin: <pair>`; the mage lists are the seeds; the still pairs and the flowing pairs as two sub-families. Shallower than the triads; worth having for Pauper-pair events.

### 1.6 Singleton (the Risen Tide's spirit)
- `singleton: true` (basics excepted), 60 cards, the Open's pool. Variance as the leveller; select-and-repair produces it from any library list by de-duplication and fill.

### 1.7 Salvage Constructed (the campaign's own format)
- The pool is the fifty-five-card pack plus five picks by the Convocation's rule (one per colour, any tier below prizeOnly) plus basics; 30-card minimum (the campaign's floor), one copy each (the pack is one-ofs). A format the campaign's players already know how to build in; the AI's builder is the salvage assembler plus repair.

### 1.8 Formats to design later (need a card or a word)
- **Laws** — a format where each player begins with a law of their choice in play (the court laws' symmetric vocabulary exists; the player's laws are phase three's).
- **Manalink Constructed** — each seat begins with N basics in play by the resolver (a "Vintage-adjacent" format that plays like the campaign's endgame).

---

## 2. Limited formats

### 2.1 The set
A set is a pool subset: **the Plane** (everything below prizeOnly), **the First Bloom** (phase one's cards), **the Flood** (phase two's twenty-seven plus the pool's cards that fit the flood's lines), a **colour-pair set** (a still pair's or a flowing pair's cards — a pool small enough to draft as a two-colour format), a **tier set** (Pauper packs). Sets are lists in data; a set names its recipe.

### 2.2 The pack recipe (a knob per set)
A pack is `slots: [{ weights: { 1: w1, 2: w2, 3: w3, R: wR } }, …]`, drawn without replacement from the set, basics never in packs. Recipes to start:
- **Classic** — 15 cards: 1 × {3: 0.8, R: 0.2}, 3 × {2: 0.8, 3: 0.2}, 11 × {1: 0.75, 2: 0.25}.
- **Flat** — 15 × {1: 0.6, 2: 0.3, 3: 0.1}: a lower-power, more even pack.
- **Rich** — 15 cards: 2 rares, 4 uncommons, 9 commons: the flood's register.
- **Pauper** — 15 × {1: 1}.

### 2.3 Sealed (build first)
- Six packs (Classic) + basics; 40-card minimum; the pool is yours; one copy cap is the pool itself.
- **Variants**: *Sealed-and-a-starter* (Shandalar's own: a starter deck plus three packs — the campaign's starters as the seed, a lower-variance pool); *Sealed with a pick* (open six, then choose one card from the set — the salvage's shelf, as a tournament's first decision); *Colour-locked Sealed* (packs from a pair set — the two-colour draft's cheaper cousin).

### 2.4 Draft
- Eight seats, three packs, pick-and-pass alternating left and right; 40-card minimum from the picks plus basics.
- **Variants**: *Cube draft* (a curated set of one-ofs — the pool at one copy each is a 233-card cube, which is exactly one draft's worth: eight seats × 45 picks = 360 > 233, so a cube draft is six seats or a 2-pack draft; or the cube is doubled); *Rotisserie* (every seat picks from the whole set face-up in a snake — the AI drafter's easiest case and a strong two-player variant); *Triad draft* (the packs from a triad's cards; a three-colour format's Limited cousin); *Rich draft* (the Rich recipe; a bomb-heavy format for the Top 8).
- **The drafter's rating**: tier and price as the base; a colour-commitment bonus growing with picks; a curve term (a seat short of two-drops rates them up); a synergy term only where a line is unambiguous (Crabs with lands, Pyromancer with instants).

### 2.5 The build rules for Limited
- 40 cards, basics free, a `minLands`/`maxLands` window (16–18) the builder respects; the human is free.
- The AI builder: two colours by rated playables (a third as a splash only with fixing in the pool), a curve fill (a target histogram by mana value), seventeen lands split by pips, the Lab's stats as the check.

---

## 3. The ladder (what a format's difficulty rides on)
A Convocation is sixteen rounds by default (the Pro Tour's shape: a draft and three Limited rounds, five Constructed, a second draft and three Limited, five Constructed) and, for the top eight, three more. **The AI seats' entrance is a function of the round**, not three buckets (Chris): Day 1 (rounds 1–8) flat or nearly so; Day 2 (rounds 9–16) a linear ramp — life, then a basic in play, then a second — so round sixteen is near the lords' row; the Top 8 its own three-step progression (quarter-final, semi-final, final), the final at the court's row on a High Ground where the format allows the ground. The rows are one table in the knobs registry, `convocationEntrance[round]`, read through the resolver. The human seat never gets an entrance; the format's fairness is the pool's, the difficulty the seat's.

**The final table's name** (Chris: floral, ideally counting to eight; not petals, roots, the Corolla or the Calyx): candidates — **the Umbel** (a flower-cluster whose stalks all rise from one point: a bracket, drawn; "the Umbel of Eight"); **the Avens** (mountain avens is *Dryas octopetala* — the eight-petalled flower; "the Eight Avens"); **the Bloodroot** (eight petals, but the root word the campaign already owns); **the Cosmos** (eight petals; reads astronomical). The planner's lean: the Umbel — it is the *shape* of a Top 8, and it is a word the campaign hasn't spent.

## 4. Match play (the piece every mode shares)
Best-of-three; the loser of the previous game chooses play/draw; sideboarding between games from the seat's pool (the AI's sideboard = its unused playables; its sideboarding = shape-keyed rules: artifact/enchantment removal in against auras or laws seen, creature removal in against a creature count, counters out against creature decks). A match has a seed; the tournament has a seed; every background match draws from it.

## 5. The background tournament
Swiss pairings by record (a real standings engine); each AI-vs-AI match simulated as one best-of-three at the tournament's seed (a knob for more games and a biased coin when the standings feel arbitrary); the human's match played live with the stage's entrance on the opponent; the Top 8 as a single-elimination bracket. A hundred seats is affordable at one match each.

## 6. The seeds for the library (the pre-work after this doc)
- The Open: eight to ten lists, one per line in §1.1.
- Pauper: five or six.
- Each triad: two or three, starting from the lords' and courts' lists and the mage lists that fit.
- The gate formats: the courts' own lists are one seed each; one more per format.
Authored in documents pinned by generators (the `flood:gen` pattern), tested by Claude Code in the Lab as they're written; "solvable" has a number (one list > 65% against its format's field), and the fix is a restriction, a ban, or a card.

## 7. Open questions
- The final table's name (candidates in §3).
- Whether the campaign's collection is the Constructed pool (the world-event linkage) — deferred until the mode exists.
