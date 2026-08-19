import { describe, expect, it } from "vitest";
import { parseManaCost } from "@shandalar/cards";
import { TestGame, type FixtureSpec } from "./harness.js";
import {
  autoPay,
  canPay,
  characteristics,
  getObject,
  legalActions,
  moveObject,
  runSBAs,
  targetCandidates,
} from "../src/index.js";

function board(setup: FixtureSpec["setup"]): TestGame {
  return new TestGame({ name: "unit", setup });
}

describe("zones / moveObject", () => {
  it("assigns a new object id on every zone change and fires ZONE_CHANGE", () => {
    const tg = board({ players: [{ hand: ["goblin_piker"] }, {}] });
    const ctx = tg.game.ctx;
    const oldId = tg.game.state.players[0].hand[0]!;
    const events: string[] = [];
    ctx.bus.on("ZONE_CHANGE", (e) => events.push(`${e.from}->${e.to}`));
    const newId = moveObject(ctx, oldId, "battlefield");
    expect(newId).not.toBe(oldId);
    expect(ctx.state.objects[oldId]).toBeUndefined();
    expect(getObject(ctx.state, newId!).zone).toBe("battlefield");
    expect(events).toEqual(["hand->battlefield"]);
  });

  it("strips battlefield state on leaving and detaches attachments", () => {
    const tg = board({
      players: [
        { battlefield: [{ card: "savannah_lions", tapped: true }] },
        { battlefield: [{ card: "pacifism", attachedTo: "savannah_lions" }] },
      ],
    });
    const ctx = tg.game.ctx;
    const lions = tg.findBattlefield("savannah_lions");
    getObject(ctx.state, lions).damage = 1;
    const inHand = moveObject(ctx, lions, "hand")!;
    const back = getObject(ctx.state, inHand);
    expect(back.tapped).toBe(false);
    expect(back.damage).toBe(0);
    const pacifism = tg.findBattlefield("pacifism");
    expect(getObject(ctx.state, pacifism).attachedTo).toBeNull();
  });

  it("creatures enter with summoning sickness", () => {
    const tg = board({ players: [{ hand: ["goblin_piker"] }, {}] });
    const id = moveObject(tg.game.ctx, tg.game.state.players[0].hand[0]!, "battlefield")!;
    expect(getObject(tg.game.state, id).summoningSick).toBe(true);
  });
});

