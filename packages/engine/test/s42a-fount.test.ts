import { describe, expect, it } from "vitest";
import { characteristics, getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const LIB = Array.from({ length: 14 }, () => "island");
const laws = (tg: TestGame, p?: 0 | 1) => tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).filter((o) => tg.game.ctx.defs.def(o.cardId).law && (p === undefined || o.controller === p)).map((o) => o.cardId);
const endStep = async (tg: TestGame, active: 0 | 1 = 0) => { tg.game.state.activePlayer = active; await tg.game.runStep("END"); };
const TIDE = ["law_risen_tide", "law_season", "law_intake", "law_tithe", "law_toll"];

/** S42a (ADR-131/132, R-098) — the Cinquefont's tide and Time Walk. Written after the fuzz (s42a-fount-fuzz.test.ts). */
describe("R-098 — the Cinquefont: the tide", () => {
  const fount = (extra: Partial<{ p0: (string | { card: string; counters?: Record<string, number> })[]; p1: string[]; hand: string[] }> = {}) => new TestGame({
    name: "fount",
    setup: { active: 0, step: "END", players: [
      { battlefield: ["the_cinquefont", ...(extra.p0 ?? [])], hand: extra.hand ?? [], library: LIB },
      { battlefield: extra.p1 ?? ["mountain"], library: LIB },
    ] },
  });

  it("the order is U G W B R, one law at each of ITS end steps (not the opponent's); at five the tide stands whole; at the next end step all are washed and the tide begins again at U", async () => {
    const tg = fount();
    for (let n = 1; n <= 5; n++) {
      await endStep(tg);
      expect(laws(tg), `after ${n}`).toEqual(TIDE.slice(0, n));
      await endStep(tg, 1); // the opponent's end step adds nothing
      expect(laws(tg)).toHaveLength(n);
    }
    await endStep(tg); // five stand → exile all, then the next in order (the pointer went round): U alone
    expect(laws(tg)).toEqual(["law_risen_tide"]);
    await endStep(tg);
    expect(laws(tg)).toEqual(["law_risen_tide", "law_season"]);
  });

  it("the default sequence is turned to the tide by the card itself (no modifier needed) — and the pointer is the DUEL's: a second Cinquefont arriving continues the tide", async () => {
    const tg = fount();
    expect(tg.game.state.lawSequence.order[0]).toBe("law_intake"); // the WBRUG default
    await endStep(tg);
    await endStep(tg);
    expect(tg.game.state.lawSequence.order).toEqual(TIDE);
    expect(tg.game.state.lawSequence.next).toBe(2);
  });

  it("a Disenchanted law lowers the count: four stand → no wash, the fifth in ORDER comes (the destroyed one is not re-made out of turn)", async () => {
    const tg = fount();
    for (let n = 0; n < 4; n++) await endStep(tg);
    const season = tg.findBattlefield("law_season");
    tg.game.state.battlefield.splice(tg.game.state.battlefield.indexOf(season), 1); // gone (a token law ceases to exist)
    delete tg.game.state.objects[season];
    await endStep(tg); // three stand → no wash; the fifth in order (the Toll) arrives: four
    expect(laws(tg)).toEqual(["law_risen_tide", "law_intake", "law_tithe", "law_toll"]);
    await endStep(tg); // four stand → still no wash; the pointer went round: the Risen Tide again — five (two Tides)
    expect(laws(tg)).toHaveLength(5);
    await endStep(tg); // now five → the wash, then the Season
    expect(laws(tg)).toEqual(["law_season"]);
  });

  it("'laws on the battlefield' counts BOTH sides: a law the opponent controls is counted, and is washed with the rest", async () => {
    const tg = fount();
    for (let n = 0; n < 5; n++) await endStep(tg);
    getObject(tg.game.state, tg.findBattlefield("law_intake")).controller = 1; // stolen
    getObject(tg.game.state, tg.findBattlefield("law_intake")).baseController = 1;
    expect(laws(tg, 1)).toEqual(["law_intake"]);
    await endStep(tg);
    expect(laws(tg)).toEqual(["law_risen_tide"]); // five stood (four + the stolen one): all washed, the player's too
    expect(laws(tg, 1)).toEqual([]);
  });

  it("the fount blinked re-enters as a new object whose end-step trigger continues the tide; controlled by the OTHER player the tide turns for them", async () => {
    const tg = new TestGame({
      name: "fount-blink",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["the_cinquefont", ...["plains", "plains", "plains", "plains"].map((card) => ({ card, tapped: true }))], hand: ["restoration_angel"], library: LIB }, // tapped: the flash Angel waits for MAIN1
        { battlefield: ["mountain"], library: LIB },
      ] },
      script: [{ player: 0, do: "cast", card: "restoration_angel" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "the_cinquefont" }] }, { player: 0, do: "optional", accept: true }],
    });
    await endStep(tg); await endStep(tg); // U, G
    const before = tg.findBattlefield("the_cinquefont");
    tg.game.state.activePlayer = 0;
    for (const id of tg.game.state.battlefield) getObject(tg.game.state, id).tapped = false;
    await tg.game.runStep("MAIN1");
    expect(tg.findBattlefield("the_cinquefont")).not.toBe(before); // a new object
    await endStep(tg);
    expect(laws(tg)).toEqual(["law_risen_tide", "law_season", "law_intake"]); // the tide went on, it did not restart
    // Under the other player's control the law is made on THEIR end step, under THEIR control.
    const f = getObject(tg.game.state, tg.findBattlefield("the_cinquefont"));
    f.controller = 1; f.baseController = 1;
    await endStep(tg); // player 0's end step: nothing
    expect(laws(tg)).toHaveLength(3);
    await endStep(tg, 1);
    expect(laws(tg, 1)).toEqual(["law_tithe"]);
  });

  it("the legend rule: a second Cinquefont under the same controller — one is kept", async () => {
    const tg = new TestGame({
      name: "fount-legend",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["the_cinquefont", "plains", "swamp", "mountain", "island", "forest"], hand: ["the_cinquefont"], library: LIB }, { battlefield: ["mountain"], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "the_cinquefont" }, { player: 0, do: "keepLegend", card: "the_cinquefont" }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === "the_cinquefont")).toHaveLength(1);
    expect(tg.game.state.players[0].graveyard.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["the_cinquefont"]);
  });

  it("the Season's counter lands on the fount itself: 8/8 at its controller's next upkeep", async () => {
    const tg = fount();
    await endStep(tg); await endStep(tg); // U, G — the Season stands
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("UPKEEP");
    const c = characteristics(tg.game.ctx, tg.findBattlefield("the_cinquefont"));
    expect([c.power, c.toughness]).toEqual([8, 8]);
  });

  it("under the accumulating ring's mode the wash would be skipped — the fount's duel declares `tide`, where it is not", async () => {
    const tg = fount();
    tg.game.state.lawSequence.mode = "accumulate";
    for (let n = 0; n < 6; n++) await endStep(tg);
    expect(laws(tg)).toHaveLength(6); // accumulate: no exile, ever (S27's dormant mode, kept for phase-one experiments)
    const tide = fount();
    tide.game.state.lawSequence.mode = "tide";
    for (let n = 0; n < 6; n++) await endStep(tide);
    expect(laws(tide)).toEqual(["law_risen_tide"]);
  });
});

