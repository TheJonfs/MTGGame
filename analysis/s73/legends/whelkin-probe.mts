/**
 * S73a (Chris, 2026-11-19) — Whelkin's Snails: 0/3 or 1/3?
 *   npx tsx analysis/s73/legends/whelkin-probe.mts --list f.json [--base g.json] --games 16 --shard i/n --out o.json
 *   npx tsx analysis/s73/legends/whelkin-probe.mts --report o_?.json
 * A study list holding Whelkin against every active list of the Open, game ones, on the same seeds and seats:
 *   base — (with --base) the list without Whelkin, for what the card adds at all;
 *   t03  — the Snail tokens 0/3, as written;
 *   t13  — the Snail tokens 1/3 (the token's power set to one in this run's copy of the pool; nothing on disk changes).
 * The pilot as it is: it takes the tokens at every trigger (its rule for a token mode) and never the untap.
 * Recorded: Whelkin casts, Snails made, Snail attacks, Snail mill activations (beside Silt Spirit), Ranksmere copies,
 * and how the game ended. A probe, not a rule (ADR-167).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { FORMAT_DECKS } from "../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const SNAIL = "snail_0_3_wu";
type Arm = "base" | "t03" | "t13";
interface Rec { arm: Arm; opp: string; g: number; won: number; reason: string; turns: number; whelkinCasts: number; whelkinTurn: number | null; myTurns: number; snails: number; snailAttacks: number; snailMills: number; copies: number; modes: Record<string, number>; maxSnails: number }

class Probe implements Agent {
  private turnSeen = -1;
  constructor(private inner: HeuristicAgent, public rec: Rec) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you, rec = this.rec;
    if (view.turn !== this.turnSeen) { this.turnSeen = view.turn; if (view.activePlayer === me) rec.myTurns += 1; }
    rec.maxSnails = Math.max(rec.maxSnails, view.battlefield.filter((o) => o.controller === me && o.cardId === SNAIL).length);
    const a = await this.inner.chooseAction(view, req);
    const idOf = (x: Action) => { const o = (x as { objectId?: string }).objectId; return view.hand.find((h) => h.objectId === o)?.cardId ?? view.battlefield.find((b) => b.id === o)?.cardId ?? ""; };
    if (a.type === "castSpell" && idOf(a) === "whelkin") { rec.whelkinCasts += 1; if (rec.whelkinTurn === null) rec.whelkinTurn = rec.myTurns; }
    if (a.type === "chooseMode" && req.source?.cardId === "whelkin") { const k = a.label.startsWith("Create") ? "tokens" : "untap"; rec.modes[k] = (rec.modes[k] ?? 0) + 1; if (k === "tokens") rec.snails += 2; }
    if (a.type === "declareAttacker" && idOf(a) === SNAIL) rec.snailAttacks += 1;
    if (a.type === "activateAbility" && idOf(a) === SNAIL) rec.snailMills += 1;
    if (a.type === "activateAbility" && idOf(a) === "ranksmere" && ((a as { targets?: unknown[] }).targets ?? []).length > 0) rec.copies += 1;
    return a;
  }
}

async function run(): Promise<void> {
  const pool = loadCardPool(ROOT + "data/cards").cards, D = FORMAT_DECKS.open!;
  const pool13 = new Map(pool); pool13.set(SNAIL, { ...pool.get(SNAIL)!, power: 1 });
  const read = (f: string) => { const l = JSON.parse(readFileSync(f, "utf8")) as { cardId: string; count: number }[]; if (l.reduce((n, e) => n + e.count, 0) !== 60) throw new Error(`${f} is not sixty`); for (const e of l) if (!pool.has(e.cardId)) throw new Error(`no card ${e.cardId}`); return l; };
  const list = read(arg("list", "")), base = arg("base", "") ? read(arg("base", "")) : null;
  const opps = Object.keys(D).filter((k) => !D[k]!.archived), G = Number(arg("games", "16"));
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const out: Rec[] = [];
  for (const [oi, ok] of opps.entries()) {
    if (oi % sn !== si) continue;
    for (let g = 0; g < G; g++) for (const arm of [...(base ? ["base" as const] : []), "t03" as const, "t13" as const]) {
      const cards = arm === "t13" ? pool13 : pool;
      const A = { key: "study", archetype: arg("archetype", "midrange"), decklist: arm === "base" ? base! : list }, B = D[ok]!;
      const seatA = g % 2, seed = 8821 + oi * 1009 + g * 37, [d0, d1] = seatA === 0 ? [A, B] : [B, A];
      const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
      const h = (s: number, d: { archetype: string; decklist: readonly { cardId: string; count: number }[] }, o: typeof d) => new HeuristicAgent(s, cards, difficultyProfile("master", d.archetype as never, [...o.decklist], [...d.decklist]));
      const h0 = h(seed * 2 + 1, d0, d1), h1 = h(seed * 2 + 2, d1, d0);
      const rec: Rec = { arm, opp: ok, g, won: 0, reason: "", turns: 0, whelkinCasts: 0, whelkinTurn: null, myTurns: 0, snails: 0, snailAttacks: 0, snailMills: 0, copies: 0, modes: {}, maxSnails: 0 };
      const probe = new Probe(seatA === 0 ? h0 : h1, rec);
      const r = await runMatch(spec, cards, seatA === 0 ? [probe, h1] : [h0, probe]);
      rec.won = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0; rec.turns = r.turns; rec.reason = String(r.reason); out.push(rec);
    }
    console.error(`shard ${si}/${sn}: ${ok} done`);
  }
  writeFileSync(arg("out", "whelkin.json"), JSON.stringify({ list: arg("list", ""), results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN), pct = (n: number, d: number) => (d ? (100 * n) / d : 0).toFixed(1) + "%";
  const ARMS = (["base", "t03", "t13"] as Arm[]).filter((a) => all.some((r) => r.arm === a)), by = ARMS.map((a) => all.filter((r) => r.arm === a));
  const NAME: Record<Arm, string> = { base: "without Whelkin", t03: "Snails 0/3", t13: "Snails 1/3" };
  const L: string[] = [`# Whelkin's Snails — ${(JSON.parse(readFileSync(files[0]!, "utf8")) as { list: string }).list.split("/").pop()}: ${by[0]!.length} game ones an arm against the Open's ${new Set(all.map((r) => r.opp)).size} lists\n`];
  L.push(`| | ${ARMS.map((a) => NAME[a]).join(" | ")} |\n|---|${ARMS.map(() => "---").join("|")}|`);
  const row = (label: string, f: (rs: Rec[]) => string) => L.push(`| ${label} | ${by.map(f).join(" | ")} |`);
  row("**games won**", (rs) => `**${pct(rs.reduce((n, r) => n + r.won, 0), rs.length)}**`);
  row("Whelkin cast (share of games; mean turn)", (rs) => { const c = rs.filter((r) => r.whelkinTurn !== null); return c.length ? `${pct(c.length, rs.length)}; ${mean(c.map((r) => r.whelkinTurn!)).toFixed(1)}` : "—"; });
  row("won, games Whelkin was cast", (rs) => { const c = rs.filter((r) => r.whelkinTurn !== null); return c.length ? pct(c.reduce((n, r) => n + r.won, 0), c.length) : "—"; });
  row("won, games it was not", (rs) => { const c = rs.filter((r) => r.whelkinTurn === null); return pct(c.reduce((n, r) => n + r.won, 0), c.length); });
  row("Snails made a game (most on the battlefield at once, mean)", (rs) => `${mean(rs.map((r) => r.snails)).toFixed(2)} (${mean(rs.map((r) => r.maxSnails)).toFixed(2)})`);
  row("Snail attacks a game", (rs) => mean(rs.map((r) => r.snailAttacks)).toFixed(2));
  row("Snail mill activations a game", (rs) => mean(rs.map((r) => r.snailMills)).toFixed(2));
  row("Ranksmere copies a game", (rs) => mean(rs.map((r) => r.copies)).toFixed(2));
  row("the trigger's modes (tokens / untap)", (rs) => `${rs.reduce((n, r) => n + (r.modes.tokens ?? 0), 0)} / ${rs.reduce((n, r) => n + (r.modes.untap ?? 0), 0)}`);
  row("game length (turns, mean)", (rs) => mean(rs.map((r) => r.turns)).toFixed(1));
  row("how the wins came", (rs) => { const c: Record<string, number> = {}; for (const r of rs.filter((x) => x.won === 1)) c[r.reason] = (c[r.reason] ?? 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(", "); });
  const key = (r: Rec) => `${r.opp}|${r.g}`;
  const paired = (x: Arm, y: Arm) => { const X = all.filter((r) => r.arm === x), Y = new Map(all.filter((r) => r.arm === y).map((r) => [key(r), r])); const d = X.map((r) => Y.get(key(r))!.won - r.won), m = mean(d), sd = Math.sqrt(d.reduce((n, v) => n + (v - m) ** 2, 0) / (d.length - 1)); return `${(100 * m >= 0 ? "+" : "") + (100 * m).toFixed(1)} ± ${(196 * sd / Math.sqrt(d.length)).toFixed(1)}`; };
  L.push(`\nPaired, 1/3 less 0/3: **${paired("t03", "t13")}** points of game-one win rate.` + (ARMS.includes("base") ? ` Whelkin (0/3) less the list without it: **${paired("base", "t03")}**; (1/3): **${paired("base", "t13")}**.` : ""));
  L.push(`\n## By opponent\n\n| opponent | ${ARMS.map((a) => NAME[a]).join(" | ")} |\n|---|${ARMS.map(() => "---").join("|")}|`);
  for (const o of [...new Set(all.map((r) => r.opp))]) L.push(`| ${o} | ${by.map((rs) => { const x = rs.filter((r) => r.opp === o); return pct(x.reduce((n, r) => n + r.won, 0), x.length); }).join(" | ")} |`);
  console.log(L.join("\n"));
}
if (process.argv.includes("--report")) report(); else await run();
