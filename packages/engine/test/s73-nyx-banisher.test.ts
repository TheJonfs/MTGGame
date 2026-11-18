import { describe, expect, it } from "vitest";
import { buildView, characteristics, getObject } from "../src/index.js";
import { TestGame, runFixture, type ScriptEntry } from "./harness.js";

const gy = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].graveyard.map((id) => getObject(tg.game.state, id).cardId);
const ex = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].exile.map((id) => getObject(tg.game.state, id).cardId);
const bf = (tg: TestGame, p: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === p).map((id) => getObject(tg.game.state, id).cardId);
const LIB = Array.from({ length: 12 }, () => "plains");
const L = (land: string, n: number) => Array.from({ length: n }, () => land);
const pt = (tg: TestGame, card: string) => { const c = characteristics(tg.game.ctx, tg.findBattlefield(card)); return [c.power, c.toughness]; };

/**
 * Post-S72 (R-130) — Banishing Cleric (custom, Chris; name pending), {1}{W}{W} 2/2 Human Cleric: "When this creature
 * enters, exile target nonland permanent an opponent controls until this creature leaves the battlefield." CR 610.3
 * (the return is a second one-shot effect created as the source leaves), 610.3b (a trigger whose source has already left
 * moves nothing), 610.3c (it returns under its OWNER's control), 303.4f–g (a returning Aura's host is chosen as it enters;
 * with none it stays). Written after the fuzz came back clean (360 games over six pairings, 0 errors). CR as of 2026-11-06.
 */
