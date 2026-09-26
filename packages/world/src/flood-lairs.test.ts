import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, replayGame, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { loadCatalog } from "./loader.js";
import { newWorld, deserializeWorld, serializeWorld, maxWorldLife, worldKnobs, type WorldState } from "./state.js";
import { advance, awardFloodLair, prepareDuel, type Encounter } from "./journey.js";
import { applyInteriorDuel, clearDungeon, dungeonDuelSpec, floodLairOfRun, generateDungeonRun, lairGuardian, lairPrizeRoll } from "./dungeon.js";
import { enemyDeck } from "./catalog.js";
import { fixedPointAt, manhattan, regionAt, type FixedPoint } from "./map.js";
import { legacyCarry, PETAL_ORDER } from "./corolla.js";
import { assembleSalvageDeck } from "./salvage.js";
import { commitDeck } from "./deck-edit.js";
import { defaultKnobs } from "./knobs.js";
import { resolveMatchup } from "./matchup.js";
import { FLOOD_LAIR_KINDS, FLOOD_LAIR_PRIZE, floodLairId, floodLairResidents, parseFloodLairId } from "./flood-lairs.js";
import { floodRun } from "./flood.js";
import { manalinkModifiers } from "./quests.js";
import { WorldRng } from "./rng.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const COLORS = ["W", "U", "B", "R", "G"] as const;
const legends = (): string[] => PETAL_ORDER.flatMap((c) => { const k = legacyCarry(catalog, c); return [k.guardianCard!, k.minister!]; });
/** A phase-two world from the salvage path; `deck` (a reference list) replaces the salvage deck with its cards granted —
 * the S42b controller test's pattern (a dev grant, not a ceremony). */
function floodWorld(seed: number, pair: ["W", "R"] | ["U", "B"] = ["W", "R"], deck?: { cardId: string; count: number }[]): WorldState {
  const w = newWorld({ seed, catalog, salvage: { legends: legends(), picks: [], pair, deck: assembleSalvageDeck(pool, catalog.salvagePack!, pair, []) }, playerName: "Flood" });
  if (deck) {
    for (const e of deck) w.player.collection[e.cardId] = Math.max(w.player.collection[e.cardId] ?? 0, e.count);
    const r = commitDeck(w, deck.map((e) => ({ ...e })));
    if (!r.ok) throw new Error(r.reason);
  }
  return w;
}
const lairsOf = (w: WorldState): FixedPoint[] => w.map.strongholds.filter((f) => f.kind === "lair");

