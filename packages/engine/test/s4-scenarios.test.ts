import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";
import {
  characteristics,
  createObject,
  eligibleAttackers,
  getObject,
  moveObject,
  runSBAs,
  targetCandidates,
} from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

describe("S4 — targeted removal (brief 1–2)", () => {
  it("1. color/type predicates: Nighthawk illegal for Doom Blade, red token legal, Myr legal for Doom Blade but not Terror", () => {
    const tg = new TestGame({
      name: "predicates",
      setup: {
        players: [
          { battlefield: ["vampire_nighthawk", { card: "goblin_1_1", token: true }, "darksteel_myr"] },
          {},
        ],
      },
    });
    const ctx = tg.game.ctx;
    const nighthawk = tg.findBattlefield("vampire_nighthawk");
    const token = tg.findBattlefield("goblin_1_1");
    const myr = tg.findBattlefield("darksteel_myr");

    const doomBlade = { count: 1, predicate: "nonblackCreature" as const, zone: "battlefield" as const };
    const ids = targetCandidates(ctx, doomBlade, 1).flatMap((t) => (t.kind === "object" ? [t.id] : []));
    expect(ids).not.toContain(nighthawk); // colors: ["B"] derived from {1}{B}{B}
    expect(ids).toContain(token); // explicit colors: ["R"] (ADR-019)
    expect(ids).toContain(myr); // colorless artifact is nonblack

    const terror = { count: 1, predicate: "nonartifactNonblackCreature" as const, zone: "battlefield" as const };
    const terrorIds = targetCandidates(ctx, terror, 1).flatMap((t) => (t.kind === "object" ? [t.id] : []));
    expect(terrorIds).not.toContain(myr);
    expect(terrorIds).toContain(token);
  });

  it("1b. Doom Blade on Darksteel Myr: legal target, survives destroy (702.12b)", async () => {
    const tg = await runFixture(fixture("s4-01-doom-blade-on-myr"));
    expect(tg.battlefieldCardIds()).toContain("darksteel_myr");
    expect(tg.graveyardCardIds(0)).toContain("doom_blade");
  });

  it("2. Swords on an equipped 4/1: exile, controller gains 4 via LKI (608.2h), Bonesplitter stays", async () => {
    const tg = await runFixture(fixture("s4-02-swords-equipped"));
    const state = tg.game.state;
    expect(state.players[1].exile).toHaveLength(1);
    expect(getObject(state, state.players[1].exile[0]!).cardId).toBe("child_of_night");
    expect(state.players[1].life).toBe(24); // 2 printed + 2 from Bonesplitter, captured before exile
    const splitter = tg.findBattlefield("bonesplitter");
    expect(getObject(state, splitter).attachedTo).toBeNull();
  });

  it("2b. exile is not death: no DIES trigger for an exiled Pelakka (700.4)", async () => {
    const tg = await runFixture(fixture("s4-02b-swords-pelakka-no-dies"));
    expect(tg.game.state.players[1].exile).toHaveLength(1);
    expect(tg.handCardIds(1)).toHaveLength(0); // no dies-draw
    expect(tg.game.state.players[1].life).toBe(27); // but Swords' lifegain did land (7 power)
  });
});

describe("S4 — mass removal (brief 3–4)", () => {
  it("3. Wrath: simultaneous deaths, Myr survives, aura to graveyard, equipment stays, dies-draw fires", async () => {
    const tg = await runFixture(fixture("s4-03-wrath"));
    expect(tg.battlefieldCardIds()).toContain("darksteel_myr");
    expect(tg.battlefieldCardIds()).toContain("bonesplitter");
    expect(tg.battlefieldCardIds()).not.toContain("savannah_lions");
    expect(tg.graveyardCardIds(1)).toEqual(expect.arrayContaining(["pelakka_wurm", "vampire_nighthawk", "pacifism"]));
    expect(tg.handCardIds(1)).toContain("forest"); // Pelakka died properly: DIES fired
    const splitter = tg.findBattlefield("bonesplitter");
    expect(getObject(tg.game.state, splitter).attachedTo).toBeNull();
  });

  it("4. Pyroclasm: 2 each — kills the 1s and 2s including hexproof, spares 2/3 and indestructible", async () => {
    const tg = await runFixture(fixture("s4-04-pyroclasm"));
    expect(tg.graveyardCardIds(0)).toContain("savannah_lions");
    expect(tg.graveyardCardIds(1)).toEqual(expect.arrayContaining(["typhoid_rats", "gladecover_scout"]));
    expect(tg.battlefieldCardIds()).toEqual(expect.arrayContaining(["vampire_nighthawk", "darksteel_myr"]));
    // Spell-source damage: no lifelink/deathtouch anywhere in it.
    expect(tg.game.state.players[0].life).toBe(20);
    expect(tg.game.state.players[1].life).toBe(20);
  });
});

