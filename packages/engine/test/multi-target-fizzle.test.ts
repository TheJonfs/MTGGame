import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const LIB = Array.from({ length: 12 }, () => "island");

/**
 * Post-S52 (found by the tinker study — the Warden in a Larder variant against the Undertow, seed 1467367): a stack
 * item whose ONE target spec holds several targets ("up to two target creatures") crashed at resolution when its
 * FIRST target had become illegal — the fizzle check read `targetSpecs[i]` by the target's flat index, and the second
 * target has no spec of its own. CR 608.2b: an item is not countered while any of its targets is still legal; the
 * illegal one is simply not affected. The spec of a flat target index is `specOfFlatIndex`.
 */
describe("a multi-target spec whose first target leaves (CR 608.2b)", () => {
  it("The Warden's 'tap up to two target creatures': the first target bounced in response — the trigger still resolves and taps the second", async () => {
    const tg = new TestGame({
      name: "warden-first-target-gone",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["the_warden"], library: LIB },
        { battlefield: ["grizzly_bears", "hill_giant", "island", "island"], hand: ["boomerang"], library: LIB },
      ] },
      script: [
        { player: 0, do: "attack", attackers: ["the_warden"] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }, { object: "hill_giant" }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "grizzly_bears" }] },
      ],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(tg.game.state.players[1].hand.map((id) => getObject(tg.game.state, id).cardId)).toContain("grizzly_bears");
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).tapped).toBe(true);
  });

  it("both targets gone: the trigger fizzles quietly", async () => {
    const tg = new TestGame({
      name: "warden-both-gone",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["the_warden"], library: LIB },
        { battlefield: ["grizzly_bears", "hill_giant", "island", "island", "island", "island"], hand: ["boomerang", "boomerang"], library: LIB },
      ] },
      script: [
        { player: 0, do: "attack", attackers: ["the_warden"] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }, { object: "hill_giant" }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "grizzly_bears" }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "hill_giant" }] },
      ],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(tg.game.state.players[1].hand.map((id) => getObject(tg.game.state, id).cardId).sort()).toEqual(["grizzly_bears", "hill_giant"]);
  });
});
