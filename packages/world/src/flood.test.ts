import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { enemyDeck } from "./catalog.js";
import { checkDeck } from "./legality.js";
import { parseFloodLists, validateFloodDef } from "./flood.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const flood = catalog.flood!;

describe("S41 (ADR-128/129): the flood's ten lists live in the catalog, pinned to the working document", () => {
  it("flood.json's lists ARE the document's §8 code blocks — seat for seat, card for card (edit the document, regenerate, never the JSON alone)", () => {
    const idOf = new Map([...pool.values()].map((d) => [d.name, d.id]));
    const doc = parseFloodLists(readFileSync(join(ROOT, "docs/phase-two-legends-working.md"), "utf8"), (n) => idOf.get(n));
    const keys = [...flood.strongholds.map((s) => s.lord.key), ...flood.courts.map((c) => c.minister.key)];
    expect(doc).toHaveLength(10);
    doc.forEach((d, i) => {
      const mine = flood.decks[keys[i]!]!;
      expect(mine.seat, keys[i]).toBe(d.seat);
      expect(mine.decklist, keys[i]).toEqual(d.decklist);
    });
  });
  it("every list is forty pool cards carrying its legend ×3; `lord:` / `court:` refs resolve through enemyDeck", () => {
    for (const s of flood.strongholds) {
      const d = enemyDeck(catalog, `lord:${s.lord.key}`, 2);
      expect(d.decklist.reduce((n, e) => n + e.count, 0)).toBe(40);
      expect(d.decklist.find((e) => e.cardId === s.lord.cardId)?.count, s.id).toBe(3);
      for (const e of d.decklist) expect(pool.has(e.cardId), e.cardId).toBe(true);
    }
    for (const c of flood.courts) {
      const d = enemyDeck(catalog, `court:${c.minister.key}`, 2);
      expect(d.decklist.find((e) => e.cardId === c.minister.cardId)?.count, c.id).toBe(3);
      expect(d.decklist.some((e) => e.cardId === c.ground), `${c.id}: the ground is on the entrance, never in the list`).toBe(false);
      expect(pool.get(c.ground)?.prizeOnly).toBe(true);
    }
    expect(() => enemyDeck(catalog, "lord:nobody", 2)).toThrow(/unknown flood deck/);
  });
  it("ADR-129 — the seats keep their own gates: every court's list passes the gate it imposes; every lord's list sits inside his triad", () => {
    for (const c of flood.courts) expect(checkDeck(flood.decks[c.minister.key]!.decklist, null, c.deckRule!, pool).problems, c.id).toEqual([]);
    for (const s of flood.strongholds) expect(checkDeck(flood.decks[s.lord.key]!.decklist, null, s.deckRule!, pool).problems, s.id).toEqual([]);
  });
  it("the validator names what is wrong", () => {
    const bad = JSON.parse(JSON.stringify(flood));
    bad.strongholds[0].triad = ["U", "W", "R"];
    bad.courts[0].pair = ["U", "U"];
    bad.decks.odile.decklist[0].count += 1;
    expect(validateFloodDef(bad)).toEqual([
      "flood deck odile: 41 cards; a seat's list is forty",
      "flood stronghold tidelock_weir: triad must be three colours beginning with the law's",
      "flood court tallyflame_court: pair must be two distinct colours",
    ]);
  });
});

// ---------- the run ----------
import type { MatchResult } from "@shandalar/engine";
import { assembleSalvageDeck } from "./salvage.js";
import { newWorld, serializeWorld, deserializeWorld } from "./state.js";
import { advance } from "./journey.js";
import { findPath } from "./map.js";
import { legacyCarry, PETAL_ORDER } from "./corolla.js";
import { defaultKnobs } from "./knobs.js";
import { WorldRng } from "./rng.js";
import { rollShopStock } from "./shop.js";
import { lordStatus, strongholdState } from "./stronghold.js";
import { applyCourtDuel, courtDuelSpec, courtsFallen, floodHeartOpen, floodRun, recordFloodLordFall } from "./flood.js";

