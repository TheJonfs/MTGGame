/**
 * S73a (Chris, 2026-11-19) — Drakonyx's goldfish: what does it do to a land deck with no one across the table?
 *   npx tsx analysis/s73/legends/drako-probe.mts --games 300 --out f.json      then      --report f.json
 * The Open's Pinnacle against a goldfish (sixty Swamps and a hand that does nothing), game ones, three arms on the
 * same seeds and seats:
 *   registered — the Pinnacle as it is (two Drakuseth, two Ruby Tyrants at the top);
 *   drakonyx   — four Drakonyx for those four, the pilot as it is (no book knows the card: it takes the land every time
 *                and finds whatever colour its hand wants);
 *   engine     — the same list with the trigger's decisions made for it: a Valakut while it controls fewer than two,
 *                else a Mountain-type land; the +1/+0 and trample when that is lethal; Drakonyx attacks every turn.
 * Recorded: the turn the goldfish dies (our own turn count), when Drakonyx was cast, lands and Valakuts in play by turn,
 * Valakut triggers. A goldfish says how fast the deck is, not how good it is. A probe, not a rule (ADR-167).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../../packages/cards/src/loader.ts";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../packages/agents/src/index.ts";
import { FORMAT_DECKS } from "../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../", import.meta.url).pathname;
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const DRAKO = "drakonyx", VALAKUT = "valakut_the_molten_pinnacle";
type Arm = "registered" | "drakonyx" | "engine";
interface Rec { arm: Arm; g: number; killTurn: number | null; myTurns: number; drakoTurn: number | null; drakoCasts: number; inHandUncast: number; landsAt: number[]; valakutsAt: number[]; valakutTriggers: number; modes: Record<string, number>; finds: Record<string, number> }

class Probe implements Agent {
  private turnSeen = -1; private declared = -1; private inHandTurn = -1;
  constructor(private inner: HeuristicAgent, private engine: boolean, public rec: Rec, private defs: ReadonlyMap<string, { types: readonly string[]; subtypes?: readonly string[] }>) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const me = view.you, opp = (1 - me) as 0 | 1, rec = this.rec;
    const mine = view.battlefield.filter((o) => o.controller === me);
    const lands = mine.filter((o) => this.defs.get(o.cardId)?.types.includes("Land")), valakuts = mine.filter((o) => o.cardId === VALAKUT).length;
    if (view.turn !== this.turnSeen) { this.turnSeen = view.turn; if (view.activePlayer === me) rec.myTurns += 1; }
    if (view.activePlayer === me) { rec.landsAt[rec.myTurns] = lands.length; rec.valakutsAt[rec.myTurns] = valakuts; }
    if (view.life[opp] <= 0 && rec.killTurn === null) rec.killTurn = rec.myTurns;
    const idOf = (x: Action) => { const o = (x as { objectId?: string }).objectId; return view.hand.find((h) => h.objectId === o)?.cardId ?? view.battlefield.find((b) => b.id === o)?.cardId ?? ""; };
    if (view.activePlayer === me && view.step === "END" && view.hand.some((h) => h.cardId === DRAKO) && !mine.some((o) => o.cardId === DRAKO) && this.inHandTurn !== view.turn) { this.inHandTurn = view.turn; rec.inHandUncast += 1; }
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
      } else if (req.purpose === "declareAttacker" && this.declared !== view.turn) {
        a = req.actions.find((x) => x.type === "declareAttacker" && idOf(x) === DRAKO); if (a) this.declared = view.turn;
      }
    }
    a ??= await this.inner.chooseAction(view, req);
    if (a.type === "castSpell" && idOf(a) === DRAKO) { rec.drakoCasts += 1; if (rec.drakoTurn === null) rec.drakoTurn = rec.myTurns; }
    if (a.type === "chooseMode" && req.source?.cardId === DRAKO) { const k = a.label.startsWith("Search") ? "land" : "pump"; rec.modes[k] = (rec.modes[k] ?? 0) + 1; }
    if (a.type === "searchPick" && req.source?.cardId === DRAKO) { const c = req.revealed?.find((r) => r.objectId === (a as { objectId: string }).objectId)?.cardId ?? "?"; rec.finds[c] = (rec.finds[c] ?? 0) + 1; }
    if (req.purpose === "optionalTrigger" && req.source?.cardId === VALAKUT && a.type === "acceptOptional") rec.valakutTriggers += 1;
    return a;
  }
}
const goldfish: Agent = { chooseAction: async (_v: GameView, r: ActionRequest) => r.actions.find((a) => a.type === "keepHand") ?? r.actions.find((a) => a.type === "pass") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? r.actions.find((a) => a.type === "discard") ?? r.actions[0]! };

async function run(): Promise<void> {
  const cards = loadCardPool(ROOT + "data/cards").cards, base = FORMAT_DECKS.open!.pinnacle!;
  const swapped = base.decklist.filter((e) => e.cardId !== "drakuseth_maw_of_flames" && e.cardId !== "the_ruby_tyrant").concat([{ cardId: DRAKO, count: 4 }]);
  if (swapped.reduce((n, e) => n + e.count, 0) !== 60) throw new Error("the Drakonyx list is not sixty");
  const G = Number(arg("games", "300")), out: Rec[] = [], fish = [{ cardId: "swamp", count: 60 }];
  for (let g = 0; g < G; g++) for (const arm of ["registered", "drakonyx", "engine"] as const) {
    const list = arm === "registered" ? [...base.decklist] : swapped, seat = g % 2, seed = 5519 + Number(arg("seed-offset", "0")) * 100003 + g * 37; // --seed-offset k: a further block of games
    const me = { name: "pinnacle", decklist: list, agent: "heuristic:master" }, them = { name: "goldfish", decklist: fish, agent: "x" };
    const spec = { seed, players: seat === 0 ? [me, them] : [them, me], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 60 }, modifiers: [] } as unknown as MatchSpec;
    const rec: Rec = { arm, g, killTurn: null, myTurns: 0, drakoTurn: null, drakoCasts: 0, inHandUncast: 0, landsAt: [], valakutsAt: [], valakutTriggers: 0, modes: {}, finds: {} };
    const probe = new Probe(new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", base.archetype, fish, list)), arm === "engine", rec, cards);
    const r = await runMatch(spec, cards, seat === 0 ? [probe, goldfish] : [goldfish, probe]);
    if (r.winner === seat && rec.killTurn === null) rec.killTurn = rec.myTurns;
    out.push(rec);
  }
  writeFileSync(arg("out", "drako.json"), JSON.stringify({ results: out }));
}

function report(): void {
  const files = process.argv.slice(process.argv.indexOf("--report") + 1);
  const all = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Rec[] }).results);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN), pct = (n: number, d: number) => (d ? (100 * n) / d : 0).toFixed(0) + "%";
  const ARMS: Arm[] = ["registered", "drakonyx", "engine"], by = ARMS.map((a) => all.filter((r) => r.arm === a));
  const L: string[] = [`# Drakonyx's goldfish — the Pinnacle against sixty Swamps that do nothing, ${by[0]!.length} games an arm\n`];
  L.push(`| | the Pinnacle as registered | four Drakonyx, the pilot as it is | four Drakonyx, the trigger played for it |\n|---|---|---|---|`);
  const row = (label: string, f: (rs: Rec[]) => string) => L.push(`| ${label} | ${by.map(f).join(" | ")} |`);
  const kills = (rs: Rec[]) => rs.filter((r) => r.killTurn !== null).map((r) => r.killTurn!);
  row("the goldfish died", (rs) => pct(kills(rs).length, rs.length));
  row("**the turn it died (mean; median)**", (rs) => { const k = kills(rs).sort((a, b) => a - b); return `**${mean(k).toFixed(2)}**; ${k[Math.floor(k.length / 2)]}`; });
  for (const t of [4, 5, 6, 7, 8]) row(`dead by our turn ${t}`, (rs) => pct(kills(rs).filter((k) => k <= t).length, rs.length));
  row("Drakonyx cast (share of games; mean turn)", (rs) => { const c = rs.filter((r) => r.drakoTurn !== null); return c.length ? `${pct(c.length, rs.length)}; ${mean(c.map((r) => r.drakoTurn!)).toFixed(1)}` : "—"; });
  row("— cast by our turn 3 / 4 / 5", (rs) => (rs.some((r) => r.drakoTurn !== null) ? [3, 4, 5].map((t) => pct(rs.filter((r) => r.drakoTurn !== null && r.drakoTurn <= t).length, rs.length)).join(" / ") : "—"));
  row("turns ended with a Drakonyx in hand and none in play (a game)", (rs) => mean(rs.map((r) => r.inHandUncast)).toFixed(2));
  row("the turn it died, games Drakonyx was cast", (rs) => { const k = rs.filter((r) => r.drakoTurn !== null && r.killTurn !== null).map((r) => r.killTurn!); return k.length ? mean(k).toFixed(2) : "—"; });
  row("the turn it died, games it was not", (rs) => { const k = rs.filter((r) => r.drakoTurn === null && r.killTurn !== null).map((r) => r.killTurn!); return k.length ? mean(k).toFixed(2) : "—"; });
  for (const t of [4, 5, 6]) row(`lands in play on our turn ${t} (Valakuts)`, (rs) => { const x = rs.filter((r) => r.landsAt[t] !== undefined); return `${mean(x.map((r) => r.landsAt[t]!)).toFixed(1)} (${mean(x.map((r) => r.valakutsAt[t]!)).toFixed(2)})`; });
  row("the trigger's modes (land / pump)", (rs) => `${rs.reduce((n, r) => n + (r.modes.land ?? 0), 0)} / ${rs.reduce((n, r) => n + (r.modes.pump ?? 0), 0)}`);
  row("what the land mode found (top five)", (rs) => { const c: Record<string, number> = {}; for (const r of rs) for (const [k, n] of Object.entries(r.finds)) c[k] = (c[k] ?? 0) + n; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(", ") || "—"; });
  console.log(L.join("\n"));
}
if (process.argv.includes("--report")) report(); else await run();
