import { describe, expect, it } from "vitest";
import { characteristics, getObject, legalActions } from "../src/index.js";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S25 fixtures — the five small words at their customers (ADR-088's catalogue, the brief's
 * per-word list): double-X announce (the Keeper charges 2X; X=0 legal), the xPaid ref's LKI
 * timing (removal-in-response leaves the team PUMPED — the trigger is on the stack, CR 603.3),
 * life as an activation cost (the Witch's ladder: 3 legal, 2 legal-and-lethal, 1 illegal —
 * CR 118.4), exile-top-as-cost (the Cleric's one-card library: mode one legal, mode two not),
 * keyword-until-EOT (indestructible through a Wrath, expiring at cleanup — CR 704.5f vs 702.12),
 * plus the two quarter-words the bill missed (damage to:"you"; permanentYou[Dont]Control).
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);
const pt = (tg: TG, id: string) => { const c = characteristics(tg.game.ctx, id); return `${c.power}/${c.toughness}`; };

describe("S25 word 1 — double-X (the Emerald Keeper's {X}{X}{G}{G})", () => {
  it("announcing X=2 charges 2X: six producers pay {4}{G}{G}, and the garden shares the counters", async () => {
    const spec: FixtureSpec = {
      name: "keeper-x2",
      setup: { players: [
        { battlefield: ["forest", "forest", "forest", "forest", "forest", "forest", "grizzly_bears"], hand: ["the_emerald_keeper"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "the_emerald_keeper", x: 2 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const keeper = onBf(tg, "the_emerald_keeper")[0]!;
    const bears = onBf(tg, "grizzly_bears")[0]!;
    // Every forest tapped: {X}{X} at X=2 is four generic on top of {G}{G} (totalCost = xCount·X).
    expect(tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === "forest" && getObject(tg.game.state, id).tapped)).toHaveLength(6);
    // Self-inclusion: the Keeper is on the battlefield as his own trigger resolves — (2+X)/(2+X).
    expect(pt(tg, keeper)).toBe("4/4");
    expect(getObject(tg.game.state, keeper).counters["+1/+1"]).toBe(2);
    expect(pt(tg, bears)).toBe("4/4");
  });

  it("X=0 is legal and harmless ({G}{G} 2/2 legend; zero counters is a clean no-op), and X=1 is not offered without the mana", async () => {
    const spec: FixtureSpec = {
      name: "keeper-x0",
      setup: { players: [
        { battlefield: ["forest", "forest", "grizzly_bears"], hand: ["the_emerald_keeper"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "the_emerald_keeper", x: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(pt(tg, onBf(tg, "the_emerald_keeper")[0]!)).toBe("2/2");
    expect(pt(tg, onBf(tg, "grizzly_bears")[0]!)).toBe("2/2");
    expect(getObject(tg.game.state, onBf(tg, "the_emerald_keeper")[0]!).counters["+1/+1"]).toBeUndefined();
  });

  it("the enumeration ladder charges 2X per step: two forests offer only X=0", async () => {
    const spec: FixtureSpec = {
      name: "keeper-x-ladder",
      setup: { players: [{ battlefield: ["forest", "forest"], hand: ["the_emerald_keeper"] }, {}] },
    };
    const tg = await runFixture(spec);
    const xs = legalActions(tg.game.ctx, 0).filter((a) => a.type === "castSpell").map((a) => (a as { x?: number }).x);
    expect(xs).toEqual([0]); // X=1 would need {2}{G}{G} — four mana off two producers
  });
});

describe("S25 word 2 — {ref: xPaid} rides the trigger's LKI (the brief's timing fixture)", () => {
  it("killing the Keeper in response to his ETB trigger does NOT blank the pump — the trigger is on the stack with the X captured (CR 603.3)", async () => {
    const spec: FixtureSpec = {
      name: "keeper-xpaid-survives-death",
      setup: { players: [
        { battlefield: ["forest", "forest", "forest", "forest", "forest", "forest", "grizzly_bears"], hand: ["the_emerald_keeper"] },
        { battlefield: ["swamp", "swamp"], hand: ["doom_blade"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "the_emerald_keeper", x: 2 },
        // The pass barrier (the S22 lesson): let the Keeper resolve first, so Doom Blade binds in
        // the window where he is on the battlefield with his ETB trigger already on the stack —
        // exactly the removal-in-response line.
        { player: 1, do: "pass" },
        { player: 1, do: "cast", card: "doom_blade", targets: [{ object: "the_emerald_keeper" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "the_emerald_keeper")).toHaveLength(0); // the Keeper died in response
    expect(tg.game.state.players[0].graveyard.map((id) => getObject(tg.game.state, id).cardId)).toContain("the_emerald_keeper");
    // …and the team is still pumped: the trigger resolved with its captured X (LKI by construction).
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(getObject(tg.game.state, bears).counters["+1/+1"]).toBe(2);
    expect(pt(tg, bears)).toBe("4/4");
  });
});

describe("S25 word 3 — life as an activation cost (the Jet Witch's ladder)", () => {
  it("at life 3 the draw is legal and leaves life 1 — where the ability is no longer offered (CR 118.4)", async () => {
    const spec: FixtureSpec = {
      name: "witch-life-3",
      setup: { players: [{ life: 3, battlefield: ["the_jet_witch"], library: ["swamp", "swamp"] }, {}] },
      script: [{ player: 0, do: "activate", card: "the_jet_witch", abilityIndex: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(1);
    expect(tg.handCardIds(0)).toContain("swamp");
    // At life 1, paying 2 is illegal — the activation vanishes from the list.
    const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility");
    expect(acts).toHaveLength(0);
  });

  it("at life 2 the payment is legal, reaches exactly 0, and the SBA speaks next — the knife cuts the wielder", async () => {
    const spec: FixtureSpec = {
      name: "witch-life-2",
      setup: { players: [{ life: 2, battlefield: ["the_jet_witch"], library: ["swamp", "swamp"] }, {}] },
      script: [{ player: 0, do: "activate", card: "the_jet_witch", abilityIndex: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(0);
    expect(tg.game.state.players[0].lost).toBe(true);
    expect(tg.game.state.players[0].lostReason).toBe("LIFE");
  });
});

describe("S25 word 4 — exile-top-as-cost (the Pearl Cleric's one-card library)", () => {
  it("mode one is legal (library 1 ≥ 1), mode two is not (library 1 < 2); the paid card lands in exile", async () => {
    const spec: FixtureSpec = {
      name: "cleric-library-floor",
      setup: { players: [
        { life: 10, battlefield: ["the_pearl_cleric", "plains", "plains"], library: ["swamp"] },
        { battlefield: ["grizzly_bears"] },
      ] },
    };
    const tg = await runFixture(spec);
    const offered = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility").map((a) => (a as { abilityIndex: number }).abilityIndex);
    expect(offered).toContain(0);
    expect(offered).not.toContain(1);
  });

  it("paying the cost exiles top-down through the one zone-move primitive and the life arrives", async () => {
    const spec: FixtureSpec = {
      name: "cleric-gain",
      setup: { players: [
        { life: 10, battlefield: ["the_pearl_cleric", "plains"], library: ["swamp", "forest"] },
        {},
      ] },
      script: [{ player: 0, do: "activate", card: "the_pearl_cleric", abilityIndex: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(11);
    expect(tg.game.state.players[0].exile.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["swamp"]); // the TOP card paid
    expect(tg.game.state.players[0].library.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["forest"]);
  });
});

describe("S25 word 5 — keyword-until-EOT (the Cleric's indestructible through a Wrath)", () => {
  it("the shielded Serra survives the Wrath (704.5f defers to 702.12); the grant expires at cleanup", async () => {
    const spec: FixtureSpec = {
      name: "cleric-shields-through-wrath",
      setup: {
        active: 1,
        players: [
          { life: 10, battlefield: ["the_pearl_cleric", "plains", "plains", "serra_angel"], library: ["swamp", "swamp", "swamp"] },
          { battlefield: ["plains", "plains", "plains", "plains", "grizzly_bears"], hand: ["wrath_of_god"] },
        ],
      },
      script: [
        { player: 1, do: "cast", card: "wrath_of_god" },
        // The response window: {W}{W} + exile two — indestructible resolves above the Wrath.
        { player: 0, do: "activate", card: "the_pearl_cleric", abilityIndex: 1, targets: [{ object: "serra_angel" }] },
      ],
      run: [{ priority: true }, { steps: ["END", "CLEANUP"] }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "serra_angel")).toHaveLength(1); // shielded through the sweep
    expect(onBf(tg, "the_pearl_cleric")).toHaveLength(0); // the shield-bearer was not shielded
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0); // the caster's own side swept too
    // The grant expired at cleanup: nothing UNTIL_END_OF_TURN survives, and the keyword is gone.
    expect(tg.game.state.continuousEffects.filter((ce) => ce.duration === "UNTIL_END_OF_TURN")).toHaveLength(0);
    expect(characteristics(tg.game.ctx, onBf(tg, "serra_angel")[0]!).keywords.has("indestructible")).toBe(false);
  });
});

describe("S25 quarter-word A — damage to:\"you\" (the Ruby Tyrant's recoil)", () => {
  it("the gun deals 2 to the target and 1 back to its keeper", async () => {
    const spec: FixtureSpec = {
      name: "tyrant-gun-recoil",
      setup: { players: [
        { life: 20, battlefield: ["the_ruby_tyrant", "mountain", "mountain", "mountain"] },
        { battlefield: ["grizzly_bears"] },
      ] },
      script: [{ player: 0, do: "activate", card: "the_ruby_tyrant", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0); // 2 ≥ 2 toughness
    expect(tg.game.state.players[0].life).toBe(19); // the recoil
  });
});

describe("S25 quarter-word B — controller-scoped permanents (the Sapphire Sage's two-sided bounce)", () => {
  it("the Sage-loop is legal: his own trigger may target himself, and the opponent loses a permanent alongside", async () => {
    const spec: FixtureSpec = {
      name: "sage-bounces-sage",
      setup: { players: [
        { battlefield: ["island", "island", "island", "island", "island"], hand: ["the_sapphire_sage"] },
        { battlefield: ["grizzly_bears", "forest"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "the_sapphire_sage" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "the_sapphire_sage" }, { object: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0)).toContain("the_sapphire_sage"); // back for another 5-mana tide
    expect(tg.handCardIds(1)).toContain("grizzly_bears");
    expect(onBf(tg, "forest")).toHaveLength(1); // one permanent per player, not a sweep
  });

  it("with no opposing permanent the trigger never stacks (CR 603.3d — all targeting requirements or nothing)", async () => {
    const spec: FixtureSpec = {
      name: "sage-no-opposing-permanent",
      setup: { players: [
        { battlefield: ["island", "island", "island", "island", "island"], hand: ["the_sapphire_sage"] },
        { life: 20 },
      ] },
      script: [{ player: 0, do: "cast", card: "the_sapphire_sage" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "the_sapphire_sage")).toHaveLength(1); // he stays: nothing to choose for the opponent's seat
    expect(tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === "island")).toHaveLength(5);
  });
});
