import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const lib = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].library.length;
const LIB = Array.from({ length: 20 }, () => "island");

/**
 * S73 (Part 0; R-097 amended) — `sourcePower` reads last-known information, as `sourceToughness` does (R-133): live while
 * the source is on the battlefield; once it has left, the power it had as it left (CR 608.2h, the reading verified for
 * R-133 against the CR of 2026-11-06; CR 113.7a — an ability on the stack exists independently of its source). Before
 * S73 a source that had left read 0. The census: two cards read `sourcePower` — Notion Flayer and Odile, the Tallyflame.
 */
describe("sourcePower with last-known information (R-097, S73)", () => {
  it("Notion Flayer attacks: the defending player mills its power, two", async () => {
    const tg = new TestGame({ name: "flayer", setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["notion_flayer"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["notion_flayer"] }] });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(lib(tg, 1)).toBe(18);
  });
  it("killed in response to its attack trigger, the Flayer still mills its last-known two (it read 0 before S73)", async () => {
    const tg = new TestGame({ name: "flayer-lki", setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["notion_flayer"], library: LIB }, { battlefield: ["mountain"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["notion_flayer"] }, { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "notion_flayer" }] }] });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(gy(tg, 0)).toContain("notion_flayer");
    expect(lib(tg, 1)).toBe(18);
  });
  it("the last-known power is the power it left with: a Flayer with a +1/+1 counter, killed in response, mills three", async () => {
    const tg = new TestGame({ name: "flayer-lki-pumped", setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["notion_flayer"], library: LIB }, { battlefield: ["mountain"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["notion_flayer"] }, { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "notion_flayer" }] }] });
    getObject(tg.game.state, tg.findBattlefield("notion_flayer")).counters["+1/+1"] = 1;
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(gy(tg, 0)).toContain("notion_flayer");
    expect(lib(tg, 1)).toBe(17);
  });
  it("Odile destroyed in response to her draw trigger: the trigger still deals her last-known one to each tapped creature", async () => {
    const tg = new TestGame({ name: "odile-lki", setup: { active: 0, step: "DRAW", turn: 4, players: [
      { battlefield: ["odile_the_tallyflame"], library: LIB },
      { battlefield: ["swamp", "swamp", { card: "savannah_lions", tapped: true }, { card: "hill_giant", tapped: true }, "gray_ogre"], hand: ["doom_blade"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "doom_blade", targets: [{ object: "odile_the_tallyflame" }] }] });
    await tg.game.runStep("DRAW");
    expect(gy(tg, 0)).toContain("odile_the_tallyflame");
    expect(gy(tg, 1)).toContain("savannah_lions"); // one damage: the X/1 dies
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).damage).toBe(1);
    expect(getObject(tg.game.state, tg.findBattlefield("gray_ogre")).damage).toBe(0); // untapped
  });
  it("the record does not outlive the stack: once it is empty the last-known table is cleared", async () => {
    const tg = new TestGame({ name: "flayer-clear", setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["notion_flayer"], library: LIB }, { battlefield: ["mountain"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["notion_flayer"] }, { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "notion_flayer" }] }] });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(tg.game.state.lastKnownPT).toBeUndefined();
  });
});