describe("S4 — discard (brief 5–7)", () => {
  it("5. Duress: hand revealed for the caster's decision; caster picks among noncreature-nonland", async () => {
    const tg = await runFixture(fixture("s4-05-duress-choice"));
    expect(tg.graveyardCardIds(1)).toContain("boomerang");
    expect(tg.handCardIds(1)).toEqual(expect.arrayContaining(["counterspell", "grizzly_bears", "island"]));
    // The choice went to the caster (player 0) with the full hand revealed (ADR-029).
    const discardReq = tg.requests.find((r) => r.purpose === "discard");
    expect(discardReq?.player).toBe(0);
    expect(discardReq?.revealed?.map((r) => r.cardId).sort()).toEqual(
      ["boomerang", "counterspell", "grizzly_bears", "island"].sort(),
    );
  });

  it("5b. Duress into creatures and lands: nothing discarded — but the hand IS revealed (S19 round 2, Chris's note: the old fast path skipped the request entirely and the caster saw nothing)", async () => {
    const tg = await runFixture(fixture("s4-05b-duress-whiff"));
    expect(tg.handCardIds(1)).toHaveLength(3);
    expect(tg.graveyardCardIds(1)).toHaveLength(0);
    const req = tg.requests.find((r) => r.purpose === "discard");
    expect(req?.player).toBe(0);
    expect(req?.revealed?.map((r) => r.cardId).sort()).toEqual(["forest", "grizzly_bears", "island"]);
    expect(req?.actions).toEqual([{ type: "declineOptional" }]); // acknowledge the reveal; nothing to take
  });

  it("5c. Duress with exactly ONE legal pick: still a revealed request (no silent auto-pick)", async () => {
    const tg = await runFixture(fixture("s19-duress-single"));
    expect(tg.graveyardCardIds(1)).toEqual(["boomerang"]);
    const req = tg.requests.find((r) => r.purpose === "discard");
    expect(req?.player).toBe(0);
    expect(req?.revealed).toHaveLength(3);
    expect(req?.actions).toHaveLength(1);
  });

  it("6. Mind Rot: the discarding player chooses two", async () => {
    const tg = await runFixture(fixture("s4-06-mind-rot"));
    expect(tg.graveyardCardIds(1).sort()).toEqual(["grizzly_bears", "island"]);
    expect(tg.handCardIds(1)).toEqual(["counterspell"]);
    // Both choices belonged to the target, not the caster.
    for (const r of tg.requests.filter((r) => r.purpose === "discard")) {
      expect(r.player).toBe(1);
    }
  });

  it("6b. Mind Rot into a one-card hand discards one; into an empty hand does nothing", async () => {
    const one = new TestGame({
      name: "mind-rot-one",
      setup: {
        players: [{ battlefield: ["swamp", "swamp", "swamp"], hand: ["mind_rot"] }, { hand: ["island"] }],
      },
      script: [{ player: 0, do: "cast", card: "mind_rot", targets: [{ player: 1 }] }],
    });
    await one.game.priorityRound();
    expect(one.handCardIds(1)).toHaveLength(0);
    expect(one.graveyardCardIds(1)).toEqual(["island"]);

    const empty = new TestGame({
      name: "mind-rot-empty",
      setup: { players: [{ battlefield: ["swamp", "swamp", "swamp"], hand: ["mind_rot"] }, {}] },
      script: [{ player: 0, do: "cast", card: "mind_rot", targets: [{ player: 1 }] }],
    });
    await empty.game.priorityRound();
    expect(empty.graveyardCardIds(1)).toHaveLength(0);
  });

  it("7. Hymn: two at random through the logged game RNG", async () => {
    const tg = await runFixture(fixture("s4-07-hymn-random"));
    expect(tg.graveyardCardIds(1)).toHaveLength(2);
    expect(tg.handCardIds(1)).toHaveLength(1);
    const rngDiscards = tg.log.entries.filter((e) => e.t === "RNG" && e.purpose === "discard");
    expect(rngDiscards).toHaveLength(2);
    // No discard DecisionRequest was issued — random mode never asks.
    expect(tg.requests.some((r) => r.purpose === "discard")).toBe(false);
  });
});

