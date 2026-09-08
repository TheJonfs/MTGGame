/**
 * The Lab's simulation worker: runs one job (a pairing under chosen conditions) with the real engine
 * and the real heuristic agents — the same call the sweep makes in Node — and posts the tally.
 */
import { runMatch, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { loadPool } from "../engine-bridge.js";
import { entranceBasics, labDecks, type LabDeck } from "./lab-decks.js";
import type { LabCell, LabJob, LabSide, WorkerIn, WorkerOut } from "./lab-types.js";

const pool = loadPool();
const decks = new Map<string, LabDeck>(labDecks().map((d): [string, LabDeck] => [d.key, d]));
const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

function side(s: LabSide): { deck: LabDeck; entrance: string[] } {
  const deck = decks.get(s.deck);
  if (!deck) throw new Error(`unknown deck ${s.deck}`);
  return { deck, entrance: entranceBasics(deck, s.basics, pool) };
}

async function run(job: LabJob): Promise<void> {
  const A = side(job.a), B = side(job.b);
  const cell: LabCell = { id: job.id, games: 0, aWins: 0, bWins: 0, draws: 0, aWinsBySeat: [0, 0], gamesBySeat: [0, 0], aDecked: 0, bDecked: 0, turns: [], aMargin: [], bMargin: [], aEntrance: A.entrance, bEntrance: B.entrance, errors: 0 };
  for (let i = 0; i < job.games; i++) {
    const seat = i % 2; // both seats, alternating (the sweep's convention)
    const [p0, p1] = seat === 0 ? [A, B] : [B, A];
    const [s0, s1] = seat === 0 ? [job.a, job.b] : [job.b, job.a];
    const seed = job.seed + i * 31;
    const modifiers: Modifier[] = [
      { type: "startingLife", player: 1, value: s1.life },
      ...p0.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId })),
      ...p1.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 1 as const, cardId })),
    ];
    const spec: MatchSpec = {
      seed,
      players: [{ name: p0.deck.name, decklist: p0.deck.decklist.map((e) => ({ ...e })), agent: "heuristic" }, { name: p1.deck.name, decklist: p1.deck.decklist.map((e) => ({ ...e })), agent: "heuristic" }],
      rules: { startingLife: s0.life, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers,
    };
    const agents: [Agent, Agent] = [
      new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(s0.profile, p0.deck.archetype, p1.deck.decklist.map((e) => ({ ...e })))),
      new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile(s1.profile, p1.deck.archetype, p0.deck.decklist.map((e) => ({ ...e })))),
    ];
    try {
      const r = await runMatch(spec, pool, agents);
      const aSeat = seat as 0 | 1;
      cell.games += 1; cell.gamesBySeat[aSeat] += 1; cell.turns.push(r.turns);
      if (r.winner === null) cell.draws += 1;
      else if (r.winner === aSeat) { cell.aWins += 1; cell.aWinsBySeat[aSeat] += 1; if (r.reason === "DECKED") cell.aDecked += 1; cell.aMargin.push(r.finalLife[aSeat]); }
      else { cell.bWins += 1; if (r.reason === "DECKED") cell.bDecked += 1; cell.bMargin.push(r.finalLife[(1 - aSeat) as 0 | 1]); }
    } catch (e) {
      cell.errors += 1;
      post({ type: "error", id: job.id, message: `${p0.deck.name} vs ${p1.deck.name} seed ${seed}: ${(e as Error).message}` });
    }
    if (i % 5 === 4) { post({ type: "progress", cell }); await new Promise((r) => setTimeout(r, 0)); }
  }
  post({ type: "done", cell });
}

(self as unknown as { onmessage: (ev: MessageEvent<WorkerIn>) => void }).onmessage = (ev: MessageEvent<WorkerIn>) => {
  if (ev.data.type === "run") void run(ev.data.job);
};
