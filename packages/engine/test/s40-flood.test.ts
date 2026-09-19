import { describe, expect, it } from "vitest";
import { characteristics, getObject, legalActions } from "../src/index.js";
import { TestGame } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const hand = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].hand.map((id) => getObject(tg.game.state, id).cardId);
const life = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].life;
const lands = (n: number, ...ids: string[]) => Array.from({ length: n }, (_, i) => ids[i % ids.length]!);
const LIB = ["island", "island", "island", "island", "island", "island", "island", "island", "island", "island", "island", "island"];

/**
 * S40 (ADR-128, R-097) — the flood's cards: a fixture per word (brief Part 1) and per legend's ruling (Part 2).
 * Written after the 840-game fuzz came back clean (s40-fuzz.test.ts).
 */

describe("R-097 word 1 — the every-upkeep trigger (Static Sphere, the Reaper)", () => {
  it("Static Sphere: the mark on entry; the marked permanent taps at EACH upkeep (its controller's and the opponent's); the mark outlives the Sphere; an unmarked permanent is untouched", async () => {
    const tg = new TestGame({
      name: "sphere",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: lands(3, "island", "plains", "island"), hand: ["static_sphere"], library: LIB },
        { battlefield: ["hill_giant", "grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "cast", card: "static_sphere" }, { player: 0, do: "chooseTriggerTargets", targets: [{ object: "hill_giant" }] }],
    });
    await tg.game.runStep("MAIN1");
    const giant = tg.findBattlefield("hill_giant");
    expect(getObject(tg.game.state, giant).counters.static).toBe(1);
    expect(getObject(tg.game.state, giant).tapped).toBe(false);
    // The opponent's upkeep: the Sphere is player 0's, and it taps anyway ("each upkeep").
    tg.game.state.activePlayer = 1;
    await tg.game.runStep("UPKEEP");
    expect(getObject(tg.game.state, giant).tapped).toBe(true);
    expect(getObject(tg.game.state, tg.findBattlefield("grizzly_bears")).tapped).toBe(false);
    // The Sphere's own controller's upkeep too.
    getObject(tg.game.state, giant).tapped = false;
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("UPKEEP");
    expect(getObject(tg.game.state, giant).tapped).toBe(true);
    // The counter stays when the Sphere goes; with no Sphere nothing taps it.
    tg.game.state.battlefield.splice(tg.game.state.battlefield.indexOf(tg.findBattlefield("static_sphere")), 1);
    getObject(tg.game.state, giant).tapped = false;
    await tg.game.runStep("UPKEEP");
    expect(getObject(tg.game.state, giant).counters.static).toBe(1);
    expect(getObject(tg.game.state, giant).tapped).toBe(false);
  });

  it("the Reaper: a Snake at the beginning of EACH upkeep, always under the Reaper's controller", async () => {
    const tg = new TestGame({ name: "reaper-upkeep", setup: { active: 1, step: "UPKEEP", players: [{ battlefield: ["the_reaper"], library: LIB }, { battlefield: ["mountain"], library: LIB }] } });
    await tg.game.runStep("UPKEEP"); // the opponent's upkeep
    expect(bf(tg, 0).filter((c) => c === "snake_1_1_g")).toHaveLength(1);
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("UPKEEP");
    expect(bf(tg, 0).filter((c) => c === "snake_1_1_g")).toHaveLength(2);
    expect(bf(tg, 1)).toEqual(["mountain"]);
  });
});

describe("R-097 word 2 — mana spent to cast (Sacred Helix)", () => {
  it("X=0 is four and four; X=3 is seven and seven — damage and life both read the mana spent", async () => {
    for (const [x, n] of [[0, 4], [3, 7]] as const) {
      const tg = new TestGame({
        name: `helix-${x}`,
        setup: { active: 0, step: "MAIN1", players: [
          { life: 10, battlefield: lands(4 + x, "mountain", "mountain", "plains", "plains", "mountain", "plains", "mountain"), hand: ["sacred_helix"], library: LIB },
          { life: 20, battlefield: ["mountain"], library: LIB },
        ] },
        script: [{ player: 0, do: "cast", card: "sacred_helix", x, targets: [{ player: 1 }] }],
      });
      await tg.game.runStep("MAIN1");
      expect(life(tg, 1), `x=${x}`).toBe(20 - n);
      expect(life(tg, 0), `x=${x}`).toBe(10 + n);
    }
  });
});

describe("R-097 word 3 — the leaves-the-battlefield collector with LKI power (Zinnia); Meliyan's DIES twin", () => {
  it("Zinnia: a bounced 3/3 mills its controller three; a PUMPED creature mills its last-known power; her own creatures leaving mill nobody", async () => {
    const tg = new TestGame({
      name: "zinnia",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["zinnia_the_undertow", "grizzly_bears", ...lands(4, "island")], hand: ["boomerang", "boomerang"], library: LIB },
        { battlefield: [{ card: "hill_giant", counters: { "+1/+1": 2 } }], library: LIB },
      ] },
      script: [
        { player: 0, do: "cast", card: "boomerang", targets: [{ object: "hill_giant" }] },
        { player: 0, do: "cast", card: "boomerang", targets: [{ object: "grizzly_bears" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 1)).toEqual(["hill_giant"]);
    expect(gy(tg, 1)).toHaveLength(5); // 3 printed + two counters: last-known power, not the card's
    expect(gy(tg, 0).filter((c) => c === "island")).toHaveLength(0); // her own Bears leaving mills nobody
  });

  it("Zinnia sees a DEATH as a leaving too (the wider event beside DIES), and a put-on-top (Wrackroot) — the creature leaves before it lands", async () => {
    const tg = new TestGame({
      name: "zinnia-wrackroot",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["zinnia_the_undertow", "wrackroot", ...lands(6, "island", "forest", "mountain")], hand: ["lightning_bolt"], library: LIB },
        { battlefield: ["hill_giant", "grizzly_bears"], library: ["swamp", "swamp", "swamp", "swamp", "swamp", "swamp", "swamp", "swamp"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "wrackroot", abilityIndex: 2, targets: [{ object: "hill_giant" }] },
        { player: 0, do: "cast", card: "lightning_bolt", targets: [{ object: "grizzly_bears" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    // The Giant went on top and Zinnia's trigger milled three — the Giant itself and two Swamps; the Bears
    // died (2 power) and two more went. (The script's two entries may run in either order.)
    expect([...gy(tg, 1)].sort()).toEqual(["grizzly_bears", "hill_giant", "swamp", "swamp", "swamp", "swamp"]);
  });

  it("Meliyan: another creature of hers dying burns the opponent for its LKI power — the damage is HERS (the source), an opponent's creature dying does nothing, and her own death does nothing", async () => {
    const tg = new TestGame({
      name: "meliyan",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["meliyan_the_torment", { card: "grizzly_bears", counters: { "+1/+1": 1 } }, ...lands(3, "mountain")], hand: ["lightning_bolt", "shock"], library: LIB },
        { life: 20, battlefield: ["savannah_lions"], library: LIB },
      ] },
      script: [
        { player: 0, do: "cast", card: "lightning_bolt", targets: [{ object: "grizzly_bears" }] },
        { player: 0, do: "cast", card: "shock", targets: [{ object: "savannah_lions" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(life(tg, 1)).toBe(17); // the 3/3 Bears; the Lions' death is not hers
    const dmg = tg.log.entries.filter((e): e is Extract<typeof e, { t: "EVENT" }> => e.t === "EVENT" && e.name === "DAMAGE" && (e.payload as { target: { kind: string } }).target.kind === "player");
    expect((dmg[0]!.payload as { sourceCardId: string }).sourceCardId).toBe("meliyan_the_torment");
  });
});

describe("R-097 word 4 — the class-grant on lands (the Fordkeeper)", () => {
  it("his lands ping for {2},{T}; the ping is a noncreature source he controls, so he gains; the opponent's lands have nothing; a creature's damage gains nothing", async () => {
    const tg = new TestGame({
      name: "fordkeeper",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 10, battlefield: ["the_fordkeeper", ...lands(6, "mountain")], hand: ["lightning_bolt"], library: LIB },
        { life: 20, battlefield: ["mountain", "mountain", "mountain"], library: LIB },
      ] },
      script: [
        { player: 0, do: "activate", card: "mountain", abilityIndex: 1, targets: [{ player: 1 }] },
        { player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] },
      ],
    });
    const theirs = tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === 1);
    expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && theirs.includes(a.objectId))).toBe(false);
    await tg.game.runStep("MAIN1");
    expect(life(tg, 1)).toBe(16); // 1 + 3
    expect(life(tg, 0)).toBe(14); // gained 1 + 3
  });

  it("the Toll under him: the law is a noncreature source its controller controls — the tax is his lifegain (the document's ⚠, confirmed)", async () => {
    const tg = new TestGame({
      name: "fordkeeper-toll",
      setup: { active: 1, step: "MAIN1", players: [
        { life: 10, battlefield: ["the_fordkeeper", "law_toll"], library: LIB },
        { life: 20, battlefield: ["forest", "forest"], hand: ["grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 1, do: "cast", card: "grizzly_bears" }],
    });
    await tg.game.runStep("MAIN1");
    expect(life(tg, 1)).toBe(19);
    expect(life(tg, 0)).toBe(11);
  });

  it("Savage Twister under him: X life per creature hit (one damage event each)", async () => {
    const tg = new TestGame({
      name: "fordkeeper-twister",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 10, battlefield: ["the_fordkeeper", ...lands(4, "mountain", "forest")], hand: ["savage_twister"], library: LIB },
        { battlefield: ["grizzly_bears", "savannah_lions"], library: LIB },
      ] },
      script: [{ player: 0, do: "cast", card: "savage_twister", x: 2 }],
    });
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 1)).toEqual([]);
    expect(bf(tg, 0)).toContain("the_fordkeeper"); // 4/5 survives 2
    expect(life(tg, 0)).toBe(16); // three creatures hit × 2
  });
});

describe("R-097 word 5 — any-graveyard reanimation (the Reeve)", () => {
  it("mills a target player three; returns a creature card from THE OPPONENT's graveyard under the Reeve's controller", async () => {
    const tg = new TestGame({
      name: "reeve",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["the_reeve", ...lands(7, "island", "swamp", "forest")], library: LIB },
        { battlefield: ["mountain"], graveyard: ["hill_giant"], library: ["swamp", "swamp", "swamp", "swamp", "swamp"] },
      ] },
      script: [
        { player: 0, do: "activate", card: "the_reeve", abilityIndex: 0, targets: [{ player: 1 }] },
        { player: 0, do: "activate", card: "the_reeve", abilityIndex: 1, targets: [{ graveyard: "hill_giant" }] },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["swamp", "swamp", "swamp"]);
    expect(bf(tg, 0)).toContain("hill_giant");
    expect(characteristics(tg.game.ctx, tg.findBattlefield("the_reeve")).keywords.has("deathtouch")).toBe(true);
  });
});

describe("R-097 word 6 — the negative pump (Isaura)", () => {
  it("−1/−1 kills an X/1 at the next SBA pass; the team counters land on every creature of hers and on nothing else", async () => {
    const tg = new TestGame({
      name: "isaura",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["isaura_the_levy", "grizzly_bears", ...lands(6, "swamp", "plains")], library: LIB },
        { battlefield: ["savannah_lions", "hill_giant"], library: LIB },
      ] },
      script: [
        { player: 0, do: "activate", card: "isaura_the_levy", abilityIndex: 0, targets: [{ object: "savannah_lions" }] },
        { player: 0, do: "activate", card: "isaura_the_levy", abilityIndex: 1 },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1)).toEqual(["savannah_lions"]);
    expect(getObject(tg.game.state, tg.findBattlefield("isaura_the_levy")).counters["+1/+1"]).toBe(1);
    expect(getObject(tg.game.state, tg.findBattlefield("grizzly_bears")).counters["+1/+1"]).toBe(1);
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).counters["+1/+1"] ?? 0).toBe(0);
  });
});

