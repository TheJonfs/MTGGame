import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type MatchResult, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { DECKS, PAIRINGS, type DeckKey } from "./slice-decks.js";

export interface PairingReport {
  pairing: string;
  games: number;
  terminations: Record<string, number>;
  meanTurns: number;
  errors: { seed: number; message: string }[];
}

export interface FuzzReport {
  pairings: PairingReport[];
  totalGames: number;
  totalErrors: number;
}

export function matchSpec(seed: number, a: DeckKey, b: DeckKey): MatchSpec {
  return {
    seed,
    players: [
      { name: DECKS[a].name, decklist: [...DECKS[a].decklist], agent: "random" },
      { name: DECKS[b].name, decklist: [...DECKS[b].decklist], agent: "random" },
    ],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
    modifiers: [],
  };
}

export async function runPairingMatch(
  cards: Map<string, CardDef>,
  seed: number,
  a: DeckKey = "A",
  b: DeckKey = "B",
): Promise<MatchResult> {
  // Distinct derived seeds per seat so the two agents don't mirror each other.
  const agents: [RandomAgent, RandomAgent] = [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)];
  return runMatch(matchSpec(seed, a, b), cards, agents);
}

/** Saved-game file format the viewer loads (S6). */
export function savedGame(spec: MatchSpec, result: MatchResult): string {
  return JSON.stringify(
    {
      format: "shandalar-log-v1",
      spec,
      result: { winner: result.winner, reason: result.reason, turns: result.turns, finalLife: result.finalLife },
      log: result.log,
    },
    null,
    1,
  );
}

export async function fuzzPairing(
  cards: Map<string, CardDef>,
  a: DeckKey,
  b: DeckKey,
  games: number,
  startSeed: number,
  onProgress?: (i: number) => void,
  saveDir?: string,
): Promise<PairingReport> {
  const terminations: Record<string, number> = {};
  const errors: { seed: number; message: string }[] = [];
  let totalTurns = 0;
  let completed = 0;

  for (let i = 0; i < games; i++) {
    const seed = startSeed + i;
    try {
      const result = await runPairingMatch(cards, seed, a, b);
      terminations[result.reason] = (terminations[result.reason] ?? 0) + 1;
      totalTurns += result.turns;
      completed += 1;
      if (saveDir) {
        mkdirSync(saveDir, { recursive: true });
        writeFileSync(join(saveDir, `${a}-${b}-${seed}.json`), savedGame(matchSpec(seed, a, b), result));
      }
    } catch (e) {
      errors.push({ seed, message: (e as Error).stack ?? String(e) });
    }
    onProgress?.(i + 1);
  }

  return {
    pairing: `${a}-${b}`,
    games,
    terminations,
    meanTurns: completed > 0 ? totalTurns / completed : 0,
    errors,
  };
}

/** Fuzz every deck pairing (A–B, A–C, B–C). */
export async function fuzz(
  cardsDir: string,
  gamesPerPairing: number,
  startSeed: number,
  onProgress?: (pairing: string, i: number) => void,
  saveDir?: string,
): Promise<FuzzReport> {
  const pool = loadCardPool(cardsDir);
  const pairings: PairingReport[] = [];
  for (const [a, b] of PAIRINGS) {
    pairings.push(
      await fuzzPairing(pool.cards, a, b, gamesPerPairing, startSeed, (i) => onProgress?.(`${a}-${b}`, i), saveDir),
    );
  }
  return {
    pairings,
    totalGames: pairings.reduce((n, p) => n + p.games, 0),
    totalErrors: pairings.reduce((n, p) => n + p.errors.length, 0),
  };
}
