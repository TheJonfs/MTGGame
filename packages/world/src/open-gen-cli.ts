/**
 * pnpm open:gen — S46 (ADR-142/143): the Open's twelve lists from the planner's document (+ the brief's amendments and
 * the Loop, declared in @shandalar/sim/open-lists) → `packages/sim/src/open-decks.ts` (committed; pinned by
 * open-lists.test.ts) and the Lab's `analysis/decks/open-<key>.json` (local). Every list is checked against the Open.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { buildLoop, seedLists, OPEN_AMENDMENTS, OPEN_REVISIONS, type OpenSeed } from "@shandalar/sim/open-lists";
import { renderOpenListsReference } from "./open-reference.js";
import { OPEN_MEANS } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";
import { OPEN_FORMAT } from "./formats.js";
import type { ComboPlan } from "@shandalar/agents";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const idOf = new Map([...pool.values()].map((d) => [d.name, d.id]));
// S58 (ADR-169): the seeds are data; the planner's document they came from is history
const lists = seedLists((JSON.parse(readFileSync(join(ROOT, "data/convocation/open-seeds.json"), "utf8")) as { seeds: OpenSeed[] }).seeds, (n) => idOf.get(n));
if (lists.length !== 11) throw new Error(`open:gen — the document has ${lists.length} lists; the Open's seed is eleven`);
lists.push(buildLoop(lists.find((l) => l.key === "coin")!, (n) => idOf.get(n)));
// Post-S53 (Chris): the lists contributed from play (data/convocation/open-contributed.json), after the twelve
const contributedFile = JSON.parse(readFileSync(join(ROOT, "data/convocation/open-contributed.json"), "utf8")) as { archived?: Record<string, string>; plans?: Record<string, Omit<ComboPlan, "key">>; sideboards?: Record<string, { cardId: string; count: number }[]>; guides?: Record<string, { in: string; n: number; out?: string[]; when: string[]; unless?: string[] }[]> };
// S56 (ADR-164): the archive — a list by key (a seed list or a contributed one) with the reason; it stays in the data
const archived = contributedFile.archived ?? {};
const contributed = (JSON.parse(readFileSync(join(ROOT, "data/convocation/open-contributed.json"), "utf8")) as { lists: { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: { cardId: string; count: number }[]; sideboard?: { cardId: string; count: number }[]; plan?: Omit<ComboPlan, "key"> }[] }).lists;
/** A registered fifteen: fifteen cards at most, and within the copy cap over the seventy-five. Null when it passes. */
function checkSideboardList(deck: { cardId: string; count: number }[], side: { cardId: string; count: number }[], rule: typeof OPEN_FORMAT.rule, cards: typeof pool): string | null {
  const n = side.reduce((a, e) => a + e.count, 0); if (n > 15) return `${n} cards`;
  const both = [...deck, ...side.filter((e) => !["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId))];
  const c = checkDeck(both, null, { ...rule, minCards: 0 } as typeof rule, cards);
  return c.ok ? null : c.problems.join("; ");
}
const plans: ComboPlan[] = [];
/** Every card a plan names is a card of the pool and of its list; a `once` plan names its pieces. */
function checkPlan(key: string, plan: Omit<ComboPlan, "key">, decklist: { cardId: string; count: number }[]): void {
  const named = [plan.piece, ...(plan.pieces ?? []), ...plan.setup.flatMap((s) => [s.card, ...s.bury.map((b) => b.card)]), ...plan.start.flatMap((s) => [s.card, s.on]), ...plan.dig, ...plan.fuel, ...plan.answers.counter];
  for (const id of named) { if (!pool.has(id)) throw new Error(`open:gen — ${key}'s plan names ${id}, not in the pool`); if (!decklist.some((e) => e.cardId === id)) throw new Error(`open:gen — ${key}'s plan names ${id}, which the list does not hold`); }
  if (plan.pieces && plan.pieces[0] !== plan.piece) throw new Error(`open:gen — ${key}'s plan: the first of its pieces is its piece`);
}
// S57 (ADR-165): a plan for a SEED list (the Larder) — the list becomes a combo list, piloted by it
for (const [key, plan] of Object.entries(contributedFile.plans ?? {})) {
  const l = lists.find((x) => x.key === key); if (!l) throw new Error(`open:gen — a plan names the list ${key}, which is not a seed list`);
  checkPlan(key, plan, l.decklist);
  (l as { archetype: string }).archetype = "combo";
  plans.push({ key, ...plan });
}
// S58 (Part 1): a registered fifteen for a SEED list (the Locks)
for (const [key, side] of Object.entries(contributedFile.sideboards ?? {})) {
  const l = lists.find((x) => x.key === key); if (!l) throw new Error(`open:gen — a sideboard names the list ${key}, which is not a seed list`);
  for (const e of side) if (!pool.has(e.cardId)) throw new Error(`open:gen — ${key}'s sideboard names ${e.cardId}, not in the pool`);
  l.sideboard = side.map((e) => ({ ...e }));
}
for (const c of contributed) {
  if (lists.some((l) => l.key === c.key)) throw new Error(`open:gen — a contributed list reuses the key ${c.key}`);
  for (const e of c.decklist) if (!pool.has(e.cardId)) throw new Error(`open:gen — ${c.key} names ${e.cardId}, not in the pool`);
  for (const e of c.sideboard ?? []) if (!pool.has(e.cardId)) throw new Error(`open:gen — ${c.key}'s sideboard names ${e.cardId}, not in the pool`);
  // S55 (ADR-161): a combo list carries its plan; every card the plan names is a card of the pool and of the list
  if ((c.archetype === "combo") !== !!c.plan) throw new Error(`open:gen — ${c.key}: a combo list carries a plan, and only a combo list does`);
  if (c.plan) {
    checkPlan(c.key, c.plan, c.decklist);
    plans.push({ key: c.key, ...c.plan });
  }
  lists.push({ key: c.key, name: c.name, title: c.title, archetype: c.archetype, decklist: c.decklist.map((e) => ({ ...e })), ...(c.sideboard ? { sideboard: c.sideboard.map((e) => ({ ...e })) } : {}) } as never);
}
for (const k of Object.keys(archived)) if (!lists.some((l) => l.key === k)) throw new Error(`open:gen — the archive names ${k}, which is not a list`);
for (const l of lists) {
  const n = l.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 60) throw new Error(`open:gen — ${l.key} has ${n} cards`);
  if (l.sideboard) { const sc = checkSideboardList(l.decklist, l.sideboard, OPEN_FORMAT.rule, pool); if (sc) throw new Error(`open:gen — ${l.key}'s fifteen: ${sc}`); }
  const c = checkDeck(l.decklist, null, OPEN_FORMAT.rule, pool);
  if (!c.ok) throw new Error(`open:gen — ${l.key} fails the Open: ${c.problems.join("; ")}`);
}
const body = lists.map((l) => `  ${l.key}: { key: ${JSON.stringify(l.key)}, name: ${JSON.stringify(l.name)}, title: ${JSON.stringify(l.title)}, archetype: ${JSON.stringify(l.archetype)}, decklist: d([${l.decklist.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])${(l as { sideboard?: { cardId: string; count: number }[] }).sideboard ? `, sideboard: d([${(l as { sideboard?: { cardId: string; count: number }[] }).sideboard!.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])` : ""}${archived[l.key] ? ", archived: true" : ""} },`).join("\n");
writeFileSync(join(ROOT, "packages/agents/src/plans.generated.ts"), `// GENERATED by \`pnpm open:gen\` from the plans in data/convocation/open-contributed.json — do not edit by hand.
import type { ComboPlan } from "./plans.js";

/** S55 (ADR-161): the plans authored with the Open's combo lists. */
export const PLANS: readonly ComboPlan[] = ${JSON.stringify(plans, null, 2)};
`);
writeFileSync(join(ROOT, "packages/sim/src/open-decks.ts"), `// GENERATED by \`pnpm open:gen\` from data/convocation/open-seeds.json + the revisions in open-lists.ts + data/convocation/open-contributed.json — do not edit by hand.
import type { OpenList, OpenDecklist } from "./open-lists.js";

const d = (pairs: [string, number][]): OpenDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

/** S46 (ADR-142/143): the Open's twelve seed lists, then (post-S53) the lists contributed from play, by key. S56 (ADR-164): an archived list stays here and is out of OPEN_FIELD. */
export const OPEN_DECKS: Record<string, OpenList> = {
${body}
};

/** S56 (ADR-164): the lists in the field — every list not archived. */
export const OPEN_FIELD: Record<string, OpenList> = Object.fromEntries(Object.entries(OPEN_DECKS).filter(([, l]) => !l.archived));
`);
mkdirSync(join(ROOT, "analysis/decks"), { recursive: true });
for (const l of lists) writeFileSync(join(ROOT, `analysis/decks/open-${l.key}.json`), JSON.stringify({ name: `open-${l.key} (${l.name})`, archetype: l.archetype, decklist: l.decklist, basedOn: "docs/convocation/convocation-open-lists-draft-2.md + S46", notes: l.title }, null, 2) + "\n");
// S58 (Part 1): the guides authored beside a registered fifteen
const SHAPES = ["creatureDeck", "fewLarge", "control", "plan", "counters", "graveyard", "relics", "small", "someGraveyard"];
const guides = Object.entries(contributedFile.guides ?? {}).map(([key, rows]) => {
  const l = lists.find((x) => x.key === key); if (!l?.sideboard) throw new Error(`open:gen — a guide names ${key}, which has no registered fifteen`);
  for (const r of rows) {
    if (!l.sideboard.some((e) => e.cardId === r.in)) throw new Error(`open:gen — ${key}'s guide brings in ${r.in}, which its fifteen does not hold`);
    for (const o of r.out ?? []) if (!l.decklist.some((e) => e.cardId === o)) throw new Error(`open:gen — ${key}'s guide takes out ${o}, which its sixty does not hold`);
    for (const w of [...r.when, ...(r.unless ?? [])]) if (!SHAPES.includes(w)) throw new Error(`open:gen — ${key}'s guide: no shape ${w}`);
  }
  return { key, fifteen: l.sideboard, rows, ...((contributedFile as { guidesOnly?: string[] }).guidesOnly?.includes(key) ? { only: true as const } : {}) };
});
writeFileSync(join(ROOT, "packages/world/src/sideboard-guides.generated.ts"), `// GENERATED by \`pnpm open:gen\` from the guides in data/convocation/open-contributed.json — do not edit by hand.
import type { SideboardGuide } from "./sideboard-ai.js";

/** S58 (Part 1): the guides authored with the Open's registered fifteens. */
export const SIDEBOARD_GUIDES: readonly SideboardGuide[] = ${JSON.stringify(guides, null, 1)};
`);
for (const l of lists) if (archived[l.key]) (l as { archived?: true }).archived = true;
writeFileSync(join(ROOT, "docs/reference/open-lists.md"), renderOpenListsReference({ lists, cards: pool, plans, archived, means: OPEN_MEANS, amendments: OPEN_AMENDMENTS, revisions: OPEN_REVISIONS, contributed: Object.fromEntries(contributed.map((c) => [c.key, c as { source?: string; revisions?: { session: string; note: string }[] }])) }, OPEN_FORMAT.rule.restricted ?? []) + "\n");
console.log(`open:gen — ${lists.length} lists, each 60 and legal in the Open: ${lists.map((l) => l.key + (archived[l.key] ? " (archived)" : "")).join(", ")}`);
