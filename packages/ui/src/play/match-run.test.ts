import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { GAMES_KEPT, GAMES_KEY, type CardRatingTable } from "@shandalar/world";
import { OPEN_FIELD } from "@shandalar/sim/open-decks";
import type { MatchResult, MatchSpec } from "@shandalar/engine";
import { boardingPool, count, firstCall, keepBoardedDeck, newMatchRun, nextMatchGame, playedGameMeta, recordMatchGame, recordPlayedGame, type MatchRunSetup } from "./match-run.js";
import type { PlayChoice } from "./play-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const choice = (key: string): PlayChoice => { const l = OPEN_FIELD[key]!; return { key: `open:${key}`, group: "open", name: l.name, label: l.name, archetype: l.archetype, decklist: l.decklist.map((e) => ({ ...e })), ...(l.sideboard ? { sideboard: l.sideboard.map((e) => ({ ...e })) } : {}) }; };
const setup = (over: Partial<MatchRunSetup> = {}): MatchRunSetup => ({ human: choice("marducontrol"), enemy: choice("reaperclio"), humanSeat: 0, seed: "77", ...over });
const won = (winner: 0 | 1 | null) => ({ winner, reason: "LIFE", turns: 9 }) as Pick<MatchResult, "winner" | "reason" | "turns">;
function memStorage(limit = Infinity) { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { if (v.length > limit) throw new Error("full"); m.set(k, v); } }; }

