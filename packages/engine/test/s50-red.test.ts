import { describe, expect, it } from "vitest";
import { characteristics, getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const hand = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].hand.map((id) => getObject(tg.game.state, id).cardId);
const life = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].life;
const LIB = Array.from({ length: 12 }, () => "mountain");
const M = (n: number) => Array.from({ length: n }, () => "mountain");

/**
 * S50 (ADR-149, R-102) — red for Limited: a fixture per card, Oracle as verified on Scryfall (2026-10-03). Written
 * after the fuzz came back clean (960 random + 320 heuristic games over two mixed lists, 0 errors).
 */
describe("Flametongue Kavu (PLS #60): when it enters, 4 damage to target creature — mandatory", () => {
  it("kills a 3/3 across the table", async () => {
    const tg = new TestGame({ name: "ftk", setup: { active: 0, step: "MAIN1", players: [{ battlefield: M(4), hand: ["flametongue_kavu"], library: LIB }, { battlefield: ["hill_giant"], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "flametongue_kavu" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "hill_giant" }] }] });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["hill_giant"]);
    expect(bf(tg, 0)).toContain("flametongue_kavu");
  });

  it("with no other creature on the battlefield it must target itself, and dies (CR 603.3d: a target is chosen if one can be)", async () => {
    const tg = new TestGame({ name: "ftk-alone", setup: { active: 0, step: "MAIN1", players: [{ battlefield: M(4), hand: ["flametongue_kavu"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "flametongue_kavu" }] });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toEqual(["flametongue_kavu"]);
    expect(bf(tg, 0)).not.toContain("flametongue_kavu");
  });

  it("with only our own creature beside it, ours or the Kavu takes the four — never nothing", async () => {
    const tg = new TestGame({ name: "ftk-ours", setup: { active: 0, step: "MAIN1", players: [{ battlefield: [...M(4), "grizzly_bears"], hand: ["flametongue_kavu"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "flametongue_kavu" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] }] });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toEqual(["grizzly_bears"]);
  });
});

describe("Furnace Whelp (5DN #65): flying; {R}: +1/+0 until end of turn", () => {
  it("each activation is +1/+0, and the turn's end takes them back", async () => {
    const tg = new TestGame({ name: "whelp", setup: { active: 0, step: "MAIN1", players: [{ battlefield: [...M(3), "furnace_whelp"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "activate", card: "furnace_whelp", abilityIndex: 0 }, { player: 0, do: "activate", card: "furnace_whelp", abilityIndex: 0 }] });
    await tg.game.runStep("MAIN1");
    const ch = () => characteristics(tg.game.ctx, tg.findBattlefield("furnace_whelp"));
    expect([ch().power, ch().toughness, ch().keywords.has("flying")]).toEqual([4, 2, true]);
    await tg.game.runStep("CLEANUP");
    expect([ch().power, ch().toughness]).toEqual([2, 2]);
  });
});

describe("Shocking Sharpshooter (TDM #121): reach; whenever another creature you control enters, 1 damage to the opponent", () => {
  it("each token of a Dragon Fodder is a creature entering — two pings; the Sharpshooter itself and the opponent's creatures are not", async () => {
    const tg = new TestGame({ name: "sharp", setup: { active: 0, step: "MAIN1", players: [{ battlefield: [...M(4), "shocking_sharpshooter"], hand: ["dragon_fodder", "shocking_sharpshooter"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "dragon_fodder" }, { player: 0, do: "cast", card: "shocking_sharpshooter" }] });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "goblin_1_1")).toHaveLength(2);
    expect(life(tg, 1)).toBe(20 - 2 - 1); // two Goblins, then the second Sharpshooter seen by the first (and not by itself)
    expect(life(tg, 0)).toBe(20);
    expect(characteristics(tg.game.ctx, tg.findBattlefield("shocking_sharpshooter")).keywords.has("reach")).toBe(true);
  });

  it("the opponent's creature entering does not trigger it", async () => {
    const tg = new TestGame({ name: "sharp-theirs", setup: { active: 1, step: "MAIN1", players: [{ battlefield: ["shocking_sharpshooter"], library: LIB }, { battlefield: M(2), hand: ["grizzly_bears"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "grizzly_bears" }] });
    await tg.game.runStep("MAIN1");
    expect([life(tg, 0), life(tg, 1)]).toEqual([20, 20]);
  });
});

describe("R-102 — Seasoned Pyromancer (MH1 #145): discard two, draw two, an Elemental for each NONLAND card discarded this way", () => {
  const board = (h: string[]) => ({ active: 0 as const, step: "MAIN1" as const, players: [{ battlefield: M(3), hand: ["seasoned_pyromancer", ...h], library: ["forest", "shock", ...LIB] }, { battlefield: [] as string[], library: LIB }] as [{ battlefield: string[]; hand: string[]; library: string[] }, { battlefield: string[]; library: string[] }] });
  it("a land and a spell discarded: one token; two cards drawn", async () => {
    const tg = new TestGame({ name: "pyro-1", setup: board(["mountain", "shock"]), script: [{ player: 0, do: "cast", card: "seasoned_pyromancer" }, { player: 0, do: "discard", card: "mountain" }] });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0).sort()).toEqual(["mountain", "shock"]);
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(1);
    expect(hand(tg, 0).sort()).toEqual(["forest", "shock"]);
  });
  it("two nonland cards: two tokens; two lands: none", async () => {
    const two = new TestGame({ name: "pyro-2", setup: board(["shock", "lightning_bolt"]), script: [{ player: 0, do: "cast", card: "seasoned_pyromancer" }, { player: 0, do: "discard", card: "shock" }] });
    await two.game.runStep("MAIN1");
    expect(bf(two, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(2);
    const none = new TestGame({ name: "pyro-0", setup: board(["mountain", "forest"]), script: [{ player: 0, do: "cast", card: "seasoned_pyromancer" }, { player: 0, do: "discard", card: "mountain" }] });
    await none.game.runStep("MAIN1");
    expect(bf(none, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(0);
    expect(gy(none, 0).sort()).toEqual(["forest", "mountain"]);
  });
  it("an empty hand: nothing discarded, two drawn, no token (CR 608.2: as much as possible)", async () => {
    const tg = new TestGame({ name: "pyro-empty", setup: board([]), script: [{ player: 0, do: "cast", card: "seasoned_pyromancer" }] });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toHaveLength(2);
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(0);
  });
  it("{3}{R}{R}, exile it from the graveyard: two Elementals (Mother Bear's word)", async () => {
    const tg = new TestGame({ name: "pyro-gy", setup: { active: 0, step: "MAIN1", players: [{ battlefield: M(5), graveyard: ["seasoned_pyromancer"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "activate", card: "seasoned_pyromancer", abilityIndex: 1 }] });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "elemental_1_1_r")).toHaveLength(2);
    expect(gy(tg, 0)).toEqual([]);
  });
});

describe("Rage Cobra (custom): whenever an OPPONENT gains life, that many +1/+1 counters on target creature", () => {
  it("the opponent's Soul Warden trigger feeds it; our own life gain does not", async () => {
    const tg = new TestGame({ name: "cobra", setup: { active: 1, step: "MAIN1", players: [{ battlefield: ["rage_cobra", "soul_warden"], library: LIB }, { battlefield: ["soul_warden", "plains"], hand: ["savannah_lions"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "savannah_lions" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "rage_cobra" }] }] });
    await tg.game.runStep("MAIN1");
    expect([life(tg, 0), life(tg, 1)]).toEqual([21, 21]); // both Wardens saw the Lions
    const cobra = getObject(tg.game.state, tg.findBattlefield("rage_cobra"));
    expect(cobra.counters["+1/+1"]).toBe(1); // their one life; our own one life is not an opponent's
    const ch = characteristics(tg.game.ctx, cobra.id);
    expect([ch.power, ch.toughness]).toEqual([2, 2]);
  });
});
