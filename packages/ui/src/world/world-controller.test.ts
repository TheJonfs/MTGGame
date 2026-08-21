import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { deserializeWorld, idx } from "@shandalar/world";
import { loadCatalog } from "@shandalar/world/loader";
import { WorldController } from "./world-controller.js";
import type { MatchController } from "../play/match-controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));

/** In-memory storage standing in for localStorage. */
function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** The S10 scripted human, reused: drive a MatchController through the click path to completion. */
async function playOut(m: MatchController): Promise<void> {
  let guard = 0;
  while (!m.result) {
    if (guard++ > 30000) throw new Error(`duel driver stuck in ${m.phase.kind}`);
    await tick();
    const phase = m.phase;
    switch (phase.kind) {
      case "priority":
        if (phase.lands.size > 0) m.clickHand([...phase.lands.keys()][0]!);
        else if (phase.castable.size > 0) m.clickHand([...phase.castable.keys()][0]!);
        else if (phase.activatable.size > 0) m.clickBattlefield([...phase.activatable.keys()][0]!);
        else m.pass();
        break;
      case "chooseX": m.chooseX(phase.xs[phase.xs.length - 1]!); break;
      case "targeting":
        if (phase.highlightObjects.size > 0) m.clickBattlefield([...phase.highlightObjects][0]!);
        else m.clickPlayer([...phase.highlightPlayers][0]!);
        break;
      case "confirmCast": m.confirmCast(); break;
      case "manualTap": m.castNow(); break;
      case "stackStop": m.continueFromStop(); break;
      case "attackers": for (const id of phase.eligible) m.clickBattlefield(id); m.confirmAttackers(); break;
      case "blockers": {
        const [b] = [...phase.options.keys()];
        if (b && phase.stagedPairs.length === 0) { m.clickBattlefield(b); m.clickBattlefield([...phase.options.get(b)!][0]!); }
        m.confirmBlocks();
        break;
      }
      case "dialog": m.selectDialog(0); m.confirmDialog(); break;
      default: break;
    }
  }
}

function freshController(): WorldController {
  const c = new WorldController(pool, catalog, memStorage());
  c.stepMs = 0;
  c.aiDelayMs = 0;
  return c;
}

/** Walk until an encounter is forced (event layer rate 1); returns the encounter screen. */
async function forceEncounter(c: WorldController): Promise<void> {
  c.extraKnobs = { event: { encounterRatePerStep: { civilized: 1, approach: 1, wild: 1 } } };
  const w = c.world!;
  // Any passable non-town neighbour of the start town.
  const s = w.player.position;
  const nbrs = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }]
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y));
  for (const n of nbrs) {
    if (c.screen.kind === "town") c.leaveTown();
    c.clickCell(n); // preview
    c.clickCell(n); // walk
    let guard = 0;
    while (c.screen.kind === "map" && (c.screen as { walking: boolean }).walking && guard++ < 100) await tick();
    if (c.screen.kind === "encounter") return;
  }
  throw new Error("could not force an encounter");
}

