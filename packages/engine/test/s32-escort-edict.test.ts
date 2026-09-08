import { describe, expect, it } from "vitest";
import { getObject, legalActions, characteristics } from "../src/index.js";
import { TestGame, runFixture } from "./harness.js";

type TG = Awaited<ReturnType<typeof runFixture>>;
const gy = (tg: TG, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TG, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);

describe("S32 Part 1 — Plumecreed Escort ({1}{U} 2/1 flash, flying; ETB: target creature you control gains hexproof until end of turn) — zero words", () => {
  it("the save: their Bolt at our Crab — the Escort flashes in targeting the Crab, resolves first, the Bolt fizzles", async () => {
    const tg = new TestGame({
      name: "escort-save",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["hedron_crab", "island", "island"], hand: ["plumecreed_escort"] },
        { battlefield: ["mountain"], hand: ["lightning_bolt"] },
      ] },
      script: [
        { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "hedron_crab" }] },
        { player: 0, do: "cast", card: "plumecreed_escort" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "hedron_crab" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0)).toContain("hedron_crab");
    expect(bf(tg, 0)).toContain("plumecreed_escort");
    expect(gy(tg, 1)).toContain("lightning_bolt");
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "FIZZLE" && (e.payload as { cardId: string }).cardId === "lightning_bolt")).toBe(true);
  });

  it("Pacifism at a hexproofed creature fizzles (an aura's target is checked on resolution too)", async () => {
    const tg = new TestGame({
      name: "escort-pacifism",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["grizzly_bears", "island", "island"], hand: ["plumecreed_escort"] },
        { battlefield: ["plains", "plains"], hand: ["pacifism"] },
      ] },
      script: [
        { player: 1, do: "cast", card: "pacifism", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "cast", card: "plumecreed_escort" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toContain("pacifism");
    expect(bf(tg, 1)).not.toContain("pacifism");
    const bears = tg.findBattlefield("grizzly_bears");
    expect(characteristics(tg.game.ctx, bears).keywords.has("hexproof")).toBe(true);
  });

  it("the grant ends at cleanup: hexproof on our turn, gone on theirs — a Terror then takes the creature", async () => {
    const tg = new TestGame({
      name: "escort-cleanup",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["grizzly_bears", "island", "island"], hand: ["plumecreed_escort"] },
        { battlefield: ["swamp", "swamp"], hand: ["terror"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "plumecreed_escort" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] },
        { player: 1, do: "pass" }, // the ETB must resolve before the Terror may bind (the S3 first-legal-moment lesson)
        { player: 1, do: "cast", card: "terror", targets: [{ object: "grizzly_bears" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    const bears = tg.findBattlefield("grizzly_bears");
    expect(characteristics(tg.game.ctx, bears).keywords.has("hexproof")).toBe(true);
    // Their Terror is illegal now: the cast is not offered.
    expect(legalActions(tg.game.ctx, 1).some((a) => a.type === "castSpell" && a.targets.some((t) => t.kind === "object" && t.id === bears))).toBe(false);
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    expect(characteristics(tg.game.ctx, bears).keywords.has("hexproof")).toBe(false);
    tg.game.state.activePlayer = 1;
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toContain("grizzly_bears");
  });

  it("the Escort saves ITSELF: their Shock at our Escort on the board — a second Escort flashes in aimed at the first; the Shock fizzles. Alone, an entering Escort is its own only target and a Shock cannot aim at it", async () => {
    const tg = new TestGame({
      name: "escort-self",
      setup: { active: 1, step: "MAIN1", players: [
        { battlefield: ["plumecreed_escort", "island", "island"], hand: ["plumecreed_escort"] },
        { battlefield: ["mountain"], hand: ["shock"] },
      ] },
      script: [
        { player: 1, do: "cast", card: "shock", targets: [{ object: "plumecreed_escort" }] },
        { player: 0, do: "cast", card: "plumecreed_escort" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "plumecreed_escort" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0).filter((c) => c === "plumecreed_escort")).toHaveLength(2);
    expect(gy(tg, 1)).toContain("shock");
    const alone = new TestGame({
      name: "escort-alone",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["island", "island"], hand: ["plumecreed_escort"] }, { battlefield: ["mountain"], hand: ["shock"] }] },
      script: [{ player: 0, do: "cast", card: "plumecreed_escort" }],
    });
    await alone.game.runStep("MAIN1");
    const esc = alone.findBattlefield("plumecreed_escort");
    expect(characteristics(alone.game.ctx, esc).keywords.has("hexproof")).toBe(true); // the lone target, forced and unlogged
    expect(legalActions(alone.game.ctx, 1).some((a) => a.type === "castSpell" && a.targets.some((t) => t.kind === "object" && t.id === esc))).toBe(false);
  });

  it("flash: the cast is offered at the opponent's end step (and their main phase), never a sorcery-speed creature", async () => {
    const tg = new TestGame({
      name: "escort-flash",
      setup: { active: 1, step: "END", players: [{ battlefield: ["island", "island"], hand: ["plumecreed_escort", "grizzly_bears"] }, {}] },
    });
    const offered = legalActions(tg.game.ctx, 0).filter((a) => a.type === "castSpell").map((a) => getObject(tg.game.state, a.objectId).cardId);
    expect(offered).toContain("plumecreed_escort");
    expect(offered).not.toContain("grizzly_bears");
  });
});

describe("S32 Part 2 — Diabolic Edict ({1}{B} instant; target player sacrifices a creature of their choice) — zero words on S31's edict", () => {
  it("one creature: the lone Serra goes (forced, unlogged)", async () => {
    const tg = new TestGame({
      name: "edict-one",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp", "swamp"], hand: ["diabolic_edict"] }, { battlefield: ["serra_angel", "plains"] }] },
      script: [{ player: 0, do: "cast", card: "diabolic_edict", targets: [{ player: 1 }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["serra_angel"]);
    expect(bf(tg, 1)).toEqual(["plains"]);
    expect(tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "sacrifice")).toHaveLength(0);
  });

  it("no creatures: it resolves and nothing happens (a player is always a legal target)", async () => {
    const tg = new TestGame({
      name: "edict-none",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp", "swamp"], hand: ["diabolic_edict"] }, { battlefield: ["plains", "plains"] }] },
      script: [{ player: 0, do: "cast", card: "diabolic_edict", targets: [{ player: 1 }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toContain("diabolic_edict");
    expect(bf(tg, 1)).toEqual(["plains", "plains"]);
  });

  it("the defender's pick: with a Serra and a Goblin token, the token is given up (one logged sacrifice)", async () => {
    const tg = new TestGame({
      name: "edict-pick",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp", "swamp"], hand: ["diabolic_edict"] }, { battlefield: ["serra_angel", { card: "goblin_1_1", token: true }] }] },
      script: [{ player: 0, do: "cast", card: "diabolic_edict", targets: [{ player: 1 }] }, { player: 1, do: "sacrificeChoice", card: "goblin_1_1" }],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 1)).toEqual(["serra_angel"]);
    expect(tg.log.entries.filter((e) => e.t === "ACTION" && e.action.type === "sacrifice")).toHaveLength(1);
  });
});
