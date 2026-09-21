import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { activeDeck, catalogFrom, commitDeck, deserializeWorld, dungeonPath, empowermentModifiers, floodRun, idx, lordStartingLife, reachedTiers, starterDecklist, starterTemplate } from "@shandalar/world";
import { readFileSync } from "node:fs";
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
/** Deploy playtest r5: a storage with a byte ceiling that throws the browser's quota error. */
function cappedStorage(cap: number) {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { if (v.length > cap) throw new DOMException("exceeded the quota", "QuotaExceededError"); m.set(k, v); }, size: () => [...m.values()].reduce((n, v) => n + v.length, 0) };
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

/** S16: force an encounter by standing a live roamer on the next cell (you step onto it). S37: the template to pin. */
async function forceEncounter(c: WorldController, catalogId = "a1"): Promise<void> {
  const w = c.world!;
  // Any passable non-town neighbour of the start town.
  const s = w.player.position;
  const nbrs = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }]
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y));
  for (const n of nbrs) {
    const inst = w.opponents.find((o) => !o.gone && !o.fixedAt && o.at)!;
    inst.catalogId = catalogId; // S20: pin a buyable mage — the rolled template can be an unbuyable beast (WBRUG re-roll)
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

describe("S37 (ADR-123): the door — a template's deckRule through the editor and the parley (the S10 pattern)", () => {
  /** The catalog with one extra template carrying a rule: the white starter's colours, one more creature than it has. */
  function gatedCatalog(): { cat: typeof catalog; creatures: number } {
    const white = starterDecklist(starterTemplate(catalog, "white"), "standard");
    const creatures = white.reduce((n, e) => n + (pool.get(e.cardId)!.types.includes("Creature") ? e.count : 0), 0);
    const gate = { id: "test_gate", name: "The Test Gate", deck: "mage:brann", tier: 1, difficulty: "apprentice", portrait: "mage-brann", worldLife: 10, colors: "W", deckRule: { colorsWithin: ["W"], minCreatures: creatures + 1, label: "the White Gate" } };
    const cat = catalogFrom(JSON.parse(JSON.stringify({
      regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames },
      opponents: { catalogVersion: "v1", opponents: [...catalog.opponents, gate] }, starters: { catalogVersion: "v1", starters: catalog.starters },
      dungeons: JSON.parse(readFileSync(join(ROOT, "data/world/dungeons.json"), "utf8")),
      quests: JSON.parse(readFileSync(join(ROOT, "data/world/quests.json"), "utf8")),
    })));
    return { cat, creatures };
  }
  it("the editor checks the draft against the door live (never blocking Save); the parley refuses the fight naming the rule; a legal deck enters", async () => {
    const { cat, creatures } = gatedCatalog();
    const c = new WorldController(pool, cat, memStorage());
    c.stepMs = 0;
    c.newGame({ starter: "white", difficulty: "standard", seed: 3701 });
    c.world!.player.collection["serra_angel"] = 1; // a spare white creature to answer the gate with
    // The editor: the door list, the live verdict, Save unaffected.
    c.openEditor();
    expect(c.doorRules()).toEqual([{ id: "test_gate", name: "The Test Gate", label: "the White Gate", description: `colours within W; ≥ ${creatures + 1} creatures` }]);
    expect(c.editorRuleCheck()).toBeNull();
    c.setEditorRule("test_gate");
    const before = c.editorRuleCheck()!;
    expect(before.check.ok).toBe(false);
    expect(before.check.problems).toEqual([`${creatures} creatures; the White Gate asks ${creatures + 1}`]);
    expect(c.editorLegality().ok).toBe(true); // the door never blocks Save
    c.editorAdd("serra_angel");
    c.editorRemove("plains");
    expect(c.editorRuleCheck()!.check.ok).toBe(true);
    c.editorReset(); // back to the starter — the gate is shut again
    expect(c.editorRuleCheck()!.check.ok).toBe(false);
    c.setEditorRule(null);
    expect(c.editorRuleCheck()).toBeNull();
    c.editorClose();
    // The parley: the gate's word is up before any choice; Fight is refused, naming the rule; the roamer stays.
    await forceEncounter(c, "test_gate");
    expect(c.screen.kind).toBe("encounter");
    const refusal = c.doorRefusal();
    expect(refusal).toMatch(/^Bring bodies to the fire\. the White Gate \(colours within W; ≥ \d+ creatures\): \d+ creatures; the White Gate asks \d+\.$/);
    c.parley("fight");
    expect(c.screen.kind).toBe("encounter");
    expect((c.screen as { notice: string | null }).notice).toBe(refusal);
    // A legal deck enters: the Lion for a Plains, committed through the world API (the editor is shut while parleying).
    const draft = activeDeck(c.world!).map((e) => ({ ...e }));
    draft.find((e) => e.cardId === "plains")!.count -= 1;
    draft.push({ cardId: "serra_angel", count: 1 });
    expect(commitDeck(c.world!, draft).ok).toBe(true);
    expect(c.doorRefusal()).toBeNull();
    c.parley("fight");
    expect(c.screen.kind).toBe("duel");
    expect(c.match!.spec.players[0].decklist.find((e) => e.cardId === "serra_angel")?.count).toBe(1);
    c.match!.concede();
    let g = 0;
    while (c.screen.kind === "duel" && g++ < 500) await tick();
    expect(c.screen.kind).toBe("duelResult");
  }, 60_000);
  it("no template in the shipped catalog carries a rule; the editor's door list is empty and every parley fight is unrefused by a door", () => {
    const c = freshController();
    c.newGame({ starter: "red", difficulty: "standard", seed: 3702 });
    expect(c.doorRules()).toEqual([]);
    c.openEditor();
    c.setEditorRule("a1");
    expect(c.editorRuleId).toBeNull(); // a template without a rule is not a door
  });
});

