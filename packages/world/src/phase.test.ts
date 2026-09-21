import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { catalogFrom } from "./catalog.js";
import { DIFFICULTIES, KNOBS, defaultKnobs, resolveKnobs, tierTablesFor } from "./knobs.js";
import { resolveMatchup } from "./matchup.js";
import { deserializeWorld, newWorld, serializeWorld, type WorldState } from "./state.js";
import { advance, parley, type Encounter } from "./journey.js";
import { regionAt, type Point } from "./map.js";
import { heartDuelSpec, heartLawsPersist, HEART_ROOTS } from "./corolla.js";
import { WorldRng } from "./rng.js";
import { renderEnemiesReference } from "./reference-docs.js";
import type { OpponentInstance } from "./generate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const dungeonsJson = () => JSON.parse(readFileSync(join(ROOT, "data/world/dungeons.json"), "utf8")) as { strongholds: { id: string; deckRule?: unknown }[]; corolla: { petals: { color: string; deckRule?: unknown }[] } };
const parts = (dungeons: unknown) => ({
  regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames },
  opponents: { catalogVersion: "v1", opponents: catalog.opponents }, starters: { catalogVersion: "v1", starters: catalog.starters }, dungeons,
  quests: JSON.parse(readFileSync(join(ROOT, "data/world/quests.json"), "utf8")),
});

/** A forced encounter on the next passable cell (world.test's helper, reduced). */
function firstEncounter(w: WorldState): Encounter {
  const s = w.player.position;
  const cell = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }].find((p: Point) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[p.y * w.map.width + p.x] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y))!;
  const inst = w.opponents.find((o: OpponentInstance) => !o.gone && !o.fixedAt && o.at)!;
  inst.at = { ...cell }; inst.region = regionAt(w.map, cell).index;
  const enc = advance(w, catalog, [cell]).find((e) => e.type === "encounter");
  if (enc && enc.type === "encounter") return enc.encounter;
  throw new Error("no encounter");
}

describe("S38 Part 1 — the resolver's phase column", () => {
  it("tierTablesFor: phase 1 is the three knobs; phase 2 the column; phase 3 falls back to 2 until authored; the bundles carry their own column", () => {
    const std = defaultKnobs();
    expect(tierTablesFor(std, 1)).toEqual({ mageTierLife: std.mageTierLife, mageTierEntrance: std.mageTierEntrance, beastTierLifeDelta: std.beastTierLifeDelta });
    expect(tierTablesFor(std, 2)).toEqual({ mageTierLife: { 1: 12, 2: 16, 3: 20 }, mageTierEntrance: { 1: 1, 2: 1, 3: 3 }, beastTierLifeDelta: { 1: 4, 2: 8, 3: 12 } }); // S42a: tier 2 cooled to 16 / 1
    expect(tierTablesFor(std, 3)).toEqual(tierTablesFor(std, 2));
    expect(KNOBS.phaseTierTables.default[3]).toBeUndefined();
    const easy = resolveKnobs({ difficulty: DIFFICULTIES.easy }), hard = resolveKnobs({ difficulty: DIFFICULTIES.hard });
    expect(tierTablesFor(easy, 2).mageTierLife).toEqual({ 1: 12, 2: 16, 3: 18 });
    expect(tierTablesFor(hard, 2).mageTierLife).toEqual({ 1: 12, 2: 18, 3: 24 });
    expect(tierTablesFor(easy, 1).mageTierLife).toEqual({ 1: 8, 2: 12, 3: 14 }); // phase one untouched by the column
    // A knob layer without the column falls back to the defaults' column (whole-value merge per key).
    expect(tierTablesFor(resolveKnobs({ event: { anteCount: 3 } }), 2)).toEqual(tierTablesFor(std, 2));
  });
  it("resolveMatchup at phase 2: one mage per tier reads the column (plus its row offset); a beast adds the phase-two delta; phase 1 is unchanged", () => {
    const std = defaultKnobs();
    for (const t of [1, 2, 3] as const) {
      const row = catalog.opponents.find((o) => (o.kind ?? "mage") === "mage" && !o.spoke && o.tier === t)!;
      const p2 = resolveMatchup(row, std, null, 2), p1 = resolveMatchup(row, std, null, 1), p0 = resolveMatchup(row, std);
      expect(p2.life).toBe({ 1: 12, 2: 16, 3: 20 }[t] + (row.worldLifeOffset ?? 0));
      expect(p2.entrance).toHaveLength({ 1: 1, 2: 1, 3: 3 }[t]); // S42a
      expect(p1).toEqual(p0);
      expect(p1.life).toBe({ 1: 8, 2: 12, 3: 16 }[t] + (row.worldLifeOffset ?? 0));
    }
    const beast = catalog.opponents.find((o) => o.kind === "beast" && o.tier === 3)!;
    expect(resolveMatchup(beast, std, null, 2).life).toBe(beast.worldLife + 12 + (beast.worldLifeOffset ?? 0));
    expect(resolveMatchup(beast, std, null, 2).entrance).toEqual([]);
  });
  it("a world's phase: newWorld defaults to 1 (and takes 2); a prepared duel at phase 2 carries the column's life and entrance", () => {
    expect(newWorld({ seed: 38, catalog, starter: "red" }).phase).toBe(1);
    const w = newWorld({ seed: 38, catalog, starter: "red", phase: 2 });
    expect(w.phase).toBe(2);
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "fight");
    expect(out.type).toBe("fight");
    if (out.type !== "fight") return;
    const tmpl = catalog.opponents.find((o) => o.id === w.opponents.find((x) => x.id === enc.opponentId)!.catalogId)!;
    const cell = resolveMatchup(tmpl, resolveKnobs({ difficulty: DIFFICULTIES.standard }), null, 2);
    expect(out.duel.spec.modifiers[0]).toEqual({ type: "startingLife", player: 1, value: cell.life + (enc.contact === "lair" ? 0 : 0) });
    expect(out.duel.enemy.entrance).toEqual(cell.entrance);
  });
  it("the save: a pre-S38 v7 save reads phase 1; phase 2 round-trips; the format is unchanged", () => {
    const w = newWorld({ seed: 39, catalog, starter: "blue" });
    const raw = JSON.parse(serializeWorld(w)) as { format: string; world: Partial<WorldState> };
    expect(raw.format).toBe("world-save-v7");
    delete raw.world.phase;
    expect(deserializeWorld(JSON.stringify(raw)).phase).toBe(1);
    w.phase = 2;
    expect(deserializeWorld(serializeWorld(w)).phase).toBe(2);
  });
});

