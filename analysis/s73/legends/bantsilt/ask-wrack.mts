/** Post-S73a: a recorded pilot game replayed to a turn and step; at each of seat 0's priority decisions there, what the pilot was offered and how it scored it.
 *   npx tsx analysis/s73/legends/bantsilt/ask.mts <games.json> <index> <turn> <STEP> */
import { readFileSync } from "node:fs";
import { loadCardPool } from "../../../../packages/cards/src/loader.ts";
import { Game, expandDecklist, type Action, type ActionSource } from "../../../../packages/engine/src/index.ts";
import { ArrayLog, ReplayRng } from "../../../../packages/core/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../../packages/agents/src/index.ts";
import { FORMAT_FIELD } from "../../../../packages/sim/src/open-decks.ts";
const ROOT = new URL("../../../../", import.meta.url).pathname;
const [file, gi, turn, step] = process.argv.slice(2) as [string, string, string, string];
const pool = loadCardPool(ROOT + "data/cards").cards;
const g = (JSON.parse(readFileSync(file, "utf8")).games as any[])[Number(gi)];
const D = FORMAT_FIELD.bant!, A = D.silt!, B = D[g.opponent]!;
const agent = new HeuristicAgent(1, pool, difficultyProfile("master", A.archetype as never, [...B.decklist], [...A.decklist]));
const acts = g.log.filter((e: any) => e.t === "ACTION"), rngs = g.log.filter((e: any) => e.t === "RNG").map((e: any) => ({ purpose: e.purpose, value: e.value }));
let cursor = 0; let game!: Game;
const nm = (id: string) => { const o = game.state.objects[id]; return o ? o.cardId : id; };
const source: ActionSource = (req, view) => {
  const e = acts[cursor++];
  if (req.player === 0 && req.purpose === "priority" && req.actions.some((a: any) => a.type === "activateAbility" && nm(a.objectId) === "wrackroot" && a.abilityIndex === 2)) { const ps = (agent as any).scorePriorityAction(view, { type: "pass" }); const ws = req.actions.filter((a: any) => a.type === "activateAbility" && nm(a.objectId) === "wrackroot" && a.abilityIndex === 2).map((a: any) => [(agent as any).scorePriorityAction(view, a), nm(a.targets[0].id), game.state.objects[a.targets[0].id].controller]).sort((x: any, y: any) => y[0] - x[0]); console.log(`W ${game.state.activePlayer === 0 ? "mine" : "opp"} ${game.state.step} pass ${ps.toFixed(2)} best ${ws[0][0] === -Infinity ? "-inf" : ws[0][0].toFixed(2)} at ${ws[0][1]}(P${ws[0][2]}) taken ${e.action.type}`); } if (false) {
    console.log(`\n-- decision ${cursor - 1} (${req.purpose}); taken: ${JSON.stringify(e.action).replace(/obj_\d+/g, nm)}`);
    for (const a of req.actions) {
      const s = (agent as any).scorePriorityAction ? (() => { try { return (agent as any).scorePriorityAction(view, a); } catch (x) { return `err ${x}`; } })() : "?";
      console.log(`   ${String(typeof s === "number" ? s.toFixed(3) : s).padStart(9)}  gated=${agent.tapMillTimingGated(view, a)}  ${JSON.stringify(a).replace(/obj_\d+/g, nm).slice(0, 150)}`);
    }
  }
  return Promise.resolve(e.action);
};
const rl = new ArrayLog<Action>();
game = new Game(pool, [expandDecklist(g.spec.players[0].decklist), expandDecklist(g.spec.players[1].decklist)], new ReplayRng(rngs, rl), rl, source, g.spec.rules);
await game.run([]);
