import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { MatchResult } from "@shandalar/engine";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
import { loadCatalog } from "./loader.js";
import { findPath, idx, manhattan, samePoint, type WorldMap } from "./map.js";
import { activeDeck, deserializeWorld, newWorld, serializeWorld, maxWorldLife, MOX_IDS, type WorldState } from "./state.js";
import { walkTo } from "./journey.js";
import { strongholdState } from "./stronghold.js";
import { defaultKnobs } from "./knobs.js";
import { WorldRng } from "./rng.js";
import {
  applyMirrorDuel, applyPetalDuel, corollaAdvance, corollaAsWorldMap, corollaDoor, corollaInnRest, corollaPath, deriveArchetype, enterCorolla,
  generateCorolla, heartDoor, insideCorolla, leaveCorolla, mirrorDuelSpec, petalDuelSpec, petalsFallen, rollCorollaStock, vaultDoor,
  COROLLA_HEART, COROLLA_TOWN_INDEX, COROLLA_VOID, PETAL_ORDER,
} from "./corolla.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const QUIET = { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 } } } as const;

const fakeResult = (winner: 0 | 1, ante: [string[], string[]] = [[], []]): MatchResult =>
  ({ winner, reason: "LIFE", turns: 9, finalLife: winner === 0 ? [6, 0] : [0, 6], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante }, log: [], finalStateSerialized: "" }) as never;

const sealAll = (w: WorldState, n = 5) => { for (const c of PETAL_ORDER.slice(0, n)) strongholdState(w, c).seal = true; };
const holdMoxen = (w: WorldState, n = 5) => { for (const id of MOX_IDS.slice(0, n)) w.player.collection[id] = 1; };

