import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard, type CardDef } from "@shandalar/cards";
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

/** Post-S71a — Revivalist ({W/B}{W/B}, 1/1 Human Cleric; Chris's): "Lifelink. When Revivalist dies, return another target permanent
 * card with mana value 3 or less from your graveyard to your hand." Dutiful Attendant's shape (JMP #226, "return another target creature
 * card", Scryfall: no rulings) with Unearth's ceiling. The trigger's source is the card in the graveyard (CR 400.7; triggers.ts follows
 * the dying object to its new id), so "another" excludes it; instants and mana value 4 are not offered. */
describe("Post-S71a — Revivalist: another permanent card back", () => {
  /** Player 0 bolts its own permanents in `order`, one per priority in its first main phase. */
  const bolter = (order: string[]) => {
    const left = [...order]; const a = { views: [] as GameView[], chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
      a.views.push(v);
      if (left.length && r.purpose === "priority" && v.turn === 1 && v.activePlayer === 0 && v.stack.length === 0) {
        const x = r.actions.find((y) => y.type === "castSpell" && y.targets[0]?.kind === "object" && cardAt(v, (y.targets[0] as { id: string }).id)?.cardId === left[0] && cardAt(v, (y.targets[0] as { id: string }).id)?.controller === 0);
        if (x) { left.shift(); return x; }
      }
      return pass(r);
    } }; return a;
  };
  const zoneOf = (f: Final, cardId: string) => Object.values(f.objects).filter((o) => o.cardId === cardId).map((o) => (o as { zone?: string }).zone).sort();

  it("dies and returns the Bears it outlived — not itself, not the Bolts", async () => {
    const a = bolter(["grizzly_bears", "revivalist"]);
    const f = await run("lightning_bolt", [perm(0, "revivalist"), perm(0, "grizzly_bears"), perm(0, "mountain"), perm(0, "mountain")], a);
    expect(zoneOf(f, "grizzly_bears")).toEqual(["hand"]);
    expect(zoneOf(f, "revivalist")).toEqual(["graveyard"]);
  });

  it("mana value 4 is not offered, and with nothing else to take the trigger does nothing", async () => {
    const a = bolter(["flametongue_kavu", "revivalist"]);
    const f = await run("lightning_bolt", [perm(0, "revivalist"), perm(0, "flametongue_kavu"), perm(0, "mountain"), perm(0, "mountain")], a);
    expect(zoneOf(f, "flametongue_kavu")).toEqual(["graveyard"]);
    expect(zoneOf(f, "revivalist")).toEqual(["graveyard"]);
  });

  it("has lifelink (the keyword; the engine's existing damage rules apply it)", async () => {
    const c = caster(); await run("forest", [perm(0, "revivalist")], c);
    expect(kw(c.views.at(-1), "revivalist")).toEqual(["lifelink"]);
  });
});

/** Post-S71a — Daunting Terror ({B/R}{B/R}, 3/3 Horror, menace; Chris's): "Whenever this creature is dealt damage, it deals that much
 * damage to each player." R-128: the DEALT_DAMAGE trigger (Jackal Pup's shape, TMP: "Whenever this creature is dealt damage, it deals
 * that much damage to you"). The trigger is collected as the damage is dealt, so a Terror the damage kills still triggers (CR 603.2);
 * it is the source of the recoil, so its lifelink would apply (CR 702.15b). "Each player" is two damage effects of one resolution: no
 * state-based actions between them (CR 704.3), so both players at 0 lose at once and the game is a draw (CR 104.4a). */