describe("S38 Part 3 — heartLawsPersist", () => {
  it("the knob is false by default; a phase-two world persists regardless; heartDuelSpec's lawSequence carries `accumulate` only then (the S27 spec pin stays exact at phase 1)", () => {
    const std = defaultKnobs();
    expect(KNOBS.heartLawsPersist.default).toBe(false);
    expect(heartLawsPersist({ phase: 1 }, std)).toBe(false);
    expect(heartLawsPersist({ phase: 2 }, std)).toBe(true);
    expect(heartLawsPersist({ phase: 1 }, { heartLawsPersist: true })).toBe(true);
    const def = catalog.corolla!;
    const enemy = { name: "The Manafleur", decklist: [{ cardId: "plains", count: 60 }], archetype: "midrange" as const };
    const w1 = newWorld({ seed: 40, catalog, starter: "green" });
    const s1 = heartDuelSpec(w1, catalog, std, def, enemy, new WorldRng(1));
    expect(s1.spec.modifiers).toContainEqual({ type: "lawSequence" });
    expect(s1.spec.modifiers.some((m) => m.type === "lawSequence" && "mode" in m)).toBe(false);
    const w2 = newWorld({ seed: 40, catalog, starter: "green", phase: 2 });
    const s2 = heartDuelSpec(w2, catalog, std, def, enemy, new WorldRng(1));
    expect(s2.spec.modifiers).toContainEqual({ type: "lawSequence", mode: "accumulate" });
    const s3 = heartDuelSpec(w1, catalog, { ...std, heartLawsPersist: true }, def, enemy, new WorldRng(1));
    expect(s3.spec.modifiers).toContainEqual({ type: "lawSequence", mode: "accumulate" });
    expect(HEART_ROOTS).toHaveLength(5);
  });
});

describe("S38 Part 2 — deckRule on the sites", () => {
  it("a stronghold's and a petal's deckRule are validated field by field; enemies.md renders them; the shipped sites carry none", () => {
    const dj = dungeonsJson();
    dj.strongholds[0]!.deckRule = { colorsWithin: ["W", "U", "R"], label: "the Jeskai gate" };
    dj.corolla.petals[1]!.deckRule = { minCreatures: 15, label: "the Intake's court" };
    const cat = catalogFrom(parts(dj));
    expect(cat.strongholdContent![0]!.deckRule?.label).toBe("the Jeskai gate");
    expect(cat.corolla!.petals[1]!.deckRule?.label).toBe("the Intake's court");
    const text = renderEnemiesReference(cat, pool, defaultKnobs());
    expect(text).toContain("door: the Jeskai gate (colours within WUR)");
    expect(text).toContain("door: the Intake's court (≥ 15 creatures)");
    const bad = dungeonsJson();
    bad.strongholds[0]!.deckRule = { colorsWithin: ["X"] };
    expect(() => catalogFrom(parts(bad))).toThrow(/stronghold argent_bastion: deckRule\.label/);
    const badPetal = dungeonsJson();
    badPetal.corolla.petals[0]!.deckRule = { label: "x", bogus: 1 };
    expect(() => catalogFrom(parts(badPetal))).toThrow(/corolla petal W: unknown deckRule field "bogus"/);
    expect((catalog.strongholdContent ?? []).filter((s) => s.deckRule)).toHaveLength(0);
    expect(catalog.corolla!.petals.filter((p) => p.deckRule)).toHaveLength(0);
    // The shipped enemies.md carries the phase-two column and no door.
    const shipped = renderEnemiesReference(catalog, pool, defaultKnobs());
    expect(shipped).toContain("Phase two: life / entrance (standard)");
    expect(shipped.match(/door: /g)).toHaveLength(10); // S41: the flood's ten seats — the only shipped doors; phase one's sites carry none
  });
});
