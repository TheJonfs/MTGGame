import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { GameView } from "@shandalar/engine";
import { readFileSync } from "node:fs";
import { HeuristicAgent } from "./heuristic-agent.js";
import { difficultyProfile } from "./evaluator.js";
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
  /** S45 follow-up: entered this turn without haste (the view's flag). */
  summoningSick?: boolean;
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
        ...(o.summoningSick ? { summoningSick: true } : {}),
      };
    }),
    stack: opts.stack ?? [],
    graveyards: [[], []],
    graveyardObjects: [[], []],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    pendingEndStepSacrifices: [], pendingCleanupReturns: [],
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
    // Combat live, our bear attacking, the blocks declared (r9: the DECLARE_BLOCKERS round): pumping it beats passing.
    const combat = mkView({ ...base, step: "DECLARE_BLOCKERS", combat: { attackers: ["mine"], blocks: [{ blocker: "theirs", attacker: "mine" }] } });
    const pumpAttacker = a.scorePriorityAction(combat, { type: "castSpell", objectId: "h_gg", targets: [{ kind: "object", id: "mine" }] });
    const pass = a.scorePriorityAction(combat, { type: "pass" });
    expect(pumpAttacker).toBeGreaterThan(pass);
    // An opponent spell on the stack lifts the gate too (the save is a legitimate window).
    const threatened = mkView({ ...base, stack: [{ id: "stk_bolt", kind: "spell", cardId: "lightning_bolt", controller: 1 }] });
    expect(a.scorePriorityAction(threatened, { type: "castSpell", objectId: "h_gg", targets: [{ kind: "object", id: "mine" }] })).toBeGreaterThan(-Infinity);
  });

  it("book of shame 54 (deploy playtest r9): a second Pacifism on a pacified creature, or a Spirit Link on one, scores below passing; a fresh Pacifism on an unenchanted creature does not; a steal aura on a pacified creature still steals", () => {
    const a = agent();
    const pass = (v: ReturnType<typeof mkView>) => a.scorePriorityAction(v, { type: "pass" });
    const cast = (v: ReturnType<typeof mkView>, card: string, host: string) => a.scorePriorityAction(v, { type: "castSpell", objectId: card, targets: [{ kind: "object", id: host }] });
    const pacified = mkView({
      hand: [{ objectId: "h_pac", cardId: "pacifism" }, { objectId: "h_link", cardId: "spirit_link" }, { objectId: "h_cm", cardId: "control_magic" }],
      battlefield: [
        { id: "plains1", cardId: "plains", controller: 0 }, { id: "plains2", cardId: "plains", controller: 0 }, { id: "island1", cardId: "island", controller: 0 }, { id: "island2", cardId: "island", controller: 0 },
        { id: "angel", cardId: "serra_angel", controller: 1 }, { id: "pac_on", cardId: "pacifism", controller: 0, attachedTo: "angel" },
        { id: "bear", cardId: "grizzly_bears", controller: 1 },
      ],
    });
    expect(cast(pacified, "h_pac", "angel")).toBeLessThan(pass(pacified)); // the same aura twice: nothing
    expect(cast(pacified, "h_link", "angel")).toBeLessThan(pass(pacified)); // a lifelink aura on a creature that cannot deal damage: nothing
    expect(cast(pacified, "h_pac", "bear")).toBeGreaterThan(pass(pacified)); // the Bears are unenchanted: a real Pacifism
    expect(cast(pacified, "h_cm", "angel")).toBeGreaterThan(pass(pacified)); // a steal takes the body, pacified or not
  });

  it("book of shame 55 (deploy playtest r9): Giant Growth at DECLARE_ATTACKERS (blocks not yet declared) is gated at -Infinity; at DECLARE_BLOCKERS it is the trick, as the attacker or the blocker; the damage step keeps the window", () => {
    const a = agent();
    const gg = { type: "castSpell" as const, objectId: "h_gg", targets: [{ kind: "object" as const, id: "mine" }] };
    const base = { hand: [{ objectId: "h_gg", cardId: "giant_growth" }], battlefield: [{ id: "mine", cardId: "grizzly_bears", controller: 0 as const }, { id: "theirs", cardId: "grizzly_bears", controller: 1 as const }, { id: "f1", cardId: "forest", controller: 0 as const }] };
    const attackersDeclared = mkView({ ...base, step: "DECLARE_ATTACKERS", combat: { attackers: ["mine"], blocks: [] } });
    expect(a.scorePriorityAction(attackersDeclared, gg)).toBe(-Infinity);
    const beginCombat = mkView({ ...base, step: "COMBAT_BEGIN", combat: { attackers: [], blocks: [] } });
    expect(a.scorePriorityAction(beginCombat, gg)).toBe(-Infinity);
    const blocked = mkView({ ...base, step: "DECLARE_BLOCKERS", combat: { attackers: ["mine"], blocks: [{ blocker: "theirs", attacker: "mine" }] } });
    expect(a.scorePriorityAction(blocked, gg)).toBeGreaterThan(a.scorePriorityAction(blocked, { type: "pass" }));
    // Their turn: their Bears attack, ours blocks — the pump on the blocker at DECLARE_BLOCKERS.
    const blocking = mkView({ ...base, step: "DECLARE_BLOCKERS", activePlayer: 1, combat: { attackers: ["theirs"], blocks: [{ blocker: "mine", attacker: "theirs" }] } });
    expect(a.scorePriorityAction(blocking, gg)).toBeGreaterThan(-Infinity);
    const damage = mkView({ ...base, step: "COMBAT_DAMAGE", combat: { attackers: ["mine"], blocks: [{ blocker: "theirs", attacker: "mine" }] } });
    expect(a.scorePriorityAction(damage, gg)).toBeGreaterThan(-Infinity);
  });

  it("book of shame 56 (deploy playtest r9): a castable Hedron Crab in hand withholds the land drop from the decision (the Crab first, then the landfall); no Crab, the land competes; the Crab already out, the land competes", () => {
    const a = agent();
    const land = { type: "playLand" as const, objectId: "h_isl" };
    const crab = { type: "castSpell" as const, objectId: "h_crab", targets: [] };
    const pass = { type: "pass" as const };
    const v = mkView({ hand: [{ objectId: "h_isl", cardId: "island" }, { objectId: "h_crab", cardId: "hedron_crab" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }] });
    expect(a.landfallFirstCandidates(v, [land, crab, pass])).toEqual([crab, pass]);
    expect(a.landfallFirstCandidates(v, [land, pass])).toBeNull(); // the Crab not castable (turn one, no mana): the land goes first
    const out = mkView({ hand: [{ objectId: "h_isl", cardId: "island" }, { objectId: "h_bolt", cardId: "lightning_bolt" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }, { id: "c1", cardId: "hedron_crab", controller: 0 }] });
    expect(a.landfallFirstCandidates(out, [land, { type: "castSpell", objectId: "h_bolt", targets: [{ kind: "player", player: 1 }] }, pass])).toBeNull();
    // Through the choice itself: forty picks never take the land while the Crab is castable.
    for (let i = 0; i < 40; i++) expect((a as unknown as { priorityChoice(v: unknown, r: unknown): { type: string } }).priorityChoice(v, { player: 0, purpose: "priority", actions: [land, crab, pass] }).type).not.toBe("playLand");
  });

  it("book of shame 29 (S27 r2, the Manafleur that never swung): a 7/7 at 35 life attacks into three 2/2s; the same 7/7 at 6 life holds (the counter-swing is the whole deterrence)", async () => {
    const a = agent("midrange");
    const board = (life: number) => mkView({
      life: [life, 20], step: "DECLARE_ATTACKERS", activePlayer: 0,
      battlefield: [{ id: "mf", cardId: "the_manafleur", controller: 0 }, { id: "b1", cardId: "grizzly_bears", controller: 1 }, { id: "b2", cardId: "grizzly_bears", controller: 1 }, { id: "b3", cardId: "grizzly_bears", controller: 1 }],
    });
    const creaturesOf = (v: GameView) => v.battlefield.filter((o) => o.power !== null).map((o) => ({ id: o.id, controller: o.controller, power: o.power!, toughness: o.toughness!, keywords: o.keywords, damage: 0 }));
    const high = board(35);
    const low = board(6);
    expect(await a.scoreAttackSet(high, creaturesOf(high) as never, 0, ["mf"])).toBeGreaterThan(0);
    expect(await a.scoreAttackSet(low, creaturesOf(low) as never, 0, ["mf"])).toBeLessThan(await a.scoreAttackSet(high, creaturesOf(high) as never, 0, ["mf"]));
  });

  it("book of shame 30 (S27 r2): a second copy of a legend we control is never cast (insurance in hand beats the legend rule); the first copy still casts", () => {
    const a = agent();
    const hand = [{ objectId: "h1", cardId: "the_manafleur" }];
    const withOne = mkView({ hand, battlefield: [{ id: "mf", cardId: "the_manafleur", controller: 0 }, ...(["plains", "island", "swamp", "mountain", "forest"] as const).map((c, i) => ({ id: `l${i}`, cardId: c, controller: 0 as const }))] });
    const withNone = mkView({ hand, battlefield: (["plains", "island", "swamp", "mountain", "forest"] as const).map((c, i) => ({ id: `l${i}`, cardId: c, controller: 0 as const })) });
    const cast = { type: "castSpell" as const, objectId: "h1", targets: [] };
    expect(a.scorePriorityAction(withOne, cast)).toBe(-Infinity);
    expect(a.scorePriorityAction(withNone, cast)).toBeGreaterThan(-Infinity);
  });

  it("book of shame 31 (S27 r2, the Witch's discipline): life-for-cards only with a thin hand, only with life to spare over the opposing board, never as a faucet", () => {
    const a = agent();
    const witch = (opts: { life: number; hand: number; oppPower: number }) => mkView({
      life: [opts.life, 20],
      hand: Array.from({ length: opts.hand }, (_, i) => ({ objectId: `h${i}`, cardId: "swamp" })),
      battlefield: [{ id: "witch", cardId: "the_jet_witch", controller: 0 }, ...Array.from({ length: opts.oppPower / 2 }, (_, i) => ({ id: `ob${i}`, cardId: "grizzly_bears", controller: 1 as const }))],
    });
    const draw = { type: "activateAbility" as const, objectId: "witch", abilityIndex: 0, targets: [] };
    expect(a.scorePriorityAction(witch({ life: 18, hand: 1, oppPower: 4 }), draw)).toBeGreaterThan(-Infinity); // thin hand, life to spare
    expect(a.scorePriorityAction(witch({ life: 18, hand: 4, oppPower: 4 }), draw)).toBe(-Infinity); // hand is stocked
    expect(a.scorePriorityAction(witch({ life: 8, hand: 1, oppPower: 6 }), draw)).toBe(-Infinity); // 6 after paying < 6 power + 3
  });

  it("book of shame 32 (S27 r2, Glare of Subdual): a tap-a-creature cost never fires on our own turn (it spends an attacker); it fires on the opponent's upkeep", () => {
    const a = agent();
    const view = (activePlayer: 0 | 1, step: string) => mkView({
      activePlayer, step,
      battlefield: [{ id: "glare", cardId: "glare_of_subdual", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 0 }, { id: "ob", cardId: "grizzly_bears", controller: 1 }],
    });
    const tap = { type: "activateAbility" as const, objectId: "glare", abilityIndex: 0, targets: [{ kind: "object" as const, id: "ob" }] };
    expect(a.scorePriorityAction(view(0, "MAIN1"), tap)).toBe(-Infinity);
    expect(a.scorePriorityAction(view(1, "UPKEEP"), tap)).toBeGreaterThan(-Infinity);
  });

  it("book of shame 41–44 (S30, the floor): Thought Scour mills the opponent, not us; Buried Alive waits for a reanimator in hand; the Skeleton returns on their turn, or when behind, never over a spell the mana wants; Pyroclasm holds with our Pyromancer and Elementals out and fires into their X/2s; Wood Elves takes the Breeding Pool when a blue pip waits", () => {
    const a = agent();
    // 41 Thought Scour: the opponent's library, never our own.
    const scour = mkView({ step: "END", activePlayer: 1, hand: [{ objectId: "h_ts", cardId: "thought_scour" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }] });
    expect(a.scorePriorityAction(scour, { type: "castSpell", objectId: "h_ts", targets: [{ kind: "player", player: 1 }] })).toBeGreaterThan(a.scorePriorityAction(scour, { type: "castSpell", objectId: "h_ts", targets: [{ kind: "player", player: 0 }] }));
    // 42 Buried Alive: only with Zombify (or Unearth) in hand.
    const buried = (extra: { objectId: string; cardId: string }[]) => mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_ba", cardId: "buried_alive" }, ...extra], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }] });
    const cast = { type: "castSpell" as const, objectId: "h_ba", targets: [] };
    expect(a.scorePriorityAction(buried([]), cast)).toBe(-Infinity);
    expect(a.scorePriorityAction(buried([{ objectId: "h_z", cardId: "zombify" }]), cast)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(buried([{ objectId: "h_u", cardId: "unearth" }]), cast)).toBeGreaterThan(-Infinity);
    // 43 the Skeleton: on our MAIN1 with a castable Bears wanting the mana and an even board, hold; behind, return; on their turn, return.
    const sk = (opts: { activePlayer: 0 | 1; step: string; theirs: number; hand?: { objectId: string; cardId: string }[] }) =>
      mkView({ step: opts.step, activePlayer: opts.activePlayer, hand: opts.hand ?? [], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, ...Array.from({ length: opts.theirs }, (_, i) => ({ id: `t${i}`, cardId: "grizzly_bears", controller: 1 as const }))] });
    const ret = { type: "activateAbility" as const, objectId: "g_sk", abilityIndex: 0, targets: [] };
    const withYard = (v: GameView): GameView => ({ ...v, graveyardObjects: [[{ objectId: "g_sk", cardId: "reassembling_skeleton" }], []] , graveyards: [["reassembling_skeleton"], []] });
    expect(a.scorePriorityAction(withYard(sk({ activePlayer: 0, step: "MAIN1", theirs: 0, hand: [{ objectId: "h_c", cardId: "child_of_night" }] })), ret)).toBe(-Infinity); // the Child wants the two mana
    expect(a.scorePriorityAction(withYard(sk({ activePlayer: 0, step: "MAIN1", theirs: 2, hand: [{ objectId: "h_c", cardId: "child_of_night" }] })), ret)).toBeGreaterThan(-Infinity); // behind: the blocker
    expect(a.scorePriorityAction(withYard(sk({ activePlayer: 1, step: "END", theirs: 0, hand: [{ objectId: "h_c", cardId: "child_of_night" }] })), ret)).toBeGreaterThan(-Infinity); // their end step
    // Pyroclasm: with our Pyromancer + two Elementals out against one Bears, the sweep is a loss; against three X/2s with nothing of ours, a gain.
    const pyro = (mine: { id: string; cardId: string }[], theirs: { id: string; cardId: string }[]) =>
      mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_p", cardId: "pyroclasm" }], battlefield: [{ id: "m1", cardId: "mountain", controller: 0 }, { id: "m2", cardId: "mountain", controller: 0 }, ...mine.map((o) => ({ ...o, controller: 0 as const })), ...theirs.map((o) => ({ ...o, controller: 1 as const }))] });
    const clasm = { type: "castSpell" as const, objectId: "h_p", targets: [] };
    const ours = pyro([{ id: "yp", cardId: "young_pyromancer" }, { id: "e1", cardId: "elemental_1_1_r" }, { id: "e2", cardId: "elemental_1_1_r" }], [{ id: "b", cardId: "grizzly_bears" }]);
    expect(a.scorePriorityAction(ours, clasm)).toBeLessThan(a.scorePriorityAction(ours, { type: "pass" }));
    const theirs = pyro([], [{ id: "b1", cardId: "grizzly_bears" }, { id: "b2", cardId: "grizzly_bears" }, { id: "r1", cardId: "typhoid_rats" }]);
    expect(a.scorePriorityAction(theirs, clasm)).toBeGreaterThan(a.scorePriorityAction(theirs, { type: "pass" }));
    // 44 Wood Elves: the Pool over the Forest with a blue pip in hand.
    const req = { player: 0 as const, purpose: "searchLibrary" as const, actions: [{ type: "declineSearch" as const }, { type: "searchPick" as const, objectId: "l_f" }, { type: "searchPick" as const, objectId: "l_bp" }], revealed: [{ objectId: "l_f", cardId: "forest" }, { objectId: "l_bp", cardId: "breeding_pool" }] };
    const elves = mkView({ hand: [{ objectId: "h_cs", cardId: "counterspell" }], battlefield: [{ id: "f1", cardId: "forest", controller: 0 }, { id: "f2", cardId: "forest", controller: 0 }] });
    expect(a.searchChoice(elves, req as never)).toEqual({ type: "searchPick", objectId: "l_bp" });
  });

  it("book of shame 45 (S31, the Traumatizer — ADR-107): with a Traumatizer out the Adept attacks into an empty board and is worth more than without one; the Traumatizer is cast before a second Crab when the board has attackers; a Terror at the Traumatizer is countered rather than passed", async () => {
    const a = agent("control");
    const lands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, cardId: "island", controller: 0 as const }));
    const theirLands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, cardId: "forest", controller: 1 as const }));
    // The attack: 1/1 Adept into their empty board, library 20 — under the Traumatizer the swing mills two.
    const board = (trauma: boolean) => mkView({ librarySizes: [20, 20], battlefield: [...lands(4), ...theirLands(3), { id: "adept", cardId: "cathartic_adept", controller: 0 }, ...(trauma ? [{ id: "tr", cardId: "traumatizer", controller: 0 as const }] : [])] });
    const withT = await a.scoreAttackSet(board(true), viewCreatures(board(true)), 0, ["adept"]);
    const without = await agent("control").scoreAttackSet(board(false), viewCreatures(board(false)), 0, ["adept"]);
    expect(withT).toBeGreaterThan(without);
    expect(withT).toBeGreaterThan(0);
    // An attack that EMPTIES their library outscores one that does not (the win next draw).
    const thin = mkView({ librarySizes: [20, 2], battlefield: [...lands(4), ...theirLands(3), { id: "adept", cardId: "cathartic_adept", controller: 0 }, { id: "tr", cardId: "traumatizer", controller: 0 }] });
    expect(await agent("control").scoreAttackSet(thin, viewCreatures(thin), 0, ["adept"])).toBeGreaterThan(withT);
    // The cast: Traumatizer over a second Crab with two Adepts on the board and four Islands.
    const hand = mkView({ hand: [{ objectId: "h_tr", cardId: "traumatizer" }, { objectId: "h_crab", cardId: "hedron_crab" }], battlefield: [...lands(4), { id: "c1", cardId: "hedron_crab", controller: 0 }, { id: "a1", cardId: "cathartic_adept", controller: 0 }, { id: "a2", cardId: "cathartic_adept", controller: 0 }] });
    expect(a.scorePriorityAction(hand, { type: "castSpell", objectId: "h_tr", targets: [] })).toBeGreaterThan(a.scorePriorityAction(hand, { type: "castSpell", objectId: "h_crab", targets: [] }));
    // The counter: their Terror aims at our Traumatizer with two Islands up — Counterspell beats pass.
    const threat = mkView({ step: "MAIN1", activePlayer: 1, hand: [{ objectId: "h_cs", cardId: "counterspell" }], battlefield: [...lands(2), { id: "tr", cardId: "traumatizer", controller: 0 }, { id: "a1", cardId: "cathartic_adept", controller: 0 }, { id: "a2", cardId: "cathartic_adept", controller: 0 }, ...theirLands(2)], stack: [{ id: "s1", kind: "spell", cardId: "terror", controller: 1, targets: [{ kind: "object", id: "tr" }] } as never] });
    expect(a.scorePriorityAction(threat, { type: "castSpell", objectId: "h_cs", targets: [{ kind: "stackItem", id: "s1" }] })).toBeGreaterThan(a.scorePriorityAction(threat, { type: "pass" }));
  });

  it("book of shame 46 (S31, Artisan of Kozilek — R-094 word 1): the 10/9 attacks into a board of Bears and lands, holds against untapped deathtouch Rats; as the DEFENDER under annihilator the token goes first, the land last", async () => {
    const a = agent("midrange");
    const theirs = (extra: { id: string; cardId: string }[]) => mkView({ battlefield: [{ id: "art", cardId: "artisan_of_kozilek", controller: 0 }, { id: "f1", cardId: "forest", controller: 1 }, { id: "f2", cardId: "forest", controller: 1 }, { id: "f3", cardId: "forest", controller: 1 }, ...extra.map((o) => ({ ...o, controller: 1 as const }))] });
    const bears = theirs([{ id: "b", cardId: "grizzly_bears" }]);
    expect(await a.scoreAttackSet(bears, viewCreatures(bears), 0, ["art"])).toBeGreaterThan(0);
    const rats = theirs([{ id: "r", cardId: "typhoid_rats" }]);
    expect(await agent("midrange").scoreAttackSet(rats, viewCreatures(rats), 0, ["art"])).toBeLessThan(0);
    // The defender's choice: the Artisan's edict asks us — token, then Bears, never the Forest first.
    const mine = mkView({ battlefield: [{ id: "tok", cardId: "elemental_1_1_r", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 0 }, { id: "land", cardId: "forest", controller: 0 }, { id: "art", cardId: "artisan_of_kozilek", controller: 1 }] });
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "chooseSacrifice" as const, actions: ids.map((objectId) => ({ type: "sacrifice" as const, objectId })), source: { cardId: "artisan_of_kozilek", effects: [{ type: "sacrifice" as const, who: "opponent" as const, count: 2, predicate: "permanent" as const }] } });
    expect(a.sacrificeChoice(mine, req(["tok", "bear", "land"]) as never)).toEqual({ type: "sacrifice", objectId: "tok" });
    expect(a.sacrificeChoice(mine, req(["bear", "land"]) as never)).toEqual({ type: "sacrifice", objectId: "bear" });
  });

  it("book of shame 47 (S31, Buried Alive under the Artisan): a search TO THE GRAVEYARD takes the best reanimation target — the Artisan over the Serra over the Gravedigger — where the Tutor's chooser would take the castable Gravedigger", () => {
    const a = agent("midrange");
    const view = mkView({ hand: [{ objectId: "h_z", cardId: "zombify" }], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }] });
    const actions = [{ type: "declineSearch" as const }, { type: "searchPick" as const, objectId: "l_gd" }, { type: "searchPick" as const, objectId: "l_serra" }, { type: "searchPick" as const, objectId: "l_art" }];
    const revealed = [{ objectId: "l_gd", cardId: "gravedigger" }, { objectId: "l_serra", cardId: "serra_angel" }, { objectId: "l_art", cardId: "artisan_of_kozilek" }];
    const buried = { player: 0 as const, purpose: "searchLibrary" as const, actions, revealed, source: { cardId: "buried_alive", effects: [{ type: "searchLibrary" as const, predicate: "creatureCard" as const, to: "graveyard" as const, count: 3 }] } };
    expect(a.searchChoice(view, buried as never)).toEqual({ type: "searchPick", objectId: "l_art" });
    const tutor = { player: 0 as const, purpose: "searchLibrary" as const, actions, revealed, source: { cardId: "demonic_tutor", effects: [{ type: "searchLibrary" as const, predicate: "anyCard" as const, to: "hand" as const }] } };
    expect(a.searchChoice(view, tutor as never)).toEqual({ type: "searchPick", objectId: "l_gd" });
  });

  it("book of shame 48 (S31, Zombify the Artisan): a targeted return is priced by its target — Zombify at the Artisan outscores Zombify at the Serra outscores Zombify at the Aristocrat (they used to tie at a flat 0.6)", () => {
    const a = agent("midrange");
    const yard = [{ objectId: "g_art", cardId: "artisan_of_kozilek" }, { objectId: "g_serra", cardId: "serra_angel" }, { objectId: "g_ari", cardId: "indulgent_aristocrat" }];
    const view: GameView = { ...mkView({ hand: [{ objectId: "h_z", cardId: "zombify" }], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }, { id: "s4", cardId: "swamp", controller: 0 }] }), graveyardObjects: [yard, []], graveyards: [yard.map((g) => g.cardId), []] };
    const z = (id: string) => a.scorePriorityAction(view, { type: "castSpell", objectId: "h_z", targets: [{ kind: "object", id }] });
    expect(z("g_art")).toBeGreaterThan(z("g_serra"));
    expect(z("g_serra")).toBeGreaterThan(z("g_ari"));
  });

  it("book of shame 51 (S35, the apprentice's first land): a land drop with no competing play is taken at every profile, every time — the softmax never sees it; with a castable spell beside it the choice is the softmax's", async () => {
    for (const profile of ["apprentice", "journeyman", "master"] as const) {
      const a = new HeuristicAgent(7, pool, difficultyProfile(profile, "midrange", []));
      const view = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_pl", cardId: "plains" }, { objectId: "h_sw", cardId: "soul_warden" }], battlefield: [] });
      const req = { player: 0 as const, purpose: "priority" as const, actions: [{ type: "pass" as const }, { type: "playLand" as const, objectId: "h_pl" }] };
      for (let i = 0; i < 40; i++) expect((await a.chooseAction(view, req as never)).type, profile).toBe("playLand");
      expect(a.landOnlyCandidates(req.actions as never)).toEqual([{ type: "playLand", objectId: "h_pl" }]);
      // A competing play (a castable spell) leaves the choice to the softmax — no forcing.
      expect(a.landOnlyCandidates([{ type: "pass" }, { type: "playLand", objectId: "h_pl" }, { type: "castSpell", objectId: "h_sw", targets: [] }] as never)).toBeNull();
      // Two land drops offered: WHICH land is a real choice; passing still is not.
      expect(a.landOnlyCandidates([{ type: "pass" }, { type: "playLand", objectId: "h_pl" }, { type: "playLand", objectId: "h_pl2" }] as never)).toHaveLength(2);
      const two = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_pl", cardId: "plains" }, { objectId: "h_pl2", cardId: "secluded_steppe" }], battlefield: [] });
      const req2 = { player: 0 as const, purpose: "priority" as const, actions: [{ type: "pass" as const }, { type: "playLand" as const, objectId: "h_pl" }, { type: "playLand" as const, objectId: "h_pl2" }] };
      for (let i = 0; i < 40; i++) expect((await a.chooseAction(two, req2 as never)).type, profile).toBe("playLand");
    }
  });

  it("book of shame 52 (S36, Thawing Glaciers): with another land in hand and no reason, the real land is played; the Glaciers is the drop as the only land, with a Crab out, or when the lands already meet the hand's curve; the fetch waits for their end step or a colour we lack", () => {
    const a = agent("control");
    const hand = (extra: { objectId: string; cardId: string }[] = []) => [{ objectId: "h_gl", cardId: "thawing_glaciers" }, { objectId: "h_is", cardId: "island" }, { objectId: "h_tr", cardId: "traumatizer" }, ...extra];
    const dropGl = { type: "playLand" as const, objectId: "h_gl" }, dropIs = { type: "playLand" as const, objectId: "h_is" };
    // No reason (an Island in hand, the Traumatizer wants four, one land out): the Island is played, the Glaciers gated.
    const plain = mkView({ step: "MAIN1", activePlayer: 0, hand: hand(), battlefield: [{ id: "i1", cardId: "island", controller: 0 }] });
    expect(a.glaciersDropGated(plain, dropGl)).toBe(true);
    expect(a.glaciersDropGated(plain, dropIs)).toBe(false);
    // The only land in hand: the Glaciers plays.
    const only = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_gl", cardId: "thawing_glaciers" }, { objectId: "h_tr", cardId: "traumatizer" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }] });
    expect(a.glaciersDropGated(only, dropGl)).toBe(false);
    // A landfall permanent (a Crab) on our board: the Glaciers is the drop and the Island yields.
    const crab = mkView({ step: "MAIN1", activePlayer: 0, hand: hand(), battlefield: [{ id: "i1", cardId: "island", controller: 0 }, { id: "c1", cardId: "hedron_crab", controller: 0 }] });
    expect(a.glaciersDropGated(crab, dropGl)).toBe(false);
    expect(a.glaciersDropGated(crab, dropIs)).toBe(true);
    // Lands in play already meet the hand's top mana value: the drop is spare — the Glaciers.
    const spare = mkView({ step: "MAIN1", activePlayer: 0, hand: hand(), battlefield: [1, 2, 3, 4].map((i) => ({ id: `i${i}`, cardId: "island", controller: 0 as const })) });
    expect(a.glaciersDropGated(spare, dropGl)).toBe(false);
    // The activation: their end step yes; their main phase no; our turn only when a colour is lacking.
    const act = { type: "activateAbility" as const, objectId: "gl", abilityIndex: 0, targets: [] };
    const onBoard = (step: string, active: 0 | 1, handCards: { objectId: string; cardId: string }[]) => mkView({ step, activePlayer: active, hand: handCards, battlefield: [{ id: "gl", cardId: "thawing_glaciers", controller: 0 }, { id: "i1", cardId: "island", controller: 0 }, { id: "i2", cardId: "island", controller: 0 }] });
    expect(a.glaciersActivationGated(onBoard("END", 1, [{ objectId: "h_tr", cardId: "traumatizer" }]), act)).toBe(false);
    expect(a.glaciersActivationGated(onBoard("MAIN1", 1, [{ objectId: "h_tr", cardId: "traumatizer" }]), act)).toBe(true);
    expect(a.glaciersActivationGated(onBoard("MAIN1", 0, [{ objectId: "h_tr", cardId: "traumatizer" }]), act)).toBe(true); // blue is covered
    expect(a.glaciersActivationGated(onBoard("MAIN1", 0, [{ objectId: "h_rg", cardId: "rampant_growth" }]), act)).toBe(false); // green is not
  });

  it("book of shame 53 (S36, Angel of the Ruins): plainscycling with a Zombify in hand, or short on lands by turn three; never with seven lands coming and no reanimator; the ETB aims at their Control Magic on our creature before their other enchantments and never at our own", async () => {
    const a = agent("midrange");
    const cyc = { type: "activateAbility" as const, objectId: "h_an", abilityIndex: 1, targets: [] };
    const v = (hand: { objectId: string; cardId: string }[], lands: number, turn: number) => ({ ...mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_an", cardId: "angel_of_the_ruins" }, ...hand], battlefield: Array.from({ length: lands }, (_, i) => ({ id: `p${i}`, cardId: "plains", controller: 0 as const })) }), turn });
    expect(a.plainscyclingGated(v([{ objectId: "h_z", cardId: "zombify" }], 4, 5), cyc)).toBe(false); // a reanimator in hand: cycle
    // S37 Part 3: the reanimator must be able to RETURN a seven-drop — Unearth's ceiling (≤ 3) does not count.
    expect(a.plainscyclingGated(v([{ objectId: "h_u", cardId: "unearth" }], 6, 6), cyc)).toBe(true); // Unearth cannot return the Angel: hold it
    expect(a.plainscyclingGated(v([{ objectId: "h_u", cardId: "unearth" }, { objectId: "h_z", cardId: "zombify" }], 6, 6), cyc)).toBe(false); // the Zombify beside it can
    expect(a.plainscyclingGated(v([], 2, 2), cyc)).toBe(false); // two lands on turn two: cycle
    expect(a.plainscyclingGated(v([], 6, 6), cyc)).toBe(true); // six lands, no reanimator: hold the Angel
    // The ETB's target choice.
    const board = mkView({ step: "MAIN1", activePlayer: 0, battlefield: [
      { id: "ours", cardId: "serra_angel", controller: 0 }, { id: "cm", cardId: "control_magic", controller: 1, attachedTo: "ours" },
      { id: "anthem", cardId: "glorious_anthem", controller: 1 }, { id: "myanthem", cardId: "glorious_anthem", controller: 0 },
    ] as never });
    const t = (ids: string[]) => ({ type: "chooseTriggerTargets" as const, targets: ids.map((id) => ({ kind: "object" as const, id })) });
    const req = { player: 0 as const, purpose: "chooseTarget" as const, actions: [t([]), t(["cm"]), t(["anthem"]), t(["myanthem"]), t(["cm", "anthem"]), t(["cm", "myanthem"]), t(["anthem", "myanthem"])], source: { cardId: "angel_of_the_ruins", effects: [{ type: "exile" as const, targetSpec: 0 }] } };
    const pick = await a.chooseAction(board, req as never);
    expect(pick).toEqual(t(["cm", "anthem"]));
  });

  it("S36 (the Collector): the name is the most-duplicated card in hand — four Crabs and a land names the Crab; the activation waits for their end step unless the hand is one card", async () => {
    const a = agent("control");
    const view = mkView({ step: "END", activePlayer: 1, hand: [1, 2, 3, 4].map((i) => ({ objectId: `c${i}`, cardId: "hedron_crab" })).concat([{ objectId: "l1", cardId: "island" }]), battlefield: [{ id: "ac", cardId: "arcane_collector", controller: 0 }, { id: "i1", cardId: "island", controller: 0 }, { id: "i2", cardId: "island", controller: 0 }] });
    const req = { player: 0 as const, purpose: "chooseName" as const, actions: [{ type: "nameCard" as const, cardId: "island", name: "Island" }, { type: "nameCard" as const, cardId: "hedron_crab", name: "Hedron Crab" }], source: { cardId: "arcane_collector", effects: [] } };
    expect(await a.chooseAction(view, req as never)).toEqual({ type: "nameCard", cardId: "hedron_crab", name: "Hedron Crab" });
    const act = { type: "activateAbility" as const, objectId: "ac", abilityIndex: 0, targets: [] };
    expect(a.collectorGated(view, act)).toBe(false); // their end step
    expect(a.collectorGated({ ...view, step: "MAIN1", activePlayer: 0 }, act)).toBe(true); // our main phase, five cards
    expect(a.collectorGated({ ...view, step: "MAIN1", activePlayer: 0, hand: [{ objectId: "c1", cardId: "hedron_crab" }] }, act)).toBe(false); // one card: every turn
  });

  it("book of shame 49 (S32, Plumecreed Escort): a flash creature waits for the opponent's end step, flashes in against a Bolt at our Traumatizer (and its trigger picks the creature under fire), and on our own turn goes only when nothing else uses the mana", async () => {
    const a = agent("control");
    const lands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, cardId: "island", controller: 0 as const }));
    const v = (opts: { step: string; activePlayer: 0 | 1; hand?: { objectId: string; cardId: string }[]; stack?: unknown[]; extra?: { id: string; cardId: string; controller: 0 | 1 }[] }) =>
      mkView({ step: opts.step, activePlayer: opts.activePlayer, hand: [{ objectId: "h_esc", cardId: "plumecreed_escort" }, ...(opts.hand ?? [])], battlefield: [...lands(2), { id: "tr", cardId: "traumatizer", controller: 0 }, ...(opts.extra ?? [])], stack: (opts.stack ?? []) as never });
    const cast = { type: "castSpell" as const, objectId: "h_esc", targets: [] };
    expect(a.scorePriorityAction(v({ step: "MAIN1", activePlayer: 1 }), cast)).toBe(-Infinity); // their main phase, nothing to answer
    expect(a.scorePriorityAction(v({ step: "END", activePlayer: 1 }), cast)).toBeGreaterThan(-Infinity); // their end step
    expect(a.scorePriorityAction(v({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_crab", cardId: "hedron_crab" }] }), cast)).toBe(-Infinity); // our turn, the Crab wants the mana
    expect(a.scorePriorityAction(v({ step: "MAIN1", activePlayer: 0 }), cast)).toBeGreaterThan(-Infinity); // our turn, idle mana
    expect(a.scorePriorityAction(v({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_crab", cardId: "hedron_crab" }], stack: [{ id: "s0", kind: "spell", cardId: "hedron_crab", controller: 0 }] }), cast)).toBe(-Infinity); // S34: our own spell on the stack is not "in response"
    // The save: their Bolt at our Traumatizer — flash in (beats pass) and the ETB aims at the Traumatizer, not the untargeted Bears.
    const bolt = { id: "s1", kind: "spell", cardId: "lightning_bolt", controller: 1, targets: [{ kind: "object", id: "tr" }] };
    const threat = v({ step: "MAIN1", activePlayer: 1, stack: [bolt], extra: [{ id: "bear", cardId: "grizzly_bears", controller: 0 }] });
    expect(a.scorePriorityAction(threat, cast)).toBeGreaterThan(a.scorePriorityAction(threat, { type: "pass" }));
    const req = { player: 0 as const, purpose: "chooseTarget" as const, actions: [{ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id: "bear" }] }, { type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id: "tr" }] }], source: { cardId: "plumecreed_escort", effects: [{ type: "grantKeyword" as const, keyword: "hexproof" as const, target: 0, duration: "UNTIL_END_OF_TURN" as const }] } };
    expect(await a.chooseAction(threat, req as never)).toEqual({ type: "chooseTriggerTargets", targets: [{ kind: "object", id: "tr" }] });
  });

  it("book of shame 50 (S32, Diabolic Edict): never into no creatures, never into a 5/5 shielded by two Goblin tokens, never at our own face; a lone Serra is the play", () => {
    const a = agent("midrange");
    const v = (theirs: { id: string; cardId: string }[]) => mkView({ hand: [{ objectId: "h_ed", cardId: "diabolic_edict" }], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "mine", cardId: "grizzly_bears", controller: 0 }, ...theirs.map((o) => ({ ...o, controller: 1 as const }))] });
    const at = (player: 0 | 1) => ({ type: "castSpell" as const, objectId: "h_ed", targets: [{ kind: "player" as const, player }] });
    expect(a.scorePriorityAction(v([]), at(1))).toBe(-Infinity);
    expect(a.scorePriorityAction(v([{ id: "w", cardId: "pelakka_wurm" }, { id: "g1", cardId: "goblin_1_1" }, { id: "g2", cardId: "goblin_1_1" }]), at(1))).toBe(-Infinity);
    const serra = v([{ id: "serra", cardId: "serra_angel" }]);
    expect(a.scorePriorityAction(serra, at(0))).toBe(-Infinity);
    expect(a.scorePriorityAction(serra, at(1))).toBeGreaterThan(a.scorePriorityAction(serra, { type: "pass" }));
  });

  it("book of shame 37 (S29, the Altar of Dementia): lethal mill takes the biggest body; otherwise the outlet holds unless a creature is doomed; Quill's Pelakka Wurm closes a seven-card library", () => {
    const a = agent();
    const view = (lib: number, extra: { id: string; cardId: string; controller: 0 | 1 }[] = [], stack: { id: string; kind: string; cardId: string; controller: 0 | 1; targets?: unknown[] }[] = []) =>
      mkView({ librarySizes: [30, lib], stack: stack as never, battlefield: [{ id: "altar", cardId: "altar_of_dementia", controller: 0 }, { id: "wurm", cardId: "pelakka_wurm", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 0 }, ...extra] });
    const mill = { type: "activateAbility" as const, objectId: "altar", abilityIndex: 0, targets: [{ kind: "player" as const, player: 1 as const }] };
    expect(a.scorePriorityAction(view(20), mill)).toBe(-Infinity); // nothing lethal, nothing dying: hold
    expect(a.scorePriorityAction(view(7), mill)).toBeGreaterThan(a.scorePriorityAction(view(7), { type: "pass" })); // the Wurm's seven empties seven
    // The chooser feeds the biggest body when it is lethal.
    const req = { player: 0 as const, purpose: "chooseSacrifice" as const, actions: [{ type: "sacrifice" as const, objectId: "bear" }, { type: "sacrifice" as const, objectId: "wurm" }], source: { cardId: "altar_of_dementia", effects: [{ type: "mill" as const, count: { ref: "sacrificedPower" as const }, who: "target" as const }] } };
    expect(a.sacrificeChoice(view(7), req as never)).toEqual({ type: "sacrifice", objectId: "wurm" });
    // A creature targeted by their Terror is cashed instead of lost.
    const doomed = view(20, [], [{ id: "s1", kind: "spell", cardId: "terror", controller: 1, targets: [{ kind: "object", id: "bear" }] }]);
    expect(a.scorePriorityAction(doomed, mill)).toBeGreaterThan(-Infinity);
    expect(a.sacrificeChoice(doomed, req as never)).toEqual({ type: "sacrifice", objectId: "bear" });
    // Post-S43 (Chris): a LONE creature under their Terror is cashed too (it was our last blocker — and it is dying
    // either way); a Pyroclasm on the stack dooms the 2/2 (the Wurm shrugs it); a Wrath dooms them all.
    const lone = mkView({ librarySizes: [30, 20], battlefield: [{ id: "altar", cardId: "altar_of_dementia", controller: 0 }, { id: "bear", cardId: "grizzly_bears", controller: 0 }, { id: "ob1", cardId: "grizzly_bears", controller: 1 }, { id: "ob2", cardId: "grizzly_bears", controller: 1 }], stack: [{ id: "s1", kind: "spell", cardId: "terror", controller: 1, targets: [{ kind: "object", id: "bear" }] }] as never });
    expect(a.scorePriorityAction(lone, mill)).toBeGreaterThan(-Infinity);
    const clasm = view(20, [], [{ id: "s1", kind: "spell", cardId: "pyroclasm", controller: 1 }]);
    expect(a.scorePriorityAction(clasm, mill)).toBeGreaterThan(-Infinity);
    expect(a.sacrificeChoice(clasm, req as never)).toEqual({ type: "sacrifice", objectId: "bear" }); // the Wurm survives two; the bear does not
    const wrath = view(20, [], [{ id: "s1", kind: "spell", cardId: "wrath_of_god", controller: 1 }]);
    expect(a.sacrificeChoice(wrath, req as never)).toEqual({ type: "sacrifice", objectId: "wurm" }); // both doomed: the biggest body mills the most
    expect(a.scorePriorityAction(view(20, [], [{ id: "s1", kind: "spell", cardId: "terror", controller: 0, targets: [{ kind: "object", id: "bear" }] }]), mill)).toBe(-Infinity); // our own spell dooms nothing
  });

  it("book of shame 38 (S29, Vael's Wrath): a board wipe with our Blood Artist out counts the drain — it outscores the same Wrath without the Artist", () => {
    const a = agent("control");
    const theirs = ["b1", "b2", "b3"].map((id) => ({ id, cardId: "grizzly_bears", controller: 1 as const }));
    const view = (artist: boolean) => mkView({ hand: [{ objectId: "h_w", cardId: "wrath_of_god" }], battlefield: [{ id: "p1", cardId: "plains", controller: 0 }, { id: "p2", cardId: "plains", controller: 0 }, { id: "p3", cardId: "plains", controller: 0 }, { id: "p4", cardId: "plains", controller: 0 }, ...(artist ? [{ id: "art", cardId: "blood_artist", controller: 0 as const }] : []), ...theirs] });
    const wrath = { type: "castSpell" as const, objectId: "h_w", targets: [] };
    expect(a.scorePriorityAction(view(true), wrath)).toBeGreaterThan(a.scorePriorityAction(view(false), wrath));
  });

  it("book of shame 39 (S29, the Wardener): the Armor goes on the hexproof Scout, not the Birds; book 40 (the Sparkwright): the Pyromancer comes down before the cheap spells it feeds", () => {
    const a = agent();
    const armor = mkView({ hand: [{ objectId: "h_a", cardId: "blanchwood_armor" }], battlefield: [{ id: "f1", cardId: "forest", controller: 0 }, { id: "f2", cardId: "forest", controller: 0 }, { id: "f3", cardId: "forest", controller: 0 }, { id: "scout", cardId: "gladecover_scout", controller: 0 }, { id: "birds", cardId: "birds_of_paradise", controller: 0 }] });
    const on = (id: string) => a.scorePriorityAction(armor, { type: "castSpell", objectId: "h_a", targets: [{ kind: "object", id }] });
    expect(on("scout")).toBeGreaterThan(on("birds"));
    const spark = mkView({ hand: [{ objectId: "h_p", cardId: "young_pyromancer" }, { objectId: "h_b", cardId: "lightning_bolt" }, { objectId: "h_s", cardId: "shock" }], battlefield: [{ id: "m1", cardId: "mountain", controller: 0 }, { id: "m2", cardId: "mountain", controller: 0 }, { id: "ob", cardId: "grizzly_bears", controller: 1 }] });
    const pyro = a.scorePriorityAction(spark, { type: "castSpell", objectId: "h_p", targets: [] });
    const boltFace = a.scorePriorityAction(spark, { type: "castSpell", objectId: "h_b", targets: [{ kind: "player", player: 1 }] });
    expect(pyro).toBeGreaterThan(boltFace);
  });

  it("S29 (the Sparkwright's Arc Mage): two damage kills a 2-toughness creature over face; one-and-one splits over two X/1s; with no creatures, the face", () => {
    const a = agent();
    const view = (theirs: { id: string; cardId: string }[]) =>
      mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_l", cardId: "forest" }], battlefield: [{ id: "arc", cardId: "arc_mage", controller: 0 }, { id: "m1", cardId: "mountain", controller: 0 }, { id: "m2", cardId: "mountain", controller: 0 }, { id: "m3", cardId: "mountain", controller: 0 }, ...theirs.map((t) => ({ ...t, controller: 1 as const }))] });
    const act = (mode: 0 | 1, targets: { kind: "object"; id: string }[] | { kind: "player"; player: 1 }[]) => ({ type: "activateAbility" as const, objectId: "arc", abilityIndex: 0, targets: targets as never, mode });
    const bears = view([{ id: "bear", cardId: "grizzly_bears" }]);
    expect(a.scorePriorityAction(bears, act(0, [{ kind: "object", id: "bear" }]))).toBeGreaterThan(a.scorePriorityAction(bears, act(0, [{ kind: "player", player: 1 }])));
    const two = view([{ id: "r1", cardId: "typhoid_rats" }, { id: "g1", cardId: "raging_goblin" }]);
    expect(a.scorePriorityAction(two, act(1, [{ kind: "object", id: "r1" }, { kind: "object", id: "g1" }]))).toBeGreaterThan(a.scorePriorityAction(two, act(0, [{ kind: "object", id: "r1" }])));
    const empty = view([]);
    expect(a.scorePriorityAction(empty, act(0, [{ kind: "player", player: 1 }]))).toBeGreaterThan(-Infinity);
  });

  it("book of shame 35 (S28, Spirit Link — the neutralizer fork): on our best evasive creature by default; on THEIR biggest when it out-powers ours", () => {
    const a = agent();
    const view = (ours: { id: string; cardId: string }[], theirs: { id: string; cardId: string }[]) =>
      mkView({ hand: [{ objectId: "h_sl", cardId: "spirit_link" }], battlefield: [{ id: "p1", cardId: "plains", controller: 0 }, ...ours.map((o) => ({ ...o, controller: 0 as const })), ...theirs.map((o) => ({ ...o, controller: 1 as const }))] });
    const cast = (id: string) => ({ type: "castSpell" as const, objectId: "h_sl", targets: [{ kind: "object" as const, id }] });
    // Our 2/2 flyer vs their 2/2: ours.
    const even = view([{ id: "hawk", cardId: "wind_drake" }], [{ id: "bear", cardId: "grizzly_bears" }]);
    expect(a.scorePriorityAction(even, cast("hawk"))).toBeGreaterThan(a.scorePriorityAction(even, cast("bear")));
    // Their 4/4 vs our 2/2: theirs — the damage it deals heals us.
    const outgunned = view([{ id: "bear", cardId: "grizzly_bears" }], [{ id: "baloth", cardId: "rumbling_baloth" }]);
    expect(a.scorePriorityAction(outgunned, cast("baloth"))).toBeGreaterThan(a.scorePriorityAction(outgunned, cast("bear")));
    expect(a.scorePriorityAction(outgunned, cast("baloth"))).toBeGreaterThan(-Infinity); // neutral to rule 8: no misaim cliff
  });

  it("book of shame 36 (S28, Brainstorm's window): a draw-only instant waits for the opponent's end step or a spell to answer — never our own main phase", () => {
    const a = agent();
    const view = (step: string, activePlayer: 0 | 1, stack: { id: string; kind: string; cardId: string; controller: 0 | 1 }[] = []) =>
      mkView({ step, activePlayer, stack, hand: [{ objectId: "h_bs", cardId: "brainstorm" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }] });
    const cast = { type: "castSpell" as const, objectId: "h_bs", targets: [] };
    expect(a.scorePriorityAction(view("MAIN1", 0), cast)).toBe(-Infinity);
    expect(a.scorePriorityAction(view("MAIN2", 0), cast)).toBe(-Infinity);
    expect(a.scorePriorityAction(view("DECLARE_ATTACKERS", 1), cast)).toBe(-Infinity);
    expect(a.scorePriorityAction(view("END", 1), cast)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(view("MAIN1", 1, [{ id: "s1", kind: "spell", cardId: "grizzly_bears", controller: 1 }]), cast)).toBeGreaterThan(-Infinity); // in response
    // S34 (the second S28 erratum): our OWN spell on the stack on our own turn is not a window.
    expect(a.scorePriorityAction(view("MAIN1", 0, [{ id: "s2", kind: "spell", cardId: "hedron_crab", controller: 0 }]), cast)).toBe(-Infinity);
  });

  it("S28 (ADR-096, the Heart's roots + the sixty): the master casts a turn-one Manafleur off five roots and nothing else; Disenchant never points at its own law (the misaim cliff); Prey Upon with the flower prices as removal", () => {
    const a = agent("midrange");
    // Five roots, the flower in hand, no other land: the cast is offered and clears the pass by a body's worth.
    const roots = ["plains", "island", "swamp", "mountain", "forest"].map((cardId, i) => ({ id: `r${i}`, cardId, controller: 0 as const }));
    const bloom = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_mf", cardId: "the_manafleur" }], battlefield: roots });
    const cast = { type: "castSpell" as const, objectId: "h_mf", targets: [] };
    const castScore = a.scorePriorityAction(bloom, cast);
    expect(castScore).toBeGreaterThan(-Infinity);
    expect(castScore).toBeGreaterThan(a.scorePriorityAction(bloom, { type: "pass" }) + 2);
    // The flower FIRST: beside another five-drop in hand (heart-sim seed 510 bloomed a turn late behind Faerie Formation), the law engine outprices the body-only cast.
    const crowded = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_mf", cardId: "the_manafleur" }, { objectId: "h_ff", cardId: "faerie_formation" }, { objectId: "h_pc", cardId: "the_pearl_cleric" }], battlefield: roots });
    const flower = a.scorePriorityAction(crowded, cast);
    expect(flower).toBeGreaterThan(a.scorePriorityAction(crowded, { type: "castSpell", objectId: "h_ff", targets: [] }));
    expect(flower).toBeGreaterThan(a.scorePriorityAction(crowded, { type: "castSpell", objectId: "h_pc", targets: [] }));
    // Disenchant: its own law is on the wrong side of rule 8 (harmful → own side = the cliff); their Pacifism is fair game.
    const dis = mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_dis", cardId: "disenchant" }], battlefield: [...roots, { id: "law", cardId: "law_intake", controller: 0 }, { id: "pac", cardId: "pacifism", controller: 1 }, { id: "bear", cardId: "grizzly_bears", controller: 0 }] });
    const aim = (id: string) => a.scorePriorityAction(dis, { type: "castSpell", objectId: "h_dis", targets: [{ kind: "object", id }] });
    expect(aim("pac") - aim("law")).toBeGreaterThan(50);
    // Prey Upon: the 7/7 flower fights their 4/4 — removal, the flower survives; against a 7/7 deathtouch-free 8-toughness wall it is not.
    const prey = (theirs: string) => mkView({ step: "MAIN1", activePlayer: 0, hand: [{ objectId: "h_pu", cardId: "prey_upon" }], battlefield: [...roots, { id: "mf", cardId: "the_manafleur", controller: 0 }, { id: "t", cardId: theirs, controller: 1 }] });
    const fight = (v: GameView) => a.scorePriorityAction(v, { type: "castSpell", objectId: "h_pu", targets: [{ kind: "object", id: "mf" }, { kind: "object", id: "t" }] });
    expect(fight(prey("rumbling_baloth"))).toBeGreaterThan(a.scorePriorityAction(prey("rumbling_baloth"), { type: "pass" }));
  });

  it("book of shame 33 (deploy playtest r1, the Scepter pointed at lands): the tapper holds when the opponent has no untapped creature, and prefers the creature to a land when it fires", () => {
    const a = agent();
    const view = (oppCreatureTapped: boolean) =>
      mkView({
        step: "UPKEEP", activePlayer: 1,
        battlefield: [
          { id: "scep", cardId: "scepter_of_dominance", controller: 0 }, { id: "p1", cardId: "plains", controller: 0 }, { id: "p2", cardId: "plains", controller: 0 },
          { id: "ob", cardId: "grizzly_bears", controller: 1, tapped: oppCreatureTapped }, { id: "of", cardId: "forest", controller: 1 },
        ],
      });
    const tap = (id: string) => ({ type: "activateAbility" as const, objectId: "scep", abilityIndex: 0, targets: [{ kind: "object" as const, id }] });
    expect(a.scorePriorityAction(view(true), tap("of"))).toBe(-Infinity); // their only creature is already tapped: nothing worth the mana
    const creature = a.scorePriorityAction(view(false), tap("ob"));
    const land = a.scorePriorityAction(view(false), tap("of"));
    expect(creature).toBeGreaterThan(-Infinity);
    expect(creature).toBeGreaterThan(land); // the creature is the prize
  });

  it("book of shame 34 (deploy playtest r1, the Rager at 1 life): a mandatory ETB that costs us life is paid in the prediction — the suicide cast prices as a loss; at 5 life it is a fine card", () => {
    const a = agent();
    const view = (life: number) =>
      mkView({
        life: [life, 20], step: "MAIN1", activePlayer: 0,
        hand: [{ objectId: "h1", cardId: "phyrexian_rager" }],
        battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }],
      });
    const cast = { type: "castSpell" as const, objectId: "h1", targets: [] };
    expect(a.scorePriorityAction(view(1), cast)).toBeLessThan(-100);
    expect(a.scorePriorityAction(view(5), cast)).toBeGreaterThan(-100);
  });

  it("book of shame 28 (S26 r3, the tapper discipline): Scepter of Dominance holds on our own turn with nothing to swing; fires in MAIN1 with an attacker; fires on the opponent's upkeep and beginning of combat, never after their attackers are declared", () => {
    const a = agent();
    const view = (opts: { step: string; activePlayer: 0 | 1; swing?: boolean }) =>
      mkView({
        step: opts.step, activePlayer: opts.activePlayer,
        battlefield: [
          { id: "scep", cardId: "scepter_of_dominance", controller: 0 }, { id: "p1", cardId: "plains", controller: 0 }, { id: "p2", cardId: "plains", controller: 0 },
          ...(opts.swing ? [{ id: "bear", cardId: "grizzly_bears", controller: 0 as const }] : []),
          { id: "ob", cardId: "grizzly_bears", controller: 1 },
        ],
      });
    const tap = { type: "activateAbility" as const, objectId: "scep", abilityIndex: 0, targets: [{ kind: "object" as const, id: "ob" }] };
    expect(a.scorePriorityAction(view({ step: "UPKEEP", activePlayer: 0 }), tap)).toBe(-Infinity); // our upkeep: hold
    expect(a.scorePriorityAction(view({ step: "MAIN1", activePlayer: 0 }), tap)).toBe(-Infinity); // nothing to swing with
    expect(a.scorePriorityAction(view({ step: "MAIN1", activePlayer: 0, swing: true }), tap)).toBeGreaterThan(-Infinity); // a blocker tapped down cashes
    expect(a.scorePriorityAction(view({ step: "UPKEEP", activePlayer: 1 }), tap)).toBeGreaterThan(-Infinity); // their turn, before attackers
    expect(a.scorePriorityAction(view({ step: "COMBAT_BEGIN", activePlayer: 1 }), tap)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(view({ step: "DECLARE_BLOCKERS", activePlayer: 1 }), tap)).toBe(-Infinity); // too late to matter
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
    // Post-S43: the Cleric's life is an idle-mana sink — read at the opponent's end step, its open window (book 73).
    const cleric = (lib: number) => mkView({ librarySizes: [lib, 20], step: "END", activePlayer: 1, battlefield: [{ id: "cleric", cardId: "the_pearl_cleric", controller: 0 }] });
    expect(a.scorePriorityAction(cleric(3), { type: "activateAbility", objectId: "cleric", abilityIndex: 0, targets: [] })).toBe(-Infinity);
    expect(a.scorePriorityAction(cleric(12), { type: "activateAbility", objectId: "cleric", abilityIndex: 0, targets: [] })).toBeGreaterThan(-Infinity);
  });

  it("book of shame 70 (post-S43, Chris: a Dark Ritual and then nothing): the burst's card must be castable in THIS step, payable by colour, and one we would cast", () => {
    const a = agent("midrange");
    const rit = { type: "castSpell" as const, objectId: "rit", targets: [] };
    const sw = (id: string) => ({ id, cardId: "swamp", controller: 0 as const });
    const fo = (id: string) => ({ id, cardId: "forest", controller: 0 as const });
    // The S17 pin's board (Swamp, Ritual + Specter) in our upkeep: the mana would empty before the main phase.
    const specter = { hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "spec", cardId: "hypnotic_specter" }], battlefield: [sw("s1")] };
    expect(a.scorePriorityAction(mkView({ ...specter, step: "UPKEEP" }), rit)).toBe(-Infinity);
    expect(a.scorePriorityAction(mkView({ ...specter, step: "MAIN1", stack: [{ id: "x", kind: "spell", cardId: "shock", controller: 1 }] }), rit)).toBe(-Infinity); // in response: a sorcery-speed card waits
    expect(a.scorePriorityAction(mkView(specter), rit)).toBeGreaterThan(a.scorePriorityAction(mkView(specter), { type: "pass" }));
    // Pelakka Wurm ({4}{G}{G}{G}) off five Swamps: seven mana, none of it green — never; off three Forests and two Swamps: a play.
    const wurm = (lands: { id: string; cardId: string; controller: 0 }[]) => mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "pw", cardId: "pelakka_wurm" }], battlefield: lands });
    expect(a.scorePriorityAction(wurm([sw("s1"), sw("s2"), sw("s3"), sw("s4"), sw("s5")]), rit)).toBe(-Infinity);
    const green = wurm([fo("f1"), fo("f2"), fo("f3"), sw("s1"), sw("s2")]);
    expect(a.scorePriorityAction(green, rit)).toBeGreaterThan(a.scorePriorityAction(green, { type: "pass" }));
    // Buried Alive with no reanimator in hand: our own gate refuses it, so the Ritual enables nothing.
    expect(a.scorePriorityAction(mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "ba", cardId: "buried_alive" }], battlefield: [sw("s1")] }), rit)).toBe(-Infinity);
  });

  it("book of shame 71 (post-S43, Chris: Graceful Restoration \"with nothing happening\"): the up-to-two mode cast at no targets is never a play; with a body to return it is", () => {
    const a = agent("midrange");
    const lands = [{ id: "p1", cardId: "plains", controller: 0 as const }, ...["s1", "s2", "s3", "s4"].map((id) => ({ id, cardId: "swamp", controller: 0 as const }))];
    const empty = mkView({ hand: [{ objectId: "gr", cardId: "graceful_restoration" }], battlefield: lands });
    expect(a.scorePriorityAction(empty, { type: "castSpell", objectId: "gr", targets: [], mode: 1 })).toBe(-Infinity);
    const yard = [{ objectId: "g_b", cardId: "grizzly_bears" }];
    const stocked: GameView = { ...empty, graveyardObjects: [yard, []], graveyards: [["grizzly_bears"], []] };
    expect(a.scorePriorityAction(stocked, { type: "castSpell", objectId: "gr", targets: [{ kind: "object", id: "g_b" }], mode: 1 })).toBeGreaterThan(-Infinity);
  });

  it("book of shame 72 (post-S43, Chris — the Cinquefont fight): Mystic Snake is never cast with only our own spell on the stack (its mandatory trigger would counter it); in response to theirs it is", () => {
    const a = agent("midrange");
    const lands = ["i1", "i2", "i3", "f1"].map((id, k) => ({ id, cardId: k < 3 ? "island" : "forest", controller: 0 as const }));
    const snake = { type: "castSpell" as const, objectId: "sn", targets: [] };
    const ours = mkView({ hand: [{ objectId: "sn", cardId: "mystic_snake" }], battlefield: lands, stack: [{ id: "ty", kind: "spell", cardId: "the_ruby_tyrant", controller: 0 }] });
    expect(a.scorePriorityAction(ours, snake)).toBe(-Infinity);
    const theirs = mkView({ hand: [{ objectId: "sn", cardId: "mystic_snake" }], battlefield: lands, stack: [{ id: "sa", kind: "spell", cardId: "serra_angel", controller: 1 }], activePlayer: 1, step: "MAIN1" });
    expect(a.scorePriorityAction(theirs, snake)).toBeGreaterThan(-Infinity);
  });

  it("book of shame 73 (post-S43, Chris: the Pearl Cleric and Faerie Formation spent every mana on untap): a value sink spends only idle mana — never in our upkeep or first main; at their end step, or in our second main with nothing to cast", () => {
    const a = agent("midrange");
    const islands = ["i1", "i2", "i3", "i4"].map((id) => ({ id, cardId: "island", controller: 0 as const }));
    const ff = { type: "activateAbility" as const, objectId: "ff", abilityIndex: 0, targets: [] };
    const board = [...islands, { id: "ff", cardId: "faerie_formation", controller: 0 as const }];
    const drake = [{ objectId: "wd", cardId: "wind_drake" }];
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "UPKEEP" }), ff)).toBe(-Infinity);
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "MAIN1" }), ff)).toBe(-Infinity);
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "MAIN2", hand: drake }), ff)).toBe(-Infinity); // the Drake wants the mana
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "MAIN2" }), ff)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "END", activePlayer: 1, hand: drake }), ff)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(mkView({ battlefield: board, step: "UPKEEP", activePlayer: 1 }), ff)).toBe(-Infinity);
    // The Cleric's life, the same rule.
    const cl = { type: "activateAbility" as const, objectId: "pc", abilityIndex: 0, targets: [] };
    const clBoard = [{ id: "p1", cardId: "plains", controller: 0 as const }, { id: "pc", cardId: "the_pearl_cleric", controller: 0 as const }];
    expect(a.scorePriorityAction(mkView({ battlefield: clBoard, step: "MAIN1" }), cl)).toBe(-Infinity);
    expect(a.scorePriorityAction(mkView({ battlefield: clBoard, step: "END", activePlayer: 1 }), cl)).toBeGreaterThan(-Infinity);
  });

  it("book of shame 74 (S45, Dread Presence — the draw 95 of 95): the damage mode for a creature it kills or a lethal point or low life; the draw while the hand is short; the face once it is full", () => {
    const a = agent("midrange");
    const req = { player: 0 as const, purpose: "chooseMode" as const, actions: [{ type: "chooseMode" as const, mode: 0, label: "You draw a card and you lose 1 life" }, { type: "chooseMode" as const, mode: 1, label: "Dread Presence deals 2 damage to any target and you gain 2 life" }] };
    const dp = { id: "dp", cardId: "dread_presence", controller: 0 as const };
    const pick = (v: GameView) => (a.modeChoice(v, req) as { mode: number }).mode;
    expect(pick(mkView({ battlefield: [dp, { id: "bears", cardId: "grizzly_bears", controller: 1 }] }))).toBe(1); // kills the Bears
    expect(pick(mkView({ battlefield: [dp, { id: "wurm", cardId: "pelakka_wurm", controller: 1 }], hand: [{ objectId: "h1", cardId: "island" }] }))).toBe(0); // nothing dies, hand short: draw
    expect(pick(mkView({ battlefield: [dp], life: [20, 2] }))).toBe(1); // lethal
    expect(pick(mkView({ battlefield: [dp], life: [4, 20] }))).toBe(1); // our life low: the heal, not the life-cost draw
    const full = [1, 2, 3, 4, 5].map((n) => ({ objectId: `h${n}`, cardId: "island" }));
    expect(pick(mkView({ battlefield: [dp, { id: "wurm", cardId: "pelakka_wurm", controller: 1 }], hand: full }))).toBe(1); // hand full: the face
  });

  it("book of shame 78 (S45, the planner's restated Dragon Mage line — spend before the wheel): in our MAIN1 with the wheel ready to attack, the Shock in hand is cast (it would be discarded); without the wheel, or after combat, no such credit", () => {
    const a = agent("aggro");
    const lands = [{ id: "m1", cardId: "mountain", controller: 0 as const }];
    const shock = { type: "castSpell" as const, objectId: "sh", targets: [{ kind: "player" as const, player: 1 }] };
    const hand = [{ objectId: "sh", cardId: "shock" }];
    const withMage = mkView({ hand, battlefield: [...lands, { id: "dm", cardId: "dragon_mage", controller: 0 }] });
    const noMage = mkView({ hand, battlefield: [...lands, { id: "hg", cardId: "hill_giant", controller: 0 }] });
    expect(a.wheelSpendBonus(withMage, shock)).toBe(1);
    expect(a.wheelSpendBonus(noMage, shock)).toBe(0);
    expect(a.wheelSpendBonus(mkView({ hand, step: "MAIN2", battlefield: withMage.battlefield.map((o) => ({ id: o.id, cardId: o.cardId, controller: o.controller })) }), shock)).toBe(0); // after combat: the wheel has turned or will not
    expect(a.scorePriorityAction(withMage, shock) - a.scorePriorityAction(withMage, { type: "pass" })).toBeGreaterThan(a.scorePriorityAction(noMage, shock) - a.scorePriorityAction(noMage, { type: "pass" }));
  });

  it("book of shame 75 (S45, the Tidewall): a safe block that hands back a spell is worth the card (and costs the attacker it); the return takes the dearest spell — Counterspell over Brainstorm", async () => {
    const a = agent("control");
    const board = (yard: string[]): GameView => ({ ...mkView({ battlefield: [{ id: "tw", cardId: "tidewall", controller: 0 }, { id: "gi", cardId: "hill_giant", controller: 1 }] }), graveyardObjects: [yard.map((c, i) => ({ objectId: `g${i}`, cardId: c })), []], graveyards: [yard, []] });
    const gain = (v: GameView) => { const cs = viewCreatures(v); return a.blockGain(v, cs.find((c) => c.id === "tw")!, cs.find((c) => c.id === "gi")!); };
    expect(gain(board(["counterspell"]))).toBeGreaterThan(gain(board([])));
    expect(gain(board([]))).toBeGreaterThan(0); // prevented damage alone: 0 power never trades, the block is safe
    // The attacker's side: swinging a Hill Giant into the Tidewall with a spell in its yard scores below the same swing without.
    const atk = (yard: string[]): GameView => ({ ...mkView({ step: "DECLARE_ATTACKERS", activePlayer: 1, battlefield: [{ id: "tw", cardId: "tidewall", controller: 0 }, { id: "gi", cardId: "hill_giant", controller: 1 }] }), you: 1, graveyardObjects: [yard.map((c, i) => ({ objectId: `g${i}`, cardId: c })), []], graveyards: [yard, []] });
    const cs = (v: GameView) => viewCreatures(v);
    // (a fresh agent per board: the attack scorer memoizes by attacker set and life within a turn)
    expect(await agent("aggro").scoreAttackSet(atk(["counterspell"]), cs(atk(["counterspell"])) as never, 1, ["gi"])).toBeLessThan(await agent("aggro").scoreAttackSet(atk([]), cs(atk([])) as never, 1, ["gi"]));
    // The trigger's target: the dearest spell.
    const v = board(["brainstorm", "counterspell", "grizzly_bears"]);
    const req = { player: 0 as const, purpose: "chooseTarget" as const, source: { cardId: "tidewall", effects: [{ type: "returnFromGraveyard" as const, target: 0, to: "hand" as const }] }, actions: ["g0", "g1"].map((id) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id }] })) };
    const picked = (await a.chooseAction(v, req as never)) as { targets: { id: string }[] };
    expect(picked.targets[0]!.id).toBe("g1");
  });

  it("book of shame 76 (S45, the Guttersnipe — 69 of 90 spells cast while it waited): a cheap spell at the face waits for the payoff in hand; removal, a lethal point, low life and a payoff already out do not wait", () => {
    const a = agent("aggro");
    const lands = [{ id: "m1", cardId: "mountain", controller: 0 as const }, { id: "m2", cardId: "mountain", controller: 0 as const }];
    const hand = [{ objectId: "sh", cardId: "shock" }, { objectId: "gs", cardId: "guttersnipe" }];
    const face = { type: "castSpell" as const, objectId: "sh", targets: [{ kind: "player" as const, player: 1 }] };
    expect(a.scorePriorityAction(mkView({ hand, battlefield: lands }), face)).toBe(-Infinity);
    const withBears = mkView({ hand, battlefield: [...lands, { id: "bears", cardId: "grizzly_bears", controller: 1 }] });
    expect(a.scorePriorityAction(withBears, { type: "castSpell", objectId: "sh", targets: [{ kind: "object", id: "bears" }] })).toBeGreaterThan(-Infinity); // removal
    expect(a.scorePriorityAction(mkView({ hand, battlefield: lands, life: [20, 2] }), face)).toBeGreaterThan(-Infinity); // lethal
    expect(a.scorePriorityAction(mkView({ hand, battlefield: lands, life: [5, 20] }), face)).toBeGreaterThan(-Infinity); // our life low
    expect(a.scorePriorityAction(mkView({ hand: [hand[0]!], battlefield: [...lands, { id: "gso", cardId: "guttersnipe", controller: 0 }] }), face)).toBeGreaterThan(-Infinity); // it is out
    expect(a.scorePriorityAction(mkView({ hand, battlefield: [lands[0]!] }), face)).toBeGreaterThan(-Infinity); // one land: the Guttersnipe cannot land by next turn
  });

  it("book of shame 77 (S45, Seedborn Muse): under the Muse the attack pays no deterrence — every attacker untaps in their untap step to block", async () => {
    const a = agent("midrange");
    const board = (muse: boolean) => mkView({
      life: [8, 20], step: "DECLARE_ATTACKERS", activePlayer: 0,
      battlefield: [{ id: "bal", cardId: "rumbling_baloth", controller: 0 }, ...(muse ? [{ id: "muse", cardId: "seedborn_muse", controller: 0 as const }] : []), { id: "b1", cardId: "grizzly_bears", controller: 1 }, { id: "b2", cardId: "grizzly_bears", controller: 1 }],
    });
    const creaturesOf = (v: GameView) => v.battlefield.filter((o) => o.power !== null).map((o) => ({ id: o.id, controller: o.controller, power: o.power!, toughness: o.toughness!, keywords: o.keywords, damage: 0 }));
    const on = board(true), off = board(false);
    void a; // a fresh agent per board: the attack scorer memoizes by attacker set and life within a turn
    expect(await agent("midrange").scoreAttackSet(on, creaturesOf(on) as never, 0, ["bal"])).toBeGreaterThan(await agent("midrange").scoreAttackSet(off, creaturesOf(off) as never, 0, ["bal"]));
  });

  it("book of shame 79 (S45 follow-up, the Warden's Scepter — 18 of 100 games): the tapper fires in MAIN1 only for a swing that can happen — a creature cast this turn is no swing; the wheel's spend bonus waits for a wheel that can attack", () => {
    const a = agent("midrange");
    const scepter = { type: "activateAbility" as const, objectId: "sc", abilityIndex: 0, targets: [{ kind: "object" as const, id: "their" }] };
    const board = (sick: boolean) => mkView({ step: "MAIN1", battlefield: [{ id: "sc", cardId: "scepter_of_dominance", controller: 0 }, ...["p1", "p2", "p3"].map((id) => ({ id, cardId: "plains", controller: 0 as const })), { id: "lions", cardId: "savannah_lions", controller: 0, summoningSick: sick }, { id: "their", cardId: "grizzly_bears", controller: 1 }] });
    expect(a.tapperGated(board(true), scepter)).toBe(true); // the Lions came down this turn: nothing swings
    expect(a.tapperGated(board(false), scepter)).toBe(false); // a ready Lions: the tap clears the way
    const shock = { type: "castSpell" as const, objectId: "sh", targets: [{ kind: "player" as const, player: 1 }] };
    const wheel = (sick: boolean) => mkView({ hand: [{ objectId: "sh", cardId: "shock" }], battlefield: [{ id: "m1", cardId: "mountain", controller: 0 }, { id: "dm", cardId: "dragon_mage", controller: 0, summoningSick: sick }] });
    expect(a.wheelSpendBonus(wheel(true), shock)).toBe(0);
    expect(a.wheelSpendBonus(wheel(false), shock)).toBe(1);
  });

  it("book of shame 80 (S45 follow-up — 17 Rituals refused on a sick Elf's mana): a mana creature cast this turn is no mana, so the Ritual that enables the two-drop IS a play; with the Elf ready, the two-drop is already affordable and the Ritual waits", () => {
    const a = agent("midrange");
    const rit = { type: "castSpell" as const, objectId: "rit", targets: [] };
    const board = (sick: boolean) => mkView({ hand: [{ objectId: "rit", cardId: "dark_ritual" }, { objectId: "cn", cardId: "child_of_night" }], battlefield: [{ id: "sw", cardId: "swamp", controller: 0 }, { id: "elf", cardId: "llanowar_elves", controller: 0, summoningSick: sick }] });
    expect(a.manaBurst(board(true), rit)).toEqual({ enables: true });
    expect(a.scorePriorityAction(board(true), rit)).toBeGreaterThan(a.scorePriorityAction(board(true), { type: "pass" }));
    expect(a.manaBurst(board(false), rit)).toEqual({ enables: false });
  });

  it("book of shame 81 (S46, Entomb): never without a reanimator — in hand OR on our board (the Reeve's activation); with one, a play; its search takes the best body to bring back", async () => {
    const a = agent("midrange");
    const ent = { type: "castSpell" as const, objectId: "en", targets: [] };
    const sw = { id: "s1", cardId: "swamp", controller: 0 as const };
    expect(a.scorePriorityAction(mkView({ hand: [{ objectId: "en", cardId: "entomb" }], battlefield: [sw] }), ent)).toBe(-Infinity);
    expect(a.scorePriorityAction(mkView({ hand: [{ objectId: "en", cardId: "entomb" }, { objectId: "zo", cardId: "zombify" }], battlefield: [sw] }), ent)).toBeGreaterThan(-Infinity);
    expect(a.scorePriorityAction(mkView({ hand: [{ objectId: "en", cardId: "entomb" }], battlefield: [sw, { id: "rv", cardId: "the_reeve", controller: 0 }] }), ent)).toBeGreaterThan(-Infinity);
    const req = { player: 0 as const, purpose: "searchLibrary" as const, source: { cardId: "entomb", effects: [{ type: "searchLibrary" as const, predicate: "anyCard" as const, to: "graveyard" as const, count: 1 }] }, revealed: [{ objectId: "l1", cardId: "grizzly_bears" }, { objectId: "l2", cardId: "artisan_of_kozilek" }, { objectId: "l3", cardId: "island" }], actions: [{ type: "searchPick" as const, objectId: "l1" }, { type: "searchPick" as const, objectId: "l2" }, { type: "searchPick" as const, objectId: "l3" }, { type: "declineSearch" as const }] };
    expect(((await a.chooseAction(mkView({}), req as never)) as { objectId: string }).objectId).toBe("l2");
  });

  it("book of shame 82 (S46, Ponder): short of lands the land goes on top; with lands enough the castable spell; the shuffle only when all three are poor", async () => {
    const a = agent("midrange");
    const rev = [{ objectId: "x1", cardId: "island" }, { objectId: "x2", cardId: "counterspell" }, { objectId: "x3", cardId: "pelakka_wurm" }];
    const order = { player: 0 as const, purpose: "orderTop" as const, revealed: rev, actions: rev.map((r) => ({ type: "putOnTop" as const, objectId: r.objectId })) };
    const islands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, cardId: "island", controller: 0 as const }));
    expect(((await a.chooseAction(mkView({ battlefield: islands(2) }), order as never)) as { objectId: string }).objectId).toBe("x1"); // two lands: the Island
    expect(((await a.chooseAction(mkView({ battlefield: islands(5), hand: [{ objectId: "h", cardId: "island" }] }), order as never)) as { objectId: string }).objectId).toBe("x2"); // five lands and one in hand: Counterspell
    const shuffle = (r: typeof rev) => ({ player: 0 as const, purpose: "mayShuffle" as const, revealed: r, actions: [{ type: "acceptOptional" as const }, { type: "declineOptional" as const }] });
    const poor = [{ objectId: "y1", cardId: "island" }, { objectId: "y2", cardId: "island" }, { objectId: "y3", cardId: "artisan_of_kozilek" }];
    expect(((await a.chooseAction(mkView({ battlefield: islands(5), hand: [{ objectId: "h", cardId: "island" }] }), shuffle(poor) as never)) as { type: string }).type).toBe("acceptOptional"); // flooded: lands poor, the 10-drop far off
    expect(((await a.chooseAction(mkView({ battlefield: islands(2) }), shuffle(rev) as never)) as { type: string }).type).toBe("declineOptional");
  });

  it("book of shame 83 (S46, Vitalist): the counters go on our evasive creature, never theirs; lifegain plays are worth more while she is out", async () => {
    const a = agent("midrange");
    const v = mkView({ battlefield: [{ id: "vt", cardId: "vitalist", controller: 0 }, { id: "hawk", cardId: "suntail_hawk", controller: 0 }, { id: "bears", cardId: "grizzly_bears", controller: 0 }, { id: "wurm", cardId: "pelakka_wurm", controller: 1 }] });
    const req = { player: 0 as const, purpose: "chooseTarget" as const, source: { cardId: "vitalist", effects: [{ type: "addCounters" as const, kind: "+1/+1", count: { ref: "eventLife" as const }, target: 0 }] }, actions: ["hawk", "bears", "wurm"].map((id) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id }] })) };
    expect(((await a.chooseAction(v, req as never)) as { targets: { id: string }[] }).targets[0]!.id).toBe("hawk");
    const warden = { type: "castSpell" as const, objectId: "sw", targets: [] };
    expect(a.lifegainPayoffBonus(mkView({ hand: [{ objectId: "sw", cardId: "soul_warden" }], battlefield: [{ id: "vt", cardId: "vitalist", controller: 0 }] }), warden)).toBeGreaterThan(0);
    expect(a.lifegainPayoffBonus(mkView({ hand: [{ objectId: "sw", cardId: "soul_warden" }], battlefield: [] }), warden)).toBe(0);
  });

  it("book of shame 84 (S46, Angelic Destiny and the Baloths): the Aura prefers the hexproof host (S29's rule, unchanged); a landfall creature is cast before the land drop (book 56's rule reaches the Baloths)", () => {
    const a = agent("aggro");
    const plains = ["p1", "p2", "p3", "p4"].map((id) => ({ id, cardId: "plains", controller: 0 as const }));
    const v = mkView({ hand: [{ objectId: "ad", cardId: "angelic_destiny" }], battlefield: [...plains, { id: "scout", cardId: "gladecover_scout", controller: 0 }, { id: "bears", cardId: "grizzly_bears", controller: 0 }] });
    const on = (id: string) => a.scorePriorityAction(v, { type: "castSpell", objectId: "ad", targets: [{ kind: "object", id }] });
    expect(on("scout")).toBeGreaterThan(on("bears"));
    const forests = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, cardId: "forest", controller: 0 as const }));
    const cands = [{ type: "playLand" as const, objectId: "land" }, { type: "castSpell" as const, objectId: "rb", targets: [] }, { type: "pass" as const }];
    expect(a.landfallFirstCandidates(mkView({ hand: [{ objectId: "land", cardId: "forest" }, { objectId: "rb", cardId: "rampaging_baloths" }], battlefield: forests }), cands)?.some((x) => x.type === "playLand")).toBe(false);
  });

  it("book of shame 85 (post-S48, Chris — Tendrils for two at a three-toughness creature): a counted amount is counted — the spell is no play when its damage would not kill, and a play when it would", () => {
    const a = agent();
    const swamps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, cardId: "swamp", controller: 0 as const }));
    const cast = { type: "castSpell" as const, objectId: "t", targets: [{ kind: "object" as const, id: "x" }] };
    const at = (n: number, who: string, step = "MAIN1") => { const v = mkView({ step, hand: [{ objectId: "t", cardId: "tendrils_of_corruption" }], battlefield: [...swamps(n), { id: "p0", cardId: "plains", controller: 0 }, { id: "p1", cardId: "plains", controller: 0 }, { id: "x", cardId: who, controller: 1 }] }); return a.scorePriorityAction(v, cast) - a.scorePriorityAction(v, { type: "pass" }); };
    expect(at(2, "hill_giant")).toBeLessThan(0); // two Swamps, a 3/3: the reported cast
    expect(at(2, "hill_giant", "UPKEEP")).toBeLessThan(0);
    expect(at(3, "hill_giant")).toBeGreaterThan(0); // the third Swamp makes it removal
    expect(at(2, "grizzly_bears")).toBeGreaterThan(0);
  });

  it("book of shame 86 (post-S48, Chris — the Warhammer passed back and forth until the mana ran out): equipment on a creature of ours does not move to another unless the move puts it to work this turn", () => {
    const a = agent();
    const lands = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, cardId: "swamp", controller: 0 as const }));
    const equip = (to: string) => ({ type: "activateAbility" as const, objectId: "wh", abilityIndex: 1, targets: [{ kind: "object" as const, id: to }] });
    const board = (b1: Partial<Obj>, b2: Partial<Obj>, on: string | null = "b1") => mkView({ battlefield: [...lands, { id: "wh", cardId: "loxodon_warhammer", controller: 0, attachedTo: on }, { id: "b1", cardId: "grizzly_bears", controller: 0, ...b1 }, { id: "b2", cardId: "grizzly_bears", controller: 0, ...b2 }] });
    const gain = (v: GameView, to: string) => a.scorePriorityAction(v, equip(to)) - a.scorePriorityAction(v, { type: "pass" });
    expect(gain(board({}, {}), "b2")).toBeLessThan(0); // two ready hosts: the churn
    expect(gain(board({}, {}), "b1")).toBeLessThan(0); // the same host (the S14 rule, unchanged)
    expect(gain(board({}, { summoningSick: true }), "b2")).toBeLessThan(0); // onto a creature that cannot swing
    expect(gain(board({ tapped: true }, {}), "b2")).toBeGreaterThan(0); // off a tapped host onto a ready one, before combat
    expect(gain(board({ summoningSick: true }, {}), "b2")).toBeGreaterThan(0);
    expect(gain(board({}, {}, null), "b2")).toBeGreaterThan(0); // unattached: equipping is a play, as before
  });

  it("book of shame 87 (post-S48, Chris — a creature cast before the Soul Warden, the life missed): with mana for both, the creature-watcher is cast first; short of mana for both, the choice stays open", () => {
    const a = agent();
    const cast = (id: string) => ({ type: "castSpell" as const, objectId: id, targets: [] });
    const hand = [{ objectId: "sw", cardId: "soul_warden" }, { objectId: "gb", cardId: "grizzly_bears" }, { objectId: "sh", cardId: "shock" }];
    const lands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, cardId: i % 2 ? "plains" : "forest", controller: 0 as const }));
    const all = [cast("sw"), cast("gb"), cast("sh"), { type: "pass" as const }];
    const three = a.watcherFirstCandidates(mkView({ hand, battlefield: lands(3) }), all)!;
    expect(three.map((x) => (x as { objectId?: string }).objectId ?? "pass")).toEqual(["sw", "sh", "pass"]); // the Bears wait; the Shock and the pass stay
    expect(a.watcherFirstCandidates(mkView({ hand, battlefield: lands(2) }), all)).toBeNull(); // two lands: Warden + Bears is three mana
    expect(a.watcherFirstCandidates(mkView({ hand, battlefield: lands(3) }), [cast("gb"), cast("sh"), { type: "pass" as const }])).toBeNull(); // no watcher among the plays
    // a watcher of OPPONENTS' creatures only is no reason to hurry (the shape reads the controller)
    expect(a.watcherFirstCandidates(mkView({ hand: [{ objectId: "gb", cardId: "grizzly_bears" }, { objectId: "hg", cardId: "hill_giant" }], battlefield: lands(6) }), [cast("gb"), cast("hg")])).toBeNull();
  });

  it("book of shame 88 (post-S49 — the Sealed probe: 69 of 195 Lightning Bolts at the face of an empty board, thirteen life or more): removal is not thrown at a healthy face — it waits for a creature, for lethal, or for an opponent within reach; the aggro deck's burn is reach, as before", () => {
    const bolt = (to: "face" | string) => ({ type: "castSpell" as const, objectId: "lb", targets: [to === "face" ? { kind: "player" as const, player: 1 as const } : { kind: "object" as const, id: to }] });
    const v = (life: [number, number], theirs: Obj[] = []) => mkView({ life, hand: [{ objectId: "lb", cardId: "lightning_bolt" }], battlefield: [{ id: "m", cardId: "mountain", controller: 0 }, ...theirs] });
    const mid = agent("midrange"), ctl = agent("control"), agg = agent("aggro");
    expect(mid.faceBurnHoldGated(v([20, 20]), bolt("face"))).toBe(true); // the reported cast: turn one, an empty board
    expect(ctl.faceBurnHoldGated(v([20, 14]), bolt("face"))).toBe(true);
    expect(mid.scorePriorityAction(v([20, 20]), bolt("face"))).toBe(-Infinity);
    expect(mid.faceBurnHoldGated(v([20, 8]), bolt("face"))).toBe(false); // within reach: the burn is closing
    expect(mid.faceBurnHoldGated(v([20, 3]), bolt("face"))).toBe(false); // lethal
    expect(agg.faceBurnHoldGated(v([20, 20]), bolt("face"))).toBe(false); // the race is the plan
    const bears: Obj[] = [{ id: "x", cardId: "grizzly_bears", controller: 1 }];
    expect(mid.faceBurnHoldGated(v([20, 20], bears), bolt("x"))).toBe(false); // at a creature: removal, never held
    expect(mid.scorePriorityAction(v([20, 20], bears), bolt("x"))).toBeGreaterThan(mid.scorePriorityAction(v([20, 20], bears), { type: "pass" }));
    // outside the rule (known): a VARIABLE amount (X / mana spent — Sacred Helix, Blaze) is not read; only numeric damage is
    const drain = mkView({ hand: [{ objectId: "h", cardId: "sacred_helix" }], battlefield: [] });
    expect(mid.faceBurnHoldGated(drain, { type: "castSpell", objectId: "h", targets: [{ kind: "player", player: 1 }] })).toBe(false);
  });

  it("book of shame 89 (S50, Flametongue Kavu): the four goes at the best creature it KILLS before the biggest it only wounds; with only our own side to hit, at the one that survives or costs least; the cast waits when its trigger can only hurt us, and is worth more when it kills", async () => {
    const a = agent();
    const L = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, cardId: "mountain", controller: 0 as const }));
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "chooseTarget" as const, source: { cardId: "flametongue_kavu", effects: [{ type: "damage" as const, amount: 4, target: 0 }] }, actions: ids.map((id) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id }] })) });
    const pick = async (v: GameView, ids: string[]) => ((await a.chooseAction(v, req(ids) as never)) as { targets: { id: string }[] }).targets[0]!.id;
    const board = mkView({ battlefield: [{ id: "k", cardId: "flametongue_kavu", controller: 0 }, { id: "angel", cardId: "serra_angel", controller: 0 }, { id: "wurm", cardId: "pelakka_wurm", controller: 0 }, { id: "g", cardId: "hill_giant", controller: 1 }, { id: "w", cardId: "pelakka_wurm", controller: 1 }, { id: "b", cardId: "grizzly_bears", controller: 1 }] });
    expect(await pick(board, ["k", "angel", "g", "w", "b"])).toBe("g"); // the 3/3 dies; the 7/7 would not (it took the Wurm before)
    expect(await pick(board, ["k", "angel", "w"])).toBe("w"); // nothing dies: the biggest
    expect(await pick(board, ["k", "angel", "wurm"])).toBe("wurm"); // only ours: the one that survives four
    expect(["k", "angel"]).toContain(await pick(board, ["k", "angel"])); // only ours, both die: the lesser loss
    expect(await pick(mkView({ battlefield: [{ id: "k", cardId: "flametongue_kavu", controller: 0 }, { id: "angel", cardId: "serra_angel", controller: 0 }] }), ["k", "angel"])).toBe("k"); // a 4/2 for {3}{R} before a 4/4 flier
    const cast = { type: "castSpell" as const, objectId: "h", targets: [] };
    const hand = [{ objectId: "h", cardId: "flametongue_kavu" }];
    expect(a.entersHarmGated(mkView({ hand, battlefield: L }), cast)).toBe(true); // an empty table: it would shoot itself
    expect(a.entersHarmGated(mkView({ hand, battlefield: [...L, { id: "b", cardId: "grizzly_bears", controller: 0 }] }), cast)).toBe(true); // or our Bears
    expect(a.entersHarmGated(mkView({ hand, battlefield: [...L, { id: "wurm", cardId: "pelakka_wurm", controller: 0 }] }), cast)).toBe(false); // our Wurm shrugs it off
    expect(a.entersHarmGated(mkView({ hand, battlefield: [...L, { id: "w", cardId: "pelakka_wurm", controller: 1 }] }), cast)).toBe(false); // theirs to hit, even unkillable: the body is the point
    expect(a.scorePriorityAction(mkView({ hand, battlefield: L }), cast)).toBe(-Infinity);
    const kill = mkView({ hand, battlefield: [...L, { id: "g", cardId: "hill_giant", controller: 1 }] }), noKill = mkView({ hand, battlefield: [...L, { id: "w", cardId: "pelakka_wurm", controller: 1 }] });
    expect(a.entersKillBonus(kill, cast)).toBeGreaterThan(0);
    expect(a.entersKillBonus(noKill, cast)).toBe(0);
    expect(a.entersHarmGated(mkView({ hand: [{ objectId: "h", cardId: "grizzly_bears" }], battlefield: L }), cast)).toBe(false); // any other creature: not the shape
  });

  it("book of shame 90 (S50, Furnace Whelp — the pump scored +0.2 at any moment and drained the lands): a self-pump is combat damage on an unblocked attacker or a fight it then wins and survives; never idle, never into a fight that kills it anyway", () => {
    const a = agent();
    const L = Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, cardId: "mountain", controller: 0 as const }));
    const pump = { type: "activateAbility" as const, objectId: "wh", abilityIndex: 0, targets: [] };
    const v = (foe: string, o: Parameters<typeof mkView>[0] = {}) => mkView({ battlefield: [...L, { id: "wh", cardId: "furnace_whelp", controller: 0 }, { id: "x", cardId: foe, controller: 1 }], ...o });
    const blocks = (foe: string) => v(foe, { step: "DECLARE_BLOCKERS", combat: { attackers: ["wh"], blocks: [{ blocker: "x", attacker: "wh" }] } });
    expect(a.selfPumpGated(v("wall_of_air"), pump)).toBe(true); // the first main phase: the reported drain
    expect(a.scorePriorityAction(v("wall_of_air"), pump)).toBe(-Infinity);
    expect(a.selfPumpGated(v("wall_of_air", { step: "MAIN2" }), pump)).toBe(true);
    expect(a.selfPumpGated(v("wall_of_air", { step: "END", activePlayer: 1 }), pump)).toBe(true);
    expect(a.selfPumpGated(v("wall_of_air", { step: "DECLARE_BLOCKERS", combat: { attackers: ["wh"], blocks: [] } }), pump)).toBe(false); // unblocked: each {R} is a point
    expect(a.selfPumpGated(blocks("wall_of_air"), pump)).toBe(false); // a 1/5 in the way: three more power kills it, and it cannot kill a 2/2
    expect(a.selfPumpGated(blocks("serra_angel"), pump)).toBe(true); // a 4/4 kills the Whelp whatever it does
    expect(a.selfPumpGated(blocks("suntail_hawk"), pump)).toBe(true); // a 1/1: two power is already enough
    // blocking: the pump wins the fight against an attacker that cannot kill it
    expect(a.selfPumpGated(v("wall_of_air", { step: "DECLARE_BLOCKERS", activePlayer: 1, combat: { attackers: ["x"], blocks: [{ blocker: "wh", attacker: "x" }] } }), pump)).toBe(false);
    // not the shape: the Warhammer's equip, a mana ability
    expect(a.selfPumpGated(mkView({ battlefield: [...L, { id: "eb", cardId: "llanowar_elves", controller: 0 }] }), { type: "activateAbility", objectId: "eb", abilityIndex: 0, targets: [] })).toBe(false);
  });

  it("book of shame 91 (S50, Seasoned Pyromancer): our own discard gives up a land first once the mana is comfortable; short of lands it keeps them; the graveyard's two Elementals wait for idle mana", async () => {
    const a = agent();
    const L = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, cardId: "mountain", controller: 0 as const }));
    const hand = [{ objectId: "m", cardId: "mountain" }, { objectId: "s", cardId: "shock" }, { objectId: "k", cardId: "flametongue_kavu" }];
    const req = { player: 0 as const, purpose: "discard" as const, actions: hand.map((h) => ({ type: "discard" as const, objectId: h.objectId })) };
    const pick = async (lands: number) => ((await a.chooseAction(mkView({ hand, battlefield: L(lands) }), req as never)) as { objectId: string }).objectId;
    expect(await pick(5)).toBe("m"); // six lands with this one: it is the free discard (and makes no Elemental — the cost of keeping a spell)
    expect(await pick(2)).not.toBe("m"); // three lands in all: the land stays
    const gv = (o: Parameters<typeof mkView>[0]) => { const v = mkView({ battlefield: L(5), ...o }); (v as { graveyardObjects: unknown }).graveyardObjects = [[{ objectId: "gp", cardId: "seasoned_pyromancer" }], []]; (v as { graveyards: unknown }).graveyards = [["seasoned_pyromancer"], []]; return v; };
    const act = { type: "activateAbility" as const, objectId: "gp", abilityIndex: 1, targets: [] };
    expect(a.graveyardTokensGated(gv({}), act)).toBe(true); // the first main phase: the hand comes first
    expect(a.graveyardTokensGated(gv({ step: "MAIN2" }), act)).toBe(false); // the second, nothing in hand: idle mana
    expect(a.graveyardTokensGated(gv({ step: "MAIN2", hand: [{ objectId: "k", cardId: "flametongue_kavu" }] }), act)).toBe(true); // a castable card first
    expect(a.scorePriorityAction(gv({ step: "MAIN2" }), act)).toBeGreaterThan(a.scorePriorityAction(gv({ step: "MAIN2" }), { type: "pass" }));
  });

  it("book of shame 92 (S50, pinned as they stand): Rage Cobra's counters go on our evasive creature, else our best body, never theirs (Vitalist's rule, book 83); the Sharpshooter is cast before the creature it would watch (book 87)", async () => {
    const a = agent();
    const v = mkView({ battlefield: [{ id: "c", cardId: "rage_cobra", controller: 0 }, { id: "hawk", cardId: "suntail_hawk", controller: 0 }, { id: "gi", cardId: "hill_giant", controller: 0 }, { id: "t", cardId: "pelakka_wurm", controller: 1 }] });
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "chooseTarget" as const, source: { cardId: "rage_cobra", effects: [{ type: "addCounters" as const, kind: "+1/+1", count: { ref: "eventLife" as const }, target: 0 }] }, actions: ids.map((id) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id }] })) });
    const pick = async (ids: string[]) => ((await a.chooseAction(v, req(ids) as never)) as { targets: { id: string }[] }).targets[0]!.id;
    expect(await pick(["c", "hawk", "gi", "t"])).toBe("hawk");
    expect(await pick(["c", "gi", "t"])).toBe("gi");
    expect(await pick(["c", "t"])).toBe("c");
    const cast = (id: string) => ({ type: "castSpell" as const, objectId: id, targets: [] });
    const w = mkView({ hand: [{ objectId: "ss", cardId: "shocking_sharpshooter" }, { objectId: "gp", cardId: "goblin_piker" }], battlefield: Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, cardId: "mountain", controller: 0 as const })) });
    expect(a.watcherFirstCandidates(w, [cast("ss"), cast("gp")])!.map((x) => (x as { objectId: string }).objectId)).toEqual(["ss"]);
  });

  it("book of shame 93 (post-S52, Chris — a Bonesplitter passed back and forth to use up the mana): an equip the predictor calls unchanged is REFUSED, not merely scored a quarter-point under passing (the softmax still picked it one window in ten)", () => {
    const a = agent();
    const lands = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, cardId: "swamp", controller: 0 as const }));
    const equip = (to: string) => ({ type: "activateAbility" as const, objectId: "bs", abilityIndex: 1, targets: [{ kind: "object" as const, id: to }] });
    const board = (o: Parameters<typeof mkView>[0] = {}, b1: Partial<Obj> = {}, b2: Partial<Obj> = {}) => mkView({ battlefield: [...lands, { id: "bs", cardId: "bonesplitter", controller: 0, attachedTo: "b1" }, { id: "b1", cardId: "grizzly_bears", controller: 0, ...b1 }, { id: "b2", cardId: "hill_giant", controller: 0, ...b2 }], ...o });
    expect(a.scorePriorityAction(board(), equip("b2"))).toBe(-Infinity); // two ready creatures, the first main phase
    expect(a.scorePriorityAction(board(), equip("b1"))).toBe(-Infinity); // the same host
    expect(a.scorePriorityAction(board({ step: "MAIN2" }, { tapped: true }), equip("b2"))).toBe(-Infinity); // after combat, onto the one that stayed home
    expect(a.scorePriorityAction(board({ step: "MAIN2" }, {}, { tapped: true }), equip("b2"))).toBe(-Infinity);
    expect(a.scorePriorityAction(board({}, { summoningSick: true }), equip("b2"))).toBeGreaterThan(a.scorePriorityAction(board({}, { summoningSick: true }), { type: "pass" })); // book 86's one real move stands
  });

  it("book of shame 97 (post-S53, Chris — the Levy's wide board under Clio never blocked until lethal): a creature with no power left is cheap to throw in front of an attacker — the locked tokens chump; live 1/1s at healthy life still do not", async () => {
    const board = (depth: number) => {
      const v = mkView({ step: "DECLARE_BLOCKERS", activePlayer: 1, life: [14, 20], combat: { attackers: ["clio"], blocks: [] }, battlefield: [...Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, cardId: "soldier_1_1", controller: 0 as const })), { id: "clio", cardId: "clio_lady_of_the_depths", controller: 1, tapped: true }, { id: "tr", cardId: "traumatizer", controller: 1 }] });
      for (const o of v.battlefield) { if (o.controller === 0 && o.power !== null) o.power = 1 - depth; if (o.id === "clio") o.counters = { depth }; }
      return v;
    };
    const req = { player: 0 as const, purpose: "declareBlocker" as const, actions: [{ type: "doneDeclaringBlockers" as const }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ type: "declareBlocker" as const, blocker: `t${i}`, attacker: "clio" }))] };
    const blocks = async (depth: number) => { let n = 0; for (let k = 0; k < 20; k++) if ((await new HeuristicAgent(k + 1, pool, difficultyProfile("master", "midrange", [])).chooseAction(board(depth), req as never)).type === "declareBlocker") n += 1; return n; };
    expect(await blocks(2)).toBeGreaterThanOrEqual(18); // −1/1 tokens under Clio: chump the 2/4 (and deny the Traumatizer its mill)
    expect(await blocks(0)).toBeLessThanOrEqual(2); // live 1/1s are worth keeping at 14 life
  });

  it("book of shame 96 (post-S53, Chris — the field burned its removal on anything but Clio, whose depth counters locked its board): a removal's prediction lifts the removed permanent's static P/T from what remains, a debuffed creature is worth less, and a lock that grows each end step is worth its next step — Swords takes Clio over Serra Angel against a wide locked board, and still takes the Angel against a narrow one", () => {
    const board = (tokens: number, depth: number) => {
      const v = mkView({ life: [14, 20], hand: [{ objectId: "h", cardId: "swords_to_plowshares" }], battlefield: [{ id: "pl", cardId: "plains", controller: 0 }, ...Array.from({ length: tokens }, (_, i) => ({ id: `t${i}`, cardId: "soldier_1_1", controller: 0 as const })), { id: "clio", cardId: "clio_lady_of_the_depths", controller: 1 }, { id: "serra", cardId: "serra_angel", controller: 1 }] });
      for (const o of v.battlefield) { if (o.controller === 0 && o.power !== null) o.power = 1 - depth; if (o.id === "clio") o.counters = { depth }; } // Clio's lock, as the engine's view shows it
      return v;
    };
    const swords = (v: GameView, id: string) => agent().scorePriorityAction(v, { type: "castSpell", objectId: "h", targets: [{ kind: "object", id }] });
    const wide = board(6, 2), narrow = board(2, 1);
    expect(swords(wide, "clio")).toBeGreaterThan(swords(wide, "serra") + 1); // the lock on six bodies, and its next step
    expect(swords(narrow, "serra")).toBeGreaterThan(swords(narrow, "clio")); // one counter on two bodies: the 4/4 flier is the threat
  });

  it("book of shame 95 (post-S53, Chris — the field kept attacking into Voracious Cobra): a creature that destroys what it deals combat damage to is a deathtoucher in the attack simulation — a 3/3 stays home against it, and still swings into a plain 2/2", async () => {
    const req = { player: 0 as const, purpose: "declareAttacker" as const, actions: [{ type: "declareAttacker" as const, objectId: "g" }, { type: "doneDeclaringAttackers" as const }] };
    const into = (blocker: string) => mkView({ life: [20, 20], battlefield: [{ id: "g", cardId: "hill_giant", controller: 0 }, { id: "b", cardId: blocker, controller: 1 }] });
    // a fresh agent a board: the attack scores are memoised per turn on the attackers and the lives, not the board
    expect((await agent("midrange").attackChoice(into("voracious_cobra"), req)).type).toBe("doneDeclaringAttackers"); // first strike, then "destroy that creature"
    expect((await agent("midrange").attackChoice(into("grizzly_bears"), req)).type).toBe("declareAttacker"); // a plain 2/2 cannot block it profitably
  });

  it("book of shame 94 (post-S52, Chris — three Essence Scatters at one creature spell, the second creature then walking in): one counter answers one spell; when ours is countered the spell is live again", () => {
    const a = agent("control");
    const lands = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, cardId: "island", controller: 0 as const }));
    const hand = [{ objectId: "es", cardId: "essence_scatter" }, { objectId: "cs", cardId: "counterspell" }];
    const cast = (id: string, at: string) => ({ type: "castSpell" as const, objectId: id, targets: [{ kind: "stackItem" as const, id: at }] });
    const theirs = { id: "s1", kind: "spell", cardId: "hill_giant", controller: 1 as const };
    const ourFirst = { id: "s2", kind: "spell", cardId: "essence_scatter", controller: 0 as const, targets: [{ kind: "stackItem" as const, id: "s1" }] };
    const theirCounter = { id: "s3", kind: "spell", cardId: "counterspell", controller: 1 as const, targets: [{ kind: "stackItem" as const, id: "s2" }] };
    const v = (stack: unknown[]) => mkView({ hand, battlefield: lands, stack: stack as never, activePlayer: 1 });
    // their creature alone on the stack: a counter is a play
    expect(a.counterWarGated(v([theirs]), cast("es", "s1"))).toBe(false);
    expect(a.scorePriorityAction(v([theirs]), cast("es", "s1"))).toBeGreaterThan(a.scorePriorityAction(v([theirs]), { type: "pass" }));
    // our Scatter is already on it: the second (and the Counterspell) wait
    expect(a.counterWarGated(v([theirs, ourFirst]), cast("es", "s1"))).toBe(true);
    expect(a.scorePriorityAction(v([theirs, ourFirst]), cast("cs", "s1"))).toBe(-Infinity);
    expect(a.stackLive(v([theirs, ourFirst])).get("s1")).toBe(false);
    // they counter our Scatter: their creature is live again — countering it, or their counter, is a play
    const war = v([theirs, ourFirst, theirCounter]);
    expect([...a.stackLive(war)]).toEqual([["s1", true], ["s2", false], ["s3", true]]);
    expect(a.counterWarGated(war, cast("cs", "s3"))).toBe(false);
    expect(a.counterWarGated(war, cast("cs", "s1"))).toBe(false);
    expect(a.counterWarGated(war, cast("cs", "s2"))).toBe(true); // never our own doomed counter
    // and once we have answered their counter, the creature is answered again: no third spell at it
    const ourSecond = { id: "s4", kind: "spell", cardId: "counterspell", controller: 0 as const, targets: [{ kind: "stackItem" as const, id: "s3" }] };
    expect(a.counterWarGated(v([theirs, ourFirst, theirCounter, ourSecond]), cast("es", "s1"))).toBe(true);
    // not a counter: untouched
    expect(a.counterWarGated(v([theirs]), { type: "castSpell", objectId: "x", targets: [] })).toBe(false);
  });

  it("book of shame 98 (post-S54, Chris — a Reassembling Skeleton activated three times in one upkeep): a graveyard card's own return resolves once — while ours from that card is on the stack, a second activation is refused; another Skeleton's is not", () => {
    const a = agent();
    const lands = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, cardId: "swamp", controller: 0 as const }));
    const ret = (id: string) => ({ type: "activateAbility" as const, objectId: id, abilityIndex: 0, targets: [] });
    const board = (stack: { id: string; kind: string; cardId: string; controller: 0 | 1; sourceId?: string }[]): GameView => ({ ...mkView({ step: "UPKEEP", activePlayer: 1, battlefield: lands }), stack, graveyardObjects: [[{ objectId: "g1", cardId: "reassembling_skeleton" }, { objectId: "g2", cardId: "reassembling_skeleton" }], []], graveyards: [["reassembling_skeleton", "reassembling_skeleton"], []] });
    const pending = [{ id: "stk1", kind: "ability", cardId: "reassembling_skeleton", controller: 0 as const, sourceId: "g1" }];
    expect(a.scorePriorityAction(board([]), ret("g1"))).toBeGreaterThan(-Infinity); // the first is a fine buy on their turn
    expect(a.scorePriorityAction(board(pending), ret("g1"))).toBe(-Infinity); // the same card again: mana for nothing
    expect(a.scorePriorityAction(board(pending), ret("g2"))).toBeGreaterThan(-Infinity); // the other Skeleton is its own return
    expect(a.scorePriorityAction(board([{ ...pending[0]!, controller: 1 }]), ret("g1"))).toBeGreaterThan(-Infinity); // not ours on the stack
  });

  it("book of shame 99 (post-S54, Chris — the Usher mirror's loop, found by the field): a legendary reanimator that drains on a death loops with a second copy of itself, so its return takes the other Usher over any body, from either graveyard; a reanimation spell takes the Usher when one of ours stands; an opposing Usher only slows it (4 a pass against 2); not when the opponent's drain matches ours", async () => {
    const a = agent();
    const t = (id: string) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "object" as const, id }] });
    const usherEtb = pool.get("the_usher")!.abilities!.find((x) => x.kind === "triggered" && x.event === "ENTERS_BATTLEFIELD")!;
    const req = (ids: string[]) => ({ player: 0 as const, purpose: "chooseTarget" as const, actions: ids.map(t), source: { cardId: "the_usher", effects: (usherEtb as { effects: unknown[] }).effects } });
    const yards = (mine: string[], theirs: string[], bf: Obj[] = []): GameView => ({ ...mkView({ battlefield: [{ id: "u1", cardId: "the_usher", controller: 0 }, ...bf] }), graveyardObjects: [mine.map((c, i) => ({ objectId: `m${i}`, cardId: c })), theirs.map((c, i) => ({ objectId: `t${i}`, cardId: c }))], graveyards: [mine, theirs] });
    // without a second Usher the best body comes back (the Artisan); with one — ours or theirs — the Usher does
    for (let i = 0; i < 20; i++) {
      expect(await a.chooseAction(yards(["artisan_of_kozilek", "serra_angel"], []), req(["m0", "m1"]) as never)).toEqual(t("m0"));
      expect(await a.chooseAction(yards(["artisan_of_kozilek", "the_usher"], []), req(["m0", "m1"]) as never)).toEqual(t("m1"));
      expect(await a.chooseAction(yards(["artisan_of_kozilek"], ["the_usher"]), req(["m0", "t0"]) as never)).toEqual(t("t0"));
      expect(await a.chooseAction(yards(["artisan_of_kozilek", "the_usher"], [], [{ id: "x1", cardId: "the_usher", controller: 1 }]), req(["m0", "m1"]) as never)).toEqual(t("m1"));
      // the opponent's drains (an Usher and two Blood Artists: 4 a death) match ours: the loop gains nothing and never ends — the Artisan
      expect(await a.chooseAction(yards(["artisan_of_kozilek", "the_usher"], [], [{ id: "x1", cardId: "the_usher", controller: 1 }, { id: "x2", cardId: "blood_artist", controller: 1 }, { id: "x3", cardId: "blood_artist", controller: 1 }]), req(["m0", "m1"]) as never)).toEqual(t("m0"));
    }
    // Zombify with our Usher on the battlefield: the Usher in the graveyard before the Artisan
    const z: GameView = { ...yards(["artisan_of_kozilek", "the_usher"], [], Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, cardId: "swamp", controller: 0 as const }))), hand: [{ objectId: "h_z", cardId: "zombify" }] };
    const cast = (id: string) => ({ type: "castSpell" as const, objectId: "h_z", targets: [{ kind: "object" as const, id }] });
    expect(a.scorePriorityAction(z, cast("m1"))).toBeGreaterThan(a.scorePriorityAction(z, cast("m0")));
  });

  // ---------- S55 (ADR-161): the combo archetype — books 100–106 ----------
  // (the agents package does not import the sim: the Pall straight from the lists' data; plain sixties across)
  const PALL = (JSON.parse(readFileSync(join(CARDS_DIR, "../convocation/open-contributed.json"), "utf8")) as { lists: { key: string; decklist: { cardId: string; count: number }[] }[] }).lists.find((l) => l.key === "pall")!.decklist;
  const MUSTER = [{ cardId: "savannah_lions", count: 4 }, { cardId: "grizzly_bears", count: 32 }, { cardId: "plains", count: 24 }];
  const LOCKS = [{ cardId: "counterspell", count: 4 }, { cardId: "serra_angel", count: 32 }, { cardId: "island", count: 24 }];
  const combo = () => new HeuristicAgent(1, pool, difficultyProfile("master", "combo", MUSTER, PALL));
  const against = () => new HeuristicAgent(1, pool, difficultyProfile("master", "control", PALL, LOCKS));
  const L = (n: number, card = "badlands") => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, cardId: card, controller: 0 as const }));
  const withYards = (v: GameView, mine: string[], theirs: string[] = []): GameView => ({ ...v, graveyards: [mine, theirs], graveyardObjects: [mine.map((c, i) => ({ objectId: `m${i}`, cardId: c })), theirs.map((c, i) => ({ objectId: `t${i}`, cardId: c }))] });
  const castAt = (id: string, target?: string) => ({ type: "castSpell" as const, objectId: id, targets: target ? [{ kind: "object" as const, id: target }] : [] });

  it("the plan is the list's: a deck that holds the setup, a start and two of the piece has it — the Pall's own sixty, piloted as combo or not; the Muster has none; an opponent on the Pall is read as one", () => {
    expect(difficultyProfile("master", "combo", MUSTER, PALL).plan?.key).toBe("pall");
    expect(difficultyProfile("master", "combo", MUSTER, PALL).archetype).toBe("midrange"); // weighed as midrange, steered by the plan
    expect(difficultyProfile("master", "aggro", PALL, MUSTER).plan).toBeUndefined();
    expect(difficultyProfile("master", "aggro", PALL, MUSTER).opponentPlan?.key).toBe("pall");
    expect(difficultyProfile("master", "combo", MUSTER).plan).toBeUndefined(); // no list given: no plan (as before S55)
    expect(difficultyProfile("apprentice", "combo", MUSTER, PALL).plan).toBeUndefined(); // the apprentice does not read plans
  });

  it("book of shame 100 (S55 — Buried Alive sat in hand until turn six): a combo list casts its setup when a start is in hand, on the battlefield or within reach by the deck's count — without the plan the S30 gate holds; the setup buries three Ushers; a fourth setup is not cast into three", () => {
    const a = combo();
    const v = mkView({ hand: [{ objectId: "h_b", cardId: "buried_alive" }, { objectId: "h_n", cardId: "vampire_nighthawk" }], battlefield: L(3) });
    expect(a.buriedGated(v, castAt("h_b"))).toBe(false); // nine starts and five dig cards in fifty: within two draws
    expect(agent().buriedGated(v, castAt("h_b"))).toBe(true); // a deck with no plan: only with a reanimator in hand
    expect(a.scorePriorityAction(v, castAt("h_b"))).toBeGreaterThan(a.scorePriorityAction(v, castAt("h_n"))); // the setup before the fair body
    expect(a.scorePriorityAction(v, castAt("h_n"))).toBe(-Infinity); // book 102: a fair card waits while the setup is castable
    // what it buries: the Usher, three times, whatever else the library offers
    const pick = (id: string) => ({ type: "searchPick" as const, objectId: id });
    const req = { player: 0 as const, purpose: "searchLibrary" as const, actions: [{ type: "declineSearch" as const }, pick("x_a"), pick("x_u"), pick("x_n")], revealed: [{ objectId: "x_a", cardId: "blood_artist" }, { objectId: "x_u", cardId: "the_usher" }, { objectId: "x_n", cardId: "vampire_nighthawk" }], source: { cardId: "buried_alive", effects: pool.get("buried_alive")!.spellEffect! } };
    for (const yard of [[], ["the_usher"], ["the_usher", "the_usher"]]) expect(a.searchChoice(withYards(v, yard), req as never)).toEqual(pick("x_u"));
    expect(a.planGated(withYards(v, ["the_usher", "the_usher", "the_usher"]), castAt("h_b"))).toBe(true);
    // and the second Usher cast beside the first IS the loop — the S27 "never a second copy of a legend" rule steps aside
    const two = mkView({ hand: [{ objectId: "h_u", cardId: "the_usher" }], battlefield: [...L(6), { id: "u1", cardId: "the_usher", controller: 0 }] });
    expect(a.legendDuplicateGated(two, castAt("h_u"))).toBe(false);
    expect(a.loopCastBonus(two, castAt("h_u"))).toBeGreaterThan(40);
    const witch = mkView({ hand: [{ objectId: "h_w", cardId: "the_jet_witch" }], battlefield: [...L(6), { id: "w1", cardId: "the_jet_witch", controller: 0 }] });
    expect(a.legendDuplicateGated(witch, castAt("h_w"))).toBe(true); // a legend that does not loop is still never doubled
  });

  it("book of shame 101 (S55 — 220 of 338 Zombifies brought back a Nighthawk, the Rats, a Witch): the plan's start is aimed at the plan's piece; a fair return waits while the plan is live", () => {
    const a = combo();
    const board = (yard: string[], life: [number, number] = [20, 20], hand: { objectId: string; cardId: string }[] = []) => withYards(mkView({ hand: [{ objectId: "h_z", cardId: "zombify" }, ...hand], battlefield: L(4), life }), yard);
    const v = board(["vampire_nighthawk", "the_usher", "the_usher"]);
    expect(a.planGated(v, castAt("h_z", "m0"))).toBe(true);
    expect(a.planGated(v, castAt("h_z", "m1"))).toBe(false);
    expect(a.scorePriorityAction(v, castAt("h_z", "m1"))).toBeGreaterThan(a.scorePriorityAction(v, { type: "pass" }) + 20); // the loop
    expect(a.planGated(board(["vampire_nighthawk"], [20, 20], [{ objectId: "h_b", cardId: "buried_alive" }]), castAt("h_z", "m0"))).toBe(true); // the setup is in hand: wait
    expect(a.planGated(board(["vampire_nighthawk"], [20, 20]), castAt("h_z", "m0"))).toBe(true); // healthy, nothing buried: still held
    expect(a.planGated(board(["vampire_nighthawk"], [8, 20]), castAt("h_z", "m0"))).toBe(false); // at eight life with nothing set up: the body
  });

  it("book of shame 102 (S55 — no draw from the Jet Witch in 58% of games): a combo list digs while its plan is not assembled — the Witch's draw whatever the hand holds, to a floor over the opponent's power; it stops when the plan is assembled", () => {
    const a = combo();
    const draw = { type: "activateAbility" as const, objectId: "w", abilityIndex: 0, targets: [] };
    const board = (o: { life?: [number, number]; hand?: { objectId: string; cardId: string }[]; yard?: string[]; theirs?: Obj[] } = {}) => withYards(mkView({ step: "MAIN2", hand: o.hand ?? Array.from({ length: 5 }, (_, i) => ({ objectId: `h${i}`, cardId: "badlands" })), battlefield: [...L(3), { id: "w", cardId: "the_jet_witch", controller: 0 }, ...(o.theirs ?? [])], life: o.life ?? [20, 20] }), o.yard ?? []);
    expect(a.lifeForCardsGated(board(), draw)).toBe(false); // five cards in hand, nothing assembled: dig
    expect(agent().lifeForCardsGated(board(), draw)).toBe(true); // the S27 discipline, for a deck with no plan
    expect(a.lifeForCardsGated(board({ life: [6, 20] }), draw)).toBe(true); // never under five
    expect(a.lifeForCardsGated(board({ life: [12, 20], theirs: [{ id: "g1", cardId: "hill_giant", controller: 1 }, { id: "g2", cardId: "hill_giant", controller: 1 }, { id: "g3", cardId: "hill_giant", controller: 1 }] }), draw)).toBe(true); // nine power across: the floor is thirteen
    expect(a.lifeForCardsGated(board({ yard: ["the_usher", "the_usher"], hand: [{ objectId: "h_z", cardId: "zombify" }] }), draw)).toBe(true); // assembled: stop paying
    // the Tutor fetches the missing half
    const pick = (id: string) => ({ type: "searchPick" as const, objectId: id });
    const req = { player: 0 as const, purpose: "searchLibrary" as const, actions: [{ type: "declineSearch" as const }, pick("x_n"), pick("x_b"), pick("x_z")], revealed: [{ objectId: "x_n", cardId: "vampire_nighthawk" }, { objectId: "x_b", cardId: "buried_alive" }, { objectId: "x_z", cardId: "zombify" }], source: { cardId: "demonic_tutor", effects: pool.get("demonic_tutor")!.spellEffect! } };
    expect(a.searchChoice(board({ hand: [{ objectId: "h_z", cardId: "zombify" }] }), req as never)).toEqual(pick("x_b")); // a start in hand: the setup
    expect(a.searchChoice(board({ hand: [{ objectId: "h_b", cardId: "buried_alive" }] }), req as never)).toEqual(pick("x_z")); // the setup in hand: a start
  });

  it("book of shame 103 (S55 — Dark Ritual paid for a Nighthawk 81 times and for nothing 77): fuel is spent only to make a wanted plan card castable — by colour as well as count, and on our own main phase", () => {
    const a = combo();
    const ritual = castAt("h_r");
    const board = (o: { lands?: number; land?: string; hand: string[]; yard?: string[]; step?: string; activePlayer?: 0 | 1 }) => withYards(mkView({ step: o.step ?? "MAIN1", activePlayer: o.activePlayer ?? 0, hand: [{ objectId: "h_r", cardId: "dark_ritual" }, ...o.hand.map((c, i) => ({ objectId: `h${i}`, cardId: c }))], battlefield: L(o.lands ?? 1, o.land ?? "badlands") }), o.yard ?? []);
    expect(a.scorePriorityAction(board({ hand: ["buried_alive"] }), ritual)).toBeGreaterThan(-Infinity); // one land: the Ritual makes the setup
    expect(a.scorePriorityAction(board({ hand: ["vampire_nighthawk", "blood_artist"] }), ritual)).toBe(-Infinity); // only fair cards: it stays in hand
    expect(a.scorePriorityAction(board({ hand: ["buried_alive"], lands: 3 }), ritual)).toBe(-Infinity); // the setup is castable without it
    expect(a.scorePriorityAction(board({ hand: ["buried_alive"], activePlayer: 1, step: "END" }), ritual)).toBe(-Infinity); // not on their turn: the mana floats away
    // colour: the Usher wants white and red — two Barren Moors and a Ritual make five black mana, not an Usher
    expect(a.scorePriorityAction(board({ hand: ["the_usher"], yard: ["the_usher"], lands: 3, land: "barren_moor" }), ritual)).toBe(-Infinity);
    expect(a.scorePriorityAction(withYards(mkView({ hand: [{ objectId: "h_r", cardId: "dark_ritual" }, { objectId: "h0", cardId: "the_usher" }], battlefield: [{ id: "a", cardId: "scrubland", controller: 0 }, { id: "b", cardId: "badlands", controller: 0 }, { id: "c", cardId: "blood_crypt", controller: 0 }] }), ["the_usher"]), ritual)).toBeGreaterThan(-Infinity); // white from the Scrubland, red from the Badlands
  });

  it("book of shame 104 (S55 — playing against a plan): a counterspell is worth the game at the plan's setup or start and a little less than usual at anything else while the plan stands", () => {
    const a = against();
    const board = (cardId: string) => mkView({ activePlayer: 1, hand: [{ objectId: "h_c", cardId: "counterspell" }], battlefield: [{ id: "i1", cardId: "island", controller: 0 }, { id: "i2", cardId: "island", controller: 0 }], stack: [{ id: "s1", kind: "spell", cardId, controller: 1 }] });
    const counter = { type: "castSpell" as const, objectId: "h_c", targets: [{ kind: "stackItem" as const, id: "s1" }] };
    expect(a.againstPlanBonus(board("buried_alive"), counter)).toBeGreaterThan(20);
    expect(a.againstPlanBonus(board("zombify"), counter)).toBeGreaterThan(20);
    expect(a.againstPlanBonus(board("vampire_nighthawk"), counter)).toBeLessThan(0);
    expect(a.scorePriorityAction(board("buried_alive"), counter)).toBeGreaterThan(a.scorePriorityAction(board("vampire_nighthawk"), counter) + 20);
    expect(agent("control").againstPlanBonus(board("buried_alive"), counter)).toBe(0); // no plan across: nothing changes
  });

  it("book of shame 105 (S55 — graveyard exile is spent once): the Crypt waits for the opponent's graveyard to hold the plan's piece, or for something aimed at that graveyard; the Macabre is used only in response, on the card aimed at, with the next piece as its second; it is not cast as a 2/2 while the plan stands", () => {
    const a = against();
    const crypt = (player: 0 | 1) => ({ type: "activateAbility" as const, objectId: "tc", abilityIndex: 0, targets: [{ kind: "player" as const, player }] });
    const base = (theirs: string[], stack: { id: string; kind: string; cardId: string; controller: 0 | 1; targets?: { kind: "object"; id: string }[] }[] = [], hand: { objectId: string; cardId: string }[] = []) => withYards(mkView({ activePlayer: 1, hand, battlefield: [{ id: "tc", cardId: "tormods_crypt", controller: 0 }], stack }), ["grizzly_bears"], theirs);
    expect(a.scorePriorityAction(base(["vampire_nighthawk", "badlands"]), crypt(1))).toBe(-Infinity); // nothing there worth it yet
    expect(a.scorePriorityAction(base(["the_usher", "the_usher", "the_usher"]), crypt(1))).toBeGreaterThan(a.scorePriorityAction(base(["the_usher", "the_usher", "the_usher"]), { type: "pass" })); // the setup has resolved
    expect(a.scorePriorityAction(base(["the_usher", "the_usher", "the_usher"]), crypt(0))).toBe(-Infinity); // never our own
    const zomb = [{ id: "s1", kind: "spell", cardId: "zombify", controller: 1 as const, targets: [{ kind: "object" as const, id: "t0" }] }];
    expect(agent("control").scorePriorityAction(base(["serra_angel"], zomb), crypt(1))).toBeGreaterThan(-Infinity); // with no plan across: in response to the return
    expect(agent("control").scorePriorityAction(base(["serra_angel"]), crypt(1))).toBe(-Infinity);
    // the Macabre, from the hand
    const mac = (...ids: string[]) => ({ type: "activateAbility" as const, objectId: "h_m", abilityIndex: 0, targets: ids.map((id) => ({ kind: "object" as const, id })) });
    const hand = [{ objectId: "h_m", cardId: "faerie_macabre" }];
    const idle = base(["the_usher", "the_usher"], [], hand);
    expect(a.scorePriorityAction(idle, mac("t0", "t1"))).toBe(-Infinity); // nothing on the stack: held
    expect(a.scorePriorityAction(idle, mac())).toBe(-Infinity);
    expect(a.scorePriorityAction({ ...idle, activePlayer: 0, battlefield: [...idle.battlefield, ...mkView({ battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }, { id: "s3", cardId: "swamp", controller: 0 }] }).battlefield] }, castAt("h_m"))).toBe(-Infinity); // not a 2/2 flyer today
    const trig = [{ id: "s1", kind: "trigger", cardId: "the_usher", controller: 1 as const, targets: [{ kind: "object" as const, id: "t1" }] }];
    const live = base(["vampire_nighthawk", "the_usher", "the_usher"], trig, hand);
    expect(a.scorePriorityAction(live, mac("t1", "t2"))).toBeGreaterThan(a.scorePriorityAction(live, { type: "pass" }) + 20); // the trigger's target, and the next Usher
    expect(a.scorePriorityAction(live, mac("t1", "t0"))).toBe(-Infinity); // not the Nighthawk while an Usher remains
    expect(a.scorePriorityAction(live, mac("t0", "t2"))).toBe(-Infinity); // it must take the card aimed at
    expect(a.scorePriorityAction(live, mac("t1"))).toBe(-Infinity); // and not leave the second Usher behind
  });

  it("book of shame 106 (S55): against a plan, discard is worth most before the turn the plan names", () => {
    const a = against();
    const hymn = { type: "castSpell" as const, objectId: "h_h", targets: [{ kind: "player" as const, player: 1 }] };
    const v = (turn: number) => ({ ...mkView({ hand: [{ objectId: "h_h", cardId: "hymn_to_tourach" }], battlefield: [{ id: "s1", cardId: "swamp", controller: 0 }, { id: "s2", cardId: "swamp", controller: 0 }] }), turn });
    expect(a.againstPlanBonus(v(3), hymn)).toBeGreaterThan(0);
    expect(a.againstPlanBonus(v(9), hymn)).toBe(0);
    expect(agent().againstPlanBonus(v(3), hymn)).toBe(0);
  });

  it("book of shame 107 (post-S55, Chris's Coin study — 42 of the Coin's 48 loop wins began from the Pall's own graveyard): a plan's OPTION, `holdSetupAgainstPiece` — against a list that holds the piece too and has the mana for it, the setup is held until the start can follow the same turn; a Ritual that pays for both releases it; against any other list nothing changes. Measured and left off for the Pall (it lost the race for the first Usher): the Pall's own plan is never held", () => {
    const COIN = [{ cardId: "the_usher", count: 4 }, { cardId: "blood_artist", count: 32 }, { cardId: "swamp", count: 24 }];
    const withHold = (opp: typeof COIN) => { const p = difficultyProfile("master", "combo", opp, PALL); return new HeuristicAgent(1, pool, { ...p, plan: { ...p.plan!, holdSetupAgainstPiece: true } }); };
    const vsUsher = withHold(COIN), vsOther = withHold(MUSTER);
    // (the opponent stands on five lands: an Usher of theirs could come next turn)
    const board = (lands: number, hand: string[], theirLands = 5) => mkView({ hand: hand.map((c, i) => ({ objectId: `h${i}`, cardId: c })), battlefield: [...L(lands), ...Array.from({ length: theirLands }, (_, i) => ({ id: `o${i}`, cardId: "swamp", controller: 1 as const }))] });
    const ba = castAt("h0");
    // three lands, Buried Alive and Zombify in hand: against the Muster it is cast; against the Usher deck it waits
    expect(vsOther.buriedGated(board(3, ["buried_alive", "zombify"]), ba)).toBe(false);
    expect(vsUsher.buriedGated(board(3, ["buried_alive", "zombify"]), ba)).toBe(true);
    expect(vsUsher.setupHeld(board(3, ["buried_alive", "zombify"]))).toBe(true);
    expect(vsUsher.scorePriorityAction(board(3, ["buried_alive", "zombify"]), ba)).toBe(-Infinity);
    // seven lands: Buried Alive and then Zombify this turn — go
    expect(vsUsher.buriedGated(board(7, ["buried_alive", "zombify"]), ba)).toBe(false);
    expect(vsUsher.scorePriorityAction(board(7, ["buried_alive", "zombify"]), ba)).toBeGreaterThan(vsUsher.scorePriorityAction(board(7, ["buried_alive", "zombify"]), { type: "pass" }));
    // with no start in hand it waits however much mana there is (a setup with nothing to follow only arms them)
    expect(vsUsher.buriedGated(board(8, ["buried_alive", "vampire_nighthawk"]), ba)).toBe(true);
    // the Usher itself as the start needs eight, and its colours: eight Badlands make no white
    expect(vsUsher.buriedGated(board(8, ["buried_alive", "the_usher"]), ba)).toBe(true);
    const eight = board(6, ["buried_alive", "the_usher"]);
    expect(vsUsher.buriedGated({ ...eight, battlefield: [...eight.battlefield, ...mkView({ battlefield: [{ id: "w1", cardId: "scrubland", controller: 0 }, { id: "w2", cardId: "scrubland", controller: 0 }] }).battlefield] }, ba)).toBe(false);
    // while they are short of the mana for an Usher of their own, the race is on: set up
    expect(vsUsher.buriedGated(board(3, ["buried_alive", "zombify"], 2), ba)).toBe(false);
    // five lands and a Ritual: the Ritual makes seven — it is fuel for the setup AND the start, so it is cast, and then the setup is free
    const five = board(5, ["buried_alive", "zombify", "dark_ritual"]);
    expect(vsUsher.buriedGated(five, ba)).toBe(true);
    expect(vsUsher.scorePriorityAction(five, castAt("h2"))).toBeGreaterThan(-Infinity);
    expect(vsUsher.buriedGated({ ...five, hand: five.hand.filter((c) => c.cardId !== "dark_ritual"), manaPool: { ...five.manaPool, B: 3 }, battlefield: five.battlefield.map((o, i) => (i === 0 ? { ...o, tapped: true } : o)) }, ba)).toBe(false);
    // three lands and a Ritual make five: not enough for both — the Ritual stays in hand
    expect(vsUsher.scorePriorityAction(board(3, ["buried_alive", "zombify", "dark_ritual"]), castAt("h2"))).toBe(-Infinity);
    // the Pall's own plan does not carry the option (measured: it loses the race), so the Pall is never held
    const plain = new HeuristicAgent(1, pool, difficultyProfile("master", "combo", COIN, PALL));
    expect(plain.buriedGated(board(3, ["buried_alive", "zombify"]), ba)).toBe(false);
  });
});
