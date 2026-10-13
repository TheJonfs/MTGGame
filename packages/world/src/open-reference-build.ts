/** S58 (ADR-169): the generated reference's text from the COMMITTED sources — what the sync test compares with docs/reference/open-lists.md. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { PLANS } from "@shandalar/agents";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { OPEN_AMENDMENTS, OPEN_REVISIONS } from "@shandalar/sim/open-lists";
import { OPEN_MEANS } from "./constructed-builder.js";
import { OPEN_FORMAT } from "./formats.js";
import { existsSync } from "node:fs";
import { renderOpenListsReference, type OpenReferenceInput } from "./open-reference.js";
import { SIDEBOARD_GUIDES } from "./sideboard-guides.generated.js";

/** S59: the matches table (when recorded) and the guides, for both writers of the reference. */
export function openReferenceExtras(root: string, guides: OpenReferenceInput["guides"] = SIDEBOARD_GUIDES): Pick<OpenReferenceInput, "matches" | "guides"> {
  const f = join(root, "data/convocation/formats/open/matches.json");
  return { guides, ...(existsSync(f) ? { matches: JSON.parse(readFileSync(f, "utf8")) as NonNullable<OpenReferenceInput["matches"]> } : {}) };
}

export function buildOpenReference(root: string): string {
  const pool = loadCardPool(join(root, "data/cards")).cards;
  const file = JSON.parse(readFileSync(join(root, "data/convocation/formats/open/contributed.json"), "utf8")) as { archived?: Record<string, string>; lists: { key: string; source?: string; revisions?: { session: string; note: string }[] }[] };
  return renderOpenListsReference({ lists: Object.values(OPEN_DECKS), cards: pool, plans: PLANS, archived: file.archived ?? {}, means: OPEN_MEANS, amendments: OPEN_AMENDMENTS, revisions: OPEN_REVISIONS, contributed: Object.fromEntries(file.lists.map((c) => [c.key, c])), ...openReferenceExtras(root) }, OPEN_FORMAT.rule.restricted ?? []) + "\n";
}
