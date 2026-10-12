/**
 * pnpm format:rr --field field.json [--max-tier 2] [--games 300] [--seed 62] [--only key] [--out file.json]
 *
 * S61 (Chris's Penny experiments, ahead of S62's format switch for the Open's own tools): a game-one round-robin of
 * ANY set of lists. The field file is `{ key: { name, archetype, decklist: [{cardId, count}] } }`; every list is
 * checked against the tier ceiling (sixty or more cards, four of a card, basics free) before a game is played. Master
 * pilots on both sides, twenty life, seats alternating — `open:rr`'s game, with nothing of the Open in it. Prints the
 * matrix (the ROW's win rate), each list's mean, and — for each list — the nonland cards it cast less than once in
 * twenty games (a card the pilot never casts is a pilot bug or a dead card: book 123's lesson).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_FORMAT } from "./formats.js";
import { checkDeck, type DeckRule } from "./legality.js";
import type { Decklist } from "./state.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
type Entry = { name: string; archetype: "aggro" | "midrange" | "control" | "combo"; decklist: Decklist };
const field = JSON.parse(readFileSync(arg("field", ""), "utf8")) as Record<string, Entry>;
const maxTier = Number(arg("max-tier", "0")), G = Number(arg("games", "300")), seed0 = Number(arg("seed", "62")), only = arg("only", "");
const rule: DeckRule = maxTier ? { label: `tier ${maxTier} and below`, minCards: 60, maxTier: maxTier as 1 | 2 | 3, banned: OPEN_FORMAT.rule.banned! } : OPEN_FORMAT.rule;
const KEYS = Object.keys(field);
for (const k of KEYS) {
  for (const e of field[k]!.decklist) if (!pool.has(e.cardId)) throw new Error(`format:rr — ${k}: no card ${e.cardId}`);
  const c = checkDeck(field[k]!.decklist, null, rule, pool);
  if (!c.ok) throw new Error(`format:rr — ${k} is not legal: ${c.problems.join("; ")}`);
}
class Counting implements Agent {
  cast: Record<string, number> = {};
  constructor(private inner: Agent) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, req);
    if (a.type === "castSpell") { const c = view.hand.find((x) => x.objectId === a.objectId)?.cardId; if (c) this.cast[c] = (this.cast[c] ?? 0) + 1; }
    return a;
  }
}
const wins: Record<string, Record<string, [number, number]>> = {}, cast: Record<string, Record<string, number>> = {}, played: Record<string, number> = {}, turns: Record<string, number> = {};
let draws = 0;
const results: { a: string; b: string; seatA: 0 | 1; winner: string; reason: string; turns: number }[] = [];
let p = -1;
for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) {
  p += 1;
  const ka = KEYS[i]!, kb = KEYS[j]!;
  if (only && ka !== only && kb !== only) continue;
  const A = field[ka]!, B = field[kb]!;
  for (let g = 0; g < G; g++) {
    const seatA = (g % 2) as 0 | 1, seed = seed0 + p * 1009 + g * 37, [d0, d1, k0, k1] = seatA === 0 ? [A, B, ka, kb] : [B, A, kb, ka];
    const spec = { seed, players: [{ name: k0, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: k1, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
    const t0 = new Counting(new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("master", d0.archetype, [...d1.decklist], [...d0.decklist]))), t1 = new Counting(new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", d1.archetype, [...d0.decklist], [...d1.decklist])));
    const r = await runMatch(spec, pool, [t0, t1]);
    const w = r.winner === null ? "draw" : r.winner === seatA ? "a" : "b";
    if (w === "draw") draws += 1;
    const add = (me: string, them: string, won: number) => { const c = ((wins[me] ??= {})[them] ??= [0, 0]); c[0] += won; c[1] += 1; };
    add(ka, kb, w === "a" ? 1 : w === "draw" ? 0.5 : 0); add(kb, ka, w === "b" ? 1 : w === "draw" ? 0.5 : 0);
    for (const [k, t] of [[k0, t0], [k1, t1]] as const) { played[k] = (played[k] ?? 0) + 1; turns[k] = (turns[k] ?? 0) + r.turns; for (const [c, n] of Object.entries(t.cast)) (cast[k] ??= {})[c] = ((cast[k] ?? {})[c] ?? 0) + n; }
    results.push({ a: ka, b: kb, seatA, winner: w, reason: r.reason, turns: r.turns });
  }
  console.error(`${ka} vs ${kb} done`);
}
const pct = (c?: [number, number]) => (c ? Math.round((100 * c[0]) / c[1]) : "—");
const mean = (k: string) => { const cs = Object.values(wins[k] ?? {}); return cs.length ? (100 * cs.reduce((a, c) => a + c[0], 0)) / cs.reduce((a, c) => a + c[1], 0) : 0; };
const order = [...KEYS].filter((k) => wins[k]).sort((a, b) => mean(b) - mean(a));
console.log(`# ${arg("field", "")} — ${G} games a pairing, game one, master both${maxTier ? `, tier ${maxTier} and below` : ""}; the ROW's win rate (± ${Math.round(98 / Math.sqrt(G))} a cell); ${draws} drawn\n`);
console.log(`| | ${order.map((k) => field[k]!.name).join(" | ")} | **mean** | turns |\n|---|${order.map(() => "---").join("|")}|---|---|`);
for (const k of order) console.log(`| **${field[k]!.name}** | ${order.map((o) => (o === k ? "—" : pct(wins[k]![o]))).join(" | ")} | **${mean(k).toFixed(1)}** | ${(turns[k]! / played[k]!).toFixed(1)} |`);
console.log(`\n## Casts a game (nonland cards; ⚠ under 0.05 a copy-game — a card the pilot does not cast)`);
for (const k of order) {
  const rows = (field[k]!.decklist as { cardId: string; count: number }[]).filter((e) => !pool.get(e.cardId)!.types.includes("Land")).map((e) => ({ id: e.cardId, n: e.count, per: (cast[k]?.[e.cardId] ?? 0) / played[k]! })).sort((a, b) => b.per - a.per);
  console.log(`- **${field[k]!.name}**: ${rows.map((r) => `${r.per / r.n < 0.05 ? "⚠ " : ""}${pool.get(r.id)!.name} ${r.per.toFixed(2)}`).join(", ")}`);
}
if (arg("out", "")) writeFileSync(arg("out", ""), JSON.stringify({ field: arg("field", ""), games: G, seed: seed0, maxTier, results }));
