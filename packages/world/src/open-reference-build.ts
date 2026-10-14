/** S58 (ADR-169): the generated reference's text from the COMMITTED sources — what the sync test compares with docs/reference/open-lists.md. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { PLANS } from "@shandalar/agents";
import { FORMAT_DECKS, OPEN_DECKS } from "@shandalar/sim/open-decks";
import { OPEN_AMENDMENTS, OPEN_REVISIONS } from "@shandalar/sim/open-lists";
import { OPEN_MEANS } from "./constructed-builder.js";
import { CONSTRUCTED_FORMATS, OPEN_FORMAT } from "./formats.js";
import { existsSync } from "node:fs";
import { renderOpenListsReference, type OpenReferenceInput } from "./open-reference.js";
import type { OpenList } from "@shandalar/sim/open-lists";
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

/** S63 (Part 2): docs/reference/<format>-lists.md for a format with a field of its own (not the Open): its lists from
 * data/convocation/formats/<id>/lists.json, its tables (means.json, matches.json), its guides and plans. `lists`,
 * `plans`, `guides` and `means` default to the committed generated code — what the sync test compares — and the
 * generator passes its own, in-process. */
export function formatReferenceText(root: string, id: string, given: { lists?: readonly OpenList[]; plans?: OpenReferenceInput["plans"]; guides?: OpenReferenceInput["guides"]; means?: Record<string, number> } = {}): string {
  const pool = loadCardPool(join(root, "data/cards")).cards;
  const format = CONSTRUCTED_FORMATS.find((f) => f.id === id); if (!format) throw new Error(`no format ${id}`);
  const file = JSON.parse(readFileSync(join(root, `data/convocation/formats/${id}/lists.json`), "utf8")) as { archived?: Record<string, string>; lists: { key: string; source?: string; revisions?: { session: string; note: string }[] }[] };
  const m = join(root, `data/convocation/formats/${id}/matches.json`);
  return renderOpenListsReference({
    lists: given.lists ?? Object.values(FORMAT_DECKS[id] ?? {}), cards: pool, plans: given.plans ?? PLANS, archived: file.archived ?? {}, means: given.means ?? OPEN_MEANS, amendments: {}, revisions: [],
    contributed: Object.fromEntries(file.lists.map((c) => [c.key, c])), guides: given.guides ?? SIDEBOARD_GUIDES,
    ...(existsSync(m) ? { matches: JSON.parse(readFileSync(m, "utf8")) as NonNullable<OpenReferenceInput["matches"]> } : {}),
    format: { id, title: `${format.name}'s lists`, sources: `Every list lives in \`data/convocation/formats/${id}/lists.json\` (its sixty, its registered fifteen, its source and the archive), the guides beside them; the tables in \`formats/${id}/means.json\` (game one) and \`matches.json\`.` },
  }, format.rule.restricted ?? []) + "\n";
}
