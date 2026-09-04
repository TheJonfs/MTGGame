# docs/reference — the standing reference

What is implemented **right now**, generated from the data and the code so a fresh read never trusts a stale hand-written table. Regenerate after any card, deck, life, or knob edit:

```
pnpm reference
```

A sync test (`packages/world/src/reference-docs.test.ts`) pins both files to their renderers, the `docs/knobs.md` precedent (principle 11) — a stale reference fails `pnpm test`.

| File | What it holds | Source of truth |
|---|---|---|
| `cards.md` | The card pool: every non-token def — colour, type, cost, mana value, P/T, keywords, shop tier, price, flags (prizeOnly / custom / law), rules text (the def's `text`, else the Scryfall oracle text). | `data/cards/**/*.json`, `data/art/real/oracle.json`, the shop pricing knobs |
| `enemies.md` | Every enemy the player can meet — roaming opponents (with the deck each plays and who shares it), the Mox court, the power-dungeon guardians, the stronghold lords, the petal courts, the Mirror, the Heart — each with how its STARTING LIFE is set (knobs by name, difficulty bundles in brackets) and its decklist with cards / lands / average mana value / colours; plus the player's five starters. | `data/world/*.json` (the catalog), the sim deck tables (`packages/sim/src/*-decks.ts`, `heart-deck.ts`), `packages/world/src/knobs.ts` |

Companions that are NOT generated: `docs/knobs.md` (generated separately by `pnpm knobs:doc`), `docs/registries/pool-registry.md` (each card's status and vocabulary words — planner/implementer maintained), `docs/card-tier-audit-v2.md` (the tiering rationale), `docs/expansion-1-cards-and-decks.md`, `docs/stronghold-bosses.md`, `docs/mox-court.md`, `docs/the-bloom-gauntlet-v1.md` (the design records the decks came from).

History: `cards.md` succeeds `docs/card-price-manifest.md` (S18's price manifest with the tiering-audit column; the audit landed as `card-tier-audit-v2.md`).
