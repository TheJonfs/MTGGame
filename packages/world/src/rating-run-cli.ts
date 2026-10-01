/**
 * pnpm rating:run [--offsets K] [--games G] [--seed S] [--shard i/n] [--out file]
 *
 * S47 (Part 2): the card rating's measurement — every authored list (authored-lists.ts) against K·2 others at EVEN
 * entrances (20 life, master both, no bonuses; seats alternating), G games a pairing. The campaign's sweeps on disk
 * are text at lopsided entrances and the Open's round-robin logs casts but not draws, so the rating is measured fresh
 * (Chris, S47 kickoff). The schedule is a seeded circulant: the lists are shuffled once, and list i meets i+1 … i+K —
 * every list gets exactly 2K opponents. Per game and seat: the cards SEEN in hand and the cards CAST or PLAYED.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { authoredLists } from "./authored-lists.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export type RatingGame = { a: string; b: string; winner: "a" | "b" | "draw"; reason: string; turns: number; seenA: string[]; usedA: string[]; seenB: string[]; usedB: string[] };

class Tracker implements Agent {
  seen = new Set<string>(); used = new Set<string>();
  constructor(private inner: Agent) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    for (const c of view.hand) this.seen.add(c.cardId);
    const a = await this.inner.chooseAction(view, req);
    if (a.type === "castSpell" || a.type === "playLand") { const c = view.hand.find((h) => h.objectId === a.objectId)?.cardId; if (c) this.used.add(c); }
    return a;
  }
}

const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const K = Number(arg("offsets", "20")), G = Number(arg("games", "6")), seed0 = Number(arg("seed", "47")), [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
const lists = authoredLists(ROOT);
let rs = seed0 >>> 0; const rng = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32 — the schedule only
const order = lists.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
const pairs: [number, number][] = [];
for (let i = 0; i < order.length; i++) for (let d = 1; d <= K; d++) pairs.push([order[i]!, order[(i + d) % order.length]!]);
const games: RatingGame[] = [];
for (let p = 0; p < pairs.length; p++) {
  if (p % sn !== si) continue;
  const A = lists[pairs[p]![0]]!, B = lists[pairs[p]![1]]!;
  for (let g = 0; g < G; g++) {
    const seatA = g % 2, seed = seed0 + p * 1009 + g * 37;
    const [d0, d1] = seatA === 0 ? [A, B] : [B, A];
    const spec = { seed, players: [{ name: d0.key, decklist: d0.decklist, agent: "heuristic:master" }, { name: d1.key, decklist: d1.decklist, agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
    const t0 = new Tracker(new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("master", d0.archetype, d1.decklist)));
    const t1 = new Tracker(new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", d1.archetype, d0.decklist)));
    const r = await runMatch(spec, pool, [t0, t1]);
    const tA = seatA === 0 ? t0 : t1, tB = seatA === 0 ? t1 : t0;
    games.push({ a: A.key, b: B.key, winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", reason: r.reason, turns: r.turns, seenA: [...tA.seen], usedA: [...tA.used], seenB: [...tB.seen], usedB: [...tB.used] });
  }
  if (p % 100 === si) console.error(`shard ${si}/${sn}: pairing ${p}/${pairs.length}`);
}
const out = arg("out", join(ROOT, `analysis/runs/rating_shard${si}.json`));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ offsets: K, games: G, seed: seed0, shard: `${si}/${sn}`, lists: lists.length, results: games }));
