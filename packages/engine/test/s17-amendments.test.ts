import { describe, expect, it } from "vitest";
import { characteristics, getObject } from "../src/index.js";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S17 fixtures — manifest amendments A4–A8 (ADR-075) on their first customers:
 * A4 counting refs (Tendrils, Gaean Wurm, Werebear, Baru), A5 zone abilities
 * (Airship Crash cycling, Mother Bear), A6 modal (Aether Channeler),
 * A7 additional costs (Goblin Grenade), A8 blink (Restoration Angel).
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const evt = (tg: TG, name: string) => tg.log.entries.filter((e) => e.t === "EVENT" && (e as { name: string }).name === name) as unknown as { name: string; payload: Record<string, unknown> }[];
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);
const pt = (tg: TG, id: string) => { const c = characteristics(tg.game.ctx, id); return `${c.power}/${c.toughness}`; };

describe("A4 — counting value refs", () => {
  it("Tendrils of Corruption: X = Swamps you control AT RESOLUTION (608.2h) — a Swamp bounced in response shrinks it; life gained matches", async () => {
    const spec: FixtureSpec = {
      name: "tendrils",
      setup: { players: [{ life: 10, battlefield: ["swamp", "swamp", "swamp", "swamp", "swamp"], hand: ["tendrils_of_corruption"] }, { battlefield: ["pelakka_wurm", "island", "island"], hand: ["boomerang"] }] },
      script: [
        { player: 0, do: "cast", card: "tendrils_of_corruption", targets: [{ object: "pelakka_wurm" }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "swamp" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    // Five Swamps at cast (four tapped for {3}{B}), one bounced in response → X = 4 at resolution.
    expect(onBf(tg, "swamp")).toHaveLength(4);
    const wurm = onBf(tg, "pelakka_wurm")[0]!;
    expect(getObject(st, wurm).damage).toBe(4);
    expect(st.players[0].life).toBe(14);
    const dmg = evt(tg, "DAMAGE").find((e) => e.payload.sourceCardId === "tendrils_of_corruption");
    expect(dmg?.payload.amount).toBe(4);
  });

  it("Gaean Wurm (custom #2): +1/+1 per Forest you control, live — a Forest bounced mid-combat shrinks it and trample damage recomputes", async () => {
    const spec: FixtureSpec = {
      name: "gaean",
      setup: {
        step: "DECLARE_ATTACKERS",
        players: [{ battlefield: ["gaean_wurm", "forest", "forest", "forest", "forest"] }, { life: 20, battlefield: ["grizzly_bears", "island", "island"], hand: ["boomerang"] }],
      },
      script: [
        { player: 0, do: "attack", attackers: ["gaean_wurm"] },
        { player: 1, do: "block", blocks: [{ blocker: "grizzly_bears", attacker: "gaean_wurm" }] },
        { player: 1, do: "cast", card: "boomerang", targets: [{ object: "forest" }] },
      ],
      run: [{ steps: ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const gaean = onBf(tg, "gaean_wurm")[0]!;
    expect(pt(tg, gaean)).toBe("4/4"); // three Forests left (5/5 before the bounce)
    expect(st.players[1].life).toBe(18); // 4 power: 2 lethal to the Bears, 2 tramples over (not 3)
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears");
  });

  it("Werebear: a mana dork that flips to 4/4 at EXACTLY seven cards in your graveyard (conditional static on graveyardCount) — milling yourself with the Adept is the driver", async () => {
    const six = ["forest", "forest", "forest", "forest", "forest", "forest"];
    const spec: FixtureSpec = {
      name: "werebear",
      setup: { players: [{ battlefield: ["werebear", "cathartic_adept"], graveyard: six, library: ["island", "island"] }, {}] },
      script: [{ player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 0 }] }],
      run: [{ priority: true }],
    };
    // Before: six in the graveyard → 1/1 (the static is off); the Werebear still taps for {G}.
    const tg0 = await runFixture({ ...spec, script: [], run: [] });
    const bear0 = onBf(tg0, "werebear")[0]!;
    expect(pt(tg0, bear0)).toBe("1/1");
    // After one self-mill: seven → 4/4.
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].graveyard).toHaveLength(7);
    expect(pt(tg, onBf(tg, "werebear")[0]!)).toBe("4/4");
  });

  it("Baru, Wurmspeaker: Wurms +2/+2 and trample; the token ability costs {X} less (X = greatest Wurm power) floored at {G}; a 4/4 Wurm token arrives (6/6 trample under Baru)", async () => {
    // With a Pelakka Wurm (7/7 → 9/9 under Baru) the {7}{G} ability costs {G}: one Forest pays it.
    const spec: FixtureSpec = {
      name: "baru-floor",
      setup: { players: [{ battlefield: ["baru_wurmspeaker", "pelakka_wurm", "forest"] }, {}] },
      script: [{ player: 0, do: "activate", card: "baru_wurmspeaker", abilityIndex: 1 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const pel = onBf(tg, "pelakka_wurm")[0]!;
    expect(pt(tg, pel)).toBe("9/9");
    expect(characteristics(tg.game.ctx, pel).keywords.has("trample")).toBe(true);
    const token = onBf(tg, "wurm_4_4")[0]!;
    expect(token).toBeTruthy();
    expect(pt(tg, token)).toBe("6/6");
    expect(characteristics(tg.game.ctx, token).keywords.has("trample")).toBe(true);
    expect(getObject(tg.game.state, onBf(tg, "baru_wurmspeaker")[0]!).tapped).toBe(true);
    // No Wurm: the full {7}{G} — one Forest is not enough; eight lands are.
    const none: FixtureSpec = { name: "baru-full", setup: { players: [{ battlefield: ["baru_wurmspeaker", "forest"] }, {}] }, run: [{ priority: true }] };
    const tg2 = await runFixture(none);
    expect(tg2.requests.some((r) => r.purpose === "priority" && r.actions.some((a) => a.type === "activateAbility"))).toBe(false);
    const eight: FixtureSpec = { name: "baru-eight", setup: { players: [{ battlefield: ["baru_wurmspeaker", ...Array(8).fill("forest")] }, {}] }, script: [{ player: 0, do: "activate", card: "baru_wurmspeaker", abilityIndex: 1 }], run: [{ priority: true }] };
    const tg3 = await runFixture(eight);
    expect(onBf(tg3, "wurm_4_4")).toHaveLength(1);
    expect(onBf(tg3, "forest").every((id) => getObject(tg3.game.state, id).tapped)).toBe(true);
    // With a mid Wurm (Gaean at 4/4 → 6/6): costs {1}{G} → two Forests suffice after the first token… the reduction reads the greatest power NOW.
    const mid: FixtureSpec = { name: "baru-mid", setup: { players: [{ battlefield: ["baru_wurmspeaker", "gaean_wurm", "forest", "forest", "forest", "forest"] }, {}] }, script: [{ player: 0, do: "activate", card: "baru_wurmspeaker", abilityIndex: 1 }], run: [{ priority: true }] };
    const tg4 = await runFixture(mid);
    // Gaean: 1/1 + 4 Forests + Baru's +2/+2 = 7/7 → X = 7 → {G}… one Forest taps.
    expect(onBf(tg4, "wurm_4_4")).toHaveLength(1);
    expect(onBf(tg4, "forest").filter((id) => getObject(tg4.game.state, id).tapped)).toHaveLength(1);
  });
});

describe("A5 — zone-scoped abilities (cycling, graveyard)", () => {
  it("Airship Crash cycles from hand at instant speed ({2}, discard it: draw); the cycled card lands in the graveyard having triggered nothing; Crash itself destroys a flier / artifact / enchantment and not a grounded creature", async () => {
    // Opponent's turn: instant-speed cycling.
    const cyc: FixtureSpec = {
      name: "crash-cycle",
      setup: { active: 1, players: [{ battlefield: ["forest", "forest"], hand: ["airship_crash"], library: ["grizzly_bears"] }, { battlefield: ["island"], hand: ["island"] }] },
      script: [{ player: 0, do: "activate", card: "airship_crash", abilityIndex: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(cyc);
    expect(tg.handCardIds(0)).toEqual(["grizzly_bears"]);
    expect(tg.graveyardCardIds(0)).toEqual(["airship_crash"]);
    expect(tg.game.state.pendingTriggers).toHaveLength(0);
    expect(evt(tg, "DISCARD")).toHaveLength(0); // DISCARD isn't a logged fact; the bus event fired (Waste Not test covers it)
    // Targets: a flier, an artifact, an enchantment are legal; a grounded creature is not.
    const targ: FixtureSpec = {
      name: "crash-targets",
      setup: { players: [{ battlefield: ["forest", "forest", "forest"], hand: ["airship_crash"] }, { battlefield: ["wind_drake", "grizzly_bears", "mind_stone", "pacifism_host"] }] },
      run: [{ priority: true }],
    };
    // (pacifism_host isn't a card — use a real enchantment: Glorious Anthem.)
    targ.setup.players[1].battlefield = ["wind_drake", "grizzly_bears", "mind_stone", "glorious_anthem"];
    const tg2 = await runFixture(targ);
    const first = tg2.requests.find((r) => r.purpose === "priority")!;
    const casts = first.actions.filter((a) => a.type === "castSpell").map((a) => getObject(tg2.game.state, (a as { targets: { id: string }[] }).targets[0]!.id).cardId).sort();
    expect(casts).toEqual(["glorious_anthem", "mind_stone", "wind_drake"]);
    const kill: FixtureSpec = { ...targ, name: "crash-kill", script: [{ player: 0, do: "cast", card: "airship_crash", targets: [{ object: "wind_drake" }] }] };
    const tg3 = await runFixture(kill);
    expect(tg3.graveyardCardIds(1)).toContain("wind_drake");
  });

  it("Mother Bear: {3}{G}{G}, exile her from your graveyard — sorcery speed only — for two 2/2 Bears; a milled Mother Bear is activatable (Adept synergy)", async () => {
    const spec: FixtureSpec = {
      name: "mother-bear",
      setup: { players: [{ battlefield: ["forest", "forest", "forest", "forest", "forest"], graveyard: ["mother_bear"] }, {}] },
      script: [{ player: 0, do: "activate", card: "mother_bear", abilityIndex: 0 }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "bear_2_2")).toHaveLength(2);
    expect(tg.graveyardCardIds(0)).not.toContain("mother_bear");
    expect(tg.game.state.players[0].exile.map((id) => getObject(tg.game.state, id).cardId)).toContain("mother_bear");
    // Sorcery-only: on the opponent's turn the ability is not offered.
    const instant: FixtureSpec = { ...spec, name: "mother-bear-instant", setup: { active: 1, players: [{ battlefield: ["forest", "forest", "forest", "forest", "forest"], graveyard: ["mother_bear"], hand: ["forest"] }, { hand: ["island"] }] }, script: [] };
    const tg2 = await runFixture(instant);
    expect(tg2.requests.some((r) => r.purpose === "priority" && r.player === 0 && r.actions.some((a) => a.type === "activateAbility"))).toBe(false);
    // Milled into the graveyard → activatable next priority.
    const milled: FixtureSpec = {
      name: "mother-bear-milled",
      setup: { players: [{ battlefield: ["cathartic_adept", ...Array(5).fill("forest")], library: ["mother_bear", "forest"] }, {}] },
      script: [
        { player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 0 }] },
        { player: 0, do: "activate", card: "mother_bear", abilityIndex: 0 },
      ],
      run: [{ priority: true }],
    };
    const tg3 = await runFixture(milled);
    expect(onBf(tg3, "bear_2_2")).toHaveLength(2);
  });
});

describe("A6 — modal 'choose one' (Aether Channeler)", () => {
  const base = (opp: string[]) => ({ players: [{ battlefield: ["island", "island", "island"], hand: ["aether_channeler"], library: ["forest"] }, { battlefield: opp }] as [never, never] });
  it("mode 1: a 1/1 white Bird with flying", async () => {
    const tg = await runFixture({ name: "channeler-bird", setup: base(["grizzly_bears"]), script: [{ player: 0, do: "cast", card: "aether_channeler" }, { player: 0, do: "chooseMode", mode: 0 }], run: [{ priority: true }] });
    expect(onBf(tg, "bird_1_1_flying")).toHaveLength(1);
    expect(tg.requests.find((r) => r.purpose === "chooseMode")!.actions).toHaveLength(3);
  });
  it("mode 2: bounce another target nonland permanent (targets chosen AFTER the mode); the Channeler itself and lands are not targets", async () => {
    const tg = await runFixture({ name: "channeler-bounce", setup: base(["grizzly_bears", "forest"]), script: [{ player: 0, do: "cast", card: "aether_channeler" }, { player: 0, do: "chooseMode", mode: 1 }], run: [{ priority: true }] });
    // Only one legal target (the Bears) → chosen silently; it is back in hand.
    expect(tg.handCardIds(1)).toEqual(["grizzly_bears"]);
    expect(onBf(tg, "aether_channeler")).toHaveLength(1);
    expect(tg.requests.some((r) => r.purpose === "chooseTarget")).toBe(false);
  });
  it("mode 3: draw a card", async () => {
    const tg = await runFixture({ name: "channeler-draw", setup: base([]), script: [{ player: 0, do: "cast", card: "aether_channeler" }, { player: 0, do: "chooseMode", mode: 2 }], run: [{ priority: true }] });
    expect(tg.handCardIds(0)).toEqual(["forest"]);
  });
  it("601.2b legality: with no other nonland permanent the bounce mode is not offerable (two modes requested); the mode index is logged", async () => {
    const tg = await runFixture({ name: "channeler-nomode", setup: base(["forest"]), script: [{ player: 0, do: "cast", card: "aether_channeler" }, { player: 0, do: "chooseMode", mode: 2 }], run: [{ priority: true }] });
    const req = tg.requests.find((r) => r.purpose === "chooseMode")!;
    expect(req.actions.map((a) => (a as { mode: number }).mode)).toEqual([0, 2]);
    const logged = tg.log.entries.find((e) => e.t === "ACTION" && (e as { action: { type: string } }).action.type === "chooseMode") as { action: { mode: number } } | undefined;
    expect(logged?.action.mode).toBe(2);
  });
});

describe("A7 — additional spell costs (Goblin Grenade)", () => {
  it("sacrifices a Goblin as the spell is cast (601.2h); the Goblin's DIES trigger goes on the stack above the Grenade and resolves first; 5 damage to any target; no Goblin → not castable", async () => {
    const spec: FixtureSpec = {
      name: "grenade",
      setup: { players: [{ battlefield: ["mountain", "test_goblin_martyr"], hand: ["goblin_grenade"], library: ["forest"] }, { life: 20 }] },
      script: [{ player: 0, do: "cast", card: "goblin_grenade", targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.graveyardCardIds(0).sort()).toEqual(["goblin_grenade", "test_goblin_martyr"]);
    expect(tg.game.state.players[1].life).toBe(15);
    expect(tg.handCardIds(0)).toEqual(["forest"]); // the martyr's DIES draw
    const idxDraw = tg.log.entries.findIndex((e) => e.t === "EVENT" && (e as { name: string }).name === "CARD_DRAWN");
    const idxDmg = tg.log.entries.findIndex((e) => e.t === "EVENT" && (e as { name: string }).name === "DAMAGE");
    expect(idxDraw).toBeGreaterThan(-1);
    expect(idxDraw).toBeLessThan(idxDmg); // trigger resolved before the Grenade
    const none: FixtureSpec = { name: "grenade-nogoblin", setup: { players: [{ battlefield: ["mountain", "grizzly_bears"], hand: ["goblin_grenade"] }, {}] }, run: [{ priority: true }] };
    const tg2 = await runFixture(none);
    expect(tg2.requests.some((r) => r.purpose === "priority" && r.actions.some((a) => a.type === "castSpell"))).toBe(false);
  });
});

describe("A8 — blink (Restoration Angel)", () => {
  it("flash; ETB may exile another target non-Angel creature you control and return it as a NEW object under your control — ETBs refire (a blinked Rager draws and drains again); Angels are not targets", async () => {
    const spec: FixtureSpec = {
      name: "resto",
      setup: { active: 1, players: [{ life: 20, battlefield: ["plains", "plains", "plains", "plains", "phyrexian_rager", "youthful_valkyrie"], hand: ["restoration_angel"], library: ["forest", "forest"] }, { hand: ["island"] }] },
      script: [{ player: 0, do: "cast", card: "restoration_angel" }, { player: 0, do: "optional", accept: true }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const rager = onBf(tg, "phyrexian_rager")[0]!;
    expect(rager).toBeTruthy();
    expect(getObject(st, rager).summoningSick).toBe(true); // a new object
    expect(tg.handCardIds(0)).toEqual(["forest"]); // Rager's ETB: drew again…
    expect(st.players[0].life).toBe(19); // …and lost 1 again
    // The trigger had exactly one legal target (the Rager): the Valkyrie (an Angel) was never offered.
    expect(tg.requests.some((r) => r.purpose === "chooseTarget")).toBe(false);
    expect(getObject(st, rager).controller).toBe(0);
  });
  it("no legal target (only Angels / nothing else) → the trigger never goes on the stack; the Angel still enters as a flash blocker", async () => {
    const spec: FixtureSpec = {
      name: "resto-none",
      setup: { active: 1, players: [{ battlefield: ["plains", "plains", "plains", "plains", "youthful_valkyrie"], hand: ["restoration_angel"] }, { hand: ["island"] }] },
      script: [{ player: 0, do: "cast", card: "restoration_angel" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "restoration_angel")).toHaveLength(1);
    expect(evt(tg, "TRIGGER_NO_TARGETS").some((e) => e.payload.cardId === "restoration_angel")).toBe(true);
    expect(tg.requests.some((r) => r.purpose === "optionalTrigger")).toBe(false);
  });
});
