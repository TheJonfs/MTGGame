import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Action, ActionRequest, GameView } from "@shandalar/engine";
import { HeuristicAgent } from "./heuristic-agent.js";
import { viewCreatures } from "./combat-sim.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const agent = () => new HeuristicAgent(1, pool, { archetype: "midrange", opponentDecklist: [{ cardId: "swamp", count: 17 }], temperature: 0.35 });

interface Obj { id: string; cardId: string; controller: 0 | 1; tapped?: boolean; power?: number; toughness?: number }
function mkView(o: { hand?: string[]; bf?: Obj[]; life?: [number, number]; step?: string; active?: 0 | 1; yards?: [string[], string[]]; stack?: GameView["stack"]; combat?: GameView["combat"]; librarySizes?: [number, number] }): GameView {
  const yards = o.yards ?? [[], []];
  return {
    you: 0, turn: 6, step: o.step ?? "MAIN1", activePlayer: o.active ?? 0, life: o.life ?? [20, 20], startingLife: 20,
    hand: (o.hand ?? []).map((cardId, i) => ({ objectId: `h_${cardId}_${i}`, cardId })), opponentHandCount: 3, librarySizes: o.librarySizes ?? [20, 20], mulliganCount: 0,
    combat: o.combat ?? { attackers: [], blocks: [] },
    battlefield: (o.bf ?? []).map((b) => { const d = pool.get(b.cardId)!; const c = d.types.includes("Creature"); return { id: b.id, cardId: b.cardId, controller: b.controller, tapped: b.tapped ?? false, damage: 0, attachedTo: null, power: c ? (b.power ?? d.power ?? 0) : null, toughness: c ? (b.toughness ?? d.toughness ?? 0) : null, keywords: [...(d.keywords ?? [])] }; }),
    stack: o.stack ?? [],
    graveyards: [yards[0], yards[1]],
    graveyardObjects: [yards[0].map((cardId, i) => ({ objectId: `g0_${cardId}_${i}`, cardId })), yards[1].map((cardId, i) => ({ objectId: `g1_${cardId}_${i}`, cardId }))],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, pendingEndStepSacrifices: [], pendingCleanupReturns: [],
  } as GameView;
}
const lands = (n: number, cardId: string, controller: 0 | 1 = 0): Obj[] => Array.from({ length: n }, (_, i) => ({ id: `${cardId}_${controller}_${i}`, cardId, controller }));
const act = (objectId: string, abilityIndex: number, targets: Action extends infer A ? (A extends { targets?: infer T } ? T : never) : never = []): Action => ({ type: "activateAbility", objectId, abilityIndex, targets } as Action);
const obj = (id: string) => ({ kind: "object" as const, id });
const face = (player: 0 | 1) => ({ kind: "player" as const, player });

