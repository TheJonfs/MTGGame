import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { MatchSeries, runSeries, type Decklist } from "./series.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const A = OPEN_DECKS.muster!, B = OPEN_DECKS.warband!;
const lists: [Decklist, Decklist] = [[...A.decklist], [...B.decklist]];
const agents = (g: { seed: number }) => [new HeuristicAgent(g.seed * 2 + 1, pool, difficultyProfile("master", A.archetype, lists[1])), new HeuristicAgent(g.seed * 2 + 2, pool, difficultyProfile("master", B.archetype, lists[0]))] as [HeuristicAgent, HeuristicAgent];

/** S47 (Part 4): the series wrapper, headless — two heuristic agents, best-of-three. */
describe("MatchSeries — best-of-three over single games (S47 Part 4)", () => {
  it("plays to a majority; the loser of the last game takes the play; the same seed is the same series", async () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = await runSeries({ seed, decklists: lists, agents }, pool);
      expect(s.done).toBe(true);
      expect(s.games.length).toBeGreaterThanOrEqual(2);
      expect(s.games.length).toBeLessThanOrEqual(3);
      expect(Math.max(...s.wins)).toBe(2);
      expect(s.winner).toBe(s.wins[0] > s.wins[1] ? 0 : 1);
      expect(s.games[0]!.chooser).toBeNull();
      for (let i = 1; i < s.games.length; i++) {
        const prev = s.games[i - 1]!;
        expect(prev.winner).not.toBeNull();
        expect(s.games[i]!.chooser).toBe(1 - prev.winner!);
        expect(s.games[i]!.startingPlayer).toBe(1 - prev.winner!); // the default call is to play
      }
      expect(new Set(s.games.map((g) => g.seed)).size).toBe(s.games.length);
      expect(await runSeries({ seed, decklists: lists, agents }, pool)).toEqual(s);
    }
  }, 120_000);

  it("the chooser may take the draw: the other seat starts", async () => {
    const s = await runSeries({ seed: 5, decklists: lists, agents, choosePlayDraw: () => "draw" }, pool);
    for (let i = 1; i < s.games.length; i++) expect(s.games[i]!.startingPlayer).toBe(s.games[i - 1]!.winner);
  }, 120_000);

  it("a forced draw: games at a two-turn cap have no winner — three drawn games are a drawn series, one point each", async () => {
    const s = await runSeries({ seed: 6, decklists: lists, agents, rules: { maxTurns: 2 } }, pool);
    expect(s.games.map((g) => g.reason)).toEqual(["MAX_TURNS", "MAX_TURNS", "MAX_TURNS"]);
    expect(s.wins).toEqual([0, 0]);
    expect(s.draws).toBe(3);
    expect(s.winner).toBe("draw");
    // after a drawn game the same seat keeps the choice: game one's starting player throughout
    expect(new Set(s.games.map((g) => g.startingPlayer)).size).toBe(1);
  }, 120_000);

  it("the state machine: a 1–0–2 series goes to the seat with the win; the between-games hook sees each break; a resumed series continues", async () => {
    const m = new MatchSeries({ seed: 9, firstPlayer: 0 });
    const g1 = m.nextGame(); m.record(g1, { winner: null, reason: "MAX_TURNS", turns: 100 });
    expect(m.nextChooser()).toBe(0);
    const g2 = m.nextGame("draw"); expect(g2.startingPlayer).toBe(1); m.record(g2, { winner: 1, reason: "LIFE", turns: 9 });
    expect(m.done).toBe(false);
    const resumed = new MatchSeries({ seed: 9, firstPlayer: 0, games: m.state().games });
    expect(resumed.nextChooser()).toBe(0);
    const g3 = resumed.nextGame(); expect(g3.seed).toBe(m.nextGame().seed); resumed.record(g3, { winner: null, reason: "DRAW", turns: 30 });
    expect(resumed.done).toBe(true);
    expect(resumed.winner).toBe(1);
    expect([resumed.points(0), resumed.points(1)]).toEqual([0, 3]);
    expect(() => resumed.nextGame()).toThrow();
    const breaks: number[] = [];
    await runSeries({ seed: 1, decklists: lists, agents, betweenGames: (st) => { breaks.push(st.games.length); } }, pool);
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    expect(breaks[0]).toBe(1);
  }, 120_000);
});