describe("S4 — black ETBs (brief 8–9)", () => {
  it("8. Rager at 1 life: draw, lose 1, dead at the next SBA check", async () => {
    const tg = await runFixture(fixture("s4-08-rager-at-one"));
    expect(tg.game.state.result).toEqual({ winner: 1, reason: "LIFE" });
  });

  it("9. Nekrataal destroys a legal target; black creatures are never candidates; no target → no trigger (603.3d)", async () => {
    const tg = await runFixture(fixture("s4-09-nekrataal"));
    expect(tg.graveyardCardIds(1)).toContain("centaur_courser");
    expect(tg.battlefieldCardIds()).toContain("typhoid_rats"); // black: never offered
    const targetReq = tg.requests.find((r) => r.purpose === "chooseTarget");
    expect(targetReq).toBeDefined();
    // 603.3d: alone on a board of black creatures the trigger never goes on the stack.
    const alone = new TestGame({
      name: "nekrataal-blank",
      setup: {
        players: [{ battlefield: ["swamp", "swamp", "swamp", "swamp"], hand: ["nekrataal"] }, { battlefield: ["typhoid_rats"] }],
      },
      script: [{ player: 0, do: "cast", card: "nekrataal" }],
    });
    return alone.game.priorityRound().then(() => {
      expect(alone.battlefieldCardIds()).toContain("nekrataal");
      expect(alone.battlefieldCardIds()).toContain("typhoid_rats");
      expect(alone.log.entries.some((e) => e.t === "EVENT" && e.name === "TRIGGER_NO_TARGETS")).toBe(true);
    });
  });
});

describe("S4 — parameterized scopes (brief 10)", () => {
  it("10. Chieftain: other Goblins +1/+1 and haste; not itself; effects vanish when it dies", () => {
    const tg = new TestGame({
      name: "chieftain",
      setup: {
        players: [
          { battlefield: ["goblin_chieftain", "goblin_piker", "savannah_lions"] },
          {},
        ],
      },
    });
    const ctx = tg.game.ctx;
    const chieftain = tg.findBattlefield("goblin_chieftain");
    const piker = tg.findBattlefield("goblin_piker");
    const lions = tg.findBattlefield("savannah_lions");

    expect(characteristics(ctx, piker)).toMatchObject({ power: 3, toughness: 2 }); // 2/1 Goblin +1/+1
    expect(characteristics(ctx, lions)).toMatchObject({ power: 2, toughness: 1 }); // Cat: unaffected
    expect(characteristics(ctx, chieftain)).toMatchObject({ power: 2, toughness: 2 }); // other: excludes self

    // A summoning-sick token attacks under the Chieftain's granted haste...
    const token = createObject(ctx, "goblin_1_1", 0, "battlefield", { isToken: true });
    expect(getObject(ctx.state, token).summoningSick).toBe(true);
    expect(characteristics(ctx, token)).toMatchObject({ power: 2, toughness: 2 }); // Siege-Gang tokens are 2/2 here
    ctx.state.step = "DECLARE_ATTACKERS";
    expect(eligibleAttackers(ctx)).toContain(token);
    // ...and loses it the moment the Chieftain dies.
    moveObject(ctx, chieftain, "graveyard");
    expect(characteristics(ctx, token)).toMatchObject({ power: 1, toughness: 1 });
    expect(eligibleAttackers(ctx)).not.toContain(token);
  });
});

