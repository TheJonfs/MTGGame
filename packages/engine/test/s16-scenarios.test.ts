import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, getObject, replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../src/index.js";
import { TestGame, runFixture, type FixtureSpec } from "./harness.js";

/**
 * S16 fixtures (ADR-070): the `mill` resolver (Cathartic Adept) and the
 * CR 302.6 / 602.5g summoning-sickness gate on creature mana producers
 * (Llanowar Elves).
 */

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const realPool = loadCardPool(CARDS_DIR);

const evt = (tg: Awaited<ReturnType<typeof runFixture>>, name: string) =>
  tg.log.entries.filter((e) => e.t === "EVENT" && (e as { name: string }).name === name) as unknown as { name: string; payload: Record<string, unknown> }[];

describe("mill (R-046, Amendment 3)", () => {
  it("Cathartic Adept: {T}: target player mills a card — top card to THEIR graveyard via a zone change; a MILLED event per card; not a draw", async () => {
    const spec: FixtureSpec = {
      name: "adept-mill",
      setup: { players: [{ battlefield: ["cathartic_adept"] }, { library: ["serra_angel", "island"] }] },
      script: [{ player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(tg.graveyardCardIds(1)).toEqual(["serra_angel"]);
    expect(st.players[1].library).toHaveLength(1);
    expect(st.players[1].attemptedDrawFromEmpty).toBeFalsy();
    expect(st.players[1].hand).toHaveLength(0);
    expect(evt(tg, "MILLED")).toHaveLength(1);
    expect(evt(tg, "MILLED")[0]!.payload.player).toBe(1);
    expect(evt(tg, "CARD_DRAWN")).toHaveLength(0);
    // Mill is targeted: the same activation could have aimed at yourself.
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    const acts = first.actions.filter((a) => a.type === "activateAbility");
    expect(acts).toHaveLength(2); // target player 0 / player 1
  });

  it("a summoning-sick Adept offers no activation; an empty library mills nothing and nobody loses", async () => {
    const sick: FixtureSpec = {
      name: "adept-sick",
      setup: { players: [{ battlefield: [{ card: "cathartic_adept", summoningSick: true }], hand: ["island"] }, { library: ["island"] }] }, // the land in hand keeps a request coming (lone pass is auto-taken)
      run: [{ priority: true }],
    };
    const tg = await runFixture(sick);
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    expect(first.actions.some((a) => a.type === "activateAbility")).toBe(false);
    const empty: FixtureSpec = {
      name: "adept-empty",
      setup: { players: [{ battlefield: ["cathartic_adept"] }, { library: [] }] },
      script: [{ player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg2 = await runFixture(empty);
    expect(tg2.game.state.result).toBeFalsy();
    expect(tg2.game.state.players[1].attemptedDrawFromEmpty).toBeFalsy();
    expect(evt(tg2, "MILLED")).toHaveLength(0);
  });

  it("mill-to-empty does not lose; the DRAW from the empty library does (CR 704.5b) — decking is the draw, not the mill", async () => {
    const spec: FixtureSpec = {
      name: "adept-deck-out",
      setup: { turn: 4, active: 0, step: "MAIN1", players: [{ battlefield: ["cathartic_adept"], library: ["mountain", "mountain"] }, { library: ["island"] }] },
      script: [{ player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.game.state.players[1].library).toHaveLength(0);
    expect(tg.game.state.result).toBeFalsy(); // milled to empty: still in the game
    // Now player 1's turn: upkeep → draw from the empty library → loss at the next SBA check.
    tg.game.state.activePlayer = 1;
    tg.game.state.step = "UPKEEP";
    await tg.game.runStep("DRAW");
    expect(tg.game.state.result).toEqual({ winner: 0, reason: "DECKED" });
  });

  it("a milled Pelakka Wurm does NOT trigger its DIES ability (library→graveyard is not a death, CR 700.4); the zone-change event still fires", async () => {
    const spec: FixtureSpec = {
      name: "adept-mills-wurm",
      setup: { players: [{ battlefield: ["cathartic_adept"] }, { library: ["pelakka_wurm", "forest"], hand: [] }] },
      script: [{ player: 0, do: "activate", card: "cathartic_adept", abilityIndex: 0, targets: [{ player: 1 }] }],
      run: [{ priority: true }],
    };
    const tg = new TestGame(spec);
    const moves: { cardId: string; from: string | null; to: string }[] = [];
    tg.game.ctx.bus.on("ZONE_CHANGE", (e) => moves.push({ cardId: e.cardId, from: e.from, to: e.to }));
    await tg.run(spec);
    expect(tg.graveyardCardIds(1)).toEqual(["pelakka_wurm"]);
    expect(tg.game.state.players[1].hand).toHaveLength(0); // no DIES draw
    expect(tg.game.state.pendingTriggers).toHaveLength(0);
    expect(evt(tg, "CARD_DRAWN")).toHaveLength(0);
    expect(evt(tg, "DIES")).toHaveLength(0); // the log's DIES fact is battlefield→graveyard only
    expect(moves).toEqual([{ cardId: "pelakka_wurm", from: "library", to: "graveyard" }]);
  });

  it("replay determinism: a full game with Adepts milling replays byte-identical", async () => {
    const millHappy: Agent = {
      chooseAction: async (_v: GameView, req: ActionRequest): Promise<Action> => {
        if (req.purpose === "priority") {
          const act = req.actions.find((a) => a.type === "activateAbility");
          if (act) return act;
          const cast = req.actions.find((a) => a.type === "castSpell");
          if (cast) return cast;
          const land = req.actions.find((a) => a.type === "playLand");
          if (land) return land;
          return req.actions.find((a) => a.type === "pass") ?? req.actions[0]!;
        }
        return req.actions[req.actions.length - 1]!;
      },
    };
    const spec: MatchSpec = {
      seed: 16,
      players: [
        { name: "U", decklist: [{ cardId: "island", count: 12 }, { cardId: "cathartic_adept", count: 4 }, { cardId: "wind_drake", count: 4 }], agent: "x" },
        { name: "G", decklist: [{ cardId: "forest", count: 12 }, { cardId: "llanowar_elves", count: 4 }, { cardId: "grizzly_bears", count: 4 }], agent: "x" },
      ],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 14 },
      modifiers: [],
    };
    const live = await runMatch(spec, realPool.cards, [millHappy, millHappy]);
    expect(live.log.some((e) => e.t === "EVENT" && (e as { name: string }).name === "MILLED")).toBe(true);
    const replayed = await replayGame(realPool.cards, [expandDecklist(spec.players[0].decklist), expandDecklist(spec.players[1].decklist)], live.log, { startingLife: 20, handSize: 7, maxTurns: 14, ante: 0 }, []);
    expect(replayed).toBe(live.finalStateSerialized);
  });
});

describe("creature mana producers (CR 302.6 / 602.5g; Llanowar Elves)", () => {
  it("T1 Elves → T2 three-drop: a rested Elves plus two Forests casts Centaur Courser; the Elves taps for it", async () => {
    const spec: FixtureSpec = {
      name: "elves-t2-courser",
      setup: { turn: 2, players: [{ battlefield: ["forest", "forest", "llanowar_elves"], hand: ["centaur_courser"] }, {}] },
      script: [{ player: 0, do: "cast", card: "centaur_courser" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.battlefield.some((id) => getObject(st, id).cardId === "centaur_courser")).toBe(true);
    expect(getObject(st, tg.findBattlefield("llanowar_elves")).tapped).toBe(true);
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    expect(first.actions.some((a) => a.type === "tapForMana" && getObject(st, (a as { objectId: string }).objectId).cardId === "llanowar_elves")).toBe(true);
  });

  it("auto-pay prefers lands over creature producers (S16, Chris): three Forests + a rested Elves casting Courser leaves the Elves untapped; it pays only when the lands can't", async () => {
    const spec: FixtureSpec = {
      name: "elves-last",
      setup: { turn: 3, players: [{ battlefield: ["forest", "forest", "forest", "llanowar_elves"], hand: ["centaur_courser"] }, {}] },
      script: [{ player: 0, do: "cast", card: "centaur_courser" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(getObject(st, tg.findBattlefield("llanowar_elves")).tapped).toBe(false);
    expect(st.battlefield.filter((id) => getObject(st, id).cardId === "forest").every((id) => getObject(st, id).tapped)).toBe(true);
    // Two Forests + Elves: now the Elves must pay.
    const spec2: FixtureSpec = { ...spec, name: "elves-needed", setup: { turn: 3, players: [{ battlefield: ["forest", "forest", "llanowar_elves"], hand: ["centaur_courser"] }, {}] } };
    const tg2 = await runFixture(spec2);
    expect(getObject(tg2.game.state, tg2.findBattlefield("llanowar_elves")).tapped).toBe(true);
  });

  it("a summoning-sick Elves contributes nothing: no tapForMana offered, canPay excludes it (Courser not castable off two Forests + sick Elves)", async () => {
    const spec: FixtureSpec = {
      name: "elves-sick",
      setup: { turn: 1, players: [{ battlefield: ["forest", "forest", { card: "llanowar_elves", summoningSick: true }], hand: ["centaur_courser", "grizzly_bears"] }, {}] },
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    const cardOf = (a: Action) => ("objectId" in a ? getObject(st, (a as { objectId: string }).objectId).cardId : "");
    expect(first.actions.some((a) => a.type === "tapForMana" && cardOf(a) === "llanowar_elves")).toBe(false);
    expect(first.actions.some((a) => a.type === "castSpell" && cardOf(a) === "centaur_courser")).toBe(false);
    expect(first.actions.some((a) => a.type === "castSpell" && cardOf(a) === "grizzly_bears")).toBe(true); // two Forests still pay {1}{G}
  });

  it("in a real game the Elves cast on turn 1 is sick that turn and pays on turn 2 (the gate clears at untap)", async () => {
    // Player 0 casts Elves T1 (Forest + Elves); on T2 (Forest) the enumerator offers a 3-mana cast.
    const spec: FixtureSpec = {
      name: "elves-live",
      setup: { turn: 1, players: [{ battlefield: ["forest"], hand: ["llanowar_elves", "centaur_courser"], library: ["forest", "forest", "forest"] }, { library: ["island", "island", "island"] }] },
      script: [{ player: 0, do: "cast", card: "llanowar_elves" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const elves = tg.findBattlefield("llanowar_elves");
    expect(getObject(st, elves).summoningSick).toBe(true);
    // Still T1: Courser was never castable (one Forest, sick Elves) — no request offered it.
    const offeredCourser = tg.requests.some((r) => r.purpose === "priority" && r.actions.some((a) => a.type === "castSpell" && st.objects[(a as { objectId: string }).objectId]?.cardId === "centaur_courser"));
    expect(offeredCourser).toBe(false);
    // Advance to player 0's next untap/upkeep; the Elves is rested.
    st.activePlayer = 1;
    st.step = "END";
    await tg.game.runStep("CLEANUP");
    st.activePlayer = 0;
    await tg.game.runStep("UNTAP");
    expect(getObject(st, elves).summoningSick).toBe(false);
  });

  it("Elves is a creature: Doom Blade kills it like any nonblack creature", async () => {
    const spec: FixtureSpec = {
      name: "elves-doom-blade",
      setup: { players: [{ battlefield: ["swamp", "swamp"], hand: ["doom_blade"] }, { battlefield: ["llanowar_elves"] }] },
      script: [{ player: 0, do: "cast", card: "doom_blade", targets: [{ object: "llanowar_elves" }] }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.graveyardCardIds(1)).toEqual(["llanowar_elves"]);
    expect(tg.battlefieldCardIds()).not.toContain("llanowar_elves");
  });
});
