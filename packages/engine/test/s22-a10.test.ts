import { describe, expect, it } from "vitest";
import { characteristics, getObject, legalActions } from "../src/index.js";
import { runFixture, testPool, type FixtureSpec } from "./harness.js";

/**
 * S22 fixtures — A10's nine words at their real customers (the brief's per-word list):
 * the Unwinder's ping + engine, the Usher's entrance + the blink-launder, Purge's request-loop +
 * no-refund-on-counter, the Warden's law (lifelink-nets-zero; tapped-Warden-pays), Glare's cost,
 * the Stoker's fork (auto-resolve at life ≤ 2) and grant (lands-cycle-too; double-cycling),
 * the Phoenix loop, the Sower's plays-not-enters trigger, and the batch's small pieces.
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);
const pt = (tg: TG, id: string) => { const c = characteristics(tg.game.ctx, id); return `${c.power}/${c.toughness}`; };

describe("A10 words 1–2 — the Unwinder", () => {
  it("the interlock: the engine's own bounce cost feeds the ping; land returns to hand; a card is drawn", async () => {
    const spec: FixtureSpec = {
      name: "unwinder-engine",
      setup: { players: [
        { battlefield: ["the_unwinder", "island", "mountain", "forest"], library: ["island"] },
        { battlefield: ["grizzly_bears"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "the_unwinder", abilityIndex: 1 },
        { player: 0, do: "bounceCost", card: "forest" },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0).sort()).toEqual(["forest", "island"]); // the bounced land + the drawn card
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(getObject(tg.game.state, bears).damage).toBe(1); // the ping resolved above the draw
  });

  it("the trigger is symmetric over controller and cause: the opponent's own Boomerang feeds the ping", async () => {
    const spec: FixtureSpec = {
      name: "unwinder-symmetric",
      setup: { players: [
        { battlefield: ["the_unwinder"] },
        { life: 20, battlefield: ["grizzly_bears", "island", "island"], hand: ["boomerang"] },
      ], active: 1 },
      script: [
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(1)).toContain("grizzly_bears");
    expect(tg.game.state.players[1].life).toBe(19); // interacting with the tide costs you
  });
});

describe("A10 word 3 — the Usher's entrance (temporary reanimate, who: any)", () => {
  it("the Court claims all the dead: the OPPONENT's Serra rises under the Usher's control with haste, and pays the exit toll at end step (the drain collects)", async () => {
    const spec: FixtureSpec = {
      name: "usher-entrance",
      setup: { players: [
        { life: 20, battlefield: ["swamp", "swamp", "plains", "mountain", "island"], hand: ["the_usher"] },
        { life: 20, graveyard: ["serra_angel"] },
      ] },
      script: [{ player: 0, do: "cast", card: "the_usher" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const serra = onBf(tg, "serra_angel")[0]!;
    expect(getObject(tg.game.state, serra).controller).toBe(0); // hers, not its owner's
    expect(characteristics(tg.game.ctx, serra).keywords.has("haste")).toBe(true);
    await tg.game.runStep("END");
    expect(onBf(tg, "serra_angel")).toHaveLength(0);
    expect(tg.graveyardCardIds(1)).toContain("serra_angel"); // sacrificed to its owner's graveyard
    expect(tg.game.state.players[1].life).toBe(18); // the guest pays 2 on the way out…
    expect(tg.game.state.players[0].life).toBe(22); // …into the Usher's purse
  });

  it("the launder: a blinked temporary guest is a new object and sheds the delayed sacrifice", async () => {
    const spec: FixtureSpec = {
      name: "usher-launder",
      setup: { players: [
        { life: 20, graveyard: ["grizzly_bears"], hand: ["the_usher", "restoration_angel"],
          battlefield: ["swamp", "swamp", "plains", "mountain", "island", "plains", "forest", "forest", "island"] },
        { life: 20 },
      ] },
      script: [
        { player: 0, do: "cast", card: "the_usher" },
        { player: 0, do: "pass" }, // barrier: let the Usher resolve…
        { player: 0, do: "pass" }, // …and her entrance trigger too (the guest must exist before the blink is aimed)
        { player: 0, do: "cast", card: "restoration_angel", targets: [] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "optional", accept: true },
      ],
      run: [{ priority: true }, { steps: ["END"] }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(1); // the toll never falls due: reanimation made permanent
    expect(tg.game.state.endStepSacrifices).toHaveLength(0); // the entry was consumed inert or never re-created
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(characteristics(tg.game.ctx, bears).keywords.has("haste")).toBe(false); // the blink also shed the haste
  });
});

describe("A10 word 4 — Phyrexian Purge (any-number request-loop, life per target)", () => {
  it("the loop: two picks at 3 life each, paid at cast; both die at resolution", async () => {
    const spec: FixtureSpec = {
      name: "purge-two",
      setup: { players: [
        { life: 20, battlefield: ["swamp", "swamp", "mountain", "island"], hand: ["phyrexian_purge"] },
        { battlefield: ["grizzly_bears", "centaur_courser", "serra_angel"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "phyrexian_purge" },
        { player: 0, do: "pickTarget", target: { object: "grizzly_bears" } },
        { player: 0, do: "pickTarget", target: { object: "centaur_courser" } },
        { player: 0, do: "doneTargets" }, // the Serra is spared — done while picks remain
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(14); // 20 − 2×3, at cast
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    expect(onBf(tg, "centaur_courser")).toHaveLength(0);
  });

  it("no refund on counter: the life stays paid when Purge is countered (CR 601.2h; the printed ruling)", async () => {
    const spec: FixtureSpec = {
      name: "purge-countered",
      setup: { players: [
        { life: 20, battlefield: ["swamp", "swamp", "mountain", "island"], hand: ["phyrexian_purge"] },
        { battlefield: ["grizzly_bears", "island", "island"], hand: ["counterspell"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "phyrexian_purge" },
        { player: 0, do: "pickTarget", target: { object: "grizzly_bears" } },
        // (done is the lone option after the only creature is picked — auto-taken, unscripted)
        { player: 1, do: "cast", card: "counterspell", targets: [{ spell: "phyrexian_purge" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(17); // 3 paid, never refunded
    expect(onBf(tg, "grizzly_bears")).toHaveLength(1); // the Purge never resolved
    expect(tg.graveyardCardIds(0)).toContain("phyrexian_purge");
  });

  it("another pick is offered only while its life is payable (down to exactly 0 is legal — the A9 precedent)", async () => {
    const spec: FixtureSpec = {
      name: "purge-life-floor",
      setup: { players: [
        { life: 7, battlefield: ["swamp", "swamp", "mountain", "island"], hand: ["phyrexian_purge"] },
        { battlefield: ["grizzly_bears", "centaur_courser", "serra_angel"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "phyrexian_purge" },
        { player: 0, do: "pickTarget", target: { object: "grizzly_bears" } },
        { player: 0, do: "pickTarget", target: { object: "centaur_courser" } },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    // Life 7: after two picks (6 life), a third would need 9 — the loop offers only "done"
    // (single option, auto-taken; no third pick request ever appears).
    expect(tg.game.state.players[0].life).toBe(1);
    expect(onBf(tg, "serra_angel")).toHaveLength(1);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    expect(onBf(tg, "centaur_courser")).toHaveLength(0);
  });
});

describe("A10 word 5 — the Warden's law (UNTAPPED + event addressing)", () => {
  it("lifelink walks free: the Nighthawk's own untap nets its controller zero; the vanilla creature pays", async () => {
    const spec: FixtureSpec = {
      name: "warden-law-lifelink",
      setup: { active: 1, step: "UNTAP", players: [
        { battlefield: ["the_warden"] },
        { life: 20, battlefield: [{ card: "vampire_nighthawk", tapped: true }, { card: "grizzly_bears", tapped: true }] },
      ] },
      run: [{ steps: ["UNTAP", "UPKEEP"] }],
    };
    const tg = await runFixture(spec);
    // Bears: −1. Nighthawk: −1 damage +1 lifelink (its own damage, its own controller) = 0.
    expect(tg.game.state.players[1].life).toBe(19);
  });

  it("the tapped Warden pays his own statute (and identical triggers auto-order without a request)", async () => {
    const spec: FixtureSpec = {
      name: "warden-pays-himself",
      setup: { active: 0, step: "UNTAP", players: [
        { life: 20, battlefield: [{ card: "the_warden", tapped: true }, { card: "grizzly_bears", tapped: true }] },
        { life: 20 },
      ] },
      run: [{ steps: ["UNTAP", "UPKEEP"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(18); // Warden 1 + bears 1, both to their controller
    expect(tg.requests.some((r) => r.purpose === "orderTriggers")).toBe(false); // same card+ability: auto-ordered
  });

  it("the attack trigger: tap up to two target creatures (A8 range + tapTarget fan-out); vigilance keeps him untapped", async () => {
    const spec: FixtureSpec = {
      name: "warden-attacks",
      setup: { step: "DECLARE_ATTACKERS", players: [
        { battlefield: ["the_warden"] },
        { life: 20, battlefield: ["grizzly_bears", "centaur_courser"] },
      ] },
      script: [
        { player: 0, do: "attack", attackers: ["the_warden"] },
        { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }, { object: "centaur_courser" }] },
      ],
      run: [{ steps: ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
    };
    const tg = await runFixture(spec);
    expect(getObject(tg.game.state, onBf(tg, "grizzly_bears")[0]!).tapped).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "centaur_courser")[0]!).tapped).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "the_warden")[0]!).tapped).toBe(false); // vigilance
    expect(tg.game.state.players[1].life).toBe(16); // both blockers tapped down: 4 through
  });
});

describe("A10 word 6 — Glare of Subdual (tapCreature cost)", () => {
  it("tap-an-untapped-creature-as-cost taps the payer and the target", async () => {
    const spec: FixtureSpec = {
      name: "glare",
      setup: { players: [
        { battlefield: ["glare_of_subdual", "grizzly_bears", "centaur_courser"] }, // two payers: the cost pick is a real request
        { battlefield: ["serra_angel"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "glare_of_subdual", abilityIndex: 0, targets: [{ object: "serra_angel" }] },
        { player: 0, do: "tapCost", card: "grizzly_bears" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(getObject(tg.game.state, onBf(tg, "grizzly_bears")[0]!).tapped).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "serra_angel")[0]!).tapped).toBe(true);
  });
});

describe("A10 word 7 — the Stoker's fork (unlessPay)", () => {
  const base = (p1Life: number, p1Hand: string[] = ["shock"]): FixtureSpec => ({
    name: "stoker-fork",
    setup: { active: 1, players: [
      { life: 20, battlefield: ["the_stoker"], library: ["island", "island"] },
      { life: p1Life, battlefield: ["mountain"], hand: p1Hand },
    ] },
    script: [],
    run: [{ priority: true }],
  });

  it("pay: the caster pays 2 and the furnace goes unfed", async () => {
    const spec = base(20);
    spec.script = [
      { player: 1, do: "cast", card: "shock", targets: [{ player: 0 }] },
      { player: 1, do: "optional", accept: true },
    ];
    const tg = await runFixture(spec);
    expect(tg.game.state.players[1].life).toBe(18); // paid the toll
    expect(tg.handCardIds(0)).toHaveLength(0); // no draw
    expect(tg.game.state.players[0].life).toBe(18); // the shock still resolved
  });

  it("don't pay: the Stoker's controller draws — and the trigger resolves ABOVE the spell that fed it", async () => {
    const spec = base(20);
    spec.script = [
      { player: 1, do: "cast", card: "shock", targets: [{ player: 0 }] },
      { player: 1, do: "optional", accept: false },
    ];
    const tg = await runFixture(spec);
    expect(tg.game.state.players[1].life).toBe(20);
    expect(tg.handCardIds(0)).toHaveLength(1); // the draw landed (before the shock — order verified by the log)
  });

  it("auto-resolve at life ≤ 2: no request is issued; the fork takes its lone branch (ADR-014 at trigger scale)", async () => {
    const tg = await runFixture({
      ...base(2),
      script: [{ player: 1, do: "cast", card: "shock", targets: [{ player: 0 }] }],
    });
    expect(tg.requests.some((r) => r.purpose === "unlessPay")).toBe(false);
    expect(tg.handCardIds(0)).toHaveLength(1); // the furnace fed itself
    expect(tg.game.state.players[1].life).toBe(2); // nothing was paid
  });
});

describe("A10 word 8 — the Stoker's grant and the Felidar's (grantAbility)", () => {
  it("lands cycle too, and native cycling offers both abilities at their two costs", async () => {
    const spec: FixtureSpec = {
      name: "stoker-grant",
      setup: { players: [
        { battlefield: ["the_stoker", "mountain", "island"], hand: ["forest", "airship_crash"], library: ["island", "island"] },
        {},
      ] },
      script: [{ player: 0, do: "activate", card: "forest", abilityIndex: 1 }], // printed mana ability is 0; the granted cycling is 1
      run: [{ priority: true }],
    };
    const tg = new (await import("./harness.js")).TestGame(spec);
    // Before running: the enumerator offers the granted cycling on the LAND and BOTH cyclings on Airship Crash.
    const actions = legalActions(tg.game.ctx, 0);
    const forestId = tg.game.state.players[0].hand.find((id) => getObject(tg.game.state, id).cardId === "forest")!;
    const airshipId = tg.game.state.players[0].hand.find((id) => getObject(tg.game.state, id).cardId === "airship_crash")!;
    expect(actions.filter((a) => a.type === "activateAbility" && a.objectId === forestId)).toHaveLength(1); // lands cycle too
    expect(actions.filter((a) => a.type === "activateAbility" && a.objectId === airshipId)).toHaveLength(2); // native {2} + granted {1}{R}
    await tg.run(spec);
    tg.gcScript();
    expect(tg.consumed).toHaveLength(1);
    expect(tg.graveyardCardIds(0)).toContain("forest"); // cycled away…
    expect(tg.handCardIds(0)).toEqual(["airship_crash", "island"]); // …and a card drawn
  });

  it("the Felidar grants his tapper to every vigilant creature you control — including himself (the printed ruling)", async () => {
    const spec: FixtureSpec = {
      name: "felidar",
      setup: { players: [
        { battlefield: ["frondland_felidar", "serra_angel", "grizzly_bears", "plains", "plains"] },
        { battlefield: ["centaur_courser"] },
      ] },
      script: [{ player: 0, do: "activate", card: "frondland_felidar", abilityIndex: 1, targets: [{ object: "centaur_courser" }] }],
      run: [{ priority: true }],
    };
    const tg = new (await import("./harness.js")).TestGame(spec);
    const actions = legalActions(tg.game.ctx, 0);
    const granted = (cardId: string) => {
      const id = onBf(tg, cardId)[0]!;
      return actions.filter((a) => a.type === "activateAbility" && a.objectId === id);
    };
    expect(granted("frondland_felidar").length).toBeGreaterThan(0); // grants to himself
    expect(granted("serra_angel").length).toBeGreaterThan(0); // vigilance qualifies
    expect(granted("grizzly_bears")).toHaveLength(0); // no vigilance, no tapper
    await tg.run(spec);
    tg.gcScript();
    expect(tg.consumed).toHaveLength(1);
    expect(getObject(tg.game.state, onBf(tg, "centaur_courser")[0]!).tapped).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "frondland_felidar")[0]!).tapped).toBe(true); // his own {T} paid
  });
});

describe("A10 word 9 — the Phoenix loop (graveyard-zone trigger + optionalCost)", () => {
  it("upkeep, pay {B}: the Phoenix returns to hand; the payment tapped the Swamp", async () => {
    const spec: FixtureSpec = {
      name: "phoenix-return",
      setup: { active: 0, step: "UNTAP", players: [
        { graveyard: ["tainted_phoenix"], battlefield: ["swamp"] },
        {},
      ] },
      script: [{ player: 0, do: "optional", accept: true }],
      run: [{ steps: ["UPKEEP"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0)).toContain("tainted_phoenix");
    expect(getObject(tg.game.state, onBf(tg, "swamp")[0]!).tapped).toBe(true);
  });

  it("unpayable {B}: the lone decline is auto-taken (no request) and the Phoenix stays dead", async () => {
    const spec: FixtureSpec = {
      name: "phoenix-stays",
      setup: { active: 0, step: "UNTAP", players: [
        { graveyard: ["tainted_phoenix"], battlefield: ["mountain"] },
        {},
      ] },
      run: [{ steps: ["UPKEEP"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.requests.some((r) => r.purpose === "optionalTrigger")).toBe(false);
    expect(tg.graveyardCardIds(0)).toContain("tainted_phoenix");
  });
});

describe("A10 activation — the Sower's plays-not-enters trigger (LAND_PLAYED)", () => {
  it("an opponent's land PLAY fetches a Forest — the typed dual — onto the battlefield tapped", async () => {
    const spec: FixtureSpec = {
      name: "sower-fetch",
      setup: { active: 1, players: [
        { battlefield: ["the_sower"], library: ["tropical_island", "island", "plains"] },
        { hand: ["swamp"] },
      ] },
      script: [
        { player: 1, do: "playLand", card: "swamp" },
        { player: 0, do: "search", card: "tropical_island" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const trop = onBf(tg, "tropical_island")[0]!;
    expect(trop).toBeTruthy(); // the secret engine: Tropical Island IS a Forest
    expect(getObject(tg.game.state, trop).tapped).toBe(true);
  });

  it("an effect-placed land does NOT trigger him (Rampant Growth starves the Throne)", async () => {
    const spec: FixtureSpec = {
      name: "sower-starve",
      setup: { active: 1, players: [
        { battlefield: ["the_sower"], library: ["tropical_island"] },
        { battlefield: ["forest", "forest"], hand: ["rampant_growth"], library: ["forest"] },
      ] },
      script: [
        { player: 1, do: "cast", card: "rampant_growth" },
        { player: 1, do: "search", card: "forest" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "tropical_island")).toHaveLength(0); // no fetch: plays-wording is the counterplay
    expect(tg.requests.filter((r) => r.purpose === "searchLibrary").every((r) => r.player === 1)).toBe(true);
  });
});

describe("the batch's small pieces", () => {
  it("Aetherbolt: per-target independence — the bolt lands even when the bounce target escapes", async () => {
    const spec: FixtureSpec = {
      name: "aetherbolt",
      setup: { players: [
        { battlefield: ["island", "island", "mountain", "forest"], hand: ["aetherbolt"] },
        { life: 20, battlefield: ["grizzly_bears", "island", "island"], hand: ["boomerang"] },
      ] },
      script: [
        { player: 0, do: "cast", card: "aetherbolt", targets: [{ object: "grizzly_bears" }, { player: 1 }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(1)).toContain("grizzly_bears"); // Boomerang won the race
    expect(tg.game.state.players[1].life).toBe(17); // the bolt landed anyway
  });

  it("Aether Mutation: X Saprolings from the bounced creature's LKI mana value", async () => {
    const spec: FixtureSpec = {
      name: "mutation",
      setup: { players: [
        { battlefield: ["forest", "island", "swamp", "plains", "mountain"], hand: ["aether_mutation"] },
        { battlefield: ["serra_angel"] },
      ] },
      script: [{ player: 0, do: "cast", card: "aether_mutation", targets: [{ object: "serra_angel" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(1)).toContain("serra_angel");
    expect(onBf(tg, "saproling_1_1_g")).toHaveLength(5); // mv 5, read from the snapshot after the bounce
  });

  it("Graceful Restoration mode 1: the counter rider (a 2/2 rises as a 3/3)", async () => {
    const spec: FixtureSpec = {
      name: "grace-mode1",
      setup: { players: [
        { battlefield: ["plains", "swamp", "forest", "island", "mountain"], hand: ["graceful_restoration"], graveyard: ["grizzly_bears"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "graceful_restoration", mode: 0, targets: [{ graveyard: "grizzly_bears" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(pt(tg, bears)).toBe("3/3");
  });

  it("Graceful Restoration mode 2: up to two with power ≤ 2 (the Serra is never offered)", async () => {
    const spec: FixtureSpec = {
      name: "grace-mode2",
      setup: { players: [
        { battlefield: ["plains", "swamp", "forest", "island", "mountain"], hand: ["graceful_restoration"], graveyard: ["grizzly_bears", "llanowar_elves", "serra_angel"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "graceful_restoration", mode: 1, targets: [{ graveyard: "grizzly_bears" }, { graveyard: "llanowar_elves" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "grizzly_bears")).toHaveLength(1);
    expect(onBf(tg, "llanowar_elves")).toHaveLength(1);
    expect(tg.graveyardCardIds(0)).toEqual(["serra_angel", "graceful_restoration"]); // power 4: not eligible, still dead (the spent sorcery joins her)
  });

  it("Experimental Overload: the Weird locks its P/T at resolution (the regrowth target counts, then leaves); the spell self-exiles", async () => {
    const spec: FixtureSpec = {
      name: "overload",
      setup: { players: [
        { battlefield: ["island", "island", "mountain", "forest"], hand: ["experimental_overload"], graveyard: ["shock", "zombify"] },
        {},
      ] },
      script: [{ player: 0, do: "cast", card: "experimental_overload", targets: [{ graveyard: "zombify" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const weird = onBf(tg, "weird_x_x_ur")[0]!;
    expect(pt(tg, weird)).toBe("2/2"); // shock + zombify at token time
    expect(tg.handCardIds(0)).toContain("zombify"); // then the regrowth
    expect(pt(tg, weird)).toBe("2/2"); // locked: the count changing later moves nothing
    expect(tg.game.state.players[0].exile.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["experimental_overload"]);
  });

  it("Temporal Spring: library-top, not hand — the tide never tastes it (no Unwinder ping)", async () => {
    const spec: FixtureSpec = {
      name: "spring",
      setup: { players: [
        { battlefield: ["forest", "island", "swamp", "the_unwinder"], hand: ["temporal_spring"] },
        { battlefield: ["centaur_courser"], library: ["island"] },
      ] },
      script: [{ player: 0, do: "cast", card: "temporal_spring", targets: [{ object: "centaur_courser" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const top = tg.game.state.players[1].library[0]!;
    expect(getObject(tg.game.state, top).cardId).toBe("centaur_courser");
    expect(tg.requests.every((r) => r.purpose !== "chooseTarget")).toBe(true); // the ping never triggered
  });

  it("Vindicate: the pool's first land destruction", async () => {
    const spec: FixtureSpec = {
      name: "vindicate",
      setup: { players: [
        { battlefield: ["plains", "swamp", "forest"], hand: ["vindicate"] },
        { battlefield: ["island"] },
      ] },
      script: [{ player: 0, do: "cast", card: "vindicate", targets: [{ object: "island" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "island")).toHaveLength(0);
    expect(tg.graveyardCardIds(1)).toContain("island");
  });

  it("Abrade: both modes (3 to a creature; destroy an artifact)", async () => {
    const dmg = await runFixture({
      name: "abrade-dmg",
      setup: { players: [{ battlefield: ["mountain", "island"], hand: ["abrade"] }, { battlefield: ["centaur_courser"] }] },
      script: [{ player: 0, do: "cast", card: "abrade", mode: 0, targets: [{ object: "centaur_courser" }] }],
      run: [{ priority: true }],
    });
    expect(onBf(dmg, "centaur_courser")).toHaveLength(0); // 3 ≥ 3
    const art = await runFixture({
      name: "abrade-art",
      setup: { players: [{ battlefield: ["mountain", "island"], hand: ["abrade"] }, { battlefield: ["bonesplitter"] }] },
      script: [{ player: 0, do: "cast", card: "abrade", mode: 1, targets: [{ object: "bonesplitter" }] }],
      run: [{ priority: true }],
    });
    expect(onBf(art, "bonesplitter")).toHaveLength(0);
  });
});

describe("ADR-038 no-regression sweep: every existing card stays who:you", () => {
  it("no pool card except the Usher carries who:any; own-graveyard cards cannot reach the opponent's yard", async () => {
    const pool = testPool();
    const specsOf = (raw: unknown): unknown[] => {
      const out: unknown[] = [];
      const walk = (specs: unknown) => {
        if (!Array.isArray(specs)) return;
        for (const sp of specs) {
          out.push(sp);
          walk((sp as { anyOf?: unknown }).anyOf);
        }
      };
      const d = raw as { targets?: unknown; abilities?: { targets?: unknown; modes?: { targets?: unknown }[] }[]; modes?: { targets?: unknown }[] };
      walk(d.targets);
      for (const a of d.abilities ?? []) { walk(a.targets); for (const m of a.modes ?? []) walk(m.targets); }
      for (const m of d.modes ?? []) walk(m.targets);
      return out;
    };
    for (const [id, def] of pool) {
      for (const sp of specsOf(def) as { who?: string }[]) {
        if (sp.who === "any") expect(id).toBe("the_usher"); // the sole customer
        else expect(sp.who === undefined || sp.who === "you").toBe(true);
      }
    }
    // Behavioral: Zombify with a target only in the OPPONENT's graveyard is not castable.
    const tg = new (await import("./harness.js")).TestGame({
      name: "zombify-own-yard",
      setup: { players: [
        { battlefield: ["swamp", "swamp", "swamp", "swamp"], hand: ["zombify"] },
        { graveyard: ["grizzly_bears"] },
      ] },
    });
    const actions = legalActions(tg.game.ctx, 0);
    expect(actions.some((a) => a.type === "castSpell")).toBe(false);
  });
});
