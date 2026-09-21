import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Agent } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";
import { loadCatalog } from "./loader.js";
import { DIFFICULTIES, resolveKnobs, tierTablesFor, type DifficultyName } from "./knobs.js";
import { entranceFor, resolveMatchup } from "./matchup.js";
import { newWorld, worldKnobs } from "./state.js";
import { prepareDuel, renownAgainst, type Encounter } from "./journey.js";
import { enemyDeck, opponentColors, parleyLines } from "./catalog.js";
import type { OpponentInstance } from "./generate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards"));
const catalog = loadCatalog(join(ROOT, "data/world"));
const MODES: DifficultyName[] = ["easy", "standard", "hard"];

/** S34 (ADR-115/116/117): the matchup resolver — the tier tables at each mode, the entrance in pip order,
 * the wiring through prepareDuel, the replay, the catalog's documentation rows. */
describe("S34 — the matchup resolver", () => {
  it("the tier tables per mode: mages read life + entrance from the bundles, beasts their row + the tier delta (+ the Serra's offset); tier 1 is 8 / none everywhere", () => {
    const want: Record<DifficultyName, { life: [number, number, number]; basics: [number, number, number]; beast: [number, number, number] }> = {
      easy: { life: [8, 12, 14], basics: [0, 0, 1], beast: [0, 0, 2] },
      standard: { life: [8, 12, 16], basics: [0, 1, 2], beast: [0, 2, 4] },
      hard: { life: [8, 14, 20], basics: [0, 2, 2], beast: [0, 4, 8] },
    };
    for (const mode of MODES) {
      const knobs = resolveKnobs({ difficulty: DIFFICULTIES[mode] });
      for (const t of [1, 2, 3] as const) {
        const mage = catalog.opponents.find((o) => (o.kind ?? "mage") === "mage" && o.tier === t)!;
        const m = resolveMatchup(mage, knobs);
        expect(m.life, `${mode} T${t} mage life`).toBe(want[mode].life[t - 1]!);
        expect(m.entrance.length, `${mode} T${t} mage basics`).toBe(want[mode].basics[t - 1]!);
        expect(m.profile).toBe(mage.difficulty);
        expect(m.ante).toBe(knobs.anteCount);
        const beast = catalog.opponents.find((o) => o.kind === "beast" && o.tier === t && o.deck !== "beast:serra")!;
        const b = resolveMatchup(beast, knobs);
        expect(b.life, `${mode} T${t} beast`).toBe(beast.worldLife + want[mode].beast[t - 1]!);
        expect(b.entrance).toEqual([]);
      }
      const serra = catalog.opponents.find((o) => o.deck === "beast:serra")!;
      expect(resolveMatchup(serra, knobs).life).toBe(serra.worldLife + want[mode].beast[2]! - 4);
    }
  });

  it("the entrance comes in the mage's PIP order and repeats for a mono mage: Corvane (BW) two basics = swamp, plains; Oriel one = plains; Kessa (UR, tied by pips since S36) = island", () => {
    expect(entranceFor("mage:corvane", 2, 1)).toEqual(["swamp", "plains"]);
    expect(entranceFor("mage:corvane", 3, 1)).toEqual(["swamp", "plains", "swamp"]);
    expect(entranceFor("mage:oriel", 2, 1)).toEqual(["plains", "plains"]);
    // S36: Kessa's placement (−1 Shock +1 Collector) tied her pips 13/13 — the colours' order stands, so island.
    expect(entranceFor("mage:kessa", 1, 1)).toEqual(["island"]);
    expect(entranceFor("mage:kessa", 0, 1)).toEqual([]);
    expect(entranceFor("beast:serra", 2, 1)).toEqual([]);
  });

  it("primaryColors is the pip order of the list (sync against the pool), every mage", () => {
    for (const [k, m] of Object.entries(MAGE_DECKS)) {
      const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      for (const e of m.decklist) {
        const cost = pool.cards.get(e.cardId)?.manaCost ?? "";
        for (const c of Object.keys(pips)) pips[c]! += e.count * ((cost.match(new RegExp(`\\{${c}\\}`, "g")) ?? []).length);
      }
      const order = [...m.colors].sort((a, b) => pips[b]! - pips[a]!).join("");
      expect(m.primaryColors, k).toBe(order);
      expect([...m.primaryColors].sort().join(""), k).toBe([...m.colors].sort().join(""));
    }
  });

  it("the catalog's mage rows carry the Standard cell as documentation (regenerated, sync-tested)", () => {
    const std = resolveKnobs({ difficulty: DIFFICULTIES.standard });
    for (const o of catalog.opponents.filter((x) => (x.kind ?? "mage") === "mage")) expect(o.worldLife, o.id).toBe(std.mageTierLife[o.tier]);
  });

  const encounterFor = (w: ReturnType<typeof newWorld>, catalogId: string): Encounter => {
    const inst: OpponentInstance = { id: `mu_${catalogId}`, catalogId, region: 0, gone: false, at: { ...w.player.position }, moveDebt: 0 };
    w.opponents.push(inst);
    const tmpl = catalog.opponents.find((o) => o.id === catalogId)!;
    return { opponentId: inst.id, catalogId, tier: tmpl.tier, region: 0, at: { ...w.player.position }, fleeing: false, contact: "stepped" };
  };

  it("prepareDuel carries the cell at each mode: Corvane (d3) fights at 14/1, 16/2, 20/2 with swamp then plains before the player's manalinks; the parley's enemy record names the entrance", () => {
    const want = { easy: { life: 14, basics: ["swamp"] }, standard: { life: 16, basics: ["swamp", "plains"] }, hard: { life: 20, basics: ["swamp", "plains"] } } as const;
    for (const mode of MODES) {
      const w = newWorld({ catalog, starter: "white", difficulty: mode, seed: 3401 });
      const duel = prepareDuel(w, catalog, encounterFor(w, "d3"), new (class { int() { return 7; } chance() { return true; } })() as never, worldKnobs(w));
      expect(duel.enemy.worldLife, mode).toBe(want[mode].life);
      expect(duel.enemy.entrance, mode).toEqual([...want[mode].basics]);
      expect(duel.spec.modifiers[0]).toEqual({ type: "startingLife", player: 1, value: want[mode].life });
      expect(duel.spec.modifiers.slice(1, 1 + want[mode].basics.length)).toEqual(want[mode].basics.map((cardId) => ({ type: "permanentOnBattlefield", player: 1, cardId })));
      expect(duel.spec.players[1].agent).toBe("heuristic:master");
      expect(duel.spec.rules.ante).toBe(worldKnobs(w).anteCount);
    }
  });

  it("fuzz: every mage at every mode through prepareDuel (random pilots), zero exceptions, the replay byte-exact (the entrance path live)", async () => {
    const { WorldRng } = await import("./rng.js");
    let games = 0;
    for (const mode of MODES) {
      const w = newWorld({ catalog, starter: "black", difficulty: mode, seed: 3402 });
      for (const o of catalog.opponents.filter((x) => (x.kind ?? "mage") === "mage")) {
        const duel = prepareDuel(w, catalog, encounterFor(w, o.id), new WorldRng(games + 11), worldKnobs(w));
        const agents: [Agent, Agent] = [new RandomAgent(games * 2 + 1), new RandomAgent(games * 2 + 2)];
        const r = await runMatch(duel.spec, pool.cards, agents);
        expect(r.reason).toBeTruthy();
        if (games % 5 === 0) {
          const replayed = await replayGame(pool.cards, [duel.spec.players[0].decklist.flatMap((e) => Array(e.count).fill(e.cardId)), enemyDeck(catalog, o.deck, w.phase).decklist.flatMap((e) => Array(e.count).fill(e.cardId))], r.log, { ...duel.spec.rules, ante: duel.spec.rules.ante ?? 0 }, duel.spec.modifiers);
          expect(replayed, `${mode} ${o.id}`).toBe(r.finalStateSerialized);
        }
        games += 1;
      }
    }
    expect(games).toBe(45);
  }, 120_000);
});

