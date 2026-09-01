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

function mkView(opts: {
  hand?: { objectId: string; cardId: string }[];
  battlefield?: Obj[];
  life?: [number, number];
  /** S22 playtest r3 additions: the new gates read these. */
  stack?: { id: string; kind: string; cardId: string; controller: 0 | 1 }[];
  opponentHandCount?: number;
  combat?: { attackers: string[]; blocks: { blocker: string; attacker: string }[] };
  step?: string;
  activePlayer?: 0 | 1;
  /** S25: the Cleric's library-floor pin reads it. */
  librarySizes?: [number, number];
}): GameView {
  return {
    you: 0,
    turn: 5,
    step: opts.step ?? "MAIN1",
    activePlayer: opts.activePlayer ?? 0,
    life: opts.life ?? [20, 20],
    startingLife: 20,
    hand: opts.hand ?? [],
    opponentHandCount: opts.opponentHandCount ?? 3,
    librarySizes: opts.librarySizes ?? [20, 20],
    mulliganCount: 0,
    combat: opts.combat ?? { attackers: [], blocks: [] },
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
    stack: opts.stack ?? [],
    graveyards: [[], []],
    graveyardObjects: [[], []],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    pendingEndStepSacrifices: [],
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

  it("book of shame 15 (S18, Chris's Nighthawk game): the Aristocrat's sacrifice takes the Typhoid Rats, never the Blood Artist (an engine AND a Vampire that would get the counter)", () => {
    const a = agent("midrange");
    const src = { cardId: "indulgent_aristocrat", effects: [{ type: "addCounters" as const, kind: "+1/+1" as const, count: 1, scope: "creaturesYouControl" as const, subtype: "Vampire" }] };
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "chooseSacrifice" as const, actions: ids.map((objectId) => ({ type: "sacrifice" as const, objectId })), source: src as never });
    const v = mkView({ battlefield: [{ id: "ar", cardId: "indulgent_aristocrat", controller: 0 }, { id: "ba", cardId: "blood_artist", controller: 0 }, { id: "rats", cardId: "typhoid_rats", controller: 0 }] });
    expect((a.sacrificeChoice(v, req(["ar", "ba", "rats"])) as { objectId: string }).objectId).toBe("rats");
    // Without the source (an unknown sacrifice), the Rats still beat the Artist: the engine bonus alone does it.
    expect((a.sacrificeChoice(v, { ...req(["ba", "rats"]), source: undefined } as never) as { objectId: string }).objectId).toBe("rats");
  });

  it("book of shame 16 (S18, Chris's Nighthawk game): three X/1s facing one untapped 1/1 swing (two get through) — greedy addition found nothing, the swarm search does; one lone 2/1 into the 1/1 still stays home", async () => {
    const a = agent("midrange");
    const swarm = mkView({
      life: [20, 20],
      battlefield: [
        { id: "c1", cardId: "child_of_night", controller: 0 }, // 2/1 lifelink
        { id: "c2", cardId: "child_of_night", controller: 0 },
        { id: "c3", cardId: "typhoid_rats", controller: 0 }, // 1/1 deathtouch
        { id: "ad", cardId: "cathartic_adept", controller: 1 }, // their lone 1/1
      ],
    });
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "declareAttacker" as const, actions: [...ids.map((objectId) => ({ type: "declareAttacker" as const, objectId })), { type: "doneDeclaringAttackers" as const }] });
    const pick = await a.attackChoice(swarm, req(["c1", "c2", "c3"]));
    expect(pick.type).toBe("declareAttacker"); // something attacks
    // Score check: the full swarm beats staying home; a lone Child does not.
    expect(await a.scoreAttackSet(swarm, viewCreatures(swarm), 0, ["c1", "c2", "c3"])).toBeGreaterThan(0);
    expect(await a.scoreAttackSet(swarm, viewCreatures(swarm), 0, ["c1"])).toBeLessThan(0.01);
    const lone = mkView({ battlefield: [{ id: "c1", cardId: "child_of_night", controller: 0 }, { id: "ad", cardId: "cathartic_adept", controller: 1 }] });
    expect((await a.attackChoice(lone, req(["c1"]))).type).toBe("doneDeclaringAttackers");
  });

  it("book of shame 17 (S20): never pay 2 life at or below the floor — a shock at life ≤ 4 always enters tapped; at healthy life it pays exactly when the untapped source enables a cast this main phase", () => {
    const a = agent("midrange");
    const req = { player: 0 as const, purpose: "entersChoice" as const, actions: [{ type: "acceptOptional" as const }, { type: "declineOptional" as const }] };
    const board = (life: number, hand: string[], lands = 1) => {
      const v = mkView({ life: [life, 20], hand: hand.map((cardId, i) => ({ objectId: `h${i}`, cardId })), battlefield: Array.from({ length: lands }, (_, i) => ({ id: `l${i}`, cardId: "plains", controller: 0 as const })) });
      return v;
    };
    // Life 2 (the engine's minimum ask): paying is paying to 0 — never.
    expect(a.entersChoice(board(2, ["savannah_lions"]), req as never).type).toBe("declineOptional");
    // Life 4 (the floor): still no.
    expect(a.entersChoice(board(4, ["grizzly_bears"]), req as never).type).toBe("declineOptional");
    // Life 10, a two-drop in hand, one untapped land: the shock closes the gap this main → pay.
    expect(a.entersChoice(board(10, ["grizzly_bears"]), req as never).type).toBe("acceptOptional");
    // Life 10 but nothing the extra mana enables → keep the life.
    expect(a.entersChoice(board(10, ["serra_angel"]), req as never).type).toBe("declineOptional");
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

  // ---------- S22 playtest r3 (Chris's hard seed-42 run: the misplay cluster) ----------

  it("book of shame 18 (r3): countering your OWN spell falls off the misaim cliff; countering theirs does not", () => {
    const a = agent("control");
    const view = mkView({
      hand: [{ objectId: "h_cs", cardId: "counterspell" }],
      stack: [
        { id: "stk_mine", kind: "spell", cardId: "swords_to_plowshares", controller: 0 },
        { id: "stk_theirs", kind: "spell", cardId: "serra_angel", controller: 1 },
      ],
    });
    const counterTheirs = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_cs", targets: [{ kind: "stackItem", id: "stk_theirs" }] });
    const counterMine = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_cs", targets: [{ kind: "stackItem", id: "stk_mine" }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(counterTheirs).toBeGreaterThan(counterMine);
    expect(counterMine).toBeLessThan(pass - 50); // the cliff: unreachable at any temperature
  });

  it("book of shame 19 (r3): removal at your own creature falls off the misaim cliff (Swords, Boomerang-own-Island, Mind-Rot-self)", () => {
    const a = agent();
    const view = mkView({
      hand: [
        { objectId: "h_swords", cardId: "swords_to_plowshares" },
        { objectId: "h_boom", cardId: "boomerang" },
        { objectId: "h_rot", cardId: "mind_rot" },
      ],
      battlefield: [
        { id: "mine", cardId: "grizzly_bears", controller: 0 },
        { id: "my_island", cardId: "island", controller: 0 },
        { id: "theirs", cardId: "serra_angel", controller: 1 },
        { id: "their_island", cardId: "island", controller: 1 },
      ],
    });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    const cast = (objectId: string, target: { kind: "object"; id: string } | { kind: "player"; player: 0 | 1 }) =>
      a.scorePriorityAction(view, { type: "castSpell", objectId, targets: [target] });
    // Swords: own creature is a cliff, theirs is a fine play.
    expect(cast("h_swords", { kind: "object", id: "mine" })).toBeLessThan(pass - 50);
    expect(cast("h_swords", { kind: "object", id: "theirs" })).toBeGreaterThan(pass);
    // Boomerang: our own Island (the seed-42 tempo suicide) is a cliff.
    expect(cast("h_boom", { kind: "object", id: "my_island" })).toBeLessThan(pass - 50);
    expect(cast("h_boom", { kind: "object", id: "my_island" })).toBeLessThan(cast("h_boom", { kind: "object", id: "their_island" }));
    // Mind Rot at our own head is a cliff; at theirs it is a play.
    expect(cast("h_rot", { kind: "player", player: 0 })).toBeLessThan(pass - 50);
    expect(cast("h_rot", { kind: "player", player: 1 })).toBeGreaterThan(cast("h_rot", { kind: "player", player: 0 }));
  });

  it("book of shame 20 (r3): a helpful aura on the OPPONENT's creature falls off the misaim cliff (the Rancor gift)", () => {
    const a = agent();
    const view = mkView({
      hand: [{ objectId: "h_rancor", cardId: "rancor" }],
      battlefield: [
        { id: "mine", cardId: "grizzly_bears", controller: 0 },
        { id: "theirs", cardId: "serra_angel", controller: 1 },
      ],
    });
    const onMine = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_rancor", targets: [{ kind: "object", id: "mine" }] });
    const onTheirs = a.scorePriorityAction(view, { type: "castSpell", objectId: "h_rancor", targets: [{ kind: "object", id: "theirs" }] });
    const pass = a.scorePriorityAction(view, { type: "pass" });
    expect(onMine).toBeGreaterThan(onTheirs);
    expect(onTheirs).toBeLessThan(pass - 50);
  });

  it("book of shame 21 (r3): all-discard spells at an empty hand are gated at -Infinity (Duress/Mind Rot into nothing)", () => {
    const a = agent();
    const empty = mkView({
      hand: [
        { objectId: "h_duress", cardId: "duress" },
        { objectId: "h_rot", cardId: "mind_rot" },
      ],
      opponentHandCount: 0,
    });
    expect(a.scorePriorityAction(empty, { type: "castSpell", objectId: "h_duress", targets: [{ kind: "player", player: 1 }] })).toBe(-Infinity);
    expect(a.scorePriorityAction(empty, { type: "castSpell", objectId: "h_rot", targets: [{ kind: "player", player: 1 }] })).toBe(-Infinity);
    // With a card to take, the gate lifts.
    const full = mkView({ hand: [{ objectId: "h_duress", cardId: "duress" }], opponentHandCount: 2 });
    expect(a.scorePriorityAction(full, { type: "castSpell", objectId: "h_duress", targets: [{ kind: "player", player: 1 }] })).toBeGreaterThan(-Infinity);
  });

  it("book of shame 23 (S23): the Thundersnake casts only on its own MAIN1 with no wall standing — MAIN2, the opponent's turn, and a 5-toughness untapped defender all gate at -Infinity", () => {
    const a = agent("aggro");
    const base = { hand: [{ objectId: "h_snake", cardId: "thundersnake" }], battlefield: [{ id: "m1", cardId: "mountain", controller: 0 as const }, { id: "m2", cardId: "mountain", controller: 0 as const }] };
    const cast = (view: GameView) => a.scorePriorityAction(view, { type: "castSpell", objectId: "h_snake", targets: [] });
    expect(Number.isFinite(cast(mkView(base)))).toBe(true); // own MAIN1, clear road: a real play
    expect(cast(mkView({ ...base, step: "MAIN2" }))).toBe(-Infinity); // the haste evaporates at END
    expect(cast(mkView({ ...base, activePlayer: 1 }))).toBe(-Infinity); // not our turn
    // A 5/5 untapped defender eats the whole 4/1 for nothing (toughness ≥ power blanks the trample).
    const walled = mkView({ ...base, battlefield: [...base.battlefield, { id: "wall", cardId: "gallows_djinn", controller: 1 as const }] });
    expect(cast(walled)).toBe(-Infinity);
    // The same wall TAPPED cannot block: the window is open.
    const tappedWall = mkView({ ...base, battlefield: [...base.battlefield, { id: "wall", cardId: "gallows_djinn", controller: 1 as const, tapped: true }] });
    expect(Number.isFinite(cast(tappedWall))).toBe(true);
  });

  it("book of shame 24 (S23): the Gallows Djinn never attacks or blocks at life 1 (the tax is lethal); at healthy life both are priced, not banned", async () => {
    const a = agent("midrange");
    const req = { player: 0 as const, purpose: "declareAttacker" as const, actions: [{ type: "doneDeclaringAttackers" as const }, { type: "declareAttacker" as const, objectId: "djinn" }] };
    const board = (life: number) => mkView({ life: [life, 20], battlefield: [{ id: "djinn", cardId: "gallows_djinn", controller: 0 }] });
    expect((await a.attackChoice(board(1), req as never)).type).toBe("doneDeclaringAttackers"); // never
    expect((await a.attackChoice(board(20), req as never)).type).toBe("declareAttacker"); // free 5 damage, priced tax
    // Blocks: at life 1 the Djinn stands aside even against lethal-looking swarms; at 20 it eats a bear.
    const blockBoard = (life: number) => mkView({ life: [life, 20], battlefield: [{ id: "djinn", cardId: "gallows_djinn", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 1 }], combat: { attackers: ["bear"], blocks: [] } });
    expect(a.planBlocks(blockBoard(1), ["bear"])).toEqual([]);
    expect(a.planBlocks(blockBoard(20), ["bear"])).toEqual([{ blocker: "djinn", attacker: "bear" }]);
  });

  it("book of shame 22 (r3): Giant Growth outside combat with an empty stack is gated at -Infinity; in combat it is a real trick", () => {
    const a = agent();
    const base = {
      hand: [{ objectId: "h_gg", cardId: "giant_growth" }],
      battlefield: [
        { id: "mine", cardId: "grizzly_bears", controller: 0 as const },
        { id: "theirs", cardId: "serra_angel", controller: 1 as const },
      ],
    };
    const idle = mkView(base); // main phase, empty stack — the "maximize mana usage" waste
    expect(a.scorePriorityAction(idle, { type: "castSpell", objectId: "h_gg", targets: [{ kind: "object", id: "mine" }] })).toBe(-Infinity);
    // Combat live, our bear attacking: pumping it beats passing (the material credit stands in).
    const combat = mkView({ ...base, combat: { attackers: ["mine"], blocks: [{ blocker: "theirs", attacker: "mine" }] } });
    const pumpAttacker = a.scorePriorityAction(combat, { type: "castSpell", objectId: "h_gg", targets: [{ kind: "object", id: "mine" }] });
    const pass = a.scorePriorityAction(combat, { type: "pass" });
    expect(pumpAttacker).toBeGreaterThan(pass);
    // An opponent spell on the stack lifts the gate too (the save is a legitimate window).
    const threatened = mkView({ ...base, stack: [{ id: "stk_bolt", kind: "spell", cardId: "lightning_bolt", controller: 1 }] });
    expect(a.scorePriorityAction(threatened, { type: "castSpell", objectId: "h_gg", targets: [{ kind: "object", id: "mine" }] })).toBeGreaterThan(-Infinity);
  });

  it("book of shame 27 (S26, the Mirror's honesty): the Lotus pops only when its three mana enable a cast this step, and only in a colour that cast wants — idle windows and wrong colours stay gated", () => {
    const a = agent();
    // Two Islands untapped, Air Elemental ({3}{U}{U}) in hand: the Lotus for blue enables it; for red it does not; with nothing to enable it stays shut.
    const view = (hand: { objectId: string; cardId: string }[]) =>
      mkView({ hand, battlefield: [{ id: "lotus", cardId: "black_lotus", controller: 0 }, { id: "i1", cardId: "island", controller: 0 }, { id: "i2", cardId: "island", controller: 0 }] });
    const pop = (color: "W" | "U" | "B" | "R" | "G") => ({ type: "activateAbility" as const, objectId: "lotus", abilityIndex: 0, targets: [], color });
    const elemental = view([{ objectId: "h1", cardId: "air_elemental" }]);
    expect(a.scorePriorityAction(elemental, pop("U"))).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(elemental, pop("R"))).toBe(-Infinity);
    expect(a.scorePriorityAction(view([{ objectId: "h1", cardId: "counterspell" }]), pop("U"))).toBe(-Infinity); // already castable off two Islands
    expect(a.scorePriorityAction(view([]), pop("U"))).toBe(-Infinity); // nothing to enable
  });

  it("book of shame 26 (S26, the Corolla's pins): Lumen steals only on her own MAIN1 (the swing must cash); Clio holds the burst while the hand is stocked and the board threatens, spends when either runs thin", () => {
    const a = agent();
    const lumen = (step: string, activePlayer: 0 | 1 = 0) =>
      mkView({ step, activePlayer, battlefield: [{ id: "lumen", cardId: "lumen_the_hearth_fire", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 1 }] });
    const steal = { type: "activateAbility" as const, objectId: "lumen", abilityIndex: 0, targets: [{ kind: "object" as const, id: "bear" }] };
    expect(a.scorePriorityAction(lumen("MAIN1"), steal)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(lumen("MAIN2"), steal)).toBe(-Infinity);
    expect(a.scorePriorityAction(lumen("MAIN1", 1), steal)).toBe(-Infinity); // the opponent's turn: nothing to cash
    // Clio: the enumerator withholds the burst under three counters; the pin decides the rest.
    const clio = (hand: number, oppCreatures: number) =>
      mkView({
        hand: Array.from({ length: hand }, (_, i) => ({ objectId: `h${i}`, cardId: "island" })),
        battlefield: [
          { id: "clio", cardId: "clio_lady_of_the_depths", controller: 0 }, { id: "i", cardId: "island", controller: 0 }, { id: "s", cardId: "swamp", controller: 0 },
          ...Array.from({ length: oppCreatures }, (_, i) => ({ id: `b${i}`, cardId: "grizzly_bears", controller: 1 as const })),
        ],
      });
    const burst = { type: "activateAbility" as const, objectId: "clio", abilityIndex: 2, targets: [] };
    expect(a.scorePriorityAction(clio(3, 2), burst)).toBe(-Infinity); // hold: stocked hand, threatening board
    expect(a.scorePriorityAction(clio(1, 2), burst)).toBeGreaterThan(-Infinity); // the hand ran low
    expect(a.scorePriorityAction(clio(4, 1), burst)).toBeGreaterThan(-Infinity); // the board is thin
  });

  it("book of shame 25 (S25, the court's floors — the pin-17 family): the Witch stops at life 2, the Tyrant never pulls a lethal recoil, the Cleric never walks the library under 3", () => {
    const a = agent();
    // The Witch: pay 2 life, draw — legal to exactly 0 (CR 118.4), gated at life ≤ 2.
    const witch = (life: number) => mkView({ life: [life, 20], battlefield: [{ id: "witch", cardId: "the_jet_witch", controller: 0 }] });
    expect(a.scorePriorityAction(witch(2), { type: "activateAbility", objectId: "witch", abilityIndex: 0, targets: [] })).toBe(-Infinity);
    expect(a.scorePriorityAction(witch(12), { type: "activateAbility", objectId: "witch", abilityIndex: 0, targets: [] })).toBeGreaterThan(-Infinity);
    // The Tyrant: the recoil (1 to you) never meets-or-beats current life (the Djinn's sibling).
    const tyrant = (life: number) => mkView({ life: [life, 20], battlefield: [{ id: "tyrant", cardId: "the_ruby_tyrant", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 1 }] });
    expect(a.scorePriorityAction(tyrant(1), { type: "activateAbility", objectId: "tyrant", abilityIndex: 0, targets: [{ kind: "object", id: "bear" }] })).toBe(-Infinity);
    expect(a.scorePriorityAction(tyrant(10), { type: "activateAbility", objectId: "tyrant", abilityIndex: 0, targets: [{ kind: "object", id: "bear" }] })).toBeGreaterThan(-Infinity);
    // The Cleric: an exile-top cost that leaves the library under 3 is the DECKED walk.
    const cleric = (lib: number) => mkView({ librarySizes: [lib, 20], battlefield: [{ id: "cleric", cardId: "the_pearl_cleric", controller: 0 }] });
    expect(a.scorePriorityAction(cleric(3), { type: "activateAbility", objectId: "cleric", abilityIndex: 0, targets: [] })).toBe(-Infinity);
    expect(a.scorePriorityAction(cleric(12), { type: "activateAbility", objectId: "cleric", abilityIndex: 0, targets: [] })).toBeGreaterThan(-Infinity);
  });
});
