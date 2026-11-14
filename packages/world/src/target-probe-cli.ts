/**
 * pnpm target-probe <saved-games.json> [more.json …] --list <key> [--card vindicate] [--out report.md]
 *
 * S72 Part 2 (concern 31, Vindicate at lands): every cast of a targeted removal spell by the list's seat, read from
 * `open:rr --save-games` logs. Each cast records its target's kind (land — a utility land, one whose abilities do more
 * than make mana, apart; creature; other permanent), the target's worth as the pilot prices it (`objectValue`, plus
 * book 162's land-hit bonus for a land), the best opposing creature standing at the time and its worth, and the
 * game's result. Reported by opponent and in sum; the margin by which the best creature out-prices a land hit is the
 * number a `landhit` gate would be set from.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayThenPlay, type Action, type GameView, type ActionRequest } from "@shandalar/engine";
import { RandomAgent, objectValue } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const LIST = arg("list", ""), CARD = arg("card", "vindicate"), OUT = arg("out", "");
if (!LIST) throw new Error("target-probe: --list <key> (the seat whose casts are read)");
const files = process.argv.slice(2).filter((f, i, all) => f.endsWith(".json") && !(all[i - 1] ?? "").startsWith("--"));
const nm = (id?: string) => (id ? pool.get(id)?.name ?? id : "?");

interface Saved { spec: { players: { name: string; decklist: { cardId: string; count: number }[] }[]; rules: Record<string, unknown>; modifiers?: unknown[] }; log: { t: string }[]; result: { winner: 0 | 1 | null; turns: number } }
type Kind = "utility land" | "land" | "creature" | "other" | "own" | "none";
interface Cast { kind: Kind; card: string; worth: number; best: string; bestWorth: number; turn: number; theirLands: number; won: boolean }
const byOpp = new Map<string, { games: number; won: number; casts: Cast[] }>();
// `--windows`: our main phases with an empty stack where the card could be cast — by turn band, cast or not (its timing)
const WINDOWS = process.argv.includes("--windows");
const bands = new Map<string, { castable: number; cast: number; other: number; theirLands: number[] }>();
const bandOf = (t: number) => { const r = Math.ceil(t / 2); return r <= 3 ? "our turns 1–3" : r <= 6 ? "our turns 4–6" : r <= 9 ? "our turns 7–9" : "our turns 10+"; };

const isLand = (id: string) => !!pool.get(id)?.types.includes("Land");
const isUtility = (id: string) => (pool.get(id)?.abilities ?? []).some((a) => a.kind === "triggered" || (a.kind === "activated" && !a.effects.every((x) => x.type === "addMana")));

for (const file of files) {
  for (const g of (JSON.parse(readFileSync(file, "utf8")) as { games: Saved[] }).games) {
    const seat = g.spec.players.findIndex((p) => p.name === LIST);
    if (seat < 0) continue;
    const opp = g.spec.players[1 - seat]!.name;
    const row = byOpp.get(opp) ?? { games: 0, won: 0, casts: [] }; byOpp.set(opp, row);
    row.games++; const won = g.result.winner === seat; if (won) row.won++;
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: 20, handSize: 7, maxTurns: 120, ante: 0, ...g.spec.rules } as never;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    const wins = new Map<string, { band: string; castable: boolean; cast: boolean; other: boolean; lands: number }>();
    await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, (g.spec.modifiers ?? []) as never, undefined, (req: ActionRequest, v: GameView, a: Action) => {
      if (WINDOWS && req.player === seat && req.purpose === "priority" && v.activePlayer === seat && (v.step === "MAIN1" || v.step === "MAIN2") && v.stack.length === 0) {
        const ids = new Set(v.hand.filter((c) => c.cardId === CARD).map((c) => c.objectId));
        const k = `${v.turn}:${v.step}`;
        const w = wins.get(k) ?? { band: bandOf(v.turn), castable: false, cast: false, other: false, lands: v.battlefield.filter((x) => x.controller !== seat && isLand(x.cardId)).length };
        wins.set(k, w);
        if (req.actions.some((x) => x.type === "castSpell" && ids.has(x.objectId))) w.castable = true;
        if (a.type === "castSpell" && ids.has(a.objectId)) w.cast = true;
        else if (a.type === "castSpell") w.other = true;
      }
      if (req.player !== seat || a.type !== "castSpell") return;
      if (v.hand.find((c) => c.objectId === a.objectId)?.cardId !== CARD) return;
      const t = a.targets?.[0];
      const o = t?.kind === "object" ? v.battlefield.find((x) => x.id === t.id) : undefined;
      const them = v.battlefield.filter((x) => x.controller !== seat);
      const theirLands = them.filter((x) => isLand(x.cardId)).length;
      const creatures = them.filter((x) => x.power !== null).map((x) => ({ x, w: objectValue(pool, x) })).sort((p, q) => q.w - p.w);
      let kind: Kind = "none", worth = 0;
      if (o && o.controller === seat) kind = "own";
      else if (o && isLand(o.cardId)) { const u = isUtility(o.cardId); kind = u ? "utility land" : "land"; worth = objectValue(pool, o) + (u ? 1.5 : 0) + (theirLands <= 3 ? 0.4 : 0); }
      else if (o && o.power !== null) { kind = "creature"; worth = objectValue(pool, o); }
      else if (o) { kind = "other"; worth = objectValue(pool, o); }
      row.casts.push({ kind, card: o ? nm(o.cardId) : "", worth, best: creatures[0] ? nm(creatures[0].x.cardId) : "", bestWorth: creatures[0]?.w ?? 0, turn: v.turn, theirLands, won });
    });
    for (const w of wins.values()) { if (!w.castable) continue; const b = bands.get(w.band) ?? { castable: 0, cast: 0, other: 0, theirLands: [] }; bands.set(w.band, b); b.castable++; if (w.cast) b.cast++; else if (w.other) b.other++; b.theirLands.push(w.lands); }
  }
}

const f1 = (x: number) => x.toFixed(1);
const mean = (xs: number[]) => (xs.length ? f1(xs.reduce((a, b) => a + b, 0) / xs.length) : "–");
const pctOf = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const lines = [`# ${nm(CARD)} in ${LIST}'s hands — ${files.join(", ")}`, "",
  "| opponent | games (won) | casts | creature | utility land | land | other | land hits with a creature worth more standing | margin (best creature − land), median | won when it hit a land / a creature |", "|---|---|---|---|---|---|---|---|---|---|"];
const all: Cast[] = []; let G = 0, W = 0;
const med = (xs: number[]) => { if (!xs.length) return "–"; const s = [...xs].sort((a, b) => a - b); return f1(s[Math.floor(s.length / 2)]!); };
const rowOf = (k: string, games: number, won: number, cs: Cast[]) => {
  const c = (kd: Kind) => cs.filter((x) => x.kind === kd).length;
  const lands = cs.filter((x) => x.kind === "land" || x.kind === "utility land");
  const over = lands.filter((x) => x.bestWorth > x.worth);
  const wonL = lands.filter((x) => x.won).length, cr = cs.filter((x) => x.kind === "creature");
  return `| ${k} | ${games} (${won}) | ${cs.length} | ${c("creature")} | ${c("utility land")} | ${c("land")} | ${c("other") + c("own") + c("none")} | ${over.length} of ${lands.length} | ${med(over.map((x) => x.bestWorth - x.worth))} | ${pctOf(wonL, lands.length)} / ${pctOf(cr.filter((x) => x.won).length, cr.length)} |`;
};
for (const [k, r] of [...byOpp].sort()) { lines.push(rowOf(k, r.games, r.won, r.casts)); all.push(...r.casts); G += r.games; W += r.won; }
lines.push(rowOf("**all**", G, W, all));
const tally = (cs: Cast[]) => { const m = new Map<string, number>(); for (const c of cs) m.set(c.card, (m.get(c.card) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => `${c} ${v}`).join(", "); };
lines.push("", `Mean worth: a creature hit ${mean(all.filter((x) => x.kind === "creature").map((x) => x.worth))}, a land hit ${mean(all.filter((x) => x.kind.endsWith("land")).map((x) => x.worth))}; the best creature standing at a land hit ${mean(all.filter((x) => x.kind.endsWith("land")).map((x) => x.bestWorth))}. Mean turn: creature ${mean(all.filter((x) => x.kind === "creature").map((x) => x.turn))}, land ${mean(all.filter((x) => x.kind.endsWith("land")).map((x) => x.turn))}.`);
lines.push("", `Lands hit: ${tally(all.filter((x) => x.kind.endsWith("land")))}`, "", `Creatures standing at those land hits (the best): ${tally(all.filter((x) => x.kind.endsWith("land") && x.bestWorth > x.worth).map((x) => ({ ...x, card: x.best })))}`, "", `Creatures hit: ${tally(all.filter((x) => x.kind === "creature"))}`);
if (WINDOWS) { lines.push("", "| our main phases, empty stack, the card castable | windows | cast | not cast: another spell instead | their lands (mean) |", "|---|---|---|---|---|"); for (const k of ["our turns 1–3", "our turns 4–6", "our turns 7–9", "our turns 10+"]) { const b = bands.get(k); if (b) lines.push(`| ${k} | ${b.castable} | ${b.cast} (${pctOf(b.cast, b.castable)}) | ${b.other} of ${b.castable - b.cast} | ${mean(b.theirLands)} |`); } }
const text = lines.join("\n") + "\n";
if (OUT) writeFileSync(OUT, text);
console.log(text);
