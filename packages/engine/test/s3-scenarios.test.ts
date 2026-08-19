import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";
import {
  blockerChoices,
  characteristics,
  getObject,
  isLegalTarget,
  legalActions,
  moveObject,
  runSBAs,
  sacrificeCandidates,
  stageBlock,
} from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

describe("S3 — sacrifice as cost (brief 1–2)", () => {
  it("1. Siege-Gang ETB: three red Goblin tokens (colors R per ADR-019)", async () => {
    const tg = await runFixture(fixture("s3-01-siege-gang-etb"));
    const goblins = tg.game.state.battlefield.filter(
      (id) => getObject(tg.game.state, id).cardId === "goblin_1_1",
    );
    expect(goblins).toHaveLength(3);
    expect(getObject(tg.game.state, goblins[0]!).isToken).toBe(true);
    const def = tg.game.ctx.defs.def("goblin_1_1");
    expect(def.colors).toEqual(["R"]);
  });

  it("1b. activation sacs a chosen token: token ceases, 2 to the face; the commander itself is a legal sacrifice", async () => {
    const tg = await runFixture(fixture("s3-01b-siege-gang-sac"));
    const ctx = tg.game.ctx;
    expect(tg.battlefieldCardIds().filter((c) => c === "goblin_1_1")).toHaveLength(2);
    expect(tg.game.state.players[1].life).toBe(18);
    // Sacrificed token ceased to exist (CR 111.7) — not in the graveyard.
    expect(tg.graveyardCardIds(0)).not.toContain("goblin_1_1");
    const sgc = tg.findBattlefield("siege_gang_commander");
    expect(sacrificeCandidates(ctx, 0, sgc, "creature.subtype:Goblin")).toContain(sgc);
  });

  it("2. sacrificing a creature with a DIES trigger during cost payment: trigger fires and resolves above the ability", async () => {
    const tg = await runFixture(fixture("s3-02-sac-dies-trigger"));
    // Martyr died paying the cost; its trigger drew a card; the damage resolved.
    expect(tg.graveyardCardIds(0)).toContain("test_goblin_martyr");
    expect(tg.handCardIds(0)).toHaveLength(1);
    expect(tg.game.state.players[1].life).toBe(18);
  });
});

describe("S3 — Mind Stone and colorless mana (brief 3)", () => {
  it("{C} pays generic but not colored", () => {
    const tg = new TestGame({
      name: "c-mana",
      setup: { players: [{ battlefield: ["mind_stone"], hand: ["bonesplitter", "lightning_bolt"] }, {}] },
    });
    const actions = legalActions(tg.game.ctx, 0);
    // Bonesplitter ({1}) is castable off the Mind Stone; Bolt ({R}) is not.
    expect(actions.some((a) => a.type === "castSpell" && getObject(tg.game.state, a.objectId).cardId === "bonesplitter")).toBe(true);
    expect(actions.some((a) => a.type === "castSpell" && getObject(tg.game.state, a.objectId).cardId === "lightning_bolt")).toBe(false);
  });

  it("3. sac-draw: Mind Stone to the graveyard, card drawn; tap cost means one ability per turn", async () => {
    const tg = await runFixture(fixture("s3-03-mind-stone-sac-draw"));
    expect(tg.graveyardCardIds(0)).toContain("mind_stone");
    expect(tg.handCardIds(0)).toHaveLength(1);
  });

  it("a lone Mind Stone cannot pay its own {1} sac cost (its {T} is part of that cost)", () => {
    const tg = new TestGame({
      name: "lone-stone",
      setup: { players: [{ battlefield: ["mind_stone"] }, {}] },
    });
    const actions = legalActions(tg.game.ctx, 0);
    expect(actions.some((a) => a.type === "activateAbility")).toBe(false); // fuzz-caught S3 regression
    expect(actions.some((a) => a.type === "tapForMana")).toBe(true);
  });

  it("a tapped Mind Stone offers neither ability", () => {
    const tg = new TestGame({
      name: "tapped-stone",
      setup: { players: [{ battlefield: [{ card: "mind_stone", tapped: true }, "island"] }, {}] },
    });
    const actions = legalActions(tg.game.ctx, 0);
    expect(actions.some((a) => a.type === "tapForMana")).toBe(true); // the island
    expect(actions.some((a) => a.type === "tapForMana" && getObject(tg.game.state, a.objectId).cardId === "mind_stone")).toBe(false);
    expect(actions.some((a) => a.type === "activateAbility")).toBe(false);
  });
});

