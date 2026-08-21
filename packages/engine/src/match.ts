import { ArrayLog, SeededRng, type ActionLogEntry } from "@shandalar/core";
import type { CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import type { Agent } from "./agent.js";
import { Game, DEFAULT_RULES, type ActionSource } from "./game.js";
import type { Modifier } from "./modifiers.js";
import { stableStringify } from "./serialize.js";
import type { PlayerId } from "./state.js";

/** MatchSpec / MatchResult (data-model §5) — the engine's external contract. */

export interface PlayerSpec {
  name: string;
  decklist: { cardId: string; count: number }[];
  agent: string; // e.g. "random", "ai:aggro", "human" — resolved by the caller
}

export interface MatchSpec {
  seed: number;
  players: [PlayerSpec, PlayerSpec];
  rules: { startingLife: number; handSize: number; mulligan: "london"; maxTurns: number; ante?: number };
  modifiers: Modifier[];
}

export interface MatchFacts {
  damageDealt: [number, number];
  creaturesLost: [number, number];
  cardsDrawn: [number, number];
  spellsCast: Record<string, [number, number]>;
  /** S12 (R-043): each player's ante stakes (cardIds) — empty when rules.ante is 0 or the library held no nonlands. */
  ante: [string[], string[]];
}

export interface MatchResult {
  winner: PlayerId | null;
  reason: "LIFE" | "DECKED" | "CONCEDE" | "MAX_TURNS" | "DRAW";
  turns: number;
  finalLife: [number, number];
  log: ActionLogEntry<Action>[];
  facts: MatchFacts;
  /** Canonical final state, for replay verification. */
  finalStateSerialized: string;
}

export function expandDecklist(decklist: { cardId: string; count: number }[]): string[] {
  const out: string[] = [];
  for (const { cardId, count } of decklist) {
    for (let i = 0; i < count; i++) out.push(cardId);
  }
  return out;
}

export function validateDecklist(cards: Map<string, CardDef>, decklist: { cardId: string; count: number }[]): void {
  for (const { cardId, count } of decklist) {
    if (!cards.has(cardId)) throw new Error(`Decklist references unknown card "${cardId}"`);
    if (!Number.isInteger(count) || count < 1) throw new Error(`Bad count for ${cardId}`);
  }
}

/** Facts are derived from the log, never tracked by the engine (manifest §1a). */
export function deriveFacts(cards: Map<string, CardDef>, log: ActionLogEntry<Action>[]): MatchFacts {
  const facts: MatchFacts = {
    damageDealt: [0, 0],
    creaturesLost: [0, 0],
    cardsDrawn: [0, 0],
    spellsCast: {},
    ante: [[], []],
  };
  for (const entry of log) {
    if (entry.t !== "EVENT") continue;
    const p = entry.payload as Record<string, unknown>;
    switch (entry.name) {
      case "DAMAGE":
        facts.damageDealt[p.sourceController as PlayerId] += p.amount as number;
        break;
      case "CARD_DRAWN":
        facts.cardsDrawn[p.player as PlayerId] += 1;
        break;
      case "SPELL_CAST": {
        const cardId = p.cardId as string;
        const row = (facts.spellsCast[cardId] ??= [0, 0]);
        row[p.controller as PlayerId] += 1;
        break;
      }
      case "ANTE_SET":
        facts.ante[p.player as PlayerId] = [...(p.cardIds as string[])];
        break;
      case "DIES": {
        const cardId = p.cardId as string;
        if (cards.get(cardId)?.types.includes("Creature")) {
          facts.creaturesLost[p.owner as PlayerId] += 1;
        }
        break;
      }
    }
  }
  return facts;
}

/**
 * MatchSpec → MatchResult (engine-design §13). Agents are passed as instances;
 * mapping the spec's agent strings to implementations is the caller's job
 * (`engine` never imports `agents`).
 */
export async function runMatch(spec: MatchSpec, cards: Map<string, CardDef>, agents: [Agent, Agent]): Promise<MatchResult> {
  for (const p of spec.players) validateDecklist(cards, p.decklist);
  const log = new ArrayLog<Action>();
  const rng = new SeededRng(spec.seed, log);
  const source: ActionSource = (req, view) => agents[req.player].chooseAction(view, req);
  const decklists: [string[], string[]] = [
    expandDecklist(spec.players[0].decklist),
    expandDecklist(spec.players[1].decklist),
  ];
  const game = new Game(cards, decklists, rng, log, source, {
    startingLife: spec.rules.startingLife ?? DEFAULT_RULES.startingLife,
    handSize: spec.rules.handSize ?? DEFAULT_RULES.handSize,
    maxTurns: spec.rules.maxTurns ?? DEFAULT_RULES.maxTurns,
    ante: spec.rules.ante ?? DEFAULT_RULES.ante,
  });
  await game.run(spec.modifiers);

  const state = game.state;
  const result = state.result ?? { winner: null, reason: "DRAW" as const };
  return {
    winner: result.winner,
    reason: result.reason,
    turns: state.turn,
    finalLife: [state.players[0].life, state.players[1].life],
    log: log.entries,
    facts: deriveFacts(cards, log.entries),
    finalStateSerialized: stableStringify(state),
  };
}
