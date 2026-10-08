import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { OPEN_DECKS, OPEN_FIELD } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { buildSideboard, SIDEBOARD_SIZE } from "./constructed-builder.js";
import { AI_SIDEBOARD, AI_SIDEBOARD_CONSTRUCTED, guideFor, aiSideboard, answersCreatures, answersGraveyards, answersRelics, blocksFliers, isCounter, isCreatureCounter, isSweeper, isWall, stealsCreatures } from "./sideboard-ai.js";
import type { CardRatingTable } from "./rating.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const d = (id: string) => cards.get(id)!;
const fifteenOf = (k: string) => OPEN_DECKS[k]!.sideboard ? [...OPEN_DECKS[k]!.sideboard!] : buildSideboard(OPEN_DECKS[k]!.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures);
const board = (me: string, them: string) => aiSideboard(OPEN_DECKS[me]!.decklist, fifteenOf(me), OPEN_DECKS[them]!.decklist, cards, rating, AI_SIDEBOARD_CONSTRUCTED);
const ins = (me: string, them: string, rule: string) => board(me, them).swaps.filter((s) => s.rule === rule);

/** S56 (Part 2): the four shapes added to the field's sideboarding, and the fifteen that holds them. */
describe("broader sideboarding (S56)", () => {
  it("the shapes are read from card data: sweepers, creature counters, a steal, blockers", () => {
    expect(["pyroclasm", "savage_twister", "wrath_of_god"].every((c) => isSweeper(d(c)))).toBe(true);
    expect(isSweeper(d("lightning_bolt"))).toBe(false);
    expect(isCreatureCounter(d("essence_scatter"))).toBe(true);
    expect(isCreatureCounter(d("counterspell"))).toBe(false);
    expect(stealsCreatures(d("control_magic"))).toBe(true);
    expect(stealsCreatures(d("lumen_the_hearth_fire"))).toBe(false); // a creature, and its steal is for a turn
    expect(["wall_of_air", "wall_of_blossoms", "tidewall"].every((c) => isWall(d(c)))).toBe(true);
    expect(["treetop_snarespinner", "wall_of_air", "tidewall"].every((c) => blocksFliers(d(c)))).toBe(true);
    expect(blocksFliers(d("reya_dawnbringer"))).toBe(false); // nine mana is not a sideboard blocker
    expect(blocksFliers(d("serra_angel"))).toBe(false); // an attacker
  });

  it("the field's fifteen reserves the shapes' slots where the deck's colours hold them; it is still fifteen, legal, and holds its graveyard exile", () => {
    for (const k of Object.keys(OPEN_FIELD)) {
      const f = buildSideboard(OPEN_DECKS[k]!.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures);
      expect(f.reduce((n, e) => n + e.count, 0), k).toBe(SIDEBOARD_SIZE);
      expect(f.filter((e) => answersGraveyards(d(e.cardId))).reduce((n, e) => n + e.count, 0), k).toBe(4);
    }
    const has = (k: string, p: (x: ReturnType<typeof d>) => boolean) => buildSideboard(OPEN_DECKS[k]!.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures).some((e) => p(d(e.cardId)));
    expect(has("locks", isSweeper)).toBe(true); expect(has("locks", isCreatureCounter)).toBe(true); expect(has("locks", stealsCreatures)).toBe(true);
    expect(has("ford", isSweeper)).toBe(true); // Savage Twister, in its colours
    expect(has("muster", isCreatureCounter)).toBe(false); // no blue: the slot goes to the best of the rest
    // the S55 fifteen is still there for a study (`shapes: false`)
    expect(buildSideboard(OPEN_DECKS.locks!.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures, false)).not.toEqual(buildSideboard(OPEN_DECKS.locks!.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures));
  });

  it("each shape comes in against the list it is for, and not otherwise", () => {
    // a steal against prizes (the Larder's fatties), none against the Tally
    expect(ins("depths", "larder", "steal").length).toBeGreaterThan(0); // (S58: the Locks have a guided fifteen now; the Depths' is the builder's)
    expect(ins("depths", "larder", "steal").every((s) => stealsCreatures(d(s.in)))).toBe(true);
    expect(ins("locks", "tally", "steal")).toEqual([]);
    // creature counters against twenty creatures, for a general counter and never the reverse; not against the Tally
    for (const s of ins("locks", "muster", "creatureCounters")) { expect(isCreatureCounter(d(s.in))).toBe(true); expect(isCounter(d(s.out)) && !isCreatureCounter(d(s.out))).toBe(true); }
    expect(ins("locks", "muster", "creatureCounters").length).toBeGreaterThan(0);
    expect(ins("locks", "tally", "creatureCounters")).toEqual([]);
    // …and not against a plan that counterspells answer (the Pall's setup and start are sorceries)
    expect(ins("locks", "pall", "creatureCounters")).toEqual([]);
    expect(ins("depths", "pall", "creatureCounters")).toEqual([]);
    // every list, every opponent: nothing that only makes mana ever leaves; a blocker brought in costs four or less;
    // a sweeper comes in only against a board at least twice as wide as our own small creatures
    for (const me of Object.keys(OPEN_FIELD)) for (const them of Object.keys(OPEN_FIELD)) {
      if (me === them) continue;
      const sb = board(me, them);
      expect(sb.deck.reduce((n, e) => n + e.count, 0), `${me} v ${them}`).toBe(60);
      for (const s of sb.swaps) {
        expect(/^mox_|black_lotus/.test(s.out), `${me} v ${them}: ${s.out}`).toBe(false);
        if (s.rule === "blockers") expect(isWall(d(s.in)) || blocksFliers(d(s.in))).toBe(true);
        if (s.rule === "counters") expect(answersGraveyards(d(s.in)), `${me} v ${them}`).toBe(false); // graveyard exile is not "the best playable left"
      }
    }
    expect(ins("muster", "warband", "sweepers")).toEqual([]); // a weenie deck does not sweep its own board
  });

  it("against a plan that graveyard exile answers, what only blocks leaves first (the Kiln's hand-tested plan against the Pall: its Tidewalls, not its Pyromancers)", () => {
    const g = ins("kiln", "pall", "graveyards");
    expect(g.map((s) => s.out)).toEqual(["tidewall", "tidewall", "tidewall", "tidewall"]);
    expect(g.every((s) => answersGraveyards(d(s.in)))).toBe(true);
    // (S57: the Larder has a plan now, and the same holds against it)
    expect(ins("kiln", "larder", "graveyards").map((s) => s.out)).toEqual(["tidewall", "tidewall", "tidewall", "tidewall"]);
  });

  it("Limited sideboarding is as it was: the four shapes are a Constructed matter", () => {
    expect("shapes" in AI_SIDEBOARD).toBe(false);
    const sb = aiSideboard(OPEN_DECKS.locks!.decklist, fifteenOf("locks"), OPEN_DECKS.larder!.decklist, cards, rating, AI_SIDEBOARD);
    expect(sb.swaps.filter((s) => ["sweepers", "creatureCounters", "steal", "blockers"].includes(s.rule))).toEqual([]);
  });

  it("S57 (Part 4) — the out-rule's three parts exist and are OFF (measured: no gain): with dead-first, creature-only removal leaves first against a list of few creatures; with four-ofs kept, a rule takes a lesser copy; by default neither happens", () => {
    expect(AI_SIDEBOARD_CONSTRUCTED.outRule).toBeUndefined();
    const deck = [{ cardId: "island", count: 24 }, { cardId: "doom_blade", count: 3 }, { cardId: "grizzly_bears", count: 4 }, { cardId: "soul_warden", count: 2 }, { cardId: "counterspell", count: 4 }, { cardId: "swamp", count: 23 }];
    const side = [{ cardId: "disenchant", count: 2 }, { cardId: "tormods_crypt", count: 2 }];
    const few = [{ cardId: "glorious_anthem", count: 4 }, { cardId: "bitterblossom", count: 4 }, { cardId: "serra_angel", count: 4 }, { cardId: "plains", count: 48 }];
    const run = (outRule?: { deadFirst?: boolean; keepFourOfs?: boolean }) => aiSideboard([...deck, { cardId: "plains", count: 0 }].filter((e) => e.count > 0), side, few, cards, rating, { relicsSeen: 4, creaturesSeen: 16, perRule: 2, ...(outRule ? { outRule } : {}) }).swaps.map((s) => s.out);
    expect(run({ deadFirst: true })).toEqual(["doom_blade", "doom_blade"]); // four creatures across: the Doom Blades are dead
    expect(run()).not.toContain("doom_blade");
    expect(run({ keepFourOfs: true })).not.toContain("grizzly_bears");
  });

  it("S58 (Part 1) — a registered fifteen with a GUIDE: the Locks make their author's swaps first (the hate for the Serras and the Vindicates against the Pall, Duress for Wraths against a plan or a control deck, the Serras for counters against control), what the guide brought in does not leave, the rules then run on the rest; a seat with another fifteen is not guided", () => {
    const locks = OPEN_DECKS.locks!;
    expect(locks.sideboard).toBeDefined();
    expect(guideFor(locks.sideboard!)?.key).toBe("locks");
    expect(guideFor(buildSideboard(locks.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures))).toBeUndefined();
    const vs = (them: string, terms = AI_SIDEBOARD_CONSTRUCTED) => aiSideboard(locks.decklist, [...locks.sideboard!], OPEN_DECKS[them]!.decklist, cards, rating, terms);
    const g = (them: string) => vs(them).swaps.filter((s) => s.rule === "guide").map((s) => `${s.in}<${s.out}`);
    expect(g("pall")).toEqual(["duress<wrath_of_god", "duress<wrath_of_god", "tormods_crypt<serra_angel", "tormods_crypt<serra_angel", "faerie_macabre<vindicate", "faerie_macabre<vindicate"]);
    expect(g("depths")).toEqual(["serra_angel<undermine", "serra_angel<undermine", "duress<wrath_of_god", "duress<wrath_of_god"]);
    expect(g("muster")).toEqual([]); // a weenie deck: nothing of the guide's — the rules alone
    for (const them of Object.keys(OPEN_FIELD)) {
      if (them === "locks") continue;
      const sb = vs(them), ins = new Set(sb.swaps.filter((s) => s.rule === "guide").map((s) => s.in));
      expect(sb.deck.reduce((n, e) => n + e.count, 0), them).toBe(60);
      expect(sb.sideboard.reduce((n, e) => n + e.count, 0), them).toBe(15);
      for (const s of sb.swaps) if (s.rule !== "guide") expect(ins.has(s.out), `${them}: ${s.out} left again`).toBe(false);
    }
    expect(vs("pall", { ...AI_SIDEBOARD_CONSTRUCTED, noGuide: true }).swaps.some((s) => s.rule === "guide")).toBe(false);
  });
});
