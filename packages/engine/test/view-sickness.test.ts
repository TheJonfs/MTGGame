import { describe, expect, it } from "vitest";
import { buildView } from "../src/index.js";
import { TestGame } from "./harness.js";

const LIB = Array.from({ length: 10 }, () => "mountain");

/**
 * S45 follow-up (Chris): the AI's view carries `summoningSick` — the engine's own rule (a creature that entered this
 * turn, without haste: no attack, no {T} cost; it may still block). Public information, on both seats' views.
 */
describe("the view's summoning sickness", () => {
  it("a sick creature is flagged on both views; a haste creature, a creature from an earlier turn and a land are not; the flag clears at its controller's untap", async () => {
    const tg = new TestGame({
      name: "view-sick",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: [{ card: "grizzly_bears", summoningSick: true }, { card: "raging_goblin", summoningSick: true }, "hill_giant", "mountain"], library: LIB },
        { battlefield: [{ card: "savannah_lions", summoningSick: true }], library: LIB },
      ] },
    });
    const sick = (p: 0 | 1) => buildView(tg.game.ctx, p).battlefield.filter((o) => o.summoningSick).map((o) => o.cardId).sort();
    expect(sick(0)).toEqual(["grizzly_bears", "savannah_lions"]); // the Goblin has haste; the Giant and the land are ready
    expect(sick(1)).toEqual(["grizzly_bears", "savannah_lions"]); // public: the same on the opponent's view
    await tg.game.runStep("UNTAP"); // player 0's untap: their creatures are no longer sick; player 1's Lions still are
    expect(sick(0)).toEqual(["savannah_lions"]);
  });
});
