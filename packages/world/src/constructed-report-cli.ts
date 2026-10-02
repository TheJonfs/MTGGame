/**
 * pnpm constructed:report [--seeds 40] [--format id]
 *
 * S52 (Part 1): the Constructed builder's per-format report — for each format, N seeded builds: how many are legal,
 * which authored list each started from, how much the repair cut and added, how many distinct decks the noise made.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { buildConstructedDeck } from "./constructed-builder.js";
import type { CardRatingTable } from "./rating.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const library = authoredLists(ROOT);
const N = Number(arg("seeds", "40")), only = arg("format", "");
const size = (l: { count: number }[]) => l.reduce((n, e) => n + e.count, 0);
console.log(`# The Constructed builder, by format (S52) — ${N} seeded builds each, from the ${library.length} authored lists\n`);
console.log(`| format | rule | legal | sizes | started from (builds) | mean cut | mean added | distinct decks |\n|---|---|---|---|---|---|---|---|`);
for (const f of CONSTRUCTED_FORMATS) {
  if (only && f.id !== only) continue;
  const builds = Array.from({ length: N }, (_, i) => buildConstructedDeck(f, rating, 5200 + i, library, cards));
  const from: Record<string, number> = {}; for (const b of builds) from[b.from] = (from[b.from] ?? 0) + 1;
  const sizes = [...new Set(builds.map((b) => size(b.deck)))].sort((a, b) => a - b).join("/");
  const bad = builds.filter((b) => !b.check.ok);
  console.log(`| ${f.name} | ${f.note} | ${builds.length - bad.length}/${N} | ${sizes} | ${Object.entries(from).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")} | ${(builds.reduce((n, b) => n + size(b.cut), 0) / N).toFixed(1)} | ${(builds.reduce((n, b) => n + size(b.added), 0) / N).toFixed(1)} | ${new Set(builds.map((b) => JSON.stringify(b.deck))).size} |`);
  for (const b of bad.slice(0, 2)) console.log(`\n> ILLEGAL (${f.id}, from ${b.from}): ${b.check.problems.join("; ")}\n`);
}
