import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { defaultKnobs } from "./knobs.js";
import { renderCardsReference, renderEnemiesReference, type OracleText } from "./reference-docs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("docs/reference (the standing reference; generated — principle 11)", () => {
  const pool = loadCardPool(join(ROOT, "data/cards")).cards;
  const catalog = loadCatalog(join(ROOT, "data/world"));
  const knobs = defaultKnobs();
  it("cards.md is in sync with the pool (run `pnpm reference` after a card edit)", () => {
    let oracle: OracleText = {};
    try { oracle = JSON.parse(readFileSync(join(ROOT, "data/art/real/oracle.json"), "utf8")) as OracleText; } catch { /* defs' text only */ }
    expect(readFileSync(join(ROOT, "docs/reference/cards.md"), "utf8")).toBe(renderCardsReference(pool, knobs, oracle));
  });
  it("enemies.md is in sync with the catalog and the deck tables (run `pnpm reference` after a deck, life, or knob edit)", () => {
    const text = renderEnemiesReference(catalog, pool, knobs);
    expect(readFileSync(join(ROOT, "docs/reference/enemies.md"), "utf8")).toBe(text);
    // Every enemy class is present and every decklist resolved to names (no raw ids leaked).
    for (const h of ["## Roaming opponents", "## The Mox court", "## The power-dungeon guardians", "## The stronghold lords", "## The petal courts", "## The Mirror", "## The Heart", "## The player's starters"]) expect(text).toContain(h);
    expect(text).not.toMatch(/\d+ [a-z_]+_[a-z_]+( ·|\n)/);
  });
});
