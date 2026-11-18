/**
 * pnpm rating:forced --list                                    the cards a forced run is owed (and the --force argument)
 * pnpm rating:forced --forced forcedNNN,fdraftNNN [--cards a,b] [--write]
 *
 * S73 Part 2 (handoff concern 54; ADR-150, ADR-151): the Limited rating's blind spot. The Limited runs build and draft
 * by the current table, so a card rated low goes unplayed and is never re-measured. This is the pipeline's step for it:
 *  1. `--list` names every pack card seen under 100 times in the live table's Limited runs, or carrying an older
 *     pilot's number (`limitedCarried`);
 *  2. `pnpm sealed-sim --force <those> …` and `pnpm draft-cards --force <those> …` on the current pilot seed each into
 *     built decks (shards analysis/runs/<prefix>_shardN.json);
 *  3. this tool reads each card's Limited row from the FORCED runs alone, on the frame (tier means, τ, scale) of the
 *     live table's own Limited runs, and with `--write` puts the rows in data/convocation/card-rating.json, clears
 *     `limitedCarried`, and records the runs under run.limited.forced. A card the forced runs saw fewer than
 *     FORCED_MIN_SEEN times is left as it was and reported.
 * Every run read must carry the current pilot's version (ADR-150).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { resolveSet } from "./packs.js";
import { computeForcedLimited, FORCED_MIN_SEEN, underSeen, type RatingGameLike } from "./rating-compute.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const argOf = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : ""; };
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const tableFile = join(ROOT, "data/convocation/card-rating.json");
const table = JSON.parse(readFileSync(tableFile, "utf8")) as { _comment: string; version: number; run: { limited?: { runs: string[]; pilotVersion: number; carried?: { cards: string[] }; forced?: unknown } }; cards: Record<string, Record<string, unknown> & { limitedSeen?: number; limitedCarried?: number; limited?: number }> };
const sets = JSON.parse(readFileSync(join(ROOT, "data/convocation/sets.json"), "utf8")) as { power: string[]; sets: Parameters<typeof resolveSet>[0][] };
const packCards = [...new Set(sets.sets.flatMap((st) => Object.values(resolveSet(st, pool, sets.power)).flat()))];
const owed = underSeen(table.cards, packCards);

if (process.argv.includes("--list")) {
  console.log(`rating:forced — ${owed.length} pack cards are owed a forced run (seen under 100 times in ${table.run.limited?.runs.join(", ")}, or carried):`);
  for (const id of owed) console.log(`  ${pool.get(id)!.name}: seen ${table.cards[id]!.limitedSeen ?? 0}${table.cards[id]!.limitedCarried !== undefined ? ` (carried from pilot ${table.cards[id]!.limitedCarried})` : ""}, limited ${table.cards[id]!.limited}`);
  console.log(`\n--force ${owed.join(",")}`);
} else {
  const forcedPrefixes = argOf("forced").split(",").filter(Boolean);
  if (!forcedPrefixes.length) throw new Error("rating:forced — name the forced runs: --forced <prefix>[,<prefix>]");
  if (!table.run.limited) throw new Error("rating:forced — the live table has no Limited runs to take the frame from");
  const now = Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1])));
  const runOf = (pre: string): RatingGameLike[] => {
    const fs = readdirSync(join(ROOT, "analysis/runs")).filter((f) => new RegExp(`^${pre}_shard\\d+\\.json$`).test(f)).sort();
    if (!fs.length) throw new Error(`rating:forced — no run ${pre} on disk`);
    return fs.flatMap((f) => { const j = JSON.parse(readFileSync(join(ROOT, "analysis/runs", f), "utf8")) as { pilotVersion?: number; results: RatingGameLike[] }; if (j.pilotVersion !== now) throw new Error(`rating:forced — ${f} was played on pilot ${j.pilotVersion ?? "(unversioned)"}; the current pilot is ${now} (ADR-150)`); return j.results; });
  };
  const ids = argOf("cards") ? argOf("cards").split(",").filter(Boolean) : owed;
  const rated = [...pool.values()].filter((d) => !d.isTokenDef && !isBasic(d.id) && !(LAW_IDS as readonly string[]).includes(d.id));
  const rows = computeForcedLimited(table.run.limited.runs.map(runOf), forcedPrefixes.map(runOf), ids, rated, packCards);
  const done: string[] = [], short: string[] = [];
  console.log(`rating:forced — ${ids.length} cards from ${forcedPrefixes.join(", ")} (pilot ${now}), on the frame of ${table.run.limited.runs.join(", ")}\n`);
  console.log("| card | tier | before | seen before | forced seen | forced lift (pts) | Limited now |\n|---|---|---|---|---|---|---|");
  for (const id of ids) {
    const r = rows[id]!, old = table.cards[id]!, ok = r.limitedSeen >= FORCED_MIN_SEEN;
    (ok ? done : short).push(id);
    console.log(`| ${pool.get(id)!.name} | ${pool.get(id)!.shopTier ?? "prize"} | ${old.limited}${old.limitedCarried !== undefined ? ` (pilot ${old.limitedCarried})` : ""} | ${old.limitedSeen ?? 0} | ${r.limitedSeen} | ${r.limitedLift === null ? "—" : `${(r.limitedLift * 100).toFixed(1)} ± ${((r.limitedSe ?? 0) * 100).toFixed(1)}`} | ${ok ? r.limited.toFixed(2) : `(${r.limited.toFixed(2)}: under ${FORCED_MIN_SEEN}, not written)`} |`);
  }
  if (short.length) console.log(`\n${short.length} under ${FORCED_MIN_SEEN} sightings, left as they were: ${short.join(", ")}`);
  if (process.argv.includes("--write")) {
    for (const id of done) { const row = table.cards[id]!; Object.assign(row, rows[id]); delete row.limitedCarried; row.limitedForced = now; }
    const lim = table.run.limited as Record<string, unknown> & { carried?: { cards: string[] } };
    lim.forced = { runs: forcedPrefixes, pilotVersion: now, minSeen: FORCED_MIN_SEEN, cards: done };
    if (lim.carried) { lim.carried.cards = lim.carried.cards.filter((c) => !done.includes(c)); if (!lim.carried.cards.length) delete lim.carried; }
    if (argOf("version")) table.version = Number(argOf("version"));
    if (argOf("note")) table._comment += ` ${argOf("note")}`;
    writeFileSync(tableFile, JSON.stringify(table, null, 1) + "\n");
    console.log(`\nwritten: ${done.length} rows in data/convocation/card-rating.json (version ${table.version})`);
  }
}
