import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { GameView } from "@shandalar/engine";
import { HeuristicAgent } from "./heuristic-agent.js";
import type { SimObject } from "./combat-sim.js";

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