describe("S38 (ADR-125): the door on a SITE — a stronghold's deckRule through the telegraph, the editor round trip, entry with a legal deck", () => {
  it("the gate refuses the descent naming the rule; 'edit your deck' opens the editor on the door and returns to the gate; a legal deck enters", async () => {
    const white = starterDecklist(starterTemplate(catalog, "white"), "standard");
    const creatures = white.reduce((n, e) => n + (pool.get(e.cardId)!.types.includes("Creature") ? e.count : 0), 0);
    const dungeons = JSON.parse(readFileSync(join(ROOT, "data/world/dungeons.json"), "utf8")) as { strongholds: { id: string; deckRule?: unknown }[] };
    dungeons.strongholds.find((s) => s.id === "argent_bastion")!.deckRule = { colorsWithin: ["W"], minCreatures: creatures + 1, label: "the Argent Gate" };
    const cat = catalogFrom(JSON.parse(JSON.stringify({
      regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames },
      opponents: { catalogVersion: "v1", opponents: catalog.opponents }, starters: { catalogVersion: "v1", starters: catalog.starters },
      dungeons, quests: JSON.parse(readFileSync(join(ROOT, "data/world/quests.json"), "utf8")),
    })));
    const c = new WorldController(pool, cat, memStorage());
    c.stepMs = 0;
    c.newGame({ starter: "white", difficulty: "standard", seed: 3801 });
    const w = c.world!;
    w.player.collection["serra_angel"] = 1;
    for (const o of w.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
    // Walk onto the Bastion's gate (the S22b pattern).
    const fp = w.map.strongholds.find((f) => f.kind === "stronghold" && f.name === "The Argent Bastion")!;
    const near = [{ x: fp.at.x + 1, y: fp.at.y }, { x: fp.at.x - 1, y: fp.at.y }, { x: fp.at.x, y: fp.at.y + 1 }, { x: fp.at.x, y: fp.at.y - 1 }].find((p) => w.map.passable[idx(w.map, p)])!;
    w.player.position = near;
    c.clickCell(fp.at);
    await tick();
    c.clickCell(fp.at);
    for (let i = 0; i < 50 && c.screen.kind !== "dungeonTelegraph"; i++) await tick();
    const screen = () => (c as WorldController).screen;
    expect(screen().kind).toBe("dungeonTelegraph");
    // The door's word is up; the descent is refused, naming the rule.
    const door = c.siteDoor()!;
    expect(door.id).toBe("stronghold:argent_bastion");
    expect(door.refusal).toMatch(/^Bring bodies to the fire\. the Argent Gate \(colours within W; ≥ \d+ creatures\): \d+ creatures; the Argent Gate asks \d+\.$/);
    expect(c.doorRules()).toEqual([{ id: "stronghold:argent_bastion", name: "The Argent Bastion", label: "the Argent Gate", description: `colours within W; ≥ ${creatures + 1} creatures` }]);
    c.enterDungeon();
    expect(screen().kind).toBe("dungeonTelegraph");
    expect((screen() as { notice: string | null }).notice).toBe(door.refusal);
    // "Edit your deck": the editor opens on the door, pre-selected; Cancel returns to the gate.
    c.openEditorForDoor();
    expect(screen().kind).toBe("editor");
    expect(c.editorRuleId).toBe("stronghold:argent_bastion");
    expect(c.editorRuleCheck()!.check.ok).toBe(false);
    c.editorClose();
    expect(screen().kind).toBe("dungeonTelegraph");
    expect((screen() as { info: { dungeonId: string } }).info.dungeonId).toBe("argent_bastion");
    // Back in: the Serra for a Plains, saved — the editor returns to the gate, which now opens.
    c.openEditorForDoor();
    c.editorAdd("serra_angel");
    c.editorRemove("plains");
    expect(c.editorRuleCheck()!.check.ok).toBe(true);
    expect(c.editorSave()).toBe(true);
    expect(screen().kind).toBe("dungeonTelegraph");
    expect(c.siteDoor()!.refusal).toBeNull();
    c.enterDungeon();
    expect(screen().kind).toBe("dungeon");
    expect(c.dungeonRun!.kind).toBe("stronghold");
  }, 60_000);
});

