/** Node-side: every authored list, the starters and the flood's seats read from data/world (the table itself is
 * authored-lists-core.ts — browser-safe). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authoredListsFrom, type AuthoredList, type FloodRow, type StarterRow } from "./authored-lists-core.js";
export { authoredListsFrom, type AuthoredList, type Archetype } from "./authored-lists-core.js";

export function authoredLists(root: string): AuthoredList[] {
  const starters = JSON.parse(readFileSync(join(root, "data/world/starters.json"), "utf8")) as { starters: StarterRow[] };
  const flood = JSON.parse(readFileSync(join(root, "data/world/flood.json"), "utf8")) as { decks: Record<string, FloodRow> };
  return authoredListsFrom(starters.starters, flood.decks);
}