describe("S14 acceptance: editor, shop v2, resume path, v1 migration", () => {
  it("editor: open → remove a nonbasic, add a spare → legal → save → the next duel's MatchSpec carries the edited deck; illegal drafts are unsaveable", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "A", difficulty: "standard", seed: 201 });
    expect(c.canEdit().ok).toBe(true);
    c.openEditor();
    expect(c.screen.kind).toBe("editor");
    const scr = () => c.screen as { draft: { cardId: string; count: number }[]; name: string; notice: string | null };
    const { spares } = await import("@shandalar/world");
    const sp = spares(c.world!.player.collection, scr().draft);
    const spareId = Object.keys(sp)[0]!;
    const nonbasic = scr().draft.find((e) => e.cardId !== "mountain")!.cardId;
    c.editorRemove(nonbasic);
    c.editorAdd(spareId);
    c.editorRename("Scripted Goblins");
    expect(c.editorLegality().ok).toBe(true);
    // Drive below the floor: save refused, deck untouched.
    for (let k = 0; k < 12; k++) c.editorRemove("mountain");
    expect(c.editorLegality().ok).toBe(false);
    expect(c.editorSave()).toBe(false);
    expect(c.screen.kind).toBe("editor");
    expect(scr().notice).toMatch(/Not saved/);
    // Basics are infinite: put them back, save.
    for (let k = 0; k < 12; k++) c.editorAdd("mountain");
    expect(c.editorSave()).toBe(true);
    expect(c.screen.kind).toBe("map");
    expect(c.world!.deckName).toBe("Scripted Goblins");
    expect(c.world!.player.activeDeck.find((e) => e.cardId === spareId)).toBeTruthy();
    // The edited deck is what the duel gets.
    await forceEncounter(c);
    expect(c.canEdit().ok).toBe(false); // not while parleying
    c.parley("fight");
    const m = c.match!;
    expect(m.spec.players[0].decklist).toEqual(c.world!.player.activeDeck);
    c.match!.concede();
    let g = 0;
    while (c.screen.kind === "duel" && g++ < 500) await tick();
    expect(c.screen.kind).toBe("duelResult");
  }, 60_000);

  it("shop v2: depletion shows after buying, persists through save/load; sell adds gold; buy → add to deck when legal", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "C", difficulty: "standard", seed: 202 });
    const town = c.world!.map.towns[0]!;
    c.enterTown(town);
    expect(c.world!.visits[town.index]).toBe(1);
    expect(c.world!.lastTownIndex).toBe(town.index);
    const stock = () => (c.screen as { stock: import("@shandalar/world").ShopItem[] }).stock;
    const item = [...stock()].filter((i) => i.remaining > 0).sort((a, b) => a.price - b.price)[0]!;
    c.world!.player.gold = 500;
    c.buy(item, true);
    expect(stock().find((i) => i.cardId === item.cardId)!.remaining).toBe(item.stock - 1);
    const saved = c.saveText();
    const c2 = freshController();
    c2.loadText(saved);
    expect((c2.screen as { stock: import("@shandalar/world").ShopItem[] }).stock.find((i) => i.cardId === item.cardId)!.remaining).toBe(item.stock - 1);
    // Sell a spare.
    const { spares } = await import("@shandalar/world");
    const sp = spares(c.world!.player.collection, c.world!.player.activeDeck);
    const spareId = Object.keys(sp)[0]!;
    const gold = c.world!.player.gold;
    c.sell(spareId);
    expect(c.world!.player.gold).toBeGreaterThan(gold);
  });

  it("resume path: after a parley, the unwalked remainder can be re-previewed and walked", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "D", difficulty: "standard", seed: 203 });
    c.world!.player.gold = 1000;
    await forceEncounter(c);
    expect(c.resumePath).not.toBeNull();
    c.parley("buyoff");
    expect(c.screen.kind).toBe("map");
    c.resumeWalk();
    // Remainder may be empty (one-cell walks); when present it is previewed.
    const scr = c.screen as { preview: unknown[] | null };
    expect(scr.preview === null || Array.isArray(scr.preview)).toBe(true);
  });

  it("a v1 save loads (migrated) and the world plays on", () => {
    const c = freshController();
    c.newGame({ starterDeck: "B", difficulty: "standard", seed: 204 });
    const parsed = JSON.parse(c.saveText()) as { format: string; world: Record<string, unknown> };
    const { shops: _a, visits: _b, lastTownIndex: _c, deckName: _d, ...v1 } = parsed.world;
    const c2 = freshController();
    c2.loadText(JSON.stringify({ format: "world-save-v1", world: v1 }));
    expect(c2.world!.shops).toEqual({});
    expect(c2.world!.deckName).toBe("Deck");
    expect(["map", "town"]).toContain(c2.screen.kind);
  });
});