describe("S26 Part 2 — the Corolla: geometry, the doors, the petals (ADR-091)", () => {
  it("catalog carries the flower: five petals in the ring order, each with a boss, a signature, and two duals in the pool", () => {
    const def = catalog.corolla!;
    expect(def).toBeTruthy();
    expect(def.petals.map((p) => p.color).sort()).toEqual(["B", "G", "R", "U", "W"]);
    for (const p of def.petals) {
      expect(pool.get(p.signature)?.prizeOnly, p.signature).toBe(true);
      for (const d of p.duals) expect(pool.get(d)?.types, d).toContain("Land");
      expect(COROLLA_DECKS[p.boss.key], p.boss.key).toBeTruthy();
      expect(COROLLA_DECKS[p.boss.key]!.signature).toBe(p.signature);
    }
    // The Cinquefoil configuration: the petal wears the LAW's colour; its boss wields the two
    // neighbouring petals' colours (each still pair = the lord's ring-neighbours).
    for (const p of def.petals) {
      const i = PETAL_ORDER.indexOf(p.color);
      const neighbours = [PETAL_ORDER[(i + 4) % 5], PETAL_ORDER[(i + 1) % 5]].sort().join("");
      const pair = COROLLA_DECKS[p.boss.key]!.pair.split("").sort().join("");
      expect(pair, `${p.color} petal hosts ${p.boss.name}`).toBe(neighbours);
    }
  });

  it("geometry: five lobes around a heart, every tip reachable from the entry, the entry just off the town, the void impassable", () => {
    const g = generateCorolla(41);
    expect(g.size).toBe(41);
    expect(g.petals.map((p) => p.color)).toEqual([...PETAL_ORDER]);
    expect(g.region[idx({ width: 41 }, g.town)]).toBe(COROLLA_HEART);
    expect(manhattan(g.entry, g.town)).toBe(2);
    const map = corollaAsWorldMap(g, catalog.corolla!, {}, new Set());
    for (const p of g.petals) {
      expect(g.region[idx({ width: 41 }, p.tip)]).toBe(PETAL_ORDER.indexOf(p.color));
      expect(findPath(map, g.entry, p.tip), `tip ${p.color}`).not.toBeNull();
      expect(manhattan(p.tip, g.town)).toBeGreaterThan(12);
    }
    // The void is the unpainted paper: impassable, and the majority of the sheet.
    const voidCells = g.region.filter((r) => r === COROLLA_VOID).length;
    expect(voidCells).toBeGreaterThan(41 * 41 * 0.5);
    for (let i = 0; i < g.region.length; i++) if (g.region[i] === COROLLA_VOID) expect(g.passable[i]).toBe(false);
    // Deterministic: the flower is the plane's own shape.
    expect(JSON.stringify(generateCorolla(41))).toBe(JSON.stringify(g));
    // Fixed points: five petal tips (kind "petal"), one town at the heart.
    expect(map.strongholds.filter((f) => f.kind === "petal")).toHaveLength(5);
    expect(map.towns).toHaveLength(1);
    expect(map.towns[0]!.index).toBe(COROLLA_TOWN_INDEX);
  });

  it("worldgen: the two centre doors exist on a new radial map, reachable, apart, off any town; a pre-S26 map grows them on load", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const doors = w.map.strongholds.filter((f) => f.kind === "corolla" || f.kind === "vault");
    expect(doors.map((d) => d.kind).sort()).toEqual(["corolla", "vault"]);
    const [a, b] = doors;
    expect(manhattan(a!.at, w.map.centre!)).toBeLessThanOrEqual(4);
    expect(manhattan(b!.at, w.map.centre!)).toBeLessThanOrEqual(4);
    expect(manhattan(a!.at, b!.at)).toBeGreaterThanOrEqual(2);
    for (const d of doors) {
      expect(w.map.towns.some((t) => samePoint(t.at, d.at))).toBe(false);
      expect(findPath(w.map, w.map.start, d.at), d.kind).not.toBeNull();
    }
    // Migration: strip the doors and reload — the save grows them back, reachable.
    const stripped = JSON.parse(serializeWorld(w)) as { world: WorldState };
    stripped.world.map.strongholds = stripped.world.map.strongholds.filter((f) => f.kind !== "corolla" && f.kind !== "vault");
    delete (stripped.world as { gauntlet?: unknown }).gauntlet;
    const back = deserializeWorld(JSON.stringify(stripped));
    const grown = back.map.strongholds.filter((f) => f.kind === "corolla" || f.kind === "vault");
    expect(grown).toHaveLength(2);
    for (const d of grown) expect(findPath(back.map, back.map.start, d.at)).not.toBeNull();
    expect(back.gauntlet).toEqual({});
  });

  it("the Corolla's door: four seals stop you and say so; five open it (the walk stops both ways — entering is a choice)", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const door = w.map.strongholds.find((f) => f.kind === "corolla")!;
    const arrive = (): { seals: number; open: boolean } | undefined => {
      w.player.position = { ...w.map.start };
      for (let leg = 0; leg < 8; leg++) {
        const ev = walkTo(w, catalog, door.at, QUIET);
        if (!ev) return undefined;
        const hit = ev.find((e) => e.type === "corollaDoor");
        if (hit && hit.type === "corollaDoor") return { seals: hit.seals, open: hit.open };
        if (samePoint(w.player.position, door.at)) return undefined;
      }
      return undefined;
    };
    sealAll(w, 4);
    expect(arrive()).toEqual({ seals: 4, open: false });
    expect(corollaDoor(w)).toMatchObject({ seals: 4, open: false, opened: false });
    sealAll(w, 5);
    expect(arrive()).toEqual({ seals: 5, open: true });
    expect(corollaDoor(w).open).toBe(true);
  });

  it("the Vault's door: four Moxen lock it, five open it; cleared, it is plain ground (no stop)", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const door = w.map.strongholds.find((f) => f.kind === "vault")!;
    const arrive = (): { moxen: number; open: boolean } | "ground" => {
      w.player.position = { ...w.map.start };
      for (let leg = 0; leg < 8; leg++) {
        const ev = walkTo(w, catalog, door.at, QUIET);
        if (!ev) return "ground";
        const hit = ev.find((e) => e.type === "vaultDoor");
        if (hit && hit.type === "vaultDoor") return { moxen: hit.moxen, open: hit.open };
        if (samePoint(w.player.position, door.at)) return "ground";
      }
      return "ground";
    };
    holdMoxen(w, 4);
    expect(arrive()).toEqual({ moxen: 4, open: false });
    holdMoxen(w, 5);
    expect(arrive()).toEqual({ moxen: 5, open: true });
    expect(vaultDoor(w)).toMatchObject({ moxen: 5, open: true, cleared: false });
    w.gauntlet.vault = "cleared";
    expect(arrive()).toBe("ground");
  });

  it("inside: entry counts an attempt and marks the door opened; walking stops at an unfallen tip and at the heart; no outer clock ticks; walk out and return keeps the wounds", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    sealAll(w);
    const g = generateCorolla(defaultKnobs().corollaGridSize);
    const map = corollaAsWorldMap(g, catalog.corolla!, {}, new Set());
    const stepsBefore = w.player.stepsTaken;
    enterCorolla(w, g);
    expect(w.gauntlet.opened).toBe(true);
    expect(w.gauntlet.attempts).toBe(1);
    expect(insideCorolla(w)?.position).toEqual(g.entry);
    const tip = g.petals.find((p) => p.color === "B")!.tip;
    const path = corollaPath(map, g.entry, tip)!;
    const ev = corollaAdvance(w, g, path);
    expect(ev[ev.length - 1]).toEqual({ type: "petal", color: "B" });
    expect(insideCorolla(w)?.position).toEqual(tip);
    expect(w.player.stepsTaken).toBe(stepsBefore); // the outer clock froze
    // Fell it; the tip is ground now — the walk passes over it to the heart.
    w.gauntlet.petals = { B: true };
    const back = corollaPath(map, tip, g.town)!;
    const ev2 = corollaAdvance(w, g, back);
    expect(ev2.some((e) => e.type === "petal")).toBe(false);
    expect(ev2[ev2.length - 1]).toEqual({ type: "heart" });
    expect(heartDoor(w)).toEqual({ fallen: 1, total: 5, open: false });
    leaveCorolla(w);
    expect(insideCorolla(w)).toBeNull();
    expect(petalsFallen(w)).toEqual(["B"]);
    enterCorolla(w, g);
    expect(w.gauntlet.attempts).toBe(2);
    expect(petalsFallen(w)).toEqual(["B"]); // the flower keeps its wounds
    expect(corollaAsWorldMap(g, catalog.corolla!, {}, new Set(petalsFallen(w))).strongholds.find((f) => f.region === PETAL_ORDER.indexOf("B"))?.opponentId).toBe("fallen");
  });

  it("a petal fight: the boss's still-pair deck under the chamber's RETURNED law (partisan, boss side), life 30, ante as the world's, your world life; a win pays the signature + both duals + the purse and withholds prizeOnly ante; a loss costs stake + a life and you stay", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    sealAll(w);
    const g = generateCorolla(41);
    enterCorolla(w, g);
    const knobs = defaultKnobs();
    const def = catalog.corolla!;
    const petal = def.petals.find((p) => p.color === "B")!; // the Tithe petal hosts Lumen (WR)
    const boss = COROLLA_DECKS[petal.boss.key]!;
    const { spec, enemyLife, lawName } = petalDuelSpec(w, catalog, knobs, def, petal, { name: boss.name, decklist: boss.decklist, archetype: boss.archetype }, new WorldRng(7));
    expect(lawName).toBe("The Tithe");
    expect(enemyLife).toBe(30);
    expect(spec.players[1].agent).toBe("heuristic:master");
    expect(spec.players[1].decklist).toEqual(boss.decklist);
    expect(spec.rules.ante).toBe(knobs.anteCount);
    expect(spec.rules.startingLife).toBe(w.player.worldLife);
    expect(spec.modifiers).toContainEqual({ type: "permanentOnBattlefield", player: 1, cardId: "law_tithe" });
    expect(spec.modifiers).toContainEqual({ type: "startingLife", player: 1, value: 30 });
    // Win: the drop (sole-mechanism), the pair's duals, the purse; the boss's staked signature is withheld.
    const gold = w.player.gold, life = w.player.worldLife;
    const out = applyPetalDuel(w, knobs, pool, petal, fakeResult(0, [["forest"], ["lightning_bolt", "lumen_the_hearth_fire"]]));
    expect(out.type).toBe("win");
    if (out.type !== "win") return;
    expect(out.paidCards).toEqual(["lumen_the_hearth_fire", "plateau", "sacred_foundry"]);
    expect(out.anteWon).toEqual(["lightning_bolt"]);
    expect(out.anteWithheld).toEqual(["lumen_the_hearth_fire"]);
    expect(w.player.collection["lumen_the_hearth_fire"]).toBe(1); // exactly one — the drop, never the ante
    expect(w.player.collection["plateau"]).toBe(1);
    expect(w.player.gold).toBe(gold + knobs.petalGoldPrize);
    expect(w.player.worldLife).toBe(life);
    expect(petalsFallen(w)).toEqual(["B"]);
    expect(w.duels).toHaveLength(0); // no record passed → nothing recorded (callers pass one)
    // Loss at another petal: stake forfeited, a world life, still inside, petal unfallen.
    const petalR = def.petals.find((p) => p.color === "R")!;
    const deck = activeDeck(w);
    const staked = deck.find((e) => !e.cardId.endsWith("forest") && e.cardId !== "forest")!.cardId;
    const before = w.player.collection[staked] ?? 0;
    const lost = applyPetalDuel(w, knobs, pool, petalR, fakeResult(1, [[staked], []]));
    expect(lost.type).toBe("loss");
    expect(w.player.worldLife).toBe(life - knobs.lossLifePenalty);
    expect((w.player.collection[staked] ?? 0)).toBe(before - 1);
    expect(petalsFallen(w)).toEqual(["B"]);
    expect(insideCorolla(w)).not.toBeNull();
  });

  it("the Mirror: the reflection is your deck byte-for-byte plus the Black Lotus, ante off both ways, at your FULL life, master profile; the posture derives from the deck; the Lotus pays out and nothing else crosses; the Vault is ground after", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    holdMoxen(w);
    w.player.collection["the_sower"] = 1; // a sole-mechanism card in the deck must copy without leaking
    w.decks[w.activeDeckName] = [...activeDeck(w).filter((e) => e.cardId !== "forest"), { cardId: "forest", count: activeDeck(w).find((e) => e.cardId === "forest")!.count - 1 }, { cardId: "the_sower", count: 1 }];
    w.player.worldLife = maxWorldLife(w) - 3;
    const knobs = defaultKnobs();
    const { spec, archetype, enemyLife } = mirrorDuelSpec(w, knobs, pool, new WorldRng(3));
    const mine = activeDeck(w);
    expect(spec.players[0].decklist).toEqual(mine);
    expect(spec.players[1].decklist).toEqual([...mine, { cardId: "black_lotus", count: 1 }]);
    expect(spec.players[1].decklist.some((e) => e.cardId === "the_sower")).toBe(true);
    expect(spec.rules.ante).toBe(0);
    expect(spec.players[1].agent).toBe("heuristic:master");
    expect(enemyLife).toBe(maxWorldLife(w));
    expect(spec.modifiers).toContainEqual({ type: "startingLife", player: 1, value: maxWorldLife(w) });
    expect(["aggro", "midrange", "control"]).toContain(archetype);
    expect(deriveArchetype([{ cardId: "grizzly_bears", count: 20 }, { cardId: "forest", count: 20 }], pool)).toBe("aggro");
    expect(deriveArchetype([{ cardId: "counterspell", count: 12 }, { cardId: "divination", count: 4 }, { cardId: "air_elemental", count: 4 }, { cardId: "island", count: 20 }], pool)).toBe("control");
    // Loss: a world life, no stake, the Vault still locked-open.
    const life = w.player.worldLife;
    expect(applyMirrorDuel(w, knobs, fakeResult(1)).type).toBe("loss");
    expect(w.player.worldLife).toBe(life - knobs.lossLifePenalty);
    expect(vaultDoor(w).cleared).toBe(false);
    // Win: the Lotus, once; the reflection's copies (the Sower included) never reach the collection.
    const sower = w.player.collection["the_sower"];
    const out = applyMirrorDuel(w, knobs, fakeResult(0));
    expect(out).toEqual({ type: "win", paidCards: ["black_lotus"] });
    expect(w.player.collection["black_lotus"]).toBe(1);
    expect(w.player.collection["the_sower"]).toBe(sower);
    expect(vaultDoor(w).cleared).toBe(true);
  });

  it("the town at the heart: the R-drawer shelf (every R card, never prizeOnly, ×corollaShopMultiplier, one copy, depletion persists); the inn heals to full for free; the Heart's door reads N of five", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const knobs = defaultKnobs();
    const stock = rollCorollaStock(w, pool, knobs);
    expect(stock.length).toBeGreaterThan(5);
    for (const s of stock) {
      const d = pool.get(s.cardId)!;
      expect(d.shopTier).toBe("R");
      expect(d.prizeOnly).toBeFalsy();
      expect(s.stock).toBe(1);
    }
    expect(stock.some((s) => s.cardId === "demonic_tutor")).toBe(true);
    expect(stock.some((s) => s.cardId === "black_lotus")).toBe(false);
    const tutor = stock.find((s) => s.cardId === "demonic_tutor")!;
    expect(tutor.price).toBe(Math.round(Math.max(1, Math.round(tutor.price / knobs.corollaShopMultiplier)) * knobs.corollaShopMultiplier)); // ×4 of the shop price
    w.shops[COROLLA_TOWN_INDEX]!.sold["demonic_tutor"] = 1;
    expect(rollCorollaStock(w, pool, knobs).find((s) => s.cardId === "demonic_tutor")!.remaining).toBe(0);
    w.player.worldLife = 3;
    expect(corollaInnRest(w)).toBe(maxWorldLife(w) - 3);
    expect(w.player.worldLife).toBe(maxWorldLife(w));
    w.gauntlet.petals = { W: true, B: true, R: true };
    expect(heartDoor(w)).toEqual({ fallen: 3, total: 5, open: false });
    w.gauntlet.petals = { W: true, B: true, R: true, U: true, G: true };
    expect(heartDoor(w).open).toBe(true);
  });

  it("save: the gauntlet fields round-trip inside v7 (no format bump) — mid-flower position, fallen petals, the Vault's state", () => {
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    sealAll(w);
    enterCorolla(w, generateCorolla(41));
    w.gauntlet.petals = { B: true };
    w.gauntlet.vault = "cleared";
    const text = serializeWorld(w);
    expect(text).toContain('"world-save-v7"');
    const back = deserializeWorld(text);
    expect(back.gauntlet).toEqual(w.gauntlet);
    expect(insideCorolla(back)?.position).toEqual(generateCorolla(41).entry);
    expect(serializeWorld(back)).toBe(text);
  });
});

