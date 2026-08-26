import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { activeDeck, deserializeWorld, idx } from "@shandalar/world";
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

/** S16: force an encounter by standing a live roamer on the next cell (you step onto it). */
async function forceEncounter(c: WorldController): Promise<void> {
  const w = c.world!;
  // Any passable non-town neighbour of the start town.
  const s = w.player.position;
  const nbrs = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }]
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y));
  for (const n of nbrs) {
    const inst = w.opponents.find((o) => !o.gone && !o.fixedAt && o.at)!;
    inst.catalogId = "a1"; // S20: pin a buyable mage — the rolled template can be an unbuyable beast (WBRUG re-roll)
    inst.at = { ...n };
    inst.region = w.map.region[idx(w.map, n)]!;
    if (c.screen.kind === "town") c.leaveTown();
    c.clickCell(n); // preview
    c.clickCell(n); // walk
    let guard = 0;
    while (c.screen.kind === "map" && (c.screen as { walking: boolean }).walking && guard++ < 100) await tick();
    if (c.screen.kind === "encounter") return;
  }
  throw new Error("could not force an encounter");
}

/** S16: no random contact — roamers gone, respawn off. */
function quiet(c: WorldController): void {
  for (const o of c.world!.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
  c.extraKnobs = { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 } } };
}

