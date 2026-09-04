import { describe, expect, it } from "vitest";
import { TestGame } from "./harness.js";
import { getObject, legalActions } from "../src/index.js";

/**
 * S28 (ADR-096 / ADR-098): the Heart's roots and the five one-drops — fixtures written AFTER the
 * rooted heart fuzz (900 games, replays byte-exact) per the S3 protocol.
 */
const bf = (tg: TestGame, player: 0 | 1) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).controller === player).map((id) => getObject(tg.game.state, id).cardId);
const ROOTS = ["plains", "island", "swamp", "mountain", "forest"];

describe("S28 — the Heart's roots (ADR-096)", () => {
  it("turn one: five roots on the Manafleur's side and the card in hand — the cast is legal with no other land; at its end step the Intake stands", async () => {
    const tg = new TestGame({
      name: "roots-turn-one",
      setup: { turn: 1, active: 1, step: "MAIN1", players: [{ battlefield: ["forest"] }, { battlefield: ROOTS, hand: ["the_manafleur"] }] },
      script: [{ player: 1, do: "cast", card: "the_manafleur" }],
    });
    const offered = legalActions(tg.game.ctx, 1).filter((a) => a.type === "castSpell");
    expect(offered).toHaveLength(1);
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 1)).toContain("the_manafleur");
    expect(bf(tg, 1).filter((c) => ROOTS.includes(c))).toHaveLength(5); // the roots stay rooted
    await tg.game.runStep("END");
    expect(bf(tg, 1)).toContain("law_intake");
  });
});

