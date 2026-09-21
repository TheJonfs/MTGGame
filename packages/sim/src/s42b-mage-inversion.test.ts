import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { MAGE_DECKS, mageListFor, parseMageInversionLists } from "./mage-decks.js";
import { MAGE_FLOOD_LISTS } from "./mage-decks-flood.js";
import { DECKS } from "./slice-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 12, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const BASIC_OF: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
/** The phase-two column at Standard (knobs `phaseTierTables[2]`): tier 2 at 16 / 1, tier 3 at 20 / 3. */
const COLUMN: Record<2 | 3, { life: number; basics: number }> = { 2: { life: 16, basics: 1 }, 3: { life: 20, basics: 3 } };

/**
 * S42b — THE MAGE INVERSION (ADR-122 §9). Fuzz-before-fixtures (the S29 pattern): the ten flood lists under random
 * play at the phase-two column (life and the entrance basics in the flood list's pip order), each against a mage
 * and a slice deck, both seats; replays byte-exact. Then the pins: the generated table against the document, the
 * S29 rules (40 / 17, the pair, no gold, no prizeOnly, the tier-3 title caps), and the one switch.
 */
describe("S42b — the mage inversion: the ten flood lists", () => {
  const cards = loadCardPool(join(ROOT, "data/cards")).cards;
  const keys = Object.keys(MAGE_FLOOD_LISTS);
  const entrance = (key: string, tier: 2 | 3) => Array.from({ length: COLUMN[tier].basics }, (_, i) => BASIC_OF[MAGE_FLOOD_LISTS[key]!.primaryColors[i % 2]!]!);

  const games = process.env.FUZZ_FULL ? 45 : 2;
  it(`fuzz: ${games} games × 10 flood lists × 2 references × 2 seats at the phase-two column — zero exceptions, every game terminates`, async () => {
    const slice = Object.values(DECKS);
    let n = 0;
    for (const [i, k] of keys.entries()) {
      const mage = mageListFor(k, 2)!;
      const tier = mage.tier as 2 | 3;
      const other = mageListFor(keys[(i + 3) % keys.length]!, 2)!;
      const starter = slice[i % slice.length]!;
      for (const [refName, ref] of [[other.name, other.decklist], [starter.name, starter.decklist]] as const) {
        for (let seed = 1; seed <= games; seed++) {
          for (const seat of [0, 1] as const) {
            const players: MatchSpec["players"] = seat === 0
              ? [{ name: mage.name, decklist: mage.decklist, agent: "random" }, { name: refName, decklist: ref, agent: "random" }]
              : [{ name: refName, decklist: ref, agent: "random" }, { name: mage.name, decklist: mage.decklist, agent: "random" }];
            const modifiers: MatchSpec["modifiers"] = [{ type: "startingLife", player: seat, value: COLUMN[tier].life }, ...entrance(k, tier).map((cardId) => ({ type: "permanentOnBattlefield" as const, player: seat, cardId }))];
            const result = await runMatch({ seed: seed * 17 + seat + i * 1000, players, rules: RULES, modifiers }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
            expect(result.reason, `${mage.name} vs ${refName} seat ${seat} seed ${seed}`).toBeTruthy();
            n += 1;
          }
        }
      }
    }
    expect(n).toBe(games * 40);
  }, 1_800_000);

  it("replay determinism — three flood lists (the Lumberjack's, the reanimator's, the mill's) replay byte-identical with the entrance in play", async () => {
    for (const [k, seed] of [["brennor", 4], ["corvane", 7], ["varro", 9]] as const) {
      const mage = mageListFor(k, 2)!;
      const ref = mageListFor("quill", 2)!;
      const modifiers: MatchSpec["modifiers"] = [{ type: "startingLife", player: 0, value: COLUMN[mage.tier as 2 | 3].life }, ...entrance(k, mage.tier as 2 | 3).map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId }))];
      const live = await runMatch({ seed, players: [{ name: mage.name, decklist: mage.decklist, agent: "random" }, { name: ref.name, decklist: ref.decklist, agent: "random" }], rules: RULES, modifiers }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [mage.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), ref.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 12, handSize: 7, maxTurns: 100, ante: 0 }, modifiers);
      expect(replayed, k).toBe(live.finalStateSerialized);
    }
  });

  it("the generated table is the document (docs/mage-inversion-lists.md → pnpm mage-inversion:gen)", () => {
    const idOf = new Map([...cards.values()].map((d) => [d.name, d.id]));
    const lists = parseMageInversionLists(readFileSync(join(ROOT, "docs/mage-inversion-lists.md"), "utf8"), (n) => idOf.get(n));
    expect(lists).toHaveLength(10);
    for (const l of lists) {
      const key = Object.keys(MAGE_DECKS).find((k) => MAGE_DECKS[k]!.name === l.name)!;
      expect(MAGE_FLOOD_LISTS[key]?.decklist, l.name).toEqual(l.decklist);
      expect([...MAGE_FLOOD_LISTS[key]!.colors].sort().join(""), l.name).toBe([...l.pair].sort().join(""));
    }
  });

  it("the S29 rules hold: 40 / 17, the still pair with one colour kept, no gold, no prizeOnly, tier-3 titles ≤ 1 at tier 2 and ≤ 2 at tier 3, primaryColors the pip order", () => {
    const STILL = ["RW", "BU", "BG", "GR", "UW"]; // the pairs phase one's courts held (sorted letters)
    expect(keys.sort()).toEqual(Object.keys(MAGE_DECKS).filter((k) => MAGE_DECKS[k]!.tier > 1).sort());
    for (const [k, f] of Object.entries(MAGE_FLOOD_LISTS)) {
      const base = MAGE_DECKS[k]!;
      expect(STILL, k).toContain([...f.colors].sort().join(""));
      expect(base.colors.includes(f.colors[0]!), `${k} keeps its first colour`).toBe(true);
      expect(base.colors.includes(f.colors[1]!), `${k} turns the other`).toBe(false);
      let total = 0, lands = 0;
      const titles: string[] = [];
      const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      for (const e of f.decklist) {
        const def = cards.get(e.cardId)!;
        expect(def, `${k}: ${e.cardId}`).toBeTruthy();
        total += e.count;
        const land = def.types.includes("Land");
        if (land) lands += e.count;
        expect(def.prizeOnly ?? false, `${k}: ${def.name}`).toBe(false);
        const cs = new Set((def.manaCost ?? "").match(/[WUBRG]/g) ?? []);
        expect(cs.size, `${k}: ${def.name} is gold`).toBeLessThanOrEqual(1);
        for (const c of cs) expect(f.colors, `${k}: ${def.name}`).toContain(c);
        if (!land && (def as { shopTier?: unknown }).shopTier === 3) titles.push(def.name);
        if (!land && !(def.supertypes ?? []).includes("Basic")) expect(e.count, `${k}: ${def.name}`).toBeLessThanOrEqual(4);
        for (const c of Object.keys(pips)) pips[c]! += e.count * ((def.manaCost ?? "").match(new RegExp(`\\{${c}\\}`, "g")) ?? []).length;
      }
      expect([total, lands], k).toEqual([40, 17]);
      expect(titles.length, `${k}: ${titles.join(", ")}`).toBeLessThanOrEqual(base.tier === 2 ? 1 : 2);
      expect(f.primaryColors, k).toBe([...f.colors].sort((a, b) => pips[b]! - pips[a]!).join(""));
    }
  });

  it("mageListFor is the one switch: tier 1 and phase one read phase one's list; a tier-2/3 mage at phase two keeps its name, epithet, tier and opponent id", () => {
    expect(mageListFor("oriel", 2)).toBe(MAGE_DECKS.oriel);
    expect(mageListFor("vael", 1)).toBe(MAGE_DECKS.vael);
    expect(mageListFor("vael", undefined)).toBe(MAGE_DECKS.vael);
    expect(mageListFor("nobody", 2)).toBeUndefined();
    const v = mageListFor("vael", 2)!;
    expect([v.name, v.epithet, v.tier, v.opponentId]).toEqual(["Mistress Vael", "the Tithe-Reeve", 2, "d2"]);
    expect([v.colors, v.primaryColors]).toEqual(["WR", "WR"]);
    expect(v.decklist.some((e) => e.cardId === "char")).toBe(true);
    expect(mageListFor("quill", 3)!.decklist.some((e) => e.cardId === "orcish_lumberjack")).toBe(true); // phase three reads the flood's until authored
  });
});
