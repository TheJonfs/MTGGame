/**
 * pnpm open:gen — S46 (ADR-142/143): the Open's twelve lists from the planner's document (+ the brief's amendments and
 * the Loop, declared in @shandalar/sim/open-lists) → `packages/sim/src/open-decks.ts` (committed; pinned by
 * open-lists.test.ts) and the Lab's `analysis/decks/open-<key>.json` (local). Every list is checked against the Open.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { buildLoop, seedLists, OPEN_AMENDMENTS, OPEN_REVISIONS, type OpenSeed } from "@shandalar/sim/open-lists";
import { renderOpenListsReference } from "./open-reference.js";
import { formatReferenceText, openReferenceExtras } from "./open-reference-build.js";
import { checkDeck } from "./legality.js";
import { GUIDE_SHAPES, guideFor, type SideboardGuide } from "./sideboard-ai.js";
import { CONSTRUCTED_FORMATS, FIELD_FORMAT_IDS, OPEN_FORMAT } from "./formats.js";
import type { ComboPlan } from "@shandalar/agents";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// S67 (ADR-188): nothing is written until every list, guide, shape and reference has been checked — the files queue
// here and are written at the end (S66: a guide naming an unknown shape failed AFTER the decks file was rewritten)
const pending: [string, string][] = [];
const out = (path: string, text: string): void => { pending.push([path, text]); };
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const idOf = new Map([...pool.values()].map((d) => [d.name, d.id]));
// S58 (ADR-169): the seeds are data; the planner's document they came from is history
const lists = seedLists((JSON.parse(readFileSync(join(ROOT, "data/convocation/formats/open/seeds.json"), "utf8")) as { seeds: OpenSeed[] }).seeds, (n) => idOf.get(n));
if (lists.length !== 11) throw new Error(`open:gen — the document has ${lists.length} lists; the Open's seed is eleven`);
lists.push(buildLoop(lists.find((l) => l.key === "coin")!, (n) => idOf.get(n)));
// Post-S53 (Chris): the lists contributed from play (data/convocation/formats/open/contributed.json), after the twelve
const contributedFile = JSON.parse(readFileSync(join(ROOT, "data/convocation/formats/open/contributed.json"), "utf8")) as { archived?: Record<string, string>; plans?: Record<string, Omit<ComboPlan, "key">>; sideboards?: Record<string, { cardId: string; count: number }[]>; guides?: Record<string, { in: string; n: number; out?: string[]; when: string[]; unless?: string[] }[]> };
// S56 (ADR-164): the archive — a list by key (a seed list or a contributed one) with the reason; it stays in the data
const archived = contributedFile.archived ?? {};
const contributed = (JSON.parse(readFileSync(join(ROOT, "data/convocation/formats/open/contributed.json"), "utf8")) as { lists: { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: { cardId: string; count: number }[]; sideboard?: { cardId: string; count: number }[]; plan?: Omit<ComboPlan, "key"> }[] }).lists;
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
// S62 (ADR-176): the other formats with a field of their own — data/convocation/formats/<id>/lists.json, in the
// contributed shape (lists, archived, guides, guidesOnly, outRules); each list checked against ITS format.
type ExtraList = { key: string; name: string; title: string; archetype: "aggro" | "midrange" | "control" | "combo"; source?: string; decklist: { cardId: string; count: number }[]; sideboard?: { cardId: string; count: number }[]; archived?: true; plan?: Omit<ComboPlan, "key"> };
type ExtraFile = { archived?: Record<string, string>; guides?: Record<string, { in: string; n: number; out?: string[]; when: string[]; unless?: string[] }[]>; guidesOnly?: string[]; outRules?: Record<string, string[]>; lists: ExtraList[] };
const extras: { id: string; name: string; file: ExtraFile; lists: ExtraList[] }[] = [];
for (const id of FIELD_FORMAT_IDS) {
  if (id === "open") continue;
  const format = CONSTRUCTED_FORMATS.find((f) => f.id === id); if (!format) throw new Error(`open:gen — no format ${id}`);
  const file = JSON.parse(readFileSync(join(ROOT, `data/convocation/formats/${id}/lists.json`), "utf8")) as ExtraFile;
  const seen = new Set<string>();
  for (const l of file.lists) {
    if (seen.has(l.key)) throw new Error(`open:gen — ${id}: the key ${l.key} twice`); seen.add(l.key);
    for (const e of [...l.decklist, ...(l.sideboard ?? [])]) if (!pool.has(e.cardId)) throw new Error(`open:gen — ${id}:${l.key} names ${e.cardId}, not in the pool`);
    // S63 (Part 2): plans are a parameter — a combo list of any format carries its plan, checked as the Open's are; the
    // plan is keyed "<format>:<list>" (plans are matched to a deck by its cards, so the key only has to be unique)
    if ((l.archetype === "combo") !== !!l.plan) throw new Error(`open:gen — ${id}:${l.key}: a combo list carries a plan, and only a combo list does`);
    if (l.plan) { checkPlan(`${id}:${l.key}`, l.plan, l.decklist); plans.push({ key: `${id}:${l.key}`, ...l.plan }); }
    const n = l.decklist.reduce((a, e) => a + e.count, 0); if (n !== 60) throw new Error(`open:gen — ${id}:${l.key} has ${n} cards`);
    const c = checkDeck(l.decklist, null, format.rule, pool); if (!c.ok) throw new Error(`open:gen — ${id}:${l.key} fails ${format.name}: ${c.problems.join("; ")}`);
    if (l.sideboard) { const sc = checkSideboardList(l.decklist, l.sideboard, format.rule as typeof OPEN_FORMAT.rule, pool); if (sc) throw new Error(`open:gen — ${id}:${l.key}'s fifteen: ${sc}`); }
    if (file.archived?.[l.key]) l.archived = true;
  }
  for (const k of Object.keys(file.archived ?? {})) if (!seen.has(k)) throw new Error(`open:gen — ${id}: the archive names ${k}, which is not a list`);
  extras.push({ id, name: format.name, file, lists: file.lists });
}
const listLine = (l: { key: string; name: string; title: string; archetype: string; decklist: { cardId: string; count: number }[]; sideboard?: { cardId: string; count: number }[] }, archivedHere: boolean) =>
  `  ${l.key}: { key: ${JSON.stringify(l.key)}, name: ${JSON.stringify(l.name)}, title: ${JSON.stringify(l.title)}, archetype: ${JSON.stringify(l.archetype)}, decklist: d([${l.decklist.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])${l.sideboard ? `, sideboard: d([${l.sideboard.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])` : ""}${archivedHere ? ", archived: true" : ""} },`;
const body = lists.map((l) => `  ${l.key}: { key: ${JSON.stringify(l.key)}, name: ${JSON.stringify(l.name)}, title: ${JSON.stringify(l.title)}, archetype: ${JSON.stringify(l.archetype)}, decklist: d([${l.decklist.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])${(l as { sideboard?: { cardId: string; count: number }[] }).sideboard ? `, sideboard: d([${(l as { sideboard?: { cardId: string; count: number }[] }).sideboard!.map((e) => `[${JSON.stringify(e.cardId)}, ${e.count}]`).join(", ")}])` : ""}${archived[l.key] ? ", archived: true" : ""} },`).join("\n");
out(join(ROOT, "packages/agents/src/plans.generated.ts"), `// GENERATED by \`pnpm open:gen\` from the plans in data/convocation/formats/<id>/ (the Open's contributed.json; a format's lists.json) — do not edit by hand.
import type { ComboPlan } from "./plans.js";

/** S55 (ADR-161): the plans authored with the Open's combo lists. */
export const PLANS: readonly ComboPlan[] = ${JSON.stringify(plans, null, 2)};
`);
out(join(ROOT, "packages/sim/src/open-decks.ts"), `// GENERATED by \`pnpm open:gen\` from data/convocation/formats/open/seeds.json + the revisions in open-lists.ts + data/convocation/formats/open/contributed.json — do not edit by hand.
import type { OpenList, OpenDecklist } from "./open-lists.js";

