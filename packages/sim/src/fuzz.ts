import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type Agent, type MatchResult, type MatchSpec } from "@shandalar/engine";
import { difficultyProfile, HeuristicAgent, RandomAgent, SanePolicyAgent, type Archetype, type Difficulty } from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES, PAIRINGS, type DeckKey } from "./slice-decks.js";
export { DECK_ARCHETYPES } from "./slice-decks.js";

/** Agent kinds the sim knows how to construct (ADR-045, ADR-049). S9 Part 3:
 * "heuristic" optionally takes a difficulty suffix — "heuristic:apprentice",
 * "heuristic:master"; bare "heuristic" is journeyman. */
export type AgentKind = "random" | "sane" | "heuristic" | `heuristic:${Difficulty}`;
export type AgentPair = [AgentKind, AgentKind];

export function makeAgent(
  kind: AgentKind,
  seed: number,
  cards: Map<string, CardDef>,
  /** For "heuristic": this seat's deck and the opponent's (ADR-051 known-decklists). */
  seats?: { own: DeckKey; opponent: DeckKey },
): Agent {
  if (kind.startsWith("heuristic")) {
    if (!seats) throw new Error("heuristic agent needs deck context (own/opponent)");
    const difficulty = (kind.split(":")[1] ?? "journeyman") as Difficulty;
    return new HeuristicAgent(
      seed,
      cards,
      difficultyProfile(difficulty, DECK_ARCHETYPES[seats.own], [...DECKS[seats.opponent].decklist]),
    );
  }
  return kind === "sane" ? new SanePolicyAgent(seed, cards) : new RandomAgent(seed);
}

export function parseAgentPair(s: string | undefined): AgentPair {
  if (!s) return ["random", "random"];
  const parts = s.split(",").map((p) => p.trim());
  const ok = (p: string) => p === "random" || p === "sane" || /^heuristic(:(apprentice|journeyman|master))?$/.test(p);
  if (parts.length !== 2 || !parts.every(ok)) {
    throw new Error(`Bad --agents "${s}" (expected e.g. heuristic,sane or heuristic:master,heuristic)`);
  }
  return parts as AgentPair;
}

export interface PairingReport {
  pairing: string;
  games: number;
  terminations: Record<string, number>;
  meanTurns: number;
  /** Wins by seat 0 / seat 1 / draws. */
  wins: [number, number, number];
  errors: { seed: number; message: string }[];
}

export interface FuzzReport {
  pairings: PairingReport[];
  totalGames: number;
  totalErrors: number;
}

export function matchSpec(seed: number, a: DeckKey, b: DeckKey, agents: AgentPair = ["random", "random"], startingLife = 20): MatchSpec {
  return {
    seed,
    players: [
      { name: DECKS[a].name, decklist: [...DECKS[a].decklist], agent: agents[0] },
      { name: DECKS[b].name, decklist: [...DECKS[b].decklist], agent: agents[1] },
    ],
    rules: { startingLife, handSize: 7, mulligan: "london", maxTurns: 100 },
    modifiers: [],
  };
}

export async function runPairingMatch(
  cards: Map<string, CardDef>,
  seed: number,
  a: DeckKey = "A",
  b: DeckKey = "B",
  agentPair: AgentPair = ["random", "random"],
  /** S12: world-life duels start low — the ladder can measure at 10 (`--life`). */
  startingLife = 20,
): Promise<MatchResult> {
  // Distinct derived seeds per seat so the two agents don't mirror each other.
  const agents: [Agent, Agent] = [
    makeAgent(agentPair[0], seed * 2 + 1, cards, { own: a, opponent: b }),
    makeAgent(agentPair[1], seed * 2 + 2, cards, { own: b, opponent: a }),
  ];
  return runMatch(matchSpec(seed, a, b, agentPair, startingLife), cards, agents);
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
  agentPair: AgentPair = ["random", "random"],
): Promise<PairingReport> {
  const terminations: Record<string, number> = {};
  const errors: { seed: number; message: string }[] = [];
  const wins: [number, number, number] = [0, 0, 0];
  let totalTurns = 0;
  let completed = 0;

  for (let i = 0; i < games; i++) {
    // Long fuzz loops are pure microtasks: without a macrotask yield the
    // event loop starves and vitest's worker RPC times out (S9 concern 5).
    if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    const seed = startSeed + i;
    try {
      const result = await runPairingMatch(cards, seed, a, b, agentPair);
      terminations[result.reason] = (terminations[result.reason] ?? 0) + 1;
      wins[result.winner ?? 2] += 1;
      totalTurns += result.turns;
      completed += 1;
      if (saveDir) {
        mkdirSync(saveDir, { recursive: true });
        writeFileSync(join(saveDir, `${a}-${b}-${seed}.json`), savedGame(matchSpec(seed, a, b, agentPair), result));
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
    wins,
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
  agentPair: AgentPair = ["random", "random"],
): Promise<FuzzReport> {
  const pool = loadCardPool(cardsDir);
  const pairings: PairingReport[] = [];
  for (const [a, b] of PAIRINGS) {
    pairings.push(
      await fuzzPairing(pool.cards, a, b, gamesPerPairing, startSeed, (i) => onProgress?.(`${a}-${b}`, i), saveDir, agentPair),
    );
  }
  return {
    pairings,
    totalGames: pairings.reduce((n, p) => n + p.games, 0),
    totalErrors: pairings.reduce((n, p) => n + p.errors.length, 0),
  };
}
