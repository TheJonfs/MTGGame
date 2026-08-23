import { describe, expect, it } from "vitest";
import { characteristics, getObject, type Action } from "../src/index.js";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S17 fixtures — ADR-076 small systems and the rest of Expansion 1 where
 * nontrivial: Bouncer's discard cost, Matron's subtype search (+ fail-to-find),
 * Blood Artist (both sides, itself, simultaneous Wrath deaths), Bitterblossom's
 * upkeep, Waste Not's three payloads (incl. triggered mana), Dark Ritual's
 * same-step spend, Scepter tapping a land, Essence Scatter / Disenchant
 * predicates, Gravitational Shift, Little Bear's conditional clause, the
 * Aristocrat, Skirk Prospector, Hypnotic Specter, Valkyrie/Overseer/Fisher/Raven.
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);
const pt = (tg: TG, id: string) => { const c = characteristics(tg.game.ctx, id); return `${c.power}/${c.toughness}`; };
const priorityOffers = (tg: TG, pred: (a: Action) => boolean) => tg.requests.some((r) => r.purpose === "priority" && r.actions.some(pred));

describe("ADR-076 — costs and predicates", () => {
  it("Waterfront Bouncer: {U},{T}, discard a card (chooser's pick) → bounce; not offered with an empty hand", async () => {
    const spec: FixtureSpec = {
      name: "bouncer",
      setup: { players: [{ battlefield: ["waterfront_bouncer", "island"], hand: ["forest", "grizzly_bears"] }, { battlefield: ["pelakka_wurm"] }] },
      script: [
        { player: 0, do: "activate", card: "waterfront_bouncer", abilityIndex: 0, targets: [{ object: "pelakka_wurm" }] },
        { player: 0, do: "discard", card: "forest" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(1)).toEqual(["pelakka_wurm"]);
    expect(tg.graveyardCardIds(0)).toEqual(["forest"]);
    expect(tg.handCardIds(0)).toEqual(["grizzly_bears"]);
    expect(tg.requests.some((r) => r.purpose === "discardCost")).toBe(true);
    const empty: FixtureSpec = { ...spec, name: "bouncer-empty", setup: { players: [{ battlefield: ["waterfront_bouncer", "island"] }, { battlefield: ["pelakka_wurm"] }] }, script: [] };
    const tg2 = await runFixture(empty);
    expect(priorityOffers(tg2, (a) => a.type === "activateAbility")).toBe(false);
  });

  it("Goblin Matron: ETB may search for a Goblin card (subtype predicate) to hand; fail-to-find issues no request and still shuffles", async () => {
    const spec: FixtureSpec = {
      name: "matron",
      setup: { players: [{ battlefield: ["mountain", "mountain", "mountain"], hand: ["goblin_matron"], library: ["forest", "raging_goblin", "goblin_piker", "island"] }, {}] },
      script: [{ player: 0, do: "cast", card: "goblin_matron" }, { player: 0, do: "optional", accept: true }, { player: 0, do: "search", card: "goblin_piker" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.handCardIds(0)).toEqual(["goblin_piker"]);
    const req = tg.requests.find((r) => r.purpose === "searchLibrary")!;
    expect(req.revealed?.map((r) => r.cardId).sort()).toEqual(["goblin_piker", "raging_goblin"]); // Goblins only
    const none: FixtureSpec = { ...spec, name: "matron-none", setup: { players: [{ battlefield: ["mountain", "mountain", "mountain"], hand: ["goblin_matron"], library: ["forest", "island"] }, {}] }, script: [{ player: 0, do: "cast", card: "goblin_matron" }, { player: 0, do: "optional", accept: true }] };
    const tg2 = await runFixture(none);
    expect(tg2.requests.some((r) => r.purpose === "searchLibrary")).toBe(false);
    expect(tg2.log.entries.some((e) => e.t === "RNG" && (e as { purpose: string }).purpose === "shuffle")).toBe(true);
  });

  it("Essence Scatter counters a creature spell but cannot target an instant; Disenchant hits artifact-or-enchantment and not a creature", async () => {
    const scatter: FixtureSpec = {
      name: "scatter",
      setup: { active: 1, players: [{ battlefield: ["island", "island"], hand: ["essence_scatter"] }, { battlefield: ["forest", "forest", "mountain"], hand: ["grizzly_bears", "lightning_bolt"] }] },
      script: [
        { player: 1, do: "cast", card: "grizzly_bears" },
        { player: 0, do: "cast", card: "essence_scatter", targets: [{ spell: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(scatter);
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears");
    expect(onBf(tg, "grizzly_bears")).toHaveLength(0);
    // Bolt on the stack: Scatter has no legal target → never offered.
    const noncreature: FixtureSpec = { ...scatter, name: "scatter-bolt", script: [{ player: 1, do: "cast", card: "lightning_bolt", targets: [{ player: 0 }] }] };
    const tg2 = await runFixture(noncreature);
    expect(tg2.requests.some((r) => r.purpose === "priority" && r.player === 0 && r.actions.some((a) => a.type === "castSpell"))).toBe(false);
    const dis: FixtureSpec = {
      name: "disenchant",
      setup: { players: [{ battlefield: ["plains", "plains"], hand: ["disenchant"] }, { battlefield: ["mind_stone", "glorious_anthem", "grizzly_bears"] }] },
      run: [{ priority: true }],
    };
    const tg3 = await runFixture(dis);
    const first = tg3.requests.find((r) => r.purpose === "priority")!;
    const targets = first.actions.filter((a) => a.type === "castSpell").map((a) => getObject(tg3.game.state, (a as { targets: { id: string }[] }).targets[0]!.id).cardId).sort();
    expect(targets).toEqual(["glorious_anthem", "mind_stone"]);
  });

  it("Gravitational Shift: fliers +2/+0, non-fliers −2/−0 (keyword-filtered statics), both sides", async () => {
    const spec: FixtureSpec = { name: "gshift", setup: { players: [{ battlefield: ["gravitational_shift", "wind_drake", "grizzly_bears"] }, { battlefield: ["serra_angel", "gray_ogre"] }] }, run: [] };
    const tg = await runFixture(spec);
    expect(pt(tg, onBf(tg, "wind_drake")[0]!)).toBe("4/2");
    expect(pt(tg, onBf(tg, "grizzly_bears")[0]!)).toBe("0/2");
    expect(pt(tg, onBf(tg, "serra_angel")[0]!)).toBe("6/4");
    expect(pt(tg, onBf(tg, "gray_ogre")[0]!)).toBe("0/2");
  });

  it("Little Bear: flash; ETB untaps another target creature you control, and only a Bear gets the +1/+1 counter (conditional clause on the target's characteristics)", async () => {
    const bear: FixtureSpec = {
      name: "little-bear-bear",
      setup: { active: 1, players: [{ battlefield: ["forest", "forest", "forest", { card: "grizzly_bears", tapped: true }], hand: ["little_bear"] }, { hand: ["island"] }] },
      script: [{ player: 0, do: "cast", card: "little_bear" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(bear);
    const gb = onBf(tg, "grizzly_bears")[0]!;
    expect(getObject(tg.game.state, gb).tapped).toBe(false);
    expect(pt(tg, gb)).toBe("3/3");
    const notBear: FixtureSpec = { ...bear, name: "little-bear-ogre", setup: { active: 1, players: [{ battlefield: ["forest", "forest", "forest", { card: "gray_ogre", tapped: true }], hand: ["little_bear"] }, { hand: ["island"] }] } };
    const tg2 = await runFixture(notBear);
    const ogre = onBf(tg2, "gray_ogre")[0]!;
    expect(getObject(tg2.game.state, ogre).tapped).toBe(false);
    expect(pt(tg2, ogre)).toBe("2/2");
    // "Another": the Little Bear itself is never the target (alone on the board → no trigger).
    const alone: FixtureSpec = { ...bear, name: "little-bear-alone", setup: { active: 1, players: [{ battlefield: ["forest", "forest", "forest"], hand: ["little_bear"] }, { hand: ["island"] }] } };
    const tg3 = await runFixture(alone);
    expect(onBf(tg3, "little_bear")).toHaveLength(1);
    expect(tg3.game.state.stack).toHaveLength(0);
  });
});

describe("ADR-076 — triggers: observed deaths, upkeep, discards", () => {
  it("Blood Artist: this or ANOTHER creature dies (either side) → target player loses 1, you gain 1; simultaneous Wrath deaths all count, including its own", async () => {
    const spec: FixtureSpec = {
      name: "blood-artist-wrath",
      setup: { players: [{ life: 20, battlefield: ["blood_artist", "grizzly_bears", "typhoid_rats"] }, { life: 20, battlefield: ["plains", "plains", "plains", "plains", "gray_ogre", "wind_drake"], hand: ["wrath_of_god"] }] },
      script: [
        { player: 1, do: "cast", card: "wrath_of_god" },
        ...Array.from({ length: 5 }, () => ({ player: 0 as const, do: "chooseTriggerTargets" as const, targets: [{ player: 1 }] })),
      ],
      run: [{ priority: true }],
    };
    // Player 1 is active so its Wrath cast comes first in the script order.
    spec.setup.active = 1;
    const tg = await runFixture(spec);
    expect(tg.game.state.battlefield.filter((id) => ["blood_artist", "grizzly_bears", "typhoid_rats", "gray_ogre", "wind_drake"].includes(getObject(tg.game.state, id).cardId))).toHaveLength(0);
    expect(tg.game.state.players[1].life).toBe(15); // five deaths, Blood Artist's own included
    expect(tg.game.state.players[0].life).toBe(25);
  });

  it("Blood Artist: a single opposing creature dying in combat drains; its controller may aim the drain at either player (target)", async () => {
    const spec: FixtureSpec = {
      name: "blood-artist-one",
      setup: { players: [{ battlefield: ["blood_artist", "mountain"], hand: ["shock"] }, { life: 20, battlefield: ["grizzly_bears"] }] },
      script: [{ player: 0, do: "cast", card: "shock", targets: [{ object: "grizzly_bears" }] }, { player: 0, do: "chooseTriggerTargets", targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[1].life).toBe(19);
    expect(tg.game.state.players[0].life).toBe(21);
  });

  it("Bitterblossom: at the beginning of YOUR upkeep lose 1 and make a 1/1 flying Faerie Rogue; not on the opponent's upkeep", async () => {
    const mine: FixtureSpec = { name: "bitterblossom", setup: { active: 0, step: "UNTAP", players: [{ life: 20, battlefield: ["bitterblossom"] }, {}] }, run: [{ steps: ["UPKEEP"] }] };
    const tg = await runFixture(mine);
    expect(onBf(tg, "faerie_rogue_1_1_flying")).toHaveLength(1);
    expect(tg.game.state.players[0].life).toBe(19);
    expect(characteristics(tg.game.ctx, onBf(tg, "faerie_rogue_1_1_flying")[0]!).keywords.has("flying")).toBe(true);
    const theirs: FixtureSpec = { ...mine, name: "bitterblossom-opp", setup: { active: 1, step: "UNTAP", players: [{ life: 20, battlefield: ["bitterblossom"] }, {}] } };
    const tg2 = await runFixture(theirs);
    expect(onBf(tg2, "faerie_rogue_1_1_flying")).toHaveLength(0);
    expect(tg2.game.state.players[0].life).toBe(20);
  });

  it("Waste Not: an opponent's discards pay out by card type — creature → 2/2 Zombie, land → {B}{B} in the pool (triggered mana, resolved to the pool), noncreature nonland → draw", async () => {
    const spec: FixtureSpec = {
      name: "waste-not",
      setup: { players: [{ battlefield: ["waste_not", "swamp", "swamp", "swamp"], hand: ["mind_rot"], library: ["forest"] }, { hand: ["grizzly_bears", "island", "lightning_bolt"] }] },
      script: [
        { player: 0, do: "cast", card: "mind_rot", targets: [{ player: 1 }] },
        { player: 1, do: "discard", card: "grizzly_bears" },
        { player: 1, do: "discard", card: "island" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "zombie_2_2")).toHaveLength(1);
    expect(tg.game.state.players[0].manaPool.B).toBe(2); // still floating at the end of the priority round
    expect(tg.handCardIds(0)).toEqual([]); // no draw: nothing noncreature-nonland was discarded
    const third: FixtureSpec = { ...spec, name: "waste-not-draw", script: [{ player: 0, do: "cast", card: "mind_rot", targets: [{ player: 1 }] }, { player: 1, do: "discard", card: "lightning_bolt" }, { player: 1, do: "discard", card: "island" }] };
    const tg2 = await runFixture(third);
    expect(tg2.handCardIds(0)).toEqual(["forest"]);
    expect(onBf(tg2, "zombie_2_2")).toHaveLength(0);
    // Your OWN discards don't trigger it (cleanup discard / Hymn at your own head).
    const own: FixtureSpec = { name: "waste-not-own", setup: { players: [{ battlefield: ["waste_not", "swamp", "swamp"], hand: ["hymn_to_tourach", "grizzly_bears", "forest"] }, {}] }, script: [{ player: 0, do: "cast", card: "hymn_to_tourach", targets: [{ player: 0 }] }], run: [{ priority: true }] };
    const tg3 = await runFixture(own);
    expect(onBf(tg3, "zombie_2_2")).toHaveLength(0);
    expect(tg3.game.state.players[0].manaPool.B).toBe(0);
  });

  it("Hypnotic Specter: combat damage to an opponent → that player discards at random (logged RNG)", async () => {
    const spec: FixtureSpec = {
      name: "specter",
      setup: { step: "DECLARE_ATTACKERS", players: [{ battlefield: ["hypnotic_specter"] }, { life: 20, hand: ["forest", "island"] }] },
      script: [{ player: 0, do: "attack", attackers: ["hypnotic_specter"] }],
      run: [{ steps: ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[1].life).toBe(18);
    expect(tg.handCardIds(1)).toHaveLength(1);
    expect(tg.graveyardCardIds(1)).toHaveLength(1);
    expect(tg.log.entries.some((e) => e.t === "RNG" && (e as { purpose: string }).purpose === "discard")).toBe(true);
  });
});

describe("Expansion 1 — the rest", () => {
  it("Dark Ritual: {B} → {B}{B}{B} floats and pays a {1}{B}{B} Specter in the same step", async () => {
    const spec: FixtureSpec = {
      name: "ritual",
      setup: { players: [{ battlefield: ["swamp"], hand: ["dark_ritual", "hypnotic_specter"] }, {}] },
      script: [{ player: 0, do: "cast", card: "dark_ritual" }, { player: 0, do: "cast", card: "hypnotic_specter" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "hypnotic_specter")).toHaveLength(1);
    expect(tg.graveyardCardIds(0)).toEqual(["dark_ritual"]);
  });

  it("Scepter of Dominance taps target permanent — a land included; Master Decoy taps target creature", async () => {
    const spec: FixtureSpec = {
      name: "scepter",
      setup: { players: [{ battlefield: ["scepter_of_dominance", "plains", "master_decoy", "plains"] }, { battlefield: ["forest", "grizzly_bears"] }] },
      script: [
        { player: 0, do: "activate", card: "scepter_of_dominance", abilityIndex: 0, targets: [{ object: "forest" }] },
        { player: 0, do: "activate", card: "master_decoy", abilityIndex: 0, targets: [{ object: "grizzly_bears" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(getObject(tg.game.state, onBf(tg, "forest")[0]!).tapped).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "grizzly_bears")[0]!).tapped).toBe(true);
  });

  it("Indulgent Aristocrat: {2}, sacrifice a creature (itself allowed) → +1/+1 counter on each Vampire you control; Skirk Prospector: sacrifice a Goblin → {R} (one deliberate action, no colour fan-out)", async () => {
    const spec: FixtureSpec = {
      name: "aristocrat",
      setup: { players: [{ battlefield: ["indulgent_aristocrat", "vampire_nighthawk", "grizzly_bears", "swamp", "swamp"] }, {}] },
      script: [{ player: 0, do: "activate", card: "indulgent_aristocrat", abilityIndex: 0 }, { player: 0, do: "sacrificeChoice", card: "grizzly_bears" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(pt(tg, onBf(tg, "indulgent_aristocrat")[0]!)).toBe("2/2");
    expect(pt(tg, onBf(tg, "vampire_nighthawk")[0]!)).toBe("3/4");
    expect(tg.graveyardCardIds(0)).toEqual(["grizzly_bears"]);
    // Saccing itself is legal: the Nighthawk still gets the counter.
    const self: FixtureSpec = { ...spec, name: "aristocrat-self", script: [{ player: 0, do: "activate", card: "indulgent_aristocrat", abilityIndex: 0 }, { player: 0, do: "sacrificeChoice", card: "indulgent_aristocrat" }] };
    const tg2 = await runFixture(self);
    expect(onBf(tg2, "indulgent_aristocrat")).toHaveLength(0);
    expect(pt(tg2, onBf(tg2, "vampire_nighthawk")[0]!)).toBe("3/4");
    const pros: FixtureSpec = {
      name: "prospector",
      setup: { players: [{ battlefield: ["skirk_prospector", "raging_goblin"], hand: ["shock"] }, { life: 20 }] },
      script: [{ player: 0, do: "activate", card: "skirk_prospector", abilityIndex: 0 }, { player: 0, do: "sacrificeChoice", card: "raging_goblin" }, { player: 0, do: "cast", card: "shock", targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg3 = await runFixture(pros);
    expect(tg3.game.state.players[1].life).toBe(18); // the {R} paid for Shock
    const first = tg3.requests.find((r) => r.purpose === "priority")!;
    expect(first.actions.filter((a) => a.type === "activateAbility")).toHaveLength(1); // one action, no colour choice
  });

  it("Youthful Valkyrie grows when ANOTHER Angel you control enters (not an opponent's, not itself); Inspiring Overseer gains 1 + draws; Aven Fisher's death may draw; Mist Raven's ETB bounces", async () => {
    const val: FixtureSpec = {
      name: "valkyrie",
      setup: { players: [{ battlefield: ["youthful_valkyrie", "plains", "plains", "plains"], hand: ["inspiring_overseer"], library: ["forest"] }, { battlefield: ["plains", "plains", "plains", "plains"], hand: ["restoration_angel"] }] },
      script: [{ player: 0, do: "cast", card: "inspiring_overseer" }, { player: 1, do: "cast", card: "restoration_angel" }], // flash: the opponent's Angel enters in response
      run: [{ priority: true }],
    };
    const tg = await runFixture(val);
    expect(pt(tg, onBf(tg, "youthful_valkyrie")[0]!)).toBe("2/4"); // +1 for the Overseer, not for the opponent's Restoration Angel
    expect(onBf(tg, "restoration_angel")).toHaveLength(1);
    expect(tg.handCardIds(0)).toEqual(["forest"]); // Overseer drew
    expect(tg.game.state.players[0].life).toBe(21);
    const fisher: FixtureSpec = {
      name: "fisher",
      setup: { players: [{ battlefield: ["mountain"], hand: ["lightning_bolt"] }, { battlefield: ["aven_fisher"], library: ["island"] }] },
      script: [{ player: 0, do: "cast", card: "lightning_bolt", targets: [{ object: "aven_fisher" }] }, { player: 1, do: "optional", accept: true }],
      run: [{ priority: true }],
    };
    const tg2 = await runFixture(fisher);
    expect(tg2.handCardIds(1)).toEqual(["island"]);
    const raven: FixtureSpec = {
      name: "raven",
      setup: { players: [{ battlefield: ["island", "island", "island", "island"], hand: ["mist_raven"] }, { battlefield: ["grizzly_bears"] }] },
      script: [{ player: 0, do: "cast", card: "mist_raven" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] }],
      run: [{ priority: true }],
    };
    const tg3 = await runFixture(raven);
    expect(tg3.handCardIds(1)).toEqual(["grizzly_bears"]);
  });

  it("Hordeling Outburst makes three Goblins; Werebear taps for mana like a land would not (sick gate applies); Air Elemental is a 4/4 flier; Moss Viper/Treetop have deathtouch", async () => {
    const spec: FixtureSpec = {
      name: "horde",
      setup: { players: [{ battlefield: ["mountain", "mountain", "mountain", "air_elemental", "moss_viper", "treetop_snarespinner"], hand: ["hordeling_outburst"] }, {}] },
      script: [{ player: 0, do: "cast", card: "hordeling_outburst" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "goblin_1_1")).toHaveLength(3);
    expect(pt(tg, onBf(tg, "air_elemental")[0]!)).toBe("4/4");
    expect(characteristics(tg.game.ctx, onBf(tg, "air_elemental")[0]!).keywords.has("flying")).toBe(true);
    expect(characteristics(tg.game.ctx, onBf(tg, "moss_viper")[0]!).keywords.has("deathtouch")).toBe(true);
    expect(characteristics(tg.game.ctx, onBf(tg, "treetop_snarespinner")[0]!).keywords.has("reach")).toBe(true);
  });
});
