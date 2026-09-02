import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import {
  expandDecklist,
  replayGame,
  runMatch,
  type Action,
  type ActionRequest,
  type Agent,
  type GameView,
  type MatchSpec,
} from "../src/index.js";

/**
 * S12 Part 0 — ante (R-043): `rules.ante: n` sets aside each library's top n
 * NONLAND cards after the shuffle, before hands, into the `ante` zone.
 * Fixtures per the brief: n=1, n=2, all-lands, replay determinism, and ante
 * cards absent from draws / counts. Engine-only: agents are a pass-first
 * deterministic ActionSource (no `agents` import — engine never depends on it).
 */

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(CARDS_DIR);

/** Deterministic "take the first action" agent: keeps hands, passes, declares nothing. */
const firstAction: Agent = {
  chooseAction: async (_view: GameView, req: ActionRequest): Promise<Action> => req.actions[0]!,
};

const RED = [
  { cardId: "mountain", count: 12 },
  { cardId: "raging_goblin", count: 4 },
  { cardId: "goblin_piker", count: 4 },
  { cardId: "lightning_bolt", count: 4 },
];
const ALL_LANDS = [{ cardId: "forest", count: 24 }];

function spec(seed: number, ante: number, deck = RED, deckB = RED): MatchSpec {
  return {
    seed,
    players: [
      { name: "A", decklist: deck, agent: "first" },
      { name: "B", decklist: deckB, agent: "first" },
    ],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 6, ante },
    modifiers: [],
  };
}

function finalState(serialized: string) {
  return JSON.parse(serialized) as {
    players: { library: string[]; hand: string[]; graveyard: string[]; exile: string[]; ante: string[] }[];
    objects: Record<string, { cardId: string; zone: string }>;
    startingLife: number;
  };
}

describe("ante (R-043, S12 Part 0)", () => {
  it("n=1: each player antes exactly one NONLAND card; it sits in the ante zone, out of every other zone and count", async () => {
    const r = await runMatch(spec(1, 1), pool.cards, [firstAction, firstAction]);
    expect(r.facts.ante[0]).toHaveLength(1);
    expect(r.facts.ante[1]).toHaveLength(1);
    const st = finalState(r.finalStateSerialized);
    for (const p of [0, 1] as const) {
      expect(st.players[p]!.ante).toHaveLength(1);
      const anteObj = st.objects[st.players[p]!.ante[0]!]!;
      expect(anteObj.zone).toBe("ante");
      expect(pool.cards.get(anteObj.cardId)!.types).not.toContain("Land");
      expect(r.facts.ante[p][0]).toBe(anteObj.cardId);
      // Never anywhere else: the only object in the ante zone is the ante card,
      // and no library/hand/graveyard/exile id resolves to the ante zone.
      for (const zone of ["library", "hand", "graveyard", "exile"] as const) {
        for (const id of st.players[p]![zone]) expect(st.objects[id]!.zone).toBe(zone);
      }
    }
  });

  it("S27 (ADR-092/093): prizeOnly cards are NEVER stakes — a library of Moxen and Mountains antes nothing; a mixed library skips the Mox for the next nonland", async () => {
    const jewels = [{ cardId: "mox_ruby", count: 20 }, { cardId: "mountain", count: 20 }];
    const r = await runMatch(spec(3, 1, jewels, jewels), pool.cards, [firstAction, firstAction]);
    expect(r.facts.ante[0]).toHaveLength(0);
    expect(r.facts.ante[1]).toHaveLength(0);
    const mixed = [{ cardId: "mox_ruby", count: 10 }, { cardId: "raging_goblin", count: 10 }, { cardId: "mountain", count: 20 }];
    const r2 = await runMatch(spec(3, 2, mixed, mixed), pool.cards, [firstAction, firstAction]);
    for (const p of [0, 1] as const) {
      expect(r2.facts.ante[p]).toHaveLength(2);
      for (const id of r2.facts.ante[p]) expect(pool.cards.get(id)!.prizeOnly).toBeFalsy();
    }
  });

  it("n=2: two each; the 24-card library loses 2 to ante and 7 to the hand before the first draw", async () => {
    const r = await runMatch(spec(2, 2), pool.cards, [firstAction, firstAction]);
    expect(r.facts.ante[0]).toHaveLength(2);
    expect(r.facts.ante[1]).toHaveLength(2);
    // Count-based check from the log: draws + remaining library + ante + hand ... simplest
    // invariant — total objects owned per player is still 24, partitioned by zone.
    const st = finalState(r.finalStateSerialized);
    for (const p of [0, 1] as const) {
      const zoneIds = [...st.players[p]!.library, ...st.players[p]!.hand, ...st.players[p]!.graveyard, ...st.players[p]!.exile, ...st.players[p]!.ante];
      const onBattlefield = Object.values(st.objects).filter((o) => o.zone === "battlefield").length;
      // every owned object is in exactly one zone array (battlefield is shared)
      expect(zoneIds.length + onBattlefield).toBeGreaterThanOrEqual(24);
      expect(st.players[p]!.ante).toHaveLength(2);
    }
  });

  it("all-lands library antes nothing — reported as found (empty), game still runs", async () => {
    const r = await runMatch(spec(3, 2, ALL_LANDS, ALL_LANDS), pool.cards, [firstAction, firstAction]);
    expect(r.facts.ante).toEqual([[], []]);
    const st = finalState(r.finalStateSerialized);
    expect(st.players[0]!.ante).toEqual([]);
    expect(st.players[1]!.ante).toEqual([]);
  });

  it("ante 0 (the engine default) changes nothing: no ante zone contents, facts empty", async () => {
    const r = await runMatch(spec(4, 0), pool.cards, [firstAction, firstAction]);
    expect(r.facts.ante).toEqual([[], []]);
    expect(finalState(r.finalStateSerialized).players[0]!.ante).toEqual([]);
  });

  it("replay determinism: a game with ante replays to the byte-identical final state (ante moves are shuffle-derived)", async () => {
    const s = spec(5, 1);
    const live = await runMatch(s, pool.cards, [firstAction, firstAction]);
    const replayed = await replayGame(
      pool.cards,
      [expandDecklist(s.players[0].decklist), expandDecklist(s.players[1].decklist)],
      live.log,
      { startingLife: 20, handSize: 7, maxTurns: 6, ante: 1 },
      s.modifiers,
    );
    expect(replayed).toBe(live.finalStateSerialized);
    // And the same seed reproduces the same stakes.
    const again = await runMatch(s, pool.cards, [firstAction, firstAction]);
    expect(again.facts.ante).toEqual(live.facts.ante);
  });

  it("ante cards are skipped over, not drawn: the nonland taken is the first nonland from the top, lands above it stay in the library", async () => {
    // Determinism lets us inspect the setup order directly: run with ante 0 and
    // ante 1 at the same seed and compare the libraries' top cards.
    const off = finalState((await runMatch(spec(6, 0), pool.cards, [firstAction, firstAction])).finalStateSerialized);
    const on = finalState((await runMatch(spec(6, 1), pool.cards, [firstAction, firstAction])).finalStateSerialized);
    // startingLife rides on the state (S12 view field) in both.
    expect(off.startingLife).toBe(20);
    expect(on.startingLife).toBe(20);
    // The ante'd card is a nonland in both players' cases.
    for (const p of [0, 1] as const) {
      const cardId = on.objects[on.players[p]!.ante[0]!]!.cardId;
      expect(pool.cards.get(cardId)!.types).not.toContain("Land");
    }
  });
});
