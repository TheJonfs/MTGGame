import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards: Map<string, CardDef> = new Map([...loadCardPool(join(ROOT, "data/cards")).cards]);
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string; controller: number }>; battlefield: string[]; players: { graveyard: string[] }[] };
const rules = (turns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns: turns, startingPlayer: 0 }) as MatchSpec["rules"];
const handOf = (v: GameView, id: string) => v.hand.find((h) => h.cardId === id);
/** Player 0's agent: records every view it is shown, and in its first main phase casts `card` at the permanent `aim` picks, once. */
const caster = (card?: string, aim?: (v: GameView, targetId: string) => boolean) => {
  const a = { views: [] as GameView[], offered: [] as Action[], cast: false, chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    a.views.push(v);
    if (card && r.purpose === "priority" && v.turn === 1 && v.activePlayer === 0) {
      const mine = r.actions.filter((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === card);
      a.offered.push(...mine);
      const pick = !a.cast && aim ? mine.find((x) => x.type === "castSpell" && x.targets[0]?.kind === "object" && aim(v, x.targets[0].id)) : undefined;
      if (pick) { a.cast = true; return pick; }
    }
    return pass(r);
  } }; return a;
};
const run = async (deck: string, mods: Modifier[], agent: Agent, turns = 1) => JSON.parse((await runMatch({ seed: 41, players: [{ name: "a", decklist: [{ cardId: deck, count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(turns), modifiers: mods } as MatchSpec, cards, [agent, passer])).finalStateSerialized) as Final;
const kw = (v: GameView | undefined, cardId: string, controller: 0 | 1 = 0) => v?.battlefield.find((o) => o.cardId === cardId && o.controller === controller)?.keywords;
const cardAt = (v: GameView, id: string) => v.battlefield.find((o) => o.id === id);

/** Post-S71a — Domain Pouncer ({G/W}{G/W}, 1/1 Cat; Chris's): "Vigilance, reach. Domain Pouncer has first strike as long as you control
 * a Mountain. Domain Pouncer has deathtouch as long as you control a Swamp." A conditional static (A4) on a count of lands you control
 * with the subtype — a dual counts as each of its types (CR 205.3i: land types are subtypes; 205.3b: an object may have several — Badlands is a Swamp and a Mountain). The
 * static applies continuously (CR 611.3a): the keyword comes and goes with the land. */
describe("Post-S71a — Domain Pouncer: keywords by the lands you control", () => {
  it("vigilance and reach alone; first strike with a Mountain; deathtouch with a Swamp", async () => {
    const bare = caster(); await run("forest", [perm(0, "domain_pouncer"), perm(0, "forest")], bare);
    expect(kw(bare.views.at(-1), "domain_pouncer")).toEqual(["reach", "vigilance"]);
    const mtn = caster(); await run("forest", [perm(0, "domain_pouncer"), perm(0, "mountain")], mtn);
    expect(kw(mtn.views.at(-1), "domain_pouncer")).toEqual(["first strike", "reach", "vigilance"]);
    const swp = caster(); await run("forest", [perm(0, "domain_pouncer"), perm(0, "swamp")], swp);
    expect(kw(swp.views.at(-1), "domain_pouncer")).toEqual(["deathtouch", "reach", "vigilance"]);
  });

  it("a dual land with both subtypes gives both; the opponent's Mountain gives nothing", async () => {
    const dual = caster(); await run("forest", [perm(0, "domain_pouncer"), perm(0, "badlands")], dual);
    expect(kw(dual.views.at(-1), "domain_pouncer")).toEqual(["deathtouch", "first strike", "reach", "vigilance"]);
    const theirs = caster(); await run("forest", [perm(0, "domain_pouncer"), perm(1, "mountain"), perm(1, "swamp")], theirs);
    expect(kw(theirs.views.at(-1), "domain_pouncer")).toEqual(["reach", "vigilance"]);
  });

  it("the keywords leave with the land (Terrain Collapse on our own Badlands)", async () => {
    const a = caster("terrain_collapse", (v, id) => cardAt(v, id)?.cardId === "badlands");
    const f = await run("terrain_collapse", [perm(0, "domain_pouncer"), perm(0, "badlands"), perm(0, "forest"), perm(0, "forest")], a);
    expect(a.cast).toBe(true);
    expect(f.players[0]!.graveyard.map((o) => f.objects[o]!.cardId).sort()).toEqual(["badlands", "terrain_collapse"]);
    const before = a.views.find((v) => handOf(v, "terrain_collapse") && v.battlefield.some((o) => o.cardId === "badlands"));
    expect(kw(before, "domain_pouncer")).toEqual(["deathtouch", "first strike", "reach", "vigilance"]);
    expect(kw(a.views.at(-1), "domain_pouncer")).toEqual(["reach", "vigilance"]);
  });
});

/** Post-S71a — Terrain Collapse ({R/G}{R/G} sorcery; Chris's): "Destroy target nonbasic land." R-127: a target filter on the Basic
 * supertype (CR 205.4c — "nonbasic land" is a land without the basic supertype); either player's land; re-read on resolution (608.2b). */
describe("Post-S71a — Terrain Collapse: target nonbasic land (R-127)", () => {
  it("offers only nonbasic lands — either player's — and never a basic", async () => {
    const a = caster("terrain_collapse");
    await run("terrain_collapse", [perm(0, "forest"), perm(0, "mountain"), perm(0, "taiga"), perm(1, "swamp"), perm(1, "badlands"), perm(1, "grizzly_bears")], a);
    const aimed = new Set(a.offered.map((x) => (x.type === "castSpell" && x.targets[0]?.kind === "object" ? a.views.find((v) => cardAt(v, x.targets[0]!.kind === "object" ? (x.targets[0] as { id: string }).id : ""))?.battlefield.find((o) => o.id === (x.targets[0] as { id: string }).id)?.cardId : undefined)));
    expect([...aimed].sort()).toEqual(["badlands", "taiga"]);
  });

  it("destroys the opponent's dual, paid with either colour", async () => {
    const a = caster("terrain_collapse", (v, id) => cardAt(v, id)?.cardId === "badlands");
    const f = await run("terrain_collapse", [perm(0, "forest"), perm(0, "mountain"), perm(1, "badlands")], a);
    expect(a.cast).toBe(true);
    expect(f.players[1]!.graveyard.map((o) => f.objects[o]!.cardId)).toEqual(["badlands"]);
    expect(f.battlefield.some((o) => f.objects[o]!.cardId === "badlands")).toBe(false);
  });
});

/** Post-S71a — Clutch Guard ({G/U}{G/U}, 1/1 Snake; Chris's): "When Clutch Guard enters, draw a card. {3}{G/U}{G/U}, Exile this card from
 * your graveyard: Create two 1/1 green Snake creature tokens. Draw two cards." Seasoned Pyromancer's graveyard shape (A5 zone ability,
 * exileSelf cost) with a hybrid ability cost (R-125: CR 107.4e — each hybrid symbol paid with either colour, in an ability cost as in a spell's). */
describe("Post-S71a — Clutch Guard: the draw, and the eggs from the graveyard", () => {
  const yardFirst: Modifier = { type: "effectAtStart", player: 0, effects: [{ type: "discard", count: 1, who: "you", mode: "ownerChooses" }] };
  /** Player 0: in its first main phase, the first action on a Clutch Guard (cast from hand, or activated from the graveyard). */
  const guard = (kind: "castSpell" | "activateAbility") => {
    const a = { views: [] as GameView[], done: false, chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
      a.views.push(v);
      if (!a.done && r.purpose === "priority" && v.turn === 1 && v.activePlayer === 0) {
        const x = r.actions.find((y) => y.type === kind && (kind === "castSpell" ? v.hand : v.graveyardObjects[0].map((g) => ({ objectId: g.objectId, cardId: g.cardId }))).some((h) => h.objectId === (y as { objectId: string }).objectId && h.cardId === "clutch_guard"));
        if (x) { a.done = true; return x; }
      }
      return pass(r);
    } }; return a;
  };
  const tokens = (f: Final) => f.battlefield.filter((o) => f.objects[o]!.cardId === "snake_1_1_g").length;

  it("enters and draws a card", async () => {
    const a = guard("castSpell");
    const f = await run("clutch_guard", [perm(0, "forest"), perm(0, "island")], a);
    expect(a.done).toBe(true);
    expect(f.battlefield.filter((o) => f.objects[o]!.cardId === "clutch_guard").length).toBe(1);
    const before = a.views.find((v) => v.turn === 1 && v.activePlayer === 0)!.hand.length;
    expect(a.views.at(-1)!.hand.length).toBe(before); // one cast, one drawn
  });

  for (const [label, lands] of [["Forests and Islands", ["forest", "island", "forest", "island", "forest"]], ["Forests alone", ["forest", "forest", "forest", "forest", "forest"]], ["Islands alone", ["island", "island", "island", "island", "island"]]] as const) {
    it(`from the graveyard, paid with ${label}: two Snakes, two cards, and the Guard exiled`, async () => {
      const a = guard("activateAbility");
      const f = await run("clutch_guard", [yardFirst, ...lands.map((l) => perm(0, l))], a);
      expect(a.done).toBe(true);
      expect(tokens(f)).toBe(2);
      // exiled as the cost (the turn's cleanup may discard another Guard to hand size — the hand is eight after the two drawn)
      expect(Object.values(f.objects).filter((o) => o.cardId === "clutch_guard" && (o as { zone?: string }).zone === "exile").length).toBe(1);
      const before = a.views.find((v) => v.turn === 1 && v.activePlayer === 0 && v.graveyardObjects[0].length > 0)!.hand.length;
      expect(a.views.at(-1)!.hand.length).toBe(before + 2);
    });
  }

  it("four lands are not enough: the ability is not offered", async () => {
    const a = guard("activateAbility");
    await run("clutch_guard", [yardFirst, ...["forest", "island", "forest", "island"].map((l) => perm(0, l))], a);
    expect(a.done).toBe(false);
  });
});
