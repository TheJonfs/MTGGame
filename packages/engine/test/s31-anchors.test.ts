import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { TestGame, runFixture, type FixtureSpec } from "./harness.js";

type TG = Awaited<ReturnType<typeof runFixture>>;
const gy = (tg: TG, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TG, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const lib = (tg: TG, p: 0 | 1) => tg.game.state.players[p].library.length;

const COMBAT_TO_END: FixtureSpec["run"] = [
  { steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END", "MAIN2", "END"] },
];
const ISLANDS = (n: number) => Array.from({ length: n }, () => "island");

describe("S31 Part 1 — the Traumatizer retexted (ADR-107; R-094): whenever a CREATURE YOU CONTROL deals damage to a player, that player mills twice that many", () => {
  it("combat damage by another creature: a lone 1/1 Adept connects under the Traumatizer — 2 milled; the Traumatizer stayed home", async () => {
    const tg = await runFixture({
      name: "trauma-adept",
      setup: { players: [{ battlefield: ["traumatizer", "cathartic_adept"] }, { library: ISLANDS(8) }] },
      script: [{ player: 0, do: "attack", attackers: ["cathartic_adept"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(19);
    expect(lib(tg, 1)).toBe(6);
  });

  it("noncombat damage counts: a pinger's activation at the opponent's face mills 2 (deals damage, not combat damage)", async () => {
    const tg = new TestGame({
      name: "trauma-ping",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["traumatizer", "test_pinger", "island"] }, { library: ISLANDS(8) }] },
      script: [{ player: 0, do: "activate", card: "test_pinger", abilityIndex: 0, targets: [{ player: 1 }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[1].life).toBe(19);
    expect(lib(tg, 1)).toBe(6);
  });

  it("two Traumatizers stack ADDITIVELY: one attacks for 2 — each triggers for 4, eight milled (not sixteen)", async () => {
    const tg = await runFixture({
      name: "trauma-two",
      setup: { players: [{ battlefield: ["traumatizer", "traumatizer"] }, { library: ISLANDS(12) }] },
      script: [{ player: 0, do: "attack", attackers: ["traumatizer"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(18);
    expect(lib(tg, 1)).toBe(4);
  });

  it("damage to a CREATURE does not trigger: a fight (Prey Upon) and a blocked Bears mill nothing", async () => {
    const fight = new TestGame({
      name: "trauma-fight",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["traumatizer", "grizzly_bears", "forest"], hand: ["prey_upon"] }, { battlefield: ["goblin_piker"], library: ISLANDS(6) }] },
      script: [{ player: 0, do: "cast", card: "prey_upon", targets: [{ object: "grizzly_bears" }, { object: "goblin_piker" }] }],
    });
    await fight.game.runStep("MAIN1");
    expect(gy(fight, 1)).toContain("goblin_piker");
    expect(lib(fight, 1)).toBe(6);
    const blocked = await runFixture({
      name: "trauma-blocked",
      setup: { players: [{ battlefield: ["traumatizer", "grizzly_bears"] }, { battlefield: ["centaur_courser"], library: ISLANDS(6) }] },
      script: [{ player: 0, do: "attack", attackers: ["grizzly_bears"] }, { player: 1, do: "block", blocks: [{ blocker: "centaur_courser", attacker: "grizzly_bears" }] }],
      run: COMBAT_TO_END,
    });
    expect(lib(blocked, 1)).toBe(6);
    expect(blocked.game.state.players[1].life).toBe(20);
  });

  it("a Giant Growth on the attacker doubles the mill: the pumped Traumatizer connects for 5 — ten milled", async () => {
    const tg = await runFixture({
      name: "trauma-growth",
      setup: { players: [{ battlefield: ["traumatizer", "forest"], hand: ["giant_growth"] }, { library: ISLANDS(12) }] },
      script: [{ player: 0, do: "attack", attackers: ["traumatizer"] }, { player: 0, do: "cast", card: "giant_growth", targets: [{ object: "traumatizer" }] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(15);
    expect(lib(tg, 1)).toBe(2);
  });

  it("the Traumatizer's own damage triggers itself (it is a creature its controller controls); the OPPONENT's creatures never do (controller: you)", async () => {
    const own = await runFixture({
      name: "trauma-self",
      setup: { players: [{ battlefield: ["traumatizer"] }, { library: ISLANDS(6) }] },
      script: [{ player: 0, do: "attack", attackers: ["traumatizer"] }],
      run: COMBAT_TO_END,
    });
    expect(lib(own, 1)).toBe(2);
    // Their Bears hit the Traumatizer's controller: nobody mills.
    const theirs = await runFixture({
      name: "trauma-theirs",
      setup: { active: 1, players: [{ battlefield: ["traumatizer"], library: ISLANDS(6) }, { battlefield: ["grizzly_bears"], library: ISLANDS(6) }] },
      script: [{ player: 1, do: "attack", attackers: ["grizzly_bears"] }],
      run: COMBAT_TO_END,
    });
    expect(theirs.game.state.players[0].life).toBe(18);
    expect(lib(theirs, 0)).toBe(6);
    expect(lib(theirs, 1)).toBe(6);
  });
});

describe("S31 Part 2 — Artisan of Kozilek ({9} 10/9; when you cast: return target creature card from your graveyard; annihilator 2) — R-094's stack-zone cast trigger and the edict word", () => {
  it("the cast trigger resolves even when the Artisan is countered (CR 603.2 — it triggered on the cast): the Serra returns, the Artisan is in the graveyard", async () => {
    const tg = new TestGame({
      name: "artisan-countered",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ISLANDS(9), hand: ["artisan_of_kozilek"], graveyard: ["serra_angel"] },
        { battlefield: ["island", "island"], hand: ["counterspell"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "artisan_of_kozilek" },
        { player: 1, do: "cast", card: "counterspell", targets: [{ spell: "artisan_of_kozilek" }] },
        { player: 0, do: "optional", accept: true },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toContain("artisan_of_kozilek");
    expect(bf(tg, 0)).toContain("serra_angel");
    expect(gy(tg, 0)).not.toContain("serra_angel");
  });

  it("hard-cast with an empty graveyard: no trigger goes on the stack (603.3d); the 10/9 resolves", async () => {
    const tg = new TestGame({
      name: "artisan-plain",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ISLANDS(9), hand: ["artisan_of_kozilek"] }, {}] },
      script: [{ player: 0, do: "cast", card: "artisan_of_kozilek" }],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0)).toContain("artisan_of_kozilek");
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "TRIGGER_NO_TARGETS")).toBe(true);
  });

  it("annihilator 2 with fewer than two permanents: the defender's lone Forest goes (forced, unlogged); the trigger resolves before blockers", async () => {
    const tg = await runFixture({
      name: "annihilator-one",
      setup: { players: [{ battlefield: ["artisan_of_kozilek"] }, { battlefield: ["forest"] }] },
      script: [{ player: 0, do: "attack", attackers: ["artisan_of_kozilek"] }],
      run: [{ steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS"] }],
    });
    expect(bf(tg, 1)).toEqual([]);
    expect(gy(tg, 1)).toEqual(["forest"]);
    await tg.game.runStep("DECLARE_BLOCKERS");
    await tg.game.runStep("COMBAT_DAMAGE");
    expect(tg.game.state.players[1].life).toBe(10);
  });

  it("the defending player CHOOSES (one logged pick each, the two leave together): Forest then Bears — the token stays; a sacrificed would-be blocker cannot block", async () => {
    const tg = await runFixture({
      name: "annihilator-choice",
      setup: { players: [{ battlefield: ["artisan_of_kozilek"] }, { battlefield: ["forest", "grizzly_bears", { card: "elemental_1_1_r", token: true }] }] },
      script: [
        { player: 0, do: "attack", attackers: ["artisan_of_kozilek"] },
        { player: 1, do: "sacrificeChoice", card: "forest" },
        { player: 1, do: "sacrificeChoice", card: "grizzly_bears" },
      ],
      run: [{ steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS"] }],
    });
    expect(bf(tg, 1)).toEqual(["elemental_1_1_r"]);
    expect(gy(tg, 1).sort()).toEqual(["forest", "grizzly_bears"]);
    const sacs = tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "sacrifice");
    expect(sacs).toHaveLength(2);
  });

  it("a deathtouch blocker kills it: after two Forests go, the Typhoid Rats block — the Artisan dies, the Rats die", async () => {
    const tg = await runFixture({
      name: "annihilator-deathtouch",
      setup: { players: [{ battlefield: ["artisan_of_kozilek"] }, { battlefield: ["typhoid_rats", "forest", "forest", "forest"] }] },
      script: [
        { player: 0, do: "attack", attackers: ["artisan_of_kozilek"] },
        { player: 1, do: "sacrificeChoice", card: "forest" },
        { player: 1, do: "sacrificeChoice", card: "forest" },
        { player: 1, do: "block", blocks: [{ blocker: "typhoid_rats", attacker: "artisan_of_kozilek" }] },
      ],
      run: COMBAT_TO_END,
    });
    expect(gy(tg, 0)).toContain("artisan_of_kozilek");
    expect(gy(tg, 1)).toContain("typhoid_rats");
    expect(bf(tg, 1)).toEqual(["forest"]);
    expect(tg.game.state.players[1].life).toBe(20);
  });
});

describe("S31 Part 3 — Grazing Gladehart ({2}{G} 2/2; landfall — you may gain 2 life): zero words", () => {
  it("a land drop offers the gain; accepted, +2; the fetched Forest of a Wood Elves triggers it too", async () => {
    const tg = new TestGame({
      name: "gladehart",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["grazing_gladehart", "forest", "forest", "forest"], hand: ["forest", "wood_elves"], library: ["forest", "island"] }, {}] },
      script: [
        { player: 0, do: "playLand", card: "forest" },
        { player: 0, do: "optional", accept: true },
        { player: 0, do: "cast", card: "wood_elves" },
        { player: 0, do: "search", card: "forest" },
        { player: 0, do: "optional", accept: true },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[0].life).toBe(24);
  });
});