describe("S41 (ADR-130): the flood's run — the court's duel, the falls, the golds, the Heart's gate", () => {
  const knobs = defaultKnobs();
  const legends = (): string[] => PETAL_ORDER.flatMap((c) => { const k = legacyCarry(catalog, c); return [k.guardianCard!, k.minister!]; });
  const world = (seed = 4101) => newWorld({ seed, catalog, salvage: { legends: legends(), picks: [], pair: ["W", "R"], deck: assembleSalvageDeck(pool, catalog.salvagePack!, ["W", "R"], []) }, playerName: "Flood" });
  const result = (winner: 0 | 1, ante: [string[], string[]] = [[], []]): MatchResult => ({ winner, reason: "LIFE", turns: 9, finalLife: winner === 0 ? [7, 0] : [0, 7], log: [], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante: { 0: ante[0], 1: ante[1] } } } as unknown as MatchResult);

  it("ADR-134 (S42b): the lords' rows by difficulty — Easy 30 + 1, Standard 30 + 2, Hard 34 + 3, the basics of the triad with the law's colour first; phase one's lords take no bonus", async () => {
    const { DIFFICULTIES, resolveKnobs } = await import("./knobs.js");
    const { floodLordEntrance } = await import("./flood.js");
    const want = { easy: [30, 1], standard: [30, 2], hard: [34, 3] } as const;
    for (const mode of ["easy", "standard", "hard"] as const) {
      const k = resolveKnobs({ difficulty: DIFFICULTIES[mode] });
      const w = world();
      for (const r of lordStatus(w, catalog, k)) expect(r.base, `${mode} ${r.lordName}`).toBe(want[mode][0]);
      for (const sh of flood.strongholds) {
        const e = floodLordEntrance(sh, k);
        expect(e.length, `${mode} ${sh.id}`).toBe(want[mode][1]);
        expect(e.every((m) => m.type === "permanentOnBattlefield" && m.player === 1)).toBe(true);
      }
    }
    const hard = resolveKnobs({ difficulty: DIFFICULTIES.hard });
    const w1 = newWorld({ seed: 4299, catalog, starter: "white", difficulty: "hard" });
    for (const r of lordStatus(w1, catalog, hard)) expect(r.base, r.lordName).toBe(catalog.strongholdContent!.find((c) => c.id === r.strongholdId)!.lord.baseLife);
  });

  it("walking onto a High Ground stops at the court's threshold (until it falls); a flood stronghold's threshold names the flood's seat; the rail's lords are the flood's", () => {
    const w = world();
    const ground = w.map.strongholds.find((f) => f.kind === "ground")!;
    expect(findPath(w.map, w.player.position, ground.at)).not.toBeNull();
    for (const o of w.opponents) if (!o.fixedAt) o.gone = true; // no roamer interrupts the step
    w.player.position = { ...ground.at };
    const again = advance(w, catalog, [ground.at]);
    expect(again.some((e) => e.type === "courtEntry" && e.courtId === ground.contentId)).toBe(true);
    expect(lordStatus(w, catalog, knobs).map((r) => r.lordName).sort()).toEqual(["The Bailiff", "The Dredger", "The Fordkeeper", "The Reaper", "The Reeve"]);
    expect(lordStatus(w, catalog, knobs).every((r) => r.base === 30)).toBe(true);
  });

  it("the court's fight: world life, the world's ante, the minister's list at 34, the law AND the High Ground on the court's side", () => {
    const w = world();
    const court = flood.courts.find((c) => c.id === "tallyflame_court")!;
    const { spec, enemyLife } = courtDuelSpec(w, catalog, knobs, court, new WorldRng(7));
    expect(enemyLife).toBe(34);
    expect(spec.rules.startingLife).toBe(w.player.worldLife);
    expect(spec.rules.ante).toBe(knobs.anteCount);
    expect(spec.players[1].decklist).toEqual(flood.decks.odile!.decklist);
    expect(spec.modifiers).toEqual(expect.arrayContaining([
      { type: "startingLife", player: 1, value: 34 },
      { type: "permanentOnBattlefield", player: 1, cardId: "law_intake" },
      { type: "permanentOnBattlefield", player: 1, cardId: "tallyflame_court" },
    ]));
    expect(courtDuelSpec(w, catalog, { ...knobs, floodCourtLife: 40 }, court, new WorldRng(7)).enemyLife).toBe(40);
  });

  it("a court's fall pays the ground and the minister (one each; a held minister is withheld for coin), clears the site, is chronicled — and survives the save; a loss costs a life and the stake", () => {
    const w = world();
    const court = flood.courts.find((c) => c.id === "cairnbrand_pyre")!;
    const gold = w.player.gold, life = w.player.worldLife;
    const lost = applyCourtDuel(w, knobs, pool, court, result(1));
    expect(lost.type).toBe("loss");
    expect(w.player.worldLife).toBe(Math.max(knobs.lifeFloor, life - knobs.lossLifePenalty));
    expect(courtsFallen(w)).toBe(0);
    const won = applyCourtDuel(w, knobs, pool, court, result(0, [[], ["meliyan_the_torment", "lightning_bolt"]]));
    expect(won).toMatchObject({ type: "win", paidCards: ["cairnbrand", "meliyan_the_torment"], anteWon: ["lightning_bolt"], anteWithheld: ["meliyan_the_torment"], ministerWithheld: false });
    expect(w.player.collection.cairnbrand).toBe(1);
    expect(w.player.collection.meliyan_the_torment).toBe(1);
    expect(w.player.gold).toBe(gold + knobs.petalGoldPrize);
    expect(w.dungeons[court.id]?.cleared).toBe(true);
    expect(floodRun(w).falls!.map((f) => f.siteId)).toEqual(["cairnbrand_pyre"]);
    const back = deserializeWorld(serializeWorld(w));
    expect(courtsFallen(back)).toBe(1);
    expect(back.map.deep!.filter(Boolean).length).toBe(w.map.deep!.filter(Boolean).length);
    expect(back.map.strongholds.find((f) => f.kind === "ground" && f.contentId === court.id)).toBeDefined();
    // The fallen court's ground is plain ground to walk on.
    const site = back.map.strongholds.find((f) => f.contentId === court.id)!;
    back.player.position = { ...site.at };
    expect(advance(back, catalog, [site.at]).some((e) => e.type === "courtEntry")).toBe(false);
  });

  it("a lord's fall adds his pair's two golds to the shops of towns sharing their colour (one copy, the R shelf's price) — the only R-tier shop stock; nothing before", () => {
    const w = world();
    const town = (colour: string) => w.map.towns.find((t) => w.map.regions[t.region]!.color === colour)!;
    expect(rollShopStock(w, town("U"), pool, knobs).some((r) => pool.get(r.cardId)?.shopTier === "R")).toBe(false);
    recordFloodLordFall(w, flood.strongholds.find((s) => s.id === "tidelock_weir")!);
    const blue = rollShopStock(w, town("U"), pool, knobs).filter((r) => pool.get(r.cardId)?.shopTier === "R");
    expect(blue.map((r) => r.cardId)).toEqual(["static_sphere"]); // {1}{U}{W}: a blue town stocks it; the Helix is red-white
    expect(blue[0]!.stock).toBe(1);
    expect(rollShopStock(w, town("R"), pool, knobs).filter((r) => pool.get(r.cardId)?.shopTier === "R").map((r) => r.cardId)).toEqual(["sacred_helix"]);
    expect(rollShopStock(w, town("W"), pool, knobs).filter((r) => pool.get(r.cardId)?.shopTier === "R").map((r) => r.cardId).sort()).toEqual(["sacred_helix", "static_sphere"]);
    expect(rollShopStock(w, town("G"), pool, knobs).some((r) => pool.get(r.cardId)?.shopTier === "R")).toBe(false);
    recordFloodLordFall(w, flood.strongholds.find((s) => s.id === "tidelock_weir")!); // idempotent on the golds
    expect(floodRun(w).golds).toEqual(["static_sphere", "sacred_helix"]);
  });

  it("ADR-130: the Heart opens when the five LORDS have fallen — the courts do not count; never in a phase-one world", () => {
    const w = world();
    for (const c of flood.courts) (floodRun(w).courts ??= {})[c.id] = true;
    expect(floodHeartOpen(w)).toBe(false);
    for (const s of flood.strongholds.slice(0, 4)) strongholdState(w, s.color).seal = true;
    expect(floodHeartOpen(w)).toBe(false);
    strongholdState(w, flood.strongholds[4]!.color).seal = true;
    expect(floodHeartOpen(w)).toBe(true);
    const one = newWorld({ seed: 1, catalog, starter: "white" });
    for (const s of flood.strongholds) strongholdState(one, s.color).seal = true;
    expect(floodHeartOpen(one)).toBe(false);
  });

  it("S42a (ADR-131/132): the fount's fight is the Heart's shape under the TIDE — world life, no ante, floodHeartLife, five roots, the card in hand, mode tide in U G W B R; shut until the five lords fall", async () => {
    const { fountDuelSpec } = await import("./flood.js");
    const w = world();
    expect(() => fountDuelSpec(w, knobs, new WorldRng(3))).toThrow(/five lords stand/);
    for (const s of flood.strongholds) strongholdState(w, s.color).seal = true;
    const { spec, enemyLife } = fountDuelSpec(w, knobs, new WorldRng(3));
    expect(enemyLife).toBe(50);
    expect(spec.rules.ante).toBe(0);
    expect(spec.rules.startingLife).toBe(w.player.worldLife);
    expect(spec.players[1].decklist.find((e) => e.cardId === "the_cinquefont")?.count).toBe(3);
    expect(spec.players[1].decklist.some((e) => e.cardId === "the_manafleur")).toBe(false);
    expect(spec.modifiers).toEqual(expect.arrayContaining([
      { type: "startingLife", player: 1, value: 50 },
      { type: "signatureToHand", player: 1, cardId: "the_cinquefont" },
      { type: "lawSequence", order: ["law_risen_tide", "law_season", "law_intake", "law_tithe", "law_toll"], mode: "tide" },
    ]));
    expect(spec.modifiers.filter((m) => m.type === "permanentOnBattlefield" && m.player === 1).map((m) => (m as { cardId: string }).cardId).sort()).toEqual(["forest", "island", "mountain", "plains", "swamp"]);
  });
});
