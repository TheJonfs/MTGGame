/**
 * The Lab's simulation worker: runs one job (two RESOLVED sides under chosen conditions) with the
 * real engine and the real heuristic agents — the same call the sweep makes in Node — and posts the
 * tally. The page resolves decks, entrances and bonuses; the worker knows no catalogue.
 */
import { runMatch, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { loadPool } from "../engine-bridge.js";
import { sideModifiers } from "./lab-decks.js";
import type { LabCell, LabJob, WorkerIn, WorkerOut } from "./lab-types.js";

const pool = loadPool();
const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

async function run(job: LabJob): Promise<void> {
  const cell: LabCell = { id: job.id, games: 0, aWins: 0, bWins: 0, draws: 0, aWinsBySeat: [0, 0], gamesBySeat: [0, 0], aDecked: 0, bDecked: 0, turns: [], aMargin: [], bMargin: [], aEntrance: job.a.entrance, bEntrance: job.b.entrance, errors: 0 };
  for (let i = 0; i < job.games; i++) {
    const seat = (i % 2) as 0 | 1; // both seats, alternating (the sweep's convention)
    const [p0, p1] = seat === 0 ? [job.a, job.b] : [job.b, job.a];
    const seed = job.seed + i * 31;
    // Both sides' modifiers; the first player's startingLife rides the rules, so drop its modifier.
    const modifiers: Modifier[] = [...sideModifiers(p0, 0).filter((m) => m.type !== "startingLife"), ...sideModifiers(p1, 1)];
    const spec: MatchSpec = {
      seed,
      players: [{ name: p0.name, decklist: p0.decklist.map((e) => ({ ...e })), agent: "heuristic" }, { name: p1.name, decklist: p1.decklist.map((e) => ({ ...e })), agent: "heuristic" }],
      rules: { startingLife: p0.life, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers,
    };
    const agents: [Agent, Agent] = [
      new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(p0.profile, p0.archetype, p1.decklist.map((e) => ({ ...e })))),
      new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile(p1.profile, p1.archetype, p0.decklist.map((e) => ({ ...e })))),
    ];
    try {
      const r = await runMatch(spec, pool, agents);
      cell.games += 1; cell.gamesBySeat[seat] += 1; cell.turns.push(r.turns);
      if (r.winner === null) cell.draws += 1;
      else if (r.winner === seat) { cell.aWins += 1; cell.aWinsBySeat[seat] += 1; if (r.reason === "DECKED") cell.aDecked += 1; cell.aMargin.push(r.finalLife[seat]); }
      else { cell.bWins += 1; if (r.reason === "DECKED") cell.bDecked += 1; cell.bMargin.push(r.finalLife[(1 - seat) as 0 | 1]); }
    } catch (e) {
      cell.errors += 1;
      post({ type: "error", id: job.id, message: `${p0.name} vs ${p1.name} seed ${seed}: ${(e as Error).message}` });
    }
    if (i % 5 === 4) { post({ type: "progress", cell }); await new Promise((r) => setTimeout(r, 0)); }
  }
  post({ type: "done", cell });
}

(self as unknown as { onmessage: (ev: MessageEvent<WorkerIn>) => void }).onmessage = (ev: MessageEvent<WorkerIn>) => {
  if (ev.data.type === "run") void run(ev.data.job);
};
