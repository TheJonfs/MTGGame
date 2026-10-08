import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayThenPlay, runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS } from "./open-decks.js";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;

/** S58 (Part 2): `replayThenPlay` — a logged game replayed to a decision and played on from there by agents (the play diff's engine). */
describe("replayThenPlay (S58)", () => {
  it("replayed to its end it is the game that was played; from an earlier decision the agents finish it, the same seed the same way; from decision 0 nothing of the log is used", async () => {
    const a = OPEN_DECKS.cinder!, b = OPEN_DECKS.levy!;
    const spec = { seed: 58, players: [{ name: "a", decklist: [...a.decklist], agent: "x" }, { name: "b", decklist: [...b.decklist], agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
    const mk = (s: number): [HeuristicAgent, HeuristicAgent] => [new HeuristicAgent(s, cards, difficultyProfile("master", "aggro", [...b.decklist], [...a.decklist])), new HeuristicAgent(s + 1, cards, difficultyProfile("master", "midrange", [...a.decklist], [...b.decklist]))];
    const r = await runMatch(spec, cards, mk(1));
    const decks: [string[], string[]] = [expandDecklist(a.decklist), expandDecklist(b.decklist)], rules = { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 };
    const n = r.log.filter((e) => e.t === "ACTION").length;
    const whole = await replayThenPlay(cards, decks, r.log, n, null, mk(9), 3, rules, []);
    expect([whole.winner, whole.turns, whole.life, whole.played.length]).toEqual([r.winner, r.turns, r.finalLife, 0]);
    const half = Math.floor(n / 2);
    const x = await replayThenPlay(cards, decks, r.log, half, null, mk(9), 3, rules, []), y = await replayThenPlay(cards, decks, r.log, half, null, mk(9), 3, rules, []);
    expect(x.played.length).toBeGreaterThan(0);
    expect([x.winner, x.turns, x.life, x.played]).toEqual([y.winner, y.turns, y.life, y.played]);
    const seen: number[] = [];
    await replayThenPlay(cards, decks, r.log, 0, null, mk(9), 3, rules, [], (_req, _view, _action, k) => { seen.push(k); });
    expect(seen[0]).toBe(0);
    // a forced first answer is taken as given
    const first = r.log.find((e) => e.t === "ACTION")! as { action: { type: string } };
    const f = await replayThenPlay(cards, decks, r.log, 0, first.action as never, mk(9), 3, rules, []);
    expect(f.played[0]!.action).toEqual(first.action);
  }, 120_000);
});