describe("mana / auto-pay", () => {
  it("canPay accounts for floating mana plus untapped producers", () => {
    const tg = board({ players: [{ battlefield: ["mountain", "mountain", "island"] }, {}] });
    const ctx = tg.game.ctx;
    expect(canPay(ctx, 0, parseManaCost("{1}{R}"))).toBe(true);
    expect(canPay(ctx, 0, parseManaCost("{R}{R}"))).toBe(true);
    expect(canPay(ctx, 0, parseManaCost("{R}{R}{R}"))).toBe(false);
    expect(canPay(ctx, 0, parseManaCost("{2}{U}"))).toBe(true);
    expect(canPay(ctx, 0, parseManaCost("{U}{U}"))).toBe(false);
    expect(canPay(ctx, 0, parseManaCost("{4}"))).toBe(false);
  });

  it("autoPay taps deterministically and leaves the pool clean", () => {
    const tg = board({ players: [{ battlefield: ["mountain", "island", "mountain"] }, {}] });
    const ctx = tg.game.ctx;
    autoPay(ctx, 0, parseManaCost("{1}{R}"));
    const tapped = ctx.state.battlefield.filter((id) => getObject(ctx.state, id).tapped);
    expect(tapped).toHaveLength(2);
    const pool = ctx.state.players[0].manaPool;
    expect(Object.values(pool).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("SBAs", () => {
  it("toughness <= 0 goes to graveyard without damage", () => {
    const tg = board({ players: [{ battlefield: ["goblin_piker"] }, {}] });
    const ctx = tg.game.ctx;
    const piker = tg.findBattlefield("goblin_piker");
    ctx.state.continuousEffects.push({
      kind: "modifyPT",
      objectId: piker,
      power: 0,
      toughness: -1,
      duration: "UNTIL_END_OF_TURN",
      sourceStackItemId: "test",
      timestamp: 1,
    });
    runSBAs(ctx);
    expect(tg.graveyardCardIds(0)).toContain("goblin_piker");
  });

  it("an aura whose host left goes to the graveyard", () => {
    const tg = board({
      players: [
        { battlefield: ["savannah_lions"] },
        { battlefield: [{ card: "pacifism", attachedTo: "savannah_lions" }] },
      ],
    });
    const ctx = tg.game.ctx;
    moveObject(ctx, tg.findBattlefield("savannah_lions"), "hand");
    runSBAs(ctx);
    expect(tg.graveyardCardIds(1)).toContain("pacifism");
  });

  it("life <= 0 ends the game with the right winner", () => {
    const tg = board({ players: [{ life: 0 }, {}] });
    runSBAs(tg.game.ctx);
    expect(tg.game.state.result).toEqual({ winner: 1, reason: "LIFE" });
  });
});

describe("targeting", () => {
  it("anyTarget candidates include creatures and both players, deterministic order", () => {
    const tg = board({ players: [{ battlefield: ["goblin_piker"] }, { battlefield: ["wind_drake"] }] });
    const cands = targetCandidates(tg.game.ctx, { count: 1, predicate: "anyTarget", zone: "any" }, 0);
    expect(cands).toHaveLength(4); // two creatures + two players
    expect(cands.filter((c) => c.kind === "player")).toHaveLength(2);
  });
});

describe("continuous effects / characteristics", () => {
  it("Pacifism restricts via static 'attached' scope while on the battlefield", () => {
    const tg = board({
      players: [
        { battlefield: ["savannah_lions"] },
        { battlefield: [{ card: "pacifism", attachedTo: "savannah_lions" }] },
      ],
    });
    const ctx = tg.game.ctx;
    const lions = tg.findBattlefield("savannah_lions");
    expect(characteristics(ctx, lions).cantAttack).toBe(true);
    moveObject(ctx, tg.findBattlefield("pacifism"), "graveyard");
    expect(characteristics(ctx, lions).cantAttack).toBe(false);
  });
});

describe("legal-action enumerator", () => {
  it("pass is always first; casts require timing, mana, and targets", () => {
    const tg = board({ players: [{ battlefield: ["mountain"], hand: ["lightning_bolt", "hill_giant"] }, {}] });
    const ctx = tg.game.ctx;
    const actions = legalActions(ctx, 0);
    expect(actions[0]).toEqual({ type: "pass" });
    // Bolt castable ({R} coverable), targeting either player.
    const bolts = actions.filter((a) => a.type === "castSpell" && getObject(ctx.state, a.objectId).cardId === "lightning_bolt");
    expect(bolts).toHaveLength(2);
    // Hill Giant not castable: {3}{R} with one Mountain.
    const giants = actions.filter((a) => a.type === "castSpell" && getObject(ctx.state, a.objectId).cardId === "hill_giant");
    expect(giants).toHaveLength(0);
  });

  it("sorcery-speed spells are excluded outside the controller's main phase", () => {
    const tg = board({
      step: "END",
      players: [{ battlefield: ["island", "island", "island"], hand: ["divination", "counterspell"] }, {}],
    });
    const ctx = tg.game.ctx;
    const actions = legalActions(ctx, 0);
    expect(actions.some((a) => a.type === "castSpell" && getObject(ctx.state, a.objectId).cardId === "divination")).toBe(false);
    // Counterspell needs a spell target; none on the stack, so no cast either.
    expect(actions.some((a) => a.type === "castSpell")).toBe(false);
  });

  it("dedupes by cardId in hand only — battlefield objects each get their own action (R-029)", () => {
    const tg = board({
      players: [{ battlefield: ["mountain", "mountain"], hand: ["lightning_bolt", "lightning_bolt"] }, {}],
    });
    const actions = legalActions(tg.game.ctx, 0);
    // Two identical hand cards: one castSpell action set.
    expect(actions.filter((a) => a.type === "castSpell" && a.targets[0]?.kind === "player" && a.targets[0].player === 1)).toHaveLength(1);
    // Two identical battlefield lands: two distinct tapForMana actions.
    expect(actions.filter((a) => a.type === "tapForMana")).toHaveLength(2);
  });

  it("lands can only be played at sorcery speed, one per turn", () => {
    const tg = board({ players: [{ hand: ["mountain", "mountain"] }, {}] });
    const ctx = tg.game.ctx;
    expect(legalActions(ctx, 0).filter((a) => a.type === "playLand")).toHaveLength(1);
    ctx.state.players[0].landsPlayedThisTurn = 1;
    expect(legalActions(ctx, 0).filter((a) => a.type === "playLand")).toHaveLength(0);
  });
});
