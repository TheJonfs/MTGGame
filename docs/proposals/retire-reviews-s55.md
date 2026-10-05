# The three reviews — the Larder, the Locks, the Undertow

*Implementer → Planner. 2026-10-05. ADR-156 as Chris amended it (S54 ruling 5): a list that sits in the bottom three of the Open's round-robin for three measures gets a review of why it struggles, and a recommendation — an overhaul that stays in family, or a new list.*

## The three measures

| measure | the Larder | the Locks | the Undertow |
|---|---|---|---|
| pilot 97, fourteen lists (2026-10-03) | 28% | 35% | 35% |
| pilot 99, fifteen lists (S54) | 27% | 35% | 36% |
| pilot 106, sixteen lists (S55) | 28% | 32% | 34% |

The same three each time, and no other list is under 38%. The numbers below are from the S55 run: 1,500 games a list, master pilots, registered sixties. Game lengths are in turns of the whole game (both players'), so thirteen is about seven turns each.

## Recommendations in one place

1. **The Larder: keep the list, give it a plan.** It is a reanimator deck the AI does not pilot. This is the cheapest of the three and the most likely to work, because the machinery now exists (ADR-161).
2. **The Locks: an overhaul in family.** It holds its counterspells and does little else; it needs a way to win and fewer reactive cards.
3. **The Undertow: an overhaul in family, or accept it as the field's floor.** It wins only by decking, and only against slow decks.

## The Larder — Four-Colour Reanimator

**28% against the field.** It beats only the Undertow (53%).

**What the games show:**
- **It barely plays.** 5.6 nonland spells cast a game, the lowest of the sixteen. The Locks casts 10.5.
- **Its payoffs never arrive.** Casts per copy per game: Artisan of Kozilek 0.04, Pelakka Wurm 0.05, Angel of the Ruins 0.07. Those are meant to be reanimated, not cast — but the reanimation is not happening either: Graceful Restoration 0.10, the Reeve 0.11.
- **Its acceleration sits in hand:** Dark Ritual 0.15 per copy per game.
- **It loses on the opponent's clock:** a median loss at turn 13 (about seven turns each), with 41 losses by decking itself.
- **Its mana is stretched:** 26 black pips, 12 green, 7 white, 2 blue, on 23 lands.

**Why.** This is a combo deck being piloted as midrange. The S30 rule that holds Buried Alive until a reanimation spell is in hand, and the Ritual rule that wants a card to cast this turn, both starve it — the same two rules that held the Pall to 58% before its plan.

**Recommendation: keep the list and author a plan for it** (setup: Buried Alive or Entomb putting the Artisan in the graveyard; start: Zombify, Graceful Restoration, the Reeve; fuel: Dark Ritual and the Moxen). It becomes the second combo list. If it is still under 38% with a plan, then the mana is the next suspect: cut to three colours.

One caution. With a plan the Larder also becomes a target for the fourth sideboarding rule, which already keys on its reanimation.

## The Locks — Esper Control

**32% against the field.** It beats the Larder (68%) and nothing else.

**What the games show:**
- **Its counterspells are barely cast:** Undermine 0.21 per copy per game, Counterspell 0.24, Absorb 0.34. Twelve counters in the sixty, and about three are cast in a game that lasts twenty turns.
- **Its sweeper is rare:** Wrath of God 0.25 per copy.
- **Its games are long either way:** a median win at turn 26 and a median loss at turn 20. It is not being run over; it is being ground down.
- **It has almost no way to win:** two Serra Angels, two Tidewalls and the Dredger. 75 of its losses are by decking itself.

**Why.** Two things, the first a reading I have not confirmed in the code or in replays. The AI seems to hold counter mana and then not spend it: twelve counters and three casts a game says most opposing spells pass unanswered. And the list has too few threats, so the games it stabilises it still does not finish.

**Recommendation: an overhaul in family.** Keep Esper control, cut four of the twelve counters for a real finisher package and card draw, and keep the sweepers. On the AI side, a counter rule that spends the mana on the best spell of the turn instead of waiting for a perfect one would help every control list, not only this one; that is a book of shame of its own.

## The Undertow — Simic Mill

**34% against the field.** It beats the Tally (71%), the Locks (65%), the Muster (62%) and the Larder (53%); it wins 8% against the Pall and 10% against the Hearth.

**What the games show:**
- **It wins one way:** 443 of its 509 wins are by decking the opponent.
- **Its clock is slow:** a median win at turn 22, a median loss at turn 16. Most opponents kill it six turns before it would finish.
- **Its interaction is thin and underused:** Essence Scatter 0.17 per copy per game, Counterspell 0.18, Temporal Spring 0.18.
- **Its mana is light:** 21 lands, and a splash for Clio (eight black pips).

**Why.** Milling sixty cards takes too long without protection, and the deck's defence (Tidewall, Man-o'-War, a few counters) does not hold a board against the field's aggressive and midrange lists. The loop decks make it worse: every card it mills into a Mardu graveyard is ammunition for the Usher.

**Recommendation: an overhaul in family, with one honest alternative.**
- **The overhaul:** keep mill as the win, but lean on Clio (the lock that makes mill safe: books 96–97 show the field respects her) and on blockers, and drop the weakest counters. Two more lands.
- **The alternative:** accept it as the field's floor. A field needs a weakest deck, it is a real archetype, and at 34% it is not embarrassing. If the planner would rather spend the authoring time on a new archetype, this is the one of the three I would leave alone.

## What I did not do

- I did not read these lists' games turn by turn; the diagnosis is from cast counts, game lengths and pairings. A replay study of a dozen games each would confirm the two AI claims (the Larder's unused plan, the Locks' held counters) before any authoring.
- I did not test any of the recommendations.