/** S61 (Part 4): the single match as a match — the series, the sideboards, the recording. */
describe("the single match as a match (post-S60; S61's test)", () => {
  it("game one's call is the setup's; after it the loser chooses, and the AI always plays first", () => {
    let r = newMatchRun(setup({ humanSeat: 1 }), pool, rating);
    let g = nextMatchGame(r, firstCall(r.setup), pool, rating);
    expect(g.game.index).toBe(0);
    expect(g.game.startingPlayer).toBe(1); // "in game one you play second"
    r = recordMatchGame(g.run, won(0)); // the human wins: the AI lost, the AI chooses — and plays
    expect(r.series.nextChooser()).toBe(1);
    g = nextMatchGame(r, "draw", pool, rating); // the human's call is not asked for
    expect(g.game.startingPlayer).toBe(1);
    r = recordMatchGame(g.run, won(1)); // the AI wins: the human chooses
    expect(r.series.nextChooser()).toBe(0);
    expect(nextMatchGame(r, "draw", pool, rating).game.startingPlayer).toBe(1);
    g = nextMatchGame(r, "play", pool, rating);
    expect(g.game.startingPlayer).toBe(0);
    r = recordMatchGame(g.run, won(0));
    expect(r.series.done).toBe(true);
    expect(r.series.winner).toBe(0);
    expect(r.series.wins).toEqual([2, 1]);
  });

  it("a game is recorded in the series once, and a series' three seeds are its own (the same seed, the same match)", () => {
    const r0 = newMatchRun(setup(), pool, rating), g = nextMatchGame(r0, "play", pool, rating);
    const r1 = recordMatchGame(g.run, won(1)), r2 = recordMatchGame(r1, won(1));
    expect(r2.series.games).toHaveLength(1);
    expect(newMatchRun(setup(), pool, rating).series.nextGame("play").seed).toBe(g.game.seed);
    expect(newMatchRun(setup({ seed: "78" }), pool, rating).series.nextGame("play").seed).not.toBe(g.game.seed);
    expect(newMatchRun(setup({ seed: "" }), pool, rating, () => 0.5).series.seed).toBe(500000); // no seed given: a random one
  });

  it("the AI plays its registered sixty in game one and a sideboarded sixty after it — cards from its fifteen, still sixty; the human's deck is as the human left it", () => {
    let r = newMatchRun(setup({ human: choice("rabble"), enemy: choice("marducontrol") }), pool, rating);
    const one = nextMatchGame(r, "play", pool, rating);
    const key = (l: { cardId: string; count: number }[]) => l.map((e) => `${e.cardId}:${e.count}`).sort().join(",");
    expect(key(one.enemy)).toBe(key(OPEN_FIELD.marducontrol!.decklist));
    r = recordMatchGame(one.run, won(0));
    const two = nextMatchGame(r, "play", pool, rating);
    expect(count(two.enemy)).toBe(60);
    expect(key(two.enemy)).not.toBe(key(OPEN_FIELD.marducontrol!.decklist));
    expect(two.enemy.find((e) => e.cardId === "pyroclasm")?.count).toBe(3); // Mardu Control's guide against the Rabble
    expect(two.enemy.some((e) => e.cardId === "vindicate")).toBe(false);
    expect(key(two.human)).toBe(key(OPEN_FIELD.rabble!.decklist));
  });

  it("the sideboard round trip: the deck is made from the seventy-five, kept when it holds sixty, refused when short or holding a card the seventy-five does not; the next game plays it", () => {
    const r = newMatchRun(setup(), pool, rating), { all, floor } = boardingPool(r);
    expect(floor).toBe(60);
    expect(all.wrath_of_god).toBe(4); // two in the sixty, two in the fifteen
    expect(Object.values(all).reduce((a, b) => a + b, 0)).toBe(75);
    const swap = (deck: typeof r.deck, out: string, into: string) => { const d = deck.map((e) => ({ ...e })).map((e) => (e.cardId === out ? { ...e, count: e.count - 1 } : e)).filter((e) => e.count > 0); const e = d.find((x) => x.cardId === into); if (e) e.count += 1; else d.push({ cardId: into, count: 1 }); return d; };
    const boarded = swap(swap(r.deck, "vindicate", "pyroclasm"), "vindicate", "wrath_of_god");
    const kept = keepBoardedDeck(r, boarded);
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(count(kept.run.main)).toBe(60); // the registration is untouched
    expect(kept.run.main.find((e) => e.cardId === "vindicate")!.count).toBe(4);
    const next = nextMatchGame(recordMatchGame(nextMatchGame(kept.run, "play", pool, rating).run, won(1)), "play", pool, rating);
    expect(next.human.find((e) => e.cardId === "pyroclasm")?.count).toBe(1);
    expect(next.human.find((e) => e.cardId === "wrath_of_god")?.count).toBe(3);
    const short = keepBoardedDeck(r, r.deck.filter((e) => e.cardId !== "vindicate"));
    expect(short.ok).toBe(false);
    const foreign = keepBoardedDeck(r, swap(r.deck, "vindicate", "lightning_bolt"));
    expect(foreign.ok).toBe(false);
    const five = keepBoardedDeck(r, swap(swap(swap(r.deck, "vindicate", "wrath_of_god"), "vindicate", "wrath_of_god"), "vindicate", "wrath_of_god"));
    expect(five.ok).toBe(false); // five Wraths: the seventy-five holds four
  });

  it("a deck with no sideboard of its own gets the field builder's fifteen, on either side", () => {
    const bare = (key: string): PlayChoice => { const { sideboard: _s, ...c } = choice(key); return c; };
    const r = newMatchRun(setup({ human: bare("rabble"), enemy: bare("pall") }), pool, rating);
    expect(count(r.side)).toBe(15);
    expect(count(r.enemySide)).toBe(15);
  });

  it("a finished game is recorded with the Convocation's: the same key and shape (the spec, the result, the ACTION and RNG entries), the newest thirty, never throwing on a full store", () => {
    const s = memStorage();
    const spec = { seed: 5, players: [{ name: "You", decklist: [], agent: "human" }, { name: "x", decklist: [], agent: "heuristic:master" }], rules: {}, modifiers: [] } as unknown as MatchSpec;
    const result = { winner: 0, reason: "LIFE", turns: 12, log: [{ t: "ACTION", a: 1 }, { t: "EVENT", name: "x" }, { t: "RNG", v: 3 }] } as unknown as MatchResult;
    recordPlayedGame(s, { spec, result }, playedGameMeta(choice("reaperclio"), 77, "match", 1), () => "2026-10-12T00:00:00.000Z");
    const got = JSON.parse(s.getItem(GAMES_KEY)!) as Record<string, unknown>[];
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ format: "shandalar-log-v1", formatId: "open", eventSeed: 77, phase: "match", round: 1, game: 1, opponent: "Reaper Clio", list: "open:reaperclio", result: { winner: 0, reason: "LIFE", turns: 12 } });
    expect((got[0]!.log as { t: string }[]).map((e) => e.t)).toEqual(["ACTION", "RNG"]); // what a replay reads
    expect(playedGameMeta({ ...choice("rabble"), group: "built", key: "built:x" }, 1, "single", 0).list).toBeUndefined(); // a built deck has no list key
    for (let i = 0; i < GAMES_KEPT + 5; i++) recordPlayedGame(s, { spec, result }, { n: i });
    const kept = JSON.parse(s.getItem(GAMES_KEY)!) as { n?: number }[];
    expect(kept).toHaveLength(GAMES_KEPT);
    expect(kept[kept.length - 1]!.n).toBe(GAMES_KEPT + 4);
    recordPlayedGame(s, { spec, result: null }, {}); // an unfinished game: nothing
    expect(JSON.parse(s.getItem(GAMES_KEY)!)).toHaveLength(GAMES_KEPT);
    expect(() => recordPlayedGame(memStorage(10), { spec, result }, {})).not.toThrow(); // a full store
    expect(() => recordPlayedGame(null, { spec, result }, {})).not.toThrow();
  });
});
