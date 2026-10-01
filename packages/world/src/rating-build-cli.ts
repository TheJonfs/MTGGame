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
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { authoredLists } from "./authored-lists.js";
import { ratingPrior, type CardRatingRow } from "./rating.js";
import type { RatingGame } from "./rating-run-cli.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const withSealed = process.argv.includes("--sealed");
const given = process.argv.slice(2).filter((a) => a.endsWith(".json"));
const files = given.length ? given : readdirSync(join(ROOT, "analysis/runs")).filter((f) => /^rating_shard\d+\.json$/.test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
if (!files.length) throw new Error("rating:build — no rating run on disk (pnpm rating:run first)");
const games: RatingGame[] = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: RatingGame[] }).results);
const lists = new Map(authoredLists(ROOT).map((l) => [l.key, l]));

const rec: Record<string, { n: number; w: number }> = {};
const sides = (g: RatingGame) => [[g.a, g.winner === "a" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenA, g.usedA], [g.b, g.winner === "b" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenB, g.usedB]] as [string, number, string[], string[]][];
for (const g of games) for (const [k, r] of sides(g)) { const x = (rec[k] ??= { n: 0, w: 0 }); x.n += 1; x.w += r; }
const wr = (k: string) => rec[k]!.w / rec[k]!.n;
const field = Object.values(rec).reduce((a, x) => a + x.w, 0) / Object.values(rec).reduce((a, x) => a + x.n, 0);

const seen: Record<string, { n: number; d: number; used: number }> = {};
for (const g of games) for (const [k, r, s, u] of sides(g)) for (const c of s) { const x = (seen[c] ??= { n: 0, d: 0, used: 0 }); x.n += 1; x.d += r - wr(k); if (u.includes(c)) x.used += 1; }
// S48: the Sealed sim's sightings — the same lift, over decks no author built
const sealed: Record<string, { n: number; d: number }> = {};
let sealedGames = 0;
if (withSealed) {
  const sf = readdirSync(join(ROOT, "analysis/runs")).filter((f) => /^sealed_shard\d+\.json$/.test(f)).sort().map((f) => join(ROOT, "analysis/runs", f));
  if (!sf.length) throw new Error("rating:build --sealed — no Sealed sim on disk (pnpm sealed-sim first)");
  const sg: RatingGame[] = sf.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: RatingGame[] }).results);
  sealedGames = sg.length;
  const srec: Record<string, { n: number; w: number }> = {};
  for (const g of sg) for (const [k, r] of sides(g)) { const x = (srec[k] ??= { n: 0, w: 0 }); x.n += 1; x.w += r; }
  for (const g of sg) for (const [k, r, s] of sides(g)) for (const c of s) { const x = (sealed[c] ??= { n: 0, d: 0 }); x.n += 1; x.d += r - srec[k]!.w / srec[k]!.n; }
}
const liftN = (id: string) => (seen[id]?.n ?? 0) + (sealed[id]?.n ?? 0), liftD = (id: string) => (seen[id]?.d ?? 0) + (sealed[id]?.d ?? 0);
const pres: Record<string, { w: number; d: number; lists: number }> = {};
for (const [k, l] of lists) { if (!rec[k]) continue; for (const e of l.decklist) { const x = (pres[e.cardId] ??= { w: 0, d: 0, lists: 0 }); const w = e.count * rec[k]!.n; x.w += w; x.d += w * (wr(k) - field); x.lists += 1; } }

const rated = [...pool.values()].filter((d) => !d.isTokenDef && !isBasic(d.id) && !(LAW_IDS as readonly string[]).includes(d.id));
const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const P = (id: string) => (pres[id] ? (pres[id]!.d / pres[id]!.w) * (pres[id]!.lists / (pres[id]!.lists + 2)) : 0);
const L = (id: string) => (liftN(id) ? (liftD(id) / liftN(id)) * (liftN(id) / (liftN(id) + 300)) : 0);
const sdP = sd(rated.filter((d) => pres[d.id]).map((d) => P(d.id))), sdL = sd(rated.filter((d) => liftN(d.id)).map((d) => L(d.id)));
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const cards: Record<string, CardRatingRow> = {};
for (const d of rated.sort((a, b) => a.id.localeCompare(b.id))) {
  const prior = ratingPrior(d), signal = 0.5 * (P(d.id) / sdP + L(d.id) / sdL);
  cards[d.id] = {
    rating: r3(prior + 0.5 * signal), prior, lists: pres[d.id]?.lists ?? 0, seen: seen[d.id]?.n ?? 0,
    presence: pres[d.id] ? r3(pres[d.id]!.d / pres[d.id]!.w) : null, lift: seen[d.id] ? r3(seen[d.id]!.d / seen[d.id]!.n) : null,
    castWhenDrawn: seen[d.id] ? r3(seen[d.id]!.used / seen[d.id]!.n) : null,
    ...(withSealed ? { sealedSeen: sealed[d.id]?.n ?? 0, sealedLift: sealed[d.id] ? r3(sealed[d.id]!.d / sealed[d.id]!.n) : null } : {}),
  };
}
const out = {
  _comment: "S47/S48 (ADR-145): the card rating — generated by pnpm rating:build from pnpm rating:run (analysis/runs, local). rating = prior(tier) + 0.5 × ½(presence′/σP + lift′/σL); see world/rating-build-cli.ts. presence and lift are raw win-rate differences; seen is the sample behind lift and castWhenDrawn.",
  version: withSealed ? 1 : 0,
  run: { ...(withSealed ? { sealedGames } : {}), games: games.length, lists: Object.keys(rec).length, fieldWinRate: r3(field), sigmaPresence: r3(sdP), sigmaLift: r3(sdL), shrink: { lists: 2, seen: 300 } },
  cards,
};
writeFileSync(join(ROOT, "data/convocation/card-rating.json"), JSON.stringify(out, null, 1) + "\n");

