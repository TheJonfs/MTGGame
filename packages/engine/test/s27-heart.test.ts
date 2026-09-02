import { describe, expect, it } from "vitest";
import { getObject } from "../src/index.js";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";

/**
 * S27 fixtures — the Manafleur (the-bloom-gauntlet-v1.md v1.3–1.4; ADR-093): blooms the turn it
 * is cast (its controller's end step), each petal stands one full round, the game-level sequence
 * continues across a second copy / a reanimated copy / a Control Magic theft, exile-all takes both
 * sides' laws, the Disenchant tempo (lawless until the next end step, then the NEXT petal), Wrath
 * stops growth until a copy returns, a player-cast Manafleur grows petals against the AI, and the
 * data hooks (random replays elsewhere; accumulate keeps the petals).
 */
type TG = Awaited<ReturnType<typeof runFixture>>;
const lawsOn = (tg: TG, player?: 0 | 1) => tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).filter((o) => o.cardId.startsWith("law_") && (player === undefined || o.controller === player)).map((o) => o.cardId);
const FIVE = ["plains", "island", "swamp", "mountain", "forest"];

describe("The Manafleur — the bloom and the sequence", () => {
  it("blooms the turn it is cast: the first petal (the Intake, white) at its controller's end step; the opponent grows nothing; the pointer advances", async () => {
    const tg = new TestGame({
      name: "manafleur-blooms",
      setup: { players: [{ battlefield: FIVE, hand: ["the_manafleur"] }, {}] },
      script: [{ player: 0, do: "cast", card: "the_manafleur" }],
    });
    await tg.game.priorityRound();
    expect(lawsOn(tg)).toEqual([]);
    await tg.game.runStep("END");
    expect(lawsOn(tg, 0)).toEqual(["law_intake"]);
    expect(lawsOn(tg, 1)).toEqual([]);
    expect(tg.game.state.lawSequence.next).toBe(1);
    const law = tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).find((o) => o.cardId === "law_intake")!;
    expect(law.isToken).toBe(true);
  });

  it("each petal stands one full round: the opponent's end step grows nothing; the next own end step exiles the Intake and creates the Tithe (black)", async () => {
    const tg = new TestGame({ name: "manafleur-round", setup: { players: [{ battlefield: ["the_manafleur"] }, {}] } });
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_intake"]);
    tg.game.state.activePlayer = 1;
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_intake"]); // not its controller's end step
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_tithe"]);
    expect(tg.game.state.players[0].exile.length + tg.game.state.players[1].exile.length).toBe(0); // the exiled law was a token: it ceased
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_toll"]);
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_risen_tide"]);
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_season"]);
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_intake"]); // the ring closes: W → B → R → U → G → W
  });

  it("exile-all takes BOTH sides' laws: the opponent's returned law goes too, then the next petal grows for the Manafleur's controller", async () => {
    const tg = new TestGame({ name: "manafleur-both-sides", setup: { players: [{ battlefield: ["the_manafleur", "law_intake"] }, { battlefield: ["law_toll"] }] } });
    tg.game.state.lawSequence.next = 1;
    await tg.game.runStep("END");
    expect(lawsOn(tg, 1)).toEqual([]);
    expect(lawsOn(tg, 0)).toEqual(["law_tithe"]);
  });

  it("the Disenchant tempo: a torn-out petal leaves the fight lawless until the next end step — and then the NEXT petal grows, not the same one", async () => {
    const spec: FixtureSpec = {
      name: "manafleur-disenchant",
      setup: { active: 1, players: [
        { battlefield: ["the_manafleur", "law_intake"] },
        { battlefield: ["plains", "plains"], hand: ["disenchant"] },
      ] },
      script: [{ player: 1, do: "cast", card: "disenchant", targets: [{ object: "law_intake" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    tg.game.state.lawSequence.next = 1; // the Intake was the last petal grown
    expect(lawsOn(tg)).toEqual([]); // lawless now
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_tithe"]); // the sequence moved on
  });

  it("Wrath kills it and growth stops; a second copy cast later CONTINUES the sequence (the pointer is the game's, not the creature's)", async () => {
    const tg = new TestGame({
      name: "manafleur-wrath-second-copy",
      setup: { active: 1, players: [
        { battlefield: [...FIVE, "the_manafleur", "law_intake"], hand: ["the_manafleur"] },
        { battlefield: ["swamp", "swamp"], hand: ["test_wrath"] },
      ] },
      script: [{ player: 1, do: "cast", card: "test_wrath" }, { player: 0, do: "cast", card: "the_manafleur" }],
    });
    tg.game.state.lawSequence.next = 1;
    await tg.game.priorityRound(); // P1's Wrath resolves in P1's main phase
    expect(tg.game.state.battlefield.map((id) => getObject(tg.game.state, id).cardId)).not.toContain("the_manafleur");
    expect(lawsOn(tg)).toEqual(["law_intake"]); // the standing petal survives the Wrath (a law is no creature)
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_intake"]); // growth stopped
    // P0's next turn: the second copy.
    await tg.game.runStep("MAIN1");
    expect(tg.game.state.battlefield.map((id) => getObject(tg.game.state, id).cardId)).toContain("the_manafleur");
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_tithe"]); // continues — not the Intake again
  });

  it("a reanimated copy continues the sequence too (Zombify)", async () => {
    const tg = new TestGame({
      name: "manafleur-zombify",
      setup: { players: [{ battlefield: ["swamp", "swamp", "swamp", "swamp", "law_toll"], hand: ["zombify"], graveyard: ["the_manafleur"] }, {}] },
      script: [{ player: 0, do: "cast", card: "zombify", targets: [{ graveyard: "the_manafleur" }] }],
    });
    tg.game.state.lawSequence.next = 3; // the Toll was last
    await tg.game.priorityRound();
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_risen_tide"]);
  });

  it("a Control Magic theft: the stolen flower grows petals for its NEW controller at that player's end step, exiling what it grew for the old one", async () => {
    const spec: FixtureSpec = {
      name: "manafleur-theft",
      setup: { active: 1, players: [
        { battlefield: ["the_manafleur", "law_intake"] },
        { battlefield: ["island", "island", "island", "island"], hand: ["control_magic"] },
      ] },
      script: [{ player: 1, do: "cast", card: "control_magic", targets: [{ object: "the_manafleur" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    tg.game.state.lawSequence.next = 1;
    const mf = tg.game.state.battlefield.map((id) => getObject(tg.game.state, id)).find((o) => o.cardId === "the_manafleur")!;
    expect(mf.controller).toBe(1);
    await tg.game.runStep("END"); // P1's end step (active 1)
    expect(lawsOn(tg, 0)).toEqual([]);
    expect(lawsOn(tg, 1)).toEqual(["law_tithe"]);
    tg.game.state.activePlayer = 0;
    await tg.game.runStep("END"); // P0's end step: no longer its controller — nothing
    expect(lawsOn(tg, 1)).toEqual(["law_tithe"]);
  });

  it("accumulate mode keeps every petal (the exile is skipped); random mode draws from the logged RNG", async () => {
    const tg = new TestGame({ name: "manafleur-accumulate", setup: { players: [{ battlefield: ["the_manafleur"] }, {}] } });
    tg.game.state.lawSequence.mode = "accumulate";
    await tg.game.runStep("END");
    await tg.game.runStep("END");
    expect(lawsOn(tg)).toEqual(["law_intake", "law_tithe"]);
    const tr = new TestGame({ name: "manafleur-random", setup: { players: [{ battlefield: ["the_manafleur"] }, {}] } });
    tr.game.state.lawSequence.mode = "random";
    await tr.game.runStep("END");
    expect(lawsOn(tr)).toHaveLength(1);
    expect(tr.log.entries.some((e) => (e as { t: string; purpose?: string }).t === "RNG" && (e as { purpose?: string }).purpose === "lawSequence")).toBe(true);
  });
});
