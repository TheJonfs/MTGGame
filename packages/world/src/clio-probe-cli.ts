/**
 * pnpm clio-probe <saved-games.json …> (--list <key> | --human) [--vs key] [--out report.md]
 *
 * Post-S72 (Chris: "how often does the AI land a Clio, and how many depth counters does it accumulate?"): each game is
 * replayed from its log, and every Clio, Lady of the Depths the seat controls is followed — the turn she lands, her
 * depth counters each time a decision is seen, every activation (three counters removed for two cards and a discard)
 * with the counters she had and the opposing board's printed power then, and how she left the battlefield: the last
 * opposing action before she was gone (a Flametongue Kavu's trigger, a Foxglove Dose, a fight), in combat or not.
 * Per game: landed or not, peak counters, the result. No playouts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayThenPlay, type Action, type ActionRequest, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const LIST = arg("list", ""), VS = arg("vs", ""), OUT = arg("out", ""), HUMAN = process.argv.includes("--human");
const CLIO = "clio_lady_of_the_depths";
const files = process.argv.slice(2).filter((f, i, all) => f.endsWith(".json") && !(all[i - 1] ?? "").startsWith("--"));
const nm = (id?: string) => (id ? pool.get(id)?.name ?? id : "?");

interface G { spec: { players: { name?: string; agent?: string; decklist: { cardId: string; count: number }[] }[]; rules: Record<string, unknown>; modifiers?: unknown[]; seed?: number }; log: { t: string }[]; result: { winner: 0 | 1 | null; turns: number }; opponent?: string; list?: string }
interface Life { landed: number; peak: number; cashes: { counters: number; theirPower: number; turn: number }[]; left: string; leftTurn: number }
interface Row { won: boolean; turns: number; clios: Life[]; inHand: boolean }
const rows: Row[] = [];
const seen = new Set<number>();

for (const file of files) {
  const d = JSON.parse(readFileSync(file, "utf8")) as { games?: G[] };
  for (const g of d.games ?? []) {
    const seat = HUMAN ? g.spec.players.findIndex((p) => p.agent === "human") : g.spec.players.findIndex((p) => p.name === LIST);
    if (seat < 0) continue;
    if (VS && !(HUMAN ? (g.list ?? "").includes(VS) : g.spec.players[1 - seat]!.name === VS)) continue;
    if (g.spec.seed !== undefined) { if (seen.has(g.spec.seed)) continue; seen.add(g.spec.seed); }
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: 20, handSize: 7, maxTurns: 120, ante: 0, ...g.spec.rules } as never;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    const live = new Map<string, Life>(); const done: Life[] = [];
    let lastOpp = "", inHand = false;
    const step = (v: GameView) => {
      const here = new Set(v.battlefield.filter((o) => o.controller === seat && o.cardId === CLIO).map((o) => o.id));
      for (const o of v.battlefield) if (here.has(o.id)) {
        const l = live.get(o.id) ?? { landed: Math.ceil(v.turn / 2), peak: 0, cashes: [], left: "game over", leftTurn: 0 };
        l.peak = Math.max(l.peak, o.counters?.depth ?? 0); live.set(o.id, l);
      }
      for (const [id, l] of live) if (!here.has(id)) { l.left = lastOpp || "?"; l.leftTurn = Math.ceil(v.turn / 2); done.push(l); live.delete(id); }
    };
    try {
      await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, (g.spec.modifiers ?? []) as never, undefined, (req: ActionRequest, v: GameView, a: Action) => {
        step(v);
        if (req.player === seat && v.hand.some((c) => c.cardId === CLIO)) inHand = true;
        if (req.player !== seat) {
          if (a.type === "castSpell") lastOpp = `${nm(v.hand.find((c) => c.objectId === a.objectId)?.cardId)}${v.combat.attackers.length ? " (in combat)" : ""}`;
          else if (a.type === "activateAbility") lastOpp = `${nm(v.battlefield.find((o) => o.id === a.objectId)?.cardId)} ability`;
          else if (a.type === "chooseTriggerTargets" && (a as { targets?: { kind: string; id?: string }[] }).targets?.some((t) => t.kind === "object" && v.battlefield.find((o) => o.id === t.id)?.cardId === CLIO)) lastOpp = `${nm(req.source?.cardId)} trigger at her`;
          else if (a.type === "declareAttacker" || a.type === "declareBlocker") lastOpp = "combat";
        } else if (a.type === "activateAbility") {
          const o = v.battlefield.find((x) => x.id === a.objectId);
          if (o?.cardId === CLIO) live.get(o.id)?.cashes.push({ counters: o.counters?.depth ?? 0, theirPower: v.battlefield.filter((x) => x.controller !== seat && x.power !== null).reduce((s, x) => s + Math.max(0, pool.get(x.cardId)?.power ?? 0), 0), turn: Math.ceil(v.turn / 2) });
          lastOpp = "";
        }
      });
    } catch { /* a diverged replay keeps what it saw */ }
    for (const l of live.values()) done.push(l);
    rows.push({ won: g.result.winner === seat, turns: g.result.turns, clios: done, inHand });
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const rate = (xs: Row[]) => `${xs.filter((x) => x.won).length}/${xs.length} (${pct(xs.filter((x) => x.won).length, xs.length)})`;
const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
const landed = rows.filter((r) => r.clios.length > 0), none = rows.filter((r) => r.clios.length === 0);
const lives = rows.flatMap((r) => r.clios.map((c) => ({ ...c, won: r.won })));
const L = [`# Clio in ${HUMAN ? "the human's" : LIST + "'s"} hands${VS ? ` against ${VS}` : ""} — ${rows.length} games`, ""];
L.push("| | games | won |", "|---|---|---|", `| a Clio landed | ${landed.length} | ${rate(landed)} |`, `| none landed (one drawn) | ${none.filter((r) => r.inHand).length} | ${rate(none.filter((r) => r.inHand))} |`, `| none drawn | ${none.filter((r) => !r.inHand).length} | ${rate(none.filter((r) => !r.inHand))} |`, "");
L.push(`Clios landed: ${lives.length}; landed on her controller's turn ${mean(lives.map((c) => c.landed))} (mean). Peak depth counters (each one's): ${[0, 1, 2, 3, 4, 5].map((k) => `${k === 5 ? "5+" : k}: ${lives.filter((c) => (k === 5 ? c.peak >= 5 : c.peak === k)).length}`).join(", ")}; mean ${mean(lives.map((c) => c.peak))}.`, "");
L.push("| peak counters | Clios | games won |", "|---|---|---|");
for (const [lo, hi, lab] of [[0, 0, "0"], [1, 2, "1–2"], [3, 4, "3–4"], [5, 99, "5+"]] as const) { const xs = lives.filter((c) => c.peak >= lo && c.peak <= hi); L.push(`| ${lab} | ${xs.length} | ${xs.filter((c) => c.won).length} (${pct(xs.filter((c) => c.won).length, xs.length)}) |`); }
const cash = lives.flatMap((c) => c.cashes);
L.push("", `Cash-ins (three counters for two cards and a discard): ${cash.length}, in ${lives.filter((c) => c.cashes.length).length} of ${lives.length} Clios; counters at the time (mean) ${mean(cash.map((c) => c.counters))}; the opposing board's printed power then (mean) ${mean(cash.map((c) => c.theirPower))}. Clios that cashed in won ${pct(lives.filter((c) => c.cashes.length && c.won).length, lives.filter((c) => c.cashes.length).length)}; those that never did ${pct(lives.filter((c) => !c.cashes.length && c.won).length, lives.filter((c) => !c.cashes.length).length)}.`, "");
const how = new Map<string, { n: number; won: number; turn: number[]; peak: number[] }>();
for (const c of lives) { const k = c.left.replace(/ \(in combat\)/, " (combat)"); const h = how.get(k) ?? { n: 0, won: 0, turn: [], peak: [] }; h.n++; if (c.won) h.won++; h.turn.push(c.leftTurn - c.landed); h.peak.push(c.peak); how.set(k, h); }
L.push("## How each Clio left (the last opposing action before she was gone)", "", "| | Clios | games won | turns she stayed (mean) | peak counters (mean) |", "|---|---|---|---|---|");
for (const [k, h] of [...how].sort((a, b) => b[1].n - a[1].n)) L.push(`| ${k} | ${h.n} | ${h.won} (${pct(h.won, h.n)}) | ${mean(h.turn)} | ${mean(h.peak)} |`);
const text = L.join("\n") + "\n";
if (OUT) writeFileSync(OUT, text);
console.log(text);
