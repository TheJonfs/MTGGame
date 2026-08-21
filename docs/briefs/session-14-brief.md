# Session 14 Brief — M6b-1: the deck editor + save v2

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-064..065, S12 handoff Concern 7 and S13 director round 3 item 3 (the editor's ready-made foundations), `docs/overworld-manifest-v0.3.md` §2 (deck rules). Budget a director round: the editor is a screen Chris will live in.

## Goal

The collection becomes playable: edit the active deck anywhere outside an encounter/duel, with live legality, then prove it in the world — lose an ante, swap the refilled basic for something you own, and win with the edited deck. Plus `world-save-v2` (shop depletion/sell, per-town visits, lastTownIndex) with a migration, and the S13 riders.

## Part 1 — `world-save-v2` (one migration, escalated fields only)

`shops: Record<townIndex, {epoch, sold: Record<cardId,n>}>` (depletion + restock-on-epoch), `visits: Record<townIndex, n>`, `lastTownIndex`. Migration: v1 loads with all three defaulted empty; round-trip tests both versions. No other schema change without escalation.

## Part 2 — The editor

- **Entry:** from the chrome (map or town — deliberation is clock-free by principle; disabled during encounter/parley/duel with the reason shown).
- **Layout:** two panes — owned-but-not-in-deck (the spares view: ownership minus deck counts) and the deck, both as mini frames with counts; click to move one copy either way; basics via an always-available basic-land row (infinite, never gated by collection counts).
- **Live legality:** count vs the 30-floor, per-card 4-cap (basics exempt), all from `deckLegal`; the Save button disabled with the specific reason; **an illegal deck is never saved** (ADR-065: the refill keeps decks legal at loss time; the editor cannot make them illegal).
- **Reading aids:** mana curve bar (nonland by mana value), colour pips, land count, type counts; sort/filter by colour, type, cost; search by name. Deck name editable (cosmetic, in the save).
- **Frame default** follows the pending ADR-064 ruling — ship our-frame with the printed toggle unless Chris rules otherwise in the director round.

## Part 3 — Shop v2 + buy-for-deck

Depletion (stock rows carry remaining counts; `sold` persists; restock on epoch), **sell** at `floor(price/2)` (cards in the active deck can be sold only via the editor-removal path — no selling the deck out from under itself; basics unsellable), and a **"buy → add to deck"** one-click flow when the addition is legal (otherwise buys to collection with a note).

## Part 4 — Riders

Resume-path button after a parley (re-preview the remaining path, one click to continue); game-over Continue reads "Your journey ends"; portrait verdict capture UI-side if Chris rules during the director round (kept/rejected → MANIFEST).

## Part 5 — Acceptance

Scripted: edit → save → duel with the edited deck (decklist in the MatchSpec matches the edit); illegal states unsaveable; lose-ante → refill present → editor swap → legality green; shop depletion persists across save/load and restocks at the epoch; sell adds gold and decrements collection; v1 save migrates and plays. Human: **Chris builds a deck he actually wants** from a mid-game collection, plays it, and files the felt-wrong list — the editor's usability verdict is the session's primary output, alongside his still-pending S13 world-loop notes and portrait verdicts.

## Definition of done

1. Parts 1–5; the director round folded in; all suites green both tiers; v1→v2 migration tested.
2. `handoff.md`; Concerns expected: what the editor wants that the collection model didn't give it, whether sell pricing/depletion knobs feel right, what "multiple saved decks" would cost (M6b+ candidate — report, don't build).

## Out of scope

Multiple decks, sideboards, quests/sieges/clock consumers, dungeons, new cards (the tutor half-session is next), AI work, generator changes (the ADR-064 backlog is the design round's business).

## Escalate, don't decide

Any save field beyond Part 1's three; any deck-rule change; any generator/catalog change however tempting the backlog looks.
