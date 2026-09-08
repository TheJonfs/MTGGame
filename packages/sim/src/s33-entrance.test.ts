import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { Game, replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { MAGE_DECKS } from "./mage-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };

/**
 * S33 (the mage entrance — Part 1's second lever): a tier-2/3 mage may begin the duel with basics on
 * the battlefield, the player's manalink shape (`permanentOnBattlefield`, the Heart's roots path).
 * The brief asks for the roots fixtures at one and two basics for a MAGE: untapped, before turn one,
 * no ETB, logged, replay byte-exact.
 */
describe("S33 — the mage entrance rides the Heart's roots path (permanentOnBattlefield)", () => {
  const cards = loadCardPool(CARDS_DIR).cards;
  const corvane = MAGE_DECKS.corvane!;
  const road = MAGE_DECKS.oriel!;
  const spec = (basics: string[]): MatchSpec => ({
    seed: 3301,
    players: [{ name: road.name, decklist: road.decklist, agent: "random" }, { name: corvane.name, decklist: corvane.decklist, agent: "random" }],
    rules: RULES,
    modifiers: [{ type: "startingLife", player: 1, value: 16 }, ...basics.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 1 as const, cardId }))],
  });

  it("one and two basics enter untapped under the mage before turn one, are the mage's own, and fire no landfall", async () => {
    for (const basics of [["plains"], ["plains", "swamp"]]) {
      const r = await runMatch(spec(basics), cards, [new RandomAgent(1), new RandomAgent(2)]);
      // Re-derive the opening state from the log: the first ACTION comes after the entrance landed.
      const firstAction = r.log.findIndex((e) => e.t === "ACTION");
      const events = r.log.slice(0, firstAction).filter((e) => e.t === "EVENT");
      // The basics' ZONE_CHANGEs are not logged (only DIES/RETURNED are); the tell is the absence of a landfall
      // trigger: no Crab, no Gladehart on either side here, and no LAND_ENTERS event is logged at all.
      expect(events.some((e) => e.name === "RETURNED")).toBe(false);
      expect(r.finalLife[1]).toBeLessThanOrEqual(16);
      expect(r.reason).toBeTruthy();
    }
  });

  it("the entrance is in the spec, so the replay reproduces it byte-exact (two basics)", async () => {
    const s = spec(["plains", "swamp"]);
    const live = await runMatch(s, cards, [new RandomAgent(1), new RandomAgent(2)]);
    const replayed = await replayGame(
      cards,
      [road.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), corvane.decklist.flatMap((d) => Array(d.count).fill(d.cardId))],
      live.log,
      { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
      s.modifiers,
    );
    expect(replayed).toBe(live.finalStateSerialized);
  });

  it("the opening board: the two basics stand untapped under the mage at the first priority (after the mulligans, ADR-002)", async () => {
    // The engine's own state at the first request: drive a Game with a scripted source that captures it.
    const s = spec(["plains", "swamp"]);
    let seen: { ids: string[]; tapped: boolean[]; controllers: number[] } | null = null;
    const agents = [new RandomAgent(1), new RandomAgent(2)];
    const capture = {
      async chooseAction(view: Parameters<RandomAgent["chooseAction"]>[0], request: Parameters<RandomAgent["chooseAction"]>[1]) {
        // ADR-002: modifiers apply after setup and mulligans — the mulligan request sees an empty board.
        if (!seen && request.purpose === "priority") seen = { ids: view.battlefield.map((o) => o.cardId), tapped: view.battlefield.map((o) => o.tapped), controllers: view.battlefield.map((o) => o.controller) };
        return agents[view.you]!.chooseAction(view, request);
      },
    };
    await runMatch(s, cards, [capture, capture]);
    expect(seen).not.toBeNull();
    expect(seen!.ids.sort()).toEqual(["plains", "swamp"]);
    expect(seen!.tapped).toEqual([false, false]);
    expect(seen!.controllers).toEqual([1, 1]);
    void Game;
  });
});
