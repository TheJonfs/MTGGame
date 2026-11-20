/**
 * S73a (Chris, 2026-11-20) — his Bant Silt run (Bant, seed 57574, 8–0 / 16–1) read game by game.
 *   npx tsx analysis/s73/legends/bantsilt/narrate.mts <games.json> <eventSeed> <outDir>
 * Each logged game replayed by the engine (no agents), narrated with card names and a board line each turn.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadCardPool } from "../../../../packages/cards/src/loader.ts";
import { Game, expandDecklist, type Action, type ActionSource } from "../../../../packages/engine/src/index.ts";
import { ArrayLog, ReplayRng } from "../../../../packages/core/src/index.ts";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const [file, seedArg, outDir] = process.argv.slice(2) as [string, string, string];
const pool = loadCardPool(ROOT + "data/cards").cards;
const all = JSON.parse(readFileSync(file, "utf8")).games as any[];
const games = all.filter((g) => g.eventSeed === Number(seedArg));
mkdirSync(outDir, { recursive: true });

for (const [gi, g] of games.entries()) {
  const lines: string[] = [];
  const acts = g.log.filter((e: any) => e.t === "ACTION");
  const rngs = g.log.filter((e: any) => e.t === "RNG").map((e: any) => ({ purpose: e.purpose, value: e.value }));
  let cursor = 0, lastTurn = -1, lastStep = "";
  let game!: Game;
  const nm = (id: string) => { const o = game.state.objects[id]; return o ? (pool.get(o.cardId)?.name ?? o.cardId) : id; };
  const board = (p: number) => {
    const s = game.state, m = new Map<string, number>();
    for (const id of s.battlefield) { const o = s.objects[id]!; if (o.controller !== p) continue; const c = Object.entries(o.counters).filter(([, n]) => n).map(([k, n]) => `${k}${n}`).join(""); const k = nm(id) + (o.tapped ? "(T)" : "") + (c ? `[${c}]` : ""); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([k, n]) => (n > 1 ? `${n}x ${k}` : k)).join(", ");
  };
  const status = () => { const s = game.state; return [0, 1].map((p) => `P${p} life ${s.players[p]!.life} lib ${s.players[p]!.library.length} hand ${s.players[p]!.hand.length} gy ${s.players[p]!.graveyard.length}`).join(" | "); };
  const hand = () => game.state.players[0].hand.map(nm).join(", ");
  const source: ActionSource = (req) => {
    const e = acts[cursor]; if (!e) throw new Error("log exhausted"); if (e.player !== req.player) throw new Error(`divergence at ${cursor}`);
    cursor++;
    const s = game.state;
    if (s.turn !== lastTurn) { lastTurn = s.turn; lastStep = ""; lines.push("", `== TURN ${s.turn} (active P${s.activePlayer}) ${status()}`, `   P0: ${board(0)}`, `   P1: ${board(1)}`, `   P0 hand: ${hand()}`); }
    const a = e.action as Action & Record<string, unknown>;
    const quiet = a.type === "pass" || a.type === "doneDeclaringAttackers" || a.type === "doneDeclaringBlockers";
    if (!quiet || (a.type !== "pass" && e.player === 0)) {
      if (s.step !== lastStep) { lastStep = s.step; lines.push(`  -- ${s.step}`); }
      const { type, ...rest } = a;
      let txt = JSON.stringify(rest).replace(/obj_\d+/g, (id) => nm(id)).replace(/[{}"]/g, "").replace(/objectId:/, "");
      if (type === "chooseMode" || (type === "activateAbility" && e.player === 0)) txt += `   || P0: ${board(0)} || P1: ${board(1)} || libs ${s.players[0].library.length}/${s.players[1].library.length}`;
      if (s.stack.length && (type === "castSpell" || type === "activateAbility")) txt += `   (stack: ${s.stack.map((x: any) => nm(x.sourceId ?? x.objectId ?? x.id)).join(" < ")})`;
      lines.push(`     P${e.player} ${type} ${txt}`);
    }
    return Promise.resolve(e.action);
  };
  const dl: [string[], string[]] = [expandDecklist(g.spec.players[0].decklist), expandDecklist(g.spec.players[1].decklist)];
  const rl = new ArrayLog<Action>();
  game = new Game(pool, dl, new ReplayRng(rngs, rl), rl, source, g.spec.rules);
  await game.run(g.spec.modifiers ?? []);
  lines.push("", `== END ${JSON.stringify(game.state.result)} ${status()}`, `   P0: ${board(0)}`, `   P1: ${board(1)}`);
  const head = `# game ${gi}: ${g.phase} r${g.round} g${g.game} vs ${g.opponent} (${g.list}) — logged ${JSON.stringify(g.result)}; start P${g.spec.rules.startingPlayer}`;
  writeFileSync(`${outDir}/g${String(gi).padStart(2, "0")}.txt`, [head, ...lines].join("\n") + "\n");
  console.log(head, "lines", lines.length);
}
