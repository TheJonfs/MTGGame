# Session 18 Brief (v2) — the Bestiary (+ carried riders)

*Supersedes the pre-S17 draft. Changes from v1: ADR-077 added to read-first; Gaean Wurm art-candidates item struck (done in the S17 post-close round); new rider for the S17 request-purpose dialogs; deck-reconciliation and cost-shift context added so world-sim results read correctly.*

Read first: `CLAUDE.md`, `handoff.md` (S17's), ADR-069..**077**, `docs/expansion-1-cards-and-decks.md` (decklists — **beast decks are 30 cards per ADR-077**; the ADR-074 "40" is amended), `docs/prompts/portraits.md` bestiary section, `docs/world-catalog-content.md`. Budget a director round (renders, names, starter re-sim verdicts, Serra petition question, new-dialog review).

**Context that shapes how you read results this session:**
- The nine Scryfall corrections shifted beast curves (Mother Bear's ability is five mana; Mist Raven is a double-blue four-drop; Bouncer/Blood Artist/Scepter +1 each). Decklists stand as encoded — **no pre-tuning happened by ruling**. If a beast deck under- or over-performs its tier in world-sim, report it with the cost shift noted as a candidate cause; the planner adjusts from your tables.
- **Warband watch item:** Skirk Prospector's mana sac is gated (S15 no-auto-pay + burst pin 12 — only when it enables a cast this step). If the Warband under-performs tier 2, this is the first suspect; report, don't loosen.
- Cycling's DISCARD firing Waste Not is correct, not a bug (ADR-077).

## Parts

1. **Riders:** fog live (blank-parchment rule incl. washes, home region pre-explored, road one-cell fog stubs per ADR-073); *Cinquefoil* title screen; starter swaps (W +Swords/−Plains, U +Man-o'-War/−Divination) with 30-seed world-sim, ≥68% tier-1 gate, escalate if still short; deck-picker polish (S16 concern 8 items).
2. **Catalog:** eleven signature opponents per the decklists doc (`kind` per entry — Tactician is a mage-voiced signature opponent; the rest beasts), region/ring bindings per colour spoke, parley voices, `buyable` flags (Warband greedy-yes; Gale no; **Serra Angel — Chris's call in the director round: can an angel be petitioned?**), tier AI profiles per ADR-074's roster.
3. **Renders:** bestiary plates + chip crops for all eleven (Tactician gets the field-guide treatment in mage voice; ADR-066 crop discipline — full-body/silhouette for beasts, a face-circle crop decapitates a wurm), MANIFEST-logged, director-round verdicts. *(Gaean Wurm candidates: struck — done post-S17, candidate 1 wired.)* Render-skill note: pass `--aspect 1:1` for card/token-class subjects; the default is now 16:9.
4. **World integration:** spawn tables by region/ring with the mage/beast ratio knob; world-sim on the full roster (steps-per-fight, ante-flow by ring, per-deck tier performance; flag skew and note cost-shift candidates per the context above).
5. **New rider — play-client dialogs:** `chooseMode`, `discardCost`, and the A7 sacrifice request currently fall through the generic dialog path (S17 concern 5). Give each a dedicated dialog on the ADR-058 local-choice + single-Confirm pattern (modal choice with labels; discard selection; sacrifice selection with the Grenade's target staged after). Chris exercises Channeler, Bouncer, and Grenade by hand in the director round and verdicts the feel.
6. **Acceptance:** scripted beast-encounter end-to-end; human — Chris meets the Warband and one tier-3, wanders fogged Cinquefoil from home, plays the new-dialog cards, verdicts everything.

## Definition of done

Riders gated and reported; catalog + decks live (30-card beast decks adopted from `packages/sim/src/expansion-decks.ts`); renders verdicted or explicitly pending Chris; world-sim tables with per-deck tier performance; dialogs shipped and director-reviewed; felt-wrong harvest. Concerns wanted: which beast decks under/over-perform their tier (feeds planner deck adjustments — cost-shift candidates flagged), spawn-mix feel, anything the Tactician's mage-voice hybrid strained, Blood Artist request chattiness if Chris feels it in play (ADR-077 watch item).

## Out of scope

Quests (S19 next), sieges, dungeons, bosses, new cards, AI evaluator work, deck tuning (planner-side, post-tables).

## Escalate, don't decide

Anything touching the reserved threads (legendary-creature identity use, boss identities), any new vocabulary need discovered mid-encode, any world-sim result that suggests a knob change (report tables; knob arguments happen planner-side), Serra petition mechanics beyond the `buyable` flag + multiplier shape.
