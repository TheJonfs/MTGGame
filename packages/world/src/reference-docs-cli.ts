/** pnpm reference — regenerate docs/reference/cards.md and docs/reference/enemies.md. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { defaultKnobs } from "./knobs.js";
import { renderCardsReference, renderEnemiesReference, type OracleText } from "./reference-docs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const knobs = defaultKnobs();
let oracle: OracleText = {};
try { oracle = JSON.parse(readFileSync(join(ROOT, "data/art/real/oracle.json"), "utf8")) as OracleText; } catch { /* no oracle file: defs' text only */ }
for (const [file, text] of [["cards.md", renderCardsReference(pool, knobs, oracle)], ["enemies.md", renderEnemiesReference(catalog, pool, knobs)]] as const) {
  const out = join(ROOT, "docs/reference", file);
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
}
