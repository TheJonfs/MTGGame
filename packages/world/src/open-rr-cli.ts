/**
 * pnpm open:rr [--games N] [--seed S] [--shard i/n] [--only key] [--out file] | --merge file1 file2 … --out file
 *   --only key   run only the pairings that include that list (re-measuring one amended list);
 *   --merge      a LATER file's games replace an earlier file's for the same pairing.
 *   --sideboarded   post-S54: every seat plays the sixty it would bring to games two and three against that opponent
 *                (its built fifteen, the field's three rules) — run beside a plain run on the same seed.
 *   --journeyman k1,k2   S54 (ADR-158's test): those lists are piloted by journeyman (every other seat master) — run
 *                with --only on the same seed as a master run, and every game is paired with its master twin.
 *
 * S46 (Part 4): the Open's round-robin — every pair of the twelve lists (sim/open-decks), N games per pairing, seats
 * alternating, master both, 20 life, no entrances. Per game it records the winner and the reason, and per seat the
 * cards CAST (castSpell) and PLAYED (playLand — the High Grounds and the Library are lands) and, for the Loop, the
 * turn its three pieces (the Usher and an Altar on the battlefield, a Restoration Angel in hand or play) first stand
 * together plus its Altar activations. `--shard` splits the pairings across processes; `--merge` joins the shards and
 * prints the table and the reads. A Lab run holds one pairing across a grid, so this writes its own shape.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { AI_SIDEBOARD_CONSTRUCTED, aiSideboard, answersCreatures, answersRelics } from "./sideboard-ai.js";
import type { CardRatingTable } from "./rating.js";
import type { Decklist } from "./state.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEYS = Object.keys(OPEN_DECKS);

type SeatLog = { cast: Record<string, number>; played: Record<string, number>; loopTurn?: number; altarActs?: number };
type Game = { a: string; b: string; seatA: 0 | 1; winner: "a" | "b" | "draw"; reason: string; turns: number; logA: SeatLog; logB: SeatLog };

class Tracker implements Agent {
  log: SeatLog = { cast: {}, played: {} };
  constructor(private inner: Agent, private loop: boolean) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, req);
    const cardOf = (id: string) => view.hand.find((c) => c.objectId === id)?.cardId ?? view.battlefield.find((b) => b.id === id)?.cardId;
    if (a.type === "castSpell") { const c = cardOf(a.objectId); if (c) this.log.cast[c] = (this.log.cast[c] ?? 0) + 1; }
    if (a.type === "playLand") { const c = cardOf(a.objectId); if (c) this.log.played[c] = (this.log.played[c] ?? 0) + 1; }
    if (this.loop) {
      if (a.type === "activateAbility" && cardOf(a.objectId) === "altar_of_dementia") this.log.altarActs = (this.log.altarActs ?? 0) + 1;
      if (this.log.loopTurn === undefined) {
        const mine = (id: string) => view.battlefield.some((o) => o.controller === view.you && o.cardId === id);
        if (mine("the_usher") && mine("altar_of_dementia") && (mine("restoration_angel") || view.hand.some((c) => c.cardId === "restoration_angel"))) this.log.loopTurn = view.turn;
      }
    }
    return a;
  }
}

async function run(): Promise<void> {
  const pool = loadCardPool(join(ROOT, "data/cards")).cards;
  const G = Number(arg("games", "100")), seed0 = Number(arg("seed", "46")), [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const sideboarded = process.argv.includes("--sideboarded") || process.argv.includes("--sideboarded-only");
  const rating = sideboarded ? (JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable) : null;
  const fifteen = new Map<string, Decklist>();
  // `--sideboarded-only k1,k2`: only those lists sideboard (one side's swaps against the other's registered sixty)
  const boardedOnly = new Set(arg("sideboarded-only", "").split(",").filter(Boolean));
  const boarded = (me: (typeof OPEN_DECKS)[string], them: (typeof OPEN_DECKS)[string]): Decklist => {
    if (!rating || (boardedOnly.size > 0 && !boardedOnly.has(me.key))) return me.decklist;
    if (!fifteen.has(me.key)) fifteen.set(me.key, buildSideboard(me.decklist, OPEN_FORMAT, rating, pool, answersRelics, answersCreatures));
    return aiSideboard(me.decklist, fifteen.get(me.key)!, them.decklist, pool, rating, AI_SIDEBOARD_CONSTRUCTED).deck;
  };
  const only = arg("only", ""), journeyman = new Set(arg("journeyman", "").split(",").filter(Boolean));
  const pilot = (key: string) => (journeyman.has(key) ? "journeyman" : "master");
  const pairs: [string, string][] = [];
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) pairs.push([KEYS[i]!, KEYS[j]!]);
  const games: Game[] = [];
  for (let p = 0; p < pairs.length; p++) {
    if (p % sn !== si) continue;
    const [ka, kb] = pairs[p]!;
    if (only && ka !== only && kb !== only) continue;
    const A = OPEN_DECKS[ka]!, B = OPEN_DECKS[kb]!;
    for (let g = 0; g < G; g++) {
      const seatA = (g % 2) as 0 | 1;
      const seed = seed0 + p * 1009 + g * 37;
      const [d0, d1] = (seatA === 0 ? [A, B] : [B, A]).map((d, i, both) => ({ ...d, decklist: boarded(d, both[1 - i]!) })) as [typeof A, typeof B];
      const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const t0 = new Tracker(new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(pilot(d0.key), d0.archetype, [...d1.decklist], [...d0.decklist])), d0.key === "loop");
      const t1 = new Tracker(new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile(pilot(d1.key), d1.archetype, [...d0.decklist], [...d1.decklist])), d1.key === "loop");
      const r = await runMatch(spec, pool, [t0, t1]);
      const tA = seatA === 0 ? t0 : t1, tB = seatA === 0 ? t1 : t0;
      games.push({ a: ka, b: kb, seatA, winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", reason: r.reason, turns: r.turns, logA: tA.log, logB: tB.log });
    }
    console.error(`shard ${si}/${sn}: ${ka} vs ${kb} done`);
  }
  const out = arg("out", join(ROOT, `analysis/runs/open_rr_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ games: G, seed: seed0, shard: `${si}/${sn}`, results: games }));
}

function merge(): void {
  const files = process.argv.slice(process.argv.indexOf("--merge") + 1).filter((f) => !f.startsWith("--") && f !== arg("out", ""));
  // A later file replaces an earlier one's games for the same pairing (an amended list re-measured with --only).
  const byPair = new Map<string, Game[]>();
  for (const f of files) {
    const fresh = new Map<string, Game[]>();
    for (const g of (JSON.parse(readFileSync(f, "utf8")) as { results: Game[] }).results) { const k = `${g.a}|${g.b}`; (fresh.get(k) ?? fresh.set(k, []).get(k)!).push(g); }
    for (const [k, v] of fresh) byPair.set(k, v);
  }
  const games: Game[] = [...byPair.values()].flat();
  const wins: Record<string, Record<string, [number, number]>> = {};
  const logs: Record<string, SeatLog[]> = {};
  const decked: Record<string, { wins: number; byLibrary: number }> = {};
  for (const g of games) {
    for (const [me, them, won, log] of [[g.a, g.b, g.winner === "a", g.logA], [g.b, g.a, g.winner === "b", g.logB]] as const) {
      const cell = ((wins[me] ??= {})[them] ??= [0, 0]);
      cell[0] += won ? 1 : 0; cell[1] += 1;
      (logs[me] ??= []).push(log);
      const d = (decked[me] ??= { wins: 0, byLibrary: 0 });
      if (won) { d.wins += 1; if (g.reason === "DECKED") d.byLibrary += 1; }
    }
  }
  const pct = (w: number, n: number) => (n ? Math.round((100 * w) / n) : 0);
  const lines: string[] = [];
  lines.push(`# The Open's round-robin (S46) — ${games.length} games, master both, 20 life, no entrances; the ROW's win rate\n`);
  lines.push(`| | ${KEYS.join(" | ")} | **mean** |`, `|---|${KEYS.map(() => "---").join("|")}|---|`);
  const means: Record<string, number> = {};
  for (const r of KEYS) {
    let w = 0, n = 0;
    const cells = KEYS.map((c) => { if (c === r) return "—"; const x = wins[r]?.[c] ?? [0, 0]; w += x[0]; n += x[1]; return `${pct(x[0], x[1])}`; });
    means[r] = pct(w, n);
    lines.push(`| **${r}** | ${cells.join(" | ")} | **${means[r]}** |`);
  }
  lines.push(`\nSolvable (a list over 65% against the field): ${KEYS.filter((k) => means[k]! > 65).join(", ") || "none"}. Under 35%: ${KEYS.filter((k) => means[k]! < 35).join(", ") || "none"}.`);
  const mw = wins.muster?.warband ?? [0, 0];
  lines.push(`Muster vs Warband: the Muster ${pct(mw[0], mw[1])}% (${mw[1]} games).`);
  const u = decked.undertow;
  if (u) lines.push(`The Undertow's wins by library: ${u.byLibrary} of ${u.wins} (${pct(u.byLibrary, u.wins)}%).`);
  lines.push(`\n## Restricted cards — % of the list's games in which it was cast (or, a land, played)\n`);
  const restricted = OPEN_FORMAT.rule.restricted!;
  for (const k of KEYS) {
    const has = OPEN_DECKS[k]!.decklist.filter((e) => restricted.includes(e.cardId)).map((e) => e.cardId);
    if (!has.length) continue;
    const L = logs[k] ?? [];
    lines.push(`- **${k}**: ${has.map((c) => `${c} ${pct(L.filter((l) => (l.cast[c] ?? 0) + (l.played[c] ?? 0) > 0).length, L.length)}%`).join(" · ")}`);
  }
  const KEY: Record<string, string[]> = {
    coin: ["the_usher", "blood_artist", "bitterblossom"], undertow: ["hedron_crab", "zinnia_the_undertow", "traumatizer"], larder: ["entomb", "buried_alive", "zombify", "graceful_restoration"],
    muster: ["glorious_anthem", "vitalist", "emeria_angel"], warband: ["siege_gang_commander", "goblin_chieftain", "goblin_grenade"], tally: ["young_pyromancer", "guttersnipe", "ponder"],
    locks: ["the_dredger", "counterspell", "wrath_of_god"], wurmspeaker: ["seedborn_muse", "rampaging_baloths", "gaean_wurm"], ford: ["the_fordkeeper", "vitalist", "spirit_link"],
    enchantress: ["ovna_the_enchantress", "angelic_destiny", "rancor"], levy: ["emeria_angel", "dread_presence", "isaura_the_levy"], loop: ["the_usher", "restoration_angel", "altar_of_dementia"],
  };
  lines.push(`\n## Key pieces — % of the list's games in which each was cast (a weak pilot reads apart from a weak list)\n`);
  for (const k of KEYS) { const L = logs[k] ?? []; lines.push(`- **${k}**: ${(KEY[k] ?? []).map((c) => `${c} ${pct(L.filter((l) => (l.cast[c] ?? 0) > 0).length, L.length)}%`).join(" · ")}`); }
  const loop = logs.loop ?? [];
  const by10 = loop.filter((l) => l.loopTurn !== undefined && l.loopTurn <= 10).length;
  lines.push(`\n## The Loop — the Usher + an Altar on the battlefield with a Restoration Angel in hand or play\n`);
  lines.push(`Assembled by turn ten in ${by10} of ${loop.length} games (${pct(by10, loop.length)}%); ever: ${loop.filter((l) => l.loopTurn !== undefined).length}. Altar activations per game: ${(loop.reduce((n, l) => n + (l.altarActs ?? 0), 0) / Math.max(1, loop.length)).toFixed(2)}.`);
  const text = lines.join("\n");
  console.log(text);
  const out = arg("out", join(ROOT, "analysis/runs/open_rr_1.json"));
  writeFileSync(out, JSON.stringify({ name: "open_rr_1", when: new Date().toISOString(), games: games.length, table: wins, means, report: text }, null, 1));
  writeFileSync(out.replace(/\.json$/, ".md"), text + "\n");
}

if (process.argv.includes("--merge")) merge();
else await run();