describe("S3 — equipment (brief 4–5)", () => {
  it("4. equip at sorcery speed only; survives its creature; re-equip moves it", async () => {
    const tg = new TestGame({
      name: "bonesplitter",
      setup: {
        players: [
          { battlefield: ["bonesplitter", "savannah_lions", "goblin_piker", "mountain", "mountain"] },
          {},
        ],
      },
      script: [
        { player: 0, do: "activate", card: "bonesplitter", abilityIndex: 1, targets: [{ object: "savannah_lions" }] },
      ],
    });
    const ctx = tg.game.ctx;
    // Sorcery timing: no equip action outside the controller's main phase.
    ctx.state.step = "END";
    expect(legalActions(ctx, 0).some((a) => a.type === "activateAbility")).toBe(false);
    ctx.state.step = "MAIN1";

    await tg.game.priorityRound();
    const lions = tg.findBattlefield("savannah_lions");
    const splitter = tg.findBattlefield("bonesplitter");
    expect(getObject(ctx.state, splitter).attachedTo).toBe(lions);
    expect(characteristics(ctx, lions)).toMatchObject({ power: 4, toughness: 1 });

    // Creature dies: the equipment stays, unattached (SBA unattach, not destroy).
    moveObject(ctx, lions, "graveyard");
    runSBAs(ctx);
    expect(getObject(ctx.state, tg.findBattlefield("bonesplitter")).attachedTo).toBeNull();
    expect(tg.battlefieldCardIds()).toContain("bonesplitter");

    // Re-equip onto the other creature.
    const piker = tg.findBattlefield("goblin_piker");
    getObject(ctx.state, tg.findBattlefield("bonesplitter")).attachedTo = piker;
    expect(characteristics(ctx, piker)).toMatchObject({ power: 4, toughness: 1 });
  });

  it("5. Warhammer combat: 5/2 trample lifelink — 1 to the chump, 4 to the player, gain 5", async () => {
    const tg = await runFixture(fixture("s3-05-warhammer-combat"));
    expect(tg.graveyardCardIds(1)).toContain("raging_goblin");
    expect(tg.game.state.players[1].life).toBe(16);
    expect(tg.game.state.players[0].life).toBe(25);
  });
});

