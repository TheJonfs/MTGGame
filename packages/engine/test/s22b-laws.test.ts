import { describe, expect, it } from "vitest";
import { ArrayLog, SeededRng } from "@shandalar/core";
import { applyModifiers, Game, getObject, legalActions, type ActionSource } from "../src/index.js";
import { runFixture, testPool, TestGame, type FixtureSpec } from "./harness.js";

/**
 * S22b fixtures — the two law-words (the Risen Tide's land-drop counter; the Intake's imposed
 * enters-tapped), the bounced-law-stuck-in-hand quirk, and the lord's entrance (signatureToHand).
 */

type TG = Awaited<ReturnType<typeof runFixture>>;
const onBf = (tg: TG, cardId: string) => tg.game.state.battlefield.filter((id) => getObject(tg.game.state, id).cardId === cardId);

describe("the Risen Tide — extraLandDrops (A10 law-word)", () => {
  it("its controller plays a second land; the count is a statics read, not a bare 1", async () => {
    const spec: FixtureSpec = {
      name: "risen-tide",
      setup: { players: [
        { battlefield: ["law_risen_tide"], hand: ["island", "forest"] },
        {},
      ] },
      script: [
        { player: 0, do: "playLand", card: "island" },
        { player: 0, do: "playLand", card: "forest" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "island")).toHaveLength(1);
    expect(onBf(tg, "forest")).toHaveLength(1); // the second drop — the law's whole text
  });

  it("without the law the second drop is never offered (no regression on the bare count)", async () => {
    const tg = new TestGame({
      name: "no-tide",
      setup: { players: [{ hand: ["island", "forest"] }, {}] },
      script: [{ player: 0, do: "playLand", card: "island" }],
    });
    await tg.game.priorityRound();
    const actions = legalActions(tg.game.ctx, 0);
    expect(actions.some((a) => a.type === "playLand")).toBe(false);
  });
});

describe("the Intake — imposeEntersTapped (A10 law-word)", () => {
  it("the intruder's creatures enter tapped by EVERY path (cast and effect-placed); the law's own side enters free", async () => {
    // The law sits on P1's side ("the intruder" = P0, its opponent).
    const spec: FixtureSpec = {
      name: "intake",
      setup: { players: [
        { battlefield: ["forest", "forest", "swamp", "swamp", "swamp", "swamp"], hand: ["grizzly_bears", "zombify"], graveyard: ["centaur_courser"] },
        { battlefield: ["law_intake"], hand: ["grizzly_bears"], library: [] },
      ], active: 0 },
      script: [
        { player: 0, do: "cast", card: "grizzly_bears" },
        { player: 0, do: "cast", card: "zombify", targets: [{ graveyard: "centaur_courser" }] },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const bears = onBf(tg, "grizzly_bears")[0]!;
    expect(getObject(tg.game.state, bears).tapped).toBe(true); // cast path pays the law
    const courser = onBf(tg, "centaur_courser")[0]!;
    expect(getObject(tg.game.state, courser).tapped).toBe(true); // reanimation pays it too — any entry does
  });

  it("the law's controller's own creatures are untouched", async () => {
    const spec: FixtureSpec = {
      name: "intake-own",
      setup: { active: 1, players: [
        {},
        { battlefield: ["law_intake", "forest", "forest"], hand: ["grizzly_bears"] },
      ] },
      script: [{ player: 1, do: "cast", card: "grizzly_bears" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(getObject(tg.game.state, onBf(tg, "grizzly_bears")[0]!).tapped).toBe(false);
  });
});

describe("the blessed Boomerang quirk — a bounced law is stuck in hand", () => {
  it("the tide-mage unwrites what others tear down: the bounced law sits in the owner's hand, uncastable", async () => {
    const spec: FixtureSpec = {
      name: "law-bounced",
      setup: { active: 1, players: [
        { battlefield: ["law_toll"] },
        { battlefield: ["island", "island"], hand: ["boomerang"] },
      ] },
      script: [{ player: 1, do: "cast", card: "boomerang", targets: [{ object: "law_toll" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "law_toll")).toHaveLength(0);
    expect(tg.handCardIds(0)).toContain("law_toll"); // a real object — it SURVIVED the bounce (not a token)
    const actions = legalActions(tg.game.ctx, 0);
    expect(actions.some((a) => a.type === "castSpell" || a.type === "playLand")).toBe(false); // and it can never be recast
  });

  it("Abrade tears a law down the honest way (destroy target artifact)", async () => {
    const spec: FixtureSpec = {
      name: "law-abraded",
      setup: { active: 1, players: [
        { battlefield: ["law_season"] },
        { battlefield: ["mountain", "island"], hand: ["abrade"] },
      ] },
      script: [{ player: 1, do: "cast", card: "abrade", mode: 1, targets: [{ object: "law_season" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(onBf(tg, "law_season")).toHaveLength(0);
    expect(tg.graveyardCardIds(0)).toContain("law_season");
  });
});

describe("the lord's entrance — signatureToHand (Chris-ratified)", () => {
  const DECK: string[] = [
    ...Array(17).fill("mountain"),
    ...Array(3).fill("the_stoker"),
    ...Array(10).fill("shock"),
    ...Array(10).fill("blaze"),
  ];
  const P0_DECK: string[] = [...Array(20).fill("forest"), ...Array(20).fill("grizzly_bears")];

  async function setupWith(seed: number, sigCardId = "the_stoker"): Promise<Game> {
    const log = new ArrayLog<never>();
    const source: ActionSource = (req) => Promise.resolve(req.actions[0]!); // keep every hand
    const game = new Game(testPool(), [P0_DECK, DECK], new SeededRng(seed, log as never), log as never, source);
    await game.setup();
    applyModifiers(game.ctx, [{ type: "signatureToHand", player: 1, cardId: sigCardId }]);
    return game;
  }

  it("post-mulligan swap: the signature comes to hand, a nonland went back, hand size holds at 7", async () => {
    const game = await setupWith(11);
    const hand = game.state.players[1].hand.map((id) => getObject(game.state, id).cardId);
    expect(hand).toContain("the_stoker");
    expect(hand).toHaveLength(7);
    // Library integrity: 40 − 7 = 33 cards, no duplication or loss through the swap+shuffle.
    expect(game.state.players[1].library).toHaveLength(33);
  });

  it("deterministic: the same seed swaps the same card", async () => {
    const a = await setupWith(23);
    const b = await setupWith(23);
    const hand = (g: Game) => g.state.players[1].hand.map((id) => getObject(g.state, id).cardId).sort();
    expect(hand(a)).toEqual(hand(b));
  });

  it("no library copy → no-op (the Hymn counterplay's engine half: a stripped signature is NOT restored)", async () => {
    const game = await setupWith(31, "the_warden"); // not in this deck at all
    const hand = game.state.players[1].hand.map((id) => getObject(game.state, id).cardId);
    expect(hand).not.toContain("the_warden");
    expect(hand).toHaveLength(7); // nothing was swapped out
  });
});

describe("S22 r2 — startingPlayer (the coin flip's engine half)", () => {
  const DECKA: string[] = [...Array(20).fill("forest"), ...Array(20).fill("grizzly_bears")];
  const DECKB: string[] = [...Array(20).fill("mountain"), ...Array(20).fill("shock")];

  async function firstTurns(startingPlayer: 0 | 1): Promise<{ active: number; hands: [number, number] }> {
    const log = new ArrayLog<never>();
    const source: ActionSource = (req) => Promise.resolve(req.actions[0]!);
    const game = new Game(testPool(), [DECKA, DECKB], new SeededRng(5, log as never), log as never, source, { startingLife: 20, handSize: 7, maxTurns: 1, ante: 0, startingPlayer });
    await game.run([]);
    return { active: game.state.activePlayer, hands: [game.state.players[0].hand.length, game.state.players[1].hand.length] };
  }

  it("seat 1 on the play: takes turn 1 and skips its first draw (CR 103.8a); seat 0 unchanged by default", async () => {
    const flipped = await firstTurns(1);
    expect(flipped.active).toBe(1); // turn 1 belonged to seat 1
    expect(flipped.hands[1]).toBe(7); // the starting player skipped the draw
    const normal = await firstTurns(0);
    expect(normal.active).toBe(0);
    expect(normal.hands[0]).toBe(7);
  });
});

describe("the Tithe — observed DIES on the law (S25 playtest r2: Chris's Charnel Court report)", () => {
  // Investigated live: every entry path verified draining correctly (setup, the modifier path,
  // direct kills, combat batches BOTH sides, token deaths). No defect found; pinned here so a
  // regression announces itself. The report stays on watch (the fight wasn't recorded — see the
  // interior-duel record fix, same round).
  it("a combat trade under the Tithe drains the intruder for BOTH deaths (its controller's creature included)", async () => {
    const spec: FixtureSpec = {
      name: "tithe-combat-pin",
      setup: {
        active: 0, step: "MAIN1",
        players: [
          { life: 20, battlefield: [{ card: "grizzly_bears", summoningSick: false }] },
          { life: 20, battlefield: ["law_tithe", "grizzly_bears"] },
        ],
      },
      script: [
        { player: 0, do: "attack", attackers: ["grizzly_bears"] },
        { player: 1, do: "block", blocks: [{ blocker: "grizzly_bears", attacker: "grizzly_bears" }] },
      ],
      run: [{ steps: ["COMBAT_BEGIN", "DECLARE_ATTACKERS", "DECLARE_BLOCKERS", "COMBAT_DAMAGE", "COMBAT_END"] }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[0].life).toBe(18); // one per death, intruder only
    expect(tg.game.state.players[1].life).toBe(20);
  });
});
