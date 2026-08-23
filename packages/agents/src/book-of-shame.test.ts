import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { GameView } from "@shandalar/engine";
import { HeuristicAgent } from "./heuristic-agent.js";
import { viewCreatures, type SimObject } from "./combat-sim.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;

/**
 * The book of shame (ADR-049): known-dumb moves pinned as score-ordering
 * assertions over the evaluator/policy. Orderings are noise-immune by
 * design — ADR-050's softmax perturbs selection, never scores.
 */

function agent(archetype: "aggro" | "midrange" | "control" = "midrange"): HeuristicAgent {
  return new HeuristicAgent(1, pool, {
    archetype,
    opponentDecklist: [{ cardId: "swamp", count: 17 }],
    temperature: 0.35,
  });
}

interface Obj {
  id: string;
  cardId: string;
  controller: 0 | 1;
  tapped?: boolean;
  attachedTo?: string | null;
}

function mkView(opts: { hand?: { objectId: string; cardId: string }[]; battlefield?: Obj[]; life?: [number, number] }): GameView {
  return {
    you: 0,
    turn: 5,
    step: "MAIN1",
    activePlayer: 0,
    life: opts.life ?? [20, 20],
    startingLife: 20,
    hand: opts.hand ?? [],
    opponentHandCount: 3,
    librarySizes: [20, 20],
    mulliganCount: 0,
    combat: { attackers: [], blocks: [] },
    battlefield: (opts.battlefield ?? []).map((o) => {
      const def = pool.get(o.cardId)!;
      const isCreature = def.types.includes("Creature");
      return {
        id: o.id,
        cardId: o.cardId,
        controller: o.controller,
        tapped: o.tapped ?? false,
        damage: 0,
        attachedTo: o.attachedTo ?? null,
        power: isCreature ? (def.power ?? 0) : null,
        toughness: isCreature ? (def.toughness ?? 0) : null,
        keywords: [...(def.keywords ?? [])],
      };
    }),
    stack: [],
    graveyards: [[], []],
    graveyardObjects: [[], []],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  };
}

