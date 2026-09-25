import { describe, expect, it } from "vitest";
import { TestGame, type FixtureSpec } from "./harness.js";
import { getObject } from "../src/index.js";

const onBf = (tg: TestGame, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);

/**
 * Post-S43 (Chris's report): the Usher's reanimated guest, stolen by Lumen until end of turn, is sacrificed at the
 * end step — and the Usher's "whenever a creature dies" must fire whoever controls the guest when it dies. It does;
 * and with an Usher on EACH side both drain, so the totals net to zero and it can read as "nothing fired".
 */
describe("the Usher's guest, stolen by Lumen, sacrificed at end step", () => {
  const setup = (p1Extra: string[]): TestGame => {
    const spec: FixtureSpec = {
      name: "usher-lumen",
      setup: { players: [
        { life: 20, battlefield: ["the_usher", "grizzly_bears"] },
        { life: 20, battlefield: ["lumen_the_hearth_fire", ...p1Extra], hand: ["forest"] },
      ] },
      script: [{ player: 1, do: "activate", card: "lumen_the_hearth_fire", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] }],
    };
    const tg = new TestGame(spec);
    const bears = onBf(tg, "grizzly_bears")[0]!;
    getObject(tg.game.state, bears).owner = 1; // the guest is P1's card (the Usher took it from P1's graveyard)
    tg.game.state.endStepSacrifices.push({ objectId: bears, dueTurn: tg.game.state.turn }); // the Usher's delayed toll
    return tg;
  };

  it("one Usher: the stolen guest still pays the toll at end step and the Usher's drain fires (the thief loses 2, the Usher's controller gains 2)", async () => {
    const tg = setup([]);
    await tg.game.priorityRound();
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(getObject(tg.game.state, bears).controller).toBe(1); // stolen
    await tg.game.runStep("END");
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears");
    expect(tg.game.state.players[1].life).toBe(18);
    expect(tg.game.state.players[0].life).toBe(22);
  });

  it("an Usher on each side (the thief's under a Pacifism): BOTH drain — the totals net to 20 / 20, which looks like no trigger at all", async () => {
    const tg = setup(["the_usher", "pacifism"]);
    await tg.game.priorityRound();
    await tg.game.runStep("END");
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    expect(tg.game.state.players[0].life).toBe(20);
    expect(tg.game.state.players[1].life).toBe(20);
    const drains = tg.game.state.stack.length; // nothing left on the stack: both resolved
    expect(drains).toBe(0);
  });
});