describe("Post-S71a — Daunting Terror: the recoil to each player (R-128)", () => {
  const go = async (mods: Modifier[], agents: [Agent, Agent], life = 20, extra: CardDef[] = []) => {
    const pool = new Map(cards); for (const d of extra) pool.set(d.id, d);
    const res = await runMatch({ seed: 41, players: [{ name: "a", decklist: [{ cardId: "lightning_bolt", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: { ...rules(1), startingLife: life }, modifiers: mods } as MatchSpec, pool, agents);
    const f = JSON.parse(res.finalStateSerialized) as Omit<Final, "players"> & { players: { life: number; graveyard: string[] }[] };
    return { life: f.players.map((p) => p.life), winner: res.winner, terror: Object.values(f.objects).filter((o) => o.cardId === "daunting_terror").map((o) => (o as { zone?: string }).zone) };
  };
  const attacker: Agent = { chooseAction: async (_v, r) => r.actions.find((a) => a.type === "declareAttacker") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? pass(r) };
  const blockAll: Agent = { chooseAction: async (_v, r) => r.actions.find((a) => a.type === "declareBlocker") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? pass(r) };
  /** Bolts the Terror once in the first main phase, then passes. */
  const bolter = (): Agent => { let done = false; return { chooseAction: async (v, r) => {
    if (!done && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      const x = r.actions.find((y) => y.type === "castSpell" && y.targets[0]?.kind === "object" && cardAt(v, (y.targets[0] as { id: string }).id)?.cardId === "daunting_terror");
      if (x) { done = true; return x; }
    }
    return pass(r);
  } }; };

  it("as printed: {B/R}{B/R}, Creature — Horror 3/3, menace; valid", () => {
    const d = cards.get("daunting_terror")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{B/R}{B/R}", types: ["Creature"], subtypes: ["Horror"], power: 3, toughness: 3, keywords: ["menace"], source: "custom", shopTier: "R" });
  });

  it("unblocked, it is dealt nothing: no recoil", async () => {
    expect((await go([perm(0, "daunting_terror")], [attacker, passer])).life).toEqual([20, 17]);
  });

  it("double-blocked by two Bears (menace): dealt 4, it deals 4 to each player and dies", async () => {
    const x = await go([perm(0, "daunting_terror"), perm(1, "grizzly_bears"), perm(1, "grizzly_bears")], [attacker, blockAll]);
    expect(x.life).toEqual([16, 16]);
    expect(x.terror).toEqual(["graveyard"]);
  });

  it("a Bolt that kills it still triggers: 3 to each player", async () => {
    const x = await go([perm(0, "daunting_terror"), perm(0, "mountain")], [bolter(), passer]);
    expect(x.life).toEqual([17, 17]);
    expect(x.terror).toEqual(["graveyard"]);
  });

  it("both players at 3, the Bolt: both reach 0 together — a draw", async () => {
    const x = await go([perm(0, "daunting_terror"), perm(0, "mountain")], [bolter(), passer], 3);
    expect(x.life).toEqual([0, 0]);
    expect(x.winner).toBeNull();
  });

  it("with lifelink, surviving two 1/1 blockers: both halves of the recoil are lifelinked — 20 + 3 − 2 + 2 + 2", async () => {
    // a test-only copy with lifelink (the Collar or the Reaper would give it in play): its 3 combat damage gains 3; dealt 2, it deals 2
    // to each player, and it is the source of both, so its controller loses 2 and gains 4
    const ll: CardDef = { ...cards.get("daunting_terror")!, id: "daunting_terror_ll", keywords: ["menace", "lifelink"] };
    const x = await go([perm(0, "daunting_terror_ll"), perm(1, "raging_goblin"), perm(1, "raging_goblin")], [attacker, blockAll], 20, [ll]);
    expect(x.life).toEqual([25, 18]);
});

  it("with lifelink, killed by two Bears' block: the recoil keeps the lifelink it had (last-known, CR 702.15b) — 20 + 3 − 4 + 4 + 4", async () => {
    // concern 39: the trigger snapshots the source's lifelink as the damage is dealt; dead before the recoil resolves, it is still its damage
    const ll: CardDef = { ...cards.get("daunting_terror")!, id: "daunting_terror_ll", keywords: ["menace", "lifelink"] };
    const x = await go([perm(0, "daunting_terror_ll"), perm(1, "grizzly_bears"), perm(1, "grizzly_bears")], [attacker, blockAll], 20, [ll]);
    expect(x.life).toEqual([27, 16]);
  });
});

/** Post-S71a — Discontinuous Flash ({W/U}{W/U} instant; Chris's): "Exile target permanent, then return it to the battlefield under its
 * owner's control. Draw a card." R-129: the blink's `under: "owner"`. The returned permanent is a new object (CR 400.7) under its owner's
 * control (110.2: the controller is whoever it enters under) — a stolen permanent goes home and its stealing Aura falls off; a token does
 * not return (111.8); an Aura returning is attached to a host its owner chooses as it enters (303.4f), or stays in exile with none
 * (303.4g); a spell aimed at the old object is left without its target (608.2b). */
describe("Post-S71a — Discontinuous Flash: blink under its owner's control (R-129)", () => {
  type FinalX = { objects: Record<string, { cardId: string; controller: number; zone?: string; attachedTo?: string | null }>; battlefield: string[]; players: { hand: string[]; graveyard: string[] }[] };
  const go = async (deck: { cardId: string; count: number }[], mods: Modifier[], agent: Agent, foe: Agent = passer) => JSON.parse((await runMatch({ seed: 41, players: [{ name: "a", decklist: deck, agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(1), modifiers: mods } as MatchSpec, cards, [agent, foe])).finalStateSerialized) as FinalX;
  /** Casts the listed cards in order in the first main phase, each at the first offered target whose card is `aim` (and controller, if given). */
  const script = (steps: { card: string; aim: string; controller?: 0 | 1 }[]) => { const left = [...steps]; const a = { cast: [] as string[], chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (left.length && r.purpose === "priority" && v.turn === 1 && v.activePlayer === 0) {
      const s = left[0]!;
      const x = r.actions.find((y) => y.type === "castSpell" && v.hand.find((h) => h.objectId === y.objectId)?.cardId === s.card && y.targets[0]?.kind === "object" && cardAt(v, (y.targets[0] as { id: string }).id)?.cardId === s.aim && (s.controller === undefined || cardAt(v, (y.targets[0] as { id: string }).id)?.controller === s.controller));
      if (x) { left.shift(); a.cast.push(s.card); return x; }
    }
    return pass(r);
  } }; return a; };
  const on = (f: FinalX, cardId: string) => f.battlefield.map((id) => f.objects[id]!).filter((o) => o.cardId === cardId);
  const flashes = [{ cardId: "discontinuous_flash", count: 60 }];

  it("as printed: {W/U}{W/U} instant; target permanent; valid", () => {
    const d = cards.get("discontinuous_flash")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{W/U}{W/U}", types: ["Instant"], source: "custom", shopTier: "R", targets: [{ predicate: "permanent" }] });
  });

  it("our tapped Bears: a new object, untapped, ours; and a card drawn", async () => {
    const a = script([{ card: "discontinuous_flash", aim: "grizzly_bears" }]);
    const f = await go(flashes, [perm(0, "grizzly_bears"), perm(0, "plains"), perm(0, "island")], a);
    expect(a.cast).toEqual(["discontinuous_flash"]);
    const bears = on(f, "grizzly_bears");
    expect(bears.map((o) => o.controller)).toEqual([0]);
    expect(f.players[0]!.hand.length).toBe(7); // seven, less the Flash, plus the draw
    expect(f.players[0]!.graveyard.map((id) => f.objects[id]!.cardId)).toEqual(["discontinuous_flash"]);
  });

  it("stolen by our Control Magic, their Bears goes home under its owner — and the Control Magic falls off", async () => {
    const a = script([{ card: "control_magic", aim: "grizzly_bears", controller: 1 }, { card: "discontinuous_flash", aim: "grizzly_bears", controller: 0 }]);
    const f = await go([{ cardId: "control_magic", count: 30 }, { cardId: "discontinuous_flash", count: 30 }], [perm(1, "grizzly_bears"), ...Array.from({ length: 6 }, () => perm(0, "island"))], a);
    expect(a.cast).toEqual(["control_magic", "discontinuous_flash"]);
    expect(on(f, "grizzly_bears").map((o) => o.controller)).toEqual([1]);
    expect(f.players[0]!.graveyard.map((id) => f.objects[id]!.cardId).sort()).toEqual(["control_magic", "discontinuous_flash"]);
  });

  it("their token does not come back (CR 111.8)", async () => {
    const a = script([{ card: "discontinuous_flash", aim: "goblin_1_1" }]);
    const f = await go(flashes, [{ type: "effectAtStart", player: 1, effects: [{ type: "createToken", tokenId: "goblin_1_1", count: 1, who: "you" }] } as Modifier, perm(0, "plains"), perm(0, "island")], a);
    expect(a.cast).toEqual(["discontinuous_flash"]);
    expect(on(f, "goblin_1_1")).toEqual([]);
  });

  it("our Pacifism, blinked, returns attached to a creature its owner chooses as it enters (303.4f; with none it stays in exile — R-114's fixture)", async () => {
    const a = script([{ card: "pacifism", aim: "grizzly_bears", controller: 1 }, { card: "discontinuous_flash", aim: "pacifism" }]);
    const f = await go([{ cardId: "pacifism", count: 30 }, { cardId: "discontinuous_flash", count: 30 }], [perm(1, "grizzly_bears"), perm(1, "serra_angel"), perm(0, "plains"), perm(0, "plains"), perm(0, "island"), perm(0, "island")], a);
    expect(a.cast).toEqual(["pacifism", "discontinuous_flash"]);
    const pac = on(f, "pacifism");
    expect(pac.length).toBe(1);
    expect(pac[0]!.controller).toBe(0);
    expect(["grizzly_bears", "serra_angel"]).toContain(f.objects[pac[0]!.attachedTo!]!.cardId);
  });

  it("the save: our own Bolt at our Bears, answered by the Flash — the Bolt is left without its target and the Bears lives", async () => {
    const a = script([{ card: "lightning_bolt", aim: "grizzly_bears" }, { card: "discontinuous_flash", aim: "grizzly_bears" }]);
    const f = await go([{ cardId: "lightning_bolt", count: 30 }, { cardId: "discontinuous_flash", count: 30 }], [perm(0, "grizzly_bears"), perm(0, "mountain"), perm(0, "plains"), perm(0, "island")], a);
    expect(a.cast).toEqual(["lightning_bolt", "discontinuous_flash"]);
    expect(on(f, "grizzly_bears").length).toBe(1);
  });
});

/** Post-S71a — Intuitive Mastery ({R/W}{R/W} Aura, flash; Chris's): "Enchanted creature gets −1/−1 and has double strike." No new word:
 * flash makes it castable whenever an instant could be (CR 702.8a); double strike deals in both combat damage steps (702.4b); a host the
 * −1/−1 leaves at 0 toughness is put into its owner's graveyard (704.5f) and the Aura with it (704.5m). Studied against −1/−0 and no
 * penalty (Chris chose −1/−1: its removal mode on an X/1 pays for the toughness). */
describe("Post-S71a — Intuitive Mastery: flash, −1/−1 and double strike", () => {
  type FinalM = { objects: Record<string, { cardId: string; controller: number; zone?: string }>; battlefield: string[]; players: { life: number; graveyard: string[] }[] };
  const go = async (mods: Modifier[], agents: [Agent, Agent], deck = "intuitive_mastery") => JSON.parse((await runMatch({ seed: 41, players: [{ name: "a", decklist: [{ cardId: deck, count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(2), modifiers: mods } as MatchSpec, cards, agents)).finalStateSerialized) as FinalM;
  const on = (f: FinalM, cardId: string) => f.battlefield.map((id) => f.objects[id]!).filter((o) => o.cardId === cardId);
  const gy = (f: FinalM, p: 0 | 1) => f.players[p]!.graveyard.map((id) => f.objects[id]!.cardId).sort();
  /** Casts Mastery once — at `when` — on the first offered target whose card is `aim`; attacks with everything; never blocks. */
  const seat0 = (aim: string, when: (v: GameView) => boolean) => { let done = false; return { done: () => done, chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (!done && r.purpose === "priority" && when(v)) { const x = r.actions.find((y) => y.type === "castSpell" && y.targets[0]?.kind === "object" && cardAt(v, (y.targets[0] as { id: string }).id)?.cardId === aim); if (x) { done = true; return x; } }
    return r.actions.find((a) => a.type === "declareAttacker") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? pass(r);
  } }; };
  const lands = [perm(0, "mountain"), perm(0, "plains")];

  it("as printed: {R/W}{R/W} Enchantment — Aura, flash; valid", () => {
    const d = cards.get("intuitive_mastery")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{R/W}{R/W}", types: ["Enchantment"], subtypes: ["Aura"], keywords: ["flash"], source: "custom", shopTier: "R" });
  });

  it("on our Serra Angel, attacking unblocked: 3 in each step — 6", async () => {
    const a = seat0("serra_angel", (v) => v.turn === 1 && v.step === "MAIN1");
    const f = await go([perm(0, "serra_angel"), ...lands], [a, passer]);
    expect(a.done()).toBe(true);
    expect(f.players[1]!.life).toBe(14);
  });

  it("flash: cast on the opponent's turn (their upkeep), it resolves", async () => {
    const a = seat0("serra_angel", (v) => v.turn === 2 && v.activePlayer === 1 && v.step === "UPKEEP");
    const f = await go([perm(0, "serra_angel"), ...lands], [a, passer]);
    expect(a.done()).toBe(true);
    expect(on(f, "intuitive_mastery").length).toBe(1);
  });

  it("on their Raging Goblin (1/1): the −1/−1 kills it, and the Aura goes to our graveyard", async () => {
    const a = seat0("raging_goblin", (v) => v.turn === 1 && v.step === "MAIN1");
    const f = await go([perm(1, "raging_goblin"), ...lands], [a, passer]);
    expect(a.done()).toBe(true);
    expect(on(f, "raging_goblin")).toEqual([]);
    expect(gy(f, 1)).toContain("raging_goblin"); // (and a Forest discarded to hand size at their cleanup)
    expect(gy(f, 0)).toEqual(["intuitive_mastery"]);
  });
});

/** Post-S71a — Command of the Depths ({U/B}{U/B} instant; Chris's): "Choose two — • You draw a card. • Target creature gets −2/−2 until
 * end of turn. • Create a 1/1 blue Faerie creature token with flying. • Target player discards a card." No new word: the six pairs are its
 * modes (CR 700.2a — chosen as it is cast; 700.2d — no mode twice), each pair's effects in printed order (608.2c). "Target player" reads
 * the first target, so a pair with the discard puts the player slot first. The discarder chooses (701.9b). */
describe("Post-S71a — Command of the Depths: choose two of four", () => {
  type FinalC = { objects: Record<string, { cardId: string; controller: number; zone?: string }>; battlefield: string[]; players: { hand: string[]; graveyard: string[] }[] };
  const go = async (mods: Modifier[], agent: Agent) => JSON.parse((await runMatch({ seed: 41, players: [{ name: "a", decklist: [{ cardId: "command_of_the_depths", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(1), modifiers: mods } as MatchSpec, cards, [agent, passer])).finalStateSerialized) as FinalC;
  /** Casts the Command once in the first main phase in `mode`, at the first variant whose targets `ok` accepts. */
  const cmd = (mode: number, ok: (v: GameView, a: Action) => boolean = () => true) => { let done = false; return { done: () => done, chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (!done && r.purpose === "priority" && v.step === "MAIN1") { const x = r.actions.find((y) => y.type === "castSpell" && y.mode === mode && ok(v, y)); if (x) { done = true; return x; } }
    return pass(r);
  } }; };
  const on = (f: FinalC, cardId: string) => f.battlefield.map((id) => f.objects[id]!).filter((o) => o.cardId === cardId);
  const mana = [perm(0, "island"), perm(0, "swamp")];
  const theirs = (v: GameView, a: Action) => (a as { targets: { kind: string; player?: number }[] }).targets.every((t) => t.kind !== "player" || t.player === 1);

  it("as printed: {U/B}{U/B} instant, the six pairs of four modes; valid", () => {
    const d = cards.get("command_of_the_depths")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{U/B}{U/B}", types: ["Instant"], source: "custom", shopTier: "R" });
    expect(d.modes!.length).toBe(6);
    expect(d.modes!.map((m) => (m.targets ?? []).map((t) => t.predicate))).toEqual([["creature"], [], ["player"], ["creature"], ["player", "creature"], ["player"]]);
  });

  it("−2/−2 and a Faerie: their Bears dies, and we have a 1/1 flier", async () => {
    const a = cmd(3);
    const f = await go([...mana, perm(1, "grizzly_bears")], a);
    expect(a.done()).toBe(true);
    expect(on(f, "grizzly_bears")).toEqual([]);
    expect(on(f, "faerie_1_1_u").map((o) => o.controller)).toEqual([0]);
  });

  it("−2/−2 and a discard (the player first): their Bears dies and they discard one", async () => {
    const a = cmd(4, theirs);
    const f = await go([...mana, perm(1, "grizzly_bears")], a);
    expect(a.done()).toBe(true);
    expect(on(f, "grizzly_bears")).toEqual([]);
    expect(f.players[1]!.graveyard.map((id) => f.objects[id]!.cardId).sort()).toEqual(["forest", "grizzly_bears"]);
  });

  it("a draw and a discard aimed at ourselves: we draw, then discard (seven less the Command, plus one, less one)", async () => {
    const a = cmd(2, (v, x) => (x as { targets: { kind: string; player?: number }[] }).targets[0]?.player === 0);
    const f = await go(mana, a);
    expect(a.done()).toBe(true);
    expect(f.players[0]!.hand.length).toBe(6);
    expect(f.players[0]!.graveyard.map((id) => f.objects[id]!.cardId).sort()).toEqual(["command_of_the_depths", "command_of_the_depths"]);
  });
});

/** Post-S71a — Glory Hound ({B/G}{B/G} Dog Spellshaper 2/2; Chris's): "{B/G}{B/G}, Discard a card: Creatures you control get +1/+1
 * and gain menace until end of turn." No new word: Arc Mage's discard cost (no tap — it may be activated again, and the Hound shares
 * the pump), Dawnwing Marshal's team pump, a team keyword grant. Menace: a creature can't be blocked except by two or more creatures
 * (CR 702.111b); the cost's discard is the activating player's choice (601.2h, 701.9b). */
describe("Post-S71a — Glory Hound: discard for the team's +1/+1 and menace", () => {
  type FinalG = { objects: Record<string, { cardId: string; controller: number }>; players: { life: number; hand: string[]; graveyard: string[] }[] };
  /** Activates the Hound once in our first main phase, records the next view, attacks with everything; seat 1 blocks with whatever it can. */
  const hound = () => { let done = false; const a = { after: undefined as GameView | undefined, chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (done && !a.after && r.purpose === "priority" && v.stack.length === 0) a.after = v;
    if (!done && r.purpose === "priority" && v.step === "MAIN1") { const x = r.actions.find((y) => y.type === "activateAbility" && cardAt(v, y.objectId)?.cardId === "glory_hound"); if (x) { done = true; return x; } }
    return r.actions.find((y) => y.type === "declareAttacker") ?? r.actions.find((y) => y.type === "doneDeclaringAttackers") ?? pass(r);
  } }; return a; };
  const blockAny: Agent = { chooseAction: async (_v, r) => r.actions.find((y) => y.type === "declareBlocker") ?? r.actions.find((y) => y.type === "doneDeclaringBlockers") ?? pass(r) };
  const go = async (mods: Modifier[], agents: [Agent, Agent]) => JSON.parse((await runMatch({ seed: 41, players: [{ name: "a", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(1), modifiers: mods } as MatchSpec, cards, agents)).finalStateSerialized) as FinalG;
  const mana = [perm(0, "swamp"), perm(0, "forest")];

  it("as printed: {B/G}{B/G} Creature — Dog Spellshaper 2/2; valid", () => {
    const d = cards.get("glory_hound")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{B/G}{B/G}", types: ["Creature"], subtypes: ["Dog", "Spellshaper"], power: 2, toughness: 2, source: "custom", shopTier: "R" });
  });

  it("activated: a card discarded; the Hound and the Bears 3/3 with menace", async () => {
    const a = hound();
    const f = await go([perm(0, "glory_hound"), perm(0, "grizzly_bears"), ...mana], [a, passer]);
    const mine = a.after!.battlefield.filter((o) => o.controller === 0 && o.power !== null);
    expect(mine.map((o) => [o.cardId, o.power, o.toughness, o.keywords.includes("menace")]).sort()).toEqual([["glory_hound", 3, 3, true], ["grizzly_bears", 3, 3, true]]);
    expect(f.players[0]!.graveyard.map((id) => f.objects[id]!.cardId)).toEqual(["forest"]);
    expect(f.players[0]!.hand.length).toBe(6);
  });

  it("menace: their one Bears cannot block; both attackers connect — 6", async () => {
    const f = await go([perm(0, "glory_hound"), perm(0, "grizzly_bears"), perm(1, "grizzly_bears"), ...mana], [hound(), blockAny]);
    expect(f.players[1]!.life).toBe(14);
  });
});
