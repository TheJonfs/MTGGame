import { describe, expect, it } from "vitest";
import { getObject, legalActions, characteristics } from "../src/index.js";
import { TestGame, runFixture } from "./harness.js";

type TG = Awaited<ReturnType<typeof runFixture>>;
const gy = (tg: TG, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TG, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const hand = (tg: TG, p: 0 | 1) => tg.game.state.players[p].hand.map((id) => getObject(tg.game.state, id).cardId);
const events = (tg: TG, name: string) => tg.log.entries.filter((e): e is Extract<typeof e, { t: "EVENT" }> => e.t === "EVENT" && e.name === name);

describe("S36 — Thawing Glaciers (R-096 word 1: the cleanup return; the tapped basic fetch)", () => {
  it("the fetch puts the basic in tapped and a Crab sees it; the Glaciers cannot fetch twice in a turn; it returns to hand at cleanup, is the land drop again next turn, enters tapped, and so cannot fetch the turn it lands", async () => {
    const tg = new TestGame({
      name: "glaciers",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["hedron_crab", "island", "island", "thawing_glaciers"], hand: [], library: ["forest", "island", "island", "island", "island"] },
        { battlefield: ["mountain"], library: ["mountain", "mountain", "mountain", "mountain", "mountain", "mountain"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "thawing_glaciers", abilityIndex: 0 },
        { player: 0, do: "search", card: "forest" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] }, // the Crab's landfall on the Forest
        { player: 0, do: "playLand", card: "thawing_glaciers" }, // next turn (after the cleanup return)
      ],
    });
    // The harness taps an enters-tapped land at setup too; this Glaciers has been out since last turn.
    getObject(tg.game.state, tg.findBattlefield("thawing_glaciers")).tapped = false;
    await tg.game.runStep("MAIN1");
    const gl = tg.findBattlefield("thawing_glaciers");
    expect(getObject(tg.game.state, gl).tapped).toBe(true); // tapped for the fetch
    const forest = tg.findBattlefield("forest");
    expect(getObject(tg.game.state, forest).tapped).toBe(true); // "put that card onto the battlefield tapped"
    expect(gy(tg, 1)).toHaveLength(3); // the Crab milled three on the Forest
    expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && a.objectId === gl)).toBe(false); // tapped: no second fetch
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    expect(hand(tg, 0)).toEqual(["thawing_glaciers"]);
    expect(bf(tg, 0)).not.toContain("thawing_glaciers");
    expect(bf(tg, 0)).toContain("forest");
    // The next turn: a land drop again — it enters tapped, so it cannot fetch the turn it lands.
    tg.game.state.players[0].landsPlayedThisTurn = 0;
    await tg.game.runStep("MAIN1");
    const again = tg.findBattlefield("thawing_glaciers");
    expect(getObject(tg.game.state, again).tapped).toBe(true);
    expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && a.objectId === again)).toBe(false);
  });
});

describe("S36 — Library of Alexandria (R-096 word 2: the hand-size activation condition)", () => {
  const withHand = (n: number) => new TestGame({
    name: `library-${n}`,
    setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["library_of_alexandria"], hand: Array.from({ length: n }, () => "island"), library: ["island", "island"] }, { battlefield: ["mountain"] }] },
  });
  it("no draw at six or eight; the draw at exactly seven; the colourless tap is always there", () => {
    for (const n of [6, 8]) {
      const tg = withHand(n);
      const lib = tg.findBattlefield("library_of_alexandria");
      const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility" && a.objectId === lib);
      expect(acts.map((a) => (a as { abilityIndex: number }).abilityIndex)).toEqual([]); // the draw is index 1; the mana ability (index 0) is not enumerated as a priority action
      expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "tapForMana" && a.objectId === lib)).toBe(true);
    }
    const seven = withHand(7);
    const lib = seven.findBattlefield("library_of_alexandria");
    expect(legalActions(seven.game.ctx, 0).some((a) => a.type === "activateAbility" && a.objectId === lib && (a as { abilityIndex: number }).abilityIndex === 1)).toBe(true);
  });
  it("the draw resolves at seven (eight after) and is not offered again", async () => {
    const tg = new TestGame({
      name: "library-draw",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["library_of_alexandria"], hand: Array.from({ length: 7 }, () => "island"), library: ["forest", "island"] }, { battlefield: ["mountain"] }] },
      script: [{ player: 0, do: "activate", card: "library_of_alexandria", abilityIndex: 1 }],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toHaveLength(8);
    expect(hand(tg, 0)).toContain("forest");
  });
});