/** S40 (ADR-128, brief Part 3): the flood's AI pins — books 57–66. Every gate is keyed on an ability's SHAPE. */
describe("the book of shame, S40 — the flood's legends and grounds", () => {
  it("book 57 (the Bailiff): the attack trigger bounces their most valuable TAPPED creature; a 'may' whose only targets are ours is declined", async () => {
    const a = agent();
    const v = mkView({ bf: [{ id: "bailiff", cardId: "the_bailiff", controller: 0 }, { id: "angel", cardId: "serra_angel", controller: 1, tapped: true }, { id: "bear", cardId: "grizzly_bears", controller: 1, tapped: true }, { id: "mine", cardId: "man_o_war", controller: 0, tapped: true }] });
    const effects = pool.get("the_bailiff")!.abilities!.flatMap((x) => (x.kind === "triggered" ? x.effects : []));
    const req = { player: 0, purpose: "chooseTarget", actions: ["angel", "bear", "mine"].map((id) => ({ type: "chooseTriggerTargets", targets: [obj(id)] })), source: { cardId: "the_bailiff", effects } } as unknown as ActionRequest;
    expect(await a.chooseAction(v, req)).toEqual({ type: "chooseTriggerTargets", targets: [obj("angel")] });
    const onlyOurs = mkView({ bf: v.battlefield.map((b) => ({ id: b.id, cardId: b.cardId, controller: b.controller, tapped: b.tapped })), stack: [{ id: "s1", kind: "trigger", cardId: "the_bailiff", controller: 0, targets: [obj("mine")] }] });
    const opt = { player: 0, purpose: "optionalTrigger", actions: [{ type: "acceptOptional" }, { type: "declineOptional" }] } as unknown as ActionRequest;
    expect((await a.chooseAction(onlyOurs, opt)).type).toBe("declineOptional");
    const theirs = mkView({ bf: v.battlefield.map((b) => ({ id: b.id, cardId: b.cardId, controller: b.controller, tapped: b.tapped })), stack: [{ id: "s1", kind: "trigger", cardId: "the_bailiff", controller: 0, targets: [obj("angel")] }] });
    expect((await a.chooseAction(theirs, opt)).type).toBe("acceptOptional");
  });

  it("book 58 (Static Sphere): the mark goes on their best creature — never on a permanent of ours", async () => {
    const a = agent();
    const v = mkView({ bf: [{ id: "sphere", cardId: "static_sphere", controller: 0 }, { id: "mine", cardId: "serra_angel", controller: 0 }, { id: "angel", cardId: "air_elemental", controller: 1 }, { id: "bear", cardId: "grizzly_bears", controller: 1 }, ...lands(2, "island", 1)] });
    const effects = pool.get("static_sphere")!.abilities!.flatMap((x) => (x.kind === "triggered" && x.event === "ENTERS_BATTLEFIELD" ? x.effects : []));
    const req = { player: 0, purpose: "chooseTarget", actions: v.battlefield.map((b) => ({ type: "chooseTriggerTargets", targets: [obj(b.id)] })), source: { cardId: "static_sphere", effects } } as unknown as ActionRequest;
    for (let i = 0; i < 5; i++) expect(await a.chooseAction(v, req)).toEqual({ type: "chooseTriggerTargets", targets: [obj("angel")] });
  });

  it("book 59 (Sacred Helix): X for the kill beats X short of it; X for lethal beats everything; the life is priced (face at low life beats passing)", () => {
    const a = agent();
    const v = mkView({ hand: ["sacred_helix"], life: [6, 6], bf: [...lands(4, "mountain"), ...lands(4, "plains"), { id: "wurm", cardId: "pelakka_wurm", controller: 1 }] });
    const cast = (x: number, t: unknown) => a.scorePriorityAction(v, { type: "castSpell", objectId: "h_sacred_helix_0", x, targets: [t] } as Action);
    expect(cast(3, obj("wurm"))).toBeGreaterThan(cast(2, obj("wurm"))); // 7 kills the 7/7; 6 does not
    expect(cast(2, face(1))).toBeGreaterThan(cast(3, obj("wurm"))); // 6 to the face is lethal
    expect(cast(1, face(1))).toBeGreaterThan(a.scorePriorityAction(v, { type: "pass" }));
    expect(cast(1, face(0))).toBeLessThan(a.scorePriorityAction(v, { type: "pass" })); // never our own face
  });

  it("book 60 (the grounds' sinks; the Fordkeeper's pings): gated on our own turn, open at their end step; a ping that kills is always open; at their end step the ping takes a kill, else the face — never a creature it cannot kill", () => {
    const a = agent();
    const court = (step: string, active: 0 | 1) => a.scorePriorityAction(mkView({ step, active, bf: [{ id: "court", cardId: "tallyflame_court", controller: 0 }, ...lands(4, "island")] }), act("court", 2));
    expect(court("MAIN1", 0)).toBe(-Infinity);
    expect(court("END", 1)).toBeGreaterThan(-Infinity);
    const ford = (step: string, active: 0 | 1, t: unknown) => a.scorePriorityAction(mkView({ step, active, bf: [{ id: "ford", cardId: "the_fordkeeper", controller: 0 }, ...lands(4, "mountain"), { id: "lion", cardId: "savannah_lions", controller: 1 }, { id: "giant", cardId: "hill_giant", controller: 1 }] }), act("mountain_0_0", 1, [t] as never));
    expect(ford("MAIN1", 0, face(1))).toBe(-Infinity);
    expect(ford("MAIN1", 0, obj("lion"))).toBeGreaterThan(-Infinity); // the X/1 dies: any time
    expect(ford("END", 1, obj("giant"))).toBe(-Infinity);
    expect(ford("END", 1, face(1))).toBe(-Infinity); // a kill is available: the Lions first
    const noKill = mkView({ step: "END", active: 1, bf: [{ id: "ford", cardId: "the_fordkeeper", controller: 0 }, ...lands(4, "mountain"), { id: "giant", cardId: "hill_giant", controller: 1 }] });
    expect(a.scorePriorityAction(noKill, act("mountain_0_0", 1, [face(1)] as never))).toBeGreaterThan(a.scorePriorityAction(noKill, { type: "pass" })); // the burn is priced WITH the gain
    // Shevelport and Wrackroot and the Observatory.
    const shev = (step: string, active: 0 | 1) => a.scorePriorityAction(mkView({ step, active, yards: [["pacifism"], []], bf: [{ id: "shev", cardId: "shevelport", controller: 0 }, ...lands(4, "forest")] }), act("shev", 2, [obj("g0_pacifism_0")] as never));
    expect(shev("MAIN1", 0)).toBe(-Infinity);
    expect(shev("END", 1)).toBeGreaterThan(-Infinity);
    const wrack = (combat: GameView["combat"], step: string, t: string) => a.scorePriorityAction(mkView({ step, active: 1, combat, bf: [{ id: "wr", cardId: "wrackroot", controller: 0 }, ...lands(5, "island"), { id: "angel", cardId: "serra_angel", controller: 1 }, { id: "bear", cardId: "grizzly_bears", controller: 1 }] }), act("wr", 2, [obj(t)] as never));
    expect(wrack({ attackers: ["bear"], blocks: [] }, "DECLARE_ATTACKERS", "bear")).toBeGreaterThan(-Infinity); // an attacker
    expect(wrack({ attackers: [], blocks: [] }, "END", "angel")).toBeGreaterThan(-Infinity); // their best, at their end step
    expect(wrack({ attackers: [], blocks: [] }, "END", "bear")).toBe(-Infinity);
    const obs = (n: number) => a.scorePriorityAction(mkView({ bf: [{ id: "obs", cardId: "obsidian_observatory", controller: 0 }, ...lands(4, "plains"), ...Array.from({ length: n }, (_, i) => ({ id: `c${i}`, cardId: "grizzly_bears", controller: 0 as const }))] }), act("obs", 2));
    expect(obs(2)).toBe(-Infinity);
    expect(obs(3)).toBeGreaterThan(-Infinity);
  });

  it("book 61 (Isaura): −1/−1 only where it kills, at their end step or in combat; the team counters on our own main phase with three or more creatures", () => {
    const a = agent();
    const base = (step: string, active: 0 | 1, extra: Obj[] = [], combat: GameView["combat"] = { attackers: [], blocks: [] }) => mkView({ step, active, combat, bf: [{ id: "isa", cardId: "isaura_the_levy", controller: 0 }, ...lands(4, "swamp"), { id: "lion", cardId: "savannah_lions", controller: 1 }, { id: "giant", cardId: "hill_giant", controller: 1 }, ...extra] });
    expect(a.scorePriorityAction(base("END", 1), act("isa", 0, [obj("lion")] as never))).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(base("END", 1), act("isa", 0, [obj("giant")] as never))).toBe(-Infinity);
    expect(a.scorePriorityAction(base("MAIN1", 0), act("isa", 0, [obj("lion")] as never))).toBe(-Infinity);
    expect(a.scorePriorityAction(base("DECLARE_BLOCKERS", 1, [], { attackers: ["lion"], blocks: [] }), act("isa", 0, [obj("lion")] as never))).toBeGreaterThan(-Infinity);
    const two: Obj[] = [{ id: "b1", cardId: "grizzly_bears", controller: 0 }];
    const three: Obj[] = [...two, { id: "b2", cardId: "grizzly_bears", controller: 0 }];
    expect(a.scorePriorityAction(base("MAIN1", 0, two), act("isa", 1))).toBe(-Infinity);
    expect(a.scorePriorityAction(base("MAIN1", 0, three), act("isa", 1))).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(base("END", 1, three), act("isa", 1))).toBe(-Infinity);
  });

  it("book 62 (the Reaper): the harvest only for a lethal or near-lethal alpha, before combat; the pick is the body that makes the team biggest, never the Reaper; never down to the last body while behind", async () => {
    const a = agent();
    const snakes = (n: number, p: number): Obj[] => Array.from({ length: n }, (_, i) => ({ id: `sn${i}`, cardId: "snake_1_1_g", controller: 0 as const, power: p + (i === 0 ? 2 : 0), toughness: p + (i === 0 ? 2 : 0) }));
    const v = (life: number, n: number, p: number, step = "MAIN1", theirs: Obj[] = []) => mkView({ step, life: [20, life], bf: [{ id: "reaper", cardId: "the_reaper", controller: 0 }, ...lands(3, "forest"), ...snakes(n, p), ...theirs] });
    expect(a.scorePriorityAction(v(20, 1, 1), act("reaper", 1))).toBe(-Infinity); // 7 through against 20: short of half (S41: the rule is half)
    expect(a.scorePriorityAction(v(20, 2, 1), act("reaper", 1))).toBeGreaterThan(-Infinity); // 7 + 4: past half
    expect(a.scorePriorityAction(v(12, 4, 2), act("reaper", 1))).toBeGreaterThan(-Infinity); // the oldest snake (4) onto 4+2+2+2: lethal
    expect(a.scorePriorityAction(v(12, 4, 2, "MAIN2"), act("reaper", 1))).toBe(-Infinity); // after combat: never
    const view = v(12, 4, 2);
    const req = { player: 0, purpose: "chooseSacrifice", actions: ["reaper", "sn0", "sn1", "sn2", "sn3"].map((objectId) => ({ type: "sacrifice", objectId })), source: { cardId: "the_reaper", effects: (pool.get("the_reaper")!.abilities![1] as { effects: unknown[] }).effects } } as unknown as ActionRequest;
    expect(await a.chooseAction(view, req)).toEqual({ type: "sacrifice", objectId: "sn0" }); // the oldest (largest) snake
    const behind = mkView({ life: [20, 3], bf: [{ id: "reaper", cardId: "the_reaper", controller: 0 }, ...lands(3, "forest"), ...snakes(1, 1), { id: "t1", cardId: "hill_giant", controller: 1, tapped: true }, { id: "t2", cardId: "hill_giant", controller: 1, tapped: true }] });
    expect(a.scorePriorityAction(behind, act("reaper", 1))).toBe(-Infinity);
  });

  it("book 63 (Meliyan; the Cobra): a blocker that dies is worth its power under her; a creature that destroys what it damages trades like deathtouch", () => {
    const a = agent();
    const mk = (withMeliyan: boolean) => mkView({ active: 1, step: "DECLARE_BLOCKERS", bf: [...(withMeliyan ? [{ id: "mel", cardId: "meliyan_the_torment", controller: 0 as const }] : []), { id: "b", cardId: "grizzly_bears", controller: 0, power: 4, toughness: 4 }, { id: "att", cardId: "pelakka_wurm", controller: 1 }] });
    const gain = (v: GameView) => { const cs = viewCreatures(v); return a.blockGain(v, cs.find((c) => c.id === "b")!, cs.find((c) => c.id === "att")!); };
    expect(gain(mk(true))).toBeGreaterThan(gain(mk(false)));
    const cobra = mkView({ active: 1, step: "DECLARE_BLOCKERS", bf: [{ id: "cobra", cardId: "voracious_cobra", controller: 0 }, { id: "att", cardId: "pelakka_wurm", controller: 1 }] });
    const cs = viewCreatures(cobra);
    expect(a.blockGain(cobra, cs.find((c) => c.id === "cobra")!, cs.find((c) => c.id === "att")!)).toBeGreaterThan(0); // first strike + the destroy: the Wurm dies, the Cobra lives
  });

  it("book 64 (the Dredger): the rebuy spends a SPARE land only, takes the dearest spell, at their end step", () => {
    const a = agent();
    const v = (n: number, hand: string[], step = "END", active: 0 | 1 = 1) => mkView({ step, active, hand, yards: [["shock", "wrath_of_god"], []], bf: [{ id: "dr", cardId: "the_dredger", controller: 0 }, ...lands(n, "island")] });
    expect(a.scorePriorityAction(v(7, ["serra_angel"]), act("dr", 0, [obj("g0_wrath_of_god_1")] as never))).toBeGreaterThan(a.scorePriorityAction(v(7, ["serra_angel"]), { type: "pass" })); // 7 > 5 + 1: taken, not merely allowed
    expect(a.scorePriorityAction(v(6, ["serra_angel"]), act("dr", 0, [obj("g0_wrath_of_god_1")] as never))).toBe(-Infinity); // no spare land
    expect(a.scorePriorityAction(v(7, ["serra_angel"]), act("dr", 0, [obj("g0_shock_0")] as never))).toBe(-Infinity); // the Wrath, not the Shock
    expect(a.scorePriorityAction(v(7, ["serra_angel"], "MAIN1", 0), act("dr", 0, [obj("g0_wrath_of_god_1")] as never))).toBe(-Infinity);
  });

  it("book 65 (the Reeve; Cairnbrand): reanimation takes the BEST creature card — in either graveyard for the Reeve; the pyre only when the card beats the cheapest body by two; the Reeve's mill at their end step, at them", () => {
    const a = agent();
    const reeve = (t: string, step = "MAIN1", active: 0 | 1 = 0) => a.scorePriorityAction(mkView({ step, active, yards: [["grizzly_bears"], ["artisan_of_kozilek", "savannah_lions"]], bf: [{ id: "reeve", cardId: "the_reeve", controller: 0 }, ...lands(6, "swamp")] }), act("reeve", 1, [obj(t)] as never));
    expect(reeve("g1_artisan_of_kozilek_0")).toBeGreaterThan(-Infinity);
    expect(reeve("g0_grizzly_bears_0")).toBe(-Infinity);
    const mill = (step: string, active: 0 | 1, p: 0 | 1) => a.scorePriorityAction(mkView({ step, active, bf: [{ id: "reeve", cardId: "the_reeve", controller: 0 }, ...lands(6, "island")] }), act("reeve", 0, [face(p)] as never));
    expect(mill("END", 1, 1)).toBeGreaterThan(-Infinity);
    expect(mill("MAIN1", 0, 1)).toBe(-Infinity);
    expect(mill("END", 1, 0)).toBeLessThan(a.scorePriorityAction(mkView({ step: "END", active: 1 }), { type: "pass" })); // self-mill: never (the evaluator cannot price the larder)
    const pyre = (yard: string, body: string) => a.scorePriorityAction(mkView({ yards: [[yard], []], bf: [{ id: "cb", cardId: "cairnbrand", controller: 0 }, ...lands(6, "swamp"), { id: "body", cardId: body, controller: 0 }] }), act("cb", 2, [obj(`g0_${yard}_0`)] as never));
    expect(pyre("pelakka_wurm", "typhoid_rats")).toBeGreaterThan(-Infinity);
    expect(pyre("grizzly_bears", "serra_angel")).toBe(-Infinity);
  });

  it("book 66 (Ovna): with her on the table an enchantment spell is a cantrip — it outscores the same cast without her by most of a card, and a creature cast gains nothing", () => {
    const a = agent();
    const v = (withOvna: boolean) => mkView({ hand: ["glorious_anthem", "grizzly_bears"], bf: [...(withOvna ? [{ id: "ovna", cardId: "ovna_the_enchantress", controller: 0 as const }] : []), ...lands(4, "plains"), { id: "c", cardId: "savannah_lions", controller: 0 }] });
    const d = (card: string, i: number) => { const s = (w: boolean) => a.scorePriorityAction(v(w), { type: "castSpell", objectId: `h_${card}_${i}`, targets: [] } as Action) - a.scorePriorityAction(v(w), { type: "pass" }); return s(true) - s(false); };
    expect(d("glorious_anthem", 0)).toBeGreaterThan(0.7);
    expect(Math.abs(d("grizzly_bears", 1))).toBeLessThan(0.2);
  });
});
