import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runFixture, TestGame, testPool, type FixtureSpec } from "./harness.js";
import {
  applyModifiers,
  blockerChoices,
  characteristics,
  createObject,
  eligibleBlockers,
  getObject,
  legalActions,
  moveObject,
  runSBAs,
} from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

/** Test-only −X/−X, as the S2 brief prescribes for the SBA death path. */
function shrink(tg: TestGame, objectId: string, n: number): void {
  tg.game.state.continuousEffects.push({
    kind: "modifyPT",
    objectId,
    power: -n,
    toughness: -n,
    duration: "UNTIL_END_OF_TURN",
    sourceStackItemId: "test",
    timestamp: tg.game.state.timestamp + 1000,
  });
}

describe("S2 fixtures — Pelakka Wurm dies-trigger quadruple (brief 1–4)", () => {
  it("1. dies by combat damage → controller draws", async () => {
    const tg = await runFixture(fixture("s2-01-wurm-dies-combat"));
    expect(tg.graveyardCardIds(1)).toContain("pelakka_wurm");
    expect(tg.handCardIds(1)).toContain("forest"); // drew off the trigger
    // Trample assigned lethal 4 to the first baloth (dies), 3 to the second (lives).
    expect(tg.graveyardCardIds(0)).toEqual(["rumbling_baloth"]);
    expect(tg.battlefieldCardIds()).toContain("rumbling_baloth");
  });

  it("2. dies by stacked burn → controller draws", async () => {
    const tg = await runFixture(fixture("s2-02-wurm-dies-burn"));
    expect(tg.graveyardCardIds(1)).toContain("pelakka_wurm");
    expect(tg.handCardIds(1)).toContain("forest");
  });

  it("3. dies by SBA toughness <= 0 → controller draws", async () => {
    const tg = new TestGame({
      name: "sba-death",
      setup: {
        players: [{}, { battlefield: ["pelakka_wurm"], library: ["forest"] }],
      },
    });
    shrink(tg, tg.findBattlefield("pelakka_wurm"), 7);
    runSBAs(tg.game.ctx);
    expect(tg.graveyardCardIds(1)).toContain("pelakka_wurm");
    await tg.game.priorityRound(); // places and resolves the pending DIES trigger
    expect(tg.handCardIds(1)).toContain("forest");
  });

  it("4. dies by mass destroy → controller draws", async () => {
    const tg = await runFixture(fixture("s2-04-wurm-dies-wrath"));
    expect(tg.graveyardCardIds(1)).toContain("pelakka_wurm");
    expect(tg.graveyardCardIds(0)).toContain("savannah_lions");
    expect(tg.handCardIds(1)).toContain("forest");
  });
});

describe("S2 fixtures — trample (brief 5, 10)", () => {
  it("ETB gains 7 life", async () => {
    const tg = new TestGame({
      name: "wurm-etb",
      setup: { players: [{ hand: ["pelakka_wurm"] }, {}] },
    });
    moveObject(tg.game.ctx, tg.game.state.players[0].hand[0]!, "battlefield");
    await tg.game.priorityRound();
    expect(tg.game.state.players[0].life).toBe(27);
  });

  it("5a. chump block: lethal 2 to the 2/2, 5 to the player", async () => {
    const tg = await runFixture(fixture("s2-05a-trample-chump"));
    expect(tg.graveyardCardIds(0)).toContain("grizzly_bears");
    expect(tg.game.state.players[0].life).toBe(15);
  });

  it("5b. Giant Growth on the blocker: lethal recomputes to 5, player takes 2", async () => {
    const tg = await runFixture(fixture("s2-05b-trample-pumped-blocker"));
    expect(tg.graveyardCardIds(0)).toContain("grizzly_bears"); // took exactly lethal 5
    expect(tg.game.state.players[0].life).toBe(18);
  });

  it("5c. blocker bounced pre-damage: all 7 tramples through", async () => {
    const tg = await runFixture(fixture("s2-05c-trample-blocker-bounced"));
    expect(tg.handCardIds(0)).toContain("grizzly_bears");
    expect(tg.game.state.players[0].life).toBe(13);
  });

  it("10a/10b. blocker damage order is the attacker's choice and changes who dies", async () => {
    const a = await runFixture(fixture("s2-10a-block-order-courser-first"));
    expect(a.graveyardCardIds(1)).toContain("centaur_courser");
    expect(a.battlefieldCardIds()).toContain("grizzly_bears");
    expect(a.graveyardCardIds(0)).toContain("rumbling_baloth"); // took 5

    const b = await runFixture(fixture("s2-10b-block-order-bears-first"));
    expect(b.graveyardCardIds(1)).toContain("grizzly_bears");
    expect(b.battlefieldCardIds()).toContain("centaur_courser");
  });

  it("10c. trample multi-block: lethal to each blocker, excess 2 to the player", async () => {
    const tg = await runFixture(fixture("s2-10c-trample-multiblock"));
    expect(tg.graveyardCardIds(0)).toEqual(expect.arrayContaining(["grizzly_bears", "centaur_courser"]));
    expect(tg.game.state.players[0].life).toBe(18);
  });
});