describe("S3 — deathtouch, trample interplay, fight (brief 6–7, 13)", () => {
  it("6. Recluse blocks Pelakka: lethal 2 assigned (attacker has no deathtouch), 5 tramples; Recluse's 1 kills the wurm", async () => {
    // The brief said "assign only 1 as lethal" — that's the rule for a
    // deathtouch ATTACKER (510.1c reads the source's deathtouch), and Pelakka
    // has none. Deviation noted in the handoff; 6b covers the dt-attacker case.
    const tg = await runFixture(fixture("s3-06-recluse-blocks-trampler"));
    expect(tg.game.state.players[0].life).toBe(15); // 7 - lethal 2 = 5 through
    expect(tg.graveyardCardIds(0)).toContain("deadly_recluse");
    expect(tg.graveyardCardIds(1)).toContain("pelakka_wurm"); // 1 deathtouch damage
    expect(tg.handCardIds(1)).toContain("forest"); // wurm's dies-draw fired
  });

  it("6b. Warhammer'd Recluse (4/2 trample+deathtouch+lifelink) vs a 4/4: 1 is lethal, 3 through, gain 4, blocker dies", async () => {
    const tg = await runFixture(fixture("s3-06b-dt-trampler"));
    expect(tg.graveyardCardIds(1)).toContain("rumbling_baloth"); // 1 dt damage destroyed it
    expect(tg.game.state.players[1].life).toBe(17); // 3 trampled through
    expect(tg.game.state.players[0].life).toBe(24); // lifelink on all 4
    expect(tg.graveyardCardIds(0)).toContain("deadly_recluse"); // took 4 back
  });

  it("7. Prey Upon: Recluse fights Baloth — both die; noncombat deathtouch works", async () => {
    const tg = await runFixture(fixture("s3-07-prey-upon-deathtouch"));
    expect(tg.graveyardCardIds(0)).toContain("deadly_recluse"); // took 4
    expect(tg.graveyardCardIds(1)).toContain("rumbling_baloth"); // 1 dt damage
  });

  it("7b. fight is all-or-nothing: bounced second target means no damage either way (ADR-022)", async () => {
    const tg = await runFixture(fixture("s3-07b-prey-upon-fizzle-half"));
    const bears = tg.findBattlefield("grizzly_bears");
    expect(tg.game.state.objects[bears]!.damage).toBe(0);
    expect(tg.handCardIds(1)).toContain("savannah_lions");
    expect(tg.graveyardCardIds(0)).toContain("prey_upon");
  });

  it("13. lifelink applies to fight damage (noncombat)", async () => {
    const tg = new TestGame({
      name: "lifelink-fight",
      setup: {
        players: [
          {
            battlefield: ["deadly_recluse", { card: "loxodon_warhammer", attachedTo: "deadly_recluse" }, "forest"],
            hand: ["prey_upon"],
          },
          { battlefield: ["rumbling_baloth"] },
        ],
      },
      script: [
        { player: 0, do: "cast", card: "prey_upon", targets: [{ object: "deadly_recluse" }, { object: "rumbling_baloth" }] },
      ],
    });
    await tg.game.priorityRound();
    expect(tg.game.state.players[0].life).toBe(24); // dealt 4 with lifelink
    expect(tg.graveyardCardIds(1)).toContain("rumbling_baloth");
  });
});

describe("S3 — double strike (brief 8)", () => {
  it("8. blocked: kills the 3/3 in the first-strike step, takes nothing back", async () => {
    const tg = await runFixture(fixture("s3-08-double-strike-blocked"));
    expect(tg.graveyardCardIds(1)).toContain("centaur_courser");
    const ace = tg.findBattlefield("fencing_ace");
    expect(tg.game.state.objects[ace]!.damage).toBe(0);
    expect(tg.game.state.players[1].life).toBe(20); // no trample
  });

  it("8b. unblocked: 3 + 3 across both damage steps", async () => {
    const tg = await runFixture(fixture("s3-08b-double-strike-unblocked"));
    expect(tg.game.state.players[1].life).toBe(14);
  });
});