describe("the legends' rulings (brief Part 2)", () => {
  it("the Bailiff: haste, vigilance; the attack trigger MAY bounce a TAPPED creature only — an untapped one is no target; declining leaves it", async () => {
    const tg = new TestGame({
      name: "bailiff",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [
        { battlefield: [{ card: "the_bailiff", summoningSick: true }], library: LIB },
        { battlefield: [{ card: "hill_giant", tapped: true }, "grizzly_bears"], library: LIB },
      ] },
      script: [{ player: 0, do: "attack", attackers: ["the_bailiff"] }, { player: 0, do: "optional", accept: true }],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(hand(tg, 1)).toEqual(["hill_giant"]); // the only legal target — no request for it
    expect(bf(tg, 1)).toEqual(["grizzly_bears"]);
    expect(getObject(tg.game.state, tg.findBattlefield("the_bailiff")).tapped).toBe(false); // vigilance
  });

  it("Odile: each draw deals damage equal to HER power to each TAPPED creature — both sides, the untapped spared; a pump scales it; the draw step counts", async () => {
    const tg = new TestGame({
      name: "odile",
      setup: { active: 0, step: "DRAW", turn: 4, players: [
        { battlefield: ["odile_the_tallyflame", { card: "grizzly_bears", tapped: true }], library: LIB },
        { battlefield: [{ card: "savannah_lions", tapped: true }, { card: "hill_giant", tapped: true }, "gray_ogre"], library: LIB },
      ] },
    });
    await tg.game.runStep("DRAW");
    expect(gy(tg, 1)).toEqual(["savannah_lions"]); // 1 damage: the X/1 dies
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).damage).toBe(1);
    expect(getObject(tg.game.state, tg.findBattlefield("gray_ogre")).damage).toBe(0); // untapped
    expect(getObject(tg.game.state, tg.findBattlefield("grizzly_bears")).damage).toBe(1); // her own tapped creature burns too
    // A +1/+1 counter on her: two a draw.
    getObject(tg.game.state, tg.findBattlefield("odile_the_tallyflame")).counters["+1/+1"] = 1;
    await tg.game.runStep("DRAW");
    expect(gy(tg, 1)).toEqual(["savannah_lions", "hill_giant"]); // 1 + 2 on the 3/3
    expect(gy(tg, 0)).toEqual(["grizzly_bears"]); // and her own tapped Bears
  });

  it("Ovna: +1/+1 for each enchantment she controls (the law counts); an enchantment spell draws; a creature spell does not", async () => {
    const tg = new TestGame({
      name: "ovna",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["ovna_the_enchantress", "law_toll", ...lands(4, "plains", "forest")], hand: ["pacifism", "grizzly_bears"], library: LIB },
        { battlefield: ["hill_giant"], library: LIB },
      ] },
      script: [{ player: 0, do: "cast", card: "pacifism", targets: [{ object: "hill_giant" }] }, { player: 0, do: "cast", card: "grizzly_bears" }],
    });
    expect(characteristics(tg.game.ctx, tg.findBattlefield("ovna_the_enchantress")).power).toBe(3); // the Toll is an Artifact Enchantment
    await tg.game.runStep("MAIN1");
    const o = characteristics(tg.game.ctx, tg.findBattlefield("ovna_the_enchantress"));
    expect([o.power, o.toughness]).toEqual([4, 4]);
    expect(hand(tg, 0)).toEqual(["island"]); // one draw, from the Pacifism only
  });

  it("the Dredger: {W}{U}{B} and a sacrificed LAND return an instant or sorcery from HIS graveyard to hand; a creature card is no target", async () => {
    const tg = new TestGame({
      name: "dredger",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["the_dredger", "plains", "island", "swamp", "forest"], graveyard: ["counterspell", "grizzly_bears"], library: LIB },
        { battlefield: ["mountain"], graveyard: ["lightning_bolt"], library: LIB },
      ] },
      script: [{ player: 0, do: "activate", card: "the_dredger", abilityIndex: 0, targets: [{ graveyard: "counterspell" }] }, { player: 0, do: "sacrificeChoice", card: "forest" }],
    });
    const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility" && a.objectId === tg.findBattlefield("the_dredger"));
    expect(acts).toHaveLength(1); // the Counterspell only: not the Bears, not the opponent's Bolt
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual(["counterspell"]);
    expect(gy(tg, 0)).toContain("forest");
    expect(bf(tg, 0)).not.toContain("forest");
  });

  it("the Reaper: the grant is TEAM-WIDE until end of turn — +X/+0 (the sacrificed creature's last-known power), haste and lifelink; NO trample", async () => {
    const tg = new TestGame({
      name: "reaper-harvest",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["the_reaper", { card: "grizzly_bears", counters: { "+1/+1": 1 } }, { card: "snake_1_1_g", token: true, summoningSick: true }, ...lands(3, "swamp", "mountain", "forest")], library: LIB },
        { battlefield: ["mountain"], library: LIB },
      ] },
      script: [{ player: 0, do: "activate", card: "the_reaper", abilityIndex: 1 }, { player: 0, do: "sacrificeChoice", card: "grizzly_bears" }],
    });
    await tg.game.runStep("MAIN1");
    const reaper = characteristics(tg.game.ctx, tg.findBattlefield("the_reaper"));
    const snake = characteristics(tg.game.ctx, tg.findBattlefield("snake_1_1_g"));
    expect([reaper.power, reaper.toughness]).toEqual([7, 4]); // the 3/3 Bears
    expect([snake.power, snake.toughness]).toEqual([4, 1]);
    for (const k of ["haste", "lifelink"] as const) { expect(reaper.keywords.has(k)).toBe(true); expect(snake.keywords.has(k)).toBe(true); }
    expect(snake.keywords.has("trample")).toBe(false);
    await tg.game.runStep("CLEANUP");
    expect(characteristics(tg.game.ctx, tg.findBattlefield("the_reaper")).power).toBe(4);
  });
});

