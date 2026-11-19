/**
 * S73a (Chris, 2026-11-19) — Drakonyx in a list built to cast it (his RGb Valakut list, drako-rgb.json).
 *   npx tsx analysis/s73/legends/drako2-probe.mts --vs goldfish --games 100 --seed-offset k --out f.json
 *   npx tsx analysis/s73/legends/drako2-probe.mts --vs field --games 20 --shard i/n --out f.json     then  --report f…
 * Three arms on the same seeds and seats:
 *   baloths — the list with four Rampaging Baloths in Drakonyx's place (a green six-drop Order Druid can find): what
 *             the slot is worth without the card;
 *   drakonyx — the list as Chris wrote it, the pilot as it is (no book knows the card);
 *   engine   — the same, the card's decisions made for it: Order Druid finds Drakonyx while none is in play; the land
 *              mode takes a Valakut while it controls fewer than two, else a Mountain-type land; the +1/+0 and trample
 *              when that is lethal; Drakonyx attacks every turn it can.
 * --vs goldfish: sixty Swamps that do nothing (how fast). --vs field: every active list of the Open (how good).
 * A probe, not a rule (ADR-167).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { FORMAT_DECKS } from "../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const DRAKO = "drakonyx", VALAKUT = "valakut_the_molten_pinnacle";
type Arm = "baloths" | "drakonyx" | "engine";
interface Rec { offeredUncast: number; unofferedUncast: number; unofferedLands: number[]; arm: Arm; opp: string; won: number; druidFinds: Record<string, number>; g: number; killTurn: number | null; myTurns: number; drakoTurn: number | null; drakoCasts: number; inHandUncast: number; landsAt: number[]; valakutsAt: number[]; valakutTriggers: number; modes: Record<string, number>; finds: Record<string, number> }

class Probe implements Agent {
  private turnSeen = -1; private declared = -1; private inHandTurn = -1; private offeredTurn = -1;
  constructor(private inner: HeuristicAgent, private engine: boolean, public rec: Rec, private defs: ReadonlyMap<string, { types: readonly string[]; subtypes?: readonly string[] }>) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you, opp = (1 - me) as 0 | 1, rec = this.rec;
    const mine = view.battlefield.filter((o) => o.controller === me);
    const lands = mine.filter((o) => this.defs.get(o.cardId)?.types.includes("Land")), valakuts = mine.filter((o) => o.cardId === VALAKUT).length;
    if (view.turn !== this.turnSeen) { this.turnSeen = view.turn; if (view.activePlayer === me) rec.myTurns += 1; }
    if (view.activePlayer === me) { rec.landsAt[rec.myTurns] = lands.length; rec.valakutsAt[rec.myTurns] = valakuts; }
    if (view.life[opp] <= 0 && rec.killTurn === null) rec.killTurn = rec.myTurns;
    const idOf = (x: Action) => { const o = (x as { objectId?: string }).objectId; return view.hand.find((h) => h.objectId === o)?.cardId ?? view.battlefield.find((b) => b.id === o)?.cardId ?? ""; };
    if (req.purpose === "priority" && req.actions.some((x) => x.type === "castSpell" && idOf(x) === DRAKO)) this.offeredTurn = view.turn;
    if (view.activePlayer === me && view.step === "END" && view.hand.some((h) => h.cardId === DRAKO) && !mine.some((o) => o.cardId === DRAKO) && this.inHandTurn !== view.turn) { this.inHandTurn = view.turn; rec.inHandUncast += 1; if (this.offeredTurn === view.turn) rec.offeredUncast += 1; else { rec.unofferedUncast += 1; rec.unofferedLands.push(lands.length); } }
    let a: Action | undefined;
    if (this.engine) {
      if (req.purpose === "chooseMode" && req.source?.cardId === DRAKO) {
        const modes = req.actions.filter((x) => x.type === "chooseMode") as Extract<Action, { type: "chooseMode" }>[];
        const pump = modes.find((m) => m.label.startsWith("Creatures")), land = modes.find((m) => m.label.startsWith("Search"));
        const attackers = mine.filter((o) => o.power !== null && (view.step !== "MAIN1" && view.step !== "MAIN2")).length; // on the attack: every creature swinging gets +1
        const power = mine.filter((o) => o.power !== null && !this.defs.get(o.cardId)?.types.includes("Land")).reduce((n, o) => n + Math.max(0, o.power ?? 0), 0);
        a = pump && attackers > 0 && view.life[opp] <= power + attackers ? pump : land ?? pump;
      } else if (req.purpose === "searchLibrary" && req.source?.cardId === DRAKO) {
        const picks = req.actions.filter((x) => x.type === "searchPick") as Extract<Action, { type: "searchPick" }>[];
        const card = (p: (typeof picks)[number]) => req.revealed?.find((r) => r.objectId === p.objectId)?.cardId ?? "";
        const isMountain = (c: string) => (this.defs.get(c)?.subtypes ?? []).includes("Mountain");
        a = (valakuts < 2 ? picks.find((p) => card(p) === VALAKUT) : undefined) ?? picks.find((p) => card(p) === "mountain") ?? picks.find((p) => isMountain(card(p))) ?? picks.find((p) => card(p) === VALAKUT);
      } else if (req.purpose === "searchLibrary" && req.source?.cardId === "order_druid" && !mine.some((o) => o.cardId === DRAKO)) {
        a = (req.actions.filter((x) => x.type === "searchPick") as Extract<Action, { type: "searchPick" }>[]).find((p) => req.revealed?.find((r) => r.objectId === p.objectId)?.cardId === DRAKO);
      } else if (req.purpose === "declareAttacker" && this.declared !== view.turn) {
        a = req.actions.find((x) => x.type === "declareAttacker" && idOf(x) === DRAKO); if (a) this.declared = view.turn;
      }
    }
    a ??= await this.inner.chooseAction(view, req);
    if (a.type === "castSpell" && idOf(a) === DRAKO) rec.drakoCasts += 1;
    if (a.type === "chooseMode" && req.source?.cardId === DRAKO) { const k = a.label.startsWith("Search") ? "land" : "pump"; rec.modes[k] = (rec.modes[k] ?? 0) + 1; }
    if (a.type === "searchPick" && req.source?.cardId === DRAKO) { const c = req.revealed?.find((r) => r.objectId === (a as { objectId: string }).objectId)?.cardId ?? "?"; rec.finds[c] = (rec.finds[c] ?? 0) + 1; }
    if (a.type === "searchPick" && req.source?.cardId === "order_druid") { const c = req.revealed?.find((r) => r.objectId === (a as { objectId: string }).objectId)?.cardId ?? "?"; rec.druidFinds[c] = (rec.druidFinds[c] ?? 0) + 1; }
    if (mine.some((o) => o.cardId === DRAKO) && rec.drakoTurn === null) rec.drakoTurn = rec.myTurns; // in play by any route
    return a;
  }
}
const goldfish: Agent = { chooseAction: async (_v: GameView, r: ActionRequest) => r.actions.find((a) => a.type === "keepHand") ?? r.actions.find((a) => a.type === "pass") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? r.actions.find((a) => a.type === "discard") ?? r.actions[0]! };

async function run(): Promise<void> {
  const cards = loadCardPool(ROOT + "data/cards").cards, D = FORMAT_DECKS.open!;
  const read = (f: string) => { const l = JSON.parse(readFileSync(ROOT + "analysis/s73/legends/" + f, "utf8")) as { cardId: string; count: number }[]; if (l.reduce((n, e) => n + e.count, 0) !== 60) throw new Error(`${f} is not sixty`); for (const e of l) if (!cards.has(e.cardId)) throw new Error(`no card ${e.cardId}`); return l; };
  const list = read(arg("list", "drako-rgb.json")), alt = read(arg("alt", "drako-rgb-baloths.json"));
  const field = arg("vs", "goldfish") === "field", fish = [{ cardId: "swamp", count: 60 }];
  const opps = field ? Object.keys(D).filter((k) => !D[k]!.archived) : ["goldfish"], G = Number(arg("games", "100")), out: Rec[] = [];
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  for (const [oi, ok] of opps.entries()) {
    if (oi % sn !== si) continue;
    for (let g = 0; g < G; g++) for (const arm of ["baloths", "drakonyx", "engine"] as const) {
      const mine = arm === "baloths" ? alt : list, theirs = field ? [...D[ok]!.decklist] : fish, seat = g % 2;
      const seed = 6607 + Number(arg("seed-offset", "0")) * 100003 + oi * 1009 + g * 37;
      const me = { name: "rgb", decklist: mine, agent: "heuristic:master" }, them = { name: ok, decklist: theirs, agent: "heuristic:master" };
      const spec = { seed, players: seat === 0 ? [me, them] : [them, me], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: field ? 120 : 60 }, modifiers: [] } as unknown as MatchSpec;
      const rec: Rec = { offeredUncast: 0, unofferedUncast: 0, unofferedLands: [], arm, opp: ok, won: 0, druidFinds: {}, g, killTurn: null, myTurns: 0, drakoTurn: null, drakoCasts: 0, inHandUncast: 0, landsAt: [], valakutsAt: [], valakutTriggers: 0, modes: {}, finds: {} };
      const probe = new Probe(new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", "midrange", theirs, mine)), arm === "engine", rec, cards);
      const other: Agent = field ? new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", D[ok]!.archetype, mine, theirs)) : goldfish;
      const r = await runMatch(spec, cards, seat === 0 ? [probe, other] : [other, probe]);
      rec.won = r.winner === null ? 0.5 : r.winner === seat ? 1 : 0;
      if (r.winner === seat && rec.killTurn === null) rec.killTurn = rec.myTurns;
      out.push(rec);
    }
    console.error(`shard ${si}/${sn}: ${ok} done`);
  }
  writeFileSync(arg("out", "drako2.json"), JSON.stringify({ vs: arg("vs", "goldfish"), results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN), pct = (n: number, d: number) => (d ? (100 * n) / d : 0).toFixed(0) + "%";
  const ARMS: Arm[] = ["baloths", "drakonyx", "engine"], by = ARMS.map((a) => all.filter((r) => r.arm === a));
  const field = all.some((r) => r.opp !== "goldfish");
  const L: string[] = [`# Drakonyx in Chris's RGb Valakut list — ${field ? `against the Open's ${new Set(all.map((r) => r.opp)).size} lists` : "against sixty Swamps that do nothing"}, ${by[0]!.length} games an arm\n`];
  L.push(`| | four Rampaging Baloths in its place | four Drakonyx, the pilot as it is | four Drakonyx, played for it |\n|---|---|---|---|`);
  const row = (label: string, f: (rs: Rec[]) => string) => L.push(`| ${label} | ${by.map(f).join(" | ")} |`);
  const kills = (rs: Rec[]) => rs.filter((r) => r.killTurn !== null).map((r) => r.killTurn!);
  row(field ? "**games won**" : "the goldfish died", (rs) => (field ? `**${(100 * mean(rs.map((r) => r.won))).toFixed(1)}%**` : pct(kills(rs).length, rs.length)));
  row(field ? "the turn of the win (mean; median)" : "**the turn it died (mean; median)**", (rs) => { const k = kills(rs).sort((a, b) => a - b); return `**${mean(k).toFixed(2)}**; ${k[Math.floor(k.length / 2)]}`; });
  for (const t of [4, 5, 6, 7, 8]) row(`dead by our turn ${t}`, (rs) => pct(kills(rs).filter((k) => k <= t).length, rs.length));
  row("Drakonyx in play (share of games; mean turn it arrived)", (rs) => { const c = rs.filter((r) => r.drakoTurn !== null); return c.length ? `${pct(c.length, rs.length)}; ${mean(c.map((r) => r.drakoTurn!)).toFixed(1)}` : "—"; });
  row("— in play by our turn 3 / 4 / 5", (rs) => (rs.some((r) => r.drakoTurn !== null) ? [3, 4, 5].map((t) => pct(rs.filter((r) => r.drakoTurn !== null && r.drakoTurn <= t).length, rs.length)).join(" / ") : "—"));
  row("turns ended with a Drakonyx in hand and none in play (a game)", (rs) => mean(rs.map((r) => r.inHandUncast)).toFixed(2));
  row("— of them, the cast was on offer and not taken / never on offer (lands then, mean)", (rs) => `${mean(rs.map((r) => r.offeredUncast)).toFixed(2)} / ${mean(rs.map((r) => r.unofferedUncast)).toFixed(2)} (${mean(rs.flatMap((r) => r.unofferedLands)).toFixed(1)})`);
  row("the turn it died, games Drakonyx was cast", (rs) => { const k = rs.filter((r) => r.drakoTurn !== null && r.killTurn !== null).map((r) => r.killTurn!); return k.length ? mean(k).toFixed(2) : "—"; });
  row("the turn it died, games it was not", (rs) => { const k = rs.filter((r) => r.drakoTurn === null && r.killTurn !== null).map((r) => r.killTurn!); return k.length ? mean(k).toFixed(2) : "—"; });
  for (const t of [4, 5, 6]) row(`lands in play on our turn ${t} (Valakuts)`, (rs) => { const x = rs.filter((r) => r.landsAt[t] !== undefined); return `${mean(x.map((r) => r.landsAt[t]!)).toFixed(1)} (${mean(x.map((r) => r.valakutsAt[t]!)).toFixed(2)})`; });
  row("the trigger's modes (land / pump)", (rs) => `${rs.reduce((n, r) => n + (r.modes.land ?? 0), 0)} / ${rs.reduce((n, r) => n + (r.modes.pump ?? 0), 0)}`);
  row("what the land mode found (top five)", (rs) => { const c: Record<string, number> = {}; for (const r of rs) for (const [k, n] of Object.entries(r.finds)) c[k] = (c[k] ?? 0) + n; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(", ") || "—"; });
  row("what Order Druid found (top four)", (rs) => { const c: Record<string, number> = {}; for (const r of rs) for (const [k, n] of Object.entries(r.druidFinds)) c[k] = (c[k] ?? 0) + n; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => `${k} ${n}`).join(", ") || "—"; });
  if (field) {
    row("won, games Drakonyx was in play", (rs) => { const c = rs.filter((r) => r.drakoTurn !== null); return c.length ? (100 * mean(c.map((r) => r.won))).toFixed(1) + "%" : "—"; });
    row("won, games it was not", (rs) => (100 * mean(rs.filter((r) => r.drakoTurn === null).map((r) => r.won))).toFixed(1) + "%");
    const key = (r: Rec) => `${r.opp}|${r.g}`, pd = (x: Arm, y: Arm) => { const Y = new Map(all.filter((r) => r.arm === y).map((r) => [key(r), r])); const d = all.filter((r) => r.arm === x).map((r) => Y.get(key(r))!.won - r.won), m = mean(d), sd = Math.sqrt(d.reduce((n, v) => n + (v - m) ** 2, 0) / (d.length - 1)); return `${(100 * m >= 0 ? "+" : "") + (100 * m).toFixed(1)} ± ${(196 * sd / Math.sqrt(d.length)).toFixed(1)}`; };
    L.push(`\nPaired: Drakonyx (the pilot) less the Baloths **${pd("baloths", "drakonyx")}**; played for it less the Baloths **${pd("baloths", "engine")}**; played for it less the pilot **${pd("drakonyx", "engine")}**.`);
    L.push(`\n## By opponent\n\n| opponent | Baloths | Drakonyx, the pilot | Drakonyx, played for it |\n|---|---|---|---|`);
    for (const o of [...new Set(all.map((r) => r.opp))]) L.push(`| ${o} | ${by.map((rs) => (100 * mean(rs.filter((r) => r.opp === o).map((r) => r.won))).toFixed(0) + "%").join(" | ")} |`);
  }
  console.log(L.join("\n"));
}
if (process.argv.includes("--report")) report(); else await run();