describe("S39 (ADR-126): the Flood — the scene, the five picks, the pair, the first deck's editor (the S10 pattern)", () => {
  it("ineligible until five cuttings; then: picks bank on leaving a tab, a gold card sits on either tab (once), the pair assembles a legal twelve-land deck, Cancel is refused until legal, the Chronicle carries the line, the map is the flood's", () => {
    const storage = memStorage();
    const c = new WorldController(pool, catalog, storage);
    c.stepMs = 0;
    expect(c.floodEligible()).toBe(false);
    c.enterFlood({ difficulty: "standard" });
    expect(c.screen.kind).toBe("start");
    for (const col of ["W", "U", "B", "R", "G"] as const) c.devGrantCutting(col);
    expect(c.floodEligible()).toBe(true);
    const screen = () => (c as WorldController).screen;
    c.enterFlood({ difficulty: "standard", seed: 3903, name: "Flood" });
    expect(screen().kind).toBe("flood");
    c.floodContinue();
    expect(screen().kind).toBe("salvage");
    const sv = () => screen() as { stage: string; tab: string; picks: Record<string, string>; banked: string[]; pair: [string, string] | null; notice: string | null };
    expect(sv().tab).toBe("W");
    // The W shelf: Vindicate (WB, R drawer) and Plateau (Plains Mountain) are on it; nothing prizeOnly.
    const wShelf = c.salvageTabCandidates().map((d) => d.id);
    expect(wShelf).toContain("vindicate");
    expect(wShelf).toContain("plateau");
    expect(wShelf).not.toContain("mox_pearl");
    // Change of mind on the tab is free; leaving it banks.
    c.salvagePick("savannah_lions");
    c.salvagePick("vindicate");
    expect(sv().picks.W).toBe("vindicate");
    c.salvageTab("B");
    expect(sv().banked).toEqual(["W"]);
    expect(c.salvageTabCandidates().map((d) => d.id)).not.toContain("vindicate"); // taken on W: not offered again
    c.salvagePick("vindicate");
    expect(sv().notice).toMatch(/Not on this shelf/);
    c.salvagePick("underground_sea"); // an Island Swamp sits on the B tab
    c.salvageTab("W");
    c.salvagePick("plateau"); // banked: refused
    expect(sv().notice).toMatch(/banked/);
    expect(sv().picks.W).toBe("vindicate");
    c.salvageToPair();
    expect(sv().stage).toBe("picks"); // three colours still to pick
    expect(sv().notice).toMatch(/still U, R, G/);
    c.salvageTab("U"); c.salvagePick("tropical_island");
    c.salvageTab("R"); c.salvagePick("sacred_foundry");
    c.salvageTab("G"); c.salvagePick("blanchwood_armor");
    c.salvageToPair();
    expect(sv().stage).toBe("pair");
    expect(sv().banked.sort()).toEqual(["B", "G", "R", "U", "W"]);
    expect(c.salvagePairs()).toHaveLength(10);
    c.salvageBegin(); // no pair yet: nothing
    expect(screen().kind).toBe("salvage");
    c.salvagePair(["W", "B"]);
    c.salvageBegin();
    // The world and the editor.
    expect(screen().kind).toBe("editor");
    const w = c.world!;
    expect(w.phase).toBe(2);
    expect(w.player.gold).toBe(c.knobs.salvagePurse);
    expect(w.manalinks).toEqual([]);
    expect(w.activeDeckName).toBe("Orzhov salvage");
    const deck = activeDeck(w);
    expect(deck.reduce((n, e) => n + e.count, 0)).toBe(30);
    expect(deck.reduce((n, e) => n + (pool.get(e.cardId)!.types.includes("Land") ? e.count : 0), 0)).toBe(12);
    expect(deck.some((e) => e.cardId === "vindicate")).toBe(true); // the WB pick joins the WB pair
    expect(deck.some((e) => e.cardId === "underground_sea")).toBe(true); // an Island Swamp is in a WB pair too
    expect(deck.some((e) => e.cardId === "sacred_foundry")).toBe(true); // a Mountain Plains carries Plains: in a WB pair
    expect(deck.some((e) => e.cardId === "tropical_island")).toBe(false); // a Forest Island: not
    expect(deck.some((e) => e.cardId === "blanchwood_armor")).toBe(false);
    expect(Object.keys(w.player.collection).filter((id) => !["plains", "island", "swamp", "mountain", "forest"].includes(id))).toHaveLength(70);
    expect(w.map.strongholds.some((f) => f.kind === "deep")).toBe(true);
    expect(w.map.strongholds.some((f) => f.kind === "corolla")).toBe(false);
    // Cancel is refused while the draft is illegal; Reset then Cancel leaves for the map.
    for (let k = 0; k < 6; k++) c.editorRemove("plains");
    expect(c.editorLegality().ok).toBe(false);
    c.editorClose();
    expect(screen().kind).toBe("editor");
    expect((screen() as { notice: string | null }).notice).toMatch(/legal deck/);
    c.editorReset();
    c.editorClose();
    expect(screen().kind).toBe("map");
    // The Chronicle: the profile's ledger and the run's carry the flood's line.
    const last = c.chronicle()[c.chronicle().length - 1]!;
    expect(last.kind).toBe("flood");
    expect(last.color).toBe("W");
    expect(last.text).toMatch(/^The plane turns over\. Salvaged: Vindicate, .*The first colours: Orzhov \(WB\)\.$/);
    expect(c.chronicle()).toHaveLength(6);
    expect(w.gauntlet.chronicle).toHaveLength(1);
    // The deep water: standing on it, knock reads the line; the dev toggle sets the phase.
    const deep = w.map.strongholds.find((f) => f.kind === "deep")!;
    w.player.position = { ...deep.at };
    expect(c.doorHere()).toBe("deep");
    c.knock();
    expect((screen() as { notice: string | null }).notice).toMatch(/The water is deep here/);
    c.devSetPhase(1);
    expect(w.phase).toBe(1);
    c.devSetPhase(2);
    expect(deserializeWorld(storage.getItem("shandalar-world-save")!).phase).toBe(2);
  }, 60_000);
});