describe("S28 — five one-drops (ADR-098)", () => {
  it("Unearth: only a creature card with mana value 3 or less is a legal target; it returns to the battlefield; cycling is offered from hand", async () => {
    const tg = new TestGame({
      name: "unearth",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["swamp", "swamp", "swamp"], hand: ["unearth"], graveyard: ["grizzly_bears", "serra_angel"] }, { battlefield: [] }] },
      script: [{ player: 0, do: "cast", card: "unearth", targets: [{ graveyard: "grizzly_bears" }] }],
    });
    const casts = legalActions(tg.game.ctx, 0).filter((a) => a.type === "castSpell");
    expect(casts).toHaveLength(1); // the Angel (MV 5) is never offered
    expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility")).toBe(true); // cycling {2}
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0)).toContain("grizzly_bears");
    expect(tg.graveyardCardIds(0)).toEqual(expect.arrayContaining(["serra_angel", "unearth"]));
  });

  it("Brainstorm: draw three, then two picks go back — the FIRST pick ends on top; a short hand puts back what it has without crashing", async () => {
    const tg = new TestGame({
      name: "brainstorm",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["island"], hand: ["brainstorm"], library: ["savannah_lions", "grizzly_bears", "wind_drake", "plains"] }, { battlefield: [] }] },
      script: [
        { player: 0, do: "cast", card: "brainstorm" },
        { player: 0, do: "putOnTop", card: "wind_drake" },
        { player: 0, do: "putOnTop", card: "savannah_lions" },
      ],
    });
    await tg.game.runStep("MAIN1");
    const lib = tg.game.state.players[0].library.map((id) => getObject(tg.game.state, id).cardId);
    expect(lib.slice(0, 3)).toEqual(["wind_drake", "savannah_lions", "plains"]); // first pick on top, then the second, then the untouched card
    expect(tg.game.state.players[0].hand.map((id) => getObject(tg.game.state, id).cardId)).toEqual(["grizzly_bears"]);
    // The short hand: one card in the library — the draw empties it, the lone card goes back, no exception.
    const short = new TestGame({
      name: "brainstorm-short",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["island"], hand: ["brainstorm"], library: ["plains"] }, { battlefield: [], library: ["forest", "forest", "forest"] }] },
      script: [{ player: 0, do: "cast", card: "brainstorm" }],
    });
    await expect(short.game.runStep("MAIN1")).resolves.not.toThrow();
  });

  it("Orcish Lumberjack: four combination variants; sacrificing a Forest (a manalink Forest is a real permanent) adds the chosen multiset", async () => {
    const tg = new TestGame({
      name: "lumberjack",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["orcish_lumberjack", "forest", "mountain"] }, { battlefield: [] }] },
      script: [{ player: 0, do: "activate", card: "orcish_lumberjack", abilityIndex: 0, colors: ["R", "G", "G"] }, { player: 0, do: "sacrificeChoice", card: "forest" }],
    });
    const variants = legalActions(tg.game.ctx, 0).filter((a) => a.type === "activateAbility" && getObject(tg.game.state, a.objectId).cardId === "orcish_lumberjack");
    expect(variants.map((a) => (a as { colors?: string[] }).colors?.join(""))).toEqual(["RRR", "RRG", "RGG", "GGG"]);
    await tg.game.priorityRound();
    expect(tg.game.state.players[0].manaPool).toMatchObject({ R: 1, G: 2 });
    expect(tg.graveyardCardIds(0)).toContain("forest");
    expect(bf(tg, 0)).not.toContain("forest");
  });

  it("Spirit Link on an OPPOSING creature: the AURA's controller gains what it deals — to a player, and to a creature — and the gain is a trigger on the stack: lethal damage kills the aura's controller before it resolves", async () => {
    // A. P0 enchants P1's Bears on P0's turn; on P1's turn the Bears hit P0: −2, then +2 (P1 gains nothing).
    const tg = new TestGame({
      name: "spirit-link-theirs",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["plains"], hand: ["spirit_link"] }, { battlefield: ["grizzly_bears"] }] },
      script: [{ player: 0, do: "cast", card: "spirit_link", targets: [{ object: "grizzly_bears" }] }, { player: 1, do: "attack", attackers: ["grizzly_bears"] }],
    });
    await tg.game.runStep("MAIN1");
    expect(getObject(tg.game.state, tg.findBattlefield("spirit_link")).attachedTo).toBe(tg.findBattlefield("grizzly_bears"));
    tg.game.state.activePlayer = 1;
    await tg.game.runStep("DECLARE_ATTACKERS");
    await tg.game.runStep("COMBAT_DAMAGE");
    await tg.game.priorityRound();
    expect(tg.game.state.players[0].life).toBe(20);
    expect(tg.game.state.players[1].life).toBe(20);
    // B. Damage to a CREATURE pays too: P1's Link on P0's Courser; the Courser attacks, P1's Bears block — the Courser deals 3 to the Bears, P1 (the aura's controller) gains 3.
    const block = new TestGame({
      name: "spirit-link-creature-damage",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["centaur_courser"] }, { battlefield: ["plains", "grizzly_bears", { card: "spirit_link", attachedTo: "centaur_courser" }] }] },
      script: [{ player: 0, do: "attack", attackers: ["centaur_courser"] }, { player: 1, do: "block", blocks: [{ blocker: "grizzly_bears", attacker: "centaur_courser" }] }],
    });
    await block.game.runStep("DECLARE_ATTACKERS");
    await block.game.runStep("DECLARE_BLOCKERS");
    await block.game.runStep("COMBAT_DAMAGE");
    await block.game.priorityRound();
    expect(block.game.state.players[1].life).toBe(23);
    expect(block.game.state.players[0].life).toBe(20);
    expect(block.graveyardCardIds(1)).toContain("grizzly_bears");
    // C. The ordering (Scryfall's ruling): P1 at 2 life holds the Link on P0's Bears; the Bears connect — the SBA takes P1 before the gain resolves (lifelink would have saved it).
    const lethal = new TestGame({
      name: "spirit-link-lethal",
      setup: { active: 0, step: "DECLARE_ATTACKERS", players: [{ battlefield: ["grizzly_bears"] }, { life: 2, battlefield: ["plains", { card: "spirit_link", attachedTo: "grizzly_bears" }] }] },
      script: [{ player: 0, do: "attack", attackers: ["grizzly_bears"] }],
    });
    await lethal.game.runStep("DECLARE_ATTACKERS");
    await lethal.game.runStep("COMBAT_DAMAGE");
    await lethal.game.priorityRound();
    expect(lethal.game.state.result?.winner).toBe(0);
  });

  it("Prey Upon with the flower as the fighter: the 7/7 kills a 4/4 and stands", async () => {
    const tg = new TestGame({
      name: "prey-upon-flower",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["forest", "the_manafleur"], hand: ["prey_upon"] }, { battlefield: ["rumbling_baloth"] }] },
      script: [{ player: 0, do: "cast", card: "prey_upon", targets: [{ object: "the_manafleur" }, { object: "rumbling_baloth" }] }],
    });
    await tg.game.runStep("MAIN1");
    expect(tg.graveyardCardIds(1)).toContain("rumbling_baloth");
    expect(bf(tg, 0)).toContain("the_manafleur");
    expect(getObject(tg.game.state, tg.findBattlefield("the_manafleur")).damage).toBe(4);
  });

  it("Birds of Paradise: auto-pay taps it for the colour a spell is short (the dual path)", async () => {
    const tg = new TestGame({
      name: "birds",
      setup: { active: 0, step: "MAIN1", players: [{ battlefield: ["birds_of_paradise", "forest"], hand: ["savannah_lions"] }, { battlefield: [] }] },
      script: [{ player: 0, do: "cast", card: "savannah_lions" }],
    });
    expect(legalActions(tg.game.ctx, 0).some((a) => a.type === "castSpell")).toBe(true);
    await tg.game.runStep("MAIN1");
    expect(bf(tg, 0)).toContain("savannah_lions");
    expect(getObject(tg.game.state, tg.findBattlefield("birds_of_paradise")).tapped).toBe(true);
  });
});
