# Handoff — after Session 14 (2026-08-21)

## State of the world

**M6b-1 delivered: the collection is playable.** The deck editor lives at the chrome's "deck" button (map or town; disabled with the reason during encounter/duel/result/game-over): spares | deck panes of mini frames with counts, click to move a copy, an always-available basic-land row (free, infinite), live legality from `deckLegal` with the Save button disabled and the reason shown, reading aids (curve bars, colour pips, land/type tallies, search/filter/sort), an editable deck name — and **an illegal deck can never be saved** (ADR-065; the draft lives only in the screen). `world-save-v2` shipped with a migration (v1 loads with `shops`/`visits`/`lastTownIndex`/`deckName` defaulted) — I loaded my own S13 v1 autosave in the browser and it migrated live. Shop v2: rows carry stock/remaining, depletion persists and restocks on the epoch, **sell** spares at half price (never basics, never deck copies — the editor is the removal path), **"+deck"** buys straight into the deck when legal. Riders: resume-walk after a parley, the fatal label, dev-only portrait verdict buttons (→ `docs/art/art-notes.md`). And Chris's requested **beast proof of concept (ADR-066)**: catalog `kind/buyable/portraitChip`, **the Pelakka Wurm** (tier III, pilots green stompy with Pelakka Wurms — signature-card rule), bestiary-plate portrait + silhouette chip crop, reflavoured parley ("Distract" at `beastBuyOffMultiplier` × the mage price; "cannot be bought" when unbuyable). All suites green; the human half (Chris builds a deck he wants, plays it, files the felt-wrong list; S13's world notes and the portrait verdicts) is pending.

## Done this session

- **Part 1 — `world-save-v2`:** `SAVE_FORMAT` v2; `deserializeWorld` reads v1 and v2; `migrateWorld` defaults `shops: {}`, `visits: {}`, `lastTownIndex` (derived from the saved position), `deckName: "Deck"`. Tests: v2 round-trip, hand-built v1 → migrate → walk → re-save as v2; the controller acceptance loads a v1 payload. **Four fields, not three:** the brief's Part 2 asks for the deck name "in the save" — recorded as the fourth v2 field (Deviations 1).
- **Part 2 — editor:** `packages/world/src/deck-edit.ts` — `spares` (ownership − deck, basics excluded), `addCopy` (spare exists, 4-cap; basics always), `removeCopy` (drafting is free), `commitDeck` (legal + every non-basic copy owned; basics' collection counts track the deck), `deckStats` (size, lands, curve 0..7+, colours, types); `WorldController.openEditor/editorAdd/editorRemove/editorRename/editorLegality/editorSave/editorClose/canEdit`; `EditorScreen`. Frame default in the editor's mini frames is **our frame** with the printed toggle (ADR-066: hand/battlefield scale stays ours; full-size surfaces are printed).
- **Part 3 — shop v2:** `ShopItem {stock, remaining}` (1–3 copies per row per epoch, seeded), `world.shops[town] = {epoch, sold}` synced on town entry and purchase (restock when the epoch changes), `buyCard(world, town, item, knobs, toDeck)`, `sellCard` at `floor(price/2)` for spares only, town screen shows `n/n left`, sold-out rows greyed, "+deck", a sell-spares chip row; `visits` counted on entry ("First time in X." notice); `lastTownIndex` maintained.
- **Part 4 — riders:** `resumePath` kept when an encounter interrupts a walk → "Resume walk (N steps)" button re-previews the remainder; fatal result label "Your journey ends" (done in S13 round 2); dev-only portrait verdict (keep/reject) in the parley panel posting to `/__art-note` under `portrait:<slug>` — to be folded into MANIFEST when Chris rules.
- **Beast PoC (ADR-066, Chris's director ask):** catalog fields `kind`, `buyable`, `portraitChip` (validated); opponent `beast_wurm` ("the Pelakka Wurm", deck C, tier 3 journeyman, world life 14, ante 2, kind beast, buyable); knob `beastBuyOffMultiplier` (2, registry-first; doc regenerated); `buyOffPrice(knobs, tier, tmpl)`; parley refuses unbuyable beasts and prices distraction; `docs/art/subjects/beast-pelakka-wurm.md` per the bestiary prompt skeleton, rendered (full plate) + a PIL silhouette chip (82% square) — both in MANIFEST as candidates, UI copies under `/portraits/`; the map marker uses the chip; the parley shows "Distract". Browser-verified with a forced wurm encounter. **Generator untouched** (the wurm enters rosters through the existing tier tables).
- **Part 5 — acceptance (scripted):** `world-controller.test.ts` +4: editor open → remove/add/rename → below-floor draft unsaveable (deck untouched) → basics back → save → `deckName` persisted → the next duel's `MatchSpec` carries the edited deck, `canEdit` false while parleying; shop depletion visible and persisted across save/load, sell adds gold, "+deck" when legal; resume path after buy-off; v1 migration load. `world.test.ts` +5: depletion/restock/sold-out/persistence, sell rules, buy-for-deck incl. the cap fallback, v1→v2 migration + play, deck editing (spares, caps, basics, illegal commit refused, unowned refused, stats) and **the brief's proof: lose a stake → refilled basic → swap for an owned spare → legal**; beast catalog/pricing/refusal. **Browser-verified:** v1 autosave migrated live; shop v2 (stock counts, sell chips, +deck); editor (add a spare Blaze, drop a Mountain → "40 cards · 17 lands · legal" → Save → deck persisted, save v2); wurm parley.

## Director round 1 (same day)

1. **Editor frames:** printed card by default in the editor too (toggle kept), in small fixed slots (92×129) so the deck pane fits ~6 per row — ADR-066's "table scale stays ours" read as hand/battlefield only; the editor is a browsing surface. Ratify or overrule.
2. **"Where do I find the wurm?" → a prototype lair.** The generator now places ONE fixed point (`kind: "lair"`) in the wildest region — spaced from towns, carved reachable — with a resident (the catalog's first beast, else its highest-tier opponent) held out of the roaming roster (`OpponentInstance.fixedAt`). Walking onto the lair is a **certain** encounter with the resident until they are defeated; a cleared lair is ground. Map: red-ringed crag glyph with a hover label ("Lair of the Pelakka Wurm"), greyed when cleared; rail panel "Lairs" with status. Generator invariant test extended (every seed has one reachable lair; residents never roam; cleared lairs don't trigger). This is the fixed-point shape strongholds/dungeons will reuse (ADR-066's wurm now has an address). **Generator/catalog touch, director-directed — flag for the design round**; prior parts of generation are unchanged (the lair draws come last, so seed 7's map is identical to S13's).

## Director round 2 (same day; Chris away — background additions)

1. **Draggable floating card inspector** (`FloatingCardInspector`) for the world's browsing screens: hover any card in the **editor**, **shop** (stock and sell chips), or **collection** to see it full size; printed by default with the our-frame toggle; position remembered (`shandalar-world-inspector-pos`), collapsible; defaults to the lower right. Chris's ask.
2. **Editor "Reset"** — discard draft changes back to the saved deck and name (tested).
3. **Lairs panel rows are clickable** — on the map, a click previews the path to the lair (click the destination again to walk).

## Director round 2b — background: `pnpm world-sim` (headless journey tour)

`packages/world/src/world-sim-cli.ts` (CLI-only; the world runtime never imports agents): tours N seeded worlds — town→town→lair, fight every encounter with an AI-piloted starter, apply consequences — and reports what the knobs produce. **Baseline, 30 seeds, deck A, journeyman pilot, standard knobs:** steps/tour ≈ 100; encounters per 100 steps **civilized 3.5 · approach 8.5 · wild 17.3** (wild includes the lair's certain fight); duel win rate by enemy tier **76% / 55% / 34%**; 0 deaths in 30 tours but **mean world life at end 6.8 of 10** (≈3 losses per tour) and a slight ante bleed (won 130 / lost 148 — tier-3 ante-2 losses hurt); mean gold +97 (rewards outpace a non-spending tour). Read: the danger gradient is real and steep (a starter deck hits a wall at tier 3), one tour costs a third of your life at `lifeFloor 0` — the doom-spiral question is quantified for the knob round, and the tier-1 4–6 life idea can be measured here with a catalog tweak. Flags: `--seeds --deck --difficulty --player`.

## Deviations from the brief

1. **`deckName` is a fourth v2 field** (the brief's Part 2 asks for it "in the save"; Part 1 listed three). Cosmetic; flagged.
2. **Beast PoC touched the catalog** (new optional fields + one entry) and added a knob — director-requested; the generator was not changed.
3. **Shop rows roll 1–3 copies** (seeded) rather than a flat count — "implementer proposes"; a `shopRowCopies` knob is the obvious follow-up if Chris wants it tunable.
4. **Editor frames are our frame** by default (ADR-066 table scale); full-size screens are printed.

## Concerns

1. **What the editor wanted that the collection model didn't give it:** nothing structural — `cardId → count` + decklist + `deckLegal` was enough. Two small wants: (a) a per-card "acquired from" provenance (manifest §2 mentions it; the model has none) for sorting "new since last visit"; (b) a stable card ordering key (I sort by mana value/name; a curated `sortKey` would let the editor mirror the gallery).
2. **Sell pricing / depletion feel:** half price and 1–3 copies per row are guesses; Chris's shop verdicts are the tuning input. Selling a card you later want back costs the full price — by design (no buy-back).
3. **Multiple saved decks (report, don't build):** cost ≈ `decks: Record<name, Decklist>` + `activeDeckName` in a `v3` (+migration), the editor gains a deck picker and "new/duplicate/delete", the duel seam reads the active one, and `spares` must subtract only the *active* deck (or all decks — a rule to decide). About a third of this session's editor work; no engine or contract impact.
4. **The beast roster is one entry**, so the wurm appears only when a region's tier-3 roll picks it (~1 in 6 tier-3 slots). A content session can add more beasts cheaply now: one catalog row + one subject file + one render + a chip crop each.
5. **Portrait verdicts** capture to art-notes, not MANIFEST — I fold them into MANIFEST when Chris rules (the dev endpoint can't edit the ledger safely).
6. **ADR-058 wording was stomped a third time** by the planner's `decisions.md` overwrite; re-applied. The process note in ADR-063 isn't yet biting — suggest the planner diff against HEAD before replacing the file.

## Registry entries added/changed

None (no rules, no cards). Knobs: `beastBuyOffMultiplier` (docs/knobs.md regenerated, test-pinned). Catalog: `beast_wurm` + fields. MANIFEST: two wurm rows (plate + chip).

## Test status

Default tier: **195 passed | 2 skipped (197), ~11s** (+5 world tests, +4 controller acceptance). FUZZ_FULL: **197 passed (197), exit 0**. Typecheck clean. Browser-verified per Part 5.

## Suggested next

1. **Chris builds a deck he wants and plays it** — the editor's usability verdict, the shop knobs, the S13 world notes, and the portrait verdicts (five mages + the wurm) all land in one play session.
2. Then per the roadmap: the **tutor card half-session** (Growth, Demonic Tutor amendment, Lotus), the **M6b world-design round** (ADR-064 backlog + more beasts now that the pipeline is proven), clock consumers/sieges, dungeons/strongholds/bosses.

## How to run

```
pnpm viewer                 # /world → chrome "deck" for the editor; towns for shop v2
pnpm test                   # default tier
FUZZ_FULL=1 pnpm test       # full tier
pnpm knobs:doc              # regenerate docs/knobs.md
```
