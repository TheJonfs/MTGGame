import { describe, expect, it } from "vitest";
import { TestGame } from "./harness.js";
import { getObject, legalActions, eligibleAttackers } from "../src/index.js";

const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);

describe("S30 — six cards for the floor (ADR-104; R-093 words)", () => {
  it("Wood Elves fetches a Breeding Pool UNTAPPED (a Forest card by subtype) and the fetched land triggers a Crab", async () => {
    const tg = new TestGame({
      name: "wood-elves",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["hedron_crab", "forest", "forest", "forest"], hand: ["wood_elves"], library: ["island", "breeding_pool", "forest", "swamp"] },
        { library: Array.from({ length: 10 }, () => "swamp") },
      ] },
      script: [{ player: 0, do: "cast", card: "wood_elves" }, { player: 0, do: "search", card: "breeding_pool" }, { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] }],
    });
    await tg.game.runStep("MAIN1");
    const pool = tg.game.state.battlefield.find((id) => getObject(tg.game.state, id).cardId === "breeding_pool")!;
    expect(pool).toBeTruthy();
    expect(getObject(tg.game.state, pool).tapped).toBe(false);
    expect(tg.game.state.players[1].library.length).toBe(7); // the Crab saw the land enter
  });

  it("Wall of Blossoms draws a card on entering and is never an eligible attacker (defender)", async () => {
    const tg = new TestGame({
      name: "wall-of-blossoms",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["forest", "forest"], hand: ["wall_of_blossoms"], library: ["island", "island"] }, { battlefield: [] }] },
      script: [{ player: 0, do: "cast", card: "wall_of_blossoms" }],
    });
    const handBefore = tg.game.state.players[0].hand.length;
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[0].hand.length).toBe(handBefore); // −1 cast, +1 drawn
    const wall = tg.findBattlefield("wall_of_blossoms");
    getObject(tg.game.state, wall).summoningSick = false;
    expect(eligibleAttackers(tg.game.ctx)).not.toContain(wall);
  });

  it("Wall of Air (defender, flying) blocks a flier and never attacks", async () => {
    const tg = new TestGame({
      name: "wall-of-air",
      setup: { active: 1, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["wall_of_air"] }, { battlefield: ["wind_drake"] }] },
      script: [{ player: 1, do: "attack", attackers: ["wind_drake"] }, { player: 0, do: "block", blocks: [{ blocker: "wall_of_air", attacker: "wind_drake" }] }],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    await tg.game.runStep("DECLARE_BLOCKERS");
    await tg.game.runStep("COMBAT_DAMAGE");
    expect(tg.game.state.players[0].life).toBe(20);
    expect(bf(tg, 0)).toContain("wall_of_air"); // 1/5 holds a 2/2 flier
    tg.game.state.activePlayer = 0;
    expect(eligibleAttackers(tg.game.ctx)).toEqual([]);
  });

  it("Buried Alive: up to three creature cards to the graveyard — with two creatures in the library it takes both and stops", async () => {
    const tg = new TestGame({
      name: "buried-alive",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["swamp", "swamp", "swamp"], hand: ["buried_alive"], library: ["serra_angel", "island", "restoration_angel", "swamp"] },
        { battlefield: [] },
      ] },
      script: [{ player: 0, do: "cast", card: "buried_alive" }, { player: 0, do: "search", card: "serra_angel" }, { player: 0, do: "search", card: "restoration_angel" }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.graveyardCardIds(0).sort()).toEqual(["buried_alive", "restoration_angel", "serra_angel"]);
    expect(tg.game.state.players[0].library.length).toBe(2);
    expect(tg.requests.filter((r) => r.purpose === "searchLibrary")).toHaveLength(2); // no third pick was asked — no creature left
  });

  it("Reassembling Skeleton returns TAPPED from the graveyard by its own ability, only from the graveyard, and is a legal Unearth target", async () => {
    const tg = new TestGame({
      name: "skeleton",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["swamp", "swamp", "swamp"], hand: ["unearth", "reassembling_skeleton"], graveyard: ["reassembling_skeleton"] },
        { battlefield: [] },
      ] },
      script: [],
    });
    await tg.game.runStep("MAIN1");
    const acts = legalActions(tg.game.ctx, 0);
    const activations = acts.filter((a) => a.type === "activateAbility" && getObject(tg.game.state, a.objectId).cardId === "reassembling_skeleton");
    expect(activations).toHaveLength(1); // the graveyard copy's return; the one in HAND offers nothing (Unearth's cycling is the other activation on offer)
    expect(getObject(tg.game.state, (activations[0] as { objectId: string }).objectId).zone).toBe("graveyard");
    expect(acts.some((a) => a.type === "castSpell" && getObject(tg.game.state, a.objectId).cardId === "unearth")).toBe(true); // Unearth sees the Skeleton (MV 2)
    const ret = new TestGame({
      name: "skeleton-return",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp", "swamp"], graveyard: ["reassembling_skeleton"] }, { battlefield: [] }] },
      script: [{ player: 0, do: "activate", card: "reassembling_skeleton", abilityIndex: 0 }],
    });
    await ret.game.runStep("MAIN1");
    const sk = ret.findBattlefield("reassembling_skeleton");
    expect(getObject(ret.game.state, sk).tapped).toBe(true);
    expect(ret.graveyardCardIds(0)).toEqual([]);
  });

  it("Thought Scour mills the targeted player — self or opponent — and draws", async () => {
    for (const target of [0, 1] as const) {
      const tg = new TestGame({
        name: `thought-scour-${target}`,
        setup: { active: 0, step: "MAIN1", players: [
          { battlefield: ["island"], hand: ["thought_scour"], library: ["island", "island", "island", "island"] },
          { library: ["swamp", "swamp", "swamp"] },
        ] },
        script: [{ player: 0, do: "cast", card: "thought_scour", targets: [{ player: target }] }],
      });
      await tg.game.runStep("MAIN1");
      expect(tg.game.state.players[1].library.length).toBe(target === 1 ? 1 : 3);
      expect(tg.game.state.players[0].library.length).toBe(target === 0 ? 4 - 2 - 1 : 4 - 1);
      expect(tg.game.state.players[0].hand.length).toBe(1); // Scour spent, one drawn
    }
  });

  it("Pyroclasm kills the caster's own Elementals too", async () => {
    const tg = new TestGame({
      name: "pyroclasm-own",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["mountain", "mountain", "young_pyromancer", { card: "elemental_1_1_r", token: true }, { card: "elemental_1_1_r", token: true }], hand: ["pyroclasm"] },
        { battlefield: ["grizzly_bears", "centaur_courser"] },
      ] },
      script: [{ player: 0, do: "cast", card: "pyroclasm" }],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(0);
    expect(bf(tg, 0)).not.toContain("young_pyromancer");
    expect(bf(tg, 1)).toEqual(["centaur_courser"]); // the 3/3 survives, the Bears do not
  });
});
