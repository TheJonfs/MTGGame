/**
 * pnpm sideboard:show [--format peasant] [--list kiln] [--vs k1,k2] [--shapes none] — S56: what a list's AI brings in and takes out
 * against each other list of the field (its registered fifteen, or the one the field's builder gives it).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { FORMAT_DECKS, FORMAT_FIELD } from "@shandalar/sim/open-decks";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { aiSideboard, answersCreatures, answersRelics, sideboardTermsFor, type AiSideboardTerms } from "./sideboard-ai.js";
import { formatView, type CardRatingTable } from "./rating.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const rating0 = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
// S62 (ADR-176): `--format <id>` — that format's lists, rule and shape scale (default: the Open)
const FORMAT_ID = arg("format", "open"), rating = formatView(rating0, arg("format", "open")), OPEN_FORMAT = CONSTRUCTED_FORMATS.find((f) => f.id === FORMAT_ID)!, OPEN_DECKS = FORMAT_DECKS[FORMAT_ID]!, OPEN_FIELD = FORMAT_FIELD[FORMAT_ID]!;
if (!OPEN_DECKS) throw new Error(`sideboard:show --format: no format ${FORMAT_ID}`);
const FORMAT_TERMS = sideboardTermsFor(FORMAT_ID), { shapes: _s, ...s55 } = FORMAT_TERMS, terms0: AiSideboardTerms = arg("shapes", "all") === "none" ? s55 : FORMAT_TERMS;
// S61: `--out61 small,graveyard` — the out-rule on trial
const out61 = arg("out61", "").split(",").filter(Boolean), terms: AiSideboardTerms = out61.length ? { ...terms0, out61: { small: out61.includes("small"), spells: out61.includes("spells"), graveyard: out61.includes("graveyard") } } : terms0;
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
