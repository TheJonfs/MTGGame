import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { deserializeWorld, strongholdState, MOX_IDS, PETAL_ORDER, corollaPath, insideCorolla, petalsFallen } from "@shandalar/world";
import { loadCatalog } from "@shandalar/world/loader";
import { WorldController } from "./world-controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const fakeResult = (winner: 0 | 1, ante: [string[], string[]] = [[], []]) =>
  ({ winner, reason: "LIFE" as const, turns: 9, finalLife: (winner === 0 ? [6, 0] : [0, 6]) as [number, number], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante }, log: [], finalStateSerialized: "" });

/**
 * S26 Part 5 (scripted acceptance): the Corolla generates and renders (as a map); five seals open its
 * door and not four; a petal fight under its law with the signature dropping; the town's doors with
 * the Heart locked at N<5; the Mirror end to end with the Lotus paying out; the save round-trips
 * through the gauntlet fields. The duels themselves are engine/sim territory — the ceremonies and
 * the flows are the controller's (the stronghold acceptance's pattern).
 */
describe("S26 — the Corolla and the Vault through the controller", () => {
  it("the door: four seals telegraph locked (no entry); five open it; inside, the flower renders, a tip telegraphs, the fight carries the returned law, the signature drops, the petal stays fallen; the heart's town reads N of five; leave and return; the save resumes inside", async () => {
    const c = new WorldController(pool, catalog, memStorage());
    c.stepMs = 0;
    c.newGame({ seed: 26, starter: "green", difficulty: "standard" });
    const w = c.world!;
    const door = w.map.strongholds.find((f) => f.kind === "corolla")!;
    for (const col of PETAL_ORDER.slice(0, 4)) strongholdState(w, col).seal = true;
    // Knock with four seals: the telegraph says locked; entering is refused.
    w.player.position = { ...door.at };
    c.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    const screen = () => (c as WorldController).screen; // tsc cannot see the method mutations
    expect(c.doorHere()).toBe("corolla");
    c.knock();
    expect(screen().kind).toBe("corollaTelegraph");
    const s1 = screen();
    expect(s1.kind === "corollaTelegraph" && s1.open).toBe(false);
    const s2 = screen();
    expect(s2.kind === "corollaTelegraph" && s2.seals).toBe(4);
    c.enterCorolla();
    expect(screen().kind).toBe("corollaTelegraph"); // refused
    c.declineCorolla();
    // The fifth seal.
    strongholdState(w, PETAL_ORDER[4]!).seal = true;
    c.knock();
    const s3 = screen();
    expect(s3.kind === "corollaTelegraph" && s3.open).toBe(true);
    c.enterCorolla();
    expect(screen().kind).toBe("corolla");
    expect(w.gauntlet.opened).toBe(true);
    expect(w.gauntlet.attempts).toBe(1);
    const map = c.corollaMap()!;
    expect(map.width).toBe(c.knobs.corollaGridSize);
    expect(map.strongholds.filter((f) => f.kind === "petal")).toHaveLength(5);
    expect(c.petalRows().map((r) => r.lawName)).toEqual(["The Intake", "The Tithe", "The Toll", "The Risen Tide", "The Season"]);
    // Walk to the Tithe petal's tip (Lumen, WR): the telegraph opens.
    const tithe = c.petalRows().find((r) => r.color === "B")!;
    const path = corollaPath(map, insideCorolla(w)!.position, tithe.tip)!;
    expect(path.length).toBeGreaterThan(10);
    c.corollaClick(tithe.tip);
    for (let i = 0; i < 200 && screen().kind === "corolla"; i++) await new Promise((r) => setTimeout(r, 0));
    expect(screen().kind).toBe("petalTelegraph");
    const tele = screen();
    expect(tele.kind === "petalTelegraph" && tele.color).toBe("B");
    const stepsBefore = w.player.stepsTaken;
    // Fight: the spec carries the returned law on the boss's side and Lumen's deck.
    c.fightPetal();
    const duelScreen = screen();
    expect(duelScreen.kind).toBe("corollaDuel");
    if (duelScreen.kind !== "corollaDuel") return;
    expect(duelScreen.enemyName).toBe("Lumen, the Hearth Fire");
    const rec = { seed: 1, spec: { seed: 1, players: [{ name: "you", decklist: [], agent: "human" }, { name: "Lumen, the Hearth Fire", decklist: [], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100, ante: 1 }, modifiers: [] }, enemyName: "Lumen, the Hearth Fire" };
    (c as never as { finishPetalDuel(color: string, r: ReturnType<typeof fakeResult>, rec: unknown): void }).finishPetalDuel("B", fakeResult(0, [["forest"], ["shock", "lumen_the_hearth_fire"]]), rec);
    expect(screen().kind).toBe("petalVictory");
    expect(w.player.collection["lumen_the_hearth_fire"]).toBe(1); // the drop, once — the staked copy withheld
    expect(w.player.collection["plateau"]).toBe(1);
    expect(w.player.collection["sacred_foundry"]).toBe(1);
    expect(w.player.collection["shock"]).toBeGreaterThanOrEqual(1);
    expect(petalsFallen(w)).toEqual(["B"]);
    expect(w.player.stepsTaken).toBe(stepsBefore); // no clock ran
    expect(w.duels[w.duels.length - 1]?.enemyName).toBe("Lumen, the Hearth Fire"); // Recent Battles sees it
    c.continueAfterPetalVictory();
    expect(screen().kind).toBe("corolla");
    // The fallen tip is ground: clicking it opens nothing.
    c.corollaClick(tithe.tip);
    expect(screen().kind).toBe("corolla");
    // The heart: the town, the R shelf, the door at 1 of 5.
    c.corollaClick(c.corollaGeometry().town);
    for (let i = 0; i < 200 && screen().kind === "corolla"; i++) await new Promise((r) => setTimeout(r, 0));
    expect(screen().kind).toBe("corollaTown");
    const town = screen();
    if (town.kind !== "corollaTown") return;
    expect(town.stock.every((s) => pool.get(s.cardId)?.shopTier === "R")).toBe(true);
    const item = town.stock.find((s) => s.cardId === "demonic_tutor")!;
    w.player.gold = item.price;
    c.corollaBuy(item);
    expect(w.player.collection["demonic_tutor"]).toBe(1);
    expect(w.player.gold).toBe(0);
    expect(screen().kind === "corollaTown" && (screen() as { stock: { cardId: string; remaining: number }[] }).stock.find((s) => s.cardId === "demonic_tutor")?.remaining).toBe(0);
    w.player.worldLife = 5;
    c.corollaRest();
    expect(w.player.worldLife).toBeGreaterThan(5);
    expect(w.player.stepsTaken).toBe(stepsBefore); // free — no clock
    c.leaveHeartTown();
    expect(screen().kind).toBe("corolla");
    // Save round-trip mid-flower: reload resumes inside, wounds kept.
    const back = deserializeWorld(c.saveText());
    expect(insideCorolla(back)).not.toBeNull();
    expect(petalsFallen(back)).toEqual(["B"]);
    const c2 = new WorldController(pool, catalog, memStorage());
    c2.loadText(c.saveText());
    expect(c2.screen.kind).toBe("corolla");
    // Leave: back at the door on the outer map; the flower keeps its wound.
    c.leaveCorolla();
    expect(screen().kind).toBe("map");
    expect(w.player.position).toEqual(door.at);
    expect(insideCorolla(w)).toBeNull();
    expect(petalsFallen(w)).toEqual(["B"]);
    c.knock();
    c.enterCorolla();
    expect(w.gauntlet.attempts).toBe(2);
    expect(c.petalRows().find((r) => r.color === "B")?.fallen).toBe(true);
  }, 60_000);

  it("dev menu (S26 r1): completing the fifteen sites grants the Moxen, the powers, the lord cards and the seals — both centre doors read open; idempotent", () => {
    const c = new WorldController(pool, catalog, memStorage());
    c.newGame({ seed: 26, starter: "green", difficulty: "standard" });
    const w = c.world!;
    expect(c.devDungeonRows()).toHaveLength(15);
    expect(c.devCompleteAll("mox")).toBe(5);
    expect(MOX_IDS.every((id) => w.player.collection[id] === 1)).toBe(true);
    expect(w.player.collection["the_pearl_cleric"]).toBe(1);
    expect(c.devCompleteAll()).toBe(10);
    expect(c.devCompleteAll()).toBe(0);
    expect(c.devDungeonRows().every((r) => r.cleared)).toBe(true);
    expect(w.player.collection["the_warden"]).toBe(1);
    expect(w.player.collection["reya_dawnbringer"]).toBe(1);
    expect(w.powers.unlocked).toHaveLength(5);
    const door = w.map.strongholds.find((f) => f.kind === "corolla")!;
    w.player.position = { ...door.at };
    c.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    c.knock();
    const s1 = (c as WorldController).screen;
    expect(s1.kind === "corollaTelegraph" && s1.open && s1.seals).toBe(5);
    c.declineCorolla();
    const vault = w.map.strongholds.find((f) => f.kind === "vault")!;
    w.player.position = { ...vault.at };
    c.knock();
    const s2 = (c as WorldController).screen;
    expect(s2.kind === "vaultTelegraph" && s2.open && s2.moxen).toBe(5);
  });

  it("the Vault: four Moxen lock it; five open the Mirror (your deck + the Lotus, ante off); a loss keeps the door; a win pays the Lotus once and the Vault is ground", async () => {
    const c = new WorldController(pool, catalog, memStorage());
    c.stepMs = 0;
    c.newGame({ seed: 26, starter: "green", difficulty: "standard" });
    const w = c.world!;
    const door = w.map.strongholds.find((f) => f.kind === "vault")!;
    for (const id of MOX_IDS.slice(0, 4)) w.player.collection[id] = 1;
    w.player.position = { ...door.at };
    c.screen = { kind: "map", preview: null, previewTarget: null, walking: false, notice: null };
    const screen = () => (c as WorldController).screen; // tsc cannot see the method mutations
    expect(c.doorHere()).toBe("vault");
    c.knock();
    const locked = screen();
    expect(locked.kind === "vaultTelegraph" && locked.open).toBe(false);
    c.enterVault();
    expect(screen().kind).toBe("vaultTelegraph");
    c.declineVault();
    w.player.collection[MOX_IDS[4]!] = 1;
    c.knock();
    const tele = screen();
    expect(tele.kind === "vaultTelegraph" && tele.moxen).toBe(5);
    c.enterVault();
    const duel = screen();
    expect(duel.kind).toBe("corollaDuel");
    if (duel.kind !== "corollaDuel") return;
    expect(duel.against.mirror).toBe(true);
    const finish = (r: ReturnType<typeof fakeResult>) => (c as never as { finishMirrorDuel(r: unknown, rec: unknown): void }).finishMirrorDuel(r, { seed: 1, spec: { seed: 1, players: [{ name: "you", decklist: [], agent: "human" }, { name: "Your reflection", decklist: [], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, ante: 0 }, modifiers: [] } });
    const life = w.player.worldLife;
    finish(fakeResult(1));
    expect(screen().kind).toBe("map");
    expect(w.player.worldLife).toBe(life - c.knobs.lossLifePenalty);
    expect(w.gauntlet.vault).toBeUndefined();
    expect(w.player.collection["black_lotus"]).toBeUndefined();
    c.knock();
    c.enterVault();
    finish(fakeResult(0));
    expect(screen().kind).toBe("mirrorVictory");
    expect(w.player.collection["black_lotus"]).toBe(1);
    expect(w.gauntlet.vault).toBe("cleared");
    c.continueAfterMirrorVictory();
    expect(screen().kind).toBe("map");
    expect(c.doorHere()).toBeNull(); // ground
    const back = deserializeWorld(c.saveText());
    expect(back.gauntlet.vault).toBe("cleared");
  }, 60_000);
});
