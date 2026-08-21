import type { CardDef } from "@shandalar/cards";
import { runMatch, type Agent } from "@shandalar/engine";
import {
  DEFAULT_CONSTANTS,
  HeuristicAgent,
  difficultyProfile,
  type EvalConstants,
} from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "./slice-decks.js";
import { matchSpec } from "./fuzz.js";

/**
 * S11 Part 3 (ADR-060.3): automated evaluator-constant search for the master
 * profile. Method: coordinate descent with multiplicative steps — chosen over
 * CEM because the constants are near-separable exchange rates, every step is
 * reproducible from the seed, and there is no population size to tune.
 *
 * Objective: aggregate MIRROR win rate of the candidate (master temperature,
 * candidate constants) vs journeyman (default constants), all 5 mirrors, both
 * seats, fixed games/cell, common random numbers across evaluations (paired
 * comparisons — variance falls out). Verification runs on held-out seeds.
 */

/** The declared search space (ADR-060.3: keyword bonuses, hand/life weights,
 * deterrence constants). Each entry reads/writes one number in EvalConstants. */
export interface SearchParam {
  name: string;
  get: (c: EvalConstants) => number;
  set: (c: EvalConstants, v: number) => void;
}

export function searchParams(): SearchParam[] {
  const params: SearchParam[] = [];
  for (const k of Object.keys(DEFAULT_CONSTANTS.keywordBonus)) {
    params.push({
      name: `keyword.${k}`,
      get: (c) => c.keywordBonus[k]!,
      set: (c, v) => void (c.keywordBonus[k] = v),
    });
  }
  for (const arch of ["aggro", "midrange", "control"] as const) {
    for (const w of ["ownLife", "oppLife", "material", "hand"] as const) {
      params.push({
        name: `weights.${arch}.${w}`,
        get: (c) => c.weights[arch][w],
        set: (c, v) => void (c.weights[arch][w] = v),
      });
    }
  }
  params.push({
    name: "deterrence.weight",
    get: (c) => c.deterrence.weight,
    set: (c, v) => void (c.deterrence.weight = v),
  });
  params.push({
    name: "deterrence.wallFraction",
    get: (c) => c.deterrence.wallFraction,
    set: (c, v) => void (c.deterrence.wallFraction = v),
  });
  return params;
}

export function cloneConstants(c: EvalConstants): EvalConstants {
  return structuredClone(c);
}

const MASTER_TEMPERATURE = 0.12;

/** Aggregate mirror win rate of candidate-constants master vs journeyman. */
export async function mirrorObjective(
  cards: Map<string, CardDef>,
  candidate: EvalConstants,
  gamesPerCell: number,
  startSeed: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ rate: number; perCell: Record<string, number> }> {
  const perCell: Record<string, number> = {};
  let wins = 0;
  let total = 0;
  const decks = Object.keys(DECKS) as DeckKey[];
  for (const d of decks) {
    for (const candidateSeat of [0, 1] as const) {
      const cellSeed = startSeed + decks.indexOf(d) * 100_000 + candidateSeat * 50_000;
      let cellWins = 0;
      for (let i = 0; i < gamesPerCell; i++) {
        if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0)); // event-loop air
        const seed = cellSeed + i;
        const mkMaster = (agentSeed: number): Agent =>
          new HeuristicAgent(agentSeed, cards, {
            archetype: DECK_ARCHETYPES[d],
            opponentDecklist: [...DECKS[d].decklist],
            temperature: MASTER_TEMPERATURE,
            holdTricks: true,
            constants: candidate,
          });
        const mkJourneyman = (agentSeed: number): Agent =>
          new HeuristicAgent(agentSeed, cards, difficultyProfile("journeyman", DECK_ARCHETYPES[d], [...DECKS[d].decklist]));
        const agents: [Agent, Agent] =
          candidateSeat === 0
            ? [mkMaster(seed * 2 + 1), mkJourneyman(seed * 2 + 2)]
            : [mkJourneyman(seed * 2 + 1), mkMaster(seed * 2 + 2)];
        const r = await runMatch(matchSpec(seed, d, d, ["heuristic:master", "heuristic"]), cards, agents);
        if (r.winner === candidateSeat) {
          wins += 1;
          cellWins += 1;
        }
        total += 1;
        onProgress?.(total, decks.length * 2 * gamesPerCell);
      }
      perCell[`${d}-${d} seat${candidateSeat}`] = cellWins / gamesPerCell;
    }
  }
  return { rate: wins / total, perCell };
}

export interface SearchOptions {
  gamesPerCell: number;
  sweeps: number;
  searchSeed: number;
  /** Multiplicative step per trial move (up and down are both tried). */
  stepFactor: number;
  onLog?: (line: string) => void;
}

export interface SearchResult {
  constants: EvalConstants;
  searchRate: number;
  history: { param: string; from: number; to: number; rate: number }[];
  evaluations: number;
}

/** Coordinate descent: sweep the declared params; for each, try ×step and
 * ÷step; keep a move only if the objective strictly improves. Same seeds for
 * every evaluation (common random numbers), so improvements are paired. */
export async function coordinateDescent(
  cards: Map<string, CardDef>,
  options: SearchOptions,
): Promise<SearchResult> {
  const { gamesPerCell, sweeps, searchSeed, stepFactor, onLog } = options;
  const params = searchParams();
  let best = cloneConstants(DEFAULT_CONSTANTS);
  let bestRate = (await mirrorObjective(cards, best, gamesPerCell, searchSeed)).rate;
  let evaluations = 1;
  const history: SearchResult["history"] = [];
  onLog?.(`start: ${(100 * bestRate).toFixed(2)}% (${params.length} params, ${gamesPerCell}/cell, seed ${searchSeed})`);

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let moved = false;
    for (const p of params) {
      const current = p.get(best);
      for (const factor of [stepFactor, 1 / stepFactor]) {
        const trialValue = Math.round(current * factor * 1000) / 1000;
        if (trialValue === current) continue;
        const trial = cloneConstants(best);
        p.set(trial, trialValue);
        const { rate } = await mirrorObjective(cards, trial, gamesPerCell, searchSeed);
        evaluations += 1;
        if (rate > bestRate) {
          onLog?.(`  ${p.name}: ${current} -> ${trialValue} (${(100 * bestRate).toFixed(2)}% -> ${(100 * rate).toFixed(2)}%)`);
          history.push({ param: p.name, from: current, to: trialValue, rate });
          best = trial;
          bestRate = rate;
          moved = true;
          break; // take the improving direction; revisit next sweep
        }
      }
    }
    onLog?.(`sweep ${sweep + 1}/${sweeps} done: ${(100 * bestRate).toFixed(2)}% (${evaluations} evaluations)`);
    if (!moved) {
      onLog?.(`converged (no improving move in sweep ${sweep + 1})`);
      break;
    }
  }
  return { constants: best, searchRate: bestRate, history, evaluations };
}
