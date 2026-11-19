/**
 * S73a (Chris, 2026-11-19) — Hydroilaur and Time Walk: how often does the loop assemble?
 *   npx tsx analysis/s73/legends/hydro-probe.mts --games 20 --shard i/n --out f.json     then  --report f.json …
 * The study list (hydro-list.json: a Sultai ramp shell — four Hydroilaur, four Order Druid, one Time Walk, one Demonic
 * Tutor, four Brainstorm, the Moxen) against every active list of the Open, game ones, twice on the same seeds:
 *   base  — the pilot as it is (no book knows either card);
 *   combo — the same pilot with the loop's decisions made for it: the Druid and the Tutor find the missing piece,
 *           Hydroilaur attacks every turn it can, its trigger returns Time Walk when Time Walk is in the graveyard
 *           (else fights when a creature is across the table), and Time Walk is cast in the second main phase.
 * The loop: attack, return Time Walk, cast it, take the extra turn, attack again. Recorded per game: when Hydroilaur
 * first held the battlefield and how it got there, when both pieces were first together, each Time Walk cast with the
 * Hydra in play, the longest run of consecutive turns, and whether the Hydra left the battlefield. A probe, not a rule
 * (ADR-167): it lives outside packages/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { FORMAT_DECKS } from "../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const HYDRA = "hydroilaur", WALK = "time_walk";
interface Rec { arm: "base" | "combo"; opp: string; g: number; won: number; turns: number; myTurns: number; hydraTurn: number | null; hydraBy: string | null; togetherTurn: number | null; walks: number; walksWithHydra: number; firstLoopTurn: number | null; longestRun: number; hydraLeft: number; hydraCasts: number; druidFinds: number; returns: Record<string, number>; fights: number; modes: Record<string, number> }

class Probe implements Agent {
  private turnSeen = -1; private run = 0; private lastMine = false; private hadHydra = false; private declared = -1;
  constructor(private inner: HeuristicAgent, private combo: boolean, public rec: Rec) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you, rec = this.rec;
    const hydra = view.battlefield.some((o) => o.controller === me && o.cardId === HYDRA);
    const yard = (view.graveyardObjects?.[me] ?? []) as { objectId: string; cardId: string }[];
    const walkHand = view.hand.some((h) => h.cardId === WALK), walkYard = yard.some((y) => y.cardId === WALK);
    if (view.turn !== this.turnSeen) {
      this.turnSeen = view.turn;
      if (view.activePlayer === me) { rec.myTurns += 1; this.run = this.lastMine ? this.run + 1 : 1; rec.longestRun = Math.max(rec.longestRun, this.run); this.lastMine = true; } else this.lastMine = false;
    }
    if (hydra && rec.hydraTurn === null) rec.hydraTurn = rec.myTurns;
    if (this.hadHydra && !hydra && rec.walksWithHydra > 0) rec.hydraLeft += 1; // only once the loop has started
    this.hadHydra = hydra;
    if (hydra && (walkHand || walkYard) && rec.togetherTurn === null) rec.togetherTurn = rec.myTurns;
    const idOf = (x: Action) => { const o = (x as { objectId?: string }).objectId; return view.hand.find((h) => h.objectId === o)?.cardId ?? view.battlefield.find((b) => b.id === o)?.cardId ?? ""; };
    let a: Action | undefined;
    if (this.combo) {
      if (req.purpose === "chooseMode" && req.source?.cardId === HYDRA) {
        const modes = req.actions.filter((x) => x.type === "chooseMode") as Extract<Action, { type: "chooseMode" }>[];
        const ret = modes.find((m) => m.label.startsWith("Return")), fight = modes.find((m) => m.label.includes("fights"));
        a = walkYard && ret ? ret : fight ?? ret;
      } else if (req.purpose === "chooseTarget" && req.source?.cardId === HYDRA) {
        const want = yard.find((y) => y.cardId === WALK) ?? yard.find((y) => y.cardId === "black_lotus");
        if (want) a = req.actions.find((x) => ((x as { targets?: { id?: string }[] }).targets ?? []).some((t) => t.id === want.objectId));
      } else if (req.purpose === "searchLibrary") {
        const picks = req.actions.filter((x) => x.type === "searchPick") as Extract<Action, { type: "searchPick" }>[];
        const card = (p: (typeof picks)[number]) => req.revealed?.find((r) => r.objectId === p.objectId)?.cardId;
        const hydraHand = view.hand.some((h) => h.cardId === HYDRA);
        if (req.source?.cardId === "order_druid" && !hydra) a = picks.find((p) => card(p) === HYDRA);
        if (req.source?.cardId === "demonic_tutor") a = (hydra || hydraHand) && !walkHand && !walkYard ? picks.find((p) => card(p) === WALK) : !hydra && !hydraHand ? picks.find((p) => card(p) === HYDRA) : picks.find((p) => card(p) === WALK);
      } else if (req.purpose === "declareAttacker" && this.declared !== view.turn) {
        a = req.actions.find((x) => x.type === "declareAttacker" && idOf(x) === HYDRA);
        if (a) this.declared = view.turn;
      } else if (req.purpose === "priority" && view.activePlayer === me && view.stack.length === 0 && hydra && view.step === "MAIN2") {
        a = req.actions.find((x) => x.type === "castSpell" && idOf(x) === WALK);
      }
    }
    if (!a) {
      a = await this.inner.chooseAction(view, req);
      // the combo arm holds Time Walk for the second main phase while the Hydra is in play
      if (this.combo && hydra && a.type === "castSpell" && idOf(a) === WALK && view.step !== "MAIN2") a = req.actions.find((x) => x.type === "pass") ?? a;
    }
    if (a.type === "castSpell" && idOf(a) === WALK) { rec.walks += 1; if (hydra) { rec.walksWithHydra += 1; if (rec.firstLoopTurn === null) rec.firstLoopTurn = rec.myTurns; } }
    if (a.type === "castSpell" && idOf(a) === HYDRA) { rec.hydraCasts += 1; if (rec.hydraBy === null) rec.hydraBy = "cast"; }
    if (a.type === "searchPick" && req.source?.cardId === "order_druid" && req.revealed?.find((r) => r.objectId === (a as { objectId: string }).objectId)?.cardId === HYDRA) { rec.druidFinds += 1; if (rec.hydraBy === null) rec.hydraBy = "druid"; }
    if (a.type === "chooseMode" && req.source?.cardId === HYDRA) { const k = a.label.startsWith("Return") ? "return" : "fight"; rec.modes[k] = (rec.modes[k] ?? 0) + 1; }
    if (req.purpose === "chooseTarget" && req.source?.cardId === HYDRA) { const t = ((a as { targets?: { id?: string }[] }).targets ?? [])[0]?.id; const c = yard.find((y) => y.objectId === t)?.cardId; if (c) rec.returns[c] = (rec.returns[c] ?? 0) + 1; }
    return a;
  }
}

async function run(): Promise<void> {
  const cards = loadCardPool(ROOT + "data/cards").cards, D = FORMAT_DECKS.open!;
  const list = JSON.parse(readFileSync(arg("list", ROOT + "analysis/s73/legends/hydro-list.json"), "utf8")) as { cardId: string; count: number }[];
  if (list.reduce((n, e) => n + e.count, 0) !== 60) throw new Error("the study list is not sixty");
  for (const e of list) if (!cards.has(e.cardId)) throw new Error(`no card ${e.cardId}`);
  const A = { key: "hydro", archetype: "midrange" as const, decklist: list };
  const opps = Object.keys(D).filter((k) => !D[k]!.archived), G = Number(arg("games", "20"));
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const out: Rec[] = [];
  for (const [oi, ok] of opps.entries()) {
    if (oi % sn !== si) continue;
    for (let g = 0; g < G; g++) for (const arm of ["base", "combo"] as const) {
      const B = D[ok]!, seatA = g % 2, seed = 7391 + oi * 1009 + g * 37, [d0, d1] = seatA === 0 ? [A, B] : [B, A];
      const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120 }, modifiers: [] } as unknown as MatchSpec;
      const h = (s: number, d: { archetype: string; decklist: readonly { cardId: string; count: number }[] }, o: typeof d) => new HeuristicAgent(s, cards, difficultyProfile("master", d.archetype as never, [...o.decklist], [...d.decklist]));
      const h0 = h(seed * 2 + 1, d0, d1), h1 = h(seed * 2 + 2, d1, d0);
      const rec: Rec = { arm, opp: ok, g, won: 0, turns: 0, myTurns: 0, hydraTurn: null, hydraBy: null, togetherTurn: null, walks: 0, walksWithHydra: 0, firstLoopTurn: null, longestRun: 0, hydraLeft: 0, hydraCasts: 0, druidFinds: 0, returns: {}, fights: 0, modes: {} };
      const probe = new Probe(seatA === 0 ? h0 : h1, arm === "combo", rec);
      const r = await runMatch(spec, cards, seatA === 0 ? [probe, h1] : [h0, probe]);
      rec.won = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0; rec.turns = r.turns; out.push(rec);
    }
    console.error(`shard ${si}/${sn}: ${ok} done`);
  }
  writeFileSync(arg("out", "hydro.json"), JSON.stringify({ results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN), pct = (n: number, d: number) => (d ? (100 * n) / d : 0).toFixed(1) + "%";
  const L: string[] = [`# Hydroilaur and Time Walk — ${all.length / 2} game ones an arm against the Open's ${new Set(all.map((r) => r.opp)).size} lists\n`];
  L.push(`| | base (the pilot as it is) | combo (the loop's decisions made for it) |\n|---|---|---|`);
  const arms = (["base", "combo"] as const).map((a) => all.filter((r) => r.arm === a));
  const row = (label: string, f: (rs: Rec[]) => string) => L.push(`| ${label} | ${arms.map(f).join(" | ")} |`);
  row("games won", (rs) => pct(rs.reduce((n, r) => n + r.won, 0), rs.length));
  row("Hydroilaur reached the battlefield", (rs) => pct(rs.filter((r) => r.hydraTurn !== null).length, rs.length));
  row("— by Order Druid (first arrival)", (rs) => pct(rs.filter((r) => r.hydraBy === "druid").length, rs.filter((r) => r.hydraTurn !== null).length));
  row("— on our own turn (mean; by turn 3 / 4 / 5)", (rs) => { const t = rs.filter((r) => r.hydraTurn !== null).map((r) => r.hydraTurn!); return `${mean(t).toFixed(1)}; ${[3, 4, 5].map((k) => pct(t.filter((x) => x <= k).length, rs.length)).join(" / ")}`; });
  row("both pieces together (the Hydra in play, Time Walk in hand or graveyard)", (rs) => pct(rs.filter((r) => r.togetherTurn !== null).length, rs.length));
  row("— on our own turn (mean)", (rs) => mean(rs.filter((r) => r.togetherTurn !== null).map((r) => r.togetherTurn!)).toFixed(1));
  row("**Time Walk cast with the Hydra in play (the loop started)**", (rs) => pct(rs.filter((r) => r.walksWithHydra > 0).length, rs.length));
  row("— cast twice or more that way (the loop turned over)", (rs) => pct(rs.filter((r) => r.walksWithHydra >= 2).length, rs.length));
  row("— three times or more", (rs) => pct(rs.filter((r) => r.walksWithHydra >= 3).length, rs.length));
  row("— Time Walks cast in those games (mean; most)", (rs) => { const w = rs.filter((r) => r.walksWithHydra > 0).map((r) => r.walksWithHydra); return `${mean(w).toFixed(1)}; ${Math.max(0, ...w)}`; });
  row("— won, of the games the loop started", (rs) => { const s = rs.filter((r) => r.walksWithHydra > 0); return pct(s.reduce((n, r) => n + r.won, 0), s.length); });
  row("— won, of the games it turned over", (rs) => { const s = rs.filter((r) => r.walksWithHydra >= 2); return pct(s.reduce((n, r) => n + r.won, 0), s.length); });
  row("— the Hydra left the battlefield after the loop started", (rs) => { const s = rs.filter((r) => r.walksWithHydra > 0); return pct(s.filter((r) => r.hydraLeft > 0).length, s.length); });
  row("longest run of consecutive turns (mean; most)", (rs) => `${mean(rs.map((r) => r.longestRun)).toFixed(2)}; ${Math.max(...rs.map((r) => r.longestRun))}`);
  row("won, of the games the Hydra never arrived", (rs) => { const s = rs.filter((r) => r.hydraTurn === null); return pct(s.reduce((n, r) => n + r.won, 0), s.length); });
  row("won, of the games it arrived", (rs) => { const s = rs.filter((r) => r.hydraTurn !== null); return pct(s.reduce((n, r) => n + r.won, 0), s.length); });
  row("the trigger's modes (fight / return)", (rs) => `${rs.reduce((n, r) => n + (r.modes.fight ?? 0), 0)} / ${rs.reduce((n, r) => n + (r.modes.return ?? 0), 0)}`);
  row("what the return took (top five)", (rs) => { const c: Record<string, number> = {}; for (const r of rs) for (const [k, n] of Object.entries(r.returns)) c[k] = (c[k] ?? 0) + n; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(", "); });
  const key = (r: Rec) => `${r.opp}|${r.g}`, cb = new Map(arms[1]!.map((r) => [key(r), r])), d = arms[0]!.map((b) => cb.get(key(b))!.won - b.won), m = mean(d), sd = Math.sqrt(d.reduce((n, x) => n + (x - m) ** 2, 0) / (d.length - 1));
  L.push(`\nPaired, combo less base: **${(100 * m >= 0 ? "+" : "") + (100 * m).toFixed(1)} ± ${(196 * sd / Math.sqrt(d.length)).toFixed(1)}** points of game-one win rate.`);
  L.push(`\n## By opponent (the combo arm)\n\n| opponent | won | loop started | turned over | the Hydra left after it started |\n|---|---|---|---|---|`);
  for (const o of [...new Set(all.map((r) => r.opp))]) { const rs = arms[1]!.filter((r) => r.opp === o), s = rs.filter((r) => r.walksWithHydra > 0); L.push(`| ${o} | ${pct(rs.reduce((n, r) => n + r.won, 0), rs.length)} | ${pct(s.length, rs.length)} | ${pct(rs.filter((r) => r.walksWithHydra >= 2).length, rs.length)} | ${s.length ? pct(s.filter((r) => r.hydraLeft > 0).length, s.length) : "—"} |`); }
  console.log(L.join("\n"));
}
if (process.argv.includes("--report")) report(); else await run();