describe("book of shame (permanent; ADR-049/-050 score orderings)", () => {
  it("self-Control-Magic ≈ 0 gain: own-creature steal scores below opponent steal and no better than passing", () => {
    const a = agent();
    const view = mkView({
      hand: [{ objectId: "h_cm", cardId: "control_magic" }],
      battlefield: [
        { id: "mine", cardId: "grizzly_bears", controller: 0 },
        { id: "theirs", cardId: "pelakka_wurm", controller: 1 },
      ],
    });
    const stealTheirs = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_cm", targets: [{ kind: "object", id: "theirs" }] });
    const stealMine = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_cm", targets: [{ kind: "object", id: "mine" }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(stealTheirs).toBeGreaterThan(stealMine);
    expect(stealMine).toBeLessThanOrEqual(pass + 0.05);
  });

  it("re-equipping the same host ≈ 0: scores strictly below passing", () => {
    const a = agent();
    const view = mkView({
      battlefield: [
        { id: "sword", cardId: "bonesplitter", controller: 0, attachedTo: "bear" },
        { id: "bear", cardId: "grizzly_bears", controller: 0 },
      ],
    });
    const reEquip = a.scorePriorityAction(view, { type: "activateAbility", objectId: "sword", abilityIndex: 1, targets: [{ kind: "object", id: "bear" }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(reEquip).toBeLessThan(pass);
  });

  it("burn at own face scores below every other use of the burn spell", () => {
    const a = agent("aggro");
    const view = mkView({
      hand: [{ objectId: "h_bolt", cardId: "lightning_bolt" }],
      battlefield: [
        { id: "mine", cardId: "grizzly_bears", controller: 0 },
        { id: "theirs", cardId: "serra_angel", controller: 1 },
      ],
    });
    const bolt = (target: { kind: "object"; id: string } | { kind: "player"; player: number }) =>
      a.scorePriorityAction(view, { type: "castSpell", objectId: "h_bolt", targets: [target] });
    const ownFace = bolt({ kind: "player", player: 0 });
    expect(bolt({ kind: "player", player: 1 })).toBeGreaterThan(ownFace);
    expect(bolt({ kind: "object", id: "theirs" })).toBeGreaterThan(ownFace);
    expect(bolt({ kind: "object", id: "mine" })).toBeGreaterThan(ownFace); // even friendly fire beats your own face
  });

  it("Hymn at own head: targeted discard at yourself scores below targeting the opponent and below passing", () => {
    // S11, from Chris's playtest (seed 43, E vs D): master cast Hymn to
    // Tourach on itself. view-sim's discard case ignored the chosen target,
    // so both aims predicted the same view — an exact tie softmax coin-flips.
    const a = agent("midrange");
    const view = mkView({
      hand: [
        { objectId: "h_hymn", cardId: "hymn_to_tourach" },
        { objectId: "h_other", cardId: "swamp" },
        { objectId: "h_other2", cardId: "child_of_night" },
      ],
    });
    const hymn = (player: number) =>
      a.scorePriorityAction(view, { type: "castSpell", objectId: "h_hymn", targets: [{ kind: "player", player }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(hymn(1)).toBeGreaterThan(hymn(0));
    expect(hymn(0)).toBeLessThan(pass);
    expect(hymn(1)).toBeGreaterThan(pass);
  });

  it("Blaze for X=0 is never a play (S13 playtest): scores −∞ below passing, while X=1 is a real option", () => {
    const a = agent("aggro");
    const view = mkView({
      hand: [{ objectId: "h_blaze", cardId: "blaze" }],
      battlefield: [{ id: "theirs", cardId: "grizzly_bears", controller: 1 }, { id: "m1", cardId: "mountain", controller: 0 }, { id: "m2", cardId: "mountain", controller: 0 }],
    });
    const zero = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_blaze", x: 0, targets: [{ kind: "player", player: 1 }] });
    const one = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_blaze", x: 1, targets: [{ kind: "player", player: 1 }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(zero).toBe(-Infinity);
    expect(Number.isFinite(one)).toBe(true);
    expect(one).toBeGreaterThan(pass - 5); // a real candidate, not a dead one
  });

  it("Demonic Tutor never fetches a land while the hand holds ≥3 lands (S15 tutor policy); Growth picks the colour we need", () => {
    const a = agent("midrange");
    const view = mkView({
      hand: [{ objectId: "h1", cardId: "swamp" }, { objectId: "h2", cardId: "swamp" }, { objectId: "h3", cardId: "swamp" }, { objectId: "h4", cardId: "vampire_nighthawk" }],
      battlefield: [{ id: "l1", cardId: "swamp", controller: 0 }, { id: "l2", cardId: "swamp", controller: 0 }],
    });
    const req = {
      player: 0 as const, purpose: "searchLibrary" as const,
      actions: [{ type: "declineSearch" }, { type: "searchPick", objectId: "L1" }, { type: "searchPick", objectId: "L2" }, { type: "searchPick", objectId: "L3" }] as never[],
      revealed: [{ objectId: "L1", cardId: "swamp" }, { objectId: "L2", cardId: "typhoid_rats" }, { objectId: "L3", cardId: "nekrataal" }],
    };
    const pick = a.searchChoice(view, req as never) as { type: string; objectId?: string };
    expect(pick.type).toBe("searchPick");
    expect(pick.objectId).not.toBe("L1"); // not the land
    expect(pick.objectId).toBe("L2"); // castable soon (2 lands + 1 ≥ mv 2) beats the 4-drop
    // Growth: a Simic hand short on blue picks the Island.
    const g = mkView({ hand: [{ objectId: "h", cardId: "cloudkin_seer" }], battlefield: [{ id: "f", cardId: "forest", controller: 0 }] });
    const greq = { player: 0 as const, purpose: "searchLibrary" as const, actions: [{ type: "declineSearch" }, { type: "searchPick", objectId: "F" }, { type: "searchPick", objectId: "I" }] as never[], revealed: [{ objectId: "F", cardId: "forest" }, { objectId: "I", cardId: "island" }] };
    expect((a.searchChoice(g, greq as never) as { objectId?: string }).objectId).toBe("I");
    // Lotus is never popped proactively by the AI (S15 v1 rule).
    const lv = mkView({ battlefield: [{ id: "lotus", cardId: "black_lotus", controller: 0 }] });
    expect(a.scorePriorityAction(lv, { type: "activateAbility", objectId: "lotus", abilityIndex: 0, targets: [], color: "G" })).toBe(-Infinity);
  });

  it("chump-block into nothing has negative gain: no block beats losing the blocker for free", () => {
    const a = agent();
    const view = mkView({
      battlefield: [
        { id: "chump", cardId: "goblin_piker", controller: 0 },
        { id: "wurm", cardId: "pelakka_wurm", controller: 1 },
      ],
    });
    const chump: SimObject = { id: "chump", controller: 0, power: 2, toughness: 1, keywords: [], tapped: false, damage: 0 };
    const wurm: SimObject = { id: "wurm", controller: 1, power: 7, toughness: 7, keywords: ["trample"], tapped: false, damage: 0 };
    expect(a.blockGain(view, chump, wurm)).toBeLessThan(0);
  });

  it("deterrence (ADR-060.1): a deathtouch 1/1 facing a bigger board holds rather than attacking to die for nothing", async () => {
    const a = agent("midrange");
    const view = mkView({
      battlefield: [
        { id: "rats", cardId: "typhoid_rats", controller: 0 },
        { id: "courser", cardId: "centaur_courser", controller: 1 },
        { id: "bears", cardId: "grizzly_bears", controller: 1 },
      ],
    });
    // Attacking scores below the empty attack set (0): the rat's deterrence
    // as a stay-home deathtouch blocker exceeds its 1 unblocked damage.
    expect(await a.scoreAttackSet(view, viewCreatures(view), 0, ["rats"])).toBeLessThan(0);
    // With no opposing creatures there is nothing to deter — attack freely.
    // (Fresh agent: the sim memo keys by turn/set/life, not board — sound in
    // live play where the board is stable across one combat's declarations.)
    const open = mkView({ battlefield: [{ id: "rats", cardId: "typhoid_rats", controller: 0 }] });
    expect(await agent("midrange").scoreAttackSet(open, viewCreatures(open), 0, ["rats"])).toBeGreaterThan(0);
  });

  it("book of shame 10 (S16): the Cathartic Adept mills the OPPONENT, never its own controller — self-mill scores below passing, opponent-mill above it", () => {
    const a = agent("control");
    const view = mkView({
      battlefield: [
        { id: "adept", cardId: "cathartic_adept", controller: 0 },
        { id: "island", cardId: "island", controller: 0 },
      ],
    });
    const millThem = a.scorePriorityAction(view, { type: "activateAbility", objectId: "adept", abilityIndex: 0, targets: [{ kind: "player", player: 1 }] });
    const millMe = a.scorePriorityAction(view, { type: "activateAbility", objectId: "adept", abilityIndex: 0, targets: [{ kind: "player", player: 0 }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(millThem).toBeGreaterThan(millMe);
    expect(millMe).toBeLessThan(pass);
    expect(millThem).toBeGreaterThan(pass);
  });

  it("book of shame 11 (S16, Chris's playtest): at 5 life facing 3/3 + 3/3 + 1/1 with one 2/2, block a 3/3 and live — not the 1/1 for value and die", () => {
    const a = agent("midrange");
    const view = mkView({
      life: [5, 20],
      battlefield: [
        { id: "manowar", cardId: "man_o_war", controller: 0 },
        { id: "c1", cardId: "centaur_courser", controller: 1 },
        { id: "c2", cardId: "centaur_courser", controller: 1 },
        { id: "p1", cardId: "llanowar_elves", controller: 1 }, // the 1/1 — a free kill for a 2/2
      ],
    });
    const plan = a.planBlocks(view, ["c1", "c2", "p1"]);
    expect(plan).toHaveLength(1);
    expect(["c1", "c2"]).toContain(plan[0]!.attacker); // 7 − 3 = 4 < 5: live at 1; blocking the 1/1 leaves 6 — dead
    // Life 6, same board: still a Courser (5 < 6 vs 6 — dead).
    const view6 = mkView({ life: [6, 20], battlefield: view.battlefield.map((o) => ({ id: o.id, cardId: o.cardId, controller: o.controller })) });
    const plan6 = a.planBlocks(view6, ["c1", "c2", "p1"]);
    expect(plan6).toHaveLength(1);
    expect(["c1", "c2"]).toContain(plan6[0]!.attacker);
    // Not lethal (life 20): the value block (kill the Elves, survive) is the right call.
    const view20 = mkView({ life: [20, 20], battlefield: view.battlefield.map((o) => ({ id: o.id, cardId: o.cardId, controller: o.controller })) });
    expect(a.planBlocks(view20, ["c1", "c2", "p1"])[0]!.attacker).toBe("p1");
    // Two blockers, still lethal after one: both go to the big attackers.
    const view2 = mkView({ life: [4, 20], battlefield: [...view.battlefield.map((o) => ({ id: o.id, cardId: o.cardId, controller: o.controller })), { id: "bear", cardId: "grizzly_bears", controller: 0 as const }] });
    const plan2 = a.planBlocks(view2, ["c1", "c2", "p1"]);
    expect(plan2.map((b) => b.attacker).sort()).toEqual(["c1", "c2"]); // 7 − 3 − 3 = 1 < 4
  });

  it("book of shame 12 (S17): Dark Ritual into nothing is never cast; Ritual that enables a Specter this step is; Skirk Prospector's sacrifice follows the same rule", () => {
    const a = agent("midrange");
    // One Swamp, Ritual + Specter ({1}{B}{B}) in hand: Ritual enables the Specter → a play.
    const enabling = mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "spec", cardId: "hypnotic_specter" }], battlefield: [{ id: "sw", cardId: "swamp", controller: 0 }] });
    const castRitual = a.scorePriorityAction(enabling, { type: "castSpell", objectId: "rit", targets: [] });
    const pass = a.scorePriorityAction(enabling, { type: "pass" });
    expect(castRitual).toBeGreaterThan(pass);
    // Ritual with nothing to cast after it: never.
    const nothing = mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }], battlefield: [{ id: "sw", cardId: "swamp", controller: 0 }] });
    expect(a.scorePriorityAction(nothing, { type: "castSpell", objectId: "rit", targets: [] })).toBe(-Infinity);
    // Ritual when the Specter is castable anyway (three Swamps): never — it would burn a card.
    const affordable = mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "spec", cardId: "hypnotic_specter" }], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }] });
    expect(a.scorePriorityAction(affordable, { type: "castSpell", objectId: "rit", targets: [] })).toBe(-Infinity);
    // Prospector: sacrifice a Goblin for {R} only when it enables a cast (Mountain + Prospector + a Goblin; Piker {1}{R} in hand).
    const pros = mkView({ hand: [{ objectId: "pk", cardId: "goblin_piker" }], battlefield: [{ id: "m", cardId: "mountain", controller: 0 }, { id: "pr", cardId: "skirk_prospector", controller: 0 }, { id: "rg", cardId: "raging_goblin", controller: 0 }] });
    expect(a.scorePriorityAction(pros, { type: "activateAbility", objectId: "pr", abilityIndex: 0, targets: [] })).toBeGreaterThan(a.scorePriorityAction(pros, { type: "pass" }));
    const prosIdle = mkView({ hand: [], battlefield: pros.battlefield.map((o) => ({ id: o.id, cardId: o.cardId, controller: o.controller })) });
    expect(a.scorePriorityAction(prosIdle, { type: "activateAbility", objectId: "pr", abilityIndex: 0, targets: [] })).toBe(-Infinity);
  });

  it("book of shame 13 (S17): cycling Airship Crash while a flier/artifact/enchantment is on the board is never a play; with nothing to crash it is a cantrip above passing", () => {
    const a = agent("midrange");
    const live = mkView({ hand: [{ objectId: "ac", cardId: "airship_crash" }], battlefield: [{ id: "f1", cardId: "forest", controller: 0 }, { id: "f2", cardId: "forest", controller: 0 }, { id: "wd", cardId: "wind_drake", controller: 1 }] });
    const cycleIdx = 1; // the loader appends the compiled cycling ability after the card's own abilities (Crash has none → index 0? it has none, so 0)
    void cycleIdx;
    const cycle = { type: "activateAbility" as const, objectId: "ac", abilityIndex: 0, targets: [] };
    expect(a.scorePriorityAction(live, cycle)).toBe(-Infinity);
    const dead = mkView({ hand: [{ objectId: "ac", cardId: "airship_crash" }], battlefield: [{ id: "f1", cardId: "forest", controller: 0 }, { id: "f2", cardId: "forest", controller: 0 }, { id: "gb", cardId: "grizzly_bears", controller: 1 }] });
    expect(a.scorePriorityAction(dead, cycle)).toBeGreaterThan(a.scorePriorityAction(dead, { type: "pass" }));
  });

  it("book of shame 14 (S17): Aether Channeler bounces a Serra Angel, draws into an empty board, and never picks the bird over a bounce of a real threat", () => {
    const a = agent("control");
    const req = (modes: number[]) => ({ player: 0 as const, purpose: "chooseMode" as const, actions: modes.map((m) => ({ type: "chooseMode" as const, mode: m, label: ["Create a 1/1 white Bird creature token with flying", "Return another target nonland permanent to its owner's hand", "Draw a card"][m]! })) });
    const serra = mkView({ battlefield: [{ id: "ch", cardId: "aether_channeler", controller: 0 }, { id: "sa", cardId: "serra_angel", controller: 1 }] });
    expect((a.modeChoice(serra, req([0, 1, 2])) as { mode: number }).mode).toBe(1);
    const empty = mkView({ battlefield: [{ id: "ch", cardId: "aether_channeler", controller: 0 }] });
    expect((a.modeChoice(empty, req([0, 2])) as { mode: number }).mode).toBe(2);
    const chaff = mkView({ battlefield: [{ id: "ch", cardId: "aether_channeler", controller: 0 }, { id: "rg", cardId: "raging_goblin", controller: 1 }] });
    expect((a.modeChoice(chaff, req([0, 1, 2])) as { mode: number }).mode).toBe(2); // a 1/1 isn't worth the bounce
  });

  it("tapping an own creature with the Tactician for no benefit scores below passing", () => {
    const a = agent();
    const view = mkView({
      battlefield: [
        { id: "tact", cardId: "cunning_tactician", controller: 0 },
        { id: "bear", cardId: "grizzly_bears", controller: 0 },
        { id: "plains", cardId: "plains", controller: 0 },
      ],
    });
    const tapOwn = a.scorePriorityAction(view, { type: "activateAbility", objectId: "tact", abilityIndex: 0, targets: [{ kind: "object", id: "bear" }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(tapOwn).toBeLessThan(pass);
  });
});
