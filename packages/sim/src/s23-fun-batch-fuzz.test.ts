import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchResult, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;

/**
 * S23 fun-batch fuzz-before-fixtures (the S3 protocol): the three REAL cards are their own fuzz
 * vehicles — no synthetics needed, the words are that small. The decks are built to make random
 * play stumble into every interesting line: Zombify reanimates a dead Thundersnake OFF-TURN (the
 * every-end-step kill), Rancor grants the Traumatizer trample (the partial-damage mill), the
 * Djinn attacks and blocks under random declarations (the aggression tax both ways).
 *
 * A coverage probe asserts each card's machinery actually FIRED across the batch — a fuzz that
 * never exercises the new words proves nothing (the S22a precedent).
 */

const DECK_GALLOWS: { cardId: string; count: number }[] = [
  { cardId: "mountain", count: 7 },
  { cardId: "swamp", count: 8 },
  { cardId: "thundersnake", count: 4 },
  { cardId: "gallows_djinn", count: 4 },
  { cardId: "zombify", count: 3 },
  { cardId: "shock", count: 2 },
  { cardId: "raging_goblin", count: 2 },
];
const DECK_TRAUMA: { cardId: string; count: number }[] = [
  { cardId: "island", count: 8 },
  { cardId: "forest", count: 7 },
  { cardId: "traumatizer", count: 4 },
  { cardId: "rancor", count: 4 },
  { cardId: "grizzly_bears", count: 4 },
  { cardId: "giant_growth", count: 3 },
];

function spec(seed: number): MatchSpec {
  return {
    seed,
    players: [
      { name: "Gallows", decklist: DECK_GALLOWS, agent: "random" },
      { name: "Trauma", decklist: DECK_TRAUMA, agent: "random" },
    ],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
    modifiers: [],
  };
}

async function run(seed: number): Promise<MatchResult> {
  return runMatch(spec(seed), pool, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
}

describe("S23 fun-batch fuzz (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 300 : 60;
  it(`${games} random games over the batch decks: zero exceptions, every game terminates; every new word FIRES`, async () => {
    let snakeDeaths = 0;
    let djinnTaxes = 0;
    let traumaMills = 0;
    for (let seed = 1; seed <= games; seed++) {
      const result = await run(seed);
      expect(result.reason).toBeTruthy();
      for (const e of result.log) {
        if (e.t !== "EVENT") continue;
        if (e.name === "DIES" && (e.payload as { cardId: string }).cardId === "thundersnake") snakeDeaths += 1;
        if (e.name === "DAMAGE") {
          const p = e.payload as { sourceCardId: string; target: { kind: string; player?: number }; sourceController: number; combat: boolean };
          if (p.sourceCardId === "gallows_djinn" && p.target.kind === "player" && p.target.player === p.sourceController && !p.combat) djinnTaxes += 1;
        }
        if (e.name === "MILLED") traumaMills += 1;
      }
    }
    // Coverage probe: the words fired under random play (not just compiled).
    expect(snakeDeaths, "Thundersnake end-step sacrifices").toBeGreaterThan(0);
    expect(djinnTaxes, "Gallows Djinn self-taxes (attack or block)").toBeGreaterThan(0);
    expect(traumaMills, "Traumatizer combat-damage mills").toBeGreaterThan(0);
  }, 600_000);

  it("replay determinism holds through the batch's triggers (END_STEP, BLOCKS, eventDamage)", async () => {
    for (const seed of [2, 19, 47]) {
      const live = await run(seed);
      const replayed = await replayGame(
        pool,
        [DECK_GALLOWS.flatMap((d) => Array(d.count).fill(d.cardId)), DECK_TRAUMA.flatMap((d) => Array(d.count).fill(d.cardId))],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
        [],
      );
      expect(replayed, `seed ${seed}`).toBe(live.finalStateSerialized);
    }
  }, 120_000);
});