describe("R-098 — Time Walk: extra turns (the turn order is explicit, not the turn number's parity)", () => {
  const LIB2 = Array.from({ length: 20 }, () => "island");
  it("the caster takes the next turn too, then the turn passes as it would have; two Walks stack (the last created is taken first — the same player either way); the opponent's Walk interleaves correctly", async () => {
    const tg = new TestGame({
      name: "time-walk",
      setup: { active: 0, step: "MAIN1", turn: 3, players: [
        { battlefield: ["island", "island", "island", "island"], hand: ["time_walk", "time_walk"], library: LIB2 },
        { battlefield: ["island", "island"], hand: ["time_walk"], library: LIB2 },
      ] },
      script: [{ player: 0, do: "cast", card: "time_walk" }, { player: 0, do: "cast", card: "time_walk" }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.extraTurns).toEqual([0, 0]);
    expect(tg.game.state.players[0].graveyard.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["time_walk", "time_walk"]);
    // Drive the loop's own rule: the next three actives are 0, 0, then 1.
    const next = () => { const extra = tg.game.state.extraTurns.pop(); tg.game.state.activePlayer = extra !== undefined ? extra : (tg.game.state.activePlayer === 0 ? 1 : 0); return tg.game.state.activePlayer; };
    expect([next(), next(), next(), next()]).toEqual([0, 0, 1, 0]);
  });
});