const d = (pairs: [string, number][]): OpenDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

/** S46 (ADR-142/143): the Open's twelve seed lists, then (post-S53) the lists contributed from play, by key. S56 (ADR-164): an archived list stays here and is out of OPEN_FIELD. */
export const OPEN_DECKS: Record<string, OpenList> = {
${body}
};

/** S56 (ADR-164): the lists in the field — every list not archived. */
export const OPEN_FIELD: Record<string, OpenList> = Object.fromEntries(Object.entries(OPEN_DECKS).filter(([, l]) => !l.archived));

/** S62 (ADR-176): every format that has a field of its own lists, by format id — the Open's above, and the rest from data/convocation/formats/<id>/lists.json. */
export const FORMAT_DECKS: Record<string, Record<string, OpenList>> = {
  open: OPEN_DECKS,
${extras.map((x) => `  ${x.id}: {\n${x.lists.map((l) => "  " + listLine(l, !!l.archived)).join("\n")}\n  },`).join("\n")}
};
/** A format's lists in its field — every one not archived. */
export const FORMAT_FIELD: Record<string, Record<string, OpenList>> = Object.fromEntries(Object.entries(FORMAT_DECKS).map(([f, ls]) => [f, Object.fromEntries(Object.entries(ls).filter(([, l]) => !l.archived))]));
`);
mkdirSync(join(ROOT, "analysis/decks"), { recursive: true });
for (const l of lists) out(join(ROOT, `analysis/decks/open-${l.key}.json`), JSON.stringify({ name: `open-${l.key} (${l.name})`, archetype: l.archetype, decklist: l.decklist, basedOn: "docs/convocation/convocation-open-lists-draft-2.md + S46", notes: l.title }, null, 2) + "\n");
// S58 (Part 1): the guides authored beside a registered fifteen
const SHAPES: readonly string[] = GUIDE_SHAPES; // S67 (ADR-188): sideboard-ai's one list
const guides = Object.entries(contributedFile.guides ?? {}).map(([key, rows]) => {
  const l = lists.find((x) => x.key === key); if (!l?.sideboard) throw new Error(`open:gen — a guide names ${key}, which has no registered fifteen`);
  for (const r of rows) {
    if (!l.sideboard.some((e) => e.cardId === r.in)) throw new Error(`open:gen — ${key}'s guide brings in ${r.in}, which its fifteen does not hold`);
    for (const o of r.out ?? []) if (!l.decklist.some((e) => e.cardId === o)) throw new Error(`open:gen — ${key}'s guide takes out ${o}, which its sixty does not hold`);
    for (const w of [...r.when, ...(r.unless ?? [])]) if (!SHAPES.includes(w)) throw new Error(`open:gen — ${key}'s guide: no shape ${w}`);
  }
  return { key, fifteen: l.sideboard, rows, ...((contributedFile as { guidesOnly?: string[] }).guidesOnly?.includes(key) ? { only: true as const } : {}) };
});
for (const x of extras) for (const [key, rows] of Object.entries(x.file.guides ?? {})) {
  const l = x.lists.find((y) => y.key === key); if (!l?.sideboard) throw new Error(`open:gen — ${x.id}: a guide names ${key}, which has no registered fifteen`);
  for (const r of rows) {
    if (!l.sideboard.some((e) => e.cardId === r.in)) throw new Error(`open:gen — ${x.id}:${key}'s guide brings in ${r.in}, which its fifteen does not hold`);
    for (const o of r.out ?? []) if (!l.decklist.some((e) => e.cardId === o)) throw new Error(`open:gen — ${x.id}:${key}'s guide takes out ${o}, which its sixty does not hold`);
    for (const w of [...r.when, ...(r.unless ?? [])]) if (!SHAPES.includes(w)) throw new Error(`open:gen — ${x.id}:${key}'s guide: no shape ${w}`);
  }
  guides.push({ key: `${x.id}:${key}`, fifteen: l.sideboard, rows: rows as never, ...(x.file.guidesOnly?.includes(key) ? { only: true as const } : {}) });
}
const OUT_WORDS = ["small", "spells", "graveyard"];
const outRules = Object.entries((contributedFile as { outRules?: Record<string, string[]> }).outRules ?? {}).map(([key, words]) => {
  const l = lists.find((x) => x.key === key); if (!l) throw new Error(`open:gen — an out-rule names ${key}, which is no list`);
  for (const w of words) if (!OUT_WORDS.includes(w)) throw new Error(`open:gen — ${key}'s out-rule: no word ${w}`);
  if ((contributedFile as { guidesOnly?: string[] }).guidesOnly?.includes(key)) throw new Error(`open:gen — ${key} sideboards by its guide alone: an out-rule would never run`);
  return { key, sixty: l.decklist, out61: Object.fromEntries(words.map((w) => [w, true])) };
});
for (const x of extras) for (const [key, words] of Object.entries(x.file.outRules ?? {})) {
  const l = x.lists.find((y) => y.key === key); if (!l) throw new Error(`open:gen — ${x.id}: an out-rule names ${key}, which is no list`);
  for (const w of words) if (!OUT_WORDS.includes(w)) throw new Error(`open:gen — ${x.id}:${key}'s out-rule: no word ${w}`);
  outRules.push({ key: `${x.id}:${key}`, sixty: l.decklist, out61: Object.fromEntries(words.map((w) => [w, true])) });
}
const shapeScales: Record<string, { small: number; large: number }> = { open: { small: 15, large: 8 } };
for (const x of extras) {
  const field = x.lists.filter((l) => !l.archived), creatures = (l: ExtraList) => l.decklist.flatMap((e) => Array.from({ length: e.count }, () => pool.get(e.cardId)!)).filter((d) => d.types.includes("Creature"));
  const at = (counts: number[], share: number) => [...counts].sort((a, b) => b - a)[Math.max(0, Math.min(counts.length - 1, Math.round(share * counts.length) - 1))] ?? 0;
  // (the ranks are sideboard-ai.SHAPE_RANKS — repeated here because that module imports the file this writes)
  shapeScales[x.id] = { small: at(field.map((l) => creatures(l).filter((d) => (d.toughness ?? 0) <= 2).length), 0.36), large: at(field.map((l) => creatures(l).filter((d) => (d.toughness ?? 0) >= 3).length), 0.79) };
  // Post-S65 (Chris: Naya's eleventh list moved the 79th-percentile rank onto a list with no large creatures — `large` 3 → 0,
  // true of every list): a format may freeze its thresholds in its own file, as the Open's were frozen (S63 Part 0).
  const frozen = (x.file as { shapeScale?: { small: number; large: number } }).shapeScale;
  // S68 (ADR-186 amended): a frozen threshold is never below 2 — a rank that falls on a tie at 0 or 1 fires against nearly every list
  if (frozen && (frozen.small < 2 || frozen.large < 2)) throw new Error(`open:gen — ${x.id}'s frozen shapeScale ${JSON.stringify(frozen)}: ADR-186 — a frozen threshold is never below 2`);
  if (frozen) shapeScales[x.id] = { small: frozen.small, large: frozen.large };
  // S66 (ADR-186): a field of eight lists or more has frozen thresholds — re-derived only on the planner's call.
  else if (field.length >= 8) throw new Error(`open:gen — ${x.id} has ${field.length} lists: ADR-186 freezes its shape thresholds; add "shapeScale": ${JSON.stringify(shapeScales[x.id])} to its lists.json (the values derived now) or the planner's`);
}
const listGuides: Record<string, string> = {};
for (const l of lists) { const g = l.sideboard && guideFor(l.sideboard, guides as unknown as readonly SideboardGuide[]); if (g) listGuides[`open:${l.key}`] = g.key; }
for (const x of extras) for (const l of x.lists) { const g = l.sideboard && guideFor(l.sideboard, guides as unknown as readonly SideboardGuide[]); if (g) listGuides[`${x.id}:${l.key}`] = g.key; }
out(join(ROOT, "packages/world/src/sideboard-guides.generated.ts"), `// GENERATED by \`pnpm open:gen\` from the guides in data/convocation/formats/open/contributed.json — do not edit by hand.
import type { SideboardGuide } from "./sideboard-ai.js";

/** S58 (Part 1): the guides authored with the Open's registered fifteens. */
export const SIDEBOARD_GUIDES: readonly SideboardGuide[] = ${JSON.stringify(guides, null, 1)};

/** S62 (ADR-176): the \`small\` and \`large\` shapes' thresholds by format — the Open's as measured since S59; another
 * format's the counts at the same ranks of its own field (sideboard-ai.SHAPE_RANKS). */
export const SHAPE_SCALES: Record<string, { small: number; large: number }> = ${JSON.stringify(shapeScales)};

/** S61 (Part 2): the out-rule adopted per list (matched by its sixty), where it measured a gain. */
export const SIDEBOARD_OUT_RULES: readonly { key: string; sixty: { cardId: string; count: number }[]; out61: { small?: boolean; spells?: boolean; graveyard?: boolean } }[] = ${JSON.stringify(outRules, null, 1)};

/** S67 (ADR-188): each format's list (\`<format>:<key>\`) → the guide its registered fifteen has — a guide belongs to its list. */
export const LIST_GUIDES: Record<string, string> = ${JSON.stringify(listGuides, null, 1)};
`);
// S59 (Chris: the field is specified by MATCH win rate, not game one): the recorded matches table as code the browser can read
// S63 (Part 2): and the game-one means beside them (formats/<id>/means.json) — no longer a hand-edited table
const gameOneMeans: Record<string, number> = {};
{ const means: Record<string, number> = {}; const whens: string[] = [], g1whens: string[] = [];
  for (const id of FIELD_FORMAT_IDS) {
    const f = join(ROOT, `data/convocation/formats/${id}/matches.json`);
    if (existsSync(f)) {
      const rec = JSON.parse(readFileSync(f, "utf8")) as { when: string; byList: Record<string, { matches: number }> };
      whens.push(`${id} ${rec.when}`);
      for (const [k, v] of Object.entries(rec.byList)) means[`${id}:${k}`] = v.matches;
    }
    const g = join(ROOT, `data/convocation/formats/${id}/means.json`);
    if (existsSync(g)) {
      const rec = JSON.parse(readFileSync(g, "utf8")) as { when: string; byList: Record<string, number> };
      g1whens.push(`${id} ${rec.when}`);
      for (const [k, v] of Object.entries(rec.byList)) gameOneMeans[`${id}:${k}`] = v;
    }
  }
  out(join(ROOT, "packages/world/src/open-matches.generated.ts"), `// GENERATED by \`pnpm open:gen\` from data/convocation/formats/<id>/matches.json — do not edit by hand.
/** S59 (ADR-171): a list's best-of-three win rate on its format's table of record (measured: ${whens.join("; ") || "never"}) — what the field's seat draw reads. Keys are "<format>:<list>" (S62). */
export const OPEN_MATCH_MEANS: Record<string, number> = ${JSON.stringify(means, null, 1)};
/** S63 (Part 2): a list's game-one mean on its format's round-robin of record (measured: ${g1whens.join("; ") || "never"}). Keys "<format>:<list>". */
export const OPEN_MEANS: Record<string, number> = ${JSON.stringify(gameOneMeans, null, 1)};
/** S59/S63: a list's STRENGTH — its match win rate where one is recorded, else its game-one mean. */
export const FORMAT_STRENGTH: Record<string, number> = { ...OPEN_MEANS, ...OPEN_MATCH_MEANS };
`); }
for (const l of lists) if (archived[l.key]) (l as { archived?: true }).archived = true;
out(join(ROOT, "docs/reference/open-lists.md"), renderOpenListsReference({ lists, cards: pool, plans, archived, means: gameOneMeans, amendments: OPEN_AMENDMENTS, revisions: OPEN_REVISIONS, contributed: Object.fromEntries(contributed.map((c) => [c.key, c as { source?: string; revisions?: { session: string; note: string }[] }])), ...openReferenceExtras(ROOT, guides) }, OPEN_FORMAT.rule.restricted ?? []) + "\n");
// S63 (Part 2): a reference page per format with a field of its own
for (const x of extras) out(join(ROOT, `docs/reference/${x.id}-lists.md`), formatReferenceText(ROOT, x.id, { lists: x.lists as never, plans, guides, means: gameOneMeans }));
console.log(`open:gen — ${lists.length} lists, each 60 and legal in the Open: ${lists.map((l) => l.key + (archived[l.key] ? " (archived)" : "")).join(", ")}`);
for (const [path, text] of pending) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
