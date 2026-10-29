import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { validateCard, type CardDef } from "@shandalar/cards";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
/** A study def (data/cards-study — never in the pool), validated as the loader would. */
const studyDef = (id: string): CardDef => { const d = JSON.parse(readFileSync(join(ROOT, `data/cards-study/${id}.json`), "utf8")) as CardDef; const v = validateCard(d); if (v.errors.length) throw new Error(v.errors.join("; ")); return d; };
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };

/** The pool plus the study defs (Burnfallow (a) — data/cards-study, never in the pool). */
function cardsWithStudy(): Map<string, CardDef> {
  const cards = new Map(loadCardPool(join(ROOT, "data/cards")).cards);
  cards.set("burnfallow_ping", studyDef("burnfallow_ping"));
  return cards;
}

/** Each ground in the lists the brief names for it (S70 Part 1), the ground on its seat's battlefield from the start
 * (the S40 shape: every game exercises the ability). */
const SEATS: Record<string, [string, string][]> = {
  hearthspire: [["open", "muster"], ["open", "marducontrol"], ["open", "tollgate"], ["mardu", "watch"]],
  volmaw: [["open", "writ"], ["esper", "undertow"], ["grixis", "mbclio"], ["esper", "tempo"]],
  nightbower: [["open", "reaperclio"], ["open", "sweep"], ["jund", "bfh"], ["sultai", "massocrafts"]],
  ranksmere: [["open", "depths"], ["open", "countersnake"], ["bant", "skies"], ["peasant", "skies"]],
  burnfallow: [["open", "emeraldsnakes"], ["naya", "stompy"], ["open", "wurmspeaker"], ["open", "reaperclio"]],
  burnfallow_ping: [["open", "emeraldsnakes"], ["naya", "stompy"], ["open", "wurmspeaker"], ["open", "reaperclio"]],
};
const deckOf = (f: string, k: string) => { const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`); return l; };

/** A random agent that counts its activations of a ground's study ability (index 2 — after the two mana abilities). */
class CountingAgent implements Agent {
  activations = 0;
  constructor(private readonly inner: RandomAgent, private readonly ground: string) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "activateAbility" && a.abilityIndex === 2 && view.battlefield.some((o) => o.id === a.objectId && o.cardId === this.ground)) this.activations++;
    return a;
  }
}

/**
 * S70 fuzz-before-fixtures (ADR-192): the five still-pair High Grounds, and Burnfallow's second card, under random
 * play — each in four of the lists that want it, against the next list along, both seats. Zero exceptions, every game
 * terminates, the study ability is activated, replays byte-identical. FUZZ_FULL: 8 seeds a pairing (384 games).
 */
describe("S70 fuzz — the still-pair High Grounds (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;

  it(`${games} games × 6 grounds × 4 lists × 2 seats: zero exceptions, every game terminates, the ability fires`, async () => {
    const cards = cardsWithStudy();
    for (const [ground, seats] of Object.entries(SEATS)) {
      let fired = 0;
      for (let i = 0; i < seats.length; i++) {
        const me = deckOf(...seats[i]!), other = deckOf(...seats[(i + 1) % seats.length]!);
        for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
          const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: other.name, decklist: other.decklist, agent: "random" as const };
          const players: MatchSpec["players"] = seat === 0 ? [a, b] : [b, a];
          const agent = new CountingAgent(new RandomAgent(seed * 2 + 1 + seat), ground);
          const agents: [Agent, Agent] = seat === 0 ? [agent, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), agent];
          const result = await runMatch({ seed: seed * 41 + seat + 7000 + i * 100, players, rules: RULES, modifiers: [{ type: "permanentOnBattlefield", player: seat, cardId: ground }] }, cards, agents);
          expect(result.reason, `${ground} in ${me.name} vs ${other.name} seat ${seat} seed ${seed}`).toBeTruthy();
          fired += agent.activations;
        }
      }
      expect(fired, `${ground}: the study ability was never activated`).toBeGreaterThan(0);
      if (process.env.FUZZ_FULL) console.log(`${ground}: ${fired} activations in ${seats.length * games * 2} games`);
    }
  }, 1_800_000);

  it("replay determinism — each ground's game replays byte-identical", async () => {
    const cards = cardsWithStudy();
    for (const [ground, seats] of Object.entries(SEATS)) {
      const me = deckOf(...seats[0]!), other = deckOf(...seats[1]!);
      const modifiers: MatchSpec["modifiers"] = [{ type: "permanentOnBattlefield", player: 0, cardId: ground }];
      const seed = 90 + Object.keys(SEATS).indexOf(ground);
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: other.name, decklist: other.decklist, agent: "random" }], rules: RULES, modifiers }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), other.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, modifiers);
      expect(replayed, ground).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
