import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Modifier } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FOUNT_DECK, TIDE_ORDER } from "./heart-deck.js";
import { COROLLA_DECKS } from "./corolla-decks.js";
import { ROAD_DECKS } from "./road-decks.js";
import { DECKS } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const ROOTS = ["plains", "island", "swamp", "mountain", "forest"];
const fountMods = (seat: 0 | 1): Modifier[] => [
  { type: "lawSequence", order: TIDE_ORDER, mode: "tide" },
  { type: "signatureToHand", player: seat, cardId: "the_cinquefont" },
  ...ROOTS.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: seat, cardId })),
];

/**
 * S42a fuzz-before-fixtures (R-098): the Cinquefont's tide (the count-then-wash on the card, the order on the
 * card, the duel's pointer) and Time Walk's extra turns (the explicit turn order that replaced the turn number's
 * parity) under random play — the fount's sixty with its entrance in both seats against a spread of references,
 * and a Time Walk deck (four copies, a test list) so extra turns stack and chain. Replays byte-identical.
 */
describe("S42a fuzz — the Cinquefont's tide and Time Walk's extra turns (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 40 : 4;
  const walk = [...DECKS.B.decklist.map((e) => ({ ...e })), { cardId: "time_walk", count: 4 }];
  const REFS: [string, { cardId: string; count: number }[]][] = [["lumen", COROLLA_DECKS.lumen!.decklist], ["clio", COROLLA_DECKS.clio!.decklist], ["road-B", ROAD_DECKS.chrisRoadB!.decklist], ["slice:C", [...DECKS.C.decklist]], ["walk", walk]];
  it(`${games} games × 5 references × 2 seats: zero exceptions, every game terminates; the walk deck against itself too`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const e of FOUNT_DECK.decklist) expect(cards.has(e.cardId), e.cardId).toBe(true);
    expect(FOUNT_DECK.decklist.reduce((n, e) => n + e.count, 0)).toBe(60);
    expect(FOUNT_DECK.decklist.find((e) => e.cardId === "the_cinquefont")?.count).toBe(3);
    expect(FOUNT_DECK.decklist.some((e) => e.cardId === "the_manafleur")).toBe(false);
    for (const [name, deck] of REFS) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const fount = { name: "The Cinquefont", decklist: FOUNT_DECK.decklist, agent: "random" as const };
      const ref = { name, decklist: deck, agent: "random" as const };
      const r = await runMatch({ seed: seed * 53 + seat + 4200, players: seat === 0 ? [fount, ref] : [ref, fount], rules: RULES, modifiers: fountMods(seat) }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      expect(r.reason, `${name} seat ${seat} seed ${seed}`).toBeTruthy();
    }
    for (let seed = 1; seed <= games * 2; seed++) {
      const r = await runMatch({ seed: seed * 59 + 4300, players: [{ name: "walk", decklist: walk, agent: "random" }, { name: "walk2", decklist: walk, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      expect(r.reason, `walk mirror seed ${seed}`).toBeTruthy();
    }
  }, 1_800_000);

  it("replay determinism — the tide and the extra turns replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    const flat = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array(e.count).fill(e.cardId));
    for (const [seed, a, b, mods] of [[71, FOUNT_DECK.decklist, walk, fountMods(0)], [72, walk, FOUNT_DECK.decklist, fountMods(1)], [73, walk, walk, []]] as const) {
      const live = await runMatch({ seed, players: [{ name: "a", decklist: [...a], agent: "random" }, { name: "b", decklist: [...b], agent: "random" }], rules: RULES, modifiers: [...mods] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [flat([...a]), flat([...b])], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, [...mods]);
      expect(replayed, `seed ${seed}`).toBe(live.finalStateSerialized);
    }
  });

  it("the extra turn is REAL in a whole game: the walker's turns come back-to-back in the step stream, no more often than Walks resolved", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    const deck = [{ cardId: "island", count: 16 }, { cardId: "time_walk", count: 4 }, { cardId: "wind_drake", count: 10 }];
    const r = await runMatch({ seed: 4242, players: [{ name: "walker", decklist: deck, agent: "random" }, { name: "other", decklist: [{ cardId: "island", count: 20 }, { cardId: "wind_drake", count: 10 }], agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(5), new RandomAgent(6)]);
    const events = r.log.filter((e): e is Extract<typeof e, { t: "EVENT" }> => e.t === "EVENT");
    const walks = events.filter((e) => e.name === "EXTRA_TURN").length;
    expect(walks).toBeGreaterThan(0);
    // Whose turn each turn was, read off the ACTION log: only the active player plays a land.
    const landOf = new Map<number, number>();
    for (const e of r.log) if (e.t === "ACTION" && e.action.type === "playLand") landOf.set(e.turn, e.player);
    const turnStarts = [...landOf.entries()].sort((a, b) => a[0] - b[0]).filter(([turn], i, all) => i === 0 || all[i - 1]![0] === turn - 1).map(([, p]) => p);
    let repeats = 0;
    for (let i = 1; i < turnStarts.length; i++) if (turnStarts[i] === turnStarts[i - 1]) repeats += 1;
    expect(repeats).toBeGreaterThan(0);
    expect(repeats).toBeLessThanOrEqual(walks);
  });
});
