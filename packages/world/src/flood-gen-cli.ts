/**
 * pnpm flood:gen — regenerate the ten lists in data/world/flood.json from docs/phase-two-legends-working.md §8
 * (S41 Concern 9: the document is the source; the JSON is generated; flood.test.ts pins them together). Only the
 * `decks[*].decklist` arrays are rewritten — the site tables are authored in the JSON. Fails loudly on an unknown
 * card name or a list that is not forty.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { parseFloodLists } from "./flood.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const idOf = new Map([...pool.values()].map((d) => [d.name, d.id]));
const lists = parseFloodLists(readFileSync(join(ROOT, "docs/phase-two-legends-working.md"), "utf8"), (n) => idOf.get(n));
const path = join(ROOT, "data/world/flood.json");
const flood = JSON.parse(readFileSync(path, "utf8")) as { decks: Record<string, { seat: string; decklist: { cardId: string; count: number }[] }>; strongholds: { lord: { key: string } }[]; courts: { minister: { key: string } }[] };
const keys = [...flood.strongholds.map((s) => s.lord.key), ...flood.courts.map((c) => c.minister.key)];
if (lists.length !== keys.length) throw new Error(`flood:gen — the document has ${lists.length} lists, the catalog ${keys.length} seats`);
let changed = 0;
lists.forEach((l, i) => {
  const deck = flood.decks[keys[i]!]!;
  if (deck.seat !== l.seat) throw new Error(`flood:gen — list ${i + 1} is "${l.seat}", the catalog expects "${deck.seat}"`);
  const n = l.decklist.reduce((m, e) => m + e.count, 0);
  if (n !== 40) throw new Error(`flood:gen — ${l.seat}: ${n} cards; a seat's list is forty`);
  if (JSON.stringify(deck.decklist) !== JSON.stringify(l.decklist)) { deck.decklist = l.decklist; changed += 1; console.log(`updated ${l.seat}`); }
});
writeFileSync(path, JSON.stringify(flood, null, 1) + "\n");
console.log(`flood:gen — ${changed} list(s) changed`);
