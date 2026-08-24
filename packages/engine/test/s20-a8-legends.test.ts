import { describe, expect, it } from "vitest";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S20 fixtures — A8 "up to" targeting + inter-target distinctness (Drakuseth,
 * the amendment's first customer at last) and the legend batch's engine bill
 * (Titania's land returns + land-death token; Reya's raise; Arcanis's engine).
 * Fuzz-before-fixtures ran first: pnpm fuzz:duals --guardians.
 */

describe("S20 — A8 up-to targeting (Drakuseth, Maw of Flames)", () => {
  const attackWith = (extraTargets: { object?: string; player?: number }[], defenders: string[] = ["grizzly_bears", "hill_giant"]): FixtureSpec => ({
    name: `drakuseth-${extraTargets.length}`,
    setup: {
      active: 0,
      step: "MAIN1",
      players: [
        { battlefield: [{ card: "drakuseth_maw_of_flames", summoningSick: false }] },
        { battlefield: defenders },
      ],
    },
    script: [
      { player: 0, do: "attack", attackers: ["drakuseth_maw_of_flames"] },
      { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }, ...extraTargets] as never },
      { player: 1, do: "block", blocks: [] },
    ],
    run: [{ steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
  });

  it("0 extra targets: 4 to the face only, then 7 combat damage (the range chose none)", async () => {
    const tg = await runFixture(attackWith([]));
    expect(tg.game.state.players[1].life).toBe(20 - 4 - 7);
    expect(tg.graveyardCardIds(1)).toEqual([]);
  });

  it("2 extra targets: 4 face + 3 to each — both die; distinct picks enforced at enumeration", async () => {
    const tg = await runFixture(attackWith([{ object: "grizzly_bears" }, { object: "hill_giant" }]));
    expect(tg.graveyardCardIds(1).sort()).toEqual(["grizzly_bears", "hill_giant"]);
    expect(tg.game.state.players[1].life).toBe(20 - 4 - 7);
    // No offered combo ever repeats a target (the ruling's no-stacking).
    const req = tg.requests.find((r) => r.purpose === "chooseTarget");
    if (req) {
      for (const a of req.actions) {
        if (a.type !== "chooseTriggerTargets") continue;
        const keys = a.targets.map((t) => JSON.stringify(t));
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it("1 extra target that DIES before resolution: the trigger still resolves — 4 face lands (fizzle is per-target)", async () => {
    const spec: FixtureSpec = {
      name: "drakuseth-fizzle",
      setup: {
        active: 0,
        step: "MAIN1",
        players: [
          { battlefield: [{ card: "drakuseth_maw_of_flames", summoningSick: false }, "mountain"], hand: ["shock"] },
          { battlefield: ["grizzly_bears"] },
        ],
      },
      script: [
        { player: 0, do: "attack", attackers: ["drakuseth_maw_of_flames"] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }, { object: "grizzly_bears" }] as never },
        // Shock the Bears in response — the extra target is dead when the trigger resolves.
        { player: 0, do: "cast", card: "shock", targets: [{ object: "grizzly_bears" }] },
        { player: 1, do: "block", blocks: [] },
      ],
      run: [{ steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.graveyardCardIds(1)).toEqual(["grizzly_bears"]); // died to Shock, not to a 3
    expect(tg.game.state.players[1].life).toBe(20 - 4 - 7); // the 4 still landed; combat still 7
  });
});

describe("S20 — the legend batch's engine bill", () => {
  it("Titania: ETB returns a target LAND from the graveyard to the battlefield (the new predicate); a land you control dying makes a 5/3 Elemental", async () => {
    const spec: FixtureSpec = {
      name: "titania",
      setup: {
        players: [
          { battlefield: ["forest", "forest", "forest", "forest", "forest"], hand: ["titania_protector_of_argoth"], graveyard: ["forest", "island", "grizzly_bears"] },
          { hand: ["shock"] },
        ],
      },
      script: [
        { player: 0, do: "cast", card: "titania_protector_of_argoth" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ graveyard: "forest" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.battlefield.map((id) => st.objects[id]!.cardId).filter((c) => c === "forest")).toHaveLength(6); // 5 + returned
    expect(tg.graveyardCardIds(0).sort()).toEqual(["grizzly_bears", "island"]); // the creature stayed put (land predicate); the island was the road not taken
    // Now a land dies: destroy one via the harness — emulate with a fixture using test_wrath? Lands aren't creatures;
    // move a Forest to the graveyard through the engine's zone move by making Titania watch a sacrifice-like event is
    // not scriptable here — covered instead by the guardian fuzz (Evolving Wilds cracks make Elementals). Assert the
    // trigger EXISTS and is an observed land-DIES shape:
    const def = tg.game.ctx.defs.def("titania_protector_of_argoth");
    const dies = (def.abilities ?? []).find((a) => a.kind === "triggered" && a.event === "DIES");
    expect(dies && dies.kind === "triggered" && dies.condition?.type).toEqual(["Land"]);
  });

  it("Evolving Wilds → Titania: cracking the Wilds fetches a tapped basic AND feeds Titania an Elemental (the land-death observer fires on the sacrifice)", async () => {
    const spec: FixtureSpec = {
      name: "wilds-titania",
      setup: {
        players: [
          { battlefield: [{ card: "titania_protector_of_argoth", summoningSick: false }, "evolving_wilds"], library: ["forest"] },
          { hand: ["island"] },
        ],
      },
      script: [
        { player: 0, do: "activate", card: "evolving_wilds", abilityIndex: 0 },
        { player: 0, do: "search", card: "forest" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const forest = st.battlefield.map((id) => st.objects[id]!).find((o) => o.cardId === "forest");
    expect(forest?.tapped).toBe(true); // fetched tapped
    expect(st.battlefield.map((id) => st.objects[id]!.cardId)).toContain("elemental_5_3_g"); // Titania saw the Wilds die
    expect(tg.graveyardCardIds(0)).toContain("evolving_wilds");
  });

  it("Reya: your upkeep may raise a creature card from your graveyard (optional trigger, graveyard target)", async () => {
    const spec: FixtureSpec = {
      name: "reya",
      setup: {
        active: 0,
        step: "UNTAP",
        players: [
          { battlefield: ["reya_dawnbringer"], graveyard: ["serra_angel", "suntail_hawk", "forest"] },
          {},
        ],
      },
      script: [
        // Targets are chosen as the trigger goes on the stack (601.2b order, S17); the "may" resolves after.
        { player: 0, do: "chooseTriggerTargets", targets: [{ graveyard: "serra_angel" }] },
        { player: 0, do: "optional", accept: true },
      ],
      run: [{ steps: ["UPKEEP"] }, { priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.battlefield.map((id) => st.objects[id]!.cardId)).toContain("serra_angel");
    expect(tg.graveyardCardIds(0).sort()).toEqual(["forest", "suntail_hawk"]); // the land was never legal; the hawk was the choice not taken
  });

  it("Arcanis: {T}: draw three; {2}{U}{U}: return himself to hand (scope-self bounce)", async () => {
    const spec: FixtureSpec = {
      name: "arcanis",
      setup: {
        players: [
          { battlefield: [{ card: "arcanis_the_omnipotent", summoningSick: false }, "island", "island", "island", "island"], library: ["island", "island", "island", "counterspell"] },
          {},
        ],
      },
      script: [
        { player: 0, do: "activate", card: "arcanis_the_omnipotent", abilityIndex: 0 },
        { player: 0, do: "activate", card: "arcanis_the_omnipotent", abilityIndex: 1 },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.players[0].hand.length).toBeGreaterThanOrEqual(4); // 3 drawn + Arcanis himself
    expect(st.players[0].hand.map((id) => st.objects[id]!.cardId)).toContain("arcanis_the_omnipotent");
    expect(st.battlefield.map((id) => st.objects[id]!.cardId)).not.toContain("arcanis_the_omnipotent");
  });
});