describe("Banishing Cleric — exile until it leaves (R-130)", () => {
  const P = (n: number) => L("plains", n);
  /** Cast the Cleric (its lone legal target is taken silently); an opponent holding an instant lets the spell and the
   * trigger resolve, then acts with `then`. A player with nothing to do is never asked (the lone-pass window). */
  const castThen = (then: ScriptEntry[]): ScriptEntry[] => [
    { player: 0, do: "cast", card: "banishing_cleric" }, ...(then.length ? [{ player: 1, do: "pass" } as ScriptEntry, { player: 1, do: "pass" } as ScriptEntry] : []), ...then];
  const bolt = (at: string): ScriptEntry => ({ player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: at }] });

  it("exiles the opposing creature and shows it held; when the Cleric dies the creature returns to its owner", async () => {
    const held = await runFixture({ name: "ban-held", setup: { players: [{ battlefield: P(3), hand: ["banishing_cleric"], library: LIB }, { battlefield: ["hill_giant"], library: LIB }] }, script: castThen([]) });
    expect(ex(held, 1)).toEqual(["hill_giant"]);
    expect(buildView(held.game.ctx, 1).battlefield.find((o) => o.cardId === "banishing_cleric")?.holding).toEqual([{ cardId: "hill_giant", owner: 1 }]);
    const tg = await runFixture({ name: "ban-return", setup: { players: [{ battlefield: P(3), hand: ["banishing_cleric"], library: LIB }, { battlefield: ["mountain", "hill_giant"], hand: ["lightning_bolt"], library: LIB }] },
      script: castThen([bolt("banishing_cleric")]) });
    expect(gy(tg, 0)).toEqual(["banishing_cleric"]);
    expect(ex(tg, 1)).toEqual([]);
    expect(bf(tg, 1)).toContain("hill_giant");
    expect(getObject(tg.game.state, tg.findBattlefield("hill_giant")).summoningSick).toBe(true); // a new object (CR 400.7)
    expect(tg.game.state.linkedExiles).toEqual([]);
  });

  it("CR 610.3b: the Cleric killed in response to its own trigger exiles nothing", async () => {
    const tg = await runFixture({ name: "ban-response", setup: { players: [{ battlefield: P(3), hand: ["banishing_cleric"], library: LIB }, { battlefield: ["mountain", "hill_giant"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "banishing_cleric" }, { player: 1, do: "pass" }, bolt("banishing_cleric")] });
    expect(gy(tg, 0)).toEqual(["banishing_cleric"]);
    expect(bf(tg, 1)).toContain("hill_giant");
    expect(ex(tg, 1)).toEqual([]);
    expect(tg.game.state.linkedExiles).toEqual([]);
  });

  it("an exiled token is gone for good (CR 111.7): no link is kept", async () => {
    const tg = await runFixture({ name: "ban-token", setup: { players: [{ battlefield: P(3), hand: ["banishing_cleric"], library: LIB }, { battlefield: [{ card: "goblin_1_1", token: true }], library: LIB }] }, script: castThen([]) });
    expect(bf(tg, 1)).toEqual([]);
    expect(tg.game.state.linkedExiles).toEqual([]);
  });

  it("an opposing Aura: exiled, then back on the Cleric's death, attached as it enters to a host its owner chooses (CR 303.4f)", async () => {
    const tg = await runFixture({ name: "ban-aura", setup: { players: [{ battlefield: [...P(3), "grizzly_bears"], hand: ["banishing_cleric"], library: LIB }, { battlefield: ["mountain", { card: "pacifism", attachedTo: "grizzly_bears" }], hand: ["lightning_bolt"], library: LIB }] },
      script: castThen([bolt("banishing_cleric")]) });
    const aura = getObject(tg.game.state, tg.findBattlefield("pacifism"));
    expect(aura.controller).toBe(1);
    expect(getObject(tg.game.state, aura.attachedTo!).cardId).toBe("grizzly_bears"); // the only creature left
  });

  it("an opposing Aura with no creature to come back to stays in exile (CR 303.4g)", async () => {
    const tg = await runFixture({ name: "ban-aura-none", setup: { players: [{ battlefield: [...P(3), "grizzly_bears"], hand: ["banishing_cleric"], library: LIB }, { battlefield: ["mountain", "mountain", { card: "pacifism", attachedTo: "grizzly_bears" }], hand: ["lightning_bolt", "lightning_bolt"], library: LIB }] },
      script: castThen([bolt("grizzly_bears"), { player: 1, do: "pass" }, bolt("banishing_cleric")]) });
    expect(gy(tg, 0).sort()).toEqual(["banishing_cleric", "grizzly_bears"]);
    expect(ex(tg, 1)).toEqual(["pacifism"]);
    expect(tg.game.state.linkedExiles).toEqual([]);
  });

  it("with only lands across the table the trigger has no target and is removed; the Cleric stays", async () => {
    const tg = await runFixture({ name: "ban-none", setup: { players: [{ battlefield: P(3), hand: ["banishing_cleric"], library: LIB }, { battlefield: L("mountain", 3), library: LIB }] },
      script: [{ player: 0, do: "cast", card: "banishing_cleric" }] });
    expect(bf(tg, 0)).toContain("banishing_cleric");
    expect(bf(tg, 1)).toHaveLength(3);
    expect(tg.game.state.linkedExiles).toEqual([]);
  });

  it("the returned creature's ETB fires again under its owner (Man-o'-War bounces on the way back)", async () => {
    const tg = await runFixture({ name: "ban-etb", setup: { players: [{ battlefield: [...P(3), "grizzly_bears"], hand: ["banishing_cleric"], library: LIB }, { battlefield: ["mountain", "man_o_war"], hand: ["lightning_bolt"], library: LIB }] },
      script: castThen([bolt("banishing_cleric"), { player: 1, do: "chooseTriggerTargets", targets: [{ object: "grizzly_bears" }] }]) });
    expect(bf(tg, 1)).toContain("man_o_war");
    expect(tg.game.state.players[0].hand.map((id) => getObject(tg.game.state, id).cardId)).toContain("grizzly_bears");
  });
});

/**
 * Post-S72 (R-131) — Nyxathid (CON #49, Scryfall-verified 2026-11-17): {1}{B}{B} 7/7 Elemental. "As this creature enters,
 * choose an opponent. This creature gets −1/−1 for each card in the chosen player's hand." CR 614.12/614.12a (the choice is
 * made as it enters); the choice is fixed — a thief's stolen Nyxathid still counts the original chosen player's hand.
 */
