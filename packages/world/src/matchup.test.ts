import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Agent } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";
import { loadCatalog } from "./loader.js";
import { DIFFICULTIES, resolveKnobs, type DifficultyName } from "./knobs.js";
import { entranceFor, resolveMatchup } from "./matchup.js";
import { newWorld, worldKnobs } from "./state.js";
import { prepareDuel, type Encounter } from "./journey.js";
import { enemyDeck } from "./catalog.js";
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

  it("the entrance comes in the mage's PIP order and repeats for a mono mage: Corvane (BW) two basics = swamp, plains; Oriel one = plains; Kessa (UR by colours, R first by pips) = mountain", () => {
    expect(entranceFor("mage:corvane", 2)).toEqual(["swamp", "plains"]);
    expect(entranceFor("mage:corvane", 3)).toEqual(["swamp", "plains", "swamp"]);
    expect(entranceFor("mage:oriel", 2)).toEqual(["plains", "plains"]);
    expect(entranceFor("mage:kessa", 1)).toEqual(["mountain"]);
    expect(entranceFor("mage:kessa", 0)).toEqual([]);
    expect(entranceFor("beast:serra", 2)).toEqual([]);
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
          const replayed = await replayGame(pool.cards, [duel.spec.players[0].decklist.flatMap((e) => Array(e.count).fill(e.cardId)), enemyDeck(catalog, o.deck).decklist.flatMap((e) => Array(e.count).fill(e.cardId))], r.log, { ...duel.spec.rules, ante: duel.spec.rules.ante ?? 0 }, duel.spec.modifiers);
          expect(replayed, `${mode} ${o.id}`).toBe(r.finalStateSerialized);
        }
        games += 1;
      }
    }
    expect(games).toBe(45);
  }, 120_000);
});
