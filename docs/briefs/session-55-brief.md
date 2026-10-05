# Session 55 brief — combo, and the answers to it

*Planner → Implementer. 2026-10-05. Follows the running handoff.md (after S54 and the post-S54 work) and `docs/proposals/combo-archetype-proposal.md`. One session, maybe a half more; the order below matters — the draw rule first. Process rules unchanged: appends to `docs/decision-updates/s55.md`; re-verify every ⚠ real card by curl; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S54 Deviations 1–5 and the post-S54 work ratified**: Normal/Hard; master everywhere; v1.5 not adopted; books 98–99; the Hearth as the second contributed list; the take-back and the repeat (both behind their switches); Constructed sideboards; the retire count at two of three for the Larder, the Locks and the Undertow.
- **ADR-159 — The Usher's self-loop is a format matter, not an errata.** The Usher's ETB returns a creature card "from a graveyard"; with a second copy the legend rule makes a loop (book 99). It cannot occur in the campaign (one prizeOnly copy) and is left as written. **Design check for future custom legends**: an ETB that returns a creature card from a graveyard loops with a second copy of itself under the legend rule — a planner's line in the custom-card checklist.
- **ADR-160 — The Open answers combo with hate before restriction.** No restriction until the deck is measured piloted honestly against a field that boards against it (Part 4). If it then exceeds 65% against the field, **the Jet Witch is restricted first** (the draw engine — the Necropotence precedent) and **the Usher second**; errata is the last resort and not expected.
- **ADR-161 — `combo` is a fourth AI archetype**, declared by a list, with a **plan** carried as data on the list: `setup` / `start` / `dig` / `fuel` / `answers` (what an opponent should hold). Plans for contributed lists are authored by Chris with the list and reviewed by the planner; the AI keeps extending its own loop recognition (book 99's shape) so an authored plan is a shortcut, not the only route.
- **ADR-162 — Graveyard hate enters the pool (pool 244 → 246)**: Tormod's Crypt and Faerie Macabre, sideboard cards by nature; the field's fourth sideboarding rule brings them in. The planner's three calls from S54 recorded: a Constructed seat's **list drawn by strength** is field strength's lever (ADR-158 amended — the builders' noise stays, the list draw is added); the rating gets a **lower shrink target for little-seen cards** (the measured "avoided" penalty) before the next rebuild; the linkage's fence is **(a): kept cards exclude the power slot**.
- **Chris's 5–0 list enters the Open now** under ADR-156 (it won an Umbel), named ⚠ by Chris — *the Pall* is the planner's placeholder — with its plan (Part 2) and its fifteen.

## Part 1 — The mandatory-loop draw rule (first)
CR 104.4b / 732.4: a loop of mandatory actions no player can stop is a draw. Engine: a counter of stack items resolved without a change in life totals, the battlefield's object set, or any player's hand/library/graveyard *contents* (not order); at a cap (knob `loopDrawCap`, 100) the game is a draw. The series and the standings already score a draw. Fixtures: two Ushers in a mirror where the drains cancel and the only legal target is the other Usher → a draw at the cap; the Usher's own loop (drains change life) never trips it; the Altar loop (mill changes a library) never trips it; a Reassembling Skeleton returned a hundred times by hand doesn't trip it (mana is paid; the stack is between items). Fuzz before fixtures: the Usher mirror lists at the full tier, replays byte-exact.

## Part 2 — The combo archetype and the plan
- `archetype: "combo"` on a list; `plan: { setup, start, dig, fuel, answers }` on the list's data (`open-contributed.json`, the authored table, the planner's document).
- **Piloting rules** (books; each pinned): dig before fair plays while the plan is not assembled (the Witch's draw, the Tutor's pick aimed at the missing half); acceleration (Rituals, the Lotus, the Moxen) spent only on plan cards — never a Ritual into a Nighthawk when a plan card is reachable; `buriedGated` relaxed for a combo list: Buried Alive is cast when the plan's `start` is in hand *or* reachable within two draws by the deck's count; the setup's pick is the plan's (three Ushers); Zombify's target is the plan's `start` target first; go off as soon as both halves are in hand (a later refinement: wait a turn against open counter mana).
- **Playing against a plan** (the opponent reads the list's plan, as it reads the list): counters aimed at `setup` and `start` ahead of other spells; an exile effect held for the loop's trigger; discard valued most before the start's turn; the fourth sideboard rule (Part 3) keyed on the opponent's plan or on reanimation in the list.
- **The plan for the Pall** (Chris's list):
  ```
  setup:   Buried Alive → the graveyard: The Usher ×3
  start:   Zombify on The Usher | cast The Usher | Cairnbrand on The Usher
  dig:     The Jet Witch, Demonic Tutor
  fuel:    Dark Ritual, Black Lotus, the Moxen
  answers: a counter on Buried Alive or Zombify; exile the returning Usher's target; graveyard exile; discard before turn three
  ```
- Measure (Part 4) before and after: the loop fires in 30% of games on the deck's turn 5–6 today; 58% against the field.

## Part 3 — Graveyard hate and the fourth sideboard rule
| card ⚠ | text as the planner has it ⚠ | tier | words |
|---|---|---|---|
| Tormod's Crypt (The Dark) | {0} Artifact. {T}, Sacrifice Tormod's Crypt: Exile all cards from target player's graveyard. | 2 | exile a whole graveyard (one small word); the Lotus's sacrifice cost |
| Faerie Macabre (Shadowmoor) | ⚠ **the Oracle by curl** — a black creature (the planner does not trust its memory of the cost or body); the ability as remembered: Discard Faerie Macabre: Exile up to two target cards from graveyards. | 2 | a discard-self cost from the hand (the Arc Mage's discard as a cost, on the card itself; an ability usable from the hand — a zone the enumerator must offer); up-to-two targets across graveyards |
Both are **sideboard cards by nature**; the field's builder never mains them. **The fourth sideboarding rule**: graveyard exile comes in against a list whose plan has a `setup` in the graveyard or whose list holds reanimation (Zombify, Unearth, Buried Alive, Entomb, the Reeve, Cairnbrand, the Usher ×2+); the AI holds the Crypt for the setup's resolution and the Macabre for the loop's trigger (a stack-aware use: respond to the returning trigger by exiling its target). Pinned.

## Part 4 — Measure
- The Pall piloted by the combo archetype against the fifteen (now sixteen) Open lists, the field boarding by the fourth rule: the loop's rate and turn, the win rate against the field, Buried Alive's picks, the Rituals' spending. The read: over 65% → the Witch's restriction is proposed (ADR-160); 50–65% → the format has a deck to beat and an answer; under 50% → the archetype needs work before the format does.
- The field's list draw by strength (ADR-158 amended) in `convocation-sim --events 8`: the Umbel's mean percentile and r (was 61st, −0.25).
- The Witch at four vs one (`card-test`'s paired method, the Pall as host) — the number ADR-160 will read, noting the pilot's limit.
- The Open's round-robin with sixteen lists (the retire count's third measure — the three lists' deep-dive reviews if they stay in the bottom three; the planner's).

## Part 5 — Text
- The hate cards need no world text. The Pall's name ⚠ Chris. The combo list's parley/plan is data, not prose.

## Handoff
The draw rule; the archetype and its books; the two cards and the fourth rule; the Pall in the Open with its plan; the four measures; deviations, concerns — and the restriction proposal if Part 4's first number calls for it (ADR-160), which the planner takes to Chris.