describe("S2 fixtures — tokens and anthem (brief 6, 7)", () => {
  it("6. Raise the Alarm mid-combat: tokens exist, blocked nothing, block next turn; bounced token ceases", async () => {
    const tg = await runFixture(fixture("s2-06-raise-the-alarm-midcombat"));
    const state = tg.game.state;
    const soldiers = state.battlefield.filter((id) => getObject(state, id).cardId === "soldier_1_1");
    expect(soldiers).toHaveLength(2);
    expect(getObject(state, soldiers[0]!).isToken).toBe(true);
    expect(state.players[1].life).toBe(18); // the attack got through
    // They can block next turn (blocking never cared about summoning sickness).
    state.activePlayer = 0;
    expect(eligibleBlockers(tg.game.ctx)).toEqual(expect.arrayContaining(soldiers));
    // A bounced token ceases to exist (CR 111.7).
    const gone = moveObject(tg.game.ctx, soldiers[0]!, "hand");
    expect(gone).toBeNull();
    expect(tg.handCardIds(1)).not.toContain("soldier_1_1");
    expect(state.battlefield.filter((id) => getObject(state, id).cardId === "soldier_1_1")).toHaveLength(1);
  });

  it("7. Anthem: +1/+1 to own creatures incl. tokens; removal via SBA when it leaves", async () => {
    const tg = new TestGame({
      name: "anthem",
      setup: {
        players: [
          { battlefield: ["glorious_anthem", "centaur_courser", "mountain"], hand: [] },
          { battlefield: ["mountain"], hand: ["lightning_bolt"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    const courser = tg.findBattlefield("centaur_courser");
    expect(characteristics(ctx, courser)).toMatchObject({ power: 4, toughness: 4 });
    // Bolt it: 3 damage < 4 toughness under Anthem — survives.
    // (The brief says "a 2/1 under Anthem"; Bolt kills a 3/2, so the 3/3
    // courser is the smallest body that shows the survive-then-die arc.)
    getObject(ctx.state, courser).damage = 3;
    runSBAs(ctx);
    expect(ctx.state.battlefield).toContain(courser);
    // Anthem leaves: the 3/3 with 3 damage dies at the next SBA check.
    moveObject(ctx, tg.findBattlefield("glorious_anthem"), "graveyard");
    runSBAs(ctx);
    expect(tg.graveyardCardIds(0)).toContain("centaur_courser");
  });
});

describe("S2 fixtures — counters (brief 8)", () => {
  it("8. Guide targets itself when alone; counters stack with and survive Anthem; annihilation", async () => {
    const tg = await runFixture(fixture("s2-08-timberland-guide-self"));
    const ctx = tg.game.ctx;
    const guide = tg.findBattlefield("timberland_guide");
    expect(getObject(ctx.state, guide).counters["+1/+1"]).toBe(1);
    expect(characteristics(ctx, guide)).toMatchObject({ power: 2, toughness: 2 });

    // Anthem in and out: the counter is independent of the static.
    const anthemId = createObject(ctx, "glorious_anthem", 0, "battlefield");
    expect(characteristics(ctx, guide)).toMatchObject({ power: 3, toughness: 3 });
    moveObject(ctx, anthemId, "graveyard");
    expect(characteristics(ctx, guide)).toMatchObject({ power: 2, toughness: 2 });

    // A -1/-1 counter annihilates with the +1/+1 at the next SBA check (704.5q).
    getObject(ctx.state, guide).counters["-1/-1"] = 1;
    runSBAs(ctx);
    expect(getObject(ctx.state, guide).counters["+1/+1"]).toBe(0);
    expect(getObject(ctx.state, guide).counters["-1/-1"]).toBe(0);
    expect(characteristics(ctx, guide)).toMatchObject({ power: 1, toughness: 1 });
  });
});

describe("S2 fixtures — trigger ordering (brief 9)", () => {
  async function twoEtbs(pickFirst: "elvish_visionary" | "timberland_guide") {
    const tg = new TestGame({
      name: "two-etbs",
      setup: {
        players: [
          { hand: ["elvish_visionary", "timberland_guide"], library: ["forest", "forest"] },
          {},
        ],
      },
      script: [
        { player: 0, do: "orderTrigger", card: pickFirst },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "elvish_visionary" }] },
      ],
    });
    const state = tg.game.state;
    // Test-only simultaneity: both enter before anyone gets priority.
    moveObject(tg.game.ctx, state.players[0].hand[0]!, "battlefield");
    moveObject(tg.game.ctx, state.players[0].hand[0]!, "battlefield");
    expect(state.pendingTriggers).toHaveLength(2);
    await tg.game.priorityRound();
    return tg;
  }

  it("9. same-controller ordering is requested; either order resolves both effects", async () => {
    for (const first of ["elvish_visionary", "timberland_guide"] as const) {
      const tg = await twoEtbs(first);
      expect(tg.consumed.map((e) => e.do)).toEqual(["orderTrigger", "chooseTriggerTargets"]);
      expect(tg.handCardIds(0)).toContain("forest"); // Visionary drew
      const visionary = tg.findBattlefield("elvish_visionary");
      expect(getObject(tg.game.state, visionary).counters["+1/+1"]).toBe(1); // Guide's counter landed
    }
  });
});

describe("S2 fixtures — X, controller capture, wide boards, modifiers (brief 11–14)", () => {
  it("11. Blaze enumerates one action per affordable X and per target", async () => {
    const tg = new TestGame({
      name: "blaze-enum",
      setup: {
        players: [{ battlefield: ["mountain", "mountain", "mountain", "mountain"], hand: ["blaze"] }, {}],
      },
    });
    const blazeCasts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "castSpell");
    // 4 mountains: {X}{R} affordable for X = 0..3; targets = both players.
    expect(blazeCasts.map((a) => (a.type === "castSpell" ? a.x : -1)).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("11b. Blaze X=3 to the face and X=2 kills a bear", async () => {
    const face = await runFixture(fixture("s2-11-blaze-x3-face"));
    expect(face.game.state.players[1].life).toBe(17);
    const bear = await runFixture(fixture("s2-11b-blaze-x2-creature"));
    expect(bear.graveyardCardIds(1)).toContain("grizzly_bears");
  });

  it("12. stolen creature dies → DIES trigger belongs to the controller, not the owner", async () => {
    const tg = new TestGame({
      name: "stolen-dies",
      setup: {
        players: [
          { battlefield: ["pelakka_wurm"], library: ["mountain", "mountain"] },
          { library: ["forest", "forest"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    const wurm = tg.findBattlefield("pelakka_wurm");
    // Test-only steal: since S5, baseController is what control statics
    // override — flipping it is the honest way to fake a steal (ADR-033).
    getObject(ctx.state, wurm).controller = 1;
    getObject(ctx.state, wurm).baseController = 1;
    shrink(tg, wurm, 7);
    runSBAs(ctx);
    await tg.game.priorityRound();
    expect(tg.handCardIds(1)).toContain("forest"); // controller drew
    expect(tg.handCardIds(0)).toHaveLength(0); // owner did not
  });

  it("13. six attackers, six blockers: every legal single block enumerable, all declarable", async () => {
    const goblins = Array(6).fill("goblin_piker");
    const bears = Array(6).fill("grizzly_bears");
    const tg = new TestGame({
      name: "wide-board",
      setup: {
        turn: 4,
        active: 0,
        step: "DECLARE_ATTACKERS",
        players: [{ battlefield: goblins }, { battlefield: bears }],
      },
      script: [
        { player: 0, do: "attack", attackers: goblins },
        {
          player: 1,
          do: "block",
          blocks: goblins.map(() => ({ blocker: "grizzly_bears", attacker: "goblin_piker" })),
        },
      ],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    // After declaration: 6 blockers x 6 attackers + done = 37 choices, linear not exponential.
    expect(blockerChoices(tg.game.ctx)).toHaveLength(37);
    await tg.game.runStep("DECLARE_BLOCKERS");
    expect(tg.game.state.combat.blocks).toHaveLength(6);
    expect(tg.consumed).toHaveLength(2);
  });

  it("14. modifiers: effectAtStart resolves; permanentOnBattlefield does not fire ETB", async () => {
    const tg = new TestGame({
      name: "modifiers",
      setup: { players: [{ library: ["mountain", "mountain", "mountain"] }, {}] },
    });
    const ctx = tg.game.ctx;
    applyModifiers(ctx, [
      { type: "startingLife", player: 1, value: 25 },
      { type: "effectAtStart", player: 0, effects: [{ type: "createToken", tokenId: "soldier_1_1", count: 2, who: "you" }] },
      { type: "effectAtStart", player: 0, effects: [{ type: "draw", count: 1, who: "you" }] },
      { type: "permanentOnBattlefield", player: 1, cardId: "pelakka_wurm" },
    ]);
    expect(ctx.state.players[1].life).toBe(25);
    expect(tg.battlefieldCardIds().filter((c) => c === "soldier_1_1")).toHaveLength(2);
    expect(tg.handCardIds(0)).toHaveLength(1);
    expect(tg.battlefieldCardIds()).toContain("pelakka_wurm");
    // Planner ruling: initialization triggers are discarded — no +7 life.
    expect(ctx.state.players[1].life).toBe(25);
    expect(ctx.state.pendingTriggers).toHaveLength(0);
  });
});
