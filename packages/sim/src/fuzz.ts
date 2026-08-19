import { loadCardPool, type CardDef } from "@shandalar/cards";
import { runMatch, type MatchResult, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { DECK_A_MONO_RED, DECK_B_WU_SKIES } from "./slice-decks.js";

export interface FuzzReport {
  games: number;
  terminations: Record<string, number>;
  meanTurns: number;
  errors: { seed: number; message: string }[];
}

export function sliceMatchSpec(seed: number): MatchSpec {
  return {
    seed,
    players: [
      { name: "Red Aggro", decklist: DECK_A_MONO_RED, agent: "random" },
      { name: "WU Skies", decklist: DECK_B_WU_SKIES, agent: "random" },
    ],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
    modifiers: [],
  };
}

export async function runSliceMatch(cards: Map<string, CardDef>, seed: number): Promise<MatchResult> {
  // Distinct derived seeds per seat so the two agents don't mirror each other.
  const agents: [RandomAgent, RandomAgent] = [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)];
  return runMatch(sliceMatchSpec(seed), cards, agents);
}

export async function fuzz(cardsDir: string, games: number, startSeed: number, onProgress?: (i: number) => void): Promise<FuzzReport> {
  const pool = loadCardPool(cardsDir);
  const terminations: Record<string, number> = {};
  const errors: { seed: number; message: string }[] = [];
  let totalTurns = 0;
  let completed = 0;

  for (let i = 0; i < games; i++) {
    const seed = startSeed + i;
    try {
      const result = await runSliceMatch(pool.cards, seed);
      terminations[result.reason] = (terminations[result.reason] ?? 0) + 1;
      totalTurns += result.turns;
      completed += 1;
    } catch (e) {
      errors.push({ seed, message: (e as Error).stack ?? String(e) });
    }
    onProgress?.(i + 1);
  }

  return {
    games,
    terminations,
    meanTurns: completed > 0 ? totalTurns / completed : 0,
    errors,
  };
}
