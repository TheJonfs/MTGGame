import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors } from "@shandalar/cards";
import { runMatch, replayGame, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { loadCatalog } from "./loader.js";
import { assembleSalvageDeck, packIds, pickInPair, salvageCandidates, salvagePackProblems, SALVAGE_PAIRS, pairName } from "./salvage.js";
import { checkDeck } from "./legality.js";
import { newWorld, deserializeWorld, serializeWorld, type WorldState } from "./state.js";
import { advance, applyDuelResult, parley, type Encounter } from "./journey.js";
import { regionAt, type Point } from "./map.js";
import { emptyLegacy, floodEligible, legacyCarry, recordCutting, recordFlood, PETAL_ORDER, type Legacy } from "./corolla.js";
import { defaultKnobs } from "./knobs.js";
import type { OpponentInstance } from "./generate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const pack = catalog.salvagePack!;
const isLand = (id: string) => pool.get(id)!.types.includes("Land");
const lands = (deck: { cardId: string; count: number }[]) => deck.reduce((n, e) => n + (isLand(e.cardId) ? e.count : 0), 0);
const size = (deck: { cardId: string; count: number }[]) => deck.reduce((n, e) => n + e.count, 0);

/** A five-cutting legacy: the ten legends' ids come from the catalog through legacyCarry. */
function fullLegacy(): Legacy {
  let l = emptyLegacy();
  for (const c of PETAL_ORDER) l = recordCutting(l, { n: 0, color: c, text: "", seed: 1, difficulty: "standard", steps: 0, when: "2026" });
  return l;
}
const legends = (): string[] => PETAL_ORDER.flatMap((c) => { const k = legacyCarry(catalog, c); return [k.guardianCard!, k.minister!]; });
const PICKS = ["plateau", "underground_sea", "vindicate", "sacred_foundry", "blanchwood_armor"]; // W U B R G tabs (Vindicate on the B tab; a gold card)

describe("S39 (ADR-126) — the salvage pack", () => {
  it("validates against the pool: fifty-five known ids, ten mono-colour per colour at tier 1–2, five colourless, no prizeOnly, no repeats", () => {
    expect(salvagePackProblems(pack, pool)).toEqual([]);
    expect(packIds(pack)).toHaveLength(55);
    expect(new Set(packIds(pack)).size).toBe(55);
    for (const id of packIds(pack)) expect(pool.get(id)?.shopTier, id).not.toBe("R");
    // A bad pack names its problems.
    const bad = { colors: { ...pack.colors, W: [...pack.colors.W.slice(0, 9), "demonic_tutor"] }, colorless: pack.colorless };
    expect(salvagePackProblems(bad, pool)).toEqual(["W: Demonic Tutor is B, not mono-W", "W: Demonic Tutor is tier R; the pack allows 1–2"]);
  });
  it("the pick candidates are the stronghold prize picker's rule: a gold card on either of its colours' tabs, R included, never prizeOnly, duals by their basic type", () => {
    const w = salvageCandidates(pool, "W"), b = salvageCandidates(pool, "B"), u = salvageCandidates(pool, "U");
    expect(w.some((d) => d.id === "vindicate")).toBe(true);
    expect(b.some((d) => d.id === "vindicate")).toBe(true);
    expect(u.some((d) => d.id === "vindicate")).toBe(false);
    expect(w.some((d) => d.id === "plateau")).toBe(true); // Plains Mountain: W and R
    expect(salvageCandidates(pool, "R").some((d) => d.id === "plateau")).toBe(true);
    expect(w.some((d) => d.shopTier === "R")).toBe(true);
    for (const c of ["W", "U", "B", "R", "G"] as const) expect(salvageCandidates(pool, c).every((d) => !d.prizeOnly && !d.isTokenDef)).toBe(true);
    expect(pickInPair(pool.get("vindicate")!, ["W", "B"])).toBe(true);
    expect(pickInPair(pool.get("vindicate")!, ["W", "R"])).toBe(false);
    expect(pickInPair(pool.get("plateau")!, ["W", "R"])).toBe(true);
    expect(pickInPair(pool.get("mind_stone")!, ["W", "R"])).toBe(false);
  });
  it("assembles the first deck in the twelve-land shape for every pair: thirty cards, eighteen nonland, one copy each, legal; the picks in the pair join; a spell pick displaces a colourless artifact", () => {
    for (const pair of SALVAGE_PAIRS) {
      const deck = assembleSalvageDeck(pool, pack, pair, []);
      expect(size(deck), pairName(pair)).toBe(30);
      expect(lands(deck), pairName(pair)).toBe(12);
      expect(deck.filter((e) => !["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId)).every((e) => e.count === 1)).toBe(true);
      expect(checkDeck(deck, null, null, pool).ok).toBe(true);
      // Each colour's ten minus two (the highest mana values), plus two colourless artifacts to eighteen.
      for (const c of pair) expect(deck.filter((e) => pack.colors[c].includes(e.cardId))).toHaveLength(8);
      expect(deck.filter((e) => pack.colorless.includes(e.cardId))).toHaveLength(2);
    }
    // W: the two highest mana values leave — Inspiring Overseer (3) and, at 2, the later of the twos in the list (Raise the Alarm).
    const wr = assembleSalvageDeck(pool, pack, ["W", "R"], ["plateau", "sacred_foundry"]);
    expect(wr.some((e) => e.cardId === "inspiring_overseer")).toBe(false);
    expect(wr.some((e) => e.cardId === "raise_the_alarm")).toBe(false);
    expect(wr.some((e) => e.cardId === "plateau") && wr.some((e) => e.cardId === "sacred_foundry")).toBe(true);
    expect(lands(wr)).toBe(12); // two duals, ten basics
    expect(size(wr)).toBe(30);
    const wb = assembleSalvageDeck(pool, pack, ["W", "B"], ["vindicate", "tropical_island"]);
    expect(wb.some((e) => e.cardId === "vindicate")).toBe(true);
    expect(wb.some((e) => e.cardId === "tropical_island")).toBe(false); // a Forest Island: not in a WB pair
    expect(assembleSalvageDeck(pool, pack, ["W", "B"], ["underground_sea"]).some((e) => e.cardId === "underground_sea")).toBe(true); // an Island Swamp is
    expect(wb.filter((e) => pack.colorless.includes(e.cardId))).toHaveLength(1); // the spell pick displaced one artifact
    expect(lands(wb)).toBe(12);
    // Basics split by pips, each colour at least three.
    const rg = assembleSalvageDeck(pool, pack, ["R", "G"], []);
    const m = rg.find((e) => e.cardId === "mountain")!.count, f = rg.find((e) => e.cardId === "forest")!.count;
    expect(m + f).toBe(12);
    expect(Math.min(m, f)).toBeGreaterThanOrEqual(3);
  });
});

describe("S39 (ADR-126) — newWorld({ salvage })", () => {
  const spec = () => ({ legends: legends(), picks: PICKS, pair: ["W", "R"] as ["W", "R"], deck: assembleSalvageDeck(pool, pack, ["W", "R"], PICKS) });
  it("the collection is the ten legends + the five picks + the pack + the deck's basics (one copy each, provenance salvage); phase 2; the purse; no manalinks; the first deck active and legal", () => {
    const w = newWorld({ seed: 3901, catalog, salvage: spec(), playerName: "Flood" });
    expect(w.phase).toBe(2);
    expect(w.player.gold).toBe(defaultKnobs().salvagePurse);
    expect(w.manalinks).toEqual([]);
    expect(w.powers.unlocked).toEqual([]);
    const nonBasic = Object.entries(w.player.collection).filter(([id]) => !["plains", "island", "swamp", "mountain", "forest"].includes(id));
    expect(nonBasic).toHaveLength(10 + 5 + 55);
    expect(nonBasic.every(([, n]) => n === 1)).toBe(true);
    for (const id of legends()) expect(w.player.collection[id], id).toBe(1);
    for (const id of PICKS) expect(w.player.collection[id], id).toBe(1);
    for (const id of packIds(pack)) expect(w.player.collection[id], id).toBe(1);
    expect(w.provenance.every((p) => p.source === "salvage")).toBe(true);
    expect(w.activeDeckName).toBe("The Salvage");
    expect(checkDeck(w.decks["The Salvage"]!, w.player.collection, null, pool).ok).toBe(true);
    expect(w.player.basicLand).toBe("plains");
    expect(w.player.starterId).toBe("white");
    // The map: the flood's names, the deep water at the centre, no Corolla and no Vault.
    expect(w.map.towns.every((t) => catalog.townNamesPhaseTwo!.includes(t.name))).toBe(true);
    expect(w.map.strongholds.filter((f) => f.kind === "deep")).toHaveLength(1);
    expect(w.map.strongholds.some((f) => f.kind === "corolla" || f.kind === "vault")).toBe(false);
    // The save round-trips and keeps its deep water (no Corolla grows on load).
    const back = deserializeWorld(serializeWorld(w));
    expect(back.phase).toBe(2);
    expect(back.map.strongholds.some((f) => f.kind === "corolla")).toBe(false);
    expect(back.map.strongholds.filter((f) => f.kind === "deep")).toHaveLength(1);
  });
  it("a phase-one world is unchanged: the starter path, phase 1, the Corolla's doors, the phase-one names", () => {
    const w = newWorld({ seed: 3901, catalog, starter: "white" });
    expect(w.phase).toBe(1);
    expect(w.map.strongholds.some((f) => f.kind === "corolla")).toBe(true);
    expect(w.map.strongholds.some((f) => f.kind === "deep")).toBe(false);
    expect(w.player.gold).toBe(defaultKnobs().startingGold);
    expect(() => newWorld({ seed: 1, catalog })).toThrow(/a starter or a salvage/);
  });
  it("eligibility: the Flood opens at five cut colours and not before; the flood's chronicle entry is appended without a cutting", () => {
    expect(floodEligible(emptyLegacy())).toBe(false);
    let l = emptyLegacy();
    for (const c of PETAL_ORDER.slice(0, 4)) l = recordCutting(l, { n: 0, color: c, text: "", seed: 1, difficulty: "standard", steps: 0, when: "2026" });
    expect(floodEligible(l)).toBe(false);
    expect(floodEligible(fullLegacy())).toBe(true);
    const after = recordFlood(fullLegacy(), { color: "W", text: "The plane turns over. Salvaged: …", seed: 3901, difficulty: "standard", steps: 0, when: "2026" });
    expect(after.chronicle).toHaveLength(6);
    expect(after.chronicle[5]).toMatchObject({ n: 6, kind: "flood", color: "W" });
    expect(after.victories).toBe(fullLegacy().victories);
  });
  it("the salvage yardsticks are the pack's two colours plus two duals: thirty cards, twelve lands, every id in the pool and in the pack or a pick", () => {
    for (const key of ["salvageWR", "salvageUB"] as const) {
      const r = ROAD_DECKS[key]!;
      expect(size(r.decklist)).toBe(30);
      expect(lands(r.decklist)).toBe(12);
      expect(r.life).toBe(12);
      expect(r.entrance).toEqual([]);
      const basics = ["plains", "island", "swamp", "mountain", "forest"];
      for (const e of r.decklist) {
        expect(pool.has(e.cardId), e.cardId).toBe(true);
        const inPack = packIds(pack).includes(e.cardId);
        const dual = isLand(e.cardId) && !basics.includes(e.cardId) && !inPack;
        expect(inPack || dual || basics.includes(e.cardId), e.cardId).toBe(true);
        if (!basics.includes(e.cardId)) expect(e.count).toBe(1);
      }
      expect(r.decklist.filter((e) => isLand(e.cardId) && !basics.includes(e.cardId))).toHaveLength(2); // the two picks
      expect(r.decklist.filter((e) => !isLand(e.cardId))).toHaveLength(18);
    }
  });
});

/** A forced encounter on the next passable cell (world.test's helper, reduced). */
function firstEncounter(w: WorldState): Encounter {
  const s = w.player.position;
  const cell = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }].find((p: Point) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[p.y * w.map.width + p.x] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y) && !w.map.strongholds.some((f) => f.at.x === p.x && f.at.y === p.y))!;
  const inst = w.opponents.find((o: OpponentInstance) => !o.gone && !o.fixedAt && o.at)!;
  inst.at = { ...cell }; inst.region = regionAt(w.map, cell).index;
  const enc = advance(w, catalog, [cell]).find((e) => e.type === "encounter");
  if (enc && enc.type === "encounter") return enc.encounter;
  throw new Error("no encounter");
}

describe("S39 — a phase-two world's first encounters with the yardsticks as pilots (fuzz before fixtures; replays byte-exact)", () => {
  it("ten encounters each for salvage-WR and salvage-UB at the phase-two column: every duel terminates and replays exactly; the results apply", async () => {
    for (const [key, pair] of [["salvageWR", ["W", "R"]], ["salvageUB", ["U", "B"]]] as const) {
      const road = ROAD_DECKS[key]!;
      const picks = road.decklist.filter((e) => isLand(e.cardId) && !["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId)).map((e) => e.cardId);
      const w = newWorld({ seed: 3910 + key.length, catalog, salvage: { legends: legends(), picks: [...picks, "vindicate", "rancor", "brainstorm"].slice(0, 5), pair: [pair[0], pair[1]] as ["W", "R"], deck: road.decklist.map((e) => ({ ...e })) }, playerName: "Pilot" });
      expect(w.phase).toBe(2);
      let fought = 0;
      for (let i = 0; i < 40 && fought < 10; i++) {
        if (w.gameOver) break;
        for (const o of w.opponents) if (!o.fixedAt && o.gone) { o.gone = false; delete o.goneReason; }
        const enc = firstEncounter(w);
        const out = parley(w, catalog, enc, "fight", {}, { pool });
        expect(out.type).toBe("fight");
        if (out.type !== "fight") continue;
        const { duel } = out;
        const a0: Agent = new HeuristicAgent(duel.seed * 2 + 1, pool, difficultyProfile("journeyman", road.archetype, duel.spec.players[1]!.decklist));
        const a1: Agent = new HeuristicAgent(duel.seed * 2 + 2, pool, difficultyProfile(duel.enemy.difficulty, duel.enemy.archetype, duel.spec.players[0]!.decklist));
        const result = await runMatch(duel.spec, pool, [a0, a1]);
        expect(result.reason).toBeTruthy();
        const flat = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array<string>(e.count).fill(e.cardId));
        const replayed = await replayGame(pool, [flat(duel.spec.players[0]!.decklist), flat(duel.spec.players[1]!.decklist)], result.log, duel.spec.rules as Parameters<typeof replayGame>[3], duel.spec.modifiers);
        expect(replayed).toBe(result.finalStateSerialized);
        applyDuelResult(w, catalog, duel, result);
        fought += 1;
      }
      expect(fought).toBeGreaterThanOrEqual(5);
    }
  }, 300_000);
});
