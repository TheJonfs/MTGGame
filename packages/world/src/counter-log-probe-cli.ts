/**
 * pnpm counter-log-probe <saved-games.json> [more.json …] --list <key> [--card mystic_snake] [--out report.md]
 *
 * S72 Part 2 (concern 30, the brief's probe for `snakehold`; S56's `counter-probe` plays its own games — this one reads saved logs): a flash creature with a counter rider, read from
 * `open:rr --save-games` logs. Each game is replayed from its log; at every priority decision of the list's seat the
 * probe asks: could the card be cast (it is among the legal actions), was it, and what was the moment —
 *   · a COUNTER window: the top of the stack is an opponent's spell;
 *   · their END step, nothing on the stack (the mana otherwise unspent);
 *   · our own main phase, nothing on the stack (a body).
 * Each cast is classed by its moment; a cast as a body is followed by the opponent's spells over their next two
 * turns (what it could have countered). Reported by opponent and in sum.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { manaValue, parseManaCost } from "@shandalar/cards";
import { expandDecklist, replayThenPlay, type Action, type GameView, type ActionRequest } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const LIST = arg("list", ""), CARD = arg("card", "mystic_snake"), OUT = arg("out", "");
if (!LIST) throw new Error("counter-log-probe: --list <key> (the seat whose casts are read)");
const files = process.argv.slice(2).filter((f, i, all) => f.endsWith(".json") && !(all[i - 1] ?? "").startsWith("--"));
const nm = (id?: string) => (id ? pool.get(id)?.name ?? id : "?");

interface Saved { opponent: string; me: string; spec: { seed: number; players: { name: string; decklist: { cardId: string; count: number }[] }[]; rules: Record<string, unknown>; modifiers?: unknown[] }; log: { t: string }[]; result: { winner: 0 | 1 | null; turns: number } }
interface Row { games: number; won: number; inHandGames: number; casts: { counter: number; theirEnd: number; ourMain: number; ourOther: number; theirOther: number }; counterWin: { seen: number; castable: number; taken: number }; endWin: { castable: number; taken: number }; mainWin: { castable: number; taken: number }; passedOn: Map<string, number>; countered: Map<string, number>; mv: number[]; bodyThenTheirSpells: number[]; firstCastTurn: number[] }
const blank = (): Row => ({ games: 0, won: 0, inHandGames: 0, casts: { counter: 0, theirEnd: 0, ourMain: 0, ourOther: 0, theirOther: 0 }, counterWin: { seen: 0, castable: 0, taken: 0 }, endWin: { castable: 0, taken: 0 }, mainWin: { castable: 0, taken: 0 }, passedOn: new Map(), countered: new Map(), mv: [], bodyThenTheirSpells: [], firstCastTurn: [] });
const rows = new Map<string, Row>();
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

for (const file of files) {
  const saved = (JSON.parse(readFileSync(file, "utf8")) as { games: Saved[] }).games;
  for (const g of saved) {
    const seat = g.spec.players.findIndex((p) => p.name === LIST) as 0 | 1 | -1;
    if (seat < 0) continue;
    const oppKey = g.spec.players[1 - seat]!.name;
    const row = rows.get(oppKey) ?? blank(); rows.set(oppKey, row);
    row.games++; if (g.result.winner === seat) row.won++;
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: 20, handSize: 7, maxTurns: 120, ante: 0, ...g.spec.rules } as never;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    const oppCastsByTurn = new Map<number, number>();
    const bodyTurns: number[] = [];
    let inHand = false, first = -1;
    const windows = new Map<string, { kind: "counter" | "theirEnd" | "ourMain" | "ourOther" | "theirOther"; castable: boolean; cast: boolean; top: string; topMv: number; turn: number }>();
    await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, (g.spec.modifiers ?? []) as never, undefined, (req: ActionRequest, v: GameView, a: Action) => {
      if (req.player !== seat) {
        if (a.type === "castSpell") oppCastsByTurn.set(v.turn, (oppCastsByTurn.get(v.turn) ?? 0) + 1);
        return;
      }
      if (req.purpose !== "priority") return;
      if (v.hand.some((c) => c.cardId === CARD)) inHand = true;
      const snakeIds = new Set(v.hand.filter((c) => c.cardId === CARD).map((c) => c.objectId));
      const castable = req.actions.some((x) => x.type === "castSpell" && snakeIds.has(x.objectId));
      const cast = a.type === "castSpell" && snakeIds.has(a.objectId);
      const top = v.stack[v.stack.length - 1];
      const ours = v.activePlayer === seat;
      // one WINDOW per turn, step and stack: castable at any of its decisions, cast at any (a mana tap or another
      // action may come first)
      const key = `${v.turn}:${v.step}:${v.stack.map((s) => s.id).join(",")}`;
      const kind = top && top.kind === "spell" && top.controller !== seat ? "counter" : v.stack.length === 0 && !ours && v.step === "END" ? "theirEnd" : v.stack.length === 0 && ours && (v.step === "MAIN1" || v.step === "MAIN2") ? "ourMain" : ours ? "ourOther" : "theirOther";
      const w = windows.get(key) ?? { kind, castable: false, cast: false, top: top ? nm(top.cardId) : "", topMv: top ? manaValue(parseManaCost(pool.get(top.cardId)?.manaCost ?? "")) : 0, turn: v.turn };
      windows.set(key, w);
      if (castable) w.castable = true;
      if (cast) w.cast = true;
      if (cast && first < 0) first = v.turn;
    });
    for (const w of windows.values()) {
      if (w.cast) row.casts[w.kind]++;
      if (w.kind === "counter") { row.counterWin.seen++; if (w.castable) row.counterWin.castable++; if (w.cast) { row.counterWin.taken++; bump(row.countered, w.top); row.mv.push(w.topMv); } else if (w.castable) bump(row.passedOn, w.top); }
      else if (w.kind === "theirEnd") { if (w.castable) row.endWin.castable++; if (w.cast) row.endWin.taken++; }
      else if (w.kind === "ourMain") { if (w.castable) row.mainWin.castable++; if (w.cast) { row.mainWin.taken++; bodyTurns.push(w.turn); } }
      else if (w.kind === "ourOther" && w.cast) bodyTurns.push(w.turn);
    }
    if (inHand) row.inHandGames++;
    if (first >= 0) row.firstCastTurn.push(first);
    // a body's turn T (ours): the opponent's next two turns are T+1 and T+3
    for (const t of bodyTurns) row.bodyThenTheirSpells.push((oppCastsByTurn.get(t + 1) ?? 0) + (oppCastsByTurn.get(t + 3) ?? 0));
  }
}

const sum = blank();
for (const r of rows.values()) {
  sum.games += r.games; sum.won += r.won; sum.inHandGames += r.inHandGames;
  for (const k of Object.keys(sum.casts) as (keyof Row["casts"])[]) sum.casts[k] += r.casts[k];
  for (const w of ["counterWin", "endWin", "mainWin"] as const) for (const k of Object.keys(sum[w]) as never[]) { const t = sum[w] as unknown as Record<string, number>; t[k] = (t[k] ?? 0) + ((r[w] as unknown as Record<string, number>)[k] ?? 0); }
  for (const [k, v] of r.passedOn) sum.passedOn.set(k, (sum.passedOn.get(k) ?? 0) + v);
  for (const [k, v] of r.countered) sum.countered.set(k, (sum.countered.get(k) ?? 0) + v);
  sum.mv.push(...r.mv); sum.bodyThenTheirSpells.push(...r.bodyThenTheirSpells); sum.firstCastTurn.push(...r.firstCastTurn);
}
const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "0/0");
const top = (m: Map<string, number>, k = 6) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([c, v]) => `${c} ${v}`).join(", ") || "–";
const lines: string[] = [`# ${nm(CARD)} in ${LIST}'s hands — ${files.join(", ")}`, "",
  "| opponent | games (won) | in hand | casts: counter / their end / our main / other | counter windows castable, taken | their end castable, taken | our main castable, taken | their spells in the next two turns after a body | first cast (turn) |", "|---|---|---|---|---|---|---|---|---|"];
for (const [k, r] of [...rows, ["**all**", sum] as [string, Row]]) {
  const c = r.casts;
  lines.push(`| ${k} | ${r.games} (${r.won}) | ${r.inHandGames} | ${c.counter} / ${c.theirEnd} / ${c.ourMain} / ${c.ourOther + c.theirOther} | ${pct(r.counterWin.taken, r.counterWin.castable)} | ${pct(r.endWin.taken, r.endWin.castable)} | ${pct(r.mainWin.taken, r.mainWin.castable)} | ${mean(r.bodyThenTheirSpells)} | ${mean(r.firstCastTurn)} |`);
}
const hist = (xs: number[]) => [0, 1, 2, 3, 4, 5].map((m) => `${m === 5 ? "5+" : m}: ${xs.filter((x) => (m === 5 ? x >= 5 : x === m)).length}`).join(", ");
for (const [k, r] of [...rows, ["all", sum] as [string, Row]]) lines.push(`- mana value countered, ${k}: ${hist(r.mv)} (mean ${mean(r.mv)})`);
lines.push("", `**Spells it could have countered and let resolve** (all): ${top(sum.passedOn, 12)}`, "", `**Spells it countered** (all): ${top(sum.countered, 12)}`);
for (const [k, r] of rows) lines.push("", `- ${k}: let resolve — ${top(r.passedOn)}; countered — ${top(r.countered)}`);
const text = lines.join("\n") + "\n";
if (OUT) writeFileSync(OUT, text);
console.log(text);