describe("S36 — Arcane Collector (R-096 words 3–4: name a card, reveal at random)", () => {
  it("the name is chosen among the hand's distinct names, the reveal is logged and the card stays in hand; a miss draws nothing", async () => {
    const tg = new TestGame({
      name: "collector-miss",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["arcane_collector", "island", "island"], hand: ["hedron_crab", "island", "traumatizer"], library: ["forest", "forest", "forest"] }, { battlefield: ["mountain"] }] },
      script: [{ player: 0, do: "activate", card: "arcane_collector", abilityIndex: 0 }, { player: 0, do: "nameCard", card: "hedron_crab" }],
    });
    await tg.game.runStep("MAIN1");
    const rev = events(tg, "REVEALED");
    expect(rev).toHaveLength(1);
    const p = rev[0]!.payload as { cardId: string; named: string; hit: boolean };
    expect(p.named).toBe("Hedron Crab");
    expect(hand(tg, 0)).toHaveLength(p.hit ? 5 : 3); // the revealed card stays; a hit draws two
    expect(tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "nameCard")).toHaveLength(1);
  });
  it("one card in hand: the name is forced (unlogged) and it hits every time — two cards drawn", async () => {
    const tg = new TestGame({
      name: "collector-hit",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["arcane_collector", "island", "island"], hand: ["hedron_crab"], library: ["forest", "forest", "forest"] }, { battlefield: ["mountain"] }] },
      script: [{ player: 0, do: "activate", card: "arcane_collector", abilityIndex: 0 }],
    });
    await tg.game.runStep("MAIN1");
    expect((events(tg, "REVEALED")[0]!.payload as { hit: boolean }).hit).toBe(true);
    expect(hand(tg, 0)).toEqual(["hedron_crab", "forest", "forest"]);
    expect(tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "nameCard")).toHaveLength(0);
  });
});

describe("S36 — Angel of the Ruins (plainscycling; the up-to-two exile)", () => {
  it("plainscycling fetches a Godless Shrine to hand (revealed)", async () => {
    const tg = new TestGame({
      name: "angel-cycle",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["plains", "plains"], hand: ["angel_of_the_ruins"], library: ["swamp", "godless_shrine", "swamp"] }, { battlefield: ["mountain"] }] },
      script: [{ player: 0, do: "activate", card: "angel_of_the_ruins", abilityIndex: 1 }, { player: 0, do: "search", card: "godless_shrine" }],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual(["godless_shrine"]);
    expect(gy(tg, 0)).toContain("angel_of_the_ruins");
    expect(events(tg, "SEARCH_REVEAL")).toHaveLength(1);
  });
  it("the ETB exiles a law token and an opposing Control Magic (our creature comes home); choosing zero targets resolves; Disenchant destroys the artifact creature", async () => {
    const tg = new TestGame({
      name: "angel-etb",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["plains", "plains", "plains", "plains", "plains", "plains", "plains", "serra_angel"], hand: ["angel_of_the_ruins"] },
        { battlefield: ["mountain", "plains", "plains", { card: "law_intake", token: true }, "control_magic"], hand: ["disenchant"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "angel_of_the_ruins" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "law_intake" }, { object: "control_magic" }] },
      ],
    });
    // Attach the opponent's Control Magic to our Serra before the script runs.
    const cm = tg.findBattlefield("control_magic"), serra = tg.findBattlefield("serra_angel");
    getObject(tg.game.state, cm).attachedTo = serra;
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 1)).not.toContain("law_intake");
    expect(bf(tg, 1)).not.toContain("control_magic");
    expect(bf(tg, 0)).toContain("serra_angel");
    expect(bf(tg, 0)).toContain("angel_of_the_ruins");
    const zero = new TestGame({
      name: "angel-zero",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["plains", "plains", "plains", "plains", "plains", "plains", "plains"], hand: ["angel_of_the_ruins"] }, { battlefield: ["mountain", "plains", "plains", "glorious_anthem"], hand: ["disenchant"] }] },
      script: [{ player: 0, do: "cast", card: "angel_of_the_ruins" }, { player: 1, do: "pass" }, { player: 0, do: "chooseTriggerTargets", targets: [] }, { player: 1, do: "cast", card: "disenchant", targets: [{ object: "angel_of_the_ruins" }] }],
    });
    await zero.game.runStep("MAIN1");
    expect(bf(zero, 1)).toContain("glorious_anthem");
    expect(gy(zero, 0)).toContain("angel_of_the_ruins");
  });
});