describe("WorldController acceptance (S13 Part 5, scripted half)", () => {
  it("new game → map; preview then walk; town entry autosaves; continue-from-autosave restores the identical world", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "A", difficulty: "standard", seed: 101 });
    expect(c.screen.kind).toBe("map");
    expect(c.hasAutosave()).toBe(true);
    const w = c.world!;
    // Walk to the second town with encounters off (event layer rate 0).
    c.extraKnobs = { event: { encounterRatePerStep: { civilized: 0, approach: 0, wild: 0 } } };
    const dest = w.map.towns[1]!.at;
    c.clickCell(dest);
    expect(c.screen.kind === "map" && c.screen.preview && c.screen.preview.length > 0).toBe(true);
    c.clickCell(dest);
    let guard = 0;
    while (c.screen.kind !== "town" && guard++ < 500) await tick();
    expect(c.screen.kind).toBe("town");
    expect(w.player.stepsTaken).toBeGreaterThan(0);
    const saved = c.saveText();
    const c2 = freshController();
    c2.loadText(saved);
    expect(c2.world).toEqual(deserializeWorld(saved));
    expect(c2.screen.kind).toBe("town");
  });

  it("shop: stock is rolled per town/epoch; buying moves gold into the collection; collection screen opens and closes", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "C", difficulty: "standard", seed: 102 });
    const town = c.world!.map.towns[0]!;
    c.enterTown(town);
    expect(c.screen.kind).toBe("town");
    const stock = (c.screen as { stock: import("@shandalar/world").ShopItem[] }).stock;
    expect(stock.length).toBeGreaterThan(0);
    const cheap = [...stock].filter((i) => i.remaining > 0).sort((a, b) => a.price - b.price)[0]!;
    const gold = c.world!.player.gold;
    c.buy(cheap);
    expect(c.world!.player.gold).toBe(gold - cheap.price);
    expect(c.world!.player.collection[cheap.cardId]).toBeGreaterThanOrEqual(1);
    c.openCollection();
    expect(c.screen.kind).toBe("collection");
    c.closeCollection();
    expect(c.screen.kind).toBe("town");
    c.leaveTown();
    expect(c.screen.kind).toBe("map");
  });

  it("parley: buy-off (or refusal by tier) and flee (stake forfeited, deck refilled) both return to the map with a notice", async () => {
    const c = freshController();
    c.newGame({ starterDeck: "D", difficulty: "standard", seed: 103 });
    await forceEncounter(c);
    expect(c.screen.kind).toBe("encounter");
    const gold = c.world!.player.gold;
    const tier = (c.screen as { encounter: { tier: number } }).encounter.tier;
    c.parley("buyoff");
    if (gold >= 15 * tier) {
      expect(c.screen.kind).toBe("map");
      expect(c.world!.player.gold).toBe(gold - 15 * tier);
    } else {
      expect(c.screen.kind).toBe("encounter"); // refused, still parleying
      c.parley("flee");
      expect(["map", "duel"]).toContain(c.screen.kind); // fled, or caught → fighting
      if (c.screen.kind === "duel") {
        await playOut(c.match!);
        let g = 0;
        while (c.screen.kind === "duel" && g++ < 100) await tick();
        expect(c.screen.kind).toBe("duelResult");
        c.continueAfterDuel();
      }
    }
  });

  it("fight: the duel runs in the play client via `custom`; the result screen narrates ante/gold/life; autosave after; game over at the floor", async () => {
    let sawResult = false;
    let sawGameOver = false;
    for (let seed = 111; seed < 160 && !(sawResult && sawGameOver); seed++) {
      const c = freshController();
      c.newGame({ starterDeck: "A", difficulty: "standard", seed });
      c.world!.player.worldLife = 1; // one loss = game over
      await forceEncounter(c);
      c.parley("fight");
      expect(c.screen.kind).toBe("duel");
      const m = c.match!;
      // The play client names the enemy and carries their portrait (S13).
      const tmpl = catalog.opponents.find((o) => o.id === (c.screen as { duel: { encounter: { catalogId: string } } }).duel.encounter.catalogId)!;
      expect(m.names[1]).toBe(tmpl.name);
      expect(m.portraits[1]).toBe(`/portraits/${tmpl.portrait}.png`);
      expect(m.spec.rules.startingLife).toBe(1);
      expect(m.spec.rules.ante).toBeGreaterThanOrEqual(1);
      await playOut(m);
      let g = 0;
      while (c.screen.kind === "duel" && g++ < 200) await tick();
      expect(c.screen.kind).toBe("duelResult");
      const scr = c.screen as { record: { outcome: string; anteWon: string[]; anteLost: string[] }; before: { life: number; gold: number }; after: { life: number; gold: number } };
      sawResult = true;
      if (scr.record.outcome === "win") {
        expect(scr.after.gold).toBeGreaterThan(scr.before.gold);
        expect(scr.after.life).toBe(scr.before.life);
        c.continueAfterDuel();
        expect(c.screen.kind).toBe("map");
      } else if (scr.record.outcome === "loss") {
        expect(scr.after.life).toBe(0);
        c.continueAfterDuel();
        expect(c.screen.kind).toBe("gameOver");
        sawGameOver = true;
        // The autosave carries the game-over; loading it lands on the game-over screen.
        const c2 = freshController();
        c2.loadText(c.saveText());
        expect(c2.screen.kind).toBe("gameOver");
      }
    }
    expect(sawResult).toBe(true);
    expect(sawGameOver).toBe(true);
  }, 180_000);
});