describe("S26 r3 — the world notes (sieges, spawns, roamer pace)", () => {
  it("siege parties vary: wild-ring rolls across epochs produce ones, twos and threes; the epoch lean pushes toward threes; the ring cap holds", async () => {
    const { rollPartySize } = await import("./siege.js");
    const knobs = defaultKnobs();
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (let i = 0; i < 300; i++) counts[rollPartySize(new WorldRng(i), knobs, "wild", 3, 0)]! += 1;
    expect(counts[1]).toBeGreaterThan(40);
    expect(counts[2]).toBeGreaterThan(60);
    expect(counts[3]).toBeGreaterThan(40);
    let late = 0;
    for (let i = 0; i < 300; i++) if (rollPartySize(new WorldRng(i), knobs, "wild", 3, 6) === 3) late += 1;
    expect(late).toBeGreaterThan(counts[3]!); // six epochs in, threes are more common
    for (let i = 0; i < 50; i++) expect(rollPartySize(new WorldRng(i), knobs, "civilized", 1, 9)).toBe(1); // the cap
    for (let i = 0; i < 50; i++) expect(rollPartySize(new WorldRng(i), knobs, "approach", 2, 0)).toBeLessThanOrEqual(2);
  });

  it("a sealed colour spawns nothing: respawn skips its regions entirely (S22's mage fallback retired)", async () => {
    const { respawnRoamers } = await import("./journey.js");
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const knobs = { ...defaultKnobs(), roamerRespawnSteps: { civilized: 1, approach: 1, wild: 1 } };
    for (const o of w.opponents) if (!o.fixedAt) o.gone = true; // empty the world so every region wants a roamer
    strongholdState(w, "B").seal = true;
    w.player.stepsTaken = 1;
    const spawned = respawnRoamers(w, catalog, knobs, new WorldRng(1));
    expect(spawned.length).toBeGreaterThan(0);
    for (const s of spawned) expect(w.map.regions[s.region]!.color).not.toBe("B");
  });

  it("roamers rest every Nth movement: the counter runs per movement and the rule skips the Nth (N=4 → a quarter of movements; N=0 → never)", async () => {
    const { roamerRests, tickRoamers } = await import("./journey.js");
    expect(Array.from({ length: 40 }, (_, k) => roamerRests(k + 1, 4)).filter(Boolean)).toHaveLength(10);
    expect(Array.from({ length: 40 }, (_, k) => roamerRests(k + 1, 0)).filter(Boolean)).toHaveLength(0);
    expect(roamerRests(4, 4)).toBe(true);
    expect(roamerRests(5, 4)).toBe(false);
    const w = newWorld({ seed: 26, catalog, starter: "green" });
    const roamer = w.opponents.find((o) => !o.fixedAt && o.at)!;
    const knobs = { ...defaultKnobs(), roamerSpeed: { 1: 1, 2: 1, 3: 1 } as never, roamerStepsPerPlayerStep: { road: 1, open: 1 } };
    for (let i = 0; i < 12; i++) tickRoamers(w, catalog, knobs, new WorldRng(100 + i));
    expect(roamer.moves).toBe(12); // one movement per tick at speed 1, rests included in the count
  });
});

