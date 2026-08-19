import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";
import {
  characteristics,
  createObject,
  eligibleAttackers,
  getObject,
  legalActions,
  moveObject,
  runSBAs,
  sacrificeCandidates,
} from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

describe("S5 — Control Magic (brief 1–4)", () => {
  it("1. steal: control, sickness, anthem attribution; Boomerang reverts with sickness again", async () => {
    const tg = await runFixture(fixture("s5-01-control-magic"));
    const ctx = tg.game.ctx;
    const bears = tg.findBattlefield("grizzly_bears");

    expect(getObject(ctx.state, bears).controller).toBe(0);
    expect(getObject(ctx.state, bears).summoningSick).toBe(true); // 302.6
    ctx.state.step = "DECLARE_ATTACKERS";
    expect(eligibleAttackers(ctx)).not.toContain(bears);
    // Only the thief's Anthem applies now: 2/2 + 1/+1 = 3/3, not 4/4.
    expect(characteristics(ctx, bears)).toMatchObject({ power: 3, toughness: 3 });

    // Next turn it could attack (sickness clears at the thief's untap)...
    getObject(ctx.state, bears).summoningSick = false;
    expect(eligibleAttackers(ctx)).toContain(bears);

    // ...but bounce the aura and control reverts, sick for the owner again.
    moveObject(ctx, tg.findBattlefield("control_magic"), "hand");
    await runSBAs(ctx);
    expect(getObject(ctx.state, bears).controller).toBe(1);
    expect(getObject(ctx.state, bears).summoningSick).toBe(true);
    expect(characteristics(ctx, bears)).toMatchObject({ power: 3, toughness: 3 }); // now the owner's Anthem
  });

  it("2. stolen Pelakka dies to the thief's Wrath: owner's graveyard, thief draws", async () => {
    const tg = await runFixture(fixture("s5-02-stolen-wurm-wrath"));
    expect(tg.graveyardCardIds(0)).toContain("pelakka_wurm"); // 400.3: routed by owner
    expect(tg.handCardIds(1)).toContain("swamp"); // DIES trigger belonged to the controller (thief)
    expect(tg.handCardIds(0)).toHaveLength(0);
  });

  it("3. stolen token can be sacrificed by its new controller and ceases; stolen non-token bounces to owner", async () => {
    const tg = new TestGame({
      name: "stolen-sac",
      setup: {
        players: [
          { battlefield: ["goblin_piker", { card: "goblin_1_1", token: true }] },
          { battlefield: ["siege_gang_commander", "swamp", "swamp"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    const token = tg.findBattlefield("goblin_1_1");
    const piker = tg.findBattlefield("goblin_piker");
    // Test-only steal of both (the real steal path is fixture 1).
    for (const id of [token, piker]) {
      getObject(ctx.state, id).controller = 1;
      getObject(ctx.state, id).baseController = 1;
    }
    const sgc = tg.findBattlefield("siege_gang_commander");
    expect(sacrificeCandidates(ctx, 1, sgc, "creature.subtype:Goblin")).toEqual(
      expect.arrayContaining([token, piker, sgc]),
    );
    const gone = moveObject(ctx, token, "graveyard"); // sacrifice path
    expect(gone).toBeNull(); // token ceased (CR 111.7)
    const bounced = moveObject(ctx, piker, "hand")!;
    expect(getObject(ctx.state, bounced).owner).toBe(0);
    expect(tg.handCardIds(0)).toContain("goblin_piker"); // 400.3: owner's hand
  });

  it("4. stolen creature keeps the opponent's Bonesplitter buff and Pacifism; neither player can (re)equip", async () => {
    const tg = new TestGame({
      name: "stolen-attachments",
      setup: {
        players: [
          {
            battlefield: [
              "savannah_lions",
              { card: "bonesplitter", attachedTo: "savannah_lions" },
              { card: "pacifism", attachedTo: "savannah_lions" },
              "plains",
            ],
          },
          { battlefield: ["swamp", "swamp"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    const lions = tg.findBattlefield("savannah_lions");
    getObject(ctx.state, lions).controller = 1;
    getObject(ctx.state, lions).baseController = 1;
    await runSBAs(ctx);

    // Equipment controlled by the former controller stays and buffs (301.5c).
    expect(characteristics(ctx, lions)).toMatchObject({ power: 4, toughness: 1 });
    expect(characteristics(ctx, lions).cantAttack).toBe(true); // Pacifism still restricts

    // P0 can't re-equip (not their creature); P1 can't equip (not their equipment).
    ctx.state.activePlayer = 0;
    const p0Equips = legalActions(ctx, 0).filter((a) => a.type === "activateAbility");
    expect(p0Equips).toHaveLength(0); // only target was the (now stolen) lions
    const p1Equips = legalActions(ctx, 1).filter((a) => a.type === "activateAbility");
    expect(p1Equips).toHaveLength(0);
  });
});

describe("S5 — legend rule (brief 5)", () => {
  it("5. resolving a second Drana forces the keep-choice; the other dies", async () => {
    const tg = await runFixture(fixture("s5-05-legend-rule-cast-second"));
    expect(tg.battlefieldCardIds().filter((c) => c === "drana_kalastria_bloodchief")).toHaveLength(1);
    expect(tg.graveyardCardIds(0)).toContain("drana_kalastria_bloodchief");
    expect(tg.requests.some((r) => r.purpose === "legendRule")).toBe(true);
  });

  it("5b. stealing the opponent's Drana while controlling one triggers the rule; one each does not", async () => {
    const tg = new TestGame({
      name: "legend-steal",
      setup: {
        players: [
          { battlefield: ["drana_kalastria_bloodchief"], library: ["swamp"] },
          { battlefield: ["drana_kalastria_bloodchief"], library: ["swamp"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    // One each: no rule.
    await runSBAs(ctx, () => {
      throw new Error("legend rule should not fire with one each");
    });
    expect(ctx.state.battlefield).toHaveLength(2);

    // Steal the opponent's: now two under one controller.
    const theirs = ctx.state.battlefield.find((id) => getObject(ctx.state, id).controller === 1)!;
    getObject(ctx.state, theirs).controller = 0;
    getObject(ctx.state, theirs).baseController = 0;
    await tg.game.priorityRound(); // SBA fires the request through the normal path
    expect(tg.requests.some((r) => r.purpose === "legendRule")).toBe(true);
    expect(ctx.state.battlefield.filter((id) => getObject(ctx.state, id).cardId === "drana_kalastria_bloodchief")).toHaveLength(1);
  });
});

describe("S5 — Drana (brief 6)", () => {
  it("6. X=3 kills a 2/3 via toughness 0 (704.5f); Drana 7/4; pump gone at cleanup", async () => {
    const tg = await runFixture(fixture("s5-06-drana-pump"));
    const ctx = tg.game.ctx;
    expect(tg.graveyardCardIds(1)).toContain("vampire_nighthawk");
    const drana = tg.findBattlefield("drana_kalastria_bloodchief");
    expect(characteristics(ctx, drana)).toMatchObject({ power: 7, toughness: 4 });
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    expect(characteristics(ctx, drana)).toMatchObject({ power: 4, toughness: 4 });
  });

  it("6b. X=3 on herself: 7/1", async () => {
    const tg = await runFixture(fixture("s5-06b-drana-self"));
    const drana = tg.findBattlefield("drana_kalastria_bloodchief");
    expect(characteristics(tg.game.ctx, drana)).toMatchObject({ power: 7, toughness: 1 });
  });

  it("6c. target bounced in response: the whole ability fizzles, no bonus (608.2b)", async () => {
    const tg = await runFixture(fixture("s5-06c-drana-fizzle"));
    const drana = tg.findBattlefield("drana_kalastria_bloodchief");
    expect(characteristics(tg.game.ctx, drana)).toMatchObject({ power: 4, toughness: 4 });
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "FIZZLE")).toBe(true);
  });
});

describe("S5 — reanimation and regrowth (brief 7–8)", () => {
  it("7. Zombify: new object under your control, ETB fires, a later death still draws", async () => {
    const tg = await runFixture(fixture("s5-07-zombify-pelakka"));
    const ctx = tg.game.ctx;
    expect(tg.battlefieldCardIds()).toContain("pelakka_wurm");
    expect(ctx.state.players[0].life).toBe(27); // ETB fired on reentry
    const wurm = tg.findBattlefield("pelakka_wurm");
    expect(getObject(ctx.state, wurm).controller).toBe(0);
    expect(getObject(ctx.state, wurm).summoningSick).toBe(true);
    // It is a genuinely new object: kill it and the DIES trigger still works.
    getObject(ctx.state, wurm).damage = 7;
    await runSBAs(ctx);
    await tg.game.priorityRound();
    expect(tg.handCardIds(0)).toContain("swamp"); // dies-draw
  });

  it("7b. Zombified Nekrataal fires its ETB destroy", async () => {
    const tg = await runFixture(fixture("s5-07b-zombify-nekrataal"));
    expect(tg.battlefieldCardIds()).toContain("nekrataal");
    expect(tg.graveyardCardIds(1)).toContain("centaur_courser");
  });

  it("7c. graveyard target removed before resolution: Zombify fizzles (608.2b)", async () => {
    // Nothing in the pool touches graveyards at instant speed, so the race is
    // staged directly: Zombify on the stack, then its target leaves (brief's
    // "test-only exile-from-graveyard").
    const tg = new TestGame({
      name: "zombify-fizzle",
      setup: { players: [{ hand: ["zombify"], graveyard: ["pelakka_wurm"] }, {}] },
    });
    const ctx = tg.game.ctx;
    const gyCard = ctx.state.players[0].graveyard[0]!;
    const onStack = moveObject(ctx, ctx.state.players[0].hand[0]!, "stack")!;
    const def = ctx.defs.def("zombify");
    ctx.state.stack.push({
      id: "stk_test",
      kind: "spell",
      objectId: onStack,
      sourceCardId: "zombify",
      controller: 0,
      targetSpecs: def.targets ?? [],
      targets: [{ kind: "object", id: gyCard }],
      effects: def.spellEffect ?? [],
      x: 0,
    });
    moveObject(ctx, gyCard, "hand"); // the race
    await tg.game.priorityRound(); // both pass; the spell resolves and fizzles
    expect(tg.battlefieldCardIds()).not.toContain("pelakka_wurm");
    expect(tg.graveyardCardIds(0)).toContain("zombify");
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "FIZZLE")).toBe(true);
  });

  it("8. Gravedigger: accept returns to hand; decline leaves it; empty graveyard never places the trigger", async () => {
    const accept = await runFixture(fixture("s5-08-gravedigger-accept"));
    expect(accept.handCardIds(0)).toContain("typhoid_rats");
    expect(accept.graveyardCardIds(0)).toHaveLength(0);

    const decline = await runFixture(fixture("s5-08b-gravedigger-decline"));
    expect(decline.handCardIds(0)).toHaveLength(0);
    expect(decline.graveyardCardIds(0)).toContain("typhoid_rats");

    const empty = await runFixture(fixture("s5-08c-gravedigger-empty"));
    expect(empty.battlefieldCardIds()).toContain("gravedigger");
    expect(empty.log.entries.some((e) => e.t === "EVENT" && e.name === "TRIGGER_NO_TARGETS")).toBe(true);
    expect(empty.requests.some((r) => r.purpose === "optionalTrigger")).toBe(false);
  });
});

describe("S5 — Rancor (brief 9)", () => {
  it("9. host dies in combat: Rancor returns to its owner's hand from the graveyard", async () => {
    const tg = await runFixture(fixture("s5-09-rancor-host-dies"));
    // 4/1 trampler vs 3/3: bears dies to the 3 back; Rancor cycles through the yard.
    expect(tg.graveyardCardIds(0)).toContain("grizzly_bears");
    expect(tg.handCardIds(0)).toContain("rancor");
    expect(tg.graveyardCardIds(0)).not.toContain("rancor");
    // And it tramped 1 through before dying (3 lethal to the 3/3, 1 over).
    expect(tg.game.state.players[1].life).toBe(19);
  });

  it("9b. countered Rancor stays in the graveyard (was never on the battlefield)", async () => {
    const tg = await runFixture(fixture("s5-09b-rancor-countered"));
    expect(tg.graveyardCardIds(0)).toContain("rancor");
    expect(tg.handCardIds(0)).toHaveLength(0);
  });

  it("9c. fizzled Rancor stays in the graveyard", async () => {
    const tg = await runFixture(fixture("s5-09c-rancor-fizzle"));
    expect(tg.graveyardCardIds(0)).toContain("rancor");
    expect(tg.handCardIds(0)).not.toContain("rancor");
    expect(tg.handCardIds(0)).toContain("grizzly_bears"); // bounced to its owner's hand (400.3)
  });
});

describe("S5 — Mystic Snake (brief 10–11)", () => {
  it("10. flashes in against a Bolt and counters it", async () => {
    const tg = await runFixture(fixture("s5-10-snake-counters-bolt"));
    expect(tg.battlefieldCardIds()).toContain("mystic_snake");
    expect(tg.graveyardCardIds(1)).toContain("lightning_bolt");
    expect(tg.game.state.players[0].life).toBe(20); // no damage
  });

  it("10b. empty stack: the trigger has no legal target and is never placed (603.3d)", async () => {
    const tg = await runFixture(fixture("s5-10b-snake-empty-stack"));
    expect(tg.battlefieldCardIds()).toContain("mystic_snake");
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "TRIGGER_NO_TARGETS")).toBe(true);
  });

  it("10c. against a Blurred Mongoose spell: counter resolves and does nothing (R-032)", async () => {
    const tg = await runFixture(fixture("s5-10c-snake-vs-mongoose"));
    expect(tg.battlefieldCardIds()).toContain("mystic_snake");
    expect(tg.battlefieldCardIds()).toContain("blurred_mongoose");
  });

  it("10d. counters the Counterspell aimed at Serra Angel — the Angel resolves", async () => {
    const tg = await runFixture(fixture("s5-10d-snake-saves-serra"));
    expect(tg.battlefieldCardIds()).toContain("serra_angel");
    expect(tg.graveyardCardIds(1)).toContain("counterspell");
  });

  it("11. Counterspell the Snake itself: countered, no ETB", async () => {
    const tg = await runFixture(fixture("s5-11-snake-countered"));
    expect(tg.graveyardCardIds(0)).toContain("mystic_snake");
    expect(tg.battlefieldCardIds()).not.toContain("mystic_snake");
    // Its ETB never happened: the Bolt beneath it resolved unimpeded.
    expect(tg.game.state.players[1].life).toBe(17);
    expect(tg.requests.some((r) => r.purpose === "chooseTarget")).toBe(false);
  });
});
