import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";

/**
 * S38 Part 3 (design §7; the knob heartLawsPersist → the lawSequence modifier's `accumulate` mode, S27's
 * dormant hook): the ring ACCUMULATES — the second law lands beside the first; the Manafleur's own legend
 * rule is unaffected (one flower, many laws); a Disenchant on the oldest law leaves the newer; the standing
 * laws are targets for the Angel of the Ruins' ETB (two of three go).
 */
type TG = Awaited<ReturnType<typeof runFixture>>;
const lawsOn = (tg: TG, player?: 0 | 1) => tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).filter((o) => o.cardId.startsWith("law_") && (player === undefined || o.controller === player)).map((o) => o.cardId);
const bf = (tg: TG, p: 0 | 1) => tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).filter((o) => o.controller === p).map((o) => o.cardId);

describe("S38 — the accumulating Heart (heartLawsPersist)", () => {
  it("the second law lands beside the first, the third beside both; the fifth joins four; the ring's order and cadence are unchanged", async () => {
    const tg = new TestGame({ name: "persist-ring", setup: { players: [{ battlefield: ["the_manafleur"] }, {}] } });
    tg.game.state.lawSequence.mode = "accumulate";
    const expectAfter = async (laws: string[]) => { await tg.game.runStep("END"); expect(lawsOn(tg, 0)).toEqual(laws); };
    await expectAfter(["law_intake"]);
    await expectAfter(["law_intake", "law_tithe"]);
    await expectAfter(["law_intake", "law_tithe", "law_toll"]);
    await expectAfter(["law_intake", "law_tithe", "law_toll", "law_risen_tide"]);
    await expectAfter(["law_intake", "law_tithe", "law_toll", "law_risen_tide", "law_season"]);
    await expectAfter(["law_intake", "law_tithe", "law_toll", "law_risen_tide", "law_season", "law_intake"]); // the ring closes and keeps going
    expect(tg.game.state.players[0].exile.length + tg.game.state.players[1].exile.length).toBe(0);
  });
  it("the Manafleur's legend rule is unaffected: a second flower cast under the accumulating ring — one stays, every law stays", async () => {
    const tg = new TestGame({
      name: "persist-legend",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["the_manafleur", { card: "law_intake", token: true }, { card: "law_tithe", token: true }, "plains", "island", "swamp", "mountain", "forest"], hand: ["the_manafleur"] }, {}] },
      script: [{ player: 0, do: "cast", card: "the_manafleur" }, { player: 0, do: "keepLegend", card: "the_manafleur" }],
    });
    tg.game.state.lawSequence.mode = "accumulate";
    tg.game.state.lawSequence.next = 2;
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((id) => id === "the_manafleur")).toHaveLength(1);
    expect(lawsOn(tg, 0)).toEqual(["law_intake", "law_tithe"]);
    await tg.game.runStep("END");
    expect(lawsOn(tg, 0)).toEqual(["law_intake", "law_tithe", "law_toll"]);
  });
  it("a Disenchant on the oldest law leaves the newer standing; the next end step grows the next petal beside it", async () => {
    const spec: FixtureSpec = {
      name: "persist-disenchant",
      setup: { active: 1, players: [
        { battlefield: ["the_manafleur", { card: "law_intake", token: true }, { card: "law_tithe", token: true }] },
        { battlefield: ["plains", "plains"], hand: ["disenchant"] },
      ] },
      script: [{ player: 1, do: "cast", card: "disenchant", targets: [{ object: "law_intake" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    tg.game.state.lawSequence.mode = "accumulate";
    tg.game.state.lawSequence.next = 2;
    expect(lawsOn(tg, 0)).toEqual(["law_tithe"]);
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END");
    expect(lawsOn(tg, 0)).toEqual(["law_tithe", "law_toll"]);
  });
  it("the standing laws are targets: the Angel of the Ruins' ETB exiles two of three; the third stands and the ring grows on", async () => {
    const tg = new TestGame({
      name: "persist-angel",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["the_manafleur", { card: "law_intake", token: true }, { card: "law_tithe", token: true }, { card: "law_toll", token: true }] },
        { battlefield: ["plains", "plains", "plains", "plains", "plains", "plains", "plains"], hand: ["angel_of_the_ruins"] },
      ] },
      script: [
        { player: 1, do: "cast", card: "angel_of_the_ruins" },
        { player: 1, do: "chooseTriggerTargets", targets: [{ object: "law_intake" }, { object: "law_tithe" }] },
      ],
    });
    tg.game.state.lawSequence.mode = "accumulate";
    tg.game.state.lawSequence.next = 3;
    await tg.game.runStep("MAIN1");
    expect(lawsOn(tg, 0)).toEqual(["law_toll"]);
    expect(bf(tg, 1)).toContain("angel_of_the_ruins");
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END");
    expect(lawsOn(tg, 0)).toEqual(["law_toll", "law_risen_tide"]);
  });
});
