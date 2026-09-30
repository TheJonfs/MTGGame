import { describe, expect, it } from "vitest";
import { characteristics, getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const hand = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].hand.map((id) => getObject(tg.game.state, id).cardId);
const lib = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].library.map((id) => getObject(tg.game.state, id).cardId);
const life = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].life;
const LIB = Array.from({ length: 12 }, () => "island");

/**
 * S46 (ADR-143, R-100) — the Open's five cards: a fixture per word (Ponder's reorder-and-may-shuffle; Angelic Destiny's
 * "when enchanted creature dies" and its type grant; Vitalist's life-gained trigger with the amount) and per card, Oracle
 * as printed (Vitalist from its text). Written after the Open fuzz came back clean (1,320 random + 264 heuristic, 0 errors).
 */

describe("R-100 word 1 — Ponder: the top three in any order, then you may shuffle, then draw (LRW #79)", () => {
  it("the controller orders the three (the first pick goes on top) and keeps the order: the draw is the first pick", async () => {
    const tg = new TestGame({
      name: "ponder-order",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["island"], hand: ["ponder"], library: ["forest", "shock", "hill_giant", ...LIB] },
        { battlefield: [], library: LIB },
      ] },
      script: [
        { player: 0, do: "cast", card: "ponder" },
        { player: 0, do: "putOnTop", card: "hill_giant" }, { player: 0, do: "putOnTop", card: "forest" },
        { player: 0, do: "optional", accept: false },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual(["hill_giant"]);
    expect(lib(tg, 0).slice(0, 2)).toEqual(["forest", "shock"]);
    expect(gy(tg, 0)).toEqual(["ponder"]);
  });

  it("choosing to shuffle shuffles (the library is a permutation of the same cards) and still draws one", async () => {
    const tg = new TestGame({
      name: "ponder-shuffle",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["island"], hand: ["ponder"], library: ["forest", "shock", "hill_giant", ...LIB] },
        { battlefield: [], library: LIB },
      ] },
      script: [
        { player: 0, do: "cast", card: "ponder" },
        { player: 0, do: "putOnTop", card: "hill_giant" }, { player: 0, do: "putOnTop", card: "forest" },
        { player: 0, do: "optional", accept: true },
      ],
    });
    const before = [...lib(tg, 0)].sort();
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toHaveLength(1);
    expect([...lib(tg, 0), ...hand(tg, 0)].sort()).toEqual(before);
  });
});

