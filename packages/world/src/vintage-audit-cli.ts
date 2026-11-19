/**
 * pnpm vintage-audit [--format <id>] [--list <key>] [--bottom N] [--below P] [--summary] [--json file]
 *
 * S73 Part 1 (ADR-199): the vintage audit's mechanical first cut. Per registered, active list: its `poolAt`, the
 * vintage it is read against (the root of its `portOf` chain), its match rate on the table of record, the list as it
 * stands by mana value, and the DELTA — the cards added since that it could play (vintage.ts: legal, castable, within
 * the curve). The slots (which card a delta card replaces, and why by role) are read by hand from this printout.
 *   --bottom N   only each format's N lowest lists by match rate (the cliff lists);  --below P   only lists under P.
 *   --summary    one line a list.   --json file   the same as data.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDef } from "@shandalar/cards";
import { loadCardPool } from "@shandalar/cards/loader";
import { FORMAT_DECKS } from "@shandalar/sim/open-decks";
import { CONSTRUCTED_FORMATS, FIELD_FORMAT_IDS } from "./formats.js";
import { coloursOf, curveTop, deltaFor, listColours, mv, readAt, type ListMeta, type PoolHistory } from "./vintage.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const arg = (n: string): string | undefined => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const history = JSON.parse(readFileSync(join(ROOT, "data/convocation/pool-history.json"), "utf8")) as PoolHistory;
const rating = (JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as { cards: Record<string, { rating?: number }> }).cards;

/** Every list's vintage data, keyed "<format>:<key>" — the Open's from its seeds and contributed files. */
export function loadMetas(root: string): Record<string, ListMeta> {
  const metas: Record<string, ListMeta> = {};
  const read = (f: string) => JSON.parse(readFileSync(join(root, "data/convocation/formats", f), "utf8")) as { archived?: Record<string, string>; lists?: (ListMeta & { key: string })[]; seeds?: (ListMeta & { key: string })[] };
  for (const id of FIELD_FORMAT_IDS) {
    const files = id === "open" ? [read("open/seeds.json"), read("open/contributed.json")] : [read(`${id}/lists.json`)];
    const archived = Object.assign({}, ...files.map((f) => f.archived ?? {})) as Record<string, string>;
    for (const f of files) for (const l of f.lists ?? f.seeds ?? []) metas[`${id}:${l.key}`] = { poolAt: l.poolAt, portOf: l.portOf, source: l.source, name: l.name, groundExempt: l.groundExempt, archived: !!archived[l.key] };
  }
  // the Loop is built from the Coin (open-lists.ts), not written in the seeds
  if (metas["open:coin"]) metas["open:loop"] = { ...metas["open:coin"], archived: true };
  return metas;
}

if (process.argv[1]?.endsWith("vintage-audit-cli.ts")) {
  const metas = loadMetas(ROOT), only = arg("--format"), onlyList = arg("--list"), bottom = arg("--bottom") ? Number(arg("--bottom")) : undefined, below = arg("--below") ? Number(arg("--below")) : undefined;
  const summary = process.argv.includes("--summary"), rows: unknown[] = [], poolNow = Math.max(...Object.values(history.cards).map((c) => c.pool));
  const name = (id: string) => pool.get(id)!.name;
  const line = (d: CardDef, n: number | string) => `${n}× ${d.name} [${d.manaCost || "land"} ${d.types.join(" ")}${d.power !== undefined ? ` ${d.power}/${d.toughness}` : ""}${d.shopTier !== undefined ? ` T${d.shopTier}` : ""}${rating[d.id]?.rating !== undefined ? ` r${rating[d.id]!.rating!.toFixed(1)}` : ""}]`;
  console.log(`vintage audit — the pool stands at ${poolNow}`);
  for (const id of FIELD_FORMAT_IDS) {
    if (only && only !== id) continue;
    const format = CONSTRUCTED_FORMATS.find((f) => f.id === id)!, mf = join(ROOT, `data/convocation/formats/${id}/matches.json`);
    const rec = existsSync(mf) ? (JSON.parse(readFileSync(mf, "utf8")) as { byList: Record<string, { matches: number }> }).byList : {};
    let keys = Object.keys(FORMAT_DECKS[id]!).filter((k) => !metas[`${id}:${k}`]?.archived && !FORMAT_DECKS[id]![k]!.archived);
    keys.sort((a, b) => (rec[a]?.matches ?? 999) - (rec[b]?.matches ?? 999));
    if (bottom !== undefined) keys = keys.slice(0, bottom);
    if (below !== undefined) keys = keys.filter((k) => (rec[k]?.matches ?? 999) < below);
    if (onlyList) keys = keys.filter((k) => k === onlyList);
    if (!keys.length) continue;
    console.log(`\n# ${format.name} (${id})`);
    for (const k of keys) {
      const l = FORMAT_DECKS[id]![k]!, m = metas[`${id}:${k}`]!, v = readAt(`${id}:${k}`, metas);
      const delta = deltaFor(l.decklist, v.readAt, format.rule, pool, history), cands = delta.filter((c) => !c.inList);
      rows.push({ format: id, key: k, name: l.name, matches: rec[k]?.matches, poolAt: m.poolAt, readAt: v.readAt, root: v.root, colours: listColours(l.decklist, pool).join(""), top: curveTop(l.decklist, pool), candidates: cands.map((c) => c.id), adopted: delta.filter((c) => c.inList).map((c) => c.id) });
      const head = `${id}:${k} — ${l.name} (${l.archetype}, ${listColours(l.decklist, pool).join("") || "C"}, top ${curveTop(l.decklist, pool)}) · matches ${rec[k]?.matches ?? "—"} · poolAt ${m.poolAt} · read at ${v.readAt}${v.chain.length > 1 ? ` (${v.chain.slice(1).join(" ← ")})` : ""} · delta ${cands.length}`;
      if (summary) { console.log(head); continue; }
      console.log(`\n## ${head}`);
      const nonland = l.decklist.filter((e) => !pool.get(e.cardId)!.types.includes("Land")).sort((a, b) => mv(pool.get(a.cardId)!) - mv(pool.get(b.cardId)!));
      console.log(`  the list: ${nonland.map((e) => `${e.count} ${name(e.cardId)} (${mv(pool.get(e.cardId)!)})`).join(", ")}`);
      console.log(`  lands: ${l.decklist.filter((e) => pool.get(e.cardId)!.types.includes("Land")).map((e) => `${e.count} ${name(e.cardId)}`).join(", ")}`);
      if (l.sideboard) console.log(`  fifteen: ${l.sideboard.map((e) => `${e.count} ${name(e.cardId)}`).join(", ")}`);
      const had = delta.filter((c) => c.inList); if (had.length) console.log(`  already plays, from the delta: ${had.map((c) => `${c.inList} ${name(c.id)}`).join(", ")}`);
      for (const c of cands) console.log(`  ${c.land ? "land " : `mv ${c.mv} `}${coloursOf(pool.get(c.id)!)} ${line(pool.get(c.id)!, "+")} · pool ${c.pool} (${c.added})`);
    }
  }
  const j = arg("--json"); if (j) writeFileSync(j, JSON.stringify(rows, null, 1) + "\n");
}
