/**
 * pnpm rating:build [files…]   (default: analysis/runs/rating_shard*.json)
 *
 * S47 (Part 2): the card rating, v0, from the rating run (rating-run-cli.ts). Per card:
 *  - PRESENCE — across the lists that play it, the list's win rate less the field's, weighted by copies × games
 *    (the brief's presence-weighted win contribution). A card in one list inherits that list.
 *  - LIFT — over the games in which its pilot SAW it in hand, the pilot's result less that list's own win rate
 *    (the within-list term: it does not inherit the list's strength; it does lean to cards seen in long games).
 *  - CAST WHEN DRAWN — of the games it was seen, those in which it was cast (a land: played). Reported, not blended.
 * Each is shrunk toward zero by its sample (lists/(lists+2); seen/(seen+300)), put in units of its own spread across
 * the pool, averaged, and added to the tier prior at half a point a unit — one spread ≈ one tier step:
 *    rating = prior(tier) + 0.5 × ½( presence′/σP + lift′/σL ).
 * Writes data/convocation/card-rating.json and card-rating-report.md (top and bottom twenty; the tier disagreements).
 *
 * `--sealed` (S48, v1): the Sealed sim's shards (analysis/runs/sealed_shard*.json — decks the builder made from random
 * pools, no author) join the LIFT term: a card's sightings there and in the authored lists are pooled (each game's
 * result less its own deck's rate), then shrunk and scaled as before. Presence stays the authored lists'. The rows
 * keep both samples; the report adds the twenty cards that moved most against data/convocation/card-rating-v0.json.
 *
 * `--noise` (S49, v2 — a CANDIDATE): the noise run's shards (sealednoise_shard*.json — a third of its decks built with
 * rating noise, so under-rated cards were played) join the sealed sample too. Written to card-rating-v2-candidate.json
 * and its own report, compared against the current card-rating.json; v1 is not touched (the planner rules).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { authoredLists } from "./authored-lists.js";
import type { CardRatingRow } from "./rating.js";
import { computeLimitedRating, computeRating } from "./rating-compute.js";
import { resolveSet } from "./packs.js";
import type { RatingGame } from "./rating-run-cli.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
// S51 (ADR-150): `--prefixes a,b --candidate <name>` — the Sealed sample is EXACTLY those runs (analysis/runs/<prefix>_shardN.json),
// each of which must carry the current pilot's version; the table is written as card-rating-<name>.json with its report.
const argOf = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : ""; };
const prefixes = argOf("prefixes").split(",").filter(Boolean), candidate = argOf("candidate");
const withNoise = process.argv.includes("--noise") || process.argv.includes("--also") || prefixes.length > 0;
// S50: `--also <prefix>` — further Sealed shards (analysis/runs/<prefix>_shardN.json) join the candidate's sample.
const alsoPrefix = (() => { const i = process.argv.indexOf("--also"); return i >= 0 ? process.argv[i + 1]! : ""; })();
const withSealed = process.argv.includes("--sealed") || withNoise;
const given = process.argv.slice(2).filter((a) => a.endsWith(".json"));
const files = given.length ? given : readdirSync(join(ROOT, "analysis/runs")).filter((f) => /^rating_shard\d+\.json$/.test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
if (!files.length) throw new Error("rating:build — no rating run on disk (pnpm rating:run first)");
const games: RatingGame[] = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: RatingGame[] }).results);
const lists = new Map(authoredLists(ROOT).map((l) => [l.key, l]));

// S52 (ADR-151): the arithmetic is rating-compute.ts (pure, tested); this file reads the runs and writes the tables.
let sealedRuns: RatingGame[][] | null = null;
if (withSealed) {
  const sf = readdirSync(join(ROOT, "analysis/runs")).filter((f) => (prefixes.length ? new RegExp(`^(${prefixes.join("|")})_shard\\d+\\.json$`) : withNoise ? new RegExp(`^(sealed_shard|sealednoise_shard${alsoPrefix ? `|${alsoPrefix}_shard` : ""})\\d+\\.json$`) : /^sealed_shard\d+\.json$/).test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
  if (!sf.length) throw new Error("rating:build --sealed — no Sealed sim on disk (pnpm sealed-sim first)");
  if (prefixes.length) { // ADR-150: one pilot, the current one
    const now = Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1])));
    for (const f of sf) { const v = (JSON.parse(readFileSync(f, "utf8")) as { pilotVersion?: number }).pilotVersion; if (v !== now) throw new Error(`rating:build — ${f} was played on pilot ${v ?? "(unversioned)"}; the current pilot is ${now} (ADR-150: no pooling across pilots)`); }
  }
  // Each run's decks are its own (every run names its decks "pool:0…"): the files are grouped by run, never pooled by key.
  const runOf = (f: string) => f.replace(/^.*\//, "").replace(/_?shard\d+\.json$/, "").replace(/_\d+\.json$/, "");
  const byRun = new Map<string, RatingGame[]>();
  for (const f of sf) { const g = (JSON.parse(readFileSync(f, "utf8")) as { results: RatingGame[] }).results; byRun.set(runOf(f), [...(byRun.get(runOf(f)) ?? []), ...g]); }
  sealedRuns = [...byRun.values()];
}
const rated = [...pool.values()].filter((d) => !d.isTokenDef && !isBasic(d.id) && !(LAW_IDS as readonly string[]).includes(d.id));
const computed = computeRating({ authored: games, lists: [...lists.values()], sealedRuns, rated, colourTerm: process.argv.includes("--colour") });
// Post-S52 (Chris): `--limited a,b,c` — the LIMITED score from exactly those Limited runs (Sealed, noise, draft; each
// prefix one run, all on the current pilot), merged into each row as `limited` beside the Constructed `rating`.
const limitedPrefixes = argOf("limited").split(",").filter(Boolean);
const limited = (() => {
  if (!limitedPrefixes.length) return null;
  const now = Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1])));
  const runs = limitedPrefixes.map((pre) => {
    const fs = readdirSync(join(ROOT, "analysis/runs")).filter((f) => new RegExp(`^${pre}_shard\\d+\\.json$`).test(f)).sort();
    if (!fs.length) throw new Error(`rating:build --limited — no run ${pre} on disk`);
    return fs.flatMap((f) => { const j = JSON.parse(readFileSync(join(ROOT, "analysis/runs", f), "utf8")) as { pilotVersion?: number; results: RatingGame[] }; if (j.pilotVersion !== now) throw new Error(`rating:build --limited — ${f} was played on pilot ${j.pilotVersion ?? "(unversioned)"}; the current pilot is ${now} (ADR-150)`); return j.results; });
  });
  const sets = JSON.parse(readFileSync(join(ROOT, "data/convocation/sets.json"), "utf8")) as { power: string[]; sets: Parameters<typeof resolveSet>[0][] };
  const packCards = [...new Set(sets.sets.flatMap((st) => Object.values(resolveSet(st, pool, sets.power)).flat()))];
  return { ...computeLimitedRating(runs, rated, packCards), runs: limitedPrefixes, pilotVersion: now };
})();
if (limited) for (const [id, row] of Object.entries(limited.cards)) if (computed.cards[id]) Object.assign(computed.cards[id]!, row);
const { cards, rec, field, sealedGames } = computed, sdP = computed.sigmaPresence, sdL = computed.sigmaLift;
const wr = (k: string) => rec[k]!.w / rec[k]!.n;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const out = {
  _comment: "S47/S48 (ADR-145): the card rating — generated by pnpm rating:build from pnpm rating:run (analysis/runs, local). rating = prior(tier) + 0.5 × ½(presence′/σP + lift′/σL); see world/rating-build-cli.ts. presence and lift are raw win-rate differences; seen is the sample behind lift and castWhenDrawn.",
  version: argOf("version") ? Number(argOf("version")) : withNoise ? 2 : withSealed ? 1 : 0,
  run: { ...(withSealed ? { sealedGames } : {}), ...(prefixes.length ? { sealedRuns: prefixes, ...(computed.colourRates ? { colourRates: computed.colourRates } : {}), pilotVersion: Math.max(0, ...[...readFileSync(join(ROOT, "packages/agents/src/book-of-shame.test.ts"), "utf8").matchAll(/book of shame (\d+)/g)].map((m) => Number(m[1]))) } : {}), games: games.length, lists: Object.keys(rec).length, fieldWinRate: r3(field), sigmaPresence: r3(sdP), sigmaLift: r3(sdL), shrink: { lists: 2, seen: 300 }, ...(limited ? { limited: { runs: limited.runs, pilotVersion: limited.pilotVersion, games: limited.games, tierMeans: limited.tierMeans, tau: limited.tau, scale: limited.scale } } : {}) },
  cards,
};
const prevFile = join(ROOT, withNoise ? "data/convocation/card-rating.json" : "data/convocation/card-rating-v0.json");
const prev = withSealed ? (JSON.parse(readFileSync(prevFile, "utf8")) as { cards: Record<string, CardRatingRow> }).cards : null; // read BEFORE writing (v1 is the candidate's baseline)
writeFileSync(join(ROOT, candidate ? `data/convocation/card-rating-${candidate}.json` : withNoise ? "data/convocation/card-rating-v2-candidate.json" : "data/convocation/card-rating.json"), JSON.stringify(out, null, 1) + "\n");

const name = (id: string) => pool.get(id)!.name, tier = (id: string) => String(pool.get(id)!.shopTier ?? "prize");
const pct = (x: number | null) => (x === null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`);
const row = (id: string) => { const c = cards[id]!; return `| ${name(id)} | ${tier(id)} | ${c.rating.toFixed(2)} | ${(c.rating - c.prior >= 0 ? "+" : "") + (c.rating - c.prior).toFixed(2)} | ${c.lists} | ${pct(c.presence)} | ${c.seen} | ${pct(c.lift)} | ${c.castWhenDrawn === null ? "—" : Math.round(c.castWhenDrawn * 100) + "%"} |`; };
const head = "| card | tier | rating | vs tier | lists | presence (pts) | seen | lift (pts) | cast when drawn |\n|---|---|---|---|---|---|---|---|---|";
const ids = Object.keys(cards), byRating = [...ids].sort((a, b) => cards[b]!.rating - cards[a]!.rating), byGap = [...ids].sort((a, b) => (cards[b]!.rating - cards[b]!.prior) - (cards[a]!.rating - cards[a]!.prior));
const listRows = [...lists.keys()].filter((k) => rec[k]).sort((a, b) => wr(b) - wr(a));
const v0 = prev;
const movers = v0 ? [...ids].filter((i) => v0[i]).sort((a, b) => Math.abs(cards[b]!.rating - v0[b]!.rating) - Math.abs(cards[a]!.rating - v0[a]!.rating)).slice(0, 20) : [];
const md = [
  `# The card rating, v${withNoise ? "2 (candidate)" : withSealed ? 1 : 0} — ${games.length} games, ${Object.keys(rec).length} authored lists at even entrances (20 life, master both)`,
  `\nGenerated by \`pnpm rating:build\`. rating = prior(tier: 1 → 1.0, 2 → 1.5, 3 → 2.0, R and prize → 2.5) + 0.5 × ½(presence′/σP + lift′/σL); σP = ${(sdP * 100).toFixed(1)} pts, σL = ${(sdL * 100).toFixed(1)} pts. ${ids.filter((i) => !cards[i]!.lists).length} of ${ids.length} cards are in no list and read their prior.`,
  `\n## The top twenty\n\n${head}\n${byRating.slice(0, 20).map(row).join("\n")}`,
  `\n## The bottom twenty\n\n${head}\n${byRating.slice(-20).reverse().map(row).join("\n")}`,
  `\n## The rating against the tier — the five furthest above, the five furthest below\n\n${head}\n${byGap.slice(0, 5).map(row).join("\n")}\n${byGap.slice(-5).reverse().map(row).join("\n")}`,
  ...(v0 ? [`\n## The twenty that moved most from v${withNoise ? 1 : 0} (the Sealed sim's ${sealedGames} games joining the lift)\n\n| card | tier | v${withNoise ? 1 : 0} | v${withNoise ? 2 : 1} | change | authored seen | authored lift | sealed seen | sealed lift |\n|---|---|---|---|---|---|---|---|---|\n${movers.map((i) => { const c = cards[i]! as CardRatingRow & { sealedSeen?: number; sealedLift?: number | null }; return `| ${name(i)} | ${tier(i)} | ${v0[i]!.rating.toFixed(2)} | ${c.rating.toFixed(2)} | ${(c.rating - v0[i]!.rating >= 0 ? "+" : "") + (c.rating - v0[i]!.rating).toFixed(2)} | ${c.seen} | ${pct(c.lift)} | ${c.sealedSeen ?? 0} | ${pct(c.sealedLift ?? null)} |`; }).join("\n")}`] : []),
  `\n## The lists' win rates against the field (the presence term's input) — the ten best, the ten worst\n\n${listRows.slice(0, 10).map((k) => `${k} ${Math.round(wr(k) * 100)}%`).join(" · ")}\n\n${listRows.slice(-10).map((k) => `${k} ${Math.round(wr(k) * 100)}%`).join(" · ")}`,
  ...(limited ? (() => {
    const lrow = (id: string) => { const c = cards[id]!; return `| ${name(id)} | ${tier(id)} | ${c.limited!.toFixed(2)} | ${c.rating.toFixed(2)} | ${c.limitedSeen} | ${pct(c.limitedLift ?? null)}${c.limitedSe != null ? ` ±${(c.limitedSe * 100).toFixed(1)}` : ""} |`; };
    const lhead = "| card | tier | Limited | Constructed | seen in Limited | Limited lift (pts) |\n|---|---|---|---|---|---|";
    const seenIds = ids.filter((i) => (cards[i]!.limitedSeen ?? 0) > 0), byL = [...seenIds].sort((a, b) => cards[b]!.limited! - cards[a]!.limited!);
    return [`\n## The Limited score (post-S52) — ${limited.games} games in ${limited.runs.join(", ")} (pilot ${limited.pilotVersion})\n\nThe posterior lift (empirical Bayes: each tier's measured mean as the shrink target, τ = ${(limited.tau * 100).toFixed(1)} pts), scaled to mean ${"1.8"} and spread ${"0.8"} over the pack cards. Tier means (pts): ${Object.entries(limited.tierMeans).map(([t, v]) => `${t} ${(v * 100).toFixed(1)}`).join(" · ")}. ${ids.length - seenIds.length} cards no Limited game saw read their tier's mean.`,
      `\n### The top twenty-five\n\n${lhead}\n${byL.slice(0, 25).map(lrow).join("\n")}`,
      `\n### The bottom twenty-five\n\n${lhead}\n${byL.slice(-25).reverse().map(lrow).join("\n")}`];
  })() : []),
].join("\n");
writeFileSync(join(ROOT, candidate ? `data/convocation/card-rating-${candidate}-report.md` : withNoise ? "data/convocation/card-rating-v2-candidate-report.md" : "data/convocation/card-rating-report.md"), md + "\n");
console.log(md);
