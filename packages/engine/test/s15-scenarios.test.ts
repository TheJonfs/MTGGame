import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, getObject, replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "../src/index.js";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S15 fixtures (ADR-068 Amendments 1 & 2): searchLibrary (Growth, Tutor,
 * decline, no-match, replay, opponent log hygiene) and the Lotus colour
 * choice (turn-2 Angel line, logged/replayed choice, sacrifice-trigger order).
 */

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const realPool = loadCardPool(CARDS_DIR);

describe("searchLibrary (R-044, Amendment 1)", () => {
  it("Rampant Growth: the chosen basic enters tapped, landfall fires, shuffle follows (RNG logged)", async () => {
    const spec: FixtureSpec = {
      name: "growth",
      setup: { players: [{ battlefield: ["forest", "forest"], hand: ["rampant_growth"], library: ["forest", "grizzly_bears", "island", "forest"] }, {}] },
      script: [{ player: 0, do: "cast", card: "rampant_growth" }, { player: 0, do: "search", card: "island" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const island = st.battlefield.find((id) => getObject(st, id).cardId === "island");
    expect(island).toBeTruthy();
    expect(getObject(st, island!).tapped).toBe(true);
    expect(st.players[0].library).toHaveLength(3);
    const req = tg.requests.find((r) => r.purpose === "searchLibrary")!;
    expect(req.revealed?.map((r) => r.cardId).sort()).toEqual(["forest", "island"]); // basics only, deduped
    expect(req.actions[0]!.type).toBe("declineSearch"); // safe default first
    const shuffles = tg.log.entries.filter((e) => e.t === "RNG" && (e as { purpose: string }).purpose === "shuffle");
    expect(shuffles.length).toBeGreaterThanOrEqual(1);
    // S22 r4 (CR 701.19.4): the basic-restricted find is revealed (event logged).
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "SEARCH_REVEAL" && (e as { payload: { cardId: string } }).payload.cardId === "island")).toBe(true);
  });

  it("Demonic Tutor: any card to hand; decline still shuffles; a no-match library auto-declines silently and still shuffles", async () => {
    const tutor: FixtureSpec = {
      name: "tutor",
      setup: { players: [{ battlefield: ["swamp", "swamp"], hand: ["demonic_tutor"], library: ["swamp", "serra_angel", "typhoid_rats"] }, {}] },
      script: [{ player: 0, do: "cast", card: "demonic_tutor" }, { player: 0, do: "search", card: "serra_angel" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(tutor);
    expect(tg.game.state.players[0].hand.map((id) => getObject(tg.game.state, id).cardId)).toContain("serra_angel");
    expect(tg.game.state.players[0].library).toHaveLength(2);
    // S22 r4 (CR 701.19.4): an UNRESTRICTED search stays hidden — no reveal event, ever.
    expect(tg.log.entries.some((e) => e.t === "EVENT" && e.name === "SEARCH_REVEAL")).toBe(false);
    // Decline
    const decline: FixtureSpec = { ...tutor, name: "tutor-decline", script: [{ player: 0, do: "cast", card: "demonic_tutor" }, { player: 0, do: "search" }] };
    const tg2 = await runFixture(decline);
    expect(tg2.game.state.players[0].hand).toHaveLength(0);
    expect(tg2.game.state.players[0].library).toHaveLength(3);
    expect(tg2.log.entries.some((e) => e.t === "RNG" && (e as { purpose: string }).purpose === "shuffle")).toBe(true);
    // No match (Growth with no basics in library): no request at all, shuffle still logged.
    const nomatch: FixtureSpec = {
      name: "growth-nomatch",
      setup: { players: [{ battlefield: ["forest", "forest"], hand: ["rampant_growth"], library: ["grizzly_bears", "serra_angel"] }, {}] },
      script: [{ player: 0, do: "cast", card: "rampant_growth" }],
      run: [{ priority: true }],
    };
    const tg3 = await runFixture(nomatch);
    expect(tg3.requests.some((r) => r.purpose === "searchLibrary")).toBe(false);
    expect(tg3.log.entries.some((e) => e.t === "RNG" && (e as { purpose: string }).purpose === "shuffle")).toBe(true);
    expect(tg3.game.state.players[0].library).toHaveLength(2);
  });

  it("a searched creature entering the battlefield fires its ETB trigger; the log never names the unchosen candidates", async () => {
    const spec: FixtureSpec = {
      name: "summon",
      setup: { players: [{ battlefield: ["forest"], hand: ["test_summon_from_library"], library: ["elvish_visionary", "serra_angel", "forest"] }, {}] },
      script: [{ player: 0, do: "cast", card: "test_summon_from_library" }, { player: 0, do: "search", card: "elvish_visionary" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.battlefield.some((id) => getObject(st, id).cardId === "elvish_visionary")).toBe(true);
    // Visionary's ETB draw resolved: hand gained a card (the spell left; one drawn).
    expect(st.players[0].hand).toHaveLength(1);
    const logText = JSON.stringify(tg.log.entries);
    expect(logText).not.toContain("serra_angel"); // unchosen candidate never appears in the log
  });

  it("replay determinism: a full game with Growth/Tutor picks replays byte-identical (shuffle-after-search is logged RNG)", async () => {
    // Casts whenever it can (Growth/Tutor included), plays lands, takes the last search candidate; passes otherwise.
    const pickLast: Agent = {
      chooseAction: async (_v: GameView, req: ActionRequest): Promise<Action> => {
        if (req.purpose === "priority") {
          const cast = [...req.actions].reverse().find((a) => a.type === "castSpell");
          if (cast) return cast;
          const land = req.actions.find((a) => a.type === "playLand");
          if (land) return land;
          return req.actions.find((a) => a.type === "pass") ?? req.actions[0]!;
        }
        return req.actions[req.actions.length - 1]!;
      },
    };
    const spec: MatchSpec = {
      seed: 15,
      players: [
        { name: "C", decklist: [{ cardId: "forest", count: 14 }, { cardId: "rampant_growth", count: 4 }, { cardId: "grizzly_bears", count: 6 }], agent: "x" },
        { name: "D", decklist: [{ cardId: "swamp", count: 14 }, { cardId: "demonic_tutor", count: 4 }, { cardId: "typhoid_rats", count: 6 }], agent: "x" },
      ],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 12 },
      modifiers: [],
    };
    const live = await runMatch(spec, realPool.cards, [pickLast, pickLast]);
    const searched = live.log.some((e) => e.t === "ACTION" && (e as { action: Action }).action.type === "searchPick");
    expect(searched).toBe(true);
    const replayed = await replayGame(realPool.cards, [expandDecklist(spec.players[0].decklist), expandDecklist(spec.players[1].decklist)], live.log, { startingLife: 20, handSize: 7, maxTurns: 12, ante: 0 }, []);
    expect(replayed).toBe(live.finalStateSerialized);
  });
});

describe("Black Lotus (R-045, Amendment 2)", () => {
  it("turn-2 Serra Angel off Lotus + two Plains: five colour actions offered, choice logged, pool receives three of one colour, Lotus sacrificed", async () => {
    const spec: FixtureSpec = {
      name: "lotus-angel",
      setup: { turn: 2, players: [{ battlefield: ["plains", "plains", "black_lotus"], hand: ["serra_angel"] }, {}] },
      script: [
        { player: 0, do: "activate", card: "black_lotus", abilityIndex: 0, color: "W" },
        { player: 0, do: "cast", card: "serra_angel" },
      ],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.battlefield.some((id) => getObject(st, id).cardId === "serra_angel")).toBe(true);
    expect(st.players[0].graveyard.some((id) => getObject(st, id).cardId === "black_lotus")).toBe(true);
    // Enumeration offered one action per colour and never a bare tapForMana for the Lotus.
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    const lotusActs = first.actions.filter((a) => a.type === "activateAbility" && a.color !== undefined);
    expect(lotusActs.map((a) => (a as { color: string }).color).sort()).toEqual(["B", "G", "R", "U", "W"]);
    const lotusId = lotusActs[0] && (lotusActs[0] as { objectId: string }).objectId;
    expect(first.actions.some((a) => a.type === "tapForMana" && (a as { objectId: string }).objectId === lotusId)).toBe(false);
    const logged = tg.log.entries.find((e) => e.t === "ACTION" && (e as { action: Action }).action.type === "activateAbility") as { action: { color?: string } } | undefined;
    expect(logged?.action.color).toBe("W");
  });

  it("sacrifice-as-cost ordering: a Lotus-shaped artifact with a DIES trigger adds mana first; the trigger resolves at the next check (card drawn)", async () => {
    const spec: FixtureSpec = {
      name: "lotus-martyr",
      setup: { players: [{ battlefield: ["test_lotus_martyr"], library: ["forest"] }, {}] },
      script: [{ player: 0, do: "activate", card: "test_lotus_martyr", abilityIndex: 0, color: "G" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    expect(st.players[0].hand).toHaveLength(1); // DIES trigger drew
    expect(st.players[0].graveyard.some((id) => getObject(st, id).cardId === "test_lotus_martyr")).toBe(true);
    // The mana was added (pool empties at step end; assert via the log: the activation happened before the draw event).
    const idxAct = tg.log.entries.findIndex((e) => e.t === "ACTION" && (e as { action: Action }).action.type === "activateAbility");
    const idxDraw = tg.log.entries.findIndex((e) => e.t === "EVENT" && (e as { name: string }).name === "CARD_DRAWN");
    expect(idxAct).toBeGreaterThanOrEqual(0);
    expect(idxDraw).toBeGreaterThan(idxAct);
  });
});