describe("deploy playtest r5 (Chris): the autosave survives the browser's quota", () => {
  it("a quota error never escapes — the autosave trims the replay logs and retries; the game goes on", async () => {
    const storage = cappedStorage(1_500_000);
    const c = new WorldController(pool, catalog, storage);
    c.newGame({ starter: "black", difficulty: "standard", name: "Q", seed: 5 });
    const w = c.world!;
    // Inflate the record with fake logs past the cap, the way a long run does.
    const bigLog = Array.from({ length: 6000 }, (_, i) => ({ t: "ACTION", turn: 1, step: "MAIN1", player: 0, action: { type: "pass" }, i }));
    for (let i = 0; i < 8; i++) w.duels.push({ index: i, seed: i, opponentId: `o${i}`, catalogId: "a1", outcome: "win", anteWon: [], anteLost: [], saved: { format: "shandalar-log-v1", spec: {}, result: {}, log: bigLog } });
    expect(() => c.save()).not.toThrow();
    expect(storage.getItem("shandalar-world-save")).not.toBeNull();
    const saved = JSON.parse(storage.getItem("shandalar-world-save")!) as { world: { duels: { saved: unknown }[] } };
    expect(saved.world.duels).toHaveLength(8); // the records stay
    expect(saved.world.duels.filter((d) => d.saved !== null).length).toBeLessThanOrEqual(1); // the logs went
  });
});

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
    const town = c.world!.map.towns[c.world!.lastTownIndex]!; // S23 r1: the start stands outside the gate; the home town is the nearest
    c.world!.player.position = { ...town.at }; // a real arrival stands on the town — the reload leg resumes there
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

  it("r6 note 3: a standing preview walks from the rail button (walkPreview), no destination click", async () => {
    const c = freshController();
    c.newGame({ starter: "green", difficulty: "standard", seed: 211 });
    const w = c.world!;
    const s = w.player.position;
    const nbr = [{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }]
      .find((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y) && !w.opponents.some((o) => !o.gone && o.at && o.at.x === p.x && o.at.y === p.y))!;
    if (c.screen.kind === "town") c.leaveTown();
    c.walkPreview(); // nothing previewed: a no-op
    expect(c.world!.player.position).toEqual(s);
    c.clickCell(nbr); // first click previews
    expect((c.screen as { previewTarget: unknown }).previewTarget).toEqual(nbr);
    c.walkPreview();
    for (let i = 0; i < 50 && !(c.world!.player.position.x === nbr.x && c.world!.player.position.y === nbr.y); i++) await new Promise((r) => setTimeout(r, 5));
    expect(c.world!.player.position).toEqual(nbr);
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
    const town = c.world!.map.towns[c.world!.lastTownIndex]!; // S23 r1: the start stands outside the gate; the home town is the nearest
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

describe("S42b (S41 Deviation 9): the scripted PHASE-TWO stronghold run — the Tidelock Weir walked, every interior duel played live on the controller's own spec, the Bailiff's fall through the flood's hooks", () => {
  /** A phase-two world from the salvage path, its roamers gone, standing beside the Weir's gate. */
  function floodWorldAtTheWeir(seed: number, deck?: { cardId: string; count: number }[]): WorldController {
    const c = new WorldController(pool, catalog, memStorage());
    c.stepMs = 0; c.aiDelayMs = 0;
    for (const col of ["W", "U", "B", "R", "G"] as const) c.devGrantCutting(col);
    c.enterFlood({ difficulty: "standard", seed, name: "Flood" });
    c.floodContinue();
    for (const [tab, pick] of [["W", "savannah_lions"], ["U", "wind_drake"], ["B", "typhoid_rats"], ["R", "goblin_piker"], ["G", "grizzly_bears"]] as const) { c.salvageTab(tab); c.salvagePick(pick); }
    c.salvageTab("W"); c.salvageToPair(); c.salvagePair(["W", "R"]); c.salvageBegin(); c.editorClose();
    const w = c.world!;
    for (const o of w.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
    if (deck) { // a finished deck in the player's hands (its cards granted; a dev grant, not a ceremony)
      for (const e of deck) w.player.collection[e.cardId] = Math.max(w.player.collection[e.cardId] ?? 0, e.count);
      const r = commitDeck(w, deck.map((e) => ({ ...e })));
      expect(r.ok, JSON.stringify(r)).toBe(true);
    }
    const site = w.map.strongholds.find((f) => f.kind === "stronghold" && f.name === "Tidelock Weir")!;
    const nbr = [{ x: site.at.x + 1, y: site.at.y }, { x: site.at.x - 1, y: site.at.y }, { x: site.at.x, y: site.at.y + 1 }, { x: site.at.x, y: site.at.y - 1 }].find((p) => w.map.passable[idx(w.map, p)])!;
    w.player.position = { ...nbr };
    c.clickCell(site.at); c.clickCell(site.at);
    return c;
  }
  /** One run to its end: the walk toward the guardian (re-planned after every reveal) and every duel played on the
   * controller's OWN spec by two heuristic pilots (journeyman for the player — the click-path human of S10 loses every
   * time), the real result fed to the finisher. Returns how it ended. */
  async function walkTheWeir(c: WorldController, opts: { stopAtGuardian?: boolean } = {}): Promise<{ duels: number; guardianFought: boolean; end: "fell" | "lost" | "guardian" }> {
    const { runMatch } = await import("@shandalar/engine");
    const { HeuristicAgent, difficultyProfile } = await import("@shandalar/agents");
    const w = c.world!;
    const run = c.dungeonRun!;
    const screen = () => (c as WorldController).screen;
    let duels = 0, guardianFought = false;
    for (let guard = 0; guard < 400; guard++) {
      const sc = screen();
      if (sc.kind === "strongholdVictory") return { duels, guardianFought, end: "fell" };
      if (sc.kind === "map") return { duels, guardianFought, end: "lost" };
      if (sc.kind === "dungeonDuel") {
        duels += 1;
        const spec = sc.match.spec;
        const enemyLife = spec.modifiers.find((m) => m.type === "startingLife" && m.player === 1) as { value: number } | undefined;
        if (sc.against.guardian) {
          guardianFought = true;
          expect(sc.enemyName).toBe("The Bailiff");
          // ADR-134's 30 at Standard through the pace-war formula (the minions felled INSIDE bleed him — S22b) + the interior empowerment clock's life.
          const sh = c.strongholdDef("tidelock_weir")!;
          expect(sh.lord.baseLife + c.knobs.floodLordLifeBonus).toBe(30);
          expect(enemyLife?.value).toBe(lordStartingLife(w, c.knobs, sh) + empowermentModifiers(reachedTiers(run, c.knobs), "W").lifeBonus);
          expect(spec.modifiers.filter((m) => m.type === "permanentOnBattlefield" && m.player === 1).map((m) => (m as { cardId: string }).cardId)).toEqual(["law_intake", "plains", "island"]); // the seat's law, then ADR-134's two basics of WUR, the law's colour first
          expect(spec.modifiers.some((m) => m.type === "signatureToHand" && (m as { cardId: string }).cardId === "the_bailiff")).toBe(true);
        }
        const enemyProfile = (spec.players[1].agent.split(":")[1] ?? "journeyman") as "apprentice" | "journeyman" | "master";
        if (sc.against.guardian && opts.stopAtGuardian) {
          // Play it live for the record; a win is the live fall, a loss leaves the screen on the duel for the caller.
          const r = await runMatch(spec, pool, [new HeuristicAgent(spec.seed * 2 + 1, pool, difficultyProfile("journeyman", "aggro", spec.players[1].decklist)), new HeuristicAgent(spec.seed * 2 + 2, pool, difficultyProfile(enemyProfile, "control", spec.players[0].decklist))]);
          if (r.winner === 0) { (c as never as { finishInteriorDuel(a: { guardian?: boolean }, res: unknown): void }).finishInteriorDuel(sc.against, r); return { duels, guardianFought, end: "fell" }; }
          return { duels, guardianFought, end: "guardian" };
        }
        const result = await runMatch(spec, pool, [
          new HeuristicAgent(spec.seed * 2 + 1, pool, difficultyProfile("journeyman", "aggro", spec.players[1].decklist)),
          new HeuristicAgent(spec.seed * 2 + 2, pool, difficultyProfile(enemyProfile, sc.against.guardian ? "control" : "midrange", spec.players[0].decklist)),
        ]);
        if (process.env.S42B_DEBUG) console.log(`duel vs ${sc.enemyName}: winner ${result.winner} (${result.reason}) life ${result.finalLife.join("/")} turns ${result.turns}; start ${spec.rules.startingLife} vs ${enemyLife?.value}; player deck ${spec.players[0].decklist.reduce((n, e) => n + e.count, 0)} cards`);
        (c as never as { finishInteriorDuel(a: { minionId?: string; guardian?: boolean }, r: typeof result): void }).finishInteriorDuel(sc.against, result);
        continue;
      }
      if (sc.kind !== "dungeon") throw new Error(`unexpected screen ${sc.kind}`);
      if (sc.walking) { await tick(); continue; }
      const path = dungeonPath(run, run.guardianAt);
      expect(path, "a path toward the guardian exists").toBeTruthy();
      c.dungeonClick(path![Math.min(path!.length - 1, 2)]!); // a few cells at a time so a reveal re-plans
      for (let i = 0; i < 200 && screen().kind === "dungeon" && (screen() as { walking: boolean }).walking; i++) await tick();
      if (run.position.x === run.guardianAt.x && run.position.y === run.guardianAt.y && screen().kind === "dungeon") throw new Error("stood on the guardian's cell without a duel");
    }
    throw new Error(`the walk did not end (${duels} duels; at ${JSON.stringify(run.position)}, guardian ${JSON.stringify(run.guardianAt)}); ${w.player.name}`);
  }

  it("the day-one salvage deck: entry through the gate → the interior at stronghold scale → the first duels fought live → a loss ejects and resets, nothing of the flood's recorded (six seeds; the floor deck does not take a stronghold — the S41/S42a sims' read, live)", async () => {
    const ends: string[] = [];
    for (let seed = 4242; seed < 4248; seed++) {
      const c = floodWorldAtTheWeir(seed);
      for (let i = 0; i < 100 && c.screen.kind !== "dungeonTelegraph"; i++) await tick();
      expect(c.screen.kind).toBe("dungeonTelegraph");
      c.enterDungeon();
      const w = c.world!;
      const out = await walkTheWeir(c);
      ends.push(`${seed}: ${out.duels} duel(s), ${out.guardianFought ? "the Bailiff fought" : "no lord"}, ${out.end}`);
      expect(out.duels).toBeGreaterThan(0);
      if (out.end === "fell") { ends.push("(and fell — the floor deck took the Weir this seed)"); continue; }
      // The loss path (S22b machinery): ejected, the run reset, nothing of the flood's recorded.
      expect(w.activeDungeon).toBeNull();
      expect(w.dungeons["tidelock_weir"]?.cleared ?? false).toBe(false);
      expect(floodRun(w).falls ?? []).toHaveLength(0);
      expect(floodRun(w).golds ?? []).toHaveLength(0);
    }
    console.log(`S42b scripted runs (salvage) — ${ends.join(" · ")}`);
  }, 300_000);

  it("a finished deck (salvage-WR+lords — the post-lords reference, within the Weir's WUR; its cards granted): the walk and the minions fought live on the controller's spec until the Bailiff is reached; his duel played live — and if he holds (he has, every seed: interior life carries and he sits at 30 + two basics + the law), the fall is applied as a scripted win so the ceremony's hooks are exercised: the lord's card, the seal, the golds to the shops, the chronicle's fall, the save", async () => {
    const { ROAD_DECKS } = await import("@shandalar/sim/road-decks");
    const ends: string[] = [];
    let reached: WorldController | null = null;
    let liveFall = false;
    for (let seed = 4242; seed < 4262 && !reached; seed++) {
      const c = floodWorldAtTheWeir(seed, ROAD_DECKS.salvageWRLords!.decklist);
      for (let i = 0; i < 100 && c.screen.kind !== "dungeonTelegraph"; i++) await tick();
      expect(c.screen.kind).toBe("dungeonTelegraph");
      expect(c.siteDoor()!.refusal).toBeNull(); // WR sits inside WUR
      c.enterDungeon();
      const run = c.dungeonRun!;
      expect([run.kind, run.dungeonId, run.grid.width]).toEqual(["stronghold", "tidelock_weir", c.knobs.strongholdGridWidth]);
      const out = await walkTheWeir(c, { stopAtGuardian: true });
      ends.push(`${seed}: ${out.duels} duel(s), ${out.guardianFought ? "the Bailiff reached" : "no lord"}, ${out.end}`);
      if (out.end === "fell") { liveFall = true; reached = c; }
      else if (out.end === "guardian") reached = c;
    }
    console.log(`S42b scripted runs (post-lords) — ${ends.join(" · ")}`);
    expect(reached, `no seed reached the Bailiff: ${ends.join("; ")}`).toBeTruthy();
    const c = reached!;
    const w = c.world!;
    const screen = () => (c as WorldController).screen;
    if (!liveFall) {
      // He held. Play his duel live once more for the record, then apply the fall as S22b's test does — a scripted result
      // through the finisher — so the ceremony's hooks are tested even when no pilot of ours can beat the row.
      const sc = screen();
      expect(sc.kind).toBe("dungeonDuel");
      if (sc.kind !== "dungeonDuel") return;
      expect(sc.against.guardian).toBe(true);
      const win = { winner: 0 as const, reason: "LIFE" as const, turns: 12, finalLife: [5, 0] as [number, number], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [[], []] as [string[], string[]] }, log: [], finalStateSerialized: "" };
      (c as never as { finishInteriorDuel(a: { minionId?: string; guardian?: boolean }, r: typeof win): void }).finishInteriorDuel(sc.against, win as never);
    }
    const victory = screen();
    expect(victory.kind).toBe("strongholdVictory");
    if (victory.kind !== "strongholdVictory") return;
    expect(victory.lordName).toBe("The Bailiff");
    expect(w.player.collection["the_bailiff"]).toBe(1);
    expect(w.dungeons["tidelock_weir"]?.cleared).toBe(true);
    expect(c.lordStatusRows().find((r) => r.color === "W")?.sealed).toBe(true);
    expect(floodRun(w).falls).toEqual([{ siteId: "tidelock_weir", step: w.player.stepsTaken }]);
    expect([...floodRun(w).golds!].sort()).toEqual(["sacred_helix", "static_sphere"]);
    expect(c.legacy().chronicle.at(-1)).toMatchObject({ kind: "flood", color: "W" });
    c.confirmStrongholdPicks();
    expect(screen().kind).toBe("map");
    const back = deserializeWorld(JSON.stringify(JSON.parse(c.saveText())));
    expect((back.strongholds as { color: string; seal: boolean }[]).find((e) => e.color === "W")?.seal).toBe(true);
    expect(floodRun(back).golds).toContain("sacred_helix"); // the golds survive the save
  }, 600_000);
});

describe("S41 (ADR-130): the flood's seats through the controller — a court's threshold, its gate by site, the editor round trip; a flood stronghold's gate", () => {
  async function floodController(): Promise<WorldController> {
    const c = new WorldController(pool, catalog, memStorage());
    c.stepMs = 0;
    for (const col of ["W", "U", "B", "R", "G"] as const) c.devGrantCutting(col);
    c.enterFlood({ difficulty: "standard", seed: 4101, name: "Flood" });
    c.floodContinue();
    for (const [tab, pick] of [["W", "savannah_lions"], ["U", "wind_drake"], ["B", "typhoid_rats"], ["R", "goblin_piker"], ["G", "grizzly_bears"]] as const) { c.salvageTab(tab); c.salvagePick(pick); }
    c.salvageTab("W");
    c.salvageToPair();
    c.salvagePair(["W", "R"]);
    c.salvageBegin();
    c.editorClose();
    expect(c.screen.kind).toBe("map");
    quiet(c);
    return c;
  }
  /** Stand beside a site and step onto it. */
  async function stepOnto(c: WorldController, at: { x: number; y: number }): Promise<void> {
    const w = c.world!;
    const nbr = [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }].find((p) => w.map.passable[idx(w.map, p)])!;
    w.player.position = { ...nbr };
    c.clickCell(at); c.clickCell(at);
    let guard = 0;
    while (c.screen.kind === "map" && (c.screen as { walking: boolean }).walking && guard++ < 100) await tick();
  }

  it("every door of the flood is in the editor's list; a court's threshold opens its telegraph with the seat's voice; the gate refuses in the COURT's own words; 'edit your deck' returns to the court; stepping back leaves it standing", async () => {
    const c = await floodController();
    const w = c.world!;
    expect(c.doorRules().map((d) => d.id).sort()).toEqual([...catalog.flood!.courts.map((x) => `court:${x.id}`), ...catalog.flood!.strongholds.map((x) => `stronghold:${x.id}`)].sort());
    const site = w.map.strongholds.find((f) => f.kind === "ground" && f.contentId === "tallyflame_court")!;
    await stepOnto(c, site.at);
    expect(c.screen.kind).toBe("courtTelegraph");
    expect(c.seatText("tallyflame_court")!.parley).toMatch(/^"Every card you turn/);
    // The twelve-land salvage deck has fewer than twelve creature cards? Make sure: strip creatures to be certain.
    const deck = activeDeck(w);
    const creatures = deck.reduce((n, e) => n + (pool.get(e.cardId)!.types.includes("Creature") ? e.count : 0), 0);
    const door = c.siteDoor()!;
    expect(door.id).toBe("court:tallyflame_court");
    if (creatures < 12) {
      expect(door.refusal).toMatch(/^Bring bodies to the fire\. Twelve, at the least\. the Tallyflame gate \(≥ 12 creatures\): \d+ creatures; the Tallyflame gate asks 12\.$/);
      c.fightCourt();
      expect(c.screen.kind).toBe("courtTelegraph"); // refused: no duel
      expect((c.screen as { notice: string | null }).notice).toMatch(/^Bring bodies to the fire\. Twelve/);
    } else expect(door.refusal).toBeNull();
    c.openEditorForDoor();
    expect(c.screen.kind).toBe("editor");
    expect(c.editorRuleCheck()!.id).toBe("court:tallyflame_court");
    c.editorClose();
    expect(c.screen.kind).toBe("courtTelegraph");
    c.declineCourt();
    expect(c.screen.kind).toBe("map");
    expect(w.dungeons["tallyflame_court"]?.cleared ?? false).toBe(false);
  });

  it("a flood stronghold's threshold is the flood's seat: the Bailiff's gate (colours within WUR) refuses a green card with the colour line; the deep water's knock changes when the five lords have fallen", async () => {
    const c = await floodController();
    const w = c.world!;
    const site = w.map.strongholds.find((f) => f.kind === "stronghold" && f.name === "Tidelock Weir")!;
    await stepOnto(c, site.at);
    expect(c.screen.kind).toBe("dungeonTelegraph");
    expect((c.screen as { info: { dungeonId: string } }).info.dungeonId).toBe("tidelock_weir");
    expect(c.strongholdDef("tidelock_weir")!.lord.name).toBe("The Bailiff");
    expect(c.siteDoor()!.refusal).toBeNull(); // a WR salvage deck sits inside WUR
    c.openEditorForDoor();
    c.editorAdd("grizzly_bears"); c.editorRemove("plains");
    c.editorSave();
    expect(c.screen.kind).toBe("dungeonTelegraph");
    expect(c.siteDoor()!.refusal).toMatch(/^The gate knows your colours\. It will not open to these\. the Tidelock Weir gate \(colours within WUR\): 1 card is outside/);
    c.enterDungeon();
    expect(c.screen.kind).toBe("dungeonTelegraph"); // the whole descent is refused
    // The Heart's site.
    c.declineDungeon();
    const deep = w.map.strongholds.find((f) => f.kind === "deep")!;
    w.player.position = { ...deep.at };
    c.knock();
    expect((c.screen as { notice: string | null }).notice).toBe(catalog.questText!.flood!.deep);
    // S42b (Part 4): the dev shortcut fells the five lords AS THE FLOOD's falls — cards, seals, golds, the chronicle.
    expect(c.devDungeonRows().map((r) => r.kind)).toEqual(Array(5).fill("stronghold"));
    expect(c.devCompleteAll("stronghold")).toBe(5);
    expect((c.screen as { notice: string | null }).notice).toMatch(/^Dev: 5 lords felled — 5\/5; the deep water is open/);
    expect(c.devCompleteAll("stronghold")).toBe(0);
    expect(floodRun(w).falls).toHaveLength(5);
    expect(floodRun(w).golds!.sort()).toEqual(catalog.flood!.strongholds.flatMap((s) => s.golds).sort());
    for (const s of catalog.flood!.strongholds) expect(w.player.collection[s.lord.cardId], s.id).toBe(1);
    // S42a (ADR-131): the lords fallen — the knock is the Cinquefont's telegraph; stepping back leaves it rising.
    c.knock();
    expect(c.screen.kind).toBe("fountTelegraph");
    expect(c.fountText()!.telegraph).toMatch(/The Cinquefont\.$/);
    c.declineFount();
    expect(c.screen.kind).toBe("map");
    // Its fall (applied as the duel's result would): Time Walk and the card, the profile's flag and line, no cutting counted; the world goes on.
    const before = c.legacy();
    (c as unknown as { finishFountDuel: (r: unknown, rec: unknown) => void }).finishFountDuel({ winner: 0, reason: "LIFE", turns: 12, finalLife: [5, 0], log: [], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante: { 0: [], 1: [] } } }, undefined);
    expect(c.screen.kind).toBe("fountVictory");
    expect((c.screen as { paidCards: string[] }).paidCards).toEqual(["time_walk", "the_cinquefont"]);
    expect(w.player.collection.time_walk).toBe(1);
    const after = c.legacy();
    expect(after.floodSurvived).toBe(true);
    expect(after.victories).toBe(before.victories);
    expect(after.cuttings).toEqual(before.cuttings);
    expect(after.chronicle[after.chronicle.length - 1]).toMatchObject({ kind: "fount", text: catalog.questText!.flood!.fount!.fall });
    c.continueAfterFount();
    expect(c.screen.kind).toBe("map");
    w.player.position = { ...deep.at };
    c.knock(); // stopped: a quiet line, no second fight
    expect(c.screen.kind).toBe("map");
    expect((c.screen as { notice: string | null }).notice).toBe(catalog.questText!.flood!.fount!.fall);
    expect(c.floodEligible()).toBe(true); // "Enter the Flood" stays available for new runs
  });
});
