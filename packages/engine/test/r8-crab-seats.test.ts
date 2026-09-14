import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

type TG = TestGame;
const lib = (tg: TG, p: 0 | 1) => tg.game.state.players[p].library.length;
const gy = (tg: TG, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);

/**
 * Deploy playtest r8 (Chris's brother, world play, no seed): a Hedron Crab trigger the player aimed at the
 * opponent "milled the player". The engine's seat plumbing, pinned from BOTH seats with a Crab on each side:
 * only the land-player's Crab fires (the collector is controller-relative), the chosen target is the one
 * milled, and the other library is untouched. The chooser's seat is the Crab's controller, whichever seat.
 */
describe("r8 — the Crab trigger's seat plumbing, source-independent", () => {
  for (const me of [0, 1] as const) {
    const them = (1 - me) as 0 | 1;
    it(`seat ${me} plays a land with a Crab on EACH side: one trigger, chosen at the opponent, mills the opponent by three and no one else`, async () => {
      const players: [Record<string, unknown>, Record<string, unknown>] = [{}, {}];
      players[me] = { battlefield: ["hedron_crab"], hand: ["island"], library: Array(12).fill("island") };
      players[them] = { battlefield: ["hedron_crab"], hand: [], library: Array(12).fill("swamp") };
      const tg = new TestGame({
        name: `r8-crab-seat-${me}`,
        setup: { active: me, step: "MAIN1", players: players as never },
        script: [
          { player: me, do: "playLand", card: "island" },
          { player: me, do: "chooseTriggerTargets", targets: [{ player: them }] },
        ],
      });
      const before: [number, number] = [lib(tg, 0), lib(tg, 1)];
      await tg.game.runStep("MAIN1");
      expect(lib(tg, them), "the opponent's library lost three").toBe(before[them] - 3);
      expect(lib(tg, me), "our library is untouched").toBe(before[me]);
      expect(gy(tg, them).filter((c) => c === "swamp").length).toBe(3); // the opponent's library is swamps whichever seat they hold
      expect(gy(tg, me)).toEqual([]);
      // Exactly one Crab trigger was chosen (the opponent's Crab did not fire on our land).
      expect(tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "chooseTriggerTargets")).toHaveLength(1);
      const milled = tg.log.entries.filter((e) => e.t === "EVENT" && e.name === "MILLED") as { payload: { player: number } }[];
      expect(milled).toHaveLength(3);
      expect(milled.every((m) => m.payload.player === them)).toBe(true);
    });
    it(`seat ${me} aims its Crab at ITSELF (legal): only its own library is milled — the target, not the controller, is the milled player`, async () => {
      const players: [Record<string, unknown>, Record<string, unknown>] = [{}, {}];
      players[me] = { battlefield: ["hedron_crab"], hand: ["island"], library: Array(12).fill("island") };
      players[them] = { battlefield: [], hand: [], library: Array(12).fill("swamp") };
      const tg = new TestGame({
        name: `r8-crab-self-${me}`,
        setup: { active: me, step: "MAIN1", players: players as never },
        script: [{ player: me, do: "playLand", card: "island" }, { player: me, do: "chooseTriggerTargets", targets: [{ player: me }] }],
      });
      const before: [number, number] = [lib(tg, 0), lib(tg, 1)];
      await tg.game.runStep("MAIN1");
      expect(lib(tg, me)).toBe(before[me] - 3);
      expect(lib(tg, them)).toBe(before[them]);
    });
  }
});