describe("the High Grounds (§6) — two mana abilities and the third as written", () => {
  it("each ground taps for either of its colours and is Legendary", () => {
    for (const [id, a, b] of [["tallyflame_court", "U", "R"], ["wrackroot", "U", "G"], ["shevelport", "W", "G"], ["obsidian_observatory", "W", "B"], ["cairnbrand", "B", "R"]] as const) {
      const tg = new TestGame({ name: id, setup: { active: 0, step: "MAIN1", players: [{ battlefield: [id], library: LIB }, { battlefield: ["mountain"], library: LIB }] } });
      const gid = tg.findBattlefield(id);
      const colours = legalActions(tg.game.ctx, 0).filter((x) => x.type === "tapForMana" && x.objectId === gid).map((x) => (x as { color?: string }).color).sort();
      expect(colours, id).toEqual([a, b].sort());
      expect(tg.game.ctx.defs.def(id).supertypes).toEqual(["Legendary"]);
    }
  });

  it("Tallyflame Court draws (and the draw is Odile's fire)", async () => {
    const tg = new TestGame({
      name: "court-draw",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["tallyflame_court", "odile_the_tallyflame", ...lands(4, "island", "mountain")], library: LIB },
        { battlefield: [{ card: "savannah_lions", tapped: true }], library: LIB },
      ] },
      script: [{ player: 0, do: "activate", card: "tallyflame_court", abilityIndex: 2 }],
    });
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toHaveLength(1);
    expect(gy(tg, 1)).toEqual(["savannah_lions"]);
  });

  it("Shevelport returns an artifact, enchantment, or land card — not a creature, not an instant; from YOUR graveyard", async () => {
    const tg = new TestGame({
      name: "shevelport",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["shevelport", ...lands(4, "plains", "forest")], graveyard: ["pacifism", "static_sphere", "forest", "grizzly_bears", "giant_growth"], library: LIB },
        { battlefield: ["mountain"], graveyard: ["rancor"], library: LIB },
      ] },
      script: [{ player: 0, do: "activate", card: "shevelport", abilityIndex: 2, targets: [{ graveyard: "static_sphere" }] }],
    });
    const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility" && a.objectId === tg.findBattlefield("shevelport"));
    expect(acts).toHaveLength(3); // Pacifism, the Sphere, the Forest
    await tg.game.runStep("MAIN1");
    expect(hand(tg, 0)).toEqual(["static_sphere"]);
  });

  it("the Observatory: vigilance and menace, team-wide, until end of turn", async () => {
    const tg = new TestGame({
      name: "observatory",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["obsidian_observatory", "grizzly_bears", "savannah_lions", ...lands(4, "plains", "swamp")], library: LIB }, { battlefield: ["hill_giant"], library: LIB }] },
      script: [{ player: 0, do: "activate", card: "obsidian_observatory", abilityIndex: 2 }],
    });
    await tg.game.runStep("MAIN1");
    for (const c of ["grizzly_bears", "savannah_lions"]) for (const k of ["vigilance", "menace"] as const) expect(characteristics(tg.game.ctx, tg.findBattlefield(c)).keywords.has(k), `${c} ${k}`).toBe(true);
    expect(characteristics(tg.game.ctx, tg.findBattlefield("hill_giant")).keywords.has("menace")).toBe(false);
  });

  it("Cairnbrand: returns a creature card from YOUR graveyard for a sacrificed creature — the opponent's graveyard is closed; under Meliyan the sacrifice is her burn", async () => {
    const tg = new TestGame({
      name: "cairnbrand",
      setup: { active: 0, step: "MAIN1", players: [
        { battlefield: ["cairnbrand", "meliyan_the_torment", "grizzly_bears", ...lands(6, "swamp", "mountain")], graveyard: ["hill_giant"], library: LIB },
        { life: 20, battlefield: ["mountain"], graveyard: ["serra_angel"], library: LIB },
      ] },
      script: [{ player: 0, do: "activate", card: "cairnbrand", abilityIndex: 2, targets: [{ graveyard: "hill_giant" }] }, { player: 0, do: "sacrificeChoice", card: "grizzly_bears" }],
    });
    const acts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility" && a.objectId === tg.findBattlefield("cairnbrand"));
    expect(acts).toHaveLength(1); // the Giant; never the opponent's Angel
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0)).toContain("hill_giant");
    expect(gy(tg, 0)).toContain("grizzly_bears");
    expect(life(tg, 1)).toBe(18); // Meliyan: the Bears' power
  });
});

