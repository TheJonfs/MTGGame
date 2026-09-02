import { describe, expect, it } from "vitest";
import { characteristics, getObject, legalActions } from "../src/index.js";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";

/**
 * S26 fixtures — the still-pair court's words at their customers (the-bloom-gauntlet-v1.md §3, the
 * brief's per-card list): Lumen's resolved gainControl (returns tapped at cleanup, CR 611.2c
 * survives her leaving, the steal-swing under the Tithe), Clio's accumulator (live static amount,
 * the cost gate at two counters, the Mind Rot chooser), Seraphina's tapped predicate (the Intake's
 * arrivals, mid-combat attackers, the untap-in-response fizzle — CR 608.2b), Yuloke's landfall
 * (the cycle-recover-drop loop, Wilds as two landfalls, the turn-two 5/3 under the Risen Tide),
 * and Faldor's DRAW collector (draw step, Divination = two, cycling = one, pre-game = none).
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);
const pt = (tg: TG, id: string) => { const c = characteristics(tg.game.ctx, id); return `${c.power}/${c.toughness}`; };
const COMBAT = ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] as const;

describe("Lumen, the Hearth Fire — gainControl until end of turn (the threaten class)", () => {
  it("the stolen creature attacks for its new controller with haste and lifelink, then returns TAPPED at cleanup (CR 611.2a expiry; nothing untaps it)", async () => {
    const tg = new TestGame({
      name: "lumen-steal-swing",
      setup: { players: [{ battlefield: ["lumen_the_hearth_fire"] }, { battlefield: ["grizzly_bears"] }] },
      script: [
        { player: 0, do: "activate", card: "lumen_the_hearth_fire", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "attack", attackers: ["grizzly_bears"] },
      ],
    });
    await tg.game.priorityRound();
    const bears = tg.findBattlefield("grizzly_bears");
    expect(getObject(tg.game.state, bears).controller).toBe(0);
    expect(getObject(tg.game.state, bears).tapped).toBe(false); // untapped by the ability
    expect(characteristics(tg.game.ctx, bears).keywords.has("lifelink")).toBe(true);
    for (const s of COMBAT) await tg.game.runStep(s);
    expect(tg.game.state.players[1].life).toBe(18);
    expect(tg.game.state.players[0].life).toBe(22); // lifelink on the borrowed creature pays its new controller
    await tg.game.runStep("MAIN2");
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    const after = getObject(tg.game.state, bears);
    expect(after.controller).toBe(1); // reverted at cleanup
    expect(after.tapped).toBe(true); // it attacked; reversion is not an untap
    expect(after.summoningSick).toBe(true); // CR 302.6: control changed hands again
  });

  it("the revert survives Lumen leaving mid-turn: exiled after the steal resolves, the creature stays stolen until cleanup (CR 611.2c — the duration is the turn's, not hers)", async () => {
    const tg = new TestGame({
      name: "lumen-leaves",
      setup: { players: [
        // The forest in hand keeps P0's post-activation window a real request (ADR-014 auto-takes a
        // lone pass), so the pass barrier binds and the steal resolves BEFORE the Swords.
        { battlefield: ["lumen_the_hearth_fire"], hand: ["forest"] },
        { battlefield: ["grizzly_bears", "plains"], hand: ["swords_to_plowshares"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "lumen_the_hearth_fire", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "pass" },
        { player: 1, do: "cast", card: "swords_to_plowshares", targets: [{ object: "lumen_the_hearth_fire" }] },
      ],
    });
    await tg.game.priorityRound();
    expect(onBf(tg, "lumen_the_hearth_fire")).toHaveLength(0);
    expect(tg.game.state.players[0].exile).toHaveLength(1);
    const bears = tg.findBattlefield("grizzly_bears");
    expect(getObject(tg.game.state, bears).controller).toBe(0); // still borrowed
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    expect(getObject(tg.game.state, bears).controller).toBe(1);
  });

  it("the steal-swing under the Tithe: the borrowed creature dies in combat under YOUR control and the law drains the intruder for it — lifelink +2, the tithe −1", async () => {
    const spec: FixtureSpec = {
      name: "lumen-tithe",
      setup: { players: [
        { battlefield: ["lumen_the_hearth_fire"] },
        { battlefield: ["law_tithe", "grizzly_bears", "centaur_courser"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "lumen_the_hearth_fire", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "attack", attackers: ["grizzly_bears"] },
        { player: 1, do: "block", blocks: [{ blocker: "centaur_courser", attacker: "grizzly_bears" }] },
      ],
      run: [{ priority: true }, { steps: [...COMBAT] }],
    };
    const tg = await runFixture(spec);
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears"); // owner's graveyard
    expect(tg.game.state.players[0].life).toBe(21); // +2 lifelink (bears hit the courser), −1 the Tithe
    expect(tg.game.state.players[1].life).toBe(20);
    expect(pt(tg, tg.findBattlefield("centaur_courser"))).toBe("3/3");
  });
});

describe("Clio, Lady of the Depths — named counters, the countersOnSelf ref, remove-counters-as-cost", () => {
  it("the static's amount is LIVE: two depth counters tax −2/−0, the end step adds a third and the tax follows", async () => {
    const tg = new TestGame({
      name: "clio-static",
      setup: { players: [
        { battlefield: [{ card: "clio_lady_of_the_depths", counters: { depth: 2 } }] },
        { battlefield: ["grizzly_bears"] },
      ] },
    });
    const bears = tg.findBattlefield("grizzly_bears");
    expect(pt(tg, bears)).toBe("0/2");
    expect(pt(tg, tg.findBattlefield("clio_lady_of_the_depths"))).toBe("2/4"); // never her own side
    await tg.game.runStep("END"); // "at the beginning of your end step"
    expect(getObject(tg.game.state, tg.findBattlefield("clio_lady_of_the_depths")).counters["depth"]).toBe(3);
    expect(pt(tg, bears)).toBe("-1/2");
  });

  it("the burst's cost gate: not offered at two depth counters, offered at three ({U}{B} in hand's reach both times)", async () => {
    const at = (depth: number) => new TestGame({
      name: `clio-gate-${depth}`,
      setup: { players: [{ battlefield: ["island", "swamp", { card: "clio_lady_of_the_depths", counters: { depth } }], library: ["forest", "forest"] }, {}] },
    });
    const offered = (tg: TestGame) => legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && getObject(tg.game.state, a.objectId).cardId === "clio_lady_of_the_depths");
    expect(offered(at(2))).toBe(false);
    expect(offered(at(3))).toBe(true);
  });

  it("the burst resolves: draw two, then each opponent discards through the Mind Rot chooser; the three counters are spent at activation (CR 601.2h)", async () => {
    const spec: FixtureSpec = {
      name: "clio-burst",
      setup: { players: [
        { battlefield: ["island", "swamp", { card: "clio_lady_of_the_depths", counters: { depth: 4 } }], library: ["forest", "forest", "forest"] },
        { hand: ["grizzly_bears", "doom_blade"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "clio_lady_of_the_depths", abilityIndex: 2 },
        { player: 1, do: "discard", card: "grizzly_bears" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0)).toEqual(["forest", "forest"]);
    expect(tg.handCardIds(1)).toEqual(["doom_blade"]);
    expect(getObject(tg.game.state, tg.findBattlefield("clio_lady_of_the_depths")).counters["depth"]).toBe(1);
  });
});

describe("Seraphina, the Initiative — the tappedCreature predicate + the opponents'-deaths counter", () => {
  it("under the Intake, the intruder's creature arrives tapped and dies before it wakes; she grows", async () => {
    const spec: FixtureSpec = {
      name: "seraphina-intake",
      setup: { players: [
        { battlefield: ["forest", "forest"], hand: ["grizzly_bears"] },
        { battlefield: ["law_intake", "seraphina_the_initiative"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "grizzly_bears" },
        { player: 1, do: "activate", card: "seraphina_the_initiative", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    const sera = tg.findBattlefield("seraphina_the_initiative");
    expect(getObject(tg.game.state, sera).counters["+1/+1"]).toBe(1);
    expect(pt(tg, sera)).toBe("3/4");
  });

  it("an untapped creature is never a legal target; an attacker is (tapped by attacking) and dies mid-combat before damage", async () => {
    const tg = new TestGame({
      name: "seraphina-attacker",
      setup: { players: [{ battlefield: ["grizzly_bears"] }, { battlefield: ["seraphina_the_initiative"] }] },
      script: [
        { player: 0, do: "attack", attackers: ["grizzly_bears"] },
        { player: 1, do: "activate", card: "seraphina_the_initiative", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
      ],
    });
    expect(legalActions(tg.game.ctx, 1).some((a) => a.type === "activateAbility")).toBe(false); // bears untapped: no target
    for (const s of COMBAT) await tg.game.runStep(s);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    expect(tg.game.state.players[1].life).toBe(20);
    expect(getObject(tg.game.state, tg.findBattlefield("seraphina_the_initiative")).counters["+1/+1"]).toBe(1);
  });

  it("the fizzle: untapped in response (Little Bear's ETB), the target is illegal at resolution — no death, no counter (CR 608.2b)", async () => {
    const spec: FixtureSpec = {
      name: "seraphina-fizzle",
      setup: { players: [
        { battlefield: [{ card: "grizzly_bears", tapped: true }, "forest", "forest", "forest"], hand: ["little_bear"] },
        { battlefield: ["seraphina_the_initiative"] },
      ] },
      script: [
        { player: 1, do: "activate", card: "seraphina_the_initiative", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "cast", card: "little_bear" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const bears = tg.findBattlefield("grizzly_bears");
    expect(getObject(tg.game.state, bears).tapped).toBe(false);
    expect(getObject(tg.game.state, tg.findBattlefield("seraphina_the_initiative")).counters["+1/+1"]).toBeUndefined();
    expect(pt(tg, tg.findBattlefield("seraphina_the_initiative"))).toBe("2/3");
  });
});

describe("Yuloke, the Animus — landfall pump + the attack-trigger regrowth", () => {
  it("the loop: cycle a Cave (a draw, and it hits the graveyard), attack and recover it, drop it in MAIN2 for +2/+0", async () => {
    const tg = new TestGame({
      name: "yuloke-loop",
      setup: { players: [{ battlefield: ["yuloke_the_animus", "mountain"], hand: ["forgotten_cave"], library: ["forest"] }, {}] },
      script: [
        { player: 0, do: "activate", card: "forgotten_cave", abilityIndex: 1 }, // cycling {R}
        { player: 0, do: "attack", attackers: ["yuloke_the_animus"] },
        { player: 0, do: "optional", accept: true },
        { player: 0, do: "playLand", card: "forgotten_cave" },
      ],
    });
    await tg.game.priorityRound();
    expect(tg.graveyardCardIds(0)).toEqual(["forgotten_cave"]);
    expect(tg.handCardIds(0)).toEqual(["forest"]);
    for (const s of COMBAT) await tg.game.runStep(s);
    expect(tg.game.state.players[1].life).toBe(17);
    expect(tg.handCardIds(0)).toEqual(["forest", "forgotten_cave"]); // recovered on attack
    await tg.game.runStep("MAIN2");
    const cave = tg.findBattlefield("forgotten_cave");
    expect(getObject(tg.game.state, cave).tapped).toBe(true); // the Cave enters tapped
    expect(pt(tg, tg.findBattlefield("yuloke_the_animus"))).toBe("5/3");
  });

  it("Evolving Wilds is two landfalls: the Wilds entering and the basic it fetches — 3/3 → 7/3", async () => {
    const spec: FixtureSpec = {
      name: "yuloke-wilds",
      setup: { players: [{ battlefield: ["yuloke_the_animus"], hand: ["evolving_wilds"], library: ["forest"] }, {}] },
      script: [
        { player: 0, do: "playLand", card: "evolving_wilds" },
        { player: 0, do: "activate", card: "evolving_wilds", abilityIndex: 0 },
        { player: 0, do: "search", card: "forest" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "forest")).toHaveLength(1);
    expect(pt(tg, tg.findBattlefield("yuloke_the_animus"))).toBe("7/3");
  });

  it("the turn-two line under the Risen Tide: land, cast on four (Elves), the law's second drop, a 5/3 trample haste swing", async () => {
    const spec: FixtureSpec = {
      name: "yuloke-turn-two",
      setup: { turn: 2, players: [
        { battlefield: ["law_risen_tide", "forest", "forest", "llanowar_elves"], hand: ["mountain", "taiga", "yuloke_the_animus"] },
        {},
      ] },
      script: [
        { player: 0, do: "playLand", card: "mountain" },
        { player: 0, do: "cast", card: "yuloke_the_animus" },
        { player: 0, do: "playLand", card: "taiga" },
        { player: 0, do: "attack", attackers: ["yuloke_the_animus"] },
      ],
      run: [{ priority: true }, { steps: [...COMBAT] }],
    };
    const tg = await runFixture(spec);
    expect(pt(tg, tg.findBattlefield("yuloke_the_animus"))).toBe("5/3");
    expect(tg.game.state.players[1].life).toBe(15);
  });
});

describe("Faldor, the Muster — the DRAW collector (skeleton's first customer)", () => {
  it("the draw step is a draw: one Soldier", async () => {
    const tg = new TestGame({
      name: "faldor-draw-step",
      setup: { step: "UPKEEP", players: [{ battlefield: ["faldor_the_muster"], library: ["forest"] }, {}] },
    });
    await tg.game.runStep("DRAW");
    expect(onBf(tg, "soldier_1_1")).toHaveLength(1);
  });

  it("Divination = two Soldiers; the opponent's draw (a cycled Cave at instant speed) = none", async () => {
    const spec: FixtureSpec = {
      name: "faldor-divination",
      setup: { players: [
        { battlefield: ["faldor_the_muster", "island", "island", "island"], hand: ["divination"], library: ["forest", "forest"] },
        { battlefield: ["mountain"], hand: ["forgotten_cave"], library: ["forest"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "divination" },
        { player: 1, do: "activate", card: "forgotten_cave", abilityIndex: 1 },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(1)).toEqual(["forest"]); // the opponent drew
    expect(onBf(tg, "soldier_1_1")).toHaveLength(2); // and only OUR draws mustered
    expect(onBf(tg, "soldier_1_1").every((id) => getObject(tg.game.state, id).controller === 0)).toBe(true);
  });

  it("cycling is a draw: one Soldier", async () => {
    const spec: FixtureSpec = {
      name: "faldor-cycling",
      setup: { players: [{ battlefield: ["faldor_the_muster", "mountain"], hand: ["forgotten_cave"], library: ["forest"] }, {}] },
      script: [{ player: 0, do: "activate", card: "forgotten_cave", abilityIndex: 1 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "soldier_1_1")).toHaveLength(1);
  });

  it("pre-game draws are not draws (CR 103.4): before turn 1 the collector is silent", async () => {
    const spec: FixtureSpec = {
      name: "faldor-pregame",
      setup: { turn: 0, players: [{ battlefield: ["faldor_the_muster", "island", "island", "island"], hand: ["divination"], library: ["forest", "forest"] }, {}] },
      script: [{ player: 0, do: "cast", card: "divination" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0)).toEqual(["forest", "forest"]);
    expect(onBf(tg, "soldier_1_1")).toHaveLength(0);
  });
});

describe("S26 r3 — tokens and laws cease on leaving (Chris notes 1–2)", () => {
  it("Restoration Angel blinking a token removes it: exiled tokens cease (CR 111.7) and nothing returns", async () => {
    const spec: FixtureSpec = {
      name: "blink-token",
      setup: { players: [
        { battlefield: ["plains", "plains", "plains", "plains", { card: "soldier_1_1", token: true }], hand: ["restoration_angel"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "restoration_angel" }], // the token is the lone candidate: auto-targeted (ADR-014)
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "restoration_angel")).toHaveLength(1);
    expect(onBf(tg, "soldier_1_1")).toHaveLength(0);
    expect(Object.values(tg.game.state.objects).filter((o) => o.cardId === "soldier_1_1" && o.zone === "battlefield")).toHaveLength(0);
  });

  it("a law is a token by construction: destroyed it leaves no graveyard card, bounced it leaves no hand card, blinked it is gone; a real card placed as a law (the Deepwood's Elves) stays real", async () => {
    const tg = new TestGame({
      name: "law-is-token",
      setup: { players: [{ battlefield: ["law_tithe", "llanowar_elves"] }, {}] },
    });
    const law = getObject(tg.game.state, tg.findBattlefield("law_tithe"));
    expect(law.isToken).toBe(true);
    expect(getObject(tg.game.state, tg.findBattlefield("llanowar_elves")).isToken).toBe(false);
  });
});