/** Stand beside the lair and step onto it: the certain encounter (or whatever the walk raises). */
function stepOntoLair(w: WorldState, lair: FixedPoint) {
  const nbr = [{ x: lair.at.x + 1, y: lair.at.y }, { x: lair.at.x - 1, y: lair.at.y }, { x: lair.at.x, y: lair.at.y + 1 }, { x: lair.at.x, y: lair.at.y - 1 }].find((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[p.y * w.map.width + p.x])!;
  w.player.position = { ...nbr };
  for (const o of w.opponents) if (!o.fixedAt && !o.gone) { o.gone = true; o.goneReason = "fled"; } // the roamers out of the way
  return advance(w, catalog, [lair.at]);
}

describe("S43 (ADR-136) — the flood's lairs: generation", () => {
  it("fifteen lairs per phase-two map — three per territory across its approach and wild rings, one of each kind, never on the civilized ring, never adjacent to the stronghold or the High Ground, reachable; a phase-one map keeps its five bestiary lairs", () => {
    for (const seed of [4301, 4302, 4303, 4304, 4305, 4306, 4307, 4308]) {
      const w = floodWorld(seed);
      const lairs = lairsOf(w);
      expect(lairs, `seed ${seed}`).toHaveLength(15);
      const seats = w.map.strongholds.filter((f) => f.kind === "stronghold" || f.kind === "ground");
      for (const c of COLORS) {
        const mine = lairs.filter((l) => parseFloodLairId(l.contentId)?.color === c);
        expect(mine.map((l) => parseFloodLairId(l.contentId)!.kind).sort()).toEqual([...FLOOD_LAIR_KINDS].sort());
        for (const l of mine) {
          const r = w.map.regions[l.region]!;
          expect(r.color, l.contentId).toBe(c);
          expect(r.tier, l.contentId).not.toBe("civilized");
          expect(l.name, l.contentId).toBe(`${r.name} ${{ landing: "Landing", wellhouse: "Wellhouse", hearthstead: "Hearthstead" }[parseFloodLairId(l.contentId)!.kind]}`);
          for (const s of seats) expect(manhattan(l.at, s.at), `${l.contentId} beside ${s.name}`).toBeGreaterThan(1);
          expect(w.map.passable[l.at.y * w.map.width + l.at.x]).toBe(true);
          expect(w.opponents.find((o) => o.id === l.opponentId)?.fixedAt).toEqual(l.at);
        }
        const tiers = mine.map((l) => w.map.regions[l.region]!.tier).sort();
        expect([["approach", "approach", "wild"], ["approach", "wild", "wild"]].some((t) => JSON.stringify(t) === JSON.stringify(tiers)), `${c}: ${tiers.join(",")}`).toBe(true);
      }
    }
    const one = newWorld({ seed: 4301, catalog, starter: "white" });
    const p1 = lairsOf(one);
    expect(p1).toHaveLength(5);
    expect(p1.every((l) => !l.contentId)).toBe(true);
  });

  it("the resident table: the Landing's is the tier-3 mage who kept the colour (Ysolde W, Varro U, Corvane B, Sorrel R, Quill G); the Wellhouse's the territory's tier-3 beast; the Hearthstead's the tier-2 mage who kept it — Pell in blue, Kessa in red (she wore the Mountains at phase one), Vael W, Maelin B, Brennor G", () => {
    const t = floodLairResidents(catalog);
    const names = (k: "landing" | "wellhouse" | "hearthstead") => COLORS.map((c) => t[c][k].name);
    expect(names("landing")).toEqual(["Thornmother Ysolde", "Varro Flamebrand", "Lord Corvane", "High Warden Sorrel", "Magister Quill"]);
    expect(names("wellhouse")).toEqual(["The Serra Angel", "The Faerie Formation", "The Hypnotic Specter", "The Siege-Gang", "the Pelakka Wurm"]);
    expect(names("hearthstead")).toEqual(["Mistress Vael", "Pell of the Shallows", "Adept Maelin", "Kessa Emberhand", "Brennor of the Glade"]);
    const w = floodWorld(4309);
    for (const l of lairsOf(w)) {
      const { kind, color } = parseFloodLairId(l.contentId)!;
      expect(w.opponents.find((o) => o.id === l.opponentId)!.catalogId, l.contentId).toBe(t[color][kind].id);
    }
  });
});

describe("S43 → post-S43 — the flood's lairs are LAIR-DUNGEONS: the threshold, the crawl's guardian at the phase-two row, the prize with the manalink (fuzz before fixtures: the fifteen guardian duels with the post-lords references as pilots, replays byte-exact)", () => {
  /** The lair's run generated as the controller does, and the guardian's spec as it builds it (lairGuardian + the bonus + the empowerment). */
  const guardianOf = (w: WorldState, lair: FixedPoint) => {
    const knobs = worldKnobs(w);
    const resident = w.opponents.find((o) => o.id === lair.opponentId)!;
    const { kind, color } = parseFloodLairId(lair.contentId)!;
    const run = generateDungeonRun(w, catalog, knobs, pool, { dungeonId: `lair_${resident.id}`, kind: "lair", color, enteredFrom: { ...lair.at }, residentCatalogId: resident.catalogId, small: true });
    w.activeDungeon = run;
    const tmpl = catalog.opponents.find((o) => o.id === resident.catalogId)!;
    const deck = enemyDeck(catalog, tmpl.deck, w.phase);
    const g = lairGuardian(w, catalog, knobs, run);
    const spec = dungeonDuelSpec(w, catalog, knobs, run, { kind: "guardian", name: tmpl.name, decklist: deck.decklist, archetype: deck.archetype, life: g.life, color }, [], new WorldRng(w.rng), g.extraModifiers);
    return { knobs, run, tmpl, spec, kind, color, resident };
  };

  it("stepping onto a flood lair opens the DUNGEON threshold (kind lair, the resident named), not a parley; the guardian fights at the tier's phase-two row + the lair bonus with its entrance basics; the run's colour is the territory's", () => {
    const w = floodWorld(4310);
    for (const lair of lairsOf(w)) {
      const events = stepOntoLair(w, lair);
      const entry = events.find((e) => e.type === "dungeonEntry");
      expect(entry, `${lair.contentId}: ${events.map((e) => e.type).join(",")}`).toBeTruthy();
      if (!entry || entry.type !== "dungeonEntry") continue;
      expect(entry.kind).toBe("lair");
      expect(entry.name).toBe(lair.name);
      expect(entry.residentCatalogId).toBe(w.opponents.find((o) => o.id === lair.opponentId)!.catalogId);
      expect(events.some((e) => e.type === "encounter")).toBe(false);
      const { knobs, run, tmpl, spec, kind, color } = guardianOf(w, lair);
      expect(run.kind).toBe("lair");
      expect(tmpl.tier).toBe(kind === "hearthstead" ? 2 : 3);
      const row = resolveMatchup(tmpl, knobs, null, 2);
      expect(spec.enemyLife, `${lair.contentId} ${tmpl.name}`).toBe(row.life + knobs.lairResidentLifeBonus);
      const basics = spec.spec.modifiers.filter((m) => m.type === "permanentOnBattlefield" && m.player === 1).map((m) => (m as { cardId: string }).cardId);
      expect(basics, `${lair.contentId}: the entrance`).toEqual(row.entrance);
      expect(floodLairOfRun(w, run)?.color).toBe(color);
      w.activeDungeon = null;
    }
  });

  it("fuzz: every lair's GUARDIAN duel on two maps (WR and UB pilots) terminates and replays byte-exact; a WIN pays the lair's link with the prize (once), a loss leaves the resident and pays nothing", async () => {
    let fought = 0, won = 0;
    for (const [seed, pair, key] of [[4310, ["W", "R"], "salvageWRLords"], [4311, ["U", "B"], "salvageUBLords"]] as const) {
      const road = ROAD_DECKS[key]!;
      const w = floodWorld(seed, [pair[0], pair[1]] as ["W", "R"], road.decklist);
      for (const lair of lairsOf(w)) {
        const { knobs, run, tmpl, spec, kind, color, resident } = guardianOf(w, lair);
        const linksBefore = w.manalinks.length, maxBefore = maxWorldLife(w);
        const a0: Agent = new HeuristicAgent(spec.spec.seed * 2 + 1, pool, difficultyProfile("journeyman", road.archetype, spec.spec.players[1]!.decklist));
        const a1: Agent = new HeuristicAgent(spec.spec.seed * 2 + 2, pool, difficultyProfile("master", "midrange", spec.spec.players[0]!.decklist));
        const result = await runMatch(spec.spec, pool, [a0, a1]);
        expect(result.reason).toBeTruthy();
        const flat = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array<string>(e.count).fill(e.cardId));
        const replayed = await replayGame(pool, [flat(spec.spec.players[0]!.decklist), flat(spec.spec.players[1]!.decklist)], result.log, spec.spec.rules as Parameters<typeof replayGame>[3], spec.spec.modifiers);
        expect(replayed).toBe(result.finalStateSerialized);
        const out = applyInteriorDuel(w, knobs, run, result, undefined, catalog);
        fought += 1;
        if (out.type === "win") {
          won += 1;
          // The controller's victory branch, in the world's terms: the prize room + the manalink, the resident felled.
          const fl = floodLairOfRun(w, run)!;
          const note = awardFloodLair(w, knobs, catalog, fl.site.contentId!, { kind: fl.kind, color: fl.color }, fl.site.name ?? "the lair");
          const paid = clearDungeon(w, run, lairPrizeRoll(w, pool, run.dungeonId));
          resident.gone = true; resident.goneReason = "defeated";
          expect(paid.paidGold).toBeGreaterThanOrEqual(30);
          expect(paid.paidCards.length).toBeGreaterThanOrEqual(2);
          const prize = FLOOD_LAIR_PRIZE[kind];
          expect(w.manalinks.length).toBe(linksBefore + prize.count);
          expect(w.manalinks.slice(linksBefore).every((m) => m.lair === lair.contentId && m.town === -1 && m.color === color && m.kind === prize.kind)).toBe(true);
          if (prize.kind === "life") { expect(maxWorldLife(w)).toBe(maxBefore + 2); expect(note).toMatch(/two life manalinks — your maximum world life rises by 2/); }
          else expect(manalinkModifiers(w).some((m) => m.cardId === { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" }[color])).toBe(true);
          expect(floodRun(w).lairs?.[lair.contentId!]).toMatchObject({ kind: prize.kind, color });
          expect(awardFloodLair(w, knobs, catalog, fl.site.contentId!, { kind: fl.kind, color: fl.color }, "again")).toMatch(/already paid/); // once
          expect(stepOntoLair(w, lair).some((e) => e.type === "dungeonEntry" || e.type === "encounter")).toBe(false); // an ordinary cell now
        } else {
          expect(resident.gone).toBe(false);
          expect(w.manalinks.length).toBe(linksBefore);
          expect(out.type === "loss" && out.ejected).toBe(true); // an interior loss ejects (the controller resets the run)
          if (w.gameOver) { w.gameOver = false; w.player.worldLife = 10; }
        }
        w.activeDungeon = null;
        expect(tmpl).toBeTruthy();
      }
    }
    expect(fought).toBe(30);
    console.log(`post-S43 lair-dungeon fuzz: ${fought} guardian duels, ${won} won by the post-lords pilots`);
  }, 600_000);

  it("the Landing's basic is in play at the NEXT duel (any encounter); a lair's link is never suspended by a siege; the save carries links and paid lairs", async () => {
    const w = floodWorld(4312);
    const landing = lairsOf(w).find((l) => l.contentId === floodLairId("landing", "W"))!;
    const knobs = worldKnobs(w);
    const rec = awardFloodLair(w, knobs, catalog, landing.contentId!, { kind: "landing", color: "W" }, landing.name ?? "the lair");
    expect(rec).toMatch(/^The ground stays under you\. The .* Landing: a manalink — every duel now starts with a bonus Plains on your battlefield\.$/);
    expect(w.manalinks).toEqual([{ color: "W", town: -1, lair: "lair:landing:W", kind: "basic" }]);
    // The next duel — any roamer — carries the Plains on the player's side.
    const roamer = w.opponents.find((o) => !o.fixedAt)!;
    roamer.gone = false; delete roamer.goneReason;
    const enc2: Encounter = { opponentId: roamer.id, catalogId: roamer.catalogId, tier: catalog.opponents.find((o) => o.id === roamer.catalogId)!.tier, region: 0, at: { ...w.player.position }, fleeing: false, contact: "stepped" };
    const duel2 = prepareDuel(w, catalog, enc2, new WorldRng(w.rng), defaultKnobs());
    expect(duel2.spec.modifiers).toContainEqual({ type: "permanentOnBattlefield", player: 0, cardId: "plains" });
    // A siege anywhere never darkens it (town −1).
    (w.sieges as unknown[]).push({ townIndex: 0, status: "occupied" });
    expect(manalinkModifiers(w)).toContainEqual({ type: "permanentOnBattlefield", player: 0, cardId: "plains" });
    const back = deserializeWorld(serializeWorld(w));
    expect(back.manalinks).toEqual(w.manalinks);
    expect(floodRun(back).lairs?.["lair:landing:W"]).toBeTruthy();
    // A Wellhouse: +2 maximum world life, at once, worded as two.
    const well = lairsOf(w).find((l) => l.contentId === floodLairId("wellhouse", "R"))!;
    const max0 = maxWorldLife(w);
    const rec3 = awardFloodLair(w, knobs, catalog, well.contentId!, { kind: "wellhouse", color: "R" }, well.name ?? "the lair");
    expect(maxWorldLife(w)).toBe(max0 + 2);
    expect(rec3).toMatch(/^The water gives back a little of what it took\. The .* Wellhouse: two life manalinks — your maximum world life rises by 2\.$/);
    expect(fixedPointAt(w.map, well.at)?.contentId).toBe("lair:wellhouse:R");
    expect(regionAt(w.map, well.at).color).toBe("R");
  });
});

describe("S43 — the quest board beside the lairs", () => {
  it("a phase-two board posts every kind — retrievals too, now the lairs are dungeons with a prize room (post-S43) — and rolls manalinks of both kinds at tier 2+ (the phase-one rules, untouched)", async () => {
    const { townOffers } = await import("./quests.js");
    const w = floodWorld(4313);
    const knobs = worldKnobs(w);
    let offers = 0, manalinks = 0;
    const kinds = new Set<string>();
    for (const town of w.map.towns) {
      for (let epoch = 0; epoch < 3; epoch++) {
        w.player.stepsTaken = epoch * knobs.shopRefreshSteps;
        for (const o of townOffers(w, catalog, town, knobs, pool)) { offers += 1; kinds.add(o.kind); if (o.reward.manalink) manalinks += 1; if (o.kind === "retrieval") expect(o.retrievalDungeonId).toMatch(/^lair_/); }
      }
    }
    expect(offers).toBeGreaterThan(20);
    expect(manalinks).toBeGreaterThan(0);
    expect([...kinds].sort()).toEqual(["bounty", "cardCourier", "courier", "retrieval"]);
    console.log(`S43 quest board (one phase-two map, every town × 3 epochs): ${offers} offers, ${manalinks} pay a manalink (${(100 * manalinks / offers).toFixed(0)}%); kinds ${[...kinds].sort().join(", ")}`);
  });
});
