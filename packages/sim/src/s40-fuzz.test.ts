import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const CARDS_DIR = join(ROOT, "data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
// S41: the lists live in the catalog (data/world/flood.json, synced to the working document); sim never imports
// world, so the file is read directly — the starters' pattern.
const FLOOD = JSON.parse(readFileSync(join(ROOT, "data/world/flood.json"), "utf8")) as { decks: Record<string, { name: string; seat: string; decklist: { cardId: string; count: number }[] }>; courts: { minister: { key: string }; ground: string }[] };
const FLOOD_DECKS: Record<string, { name: string; seat: string; ground?: string; decklist: { cardId: string; count: number }[] }> = Object.fromEntries(Object.entries(FLOOD.decks).map(([k, d]) => { const g = FLOOD.courts.find((c) => c.minister.key === k)?.ground; return [k, { ...d, ...(g ? { ground: g } : {}) }]; }));

/**
 * S40 fuzz-before-fixtures (ADR-128, R-097): the flood's twenty-seven cards under random play — the ten lists
 * (docs/phase-two-legends-working.md §8), each against another flood list and a starter, both seats; a court
 * fights on its own ground (the High Ground enters through `permanentOnBattlefield`, the entrance S41 authors).
 * Every new card rides at least one list except the grounds (the entrances) — zero exceptions, every game
 * terminates, replays byte-identical.
 */
describe("S40 fuzz — the flood's cards: ten legends, ten golds, five High Grounds, Char, Shadow Summoning (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 21 : 3;
  const keys = Object.keys(FLOOD_DECKS);
  const groundOf = (key: string, seat: 0 | 1): MatchSpec["modifiers"] => {
    const g = FLOOD_DECKS[key]!.ground;
    return g ? [{ type: "permanentOnBattlefield", player: seat, cardId: g }] : [];
  };

  it("every list is forty cards from the pool; the new cards are all carried", () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    const carried = new Set<string>();
    for (const deck of Object.values(FLOOD_DECKS)) {
      for (const e of deck.decklist) { expect(cards.has(e.cardId), `${deck.seat}: ${e.cardId}`).toBe(true); carried.add(e.cardId); }
      expect(deck.decklist.reduce((n, e) => n + e.count, 0), deck.seat).toBe(40);
      if (deck.ground) { expect(cards.has(deck.ground), deck.ground).toBe(true); carried.add(deck.ground); }
    }
    for (const id of ["the_bailiff", "odile_the_tallyflame", "the_reeve", "zinnia_the_undertow", "the_fordkeeper", "ovna_the_enchantress", "the_dredger", "isaura_the_levy", "the_reaper", "meliyan_the_torment",
      "static_sphere", "sacred_helix", "glimpse_the_unthinkable", "putrefy", "powerstone_minefield", "savage_twister", "undermine", "absorb", "poison_tip_archer", "voracious_cobra", "char", "shadow_summoning",
      "tallyflame_court", "wrackroot", "shevelport", "obsidian_observatory", "cairnbrand"]) expect(carried.has(id), id).toBe(true);
  });

  it(`${games} games × 10 lists × 2 references × 2 seats: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    const starters = (JSON.parse(readFileSync(join(ROOT, "data/world/starters.json"), "utf8")) as { starters: { id: string; name: string; decklist: { cardId: string; count: number }[] }[] }).starters;
    for (const k of keys) {
      const deck = FLOOD_DECKS[k]!;
      const otherKey = keys[(keys.indexOf(k) + 3) % keys.length]!;
      const other = FLOOD_DECKS[otherKey]!;
      const starter = starters[keys.indexOf(k) % starters.length]!;
      for (const [refName, ref, refKey] of [[other.name, other.decklist, otherKey], [`starter:${starter.id}`, starter.decklist, null]] as const) {
        for (let seed = 1; seed <= games; seed++) {
          for (const seat of [0, 1] as const) {
            const refSeat = seat === 0 ? 1 : 0;
            const me = { name: deck.name, decklist: deck.decklist, agent: "random" as const };
            const them = { name: refName, decklist: ref, agent: "random" as const };
            const players: MatchSpec["players"] = seat === 0 ? [me, them] : [them, me];
            const modifiers = [...groundOf(k, seat), ...(refKey ? groundOf(refKey, refSeat) : [])];
            const result = await runMatch({ seed: seed * 37 + seat + 4000, players, rules: RULES, modifiers }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
            expect(result.reason, `${deck.name} vs ${refName} seat ${seat} seed ${seed}`).toBeTruthy();
          }
        }
      }
    }
  }, 1_800_000);

  it("replay determinism — every flood list replays byte-identical (the court on its ground)", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const k of keys) {
      const deck = FLOOD_DECKS[k]!;
      const ref = FLOOD_DECKS[keys[(keys.indexOf(k) + 5) % keys.length]!]!;
      const seed = 60 + keys.indexOf(k);
      const modifiers = groundOf(k, 0);
      const live = await runMatch(
        { seed, players: [{ name: deck.name, decklist: deck.decklist, agent: "random" }, { name: ref.name, decklist: ref.decklist, agent: "random" }], rules: RULES, modifiers },
        cards,
        [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
      );
      const replayed = await replayGame(cards, [deck.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), ref.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, modifiers);
      expect(replayed, k).toBe(live.finalStateSerialized);
    }
  });
});
