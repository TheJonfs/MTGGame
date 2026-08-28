import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S23 fun-batch fixtures (fun-batch-s23.md; fuzzed first per the S3 protocol — 300 games clean
 * with a coverage probe). The spec's named cases:
 *  - the Thundersnake's off-turn entry dies the SAME turn ("the end step" is every end step);
 *  - the Gallows Djinn's triggers at life 1 (the tax is honest — it can kill its keeper);
 *  - the Traumatizer's trample-partial (1 assigned to the player mills 2).
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const gy = (tg: TG, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);

const COMBAT_TO_END: FixtureSpec["run"] = [
  { steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END", "MAIN2", "END"] },
];

describe("S23 — Thundersnake ({R}{R} 4/1 trample haste; end-step self-sacrifice)", () => {
  it("swings for 4 and sacrifices itself at the beginning of its controller's end step (DIES fires)", async () => {
    const tg = await runFixture({
      name: "snake-own-turn",
      setup: { players: [{ battlefield: ["thundersnake"] }, {}] },
      script: [{ player: 0, do: "attack", attackers: ["thundersnake"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(16); // 4 through, unblocked
    expect(gy(tg, 0)).toEqual(["thundersnake"]); // the exit toll, paid at END
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "DIES" && (e.payload as { cardId: string }).cardId === "thundersnake")).toBe(true);
  });

  it("the spec's named case: an OFF-TURN Thundersnake dies the same turn — 'the end step' is every end step", async () => {
    // The snake stands on the NON-ACTIVE player's battlefield (a reanimated copy, the Usher's
    // guest, whatever put it there): the active player's end step still kills it.
    const tg = await runFixture({
      name: "snake-off-turn",
      setup: { active: 0, players: [{}, { battlefield: ["thundersnake"] }] },
      run: [{ steps: ["MAIN2", "END"] }],
    });
    expect(gy(tg, 1)).toEqual(["thundersnake"]);
  });

  it("a sacrifice, not a destruction: the trigger's source bounced in response no-ops (stale source id)", async () => {
    // The snake's own controller Boomerangs it with the trigger on the stack — the sacrifice
    // finds the battlefield empty of it and does nothing; the snake is safe in hand.
    const tg = await runFixture({
      name: "snake-bounced",
      setup: { active: 0, players: [{ battlefield: ["thundersnake", "island", "island"], hand: ["boomerang"] }, {}] },
      script: [
        { player: 0, do: "cast", card: "boomerang", targets: [{ object: "thundersnake" }] }, // in the END step, on top of the trigger
      ],
      run: [{ steps: ["MAIN2", "END"] }],
    });
    expect(tg.handCardIds(0)).toContain("thundersnake"); // bounced out from under the sacrifice
    expect(gy(tg, 0)).toEqual(["boomerang"]); // only the spell fell
  });
});

describe("S23 — Gallows Djinn ({2}{B}{B} 5/5; the aggression tax)", () => {
  it("attacking costs its controller 1 (the Djinn itself is the source, non-combat)", async () => {
    const tg = await runFixture({
      name: "djinn-attacks",
      setup: { players: [{ battlefield: ["gallows_djinn"] }, {}] },
      script: [{ player: 0, do: "attack", attackers: ["gallows_djinn"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[0].life).toBe(19); // the tax
    expect(tg.game.state.players[1].life).toBe(15); // 5 through
    const tax = tg.log.entries.find((e) => e.t === "EVENT" && e.name === "DAMAGE" && (e.payload as { sourceCardId: string; combat: boolean }).sourceCardId === "gallows_djinn" && !(e.payload as { combat: boolean }).combat) as { payload: { target: { kind: string; player: number } } } | undefined;
    expect(tax?.payload.target).toEqual({ kind: "player", player: 0 });
  });

  it("blocking costs its controller 1 too — and the 5/5 body still eats the attacker", async () => {
    const tg = await runFixture({
      name: "djinn-blocks",
      setup: { players: [{ battlefield: ["grizzly_bears"] }, { battlefield: ["gallows_djinn"] }] },
      script: [
        { player: 0, do: "attack", attackers: ["grizzly_bears"] },
        { player: 1, do: "block", blocks: [{ blocker: "gallows_djinn", attacker: "grizzly_bears" }] },
      ],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(19); // the block tax (no combat damage reached the player)
    expect(gy(tg, 0)).toEqual(["grizzly_bears"]); // the bear died to the 5/5
    expect(tg.game.state.battlefield.some((id) => getObject(tg.game.state, id).cardId === "gallows_djinn")).toBe(true);
  });

  it("the spec's named case: at life 1 the tax is lethal — the Djinn kills its own keeper", async () => {
    const tg = await runFixture({
      name: "djinn-life-1",
      setup: { players: [{ life: 1, battlefield: ["gallows_djinn"] }, {}] },
      script: [{ player: 0, do: "attack", attackers: ["gallows_djinn"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[0].life).toBe(0);
    expect(tg.game.state.result).toEqual({ winner: 1, reason: "LIFE" });
  });
});

describe("S23 — Traumatizer ({2}{U}{U} 2/4 flying; combat damage to a player mills twice that many)", () => {
  it("a full connection mills 4 (2 damage × 2)", async () => {
    const tg = await runFixture({
      name: "trauma-full",
      setup: { players: [{ battlefield: ["traumatizer"] }, { library: ["swamp", "swamp", "swamp", "swamp", "swamp", "swamp"] }] },
      script: [{ player: 0, do: "attack", attackers: ["traumatizer"] }],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(18);
    expect(gy(tg, 1)).toHaveLength(4); // milled twice the damage
    expect(tg.game.state.players[1].library).toHaveLength(2);
  });

  it("the spec's named case: the trample partial — 1 assigned to the player mills 2", async () => {
    // Rancor makes it a 4/4 trampler; a 1/3 flying blocker soaks lethal 3, exactly 1 tramples through.
    const tg = await runFixture({
      name: "trauma-trample",
      setup: {
        players: [
          { battlefield: ["traumatizer", { card: "rancor", attachedTo: "traumatizer" }] },
          { battlefield: ["youthful_valkyrie"], library: ["island", "island", "island", "island"] },
        ],
      },
      script: [
        { player: 0, do: "attack", attackers: ["traumatizer"] },
        { player: 1, do: "block", blocks: [{ blocker: "youthful_valkyrie", attacker: "traumatizer" }] },
      ],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].life).toBe(19); // exactly the trample point
    expect(gy(tg, 1)).toContain("youthful_valkyrie"); // lethal 3 assigned to the blocker
    expect(tg.game.state.players[1].library).toHaveLength(2); // milled 1 × 2
  });

  it("no connection, no mill: a blocked Traumatizer without trample mills nothing", async () => {
    const tg = await runFixture({
      name: "trauma-walled",
      setup: { players: [{ battlefield: ["traumatizer"] }, { battlefield: ["youthful_valkyrie"], library: ["island", "island"] }] },
      script: [
        { player: 0, do: "attack", attackers: ["traumatizer"] },
        { player: 1, do: "block", blocks: [{ blocker: "youthful_valkyrie", attacker: "traumatizer" }] },
      ],
      run: COMBAT_TO_END,
    });
    expect(tg.game.state.players[1].library).toHaveLength(2); // untouched
    expect(tg.game.state.players[1].life).toBe(20);
  });
});