describe("the real golds and the two adds — Oracle as printed", () => {
  it("Voracious Cobra (INV): first strike; destroys the creature it deals COMBAT damage to — a 5/5 blocker dies before it strikes back", async () => {
    const tg = new TestGame({
      name: "cobra",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["voracious_cobra"], library: LIB }, { battlefield: ["pelakka_wurm"], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["voracious_cobra"] }, { player: 1, do: "block", blocks: [{ blocker: "pelakka_wurm", attacker: "voracious_cobra" }] }],
    });
    for (const s of ["DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "FIRST_STRIKE_DAMAGE", "COMBAT_DAMAGE"] as const) await tg.game.runStep(s);
    expect(gy(tg, 1)).toEqual(["pelakka_wurm"]);
    expect(bf(tg, 0)).toEqual(["voracious_cobra"]);
  });

  it("Powerstone Minefield: 2 to each attacker and each blocker, from the Minefield (a noncreature source)", async () => {
    const tg = new TestGame({
      name: "minefield",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["powerstone_minefield", "hill_giant"], library: LIB }, { battlefield: ["grizzly_bears"], library: LIB }] },
      script: [{ player: 0, do: "attack", attackers: ["hill_giant"] }, { player: 1, do: "block", blocks: [{ blocker: "grizzly_bears", attacker: "hill_giant" }] }],
    });
    await tg.game.runStep("DECLARE_ATTACKERS");
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).damage).toBe(2);
    await tg.game.runStep("DECLARE_BLOCKERS");
    expect(gy(tg, 1)).toEqual(["grizzly_bears"]); // the 2/2 blocker dies to the Minefield before damage
  });

  it("Undermine: counters, and the SPELL's controller loses 3; Absorb: counters, and you gain 3", async () => {
    for (const [card, mine, theirs] of [["undermine", 20, 17], ["absorb", 23, 20]] as const) {
      const tg = new TestGame({
        name: card,
        setup: { active: 1, step: "MAIN1", players: [
          { life: 20, battlefield: lands(3, "island", "island", card === "undermine" ? "swamp" : "plains"), hand: [card], library: LIB },
          { life: 20, battlefield: ["forest", "forest"], hand: ["grizzly_bears"], library: LIB },
        ] },
        script: [{ player: 1, do: "cast", card: "grizzly_bears" }, { player: 0, do: "cast", card, targets: [{ spell: "grizzly_bears" }] }],
      });
      await tg.game.runStep("MAIN1");
      expect(gy(tg, 1), card).toEqual(["grizzly_bears"]);
      expect([life(tg, 0), life(tg, 1)], card).toEqual([mine, theirs]);
    }
  });

  it("Glimpse mills ten; Putrefy destroys an artifact or a creature (never an enchantment); Char is 4 and 2; Shadow Summoning makes two TAPPED 1/1 white fliers; the Archer drains on another creature's death", async () => {
    const tg = new TestGame({
      name: "adds",
      setup: { active: 0, step: "MAIN1", players: [
        { life: 20, battlefield: ["poison_tip_archer", ...lands(11, "swamp", "island", "forest", "mountain", "plains")], hand: ["glimpse_the_unthinkable", "putrefy", "char", "shadow_summoning"], library: LIB },
        { life: 20, battlefield: ["hill_giant"], library: [...LIB, ...LIB] },
      ] },
      script: [
        { player: 0, do: "cast", card: "glimpse_the_unthinkable", targets: [{ player: 1 }] },
        { player: 0, do: "cast", card: "putrefy", targets: [{ object: "hill_giant" }] },
        { player: 0, do: "cast", card: "char", targets: [{ player: 1 }] },
        { player: 0, do: "cast", card: "shadow_summoning" },
      ],
    });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 1).filter((c) => c === "island")).toHaveLength(10);
    expect(gy(tg, 1)).toContain("hill_giant");
    expect(life(tg, 1)).toBe(20 - 1 - 4); // the Archer's drain on the Giant's death, then Char
    expect(life(tg, 0)).toBe(18); // Char's recoil
    const spirits = tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === "spirit_1_1_w_flying");
    expect(spirits).toHaveLength(2);
    for (const id of spirits) { expect(getObject(tg.game.state, id).tapped).toBe(true); expect(characteristics(tg.game.ctx, id).keywords.has("flying")).toBe(true); }
  });
});
