/**
 * pnpm sideboard:show [--list kiln] [--vs k1,k2] [--shapes none] — S56: what a list's AI brings in and takes out
 * against each other list of the field (its registered fifteen, or the one the field's builder gives it).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { OPEN_DECKS, OPEN_FIELD } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { AI_SIDEBOARD_CONSTRUCTED, aiSideboard, answersCreatures, answersRelics, type AiSideboardTerms } from "./sideboard-ai.js";
import type { CardRatingTable } from "./rating.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const { shapes: _s, ...s55 } = AI_SIDEBOARD_CONSTRUCTED, terms: AiSideboardTerms = arg("shapes", "all") === "none" ? s55 : AI_SIDEBOARD_CONSTRUCTED;
const vs = arg("vs", "").split(",").filter(Boolean);
for (const key of arg("list", Object.keys(OPEN_FIELD).join(",")).split(",")) {
  const me = OPEN_DECKS[key]; if (!me) throw new Error(`sideboard:show: no list ${key}`);
  const fifteen = me.sideboard ? [...me.sideboard] : buildSideboard(me.decklist, OPEN_FORMAT, rating, pool, answersRelics, answersCreatures, !!terms.shapes);
  console.log(`\n${key} — its fifteen${me.sideboard ? " (registered)" : ""}: ${fifteen.map((e) => `${e.count} ${e.cardId}`).join(", ")}`);
  for (const o of Object.keys(OPEN_FIELD)) {
    if (o === key || (vs.length && !vs.includes(o))) continue;
    const sb = aiSideboard(me.decklist, fifteen, OPEN_DECKS[o]!.decklist, pool, rating, terms);
    const by = new Map<string, string[]>(); for (const s of sb.swaps) (by.get(s.rule) ?? by.set(s.rule, []).get(s.rule)!).push(`${s.in} for ${s.out}`);
    console.log(`  vs ${o}: ${sb.swaps.length === 0 ? "nothing" : [...by].map(([r, xs]) => `[${r}] ${xs.join("; ")}`).join("  ")}`);
  }
}
