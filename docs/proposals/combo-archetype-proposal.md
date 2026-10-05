# Proposal — a combo archetype for the AI, and answers to the Usher loop

*Implementer → Planner, with Chris. 2026-10-05. Read beside `handoff.md` (after Session 54). Nothing here is built; it is a proposal for a decision.*

## The decision asked for

Three things, each of which can be ruled separately:

1. **A fourth AI archetype, "combo"**, and a short **plan** carried by a list as data — so the AI can pilot a combo deck, and can read an opponent's plan to play against it.
2. **Cards that answer a graveyard loop**, for sideboards. The pool has none today.
3. **The Jet Witch on a watch list** for Restricted in the Open (Chris; not ruled).

## Why now: Chris's combo list

Chris went 5–0 in the single Open with a list he calls a draft of "the most degenerate combo deck" for the field. The file is `docs/debug_logs/convocation-open-5–0.json`. It is not in the pool yet.

**The sixty:** 4 The Usher, 4 Zombify, 4 Buried Alive, 4 The Jet Witch, 4 Dark Ritual, 1 Demonic Tutor, 1 Black Lotus, 1 Mox Jet, 1 Mox Ruby, 1 Mox Pearl, 4 Vampire Nighthawk, 4 Blood Artist, 4 Typhoid Rats, 2 Tendrils of Corruption, 1 Cairnbrand, 4 Badlands, 4 Scrubland, 4 Blood Crypt, 4 Godless Shrine, 4 Barren Moor.

**The fifteen:** 4 Hymn to Tourach, 3 Hypnotic Specter, 4 Indulgent Aristocrat, 2 Tendrils of Corruption, 1 Nekrataal, 1 Drana, Kalastria Bloodchief.

### How it wins

- **The loop (book 99).** An Usher entering the battlefield returns a second Usher from a graveyard. The legend rule puts one of the two in the graveyard, and the survivor's trigger returns it again. Both Ushers see each death, so each pass drains 4. Five passes kill from 20 life.
- **The two-card kill.** Buried Alive puts Ushers in the graveyard; anything that puts one Usher onto the battlefield starts the loop.
  - Zombify (four mana, mono-black).
  - A hard-cast Usher (five mana; needs white and red). Chris: this did real work as "Zombify five through eight".
  - Cairnbrand's ability (a land: it cannot be countered or discarded).
  - Demonic Tutor finds whichever half is missing.
- **Speed.** Turn 2 with a Dark Ritual on each of the first two turns. Turn 1 with a land, the Lotus and two Rituals (or one Ritual and a Mox).
- **Three Ushers, not two.** If the opponent exiles the entering Usher in response, its trigger still returns the second, whose trigger finds the third. Chris had been burying two; three survives one Swords to Plowshares.
- **The Jet Witch** ("Pay 2 life: Draw a card") is the engine that finds the pieces. Chris: "Necropotence or Yawgmoth's Bargain on a stick".
- **The fair cards** (Nighthawk, Rats, Blood Artist, Tendrils) buy time. Chris expects to cut the Blood Artists and Rats for discard (Hymn, Specter) or more digging, and Barren Moor for basic Swamps.

## What the AI does with it today

Measured over 900 games against the fifteen Open lists, master pilots on both sides, and a second run of 450 games tracking each piece.

| | |
|---|---|
| Win rate against the field | **58%** (worst: the Wurmspeaker 40%, the Levy 43%, the Muster 47%) |
| Games in which the loop fires | **30%** — typically on the deck's own fifth or sixth turn |
| Both halves of the combo available | in 282 of 450 games, by its own turn 3 (median) |
| …and the loop actually started | in half of those, on its own turn 7 (median) |
| Buried Alive: first held → first cast | turn 1 → turn 6 (medians); never cast in a third of the games it was held |
| Zombify's targets (338 casts) | an Usher 118; a Nighthawk 96, Rats 62, a Witch 45, a Blood Artist 17 |
| Dark Ritual paid for | a Nighthawk 61, a Witch 37, Tendrils 27, Buried Alive 25, Zombify 11, an Usher 5 |
| Jet Witch | 1.55 draws a game; none at all in 58% of games |

In the AI's hands this is a midrange deck with a combo finish. A person kills on turn 2 or 3.

Two things are not established:
- **What Buried Alive fetches.** My tracker caught only the first pick. Chris suspects non-Ushers.
- **Whether Rituals are wasted.** In 53 cases no spell followed a Ritual in my tracking; I did not verify these.

