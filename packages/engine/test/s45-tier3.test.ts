import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { TestGame } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const hand = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].hand.map((id) => getObject(tg.game.state, id).cardId);
const life = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].life;
const LIB = Array.from({ length: 20 }, () => "island");

/**
 * S45 (ADR-140, R-099) — the tier-3 round: a fixture per word (damage to each opponent, the whole-hand discard, the
 * Swamp-filtered landfall, the untap in another player's untap step) and per card, Oracle as printed (Tidewall as its
 * text). Written after the random (2,640 games) and heuristic (1,320) expansion fuzz came back clean.
 */

describe("R-099 word 1 — damage to each opponent (Guttersnipe, RVR #332)", () => {
  it("an instant or sorcery cast deals 2 to the opponent (no target); a creature spell does not; the trigger resolves above the spell", async () => {
    const tg = new TestGame({
      name: "guttersnipe",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["guttersnipe", "mountain", "mountain", "mountain"], hand: ["shock", "goblin_piker"], library: LIB },
        { life: 20, battlefield: ["grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "cast", card: "shock", targets: [{ object: "grizzly_bears" }] }, { player: 0, do: "cast", card: "goblin_piker" }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["grizzly_bears"]); // the Shock resolved
    expect(life(tg, 1)).toBe(18); // Guttersnipe's 2 — once, for the Shock; the Piker cast nothing
    expect(bf(tg, 0)).toContain("goblin_piker");
  });
});

describe("R-099 word 2 — the whole-hand discard (Dragon Mage, SCG #87)", () => {
  it("combat damage to a player: EACH player discards their whole hand, then draws seven", async () => {
    const tg = new TestGame({
      name: "dragon-mage",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["dragon_mage"], hand: ["shock", "forest"], library: LIB },
        { battlefield: [], hand: ["grizzly_bears", "hill_giant", "swamp"], library: LIB },
      ] },
      script: [{ player: 0, do: "attack", attackers: ["dragon_mage"] }],
    });
    for (const s of ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE"] as const) await tg.game.runStep(s);
    expect(life(tg, 1)).toBe(15);
    expect(gy(tg, 0).sort()).toEqual(["forest", "shock"]);
    expect(gy(tg, 1).sort()).toEqual(["grizzly_bears", "hill_giant", "swamp"]);
    expect(hand(tg, 0)).toHaveLength(7);
    expect(hand(tg, 1)).toHaveLength(7);
  });

  it("blocked, it deals no damage to a player: no wheel", async () => {
    const tg = new TestGame({
      name: "dragon-mage-blocked",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["dragon_mage"], hand: ["shock"], library: LIB },
        { battlefield: ["wall_of_air"], hand: ["grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "attack", attackers: ["dragon_mage"] }, { player: 1, do: "block", blocks: [{ blocker: "wall_of_air", attacker: "dragon_mage" }] }],
    });
    for (const s of ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE"] as const) await tg.game.runStep(s);
    expect(hand(tg, 0)).toEqual(["shock"]);
    expect(hand(tg, 1)).toEqual(["grizzly_bears"]);
  });
});

describe("R-099 word 3 — landfall filtered by subtype (Dread Presence, M20 #96)", () => {
  it("a Swamp entering: choose one — draw a card and lose 1 life", async () => {
    const tg = new TestGame({
      name: "dread-draw",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["dread_presence"], hand: ["swamp"], library: LIB },
        { life: 20, battlefield: [], library: LIB },
      ] },
      script: [{ player: 0, do: "playLand", card: "swamp" }, { player: 0, do: "chooseMode", mode: 0 }],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual(["island"]);
    expect(life(tg, 0)).toBe(19);
  });

  it("a DUAL with the Swamp type counts (Underground Sea): 2 damage to any target and you gain 2", async () => {
    const tg = new TestGame({
      name: "dread-damage",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["dread_presence"], hand: ["underground_sea"], library: LIB },
        { life: 20, battlefield: ["grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "playLand", card: "underground_sea" }, { player: 0, do: "chooseMode", mode: 1 }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["grizzly_bears"]);
    expect(life(tg, 0)).toBe(22);
  });

  it("a land without the Swamp type (an Island) triggers nothing", async () => {
    const tg = new TestGame({
      name: "dread-island",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["dread_presence"], hand: ["island"], library: LIB },
        { life: 20, battlefield: [], library: LIB },
      ] },
      script: [{ player: 0, do: "playLand", card: "island" }],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual([]);
    expect(life(tg, 0)).toBe(20);
    expect(tg.requests.some((r) => r.purpose === "chooseMode")).toBe(false);
  });
});

describe("R-099 word 4 — the untap in another player's untap step (Seedborn Muse, LGN #138)", () => {
  it("the Muse's controller untaps everything during the OPPONENT's untap step; the active player untaps as usual; without the Muse nothing of theirs untaps", async () => {
    const setup = (withMuse: boolean) => new TestGame({
      name: "seedborn",
      setup: { active: 0, step: "UNTAP", players: [
        { battlefield: [{ card: "hill_giant", tapped: true }, { card: "mountain", tapped: true }], library: LIB },
        { battlefield: [...(withMuse ? ["seedborn_muse"] : []), { card: "grizzly_bears", tapped: true }, { card: "forest", tapped: true }], library: LIB },
      ] },
    });
    const tapped = (tg: TestGame, card: string) => getObject(tg.game.state, tg.findBattlefield(card)).tapped;
    const on = setup(true);
    await on.game.runStep("UNTAP");
    expect([tapped(on, "hill_giant"), tapped(on, "mountain")]).toEqual([false, false]);
    expect([tapped(on, "grizzly_bears"), tapped(on, "forest")]).toEqual([false, false]);
    const off = setup(false);
    await off.game.runStep("UNTAP");
    expect([tapped(off, "grizzly_bears"), tapped(off, "forest")]).toEqual([true, true]);
  });
});

describe("the zero-word cards — Emeria Angel (ZEN #11) and Tidewall (custom)", () => {
  it("Emeria Angel: a land you control entering MAY make a 1/1 white flying Bird — accepted, a Bird; declined, none", async () => {
    for (const accept of [true, false]) {
      const tg = new TestGame({
        name: `emeria-${accept}`,
        setup: { active: 0, step: "MAIN1", players: [
          { battlefield: ["emeria_angel"], hand: ["plains"], library: LIB },
          { battlefield: [], library: LIB },
        ] },
        script: [{ player: 0, do: "playLand", card: "plains" }, { player: 0, do: "optional", accept }],
      });
      await tg.game.runStep("MAIN1");
      expect(bf(tg, 0).filter((c) => c === "bird_1_1_flying").length, String(accept)).toBe(accept ? 1 : 0);
    }
  });

  it("Tidewall: blocking returns an instant or sorcery card from your graveyard to your hand; 0 power, 4 toughness — the 3/3 is stopped, not killed", async () => {
    const tg = new TestGame({
      name: "tidewall",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["hill_giant"], library: LIB },
        { battlefield: ["tidewall"], graveyard: ["counterspell", "grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "attack", attackers: ["hill_giant"] }, { player: 1, do: "block", blocks: [{ blocker: "tidewall", attacker: "hill_giant" }] }],
    });
    for (const s of ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE"] as const) await tg.game.runStep(s);
    expect(hand(tg, 1)).toEqual(["counterspell"]); // the only instant or sorcery — the creature card stays
    expect(gy(tg, 1)).toEqual(["grizzly_bears"]);
    expect(bf(tg, 1)).toEqual(["tidewall"]);
    expect(bf(tg, 0)).toEqual(["hill_giant"]);
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).damage).toBe(0);
  });

  it("Tidewall: with no instant or sorcery in the graveyard the trigger has no target and does nothing (no error)", async () => {
    const tg = new TestGame({
      name: "tidewall-empty",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["hill_giant"], library: LIB },
        { battlefield: ["tidewall"], graveyard: ["grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "attack", attackers: ["hill_giant"] }, { player: 1, do: "block", blocks: [{ blocker: "tidewall", attacker: "hill_giant" }] }],
    });
    for (const s of ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE"] as const) await tg.game.runStep(s);
    expect(hand(tg, 1)).toEqual([]);
    expect(gy(tg, 1)).toEqual(["grizzly_bears"]);
  });
});
