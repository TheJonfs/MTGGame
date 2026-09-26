import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, replayGame, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { loadCatalog } from "./loader.js";
import { newWorld, deserializeWorld, serializeWorld, maxWorldLife, worldKnobs, type WorldState } from "./state.js";
import { advance, applyDuelResult, parley, prepareDuel, type Encounter } from "./journey.js";
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

describe("S43 — the flood's lairs: the threshold, the duel, the prize (fuzz before fixtures: the fifteen lair duels with the post-lords references as pilots, replays byte-exact)", () => {
  it("fuzz: every lair on two maps (WR and UB pilots) — the certain encounter, the resident at its tier's phase-two row + the lair bonus, the duel terminates and replays exactly, the result applies; a WIN pays the lair's link once", async () => {
    let fought = 0, won = 0;
    for (const [seed, pair, key] of [[4310, ["W", "R"], "salvageWRLords"], [4311, ["U", "B"], "salvageUBLords"]] as const) {
      const road = ROAD_DECKS[key]!;
      const w = floodWorld(seed, [pair[0], pair[1]] as ["W", "R"], road.decklist);
      const knobs = defaultKnobs();
      for (const lair of lairsOf(w)) {
        const events = stepOntoLair(w, lair);
        const enc = events.find((e) => e.type === "encounter");
        expect(enc, `${lair.contentId}: ${events.map((e) => e.type).join(",")}`).toBeTruthy();
        if (!enc || enc.type !== "encounter") continue;
        expect(enc.encounter.contact).toBe("lair");
        expect(enc.encounter.fleeing).toBe(false);
        expect(parley(w, catalog, enc.encounter, "buyoff", {}, { pool }).type).toBe("refused"); // a lair is held, not passed
        const out = parley(w, catalog, enc.encounter, "fight", {}, { pool });
        expect(out.type).toBe("fight");
        if (out.type !== "fight") continue;
        const { duel } = out;
        const tmpl = catalog.opponents.find((o) => o.id === enc.encounter.catalogId)!;
        const { kind, color } = parseFloodLairId(lair.contentId)!;
        expect(tmpl.tier).toBe(kind === "hearthstead" ? 2 : 3);
        // The resident's row: the phase-two column through the resolver (row offsets — ADR-119's Ysolde −4 — included) + the lair bonus.
        expect(duel.enemy.worldLife, `${lair.contentId} ${tmpl.name}`).toBe(resolveMatchup(tmpl, worldKnobs(w), null, 2).life + knobs.lairResidentLifeBonus);
        expect(duel.enemy.worldLife).toBeGreaterThan(resolveMatchup(tmpl, worldKnobs(w), null, 1).life); // harder than phase one's row
        const linksBefore = w.manalinks.length, maxBefore = maxWorldLife(w);
        const a0: Agent = new HeuristicAgent(duel.seed * 2 + 1, pool, difficultyProfile("journeyman", road.archetype, duel.spec.players[1]!.decklist));
        const a1: Agent = new HeuristicAgent(duel.seed * 2 + 2, pool, difficultyProfile(duel.enemy.difficulty, duel.enemy.archetype, duel.spec.players[0]!.decklist));
        const result = await runMatch(duel.spec, pool, [a0, a1]);
        expect(result.reason).toBeTruthy();
        const flat = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array<string>(e.count).fill(e.cardId));
        const replayed = await replayGame(pool, [flat(duel.spec.players[0]!.decklist), flat(duel.spec.players[1]!.decklist)], result.log, duel.spec.rules as Parameters<typeof replayGame>[3], duel.spec.modifiers);
        expect(replayed).toBe(result.finalStateSerialized);
        const rec = applyDuelResult(w, catalog, duel, result);
        fought += 1;
        const resident = w.opponents.find((o) => o.id === lair.opponentId)!;
        if (result.winner === 0) {
          won += 1;
          expect(resident.gone && resident.goneReason === "defeated").toBe(true);
          expect(rec.lairPrize).toBeTruthy();
          const prize = FLOOD_LAIR_PRIZE[kind];
          expect(w.manalinks.length).toBe(linksBefore + prize.count);
          const mine = w.manalinks.slice(linksBefore);
          expect(mine.every((m) => m.lair === lair.contentId && m.town === -1 && m.color === color && m.kind === prize.kind)).toBe(true);
          if (prize.kind === "life") expect(maxWorldLife(w)).toBe(maxBefore + 2);
          else expect(manalinkModifiers(w).some((m) => m.cardId === { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" }[color])).toBe(true);
          expect(floodRun(w).lairs?.[lair.contentId!]).toMatchObject({ kind: prize.kind, color });
          // Once: stepping back onto the lair is an ordinary cell now.
          expect(stepOntoLair(w, lair).some((e) => e.type === "encounter")).toBe(false);
        } else {
          expect(resident.gone).toBe(false); // a lair's resident stays
          expect(w.manalinks.length).toBe(linksBefore);
          expect(rec.lairPrize).toBeUndefined();
        }
        if (w.gameOver) { w.gameOver = false; w.player.worldLife = 10; } // keep the fuzz walking
      }
    }
    expect(fought).toBe(30);
    console.log(`S43 lair fuzz: ${fought} duels, ${won} won by the post-lords pilots`);
    // The save round-trip carries the links, the paid lairs and the felled residents.
  }, 600_000);

  it("the Landing's basic is in play at the NEXT duel (any encounter); a lair's link is never suspended by a siege; the save carries links and paid lairs", async () => {
    const w = floodWorld(4312);
    const landing = lairsOf(w).find((l) => l.contentId === floodLairId("landing", "W"))!;
    const enc = stepOntoLair(w, landing).find((e) => e.type === "encounter");
    if (!enc || enc.type !== "encounter") throw new Error("no encounter");
    const out = parley(w, catalog, enc.encounter, "fight", {}, { pool });
    if (out.type !== "fight") throw new Error("no fight");
    const win = { winner: 0 as const, reason: "LIFE" as const, turns: 9, finalLife: [6, 0] as [number, number], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [[], []] as [string[], string[]] }, log: [], finalStateSerialized: "" };
    const rec = applyDuelResult(w, catalog, out.duel, win as never);
    expect(rec.lairPrize).toMatch(/^The ground stays under you\. The .* Landing: a manalink — every duel now starts with a bonus Plains on your battlefield\.$/);
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
    expect(back.opponents.find((o) => o.id === landing.opponentId)?.goneReason).toBe("defeated");
    // A Wellhouse: +2 maximum world life, at once.
    const well = lairsOf(w).find((l) => l.contentId === floodLairId("wellhouse", "R"))!;
    const max0 = maxWorldLife(w);
    const e3 = stepOntoLair(w, well).find((e) => e.type === "encounter");
    if (!e3 || e3.type !== "encounter") throw new Error("no encounter");
    const o3 = parley(w, catalog, e3.encounter, "fight", {}, { pool });
    if (o3.type !== "fight") throw new Error("no fight");
    const rec3 = applyDuelResult(w, catalog, o3.duel, win as never);
    expect(maxWorldLife(w)).toBe(max0 + 2);
    expect(rec3.lairPrize).toMatch(/^The water gives back a little of what it took\. The .* Wellhouse: two life manalinks — your maximum world life rises by 2\.$/); // post-S43: the note counts its links
    expect(fixedPointAt(w.map, well.at)?.contentId).toBe("lair:wellhouse:R");
    expect(regionAt(w.map, well.at).color).toBe("R");
  });
});

describe("S43 — the quest board beside the lairs", () => {
  it("a phase-two town never posts a RETRIEVAL (its lairs have no prize room); the other kinds still roll manalinks of both kinds at tier 2+ (the phase-one rules, untouched)", async () => {
    const { townOffers } = await import("./quests.js");
    const w = floodWorld(4313);
    const knobs = worldKnobs(w);
    let offers = 0, manalinks = 0;
    const kinds = new Set<string>();
    for (const town of w.map.towns) {
      for (let epoch = 0; epoch < 3; epoch++) {
        w.player.stepsTaken = epoch * knobs.shopRefreshSteps;
        for (const o of townOffers(w, catalog, town, knobs, pool)) { offers += 1; kinds.add(o.kind); if (o.reward.manalink) manalinks += 1; expect(o.kind).not.toBe("retrieval"); }
      }
    }
    expect(offers).toBeGreaterThan(20);
    expect(manalinks).toBeGreaterThan(0);
    expect([...kinds].sort()).toEqual(["bounty", "cardCourier", "courier"]);
    console.log(`S43 quest board (one phase-two map, every town × 3 epochs): ${offers} offers, ${manalinks} pay a manalink (${(100 * manalinks / offers).toFixed(0)}%); kinds ${[...kinds].sort().join(", ")}`);
  });
});