One cause is known: the AI will not cast Buried Alive unless a reanimation effect is already in hand or on the battlefield (`buriedGated`, written in S30 for reanimator decks generally).

## Proposal 1 — the combo archetype and the plan

### What I recommend against: a per-deck personality

Chris asked whether to add an agent personality per combo deck ("Combo-Usher", later "Combo-X").

- Each new combo deck would need new AI code. That is the AI-side form of the single-card carve-out the project forbids for the engine.
- It teaches the AI nothing about playing *against* the deck.

### What I recommend: one archetype, and a plan as data

**A fourth archetype, `combo`**, beside aggro, midrange and control. Its rules are generic:

- **Dig** until the plan is assembled (a draw engine and tutors come before fair plays).
- **Spend acceleration and key pieces only on the plan.** A Ritual is for a plan card; a reanimation spell waits for its real target when that target is a step away.
- **Fair creatures are a stall**, not a goal.
- **Go off as soon as it can.** A later refinement: wait a turn when the opponent holds up counter mana.

**A plan on the list**, a few lines authored with the decklist. Sketch (the vocabulary is the planner's to set):

```
plan:
  setup:  Buried Alive  → put in the graveyard: The Usher ×3
  start:  Zombify on The Usher | cast The Usher | Cairnbrand on The Usher
  dig:    The Jet Witch, Demonic Tutor
  fuel:   Dark Ritual, Black Lotus, the Moxen
```

Lists are already data (`open-contributed.json`, the planner's document). This adds a field.

**The opponent reads the same plan.** Every AI seat already receives its opponent's decklist. With a plan attached it can:
- counter the setup and the start (Buried Alive, Zombify) ahead of other spells;
- hold an exile effect for the loop;
- value discard most before the turn the combo goes off;
- bring in the answers from Proposal 2 after game one.

**What a plan does not cover:** a player's home-brewed combo has no authored plan. The AI also needs to recognise loops from card data itself, as book 99 does for the Usher pair. I would keep extending that recognition, so an authored plan is a shortcut and not the only route.

### Cost, safety and measure

- **Scope:** about one session, half piloting and half playing against it.
- **Safety:** the archetype is used only by lists that declare it. Existing lists, and the ladder gate, are unaffected by construction.
- **Measure:** how often and how early the loop fires, and the win rate against the field. Today: 30% of games, own turn 5–6, 58%.
- **A needed engine rule first (handoff Concern 4):** the engine has no draw for a loop nobody can stop (CR 104.4b / 732.4). A combo-aware field makes mirrored drains likelier, and a loop that gains nothing would hang the game.

### Questions for the planner

1. Is `combo` a fourth archetype, or a flag on the existing three?
2. The plan's vocabulary: roles as above, or something leaner?
3. Who authors plans for contributed lists — Chris with the list, or the planner at review?
4. Does this list enter the Open now as a contributed list (it reached and won an Umbel), or after the archetype exists? Entered now, it plays as the 58% midrange deck above.

## Proposal 2 — answers to a graveyard loop

**Nothing in the pool exiles a card from a graveyard.** Today's only answers are a counterspell on the setup or the start, Swords to Plowshares when only two Ushers were buried, discard beforehand, or winning first.

Three shapes for the planner to choose real cards from. I name no cards and no stats here: per principle 9 they are verified against Scryfall when briefed.

- **A cheap colourless artifact that exiles a graveyard** (Chris's note). Any deck can sideboard it.
- **An instant-speed effect that exiles one card from a graveyard.** This stops the loop mid-pass: the returning trigger loses its target.
- **A counter for a triggered ability.** It answers this loop and loops not yet built.

**The field needs a fourth sideboarding rule** to bring such cards in, keyed on the opponent's list holding reanimation. That is a small addition to `sideboard-ai.ts` once a card exists; the field's sideboard builder would reserve slots for it.

## Proposal 3 — the Jet Witch on the watch list

- Chris: she is the first candidate beyond the original set for the Open's Restricted list, for the reasons Necropotence and Yawgmoth's Bargain have been restricted elsewhere. **Not ruled.**
- **A measurement is available when wanted:** this deck with four Witches against the same deck with one, on the same seeds (`pnpm card-test`'s paired method).
- **Its limit:** the AI under-uses her today (no draws in 58% of games), so the number would understate what she does for a person. It is worth more after Proposal 1.

## Where the numbers came from

Two scratch probes over `runMatch` (not committed), with results in `analysis/runs/s54/combo_*.json` and `combo2_*.json` (untracked): the list against each of the fifteen Open lists, seats alternating, 20 life, master both sides, on pilot 99.
