/**
 * pnpm combo-probe [--list pall] [--games 60] [--seed 9000] [--boarded] [--no-plan] [--swap from:n:to] [--shard i/n] [--out file]
 * pnpm combo-probe --report file1 file2 …
 *
 * S55 (Part 4): a combo list against every other Open list — how often and how early its loop fires, its win rate,
 * what its setup buries, what its fuel pays for and what its start is aimed at. Master both sides, 20 life, seats
 * alternating; `--boarded` plays the post-sideboard sixties on both sides (the field's fifteen and its four rules, the
 * list's own fifteen); `--no-plan` pilots the list without its plan (the S54 baseline). Turns are the list's OWN turns.
 * `--swap the_jet_witch:3:hypnotic_specter` replaces n copies of a card IN PLACE (the same slot of the list, so the
 * same shuffle: card-test's paired method) — run beside a plain run on the same seed and compare game by game.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, matchPlan, PLANS } from "@shandalar/agents";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { AI_SIDEBOARD_CONSTRUCTED, aiSideboard, answersCreatures, answersRelics } from "./sideboard-ai.js";
import type { CardRatingTable } from "./rating.js";
import type { Decklist } from "./state.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
interface Row { opp: string; won: boolean; reason: string; myTurns: number; loopTurn: number; readyTurn: number; firstSetup: number; buried: string[][]; fuelFor: string[]; startTargets: string[]; digDraws: number; cast: Record<string, number>; oppCast: Record<string, number>; oppExiles: number }

async function play(): Promise<void> {
  const pool = loadCardPool(join(ROOT, "data/cards")).cards;
  const key = arg("list", "pall"), listed = OPEN_DECKS[key]; if (!listed) throw new Error(`combo-probe: no list ${key}`);
  const swap = arg("swap", "");
  const me = swap ? (() => { const [from, n, to] = swap.split(":") as [string, string, string]; if (!pool.has(to)) throw new Error(`combo-probe: no card ${to}`);
    return { ...listed, decklist: listed.decklist.flatMap((e) => (e.cardId === from ? [{ cardId: from, count: e.count - Number(n) }, { cardId: to, count: Number(n) }].filter((x) => x.count > 0) : [e])) }; })() : listed;
  const plan = matchPlan(me.decklist, PLANS); if (!plan) throw new Error(`combo-probe: ${key} has no plan`);
  const G = Number(arg("games", "60")), seed0 = Number(arg("seed", "9000")), [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const boarded = process.argv.includes("--boarded"), noPlan = process.argv.includes("--no-plan");
  const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
  const fifteen = (l: (typeof OPEN_DECKS)[string]): Decklist => (l.sideboard ? [...l.sideboard] : buildSideboard(l.decklist, OPEN_FORMAT, rating, pool, answersRelics, answersCreatures));
  const sixty = (a: (typeof OPEN_DECKS)[string], b: (typeof OPEN_DECKS)[string]): Decklist => (boarded ? aiSideboard(a.decklist, fifteen(a), b.decklist, pool, rating, AI_SIDEBOARD_CONSTRUCTED).deck : a.decklist);
  const others = Object.keys(OPEN_DECKS).filter((k) => k !== key), rows: Row[] = [];
  for (let k = 0; k < others.length; k++) {
    if (k % sn !== si) continue;
    const opp = OPEN_DECKS[others[k]!]!;
    const mine = sixty(me, opp), theirs = sixty(opp, me);
    for (let g = 0; g < G; g++) {
      const seat = (g % 2) as 0 | 1, seed = seed0 + k * 131 + g * 17;
      const pm = { name: key, decklist: mine, agent: "x" }, pt = { name: opp.key, decklist: theirs, agent: "x" };
      const spec = { seed, players: seat === 0 ? [pm, pt] : [pt, pm], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const row: Row = { opp: opp.key, won: false, reason: "", myTurns: 0, loopTurn: 0, readyTurn: 0, firstSetup: 0, buried: [], fuelFor: [], startTargets: [], digDraws: 0, cast: {}, oppCast: {}, oppExiles: 0 };
      let lastTurn = -1, fuelPending = false, turnStartOpp = 20, watch: string[] | null = null;
      const inner = new HeuristicAgent(seed * 2 + 1 + seat, pool, difficultyProfile("master", noPlan ? "midrange" : me.archetype, [...theirs], noPlan ? undefined : [...mine]));
      const pilot: Agent = { chooseAction: async (v, r) => {
        if (v.activePlayer === seat && v.turn !== lastTurn) { lastTurn = v.turn; row.myTurns += 1; turnStartOpp = v.life[1 - seat]!; }
        const hand = v.hand.map((h) => h.cardId), yard = v.graveyards[seat]!, pieces = yard.filter((c) => c === plan.piece).length;
        if (watch && v.stack.length === 0) { const added = [...yard]; for (const c of watch) { const i = added.indexOf(c); if (i >= 0) added.splice(i, 1); } const cr = added.filter((c) => !plan.setup.some((s) => s.card === c)); if (cr.length) { row.buried.push(cr.sort()); watch = null; } }
        const onField = v.battlefield.some((b) => b.controller === seat && b.cardId === plan.piece);
        const ready = (hand.includes(plan.piece) && (pieces >= 1 || onField || v.graveyards[1 - seat]!.includes(plan.piece))) || (plan.start.some((s) => s.card !== plan.piece && (hand.includes(s.card) || v.battlefield.some((b) => b.controller === seat && b.cardId === s.card))) && (pieces >= 2 || (pieces >= 1 && onField))) || (plan.setup.some((s) => hand.includes(s.card)) && plan.start.some((s) => hand.includes(s.card)));
        if (ready && !row.readyTurn) row.readyTurn = Math.max(1, row.myTurns);
        if (!row.loopTurn && turnStartOpp - v.life[1 - seat]! >= 12) row.loopTurn = Math.max(1, row.myTurns);
        const a = await inner.chooseAction(v, r);
        const id = (a as { objectId?: string }).objectId;
        const cid = id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined;
        if (a.type === "castSpell" && cid) {
          row.cast[cid] = (row.cast[cid] ?? 0) + 1;
          if (fuelPending && !plan.fuel.includes(cid)) { row.fuelFor.push(cid); fuelPending = false; }
          if (plan.fuel.includes(cid) && pool.get(cid)!.types.includes("Instant")) fuelPending = true;
          if (plan.setup.some((s) => s.card === cid)) { if (!row.firstSetup) row.firstSetup = Math.max(1, row.myTurns); watch = [...yard]; }
          if (plan.start.some((s) => s.card === cid && s.card !== plan.piece)) { const t = (a as { targets?: { id?: string }[] }).targets?.[0]?.id; row.startTargets.push([...v.graveyardObjects[0], ...v.graveyardObjects[1]].find((o) => o.objectId === t)?.cardId ?? "?"); }
        }
        if (a.type === "pass" && fuelPending && v.stack.length === 0) { row.fuelFor.push("(nothing)"); fuelPending = false; }
        if (a.type === "activateAbility" && cid && plan.dig.includes(cid)) row.digDraws += 1;
        return a;
      } };
      const oi = new HeuristicAgent(seed * 2 + 2 - seat, pool, difficultyProfile("master", opp.archetype, [...mine], [...theirs]));
      const oppAgent: Agent = { chooseAction: async (v, r) => { const a = await oi.chooseAction(v, r); const id = (a as { objectId?: string }).objectId; const cid = id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined; if (cid && (a.type === "castSpell" || a.type === "activateAbility")) { row.oppCast[cid] = (row.oppCast[cid] ?? 0) + 1; if (a.type === "activateAbility" && (cid === "tormods_crypt" || cid === "faerie_macabre")) row.oppExiles += 1; } return a; } };
      const res = await runMatch(spec, pool, seat === 0 ? [pilot, oppAgent] : [oppAgent, pilot]);
      row.won = res.winner === seat; row.reason = res.reason;
      rows.push(row);
    }
    console.error(`shard ${si}/${sn}: ${key} v ${opp.key} done`);
  }
  const out = arg("out", join(ROOT, `analysis/runs/combo_${key}_${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ list: key, boarded, noPlan, games: G, rows }));
}

function report(): void {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as { list: string; boarded: boolean; noPlan: boolean; rows: Row[] });
  const r = runs.flatMap((x) => x.rows), n = r.length, head = runs[0]!;
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0; };
  const count = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const L: string[] = [`# ${head.list} against the field — ${n} games, master both${head.boarded ? ", both sides sideboarded" : ", registered sixties"}${head.noPlan ? ", piloted WITHOUT its plan" : ""}\n`];
  const wins = r.filter((x) => x.won), loops = r.filter((x) => x.loopTurn > 0);
  L.push(`- **Win rate ${pct(wins.length, n)}.** The loop fires in **${pct(loops.length, n)}** of games (${pct(loops.filter((x) => x.won).length, wins.length)} of wins), on the deck's own turn **${med(loops.map((x) => x.loopTurn))}** (median); by turn 3 in ${pct(loops.filter((x) => x.loopTurn <= 3).length, n)} of games, by turn 4 in ${pct(loops.filter((x) => x.loopTurn <= 4).length, n)}.`);
  const byOpp = new Map<string, Row[]>(); for (const x of r) (byOpp.get(x.opp) ?? byOpp.set(x.opp, []).get(x.opp)!).push(x);
  L.push(`- By opponent (win % · loop %): ${[...byOpp.entries()].sort((a, b) => b[1].filter((x) => x.won).length / b[1].length - a[1].filter((x) => x.won).length / a[1].length).map(([k, v]) => `${k} ${Math.round((100 * v.filter((x) => x.won).length) / v.length)}·${Math.round((100 * v.filter((x) => x.loopTurn).length) / v.length)}`).join(", ")}.`);
  const ready = r.filter((x) => x.readyTurn > 0);
  L.push(`- Both halves available in ${pct(ready.length, n)} of games, by own turn ${med(ready.map((x) => x.readyTurn))} (median); the loop then started in ${pct(ready.filter((x) => x.loopTurn).length, ready.length)} of those.`);
  const setups = r.filter((x) => x.firstSetup > 0);
  L.push(`- The setup is cast in ${pct(setups.length, n)} of games, first on own turn ${med(setups.map((x) => x.firstSetup))} (median). What it buries: ${count(r.flatMap((x) => x.buried.map((b) => b.join(" + ")))).slice(0, 5).map(([k, v]) => `${k} ×${v}`).join("; ") || "–"}.`);
  const hist = (xs: number[]) => count(xs.map(String)).sort((x, y) => Number(x[0]) - Number(y[0])).map(([k, v]) => `t${k}:${v}`).join(" ");
  L.push(`- Own turn of the first setup: ${hist(setups.map((x) => x.firstSetup))}. Own turn of the loop: ${hist(loops.map((x) => x.loopTurn))}.`);
  L.push(`- The fuel spell pays for: ${count(r.flatMap((x) => x.fuelFor)).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(", ") || "–"}.`);
  L.push(`- The start is aimed at: ${count(r.flatMap((x) => x.startTargets)).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(", ") || "–"}.`);
  L.push(`- Casts a game: ${[...new Set(r.flatMap((x) => Object.keys(x.cast)))].map((c) => [c, r.reduce((k, x) => k + (x.cast[c] ?? 0), 0) / n] as const).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(", ")}.`);
  L.push(`- Dig activations a game: ${(r.reduce((a, x) => a + x.digDraws, 0) / n).toFixed(2)}; none in ${pct(r.filter((x) => !x.digDraws).length, n)} of games.`);
  L.push(`- The opponent's graveyard exile used in ${pct(r.filter((x) => x.oppExiles > 0).length, n)} of games; the list won ${pct(r.filter((x) => x.oppExiles > 0 && x.won).length, r.filter((x) => x.oppExiles > 0).length)} of those.`);
  L.push(`- Results: wins ${count(wins.map((x) => x.reason)).map(([k, v]) => `${k} ${v}`).join(", ")}; losses ${count(r.filter((x) => !x.won).map((x) => x.reason)).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
  const text = L.join("\n");
  if (process.argv.includes("--report-name")) writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", "combo")}.md`), text + "\n");
  console.log(text);
}

if (process.argv.includes("--report")) report(); else await play();