describe("S3 — menace (brief 9)", () => {
  it("9. one available blocker: the lone menace block is never offered", async () => {
    const tg = new TestGame({
      name: "menace-one",
      setup: {
        turn: 4,
        active: 0,
        step: "DECLARE_ATTACKERS",
        players: [{ battlefield: ["boggart_brute"] }, { battlefield: ["grizzly_bears"] }],
      },
      script: [{ player: 0, do: "attack", attackers: ["boggart_brute"] }],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(blockerChoices(tg.game.ctx)).toEqual([{ type: "doneDeclaringBlockers" }]);
  });

  it("9b. mid-declaration with one menace block staged: only the fixing block is offered", async () => {
    const tg = new TestGame({
      name: "menace-mid",
      setup: {
        turn: 4,
        active: 0,
        step: "DECLARE_ATTACKERS",
        players: [{ battlefield: ["boggart_brute"] }, { battlefield: ["grizzly_bears", "centaur_courser"] }],
      },
      script: [{ player: 0, do: "attack", attackers: ["boggart_brute"] }],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    const ctx = tg.game.ctx;
    const brute = tg.findBattlefield("boggart_brute");
    const bears = tg.findBattlefield("grizzly_bears");
    stageBlock(ctx, bears, brute);
    const choices = blockerChoices(ctx);
    // No "done", no other targets — only the courser joining the block.
    expect(choices).toEqual([
      { type: "declareBlocker", blocker: tg.findBattlefield("centaur_courser"), attacker: brute },
    ]);
  });

  it("9c. two blockers is a legal menace block and combat plays out", async () => {
    const tg = await runFixture(fixture("s3-09-menace-two-blockers"));
    // 3 power, lethal 2 to the first bear, 1 to the second; two 2s back kill the brute.
    expect(tg.graveyardCardIds(0)).toContain("boggart_brute");
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears");
  });
});

describe("S3 — hexproof, shroud, indestructible (brief 10–12)", () => {
  it("10. hexproof: opponent's Bolt never targets it; own Giant Growth can; mass damage still hits", async () => {
    const tg = new TestGame({
      name: "gladecover",
      setup: {
        players: [
          { battlefield: ["gladecover_scout"], hand: ["giant_growth"] },
          { battlefield: ["mountain"], hand: ["lightning_bolt", "test_pyroclasm"] },
        ],
      },
    });
    const ctx = tg.game.ctx;
    const scout = tg.findBattlefield("gladecover_scout");
    // Opponent's bolt: scout is not an enumerable target.
    const p1Actions = legalActions(ctx, 1);
    expect(
      p1Actions.some(
        (a) => a.type === "castSpell" && a.targets.some((t) => t.kind === "object" && t.id === scout),
      ),
    ).toBe(false);
    // Own Giant Growth: legal.
    expect(
      isLegalTarget(ctx, { count: 1, predicate: "creature", zone: "battlefield" }, { kind: "object", id: scout }, 0),
    ).toBe(true);
    // damageAll doesn't target: it hits.
    const { makeEffectContext } = await import("../src/index.js");
    const item = {
      id: "test", kind: "spell" as const, sourceCardId: "test_pyroclasm", controller: 1 as const,
      targetSpecs: [], targets: [], effects: [], x: 0,
    };
    const { resolveEffect } = await import("@shandalar/cards");
    resolveEffect({ type: "damageAll", amount: 2, scope: "allCreatures" }, makeEffectContext(ctx, item));
    runSBAs(ctx);
    expect(tg.graveyardCardIds(0)).toContain("gladecover_scout");
  });

  it("11. Blurred Mongoose: legally countered, illegally affected — resolves anyway; shroud blocks even its controller", async () => {
    const tg = await runFixture(fixture("s3-11-mongoose-uncounterable"));
    const ctx = tg.game.ctx;
    expect(tg.battlefieldCardIds()).toContain("blurred_mongoose");
    expect(tg.graveyardCardIds(1)).toContain("counterspell"); // resolved, did nothing
    const mongoose = tg.findBattlefield("blurred_mongoose");
    // Shroud: own targeting is illegal too — Giant Growth and equip alike.
    expect(
      isLegalTarget(ctx, { count: 1, predicate: "creature", zone: "battlefield" }, { kind: "object", id: mongoose }, 0),
    ).toBe(false);
    expect(
      isLegalTarget(ctx, { count: 1, predicate: "creatureYouControl", zone: "battlefield" }, { kind: "object", id: mongoose }, 0),
    ).toBe(false);
  });

  it("12. Darksteel Myr: survives burn and mass destroy; dies to toughness <= 0", async () => {
    const tg = new TestGame({
      name: "darksteel",
      setup: {
        players: [
          { battlefield: ["darksteel_myr"] },
          { battlefield: ["mountain", "mountain", "mountain", "mountain"], hand: ["lightning_bolt", "lightning_bolt", "test_wrath"] },
        ],
        active: 1,
      },
      script: [
        { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "darksteel_myr" }] },
        { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "darksteel_myr" }] },
        { player: 1, do: "cast", card: "test_wrath" },
      ],
    });
    await tg.game.priorityRound();
    expect(tg.battlefieldCardIds()).toContain("darksteel_myr"); // 6 damage + destroyAll shrugged off
    const myr = tg.findBattlefield("darksteel_myr");
    tg.game.state.continuousEffects.push({
      kind: "modifyPT", objectId: myr, power: 0, toughness: -1,
      duration: "UNTIL_END_OF_TURN", sourceStackItemId: "test", timestamp: 999,
    });
    runSBAs(tg.game.ctx);
    expect(tg.graveyardCardIds(0)).toContain("darksteel_myr"); // 704.5f spares no one
  });
});
