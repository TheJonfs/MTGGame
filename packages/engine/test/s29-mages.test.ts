import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TestGame } from "./harness.js";
import { getObject, legalActions, characteristics } from "../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);

describe("S29 — the six adds (ADR-101; R-092 words) and the Chronicle string", () => {
  it("Young Pyromancer: a token per instant or sorcery we cast, none for a creature; the trigger resolves before the spell — a countered Bolt still makes the token", async () => {
    const tg = new TestGame({
      name: "pyromancer",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["young_pyromancer", "mountain", "mountain", "forest", "forest"], hand: ["lightning_bolt", "grizzly_bears"] },
        { battlefield: ["island", "island"], hand: ["counterspell"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] },
        { player: 1, do: "cast", card: "counterspell", targets: [{ spell: "lightning_bolt" }] },
        { player: 0, do: "cast", card: "grizzly_bears" },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(1); // the Bolt's token, though the Bolt was countered
    expect(tg.game.state.players[1].life).toBe(20);
    expect(bf(tg, 0)).toContain("grizzly_bears"); // a creature spell: no second token
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(1);
  });

  it("Arc Mage: two modes (2 to one target / 1 to each of two), never zero targets, a card discarded as the cost", async () => {
    const tg = new TestGame({
      name: "arc-mage",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["arc_mage", "mountain", "mountain", "mountain"], hand: ["forest", "plains"] },
        { battlefield: ["typhoid_rats", "raging_goblin", "grizzly_bears"] },
      ] },
      script: [],
    });
    await tg.game.runStep("MAIN1");
    const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility");
    expect(acts.every((a) => a.type === "activateAbility" && (a.mode === 0 || a.mode === 1))).toBe(true);
    expect(acts.filter((a) => a.type === "activateAbility" && a.targets.length === 0)).toHaveLength(0); // never zero targets
    const one = acts.filter((a) => a.type === "activateAbility" && a.mode === 0);
    const two = acts.filter((a) => a.type === "activateAbility" && a.mode === 1);
    expect(one.length).toBe(4 + 2 - 0); // four creatures (their three + Arc Mage) + two players
    expect(two.every((a) => a.type === "activateAbility" && a.targets.length === 2 && JSON.stringify(a.targets[0]) !== JSON.stringify(a.targets[1]))).toBe(true);
    // Split: 1 to the Rats and 1 to the Goblin — both die; a card leaves the hand as the cost.
    const split = new TestGame({
      name: "arc-mage-split",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["arc_mage", "mountain", "mountain", "mountain"], hand: ["forest", "plains"] },
        { battlefield: ["typhoid_rats", "raging_goblin", "grizzly_bears"] },
      ] },
      script: [{ player: 0, do: "activate", card: "arc_mage", abilityIndex: 0, mode: 1, targets: [{ object: "typhoid_rats" }, { object: "raging_goblin" }] }, { player: 0, do: "discard", card: "forest" }],
    });
    await split.game.runStep("MAIN1");
    expect(split.graveyardCardIds(1).sort()).toEqual(["raging_goblin", "typhoid_rats"]);
    expect(split.game.state.players[0].hand.map((id) => getObject(split.game.state, id).cardId)).toEqual(["plains"]);
    // Two to one: the Bears die.
    const focus = new TestGame({
      name: "arc-mage-focus",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["arc_mage", "mountain", "mountain", "mountain"], hand: ["forest"] },
        { battlefield: ["grizzly_bears"] },
      ] },
      script: [{ player: 0, do: "activate", card: "arc_mage", abilityIndex: 0, mode: 0, targets: [{ object: "grizzly_bears" }] }, { player: 0, do: "discard", card: "forest" }],
    });
    await focus.game.runStep("MAIN1");
    expect(focus.graveyardCardIds(1)).toEqual(["grizzly_bears"]);
  });

  it("Altar of Dementia: X is the sacrificed creature's power at the moment of sacrifice — a resolved Giant Growth counts; a Growth still on the stack does not (LKI at payment; the Growth fizzles)", async () => {
    const pumped = new TestGame({
      name: "altar-pumped",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["altar_of_dementia", "grizzly_bears", "forest"], hand: ["giant_growth"] },
        { library: ["island", "island", "island", "island", "island", "island", "island", "island"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "giant_growth", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "pass" }, // P0 lets the Growth resolve (P1's lone pass is auto-taken — the S26 harness lesson)
        { player: 0, do: "activate", card: "altar_of_dementia", abilityIndex: 0, targets: [{ player: 1 }] },
      ],
    });
    const libBefore = pumped.game.state.players[1].library.length;
    await pumped.game.runStep("MAIN1");
    expect(pumped.game.state.players[1].library.length).toBe(libBefore - 5); // 2 + 3
    expect(pumped.graveyardCardIds(0)).toContain("grizzly_bears");
    const inResponse = new TestGame({
      name: "altar-in-response",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["altar_of_dementia", "grizzly_bears", "forest"], hand: ["giant_growth"] },
        { library: ["island", "island", "island", "island", "island", "island", "island", "island"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "giant_growth", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "activate", card: "altar_of_dementia", abilityIndex: 0, targets: [{ player: 1 }] }, // holding priority: the Bears go before the Growth resolves
      ],
    });
    const lib2 = inResponse.game.state.players[1].library.length;
    await inResponse.game.runStep("MAIN1");
    expect(inResponse.game.state.players[1].library.length).toBe(lib2 - 2); // the printed 2; the Growth fizzled
  });

  it("Hedron Crab: Evolving Wilds triggers twice (the Wilds, then the fetched basic); Rampant Growth's basic triggers too", async () => {
    const tg = new TestGame({
      name: "crab",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["hedron_crab", "forest", "forest"], hand: ["evolving_wilds", "rampant_growth"], library: ["island", "island", "forest", "forest"] },
        { library: Array.from({ length: 15 }, () => "swamp") },
      ] },
      script: [
        { player: 0, do: "playLand", card: "evolving_wilds" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] },
        { player: 0, do: "activate", card: "evolving_wilds", abilityIndex: 0 },
        { player: 0, do: "search", card: "island" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] },
        { player: 0, do: "cast", card: "rampant_growth" },
        { player: 0, do: "search", card: "forest" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[1].library.length).toBe(15 - 9);
    expect(bf(tg, 0)).toContain("island");
  });

  it("Soul Warden: gains on the opponent's creatures and on tokens", async () => {
    const tg = new TestGame({
      name: "soul-warden",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["soul_warden", "plains", "plains"], hand: ["raise_the_alarm"] },
        { battlefield: ["forest", "forest"], hand: ["grizzly_bears"] },
      ] },
      script: [{ player: 1, do: "cast", card: "grizzly_bears" }, { player: 0, do: "cast", card: "raise_the_alarm" }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[0].life).toBe(23); // their Bears +1; our two Soldier tokens +2
    expect(tg.game.state.players[1].life).toBe(20);
  });

  it("Blanchwood Armor counts every Forest we control — Temple Garden included", async () => {
    const tg = new TestGame({
      name: "blanchwood",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["gladecover_scout", { card: "blanchwood_armor", attachedTo: "gladecover_scout" }, "forest", "forest", "temple_garden", "plains"] },
        { battlefield: [] },
      ] },
      script: [],
    });
    const scout = tg.findBattlefield("gladecover_scout");
    const ch = characteristics(tg.game.ctx, scout);
    expect([ch.power, ch.toughness]).toEqual([4, 4]); // 1/1 + three Forests (the Plains is no Forest)
  });

  it("ADR-102 — the Altar loop: the Usher + Restoration Angel + Altar of Dementia, four iterations by script; the library and the life both move; the 'may' stops it; the Usher's delayed end-step sacrifice does not tangle", async () => {
    // P0: the Usher standing, the Altar, four Plains, Resto in hand. P1: 20 life, a 20-card library.
    // Request order per iteration (the harness binds only REAL requests — single-option picks are
    // silent): Resto's ETB stacks with its only legal target (the Usher) chosen silently; holding
    // priority, the Altar eats Resto (the sacrifice is a real choice: the Usher or Resto) — mill 3 and
    // the Usher's drain (target P1, silent); the blink then resolves and asks its "may"; the Usher
    // leaves and returns, its ETB returns Resto (the yard's only creature, silent), Resto's ETB stacks.
    // Each iteration opens with a PASS: it lets the pending spell or ETB resolve so Resto is on the
    // battlefield when the Altar asks (an activation with Resto still on the stack would find only
    // the Usher to sacrifice — a silent single-candidate pick).
    const iterate = (n: number) => Array.from({ length: n }, () => [
      { player: 0 as const, do: "pass" as const },
      { player: 0 as const, do: "activate" as const, card: "altar_of_dementia", abilityIndex: 0, targets: [{ player: 1 }] },
      { player: 0 as const, do: "sacrificeChoice" as const, card: "restoration_angel" },
      { player: 0 as const, do: "optional" as const, accept: true },
    ]).flat();
    const tg = new TestGame({
      name: "altar-loop",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["the_usher", "altar_of_dementia", "plains", "plains", "plains", "plains"], hand: ["restoration_angel"], library: Array.from({ length: 10 }, () => "plains") },
        { library: Array.from({ length: 20 }, () => "swamp") },
      ] },
      script: [
        { player: 0, do: "cast", card: "restoration_angel" },
        ...iterate(4),
        { player: 0, do: "optional", accept: false }, // the fifth Resto ETB: the "may" declines — the loop stops
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.players[1].library.length).toBe(20 - 12);
    expect(tg.game.state.players[1].life).toBe(20 - 8);
    expect(tg.game.state.players[0].life).toBe(20 + 8);
    expect(bf(tg, 0)).toContain("the_usher");
    expect(bf(tg, 0)).toContain("restoration_angel"); // the last-returned Resto stands (temporary)
    // The end step: the temporary Resto is sacrificed (the Usher's package) — one more drain, no tangle.
    await tg.game.runStep("END");
    expect(bf(tg, 0)).not.toContain("restoration_angel");
    expect(tg.game.state.players[1].life).toBe(20 - 10);
  });

  it("the Chronicle's fifth-cutting line counts colours, not cuttings (S29 Part 0)", () => {
    const heart = (JSON.parse(readFileSync(join(ROOT, "data/world/quests.json"), "utf8")) as { heart: { fifthCutting: string } }).heart;
    expect(heart.fifthCutting.startsWith("A cutting from every colour.")).toBe(true);
    expect(heart.fifthCutting).not.toMatch(/Five cuttings/);
  });
});