describe("Nyxathid — −1/−1 for each card in the chosen player's hand (R-131)", () => {
  it("enters against a three-card hand as a 4/4, choosing the opponent", async () => {
    const tg = await runFixture({ name: "nyx", setup: { players: [{ battlefield: L("swamp", 3), hand: ["nyxathid"], library: LIB }, { battlefield: [], hand: ["hill_giant", "hill_giant", "hill_giant"], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "nyxathid" }] });
    expect(pt(tg, "nyxathid")).toEqual([4, 4]);
    expect(getObject(tg.game.state, tg.findBattlefield("nyxathid")).chosenPlayer).toBe(1);
  });

  it("grows as the chosen player's hand empties (Mind Rot: 4/4 → 6/6)", async () => {
    const tg = new TestGame({ name: "nyx-rot", setup: { players: [{ battlefield: [...L("swamp", 3), "nyxathid"], hand: ["mind_rot"], library: LIB }, { battlefield: [], hand: ["hill_giant", "hill_giant", "hill_giant"], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "mind_rot", targets: [{ player: 1 }] }, { player: 1, do: "discard", card: "hill_giant" }, { player: 1, do: "discard", card: "hill_giant" }] });
    expect(pt(tg, "nyxathid")).toEqual([4, 4]);
    await tg.run({ name: "nyx-rot", setup: { players: [{}, {}] } });
    expect(pt(tg, "nyxathid")).toEqual([6, 6]);
  });

  it("against a seven-card hand it is 0/0 and dies on entry (CR 704.5f)", async () => {
    const tg = new TestGame({ name: "nyx-dead", setup: { active: 0, step: "MAIN1", players: [{ battlefield: L("swamp", 3), hand: ["nyxathid"], library: LIB }, { battlefield: [], hand: L("plains", 7), library: LIB }] },
      script: [{ player: 0, do: "cast", card: "nyxathid" }] });
    await tg.game.runStep("MAIN1");
    expect(gy(tg, 0)).toEqual(["nyxathid"]);
  });

  it("stolen with Control Magic, it still counts the ORIGINAL chosen player — now its controller", async () => {
    const tg = new TestGame({ name: "nyx-stolen", setup: { active: 1, step: "MAIN1", players: [{ battlefield: ["nyxathid"], hand: [], library: LIB }, { battlefield: L("island", 4), hand: ["control_magic", "plains", "plains"], library: LIB }] },
      script: [{ player: 1, do: "cast", card: "control_magic", targets: [{ object: "nyxathid" }] }] });
    expect(pt(tg, "nyxathid")).toEqual([4, 4]); // three cards in player 1's hand
    await tg.game.runStep("MAIN1");
    expect(getObject(tg.game.state, tg.findBattlefield("nyxathid")).controller).toBe(1);
    expect(pt(tg, "nyxathid")).toEqual([5, 5]); // still player 1's hand, now two cards — not player 0's empty one
  });
});

/**
 * Post-S72 (R-132) — the Order Druid (custom, Chris; working name), {1}{G}{G} 2/2 Elf Druid: "{G}, {T}, Sacrifice this
 * creature: Search your library for a green creature card, put it onto the battlefield, then shuffle." A card's colour is
 * its mana cost's (CR 105.2, 202.2; a gold card is each of its colours, so a green legend is a green card); the sacrifice is
 * a cost (CR 602.2b, 601.2h), so killing the Druid in response does not stop the search; {T} in the cost (CR 302.6).
 */
describe("the Order Druid — a green creature card onto the battlefield (R-132)", () => {
  const G = (n: number) => L("forest", n);
  it("offers only green creature cards — Pelakka Wurm and the gold Reaper, never the Hill Giant or the Forest — and puts the pick onto the battlefield", async () => {
    const tg = await runFixture({ name: "druid", setup: { players: [{ battlefield: [...G(1), "order_druid"], library: ["hill_giant", "pelakka_wurm", "the_reaper", "forest", "forest"] }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "activate", card: "order_druid", abilityIndex: 0 }, { player: 0, do: "search", card: "pelakka_wurm" }] });
    const req = tg.requests.find((r) => r.purpose === "searchLibrary")!;
    expect(new Set((req.revealed ?? []).map((r) => r.cardId))).toEqual(new Set(["pelakka_wurm", "the_reaper"]));
    expect(bf(tg, 0)).toContain("pelakka_wurm");
    expect(gy(tg, 0)).toEqual(["order_druid"]);
  });
  it("the sacrifice is a cost: a Bolt in response finds no Druid, and the search still resolves", async () => {
    const tg = await runFixture({ name: "druid-response", setup: { players: [{ battlefield: [...G(1), "order_druid"], library: ["pelakka_wurm", "forest"] }, { battlefield: ["mountain"], hand: ["lightning_bolt"], library: LIB }] },
      script: [{ player: 0, do: "activate", card: "order_druid", abilityIndex: 0 }, { player: 0, do: "search", card: "pelakka_wurm" }] });
    expect(bf(tg, 0)).toContain("pelakka_wurm");
    expect(tg.game.state.players[1].hand).toHaveLength(1); // no Druid on the battlefield to aim the Bolt at
  });
  it("a summoning-sick Druid cannot pay its {T} (CR 302.6)", async () => {
    const tg = new TestGame({ name: "druid-sick", setup: { players: [{ battlefield: [...G(1), { card: "order_druid", summoningSick: true }], library: ["pelakka_wurm"] }, { battlefield: [], library: LIB }] } });
    await tg.run({ name: "druid-sick", setup: { players: [{}, {}] } });
    expect(tg.requests.some((r) => r.actions.some((a) => a.type === "activateAbility"))).toBe(false); // never offered
    expect(bf(tg, 0)).toContain("order_druid");
    expect(bf(tg, 0)).not.toContain("pelakka_wurm");
    const ready = new TestGame({ name: "druid-ready", setup: { players: [{ battlefield: [...G(1), "order_druid", "forest"], hand: ["lightning_bolt"], library: ["pelakka_wurm"] }, { battlefield: [], library: LIB }] } });
    await ready.run({ name: "druid-ready", setup: { players: [{}, {}] } });
    expect(ready.requests.some((r) => r.actions.some((a) => a.type === "activateAbility"))).toBe(true); // the control: offered once it can tap
  });
});

/**
 * Post-S72 — the Storm Shaman (custom, Chris; working name), {1}{R}{R} 2/2 Elemental Shaman: "When this creature enters, return
 * target instant or sorcery card from your graveyard to your hand. Whenever you cast an instant or sorcery spell, add {R}."
 * (The rider is Chris's, after the first study.) Not a mana ability — it triggers on a cast, not on a mana ability (CR 605.1b) — so it uses the stack
 * and resolves before the spell; the mana empties as the step or phase ends (CR 500.5, 106.4). No new vocabulary (Waste Not's
 * triggered addMana; Guttersnipe's SPELL_CAST condition).
 */
describe("the Storm Shaman — {R} for each instant or sorcery we cast", () => {
  const pool = (tg: TestGame) => tg.game.state.players[0].manaPool.R;
  it("a Bolt cast off one Mountain pays for the second Bolt: the trigger resolves first and its {R} casts it", async () => {
    const tg = await runFixture({ name: "shaman", setup: { players: [{ battlefield: ["mountain", "storm_shaman"], hand: ["lightning_bolt", "lightning_bolt"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] }, { player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] }] });
    expect(tg.game.state.players[1].life).toBe(14);
    expect(pool(tg)).toBe(1); // the second Bolt's own trigger: one more {R}, floating
  });
  it("a creature spell does not trigger it; two Shamans add two", async () => {
    const one = await runFixture({ name: "shaman-creature", setup: { players: [{ battlefield: [...L("forest", 2), "storm_shaman"], hand: ["grizzly_bears"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "grizzly_bears" }] });
    expect(pool(one)).toBe(0);
    const two = await runFixture({ name: "shaman-two", setup: { players: [{ battlefield: ["mountain", "storm_shaman", "storm_shaman"], hand: ["lightning_bolt"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] }] });
    expect(pool(two)).toBe(2);
  });
  it("the rider: as it enters, an instant or sorcery comes back from our graveyard to hand — never a creature card; with none, nothing", async () => {
    const tg = await runFixture({ name: "shaman-regrow", setup: { players: [{ battlefield: L("mountain", 3), hand: ["storm_shaman"], graveyard: ["lightning_bolt", "hill_giant"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "storm_shaman" }] });
    expect(tg.game.state.players[0].hand.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["lightning_bolt"]);
    expect(gy(tg, 0)).toEqual(["hill_giant"]);
    const none = await runFixture({ name: "shaman-regrow-none", setup: { players: [{ battlefield: L("mountain", 3), hand: ["storm_shaman"], graveyard: ["hill_giant"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "storm_shaman" }] });
    expect(bf(none, 0)).toContain("storm_shaman");
    expect(gy(none, 0)).toEqual(["hill_giant"]);
  });
  it("the {R} empties as the phase ends (CR 500.5)", async () => {
    const tg = new TestGame({ name: "shaman-empty", setup: { players: [{ battlefield: ["mountain", "storm_shaman"], hand: ["lightning_bolt"], library: LIB }, { battlefield: [], library: LIB }] },
      script: [{ player: 0, do: "cast", card: "lightning_bolt", targets: [{ player: 1 }] }] });
    await tg.game.runStep("MAIN1"); // the step runs to its end: the Bolt and the trigger resolve, then the pool empties
    expect(tg.game.state.players[1].life).toBe(17);
    expect(pool(tg)).toBe(0); // (the fixture above shows the {R} floating inside the phase)
  });
});

/**
 * Post-S72 (R-133) — the Silt Spirit (custom, Chris; working name), {1}{U}{U} 0/3 Spirit Wizard: "Creatures you control have
 * '{T}: Target player mills X cards, where X is this creature's toughness.'" X is read as the ability resolves (CR 608.2h):
 * live while the creature stands, its last-known toughness if it has left. {T} in the cost (CR 302.6).
 */
describe("the Silt Spirit — creatures mill by their toughness (R-133)", () => {
  const lib = (tg: TestGame, p: 0 | 1) => tg.game.state.players[p].library.length;
  const BIG = Array.from({ length: 20 }, () => "island");
  it("the Spirit itself mills three; a Wall of Air beside it mills five", async () => {
    const tg = await runFixture({ name: "silt", setup: { players: [{ battlefield: ["silt_spirit", "wall_of_air"], library: LIB }, { battlefield: [], library: BIG }] },
      script: [{ player: 0, do: "activate", card: "silt_spirit", abilityIndex: 1, targets: [{ player: 1 }] }, { player: 0, do: "activate", card: "wall_of_air", abilityIndex: 0, targets: [{ player: 1 }] }] });
    expect(lib(tg, 1)).toBe(20 - 3 - 5);
  });
  it("killed in response, the Spirit still mills its last-known three (CR 608.2h)", async () => {
    const tg = await runFixture({ name: "silt-lki", setup: { players: [{ battlefield: ["silt_spirit"], library: LIB }, { battlefield: ["mountain"], hand: ["lightning_bolt"], library: BIG }] },
      script: [{ player: 0, do: "activate", card: "silt_spirit", abilityIndex: 1, targets: [{ player: 1 }] }, { player: 1, do: "cast", card: "lightning_bolt", targets: [{ object: "silt_spirit" }] }] });
    expect(gy(tg, 0)).toContain("silt_spirit");
    expect(lib(tg, 1)).toBe(17);
  });
  it("a summoning-sick creature has the ability but cannot pay {T}; without the Spirit the Wall has nothing to activate", async () => {
    const sick = new TestGame({ name: "silt-sick", setup: { players: [{ battlefield: [{ card: "silt_spirit", summoningSick: true }], hand: ["lightning_bolt"], library: LIB }, { battlefield: [], library: BIG }] } });
    await sick.run({ name: "silt-sick", setup: { players: [{}, {}] } });
    expect(sick.requests.some((r) => r.actions.some((a) => a.type === "activateAbility"))).toBe(false);
    const alone = new TestGame({ name: "silt-gone", setup: { players: [{ battlefield: ["wall_of_air"], hand: ["lightning_bolt"], library: LIB }, { battlefield: [], library: BIG }] } });
    await alone.run({ name: "silt-gone", setup: { players: [{}, {}] } });
    expect(alone.requests.some((r) => r.actions.some((a) => a.type === "activateAbility"))).toBe(false);
  });
});