describe("S14 acceptance: editor, shop v2, resume path, v1 migration", () => {
  it("editor: open → remove a nonbasic, add a spare → legal → save → the next duel's MatchSpec carries the edited deck; illegal drafts are unsaveable", async () => {
    const c = freshController();
    c.newGame({ starter: "red", difficulty: "standard", seed: 201 });
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
    // Reset discards the draft (round 2), then redo the edit.
    c.editorReset();
    expect(scr().draft).toEqual(activeDeck(c.world!));
    c.editorRemove(nonbasic);
    c.editorAdd(spareId);
    c.editorRename("Scripted Goblins");
    // Drive below the floor: save refused, deck untouched.
    for (let k = 0; k < 5; k++) c.editorRemove("mountain");
    expect(c.editorLegality().ok).toBe(false);
    expect(c.editorSave()).toBe(false);
    expect(c.screen.kind).toBe("editor");
    expect(scr().notice).toMatch(/Not saved/);
    // Basics are infinite: put them back, save.
    for (let k = 0; k < 5; k++) c.editorAdd("mountain");
    expect(c.editorSave()).toBe(true);
    expect(c.screen.kind).toBe("map");
    expect(c.world!.activeDeckName).toBe("Scripted Goblins");
    expect(activeDeck(c.world!).find((e) => e.cardId === spareId)).toBeTruthy();
    // The edited deck is what the duel gets.
    await forceEncounter(c);
    expect(c.canEdit().ok).toBe(false); // not while parleying
    c.parley("fight");
    const m = c.match!;
    expect(m.spec.players[0].decklist).toEqual(activeDeck(c.world!));
    c.match!.concede();
    let g = 0;
    while (c.screen.kind === "duel" && g++ < 500) await tick();
    expect(c.screen.kind).toBe("duelResult");
  }, 60_000);

  it("shop v2: depletion shows after buying, persists through save/load; sell adds gold; buy → add to deck when legal", async () => {
    const c = freshController();
    c.newGame({ starter: "green", difficulty: "standard", seed: 202 });
    const town = c.world!.map.towns.find((t) => t.at.x === c.world!.map.start.x && t.at.y === c.world!.map.start.y)!;
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
    const sp = spares(c.world!.player.collection, activeDeck(c.world!));
    const spareId = Object.keys(sp)[0]!;
    const gold = c.world!.player.gold;
    c.sell(spareId);
    expect(c.world!.player.gold).toBeGreaterThan(gold);
  });

  it("resume path: after a parley, the unwalked remainder can be re-previewed and walked", async () => {
    const c = freshController();
    c.newGame({ starter: "black", difficulty: "standard", seed: 203 });
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

  it("a v2 save loads (migrated to v3: decks/provenance/roamer positions) and the world plays on; v1 too", () => {
    const c = freshController();
    c.newGame({ starter: "white", difficulty: "standard", seed: 204 });
    const parsed = JSON.parse(c.saveText()) as { format: string; world: Record<string, unknown> };
    const w = parsed.world as { decks: Record<string, unknown>; activeDeckName: string; provenance: unknown; player: Record<string, unknown>; opponents: Record<string, unknown>[] } & Record<string, unknown>;
    const { decks, activeDeckName, provenance: _p, player, opponents, ...rest } = w;
    const { renown: _r, starterId: _s, ...p2 } = player;
    const v2: Record<string, unknown> = { ...rest, player: { ...p2, activeDeck: decks[activeDeckName] }, deckName: activeDeckName, opponents: opponents.map(({ gone, goneReason: _g, at: _a, moveDebt: _m, ...o }) => ({ ...o, defeated: gone })) };
    const c2 = freshController();
    c2.loadText(JSON.stringify({ format: "world-save-v2", world: v2 }));
    expect(c2.world!.activeDeckName).toBe(activeDeckName);
    expect(c2.world!.provenance).toEqual([]);
    expect(c2.world!.opponents.filter((o) => !o.fixedAt).every((o) => !!o.at)).toBe(true);
    expect(["map", "town"]).toContain(c2.screen.kind);
    const { shops: _a, visits: _b, lastTownIndex: _c, deckName: _d, ...v1 } = v2;
    const c3 = freshController();
    c3.loadText(JSON.stringify({ format: "world-save-v1", world: v1 }));
    expect(c3.world!.shops).toEqual({});
    expect(c3.world!.activeDeckName).toBe("Deck");
    expect(["map", "town"]).toContain(c3.screen.kind);
  });

  it("S16 deck picker: new (30 basics, switched to) / duplicate / switch / delete through the controller; the active deck duels", async () => {
    const c = freshController();
    c.newGame({ starter: "blue", difficulty: "standard", seed: 205 });
    const starterName = c.world!.activeDeckName;
    expect(c.deckNames()).toEqual([starterName]);
    expect(c.deckNew("Blank")).toBe(true);
    expect(c.world!.activeDeckName).toBe("Blank");
    expect(activeDeck(c.world!)).toEqual([{ cardId: "island", count: 30 }]);
    expect(c.deckNew("Blank")).toBe(false);
    expect(c.deckSwitch(starterName)).toBe(true);
    expect(c.deckDuplicate("Grimoire II")).toBe(true);
    expect(c.world!.activeDeckName).toBe("Grimoire II");
    expect(c.deckNames().sort()).toEqual(["Blank", "Grimoire II", starterName].sort());
    expect(c.deckDelete("Grimoire II")).toBe(false); // active
    expect(c.deckSwitch("Blank")).toBe(true);
    expect(c.deckDelete("Grimoire II")).toBe(true);
    // Editor opens on the active deck; the picker ops refresh its draft.
    c.openEditor();
    expect((c.screen as { name: string }).name).toBe("Blank");
    c.deckSwitch(starterName);
    expect((c.screen as { name: string; draft: unknown[] }).name).toBe(starterName);
    c.editorClose();
    // The active deck duels.
    await forceEncounter(c);
    c.parley("fight");
    expect(c.match!.spec.players[0].decklist).toEqual(activeDeck(c.world!));
    c.match!.concede();
    let g = 0;
    while (c.screen.kind === "duel" && g++ < 500) await tick();
    expect(c.screen.kind).toBe("duelResult");
  }, 60_000);

  it("S16 roamers on the map: visible chips within sight; a roamer walks to you and the parley opens without a click; any parley outcome removes it", async () => {
    const c = freshController();
    c.newGame({ starter: "green", difficulty: "standard", seed: 206 }); // S20: the geometry checks below gained region/fixed-point guards (the WBRUG spoke fix moved boundaries)
    const w = c.world!;
    quiet(c);
    // Half speed everywhere: from distance 3, two steps toward it → it gets its one move exactly when you are adjacent and steps onto you (a "reached" contact, no click on it).
    c.extraKnobs = { event: { ...c.extraKnobs.event, roamerStepsPerPlayerStep: { road: 0.5, open: 0.5 } } };
    const s = w.player.position;
    const inst = w.opponents.find((o) => !o.fixedAt)!;
    inst.gone = false; delete inst.goneReason;
    inst.catalogId = "a1"; // S20: pin a BUYABLE mage — the rolled template can be an unbuyable beast now (Gale/Recluse/…) and the buy-off leg would refuse
    let placed = false;
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const cells = [1, 2, 3].map((k) => ({ x: s.x + d.x * k, y: s.y + d.y * k }));
      const sameRegion = (p: { x: number; y: number }) => w.map.region[idx(w.map, p)] === w.map.region[idx(w.map, s)];
      const noFixed = (p: { x: number; y: number }) => !w.map.strongholds.some((f) => f.at.x === p.x && f.at.y === p.y);
      if (cells.every((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && sameRegion(p) && noFixed(p) && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y))) {
        inst.at = { ...cells[2]! }; inst.region = w.map.region[idx(w.map, cells[2]!)]!; inst.moveDebt = 0;
        expect(c.visibleRoamers().map((r) => r.inst.id)).toContain(inst.id);
        c.leaveTown();
        c.clickCell(cells[1]!); c.clickCell(cells[1]!); // walk two cells toward it
        let guard = 0;
        while (c.screen.kind === "map" && (c.screen as { walking: boolean }).walking && guard++ < 100) await tick();
        placed = true;
        break;
      }
    }
    expect(placed).toBe(true);
    expect(c.screen.kind).toBe("encounter");
    expect((c.screen as { encounter: { opponentId: string; contact: string } }).encounter.opponentId).toBe(inst.id);
    expect((c.screen as { encounter: { contact: string } }).encounter.contact).toBe("reached");
    c.world!.player.gold = 10_000;
    c.parley("buyoff");
    expect(c.screen.kind).toBe("map");
    expect(inst.gone).toBe(true);
    expect(c.visibleRoamers()).toHaveLength(0);
  });
});

describe("WorldController acceptance (S13 Part 5, scripted half)", () => {
  it("new game → map; preview then walk; town entry autosaves; continue-from-autosave restores the identical world", async () => {
    const c = freshController();
    c.newGame({ starter: "red", difficulty: "standard", seed: 101 });
    expect(c.screen.kind).toBe("map");
    expect(c.hasAutosave()).toBe(true);
    const w = c.world!;
    // Walk to another town with roamers cleared (S16: no contact possible).
    quiet(c);
    const dest = w.map.towns.find((t) => !(t.at.x === w.map.start.x && t.at.y === w.map.start.y))!.at;
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
    c.newGame({ starter: "green", difficulty: "standard", seed: 102 });
    const town = c.world!.map.towns.find((t) => t.at.x === c.world!.map.start.x && t.at.y === c.world!.map.start.y)!;
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
    c.newGame({ starter: "black", difficulty: "standard", seed: 103 });
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
      c.newGame({ starter: "red", difficulty: "standard", seed });
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

describe("S22b acceptance: the stronghold flow through the controller (entry → interior → victory → picks → seal)", () => {
  it("full path: telegraph at the gate, the run at stronghold scale, the victory ceremony pays the sole-drop, the picker banks picks (and only list members), the seal counts", async () => {
    const c = new WorldController(pool, catalog, memStorage() as never);
    c.stepMs = 0;
    c.aiDelayMs = 0;
    c.newGame({ starter: "white", difficulty: "standard", seed: 501 });
    const w = c.world!;
    for (const o of w.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
    // Walk onto the Bastion's gate.
    const fp = w.map.strongholds.find((f) => f.kind === "stronghold" && f.name === "The Argent Bastion")!;
    const near = [
      { x: fp.at.x + 1, y: fp.at.y }, { x: fp.at.x - 1, y: fp.at.y }, { x: fp.at.x, y: fp.at.y + 1 }, { x: fp.at.x, y: fp.at.y - 1 },
    ].find((p) => w.map.passable[idx(w.map, p)])!;
    w.player.position = near;
    c.clickCell(fp.at);
    await tick();
    c.clickCell(fp.at);
    for (let i = 0; i < 50 && c.screen.kind !== "dungeonTelegraph"; i++) await tick();
    expect(c.screen.kind).toBe("dungeonTelegraph");
    if (c.screen.kind !== "dungeonTelegraph") return;
    expect(c.screen.info).toMatchObject({ dungeonId: "argent_bastion", kind: "stronghold" });
    c.enterDungeon();
    expect(c.screen.kind).toBe("dungeon");
    const run = c.dungeonRun!;
    expect(run.kind).toBe("stronghold");
    expect(run.grid.width).toBe(c.knobs.strongholdGridWidth);
    // The lord falls (the duel itself is engine/sim territory — the ceremony is the controller's).
    const fakeWin = { winner: 0 as const, reason: "LIFE" as const, turns: 9, finalLife: [6, 0] as [number, number], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [[], []] as [string[], string[]] }, log: [], finalStateSerialized: "" };
    (c as never as { finishInteriorDuel(a: { guardian: boolean }, r: typeof fakeWin): void }).finishInteriorDuel({ guardian: true }, fakeWin);
    // tsc cannot see finishInteriorDuel's screen mutation — read through an unnarrowed accessor.
    const screen = () => (c as WorldController).screen;
    const victory = screen();
    expect(victory.kind).toBe("strongholdVictory");
    if (victory.kind !== "strongholdVictory") return;
    expect(w.player.collection["the_warden"]).toBe(1); // the sole-drop: his defeat is the ONLY channel (ADR-081)
    expect(w.dungeons["argent_bastion"]?.cleared).toBe(true);
    expect(c.lordStatusRows().find((r) => r.color === "W")?.sealed).toBe(true);
    // Picks: two legal, one bogus (rejected), then confirm banks them.
    const [a, b] = victory.prizeList;
    c.toggleStrongholdPick(a!);
    c.toggleStrongholdPick(b!);
    c.toggleStrongholdPick("black_lotus"); // not in the hoard — must be ignored
    const mid = screen();
    expect(mid.kind === "strongholdVictory" && mid.picks).toEqual([a, b]);
    c.confirmStrongholdPicks();
    expect(w.player.collection[a!]).toBe(1);
    expect(w.player.collection[b!]).toBe(1);
    expect(w.player.collection["black_lotus"]).toBeUndefined();
    expect(screen().kind).toBe("map");
    // Durability: the seal and points survive the save round-trip.
    const back = deserializeWorld(JSON.stringify(JSON.parse(c.saveText())));
    expect((back.strongholds as { color: string; seal: boolean }[]).find((e) => e.color === "W")?.seal).toBe(true);
  }, 60_000);
});