// ---------- S42b: the mage inversion through the world ----------
describe("S42b — the mage inversion: a phase-two world fields the flood lists", () => {
  const encounterFor2 = (w: ReturnType<typeof newWorld>, catalogId: string): Encounter => {
    const inst: OpponentInstance = { id: `inv_${catalogId}`, catalogId, region: 0, gone: false, at: { ...w.player.position }, moveDebt: 0 };
    w.opponents.push(inst);
    const tmpl = catalog.opponents.find((o) => o.id === catalogId)!;
    return { opponentId: inst.id, catalogId, tier: tmpl.tier, region: 0, at: { ...w.player.position }, fleeing: false, contact: "stepped" };
  };
  const rng = () => new (class { int() { return 7; } chance() { return true; } })() as never;
  const has = (d: { cardId: string }[], id: string) => d.some((e) => e.cardId === id);

  it("Corvane (d3): phase one reanimates angels behind swamp + plains; phase two reanimates wurms behind swamp + forest + swamp — same name, tier, profile and life column", () => {
    const w1 = newWorld({ catalog, starter: "white", seed: 4201 });
    const d1 = prepareDuel(w1, catalog, encounterFor2(w1, "d3"), rng(), worldKnobs(w1));
    expect(has(d1.spec.players[1].decklist, "serra_angel")).toBe(true);
    expect(d1.enemy.entrance).toEqual(["swamp", "plains"]);
    const w2 = newWorld({ catalog, starter: "white", seed: 4201, phase: 2 });
    const d2 = prepareDuel(w2, catalog, encounterFor2(w2, "d3"), rng(), worldKnobs(w2));
    expect(has(d2.spec.players[1].decklist, "pelakka_wurm")).toBe(true);
    expect(has(d2.spec.players[1].decklist, "serra_angel")).toBe(false);
    expect(d2.spec.players[1].decklist.reduce((n, e) => n + e.count, 0)).toBe(40);
    expect(d2.enemy.entrance).toEqual(["swamp", "forest", "swamp"]); // the phase-two column: three basics, the flood list's pip order
    expect(d2.enemy.worldLife).toBe(tierTablesFor(worldKnobs(w2), 2).mageTierLife[3]);
    expect([d2.enemy.name, d2.enemy.tier, d2.enemy.difficulty, d2.enemy.deck]).toEqual(["Lord Corvane", 3, "master", "mage:corvane"]);
  });

  it("tier 1 is untouched by the phase: Sister Oriel plays the same forty in the flood", () => {
    const w2 = newWorld({ catalog, starter: "black", seed: 4202, phase: 2 });
    const d = prepareDuel(w2, catalog, encounterFor2(w2, "b1"), rng(), worldKnobs(w2));
    expect(d.spec.players[1].decklist).toEqual(enemyDeck(catalog, "mage:oriel", 1).decklist);
  });

  it("the catalog's ten rows carry the pair (kept colour first) and a parley line for the flood; the readers switch on the phase", () => {
    const rows = catalog.opponents.filter((o) => o.colorsPhaseTwo);
    expect(rows.map((o) => `${o.name.split(" ").pop()}:${o.colors}>${o.colorsPhaseTwo}`).sort()).toEqual(
      ["Corvane:WB>BG", "Emberhand:UR>UB", "Flamebrand:UR>UB", "Glade:WG>GR", "Maelin:BR>BG", "Quill:UG>GR", "Shallows:UG>UW", "Sorrel:BR>RW", "Vael:WB>WR", "Ysolde:WG>WU"]);
    for (const o of rows) {
      expect(o.tier).toBeGreaterThan(1);
      expect(opponentColors(o, 1)).toBe(o.colors);
      expect(opponentColors(o, 2)).toBe(o.colorsPhaseTwo);
      expect(parleyLines(o, 1)).toEqual([]);
      expect(parleyLines(o, 2)).toHaveLength(1);
      expect(parleyLines(o, 2)[0]).toMatch(/chang/i);
    }
    expect(new Set(rows.map((o) => parleyLines(o, 2)[0])).size).toBe(10); // ten voices, one sense
  });

  it("renown is felt — and paid — in the colours worn now: Vael (WB → WR) fears red renown only in the flood", () => {
    const vael = catalog.opponents.find((o) => o.id === "d2")!;
    const w = newWorld({ catalog, starter: "green", seed: 4203, phase: 2 });
    w.player.renownByColor.R = 9; w.player.renownByColor.B = 0; w.player.renownByColor.W = 0;
    expect(renownAgainst(w.player, vael, 2)).toBe(9);
    expect(renownAgainst(w.player, vael, 1)).toBe(0);
  });

  it("fuzz: the ten inverted mages through a phase-two world's prepareDuel at every mode (random pilots), zero exceptions, a replay byte-exact", async () => {
    const { WorldRng } = await import("./rng.js");
    let games = 0;
    for (const mode of MODES) {
      const w = newWorld({ catalog, starter: "blue", difficulty: mode, seed: 4204, phase: 2 });
      for (const o of catalog.opponents.filter((x) => x.colorsPhaseTwo)) {
        const duel = prepareDuel(w, catalog, encounterFor2(w, o.id), new WorldRng(games + 5), worldKnobs(w));
        const r = await runMatch(duel.spec, pool.cards, [new RandomAgent(games * 2 + 1), new RandomAgent(games * 2 + 2)]);
        expect(r.reason).toBeTruthy();
        if (games % 7 === 0) {
          const replayed = await replayGame(pool.cards, [duel.spec.players[0].decklist.flatMap((e) => Array(e.count).fill(e.cardId)), enemyDeck(catalog, o.deck, 2).decklist.flatMap((e) => Array(e.count).fill(e.cardId))], r.log, { ...duel.spec.rules, ante: duel.spec.rules.ante ?? 0 }, duel.spec.modifiers);
          expect(replayed).toBe(r.finalStateSerialized);
        }
        games += 1;
      }
    }
    expect(games).toBe(30);
  }, 120_000);
});
