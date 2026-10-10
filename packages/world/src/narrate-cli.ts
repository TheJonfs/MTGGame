/**
 * pnpm narrate <recorded-games.json> [--event seed] [--match text]
 *
 * S59 (after Chris's recorded runs): a recorded game read move by move. Each game of the file (or of one event, or
 * those whose tag — "round3.1:open:rabble", "bracket5.0:open:writ" — holds the text) is replayed from its log, and
 * every action that is not a pass or a mana tap is printed with the turn, the step, the stack it answered, and the
 * human's hand as it changes. The play diff counts differences; this is for reading a line of play.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayThenPlay, type Action, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const file = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as { games: { eventSeed: number; phase: string; round: number; game: number; list: string; opponent: string; result: { winner: number | null; turns: number }; spec: { players: { decklist: { cardId: string; count: number }[] }[]; rules: { startingLife?: number; handSize?: number; maxTurns?: number; ante?: number; startingPlayer?: 0 | 1 }; modifiers?: never[] }; log: never[] }[] };
const ev = Number(arg("event", "0")), want = arg("match", "");
const nm = (id?: string) => (id ? pool.get(id)?.name ?? id : "?");

let gi = 0;
for (const g of file.games) {
  if (ev && g.eventSeed !== ev) continue; gi++;
  const tag = `${g.phase}${g.round}.${g.game}:${g.list}`;
  if (want && !tag.includes(want)) continue;
  console.log(`\n===== game ${gi} ${tag} vs ${g.opponent} — ${g.result.winner === 0 ? "WON" : g.result.winner === 1 ? "LOST" : "drawn"} in ${g.result.turns} turns =====`);
  const spec = g.spec, decks: [string[], string[]] = [expandDecklist(spec.players[0]!.decklist), expandDecklist(spec.players[1]!.decklist)];
  const rules = { startingLife: spec.rules.startingLife ?? 20, handSize: spec.rules.handSize ?? 7, maxTurns: spec.rules.maxTurns ?? 100, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) };
  const n = (g.log as { t: string }[]).filter((e) => e.t === "ACTION").length;
  let lastTurn = -1, lastHand = "";
  const obj = (v: GameView, id?: string) => { if (!id) return "?"; const b = v.battlefield.find((o) => o.id === id); if (b) return `${b.controller === 0 ? "my" : "their"} ${nm(b.cardId)}`; const h = v.hand.find((c) => c.objectId === id); if (h) return nm(h.cardId); const s = v.stack.find((x) => x.id === id); if (s) return `[stack ${nm(s.cardId)}]`; for (const p of [0, 1] as const) { const y = v.graveyardObjects[p].find((c) => c.objectId === id); if (y) return `${nm(y.cardId)} (in ${p === 0 ? "my" : "their"} graveyard)`; } return id; };
  const tg = (v: GameView, a: Action) => ((a as { targets?: { kind: string; id?: string; player?: number }[] }).targets ?? []).map((t) => (t.kind === "player" ? (t.player === 0 ? "ME" : "THEM") : obj(v, t.id))).join(", ");
  await replayThenPlay(pool, decks, g.log, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, spec.modifiers ?? [], undefined, (req, v, a) => {
    if (v.turn !== lastTurn) {
      lastTurn = v.turn;
      const bf = (p: number) => v.battlefield.filter((o) => o.controller === p && !pool.get(o.cardId)?.types.includes("Land")).map((o) => nm(o.cardId) + (o.power !== null ? ` ${o.power}/${o.toughness}` : "")).join(", ");
      const lands = (p: number) => v.battlefield.filter((o) => o.controller === p && pool.get(o.cardId)?.types.includes("Land")).length;
      console.log(`--- T${v.turn} (${v.activePlayer === 0 ? "MINE" : "theirs"}) life ${v.life[0]}-${v.life[1]} | lands ${lands(0)}/${lands(1)} | me: ${bf(0)} | them: ${bf(1)}`);
    }
    if (req.player === 0 && req.purpose === "priority") { const h = v.hand.map((c) => nm(c.cardId)).sort().join(", "); if (h !== lastHand) { lastHand = h; console.log(`      hand: ${h}`); } }
    if (a.type === "pass" || a.type === "tapForMana" || a.type === "untapForMana" || a.type.startsWith("done")) return;
    const st = v.stack.length ? ` {stack: ${v.stack.map((s) => nm(s.cardId)).join(" < ")}}` : "";
    let d: string = a.type;
    if (a.type === "castSpell") d = `cast ${obj(v, a.objectId)}${tg(v, a) ? " → " + tg(v, a) : ""}`;
    else if (a.type === "activateAbility") d = `activate ${obj(v, a.objectId)}#${a.abilityIndex}${tg(v, a) ? " → " + tg(v, a) : ""}`;
    else if (a.type === "playLand") d = `land ${obj(v, a.objectId)}`;
    else if (a.type === "declareAttacker") d = `attack ${obj(v, a.objectId)}`;
    else if (a.type === "declareBlocker") d = `block ${obj(v, a.attacker)} with ${obj(v, a.blocker)}`;
    else if (a.type === "chooseMode") d = `mode: ${a.label.slice(0, 48)}`;
    else d = `${a.type}${tg(v, a) ? " → " + tg(v, a) : ""}`;
    console.log(`   ${req.player === 0 ? "ME  " : "THEM"} ${v.step.padEnd(6)} ${d}${st}`);
  });
}