const name = (id: string) => pool.get(id)!.name, tier = (id: string) => String(pool.get(id)!.shopTier ?? "prize");
const pct = (x: number | null) => (x === null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`);
const row = (id: string) => { const c = cards[id]!; return `| ${name(id)} | ${tier(id)} | ${c.rating.toFixed(2)} | ${(c.rating - c.prior >= 0 ? "+" : "") + (c.rating - c.prior).toFixed(2)} | ${c.lists} | ${pct(c.presence)} | ${c.seen} | ${pct(c.lift)} | ${c.castWhenDrawn === null ? "—" : Math.round(c.castWhenDrawn * 100) + "%"} |`; };
const head = "| card | tier | rating | vs tier | lists | presence (pts) | seen | lift (pts) | cast when drawn |\n|---|---|---|---|---|---|---|---|---|";
const ids = Object.keys(cards), byRating = [...ids].sort((a, b) => cards[b]!.rating - cards[a]!.rating), byGap = [...ids].sort((a, b) => (cards[b]!.rating - cards[b]!.prior) - (cards[a]!.rating - cards[a]!.prior));
const listRows = [...lists.keys()].filter((k) => rec[k]).sort((a, b) => wr(b) - wr(a));
const v0File = join(ROOT, "data/convocation/card-rating-v0.json");
const v0 = withSealed ? (JSON.parse(readFileSync(v0File, "utf8")) as { cards: Record<string, CardRatingRow> }).cards : null;
const movers = v0 ? [...ids].filter((i) => v0[i]).sort((a, b) => Math.abs(cards[b]!.rating - v0[b]!.rating) - Math.abs(cards[a]!.rating - v0[a]!.rating)).slice(0, 20) : [];
const md = [
  `# The card rating, v${withSealed ? 1 : 0} — ${games.length} games, ${Object.keys(rec).length} authored lists at even entrances (20 life, master both)`,
  `\nGenerated by \`pnpm rating:build\`. rating = prior(tier: 1 → 1.0, 2 → 1.5, 3 → 2.0, R and prize → 2.5) + 0.5 × ½(presence′/σP + lift′/σL); σP = ${(sdP * 100).toFixed(1)} pts, σL = ${(sdL * 100).toFixed(1)} pts. ${ids.filter((i) => !cards[i]!.lists).length} of ${ids.length} cards are in no list and read their prior.`,
  `\n## The top twenty\n\n${head}\n${byRating.slice(0, 20).map(row).join("\n")}`,
  `\n## The bottom twenty\n\n${head}\n${byRating.slice(-20).reverse().map(row).join("\n")}`,
  `\n## The rating against the tier — the five furthest above, the five furthest below\n\n${head}\n${byGap.slice(0, 5).map(row).join("\n")}\n${byGap.slice(-5).reverse().map(row).join("\n")}`,
  ...(v0 ? [`\n## The twenty that moved most from v0 (the Sealed sim's ${sealedGames} games joining the lift)\n\n| card | tier | v0 | v1 | change | authored seen | authored lift | sealed seen | sealed lift |\n|---|---|---|---|---|---|---|---|---|\n${movers.map((i) => { const c = cards[i]! as CardRatingRow & { sealedSeen?: number; sealedLift?: number | null }; return `| ${name(i)} | ${tier(i)} | ${v0[i]!.rating.toFixed(2)} | ${c.rating.toFixed(2)} | ${(c.rating - v0[i]!.rating >= 0 ? "+" : "") + (c.rating - v0[i]!.rating).toFixed(2)} | ${c.seen} | ${pct(c.lift)} | ${c.sealedSeen ?? 0} | ${pct(c.sealedLift ?? null)} |`; }).join("\n")}`] : []),
  `\n## The lists' win rates against the field (the presence term's input) — the ten best, the ten worst\n\n${listRows.slice(0, 10).map((k) => `${k} ${Math.round(wr(k) * 100)}%`).join(" · ")}\n\n${listRows.slice(-10).map((k) => `${k} ${Math.round(wr(k) * 100)}%`).join(" · ")}`,
].join("\n");
writeFileSync(join(ROOT, "data/convocation/card-rating-report.md"), md + "\n");
console.log(md);