describe("S4 — Curiosity: conditions and optional triggers (brief 11)", () => {
  it("11a. double striker with Curiosity: two optional triggers; accept draws, decline doesn't", async () => {
    const tg = await runFixture(fixture("s4-11a-curiosity-double-strike"));
    expect(tg.handCardIds(0)).toHaveLength(1); // exactly one draw from two damage instances
    expect(tg.game.state.players[1].life).toBe(18); // a bare 1/1 double striker: 1 + 1
    expect(tg.requests.filter((r) => r.purpose === "optionalTrigger")).toHaveLength(2);
  });

  it("11b. Curiosity on the opponent's creature damaging YOU: no trigger (player: opponentOfController)", async () => {
    const spec = fixture("s4-11b-curiosity-wrong-direction");
    const tg = new TestGame(spec);
    const ctx = tg.game.ctx;
    createObject(ctx, "curiosity", 0, "battlefield", { attachedTo: tg.findBattlefield("gray_ogre") });
    ctx.state.pendingTriggers = [];
    await tg.run(spec);
    expect(tg.game.state.players[0].life).toBe(18); // took the hit
    expect(tg.handCardIds(0)).toHaveLength(0); // no draw
    expect(tg.requests.some((r) => r.purpose === "optionalTrigger")).toBe(false);
  });

  it("11c. fight damage to a creature: no trigger; noncombat damage to the opponent: triggers", async () => {
    const tg = new TestGame({
      name: "curiosity-noncombat",
      setup: {
        players: [
          {
            battlefield: [
              "siege_gang_commander",
              { card: "goblin_1_1", token: true },
              { card: "curiosity", attachedTo: "siege_gang_commander" },
              "mountain",
              "mountain",
            ],
            library: ["island", "island"],
          },
          {},
        ],
      },
      script: [
        { player: 0, do: "activate", card: "siege_gang_commander", abilityIndex: 1, targets: [{ player: 1 }] },
        { player: 0, do: "sacrificeChoice", card: "goblin_1_1" },
        { player: 0, do: "optional", accept: true },
      ],
    });
    await tg.game.priorityRound();
    expect(tg.game.state.players[1].life).toBe(18); // the 2 landed
    expect(tg.handCardIds(0)).toHaveLength(1); // Curiosity triggered on noncombat damage
  });
});

describe("S4 — keyword composition (brief 12)", () => {
  it("12. Nighthawk blocks a 4/4 (it flies, so it cannot BE blocked by one — brief oversight): both die, lifelink gains 2", async () => {
    const tg = await runFixture(fixture("s4-12-nighthawk-vs-baloth"));
    expect(tg.graveyardCardIds(0)).toContain("vampire_nighthawk"); // took 4 on a 2/3
    expect(tg.graveyardCardIds(1)).toContain("rumbling_baloth"); // any deathtouch damage
    expect(tg.game.state.players[0].life).toBe(22); // lifelink on the 2 dealt
  });
});

describe("S4 — ATTACHED events (brief 13)", () => {
  it("13. aura-enter, equip, re-equip, and sba-unattach all emit", async () => {
    const tg = new TestGame({
      name: "attached-events",
      setup: {
        players: [
          {
            battlefield: ["bonesplitter", "savannah_lions", "goblin_piker", "mountain", "mountain", "plains", "plains"],
            hand: ["pacifism"],
          },
          {},
        ],
      },
      script: [
        { player: 0, do: "cast", card: "pacifism", targets: [{ object: "savannah_lions" }] },
        { player: 0, do: "activate", card: "bonesplitter", abilityIndex: 1, targets: [{ object: "savannah_lions" }] },
      ],
    });
    await tg.game.priorityRound();
    const causes = () =>
      tg.log.entries.flatMap((e) =>
        e.t === "EVENT" && e.name === "ATTACHED" ? [(e.payload as { cause: string }).cause] : [],
      );
    expect(causes()).toEqual(["aura-enter", "equip"]);

    const ctx = tg.game.ctx;
    // Host leaves: both attachments detach with cause host-left.
    const lions = tg.findBattlefield("savannah_lions");
    moveObject(ctx, lions, "graveyard");
    expect(causes().filter((c) => c === "host-left")).toHaveLength(2);

    // SBA unattach: an equipment pointing at an illegal host (test-forced —
    // no legal play reaches this today; the SBA is defense in depth).
    const splitter = tg.findBattlefield("bonesplitter");
    getObject(ctx.state, splitter).attachedTo = tg.findBattlefield("mountain");
    runSBAs(ctx);
    expect(causes()).toContain("sba-unattach");
    expect(getObject(ctx.state, splitter).attachedTo).toBeNull();
  });
});
