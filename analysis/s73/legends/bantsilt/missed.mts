/** Post-S73a (concern 93): in the recorded pilot games, the free mills left unused — at the opponent's end step, seat 0's
 * LAST priority decision with an empty stack: each of its creatures offered a {T}-only mill at the opponent that stayed untapped.
 *   npx tsx analysis/s73/legends/bantsilt/missed.mts <games.json> */
import { readFileSync } from "node:fs";
import { loadCardPool } from "../../../../packages/cards/src/loader.ts";
import { Game, expandDecklist, type Action, type ActionSource } from "../../../../packages/engine/src/index.ts";
import { ArrayLog, ReplayRng } from "../../../../packages/core/src/index.ts";
const ROOT = new URL("../../../../", import.meta.url).pathname;
const pool = loadCardPool(ROOT + "data/cards").cards;
const games = JSON.parse(readFileSync(process.argv[2]!, "utf8")).games as any[];
let T = { used: 0, usedCards: 0, missed: 0, missedCards: 0 };
for (const [gi, g] of games.entries()) {
  const acts = g.log.filter((e: any) => e.t === "ACTION"), rngs = g.log.filter((e: any) => e.t === "RNG").map((e: any) => ({ purpose: e.purpose, value: e.value }));
  let cursor = 0; let game!: Game;
  let last: { turn: number; offered: Map<string, number> } | null = null;
  const R = { used: 0, usedCards: 0, missed: 0, missedCards: 0, spiritTurns: 0 };
  const flush = () => { if (last) { for (const [id, n] of last.offered) { const o = game.state.objects[id]; if (o && o.zone === "battlefield" && !o.tapped) { R.missed++; R.missedCards += n; } } last = null; } };
  const tough = (id: string) => { const o = game.state.objects[id]!; const d = pool.get(o.cardId)!; return (o.basePT?.toughness ?? d.toughness ?? 0) + (o.counters["+1/+1"] ?? 0); };
  const source: ActionSource = (req) => {
    const e = acts[cursor++], s = game.state;
    if (last && s.turn !== last.turn) flush();
    if (req.player === 0 && s.activePlayer === 1 && s.step === "END" && req.purpose === "priority") {
      const offered = new Map<string, number>();
      for (const a of req.actions) if (a.type === "activateAbility" && (a as any).targets?.[0]?.kind === "player" && (a as any).targets[0].player === 1 && s.objects[a.objectId]?.zone === "battlefield" && pool.get(s.objects[a.objectId]!.cardId)!.types.includes("Creature")) offered.set(a.objectId, tough(a.objectId));
      if (s.stack.length === 0) last = { turn: s.turn, offered };
      if (e.action.type === "activateAbility" && offered.has(e.action.objectId)) { R.used++; R.usedCards += offered.get(e.action.objectId)!; }
    }
    return Promise.resolve(e.action);
  };
  const rl = new ArrayLog<Action>();
  game = new Game(pool, [expandDecklist(g.spec.players[0].decklist), expandDecklist(g.spec.players[1].decklist)], new ReplayRng(rngs, rl), rl, source, g.spec.rules);
  await game.run([]); flush();
  const oppLib = game.state.players[1].library.length;
  for (const k of ["used", "usedCards", "missed", "missedCards"] as const) T[k] += R[k];
  if (R.used + R.missed > 0 || g.result.winner === 1) console.log(`${String(gi).padStart(2)} ${g.opponent.padEnd(13)} ${g.result.winner === 0 ? "WON " : "lost"} T${g.result.turns}  end-step mills used ${R.used} (${R.usedCards} cards), left unused ${R.missed} (${R.missedCards} cards); opponent's library at the end ${oppLib}`);
}
console.log(T);