describe("S27 — the Heart, the chronicle, the legacy (ADR-093)", () => {
  const heartText = (c: string) => catalog.questText!.heart!.chronicle[c]!;
  it("the Heart's spec: the Manafleur's sixty under the master profile at heartLife (flat by difficulty), the entrance in hand, ZERO ante, the default law sequence; the door opens at five petals only", async () => {
    const { HEART_DECK } = await import("@shandalar/sim/heart-deck");
    const { heartDuelSpec } = await import("./corolla.js");
    const w = newWorld({ seed: 27, catalog, starter: "green" });
    const knobs = defaultKnobs();
    expect(catalog.corolla!.heart!.boss.cardId).toBe("the_manafleur");
    expect(HEART_DECK.decklist.reduce((n, e) => n + e.count, 0)).toBe(60);
    for (const e of HEART_DECK.decklist) expect(pool.has(e.cardId), e.cardId).toBe(true);
    const { spec, enemyLife } = heartDuelSpec(w, catalog, knobs, catalog.corolla!, { name: HEART_DECK.name, decklist: HEART_DECK.decklist, archetype: HEART_DECK.archetype }, new WorldRng(3));
    expect(enemyLife).toBe(35);
    expect(spec.rules.ante).toBe(0);
    expect(spec.players[1].agent).toBe("heuristic:master");
    expect(spec.modifiers).toContainEqual({ type: "signatureToHand", player: 1, cardId: "the_manafleur" });
    expect(spec.modifiers).toContainEqual({ type: "lawSequence" });
    expect(spec.modifiers).toContainEqual({ type: "startingLife", player: 1, value: 35 });
    expect(defaultKnobs().heartLife).toBe(35);
    w.gauntlet.petals = { W: true, B: true, R: true, U: true };
    expect(heartDoor(w).open).toBe(false);
    w.gauntlet.petals = { W: true, B: true, R: true, U: true, G: true };
    expect(heartDoor(w).open).toBe(true);
  });

  it("victory writes the chronicle (the run's starting road, the running count) and drops the card once; a loss costs a life and the run stays; the never-stakes rule holds the Heart deck legal", async () => {
    const { applyHeartDuel, startingColor } = await import("./corolla.js");
    const w = newWorld({ seed: 27, catalog, starter: "red" });
    const knobs = defaultKnobs();
    expect(startingColor(w, catalog)).toBe("R");
    const life = w.player.worldLife;
    expect(applyHeartDuel(w, catalog, knobs, fakeResult(1), { cuttingsSoFar: 0, text: heartText }).type).toBe("loss");
    expect(w.player.worldLife).toBe(life - knobs.lossLifePenalty);
    expect(w.gauntlet.completed).toBeUndefined();
    const out = applyHeartDuel(w, catalog, knobs, fakeResult(0), { cuttingsSoFar: 2, text: heartText });
    expect(out.type).toBe("win");
    if (out.type !== "win") return;
    expect(out.paidCards).toEqual(["the_manafleur"]);
    expect(out.entry.n).toBe(3);
    expect(out.entry.color).toBe("R");
    expect(out.entry.text).toContain("Cut from the red road");
    expect(w.gauntlet.completed).toBe(true);
    expect(w.gauntlet.chronicle).toHaveLength(1);
    expect(w.player.collection["the_manafleur"]).toBe(1);
    // A second folding in the same run: the card is not duplicated; the ledger grows.
    const again = applyHeartDuel(w, catalog, knobs, fakeResult(0), { cuttingsSoFar: 3, text: heartText });
    expect(again.type === "win" && again.paidCards).toEqual([]);
    expect(w.player.collection["the_manafleur"]).toBe(1);
    expect(w.gauntlet.chronicle).toHaveLength(2);
  });

  it("the legacy: recording a cutting; carryover at a new road (power, guardian card + site pre-cleared, minister, gold); never duplicates; a held minister's petal pays gold in lieu; migration hygiene", async () => {
    const { applyLegacy, applyPetalDuel, cutColors, emptyLegacy, legacyCarry, migrateLegacy, recordCutting } = await import("./corolla.js");
    const knobs = defaultKnobs();
    let legacy = emptyLegacy();
    legacy = recordCutting(legacy, { n: 1, color: "R", text: heartText("R"), seed: 1, difficulty: "standard", steps: 100, when: "2026-09-02" });
    legacy = recordCutting(legacy, { n: 2, color: "R", text: heartText("R"), seed: 2, difficulty: "standard", steps: 100, when: "2026-09-02" });
    expect(legacy.victories).toBe(2);
    expect(cutColors(legacy)).toEqual(["R"]);
    expect(legacyCarry(catalog, "R")).toEqual({ power: "R", guardianCard: "drakuseth_maw_of_flames", powerSiteId: "power_r", minister: "clio_lady_of_the_depths" });
    const w = newWorld({ seed: 27, catalog, starter: "green" });
    const gold = w.player.gold;
    const applied = applyLegacy(w, catalog, legacy, knobs);
    expect(applied.colors).toEqual(["R"]);
    expect(applied.cards.sort()).toEqual(["clio_lady_of_the_depths", "drakuseth_maw_of_flames"]);
    expect(applied.gold).toBe(knobs.legacyGoldPerCutting * 2);
    expect(w.player.gold).toBe(gold + knobs.legacyGoldPerCutting * 2);
    expect(w.powers.unlocked).toEqual(["R"]);
    expect(w.dungeons["power_r"]?.cleared).toBe(true);
    expect(w.player.collection["clio_lady_of_the_depths"]).toBe(1);
    // Idempotent: applying again never duplicates the cards.
    applyLegacy(w, catalog, legacy, knobs);
    expect(w.player.collection["clio_lady_of_the_depths"]).toBe(1);
    expect(w.player.collection["drakuseth_maw_of_flames"]).toBe(1);
    // The Toll petal (R, Clio) with Clio held: the drop is withheld, the purse doubles, the duals still come.
    w.gauntlet.petals = {};
    const petal = catalog.corolla!.petals.find((p) => p.color === "R")!;
    const out = applyPetalDuel(w, knobs, pool, petal, fakeResult(0));
    expect(out.type === "win" && out.ministerWithheld).toBe(true);
    expect(out.type === "win" && out.paidCards).toEqual(["underground_sea", "watery_grave"]);
    expect(out.type === "win" && out.paidGold).toBe(knobs.petalGoldPrize * 2);
    expect(w.player.collection["clio_lady_of_the_depths"]).toBe(1);
    // Migration hygiene: garbage and wrong versions read as empty; a good shape round-trips.
    expect(migrateLegacy(null)).toEqual(emptyLegacy());
    expect(migrateLegacy({ version: 2, cuttings: { W: 9 } })).toEqual(emptyLegacy());
    expect(migrateLegacy(JSON.parse(JSON.stringify(legacy)))).toEqual(legacy);
  });

  it("the text packs: the Corolla's and the Heart's lines load from quests.json with every key the screens read", () => {
    const t = catalog.questText!;
    expect(t.corolla?.doorOpen).toContain("The petals part");
    expect(Object.keys(t.corolla!.petals).sort()).toEqual(["B", "G", "R", "U", "W"]);
    expect(t.heart?.telegraph).toContain("It has a name");
    expect(Object.keys(t.heart!.chronicle).sort()).toEqual(["B", "G", "R", "U", "W"]);
    expect(t.heart?.newRoad).toContain("{colour}");
  });
});