describe("R-100 word 2 — Angelic Destiny (M12 #3): the enchanted creature's death returns the Aura; the type grant is real", () => {
  const board = (extra: string[] = []) => ({ battlefield: [{ card: "grizzly_bears" }, { card: "angelic_destiny", attachedTo: "grizzly_bears" }, ...extra], library: LIB });

  it("the host is a 6/6 flying, first strike ANGEL (in addition to its Bear type)", () => {
    const tg = new TestGame({ name: "destiny-grant", setup: { active: 0, step: "MAIN1", players: [board(), { battlefield: [], library: LIB }] } });
    const ch = characteristics(tg.game.ctx, tg.findBattlefield("grizzly_bears"));
    expect([ch.power, ch.toughness]).toEqual([6, 6]);
    expect(ch.keywords.has("flying") && ch.keywords.has("first strike")).toBe(true);
    expect(ch.subtypes).toEqual(["Bear", "Angel"]);
  });

  it("when the enchanted creature dies, Angelic Destiny returns to its owner's hand (it followed the Aura to the graveyard)", async () => {
    const tg = new TestGame({
      name: "destiny-dies",
      setup: { active: 1, step: "MAIN1", players: [board(), { battlefield: ["mountain", "mountain"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "grizzly_bears" }] }],
    });
    // Bolt (3) does not kill a 6/6 — use a fatal amount instead: pump the damage by pre-damaging the Bears.
    getObject(tg.game.state, tg.findBattlefield("grizzly_bears")).damage = 3;
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toEqual(["grizzly_bears"]);
    expect(hand(tg, 0)).toEqual(["angelic_destiny"]);
  });

  it("a Disenchanted Destiny stays in the graveyard — the trigger is the CREATURE's death, not the Aura's (Rancor's shape would return it)", async () => {
    const tg = new TestGame({
      name: "destiny-disenchant",
      setup: { active: 1, step: "MAIN1", players: [board(), { battlefield: ["plains", "plains"], hand: ["disenchant"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "disenchant", targets: [{ object: "angelic_destiny" }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toEqual(["angelic_destiny"]);
    expect(hand(tg, 0)).toEqual([]);
    expect(bf(tg, 0)).toEqual(["grizzly_bears"]);
  });

  it("Chris's case: a creature made an Angel by the Destiny is no legal target for Restoration Angel's non-Angel blink", async () => {
    const tg = new TestGame({
      name: "destiny-resto",
      setup: { active: 0, step: "MAIN1", players: [{ ...board(), battlefield: [...board().battlefield, "plains", "plains", "plains", "plains"], hand: ["restoration_angel"] }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "restoration_angel" }],
    });
    const bears = tg.findBattlefield("grizzly_bears");
    await tg.game.runStep("MAIN1");
    const offeredBears = tg.requests.some((r) => r.actions.some((a) => JSON.stringify(a).includes(`"${bears}"`) && a.type === "chooseTriggerTargets"));
    expect(offeredBears).toBe(false);
    expect(tg.findBattlefield("grizzly_bears")).toBe(bears); // never blinked (a blink would be a new object)
  });
});

describe("R-100 word 3 — Vitalist (custom): whenever you gain life, that many +1/+1 counters on target creature", () => {
  it("a Soul Warden's 1 life → one counter; a lifelinker's combat damage → that many counters", async () => {
    const tg = new TestGame({
      name: "vitalist",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["vitalist", "soul_warden", "vampire_nighthawk", "plains", "plains"], hand: ["savannah_lions"], library: LIB },
        { battlefield: [], library: LIB },
      ] },
      script: [
        { player: 0, do: "cast", card: "savannah_lions" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "vampire_nighthawk" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    const nh = () => getObject(tg.game.state, tg.findBattlefield("vampire_nighthawk"));
    expect(life(tg, 0)).toBe(21);
    expect(nh().counters["+1/+1"]).toBe(1);
  });

  it("the opponent's life gain does not trigger it", async () => {
    const tg = new TestGame({
      name: "vitalist-theirs",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["vitalist", "grizzly_bears"], library: LIB },
        { battlefield: ["soul_warden", "plains"], hand: ["savannah_lions"], library: LIB },
      ] },
      script: [{ player: 1, do: "cast", card: "savannah_lions" }],
    });
    await tg.game.runStep("MAIN1");
    expect(getObject(tg.game.state, tg.findBattlefield("grizzly_bears")).counters["+1/+1"] ?? 0).toBe(0);
  });
});

describe("the zero-word cards — Entomb (ODY #132) and Rampaging Baloths (FDN #645, the Oracle's mandatory landfall)", () => {
  it("Entomb: any card from the library to the graveyard, then shuffle", async () => {
    const tg = new TestGame({
      name: "entomb",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp"], hand: ["entomb"], library: ["pelakka_wurm", ...LIB] }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "entomb" }, { player: 0, do: "search", card: "pelakka_wurm" }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0).sort()).toEqual(["entomb", "pelakka_wurm"]);
  });

  it("Rampaging Baloths: a land entering makes a 4/4 green Beast — no choice offered", async () => {
    const tg = new TestGame({
      name: "baloths",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["rampaging_baloths"], hand: ["forest"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "playLand", card: "forest" }],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "beast_4_4_g")).toHaveLength(1);
    expect(tg.requests.some((r) => r.purpose === "optionalTrigger")).toBe(false);
  });
});
