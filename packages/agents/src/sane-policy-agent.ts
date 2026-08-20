import { NullLog, SeededRng } from "@shandalar/core";
import { parseManaCost, manaValue, type CardDef } from "@shandalar/cards";
import type { Action, ActionRequest, Agent, GameView } from "@shandalar/engine";

/**
 * SanePolicyAgent (ADR-045, S7 brief Part 1): random choice within a
 * policy-filtered action set. Every filter is a pure function over
 * (view, request) plus two pieces of per-instance memory that the view
 * doesn't carry (mulligans taken; attackers already blocked this combat).
 * This is a fuzzing/sparring floor, deliberately legible, NOT the AI —
 * no evaluation, no search (that's M4).
 *
 * The seven rules, exactly as ratified:
 *  1. Mulligan: keep an effective-7 hand with 2–5 lands; effective 6, keep
 *     at 2+ lands; never mull below effective 5. Bottoming: highest-mana-
 *     value nonland first, ties by cardId (deterministic; lands last).
 *  2. Land: if a play-land action is legal, take one (random among them).
 *  3. Mana discipline: never tapForMana standalone — auto-pay taps when a
 *     chosen cast/activation resolves its cost.
 *  4. Casting: when at least one cast/activation is enumerated (the
 *     enumerator guarantees affordability), pass with 20% probability,
 *     otherwise cast: uniform over castable objects, then uniform over
 *     that object's enumerated target/X variants.
 *  5. Combat, simplest ratified version —
 *     attacks: every non-defender creature with base power ≥ 1;
 *     blocks (greedy, one blocker per attacker): block where the blocker
 *     kills the attacker (blocker power ≥ attacker toughness; trades OK),
 *     or where it safely absorbs ≥ 2 (attacker power ≥ 2 and the blocker
 *     survives). Base P/T from card defs — pump/auras/counters are
 *     invisible to this policy (documented simplification). Menace
 *     attackers are never *chosen* as block targets (pair-planning is M4
 *     territory), but a forced second block (enumerator withholds "done"
 *     while a menace attacker has exactly one staged blocker) picks a
 *     random legal block.
 *  6. Choices: trigger order / damage order / sacrifice / legend keep take
 *     the first option (deterministic); optional triggers accept.
 *  7. Everything else: uniform random over the request's actions.
 *
 * PRNG conventions match RandomAgent (ADR-015): a private seeded PRNG,
 * never the game's logged RNG service.
 */
export class SanePolicyAgent implements Agent {
  private readonly rng: SeededRng;
  private mulligansTaken = 0;
  /** Attackers already assigned a blocker this combat, keyed by turn: the
   * view carries no combat state, and single-option requests are auto-taken
   * (ADR-014) so a purpose-based reset could silently span turns. */
  private blockedAttackers = new Set<string>();
  private blocksTurn = -1;

  constructor(seed: number, private readonly defs: Map<string, CardDef>) {
    this.rng = new SeededRng(seed, new NullLog());
  }

  chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    return Promise.resolve(this.choose(view, request));
  }

  private def(cardId: string): CardDef {
    const d = this.defs.get(cardId);
    if (!d) throw new Error(`SanePolicyAgent: unknown cardId ${cardId}`);
    return d;
  }

  private isLand(cardId: string): boolean {
    return this.def(cardId).types.includes("Land");
  }

  private mv(cardId: string): number {
    return manaValue(parseManaCost(this.def(cardId).manaCost));
  }

  private choose(view: GameView, request: ActionRequest): Action {
    switch (request.purpose) {
      case "mulligan":
        return this.mulliganChoice(view, request);
      case "bottomCards":
        return this.bottomChoice(view, request);
      case "priority":
        return this.priorityChoice(request);
      case "declareAttacker":
        return this.attackChoice(view, request);
      case "declareBlocker":
        return this.blockChoice(view, request);
      case "orderTriggers":
      case "orderBlockerDamage":
      case "chooseSacrifice":
      case "legendRule":
        return request.actions[0]!; // rule 6: first option, deterministic
      case "optionalTrigger":
        return request.actions.find((a) => a.type === "acceptOptional") ?? request.actions[0]!;
      default:
        return this.rng.pick(request.actions, "pick"); // rule 7
    }
  }

  /** Rule 1. London mulligan: the hand shown is always 7; effective kept size is 7 - mulligans. */
  private mulliganChoice(view: GameView, request: ActionRequest): Action {
    const keep = request.actions.find((a) => a.type === "keepHand");
    const mull = request.actions.find((a) => a.type === "mulligan");
    if (!keep || !mull) return request.actions[0]!;

    const effective = 7 - this.mulligansTaken;
    const lands = view.hand.filter((c) => this.isLand(c.cardId)).length;
    const keepIt =
      effective <= 5 ? true : effective === 7 ? lands >= 2 && lands <= 5 : lands >= 2;
    if (keepIt) return keep;
    this.mulligansTaken += 1;
    return mull;
  }

  /** Rule 1 bottoming: highest-mana-value nonland first, ties by cardId; lands only when no nonland remains. */
  private bottomChoice(view: GameView, request: ActionRequest): Action {
    const cardOf = new Map(view.hand.map((c) => [c.objectId, c.cardId]));
    const candidates = request.actions.filter((a) => a.type === "bottomCard");
    if (candidates.length === 0) return request.actions[0]!;
    const ranked = [...candidates].sort((a, b) => {
      const ca = cardOf.get((a as { objectId: string }).objectId) ?? "";
      const cb = cardOf.get((b as { objectId: string }).objectId) ?? "";
      const landA = this.isLand(ca) ? 1 : 0;
      const landB = this.isLand(cb) ? 1 : 0;
      if (landA !== landB) return landA - landB; // nonlands first
      const mvDiff = this.mv(cb) - this.mv(ca); // highest cost first
      if (mvDiff !== 0) return mvDiff;
      return ca.localeCompare(cb); // ties by cardId
    });
    return ranked[0]!;
  }

  /** Rules 2, 3, 4. */
  private priorityChoice(request: ActionRequest): Action {
    const lands = request.actions.filter((a) => a.type === "playLand");
    if (lands.length > 0) return this.rng.pick(lands, "pick"); // rule 2

    const casts = request.actions.filter(
      (a) => a.type === "castSpell" || a.type === "activateAbility",
    );
    const pass = request.actions.find((a) => a.type === "pass");
    if (casts.length === 0 || !pass) {
      // Rule 3: tapForMana is never taken standalone.
      return pass ?? this.rng.pick(request.actions, "pick");
    }
    if (this.rng.int(5, "pick") === 0) return pass; // rule 4: pass 20%

    // Uniform over castable objects, then uniform over that object's variants.
    const byObject = new Map<string, Action[]>();
    for (const a of casts) {
      const key =
        a.type === "castSpell"
          ? `c:${a.objectId}`
          : `a:${a.objectId}:${a.abilityIndex}`;
      byObject.set(key, [...(byObject.get(key) ?? []), a]);
    }
    const group = this.rng.pick([...byObject.keys()].sort(), "pick");
    return this.rng.pick(byObject.get(group)!, "pick");
  }

  /** Rule 5 attacks: every non-defender creature with base power ≥ 1, in enumeration order. */
  private attackChoice(view: GameView, request: ActionRequest): Action {
    const done = request.actions.find((a) => a.type === "doneDeclaringAttackers");
    const objById = new Map(view.battlefield.map((o) => [o.id, o.cardId]));
    for (const a of request.actions) {
      if (a.type !== "declareAttacker") continue;
      const def = this.def(objById.get(a.objectId) ?? "");
      if ((def.power ?? 0) >= 1 && !(def.keywords ?? []).includes("defender")) return a;
    }
    return done ?? request.actions[0]!;
  }

  /** Rule 5 blocks: greedy, one blocker per attacker, biggest attacker first. */
  private blockChoice(view: GameView, request: ActionRequest): Action {
    if (view.turn !== this.blocksTurn) {
      this.blockedAttackers.clear();
      this.blocksTurn = view.turn;
    }
    const done = request.actions.find((a) => a.type === "doneDeclaringBlockers");
    const blocks = request.actions.filter((a) => a.type === "declareBlocker") as Extract<
      Action,
      { type: "declareBlocker" }
    >[];
    // Enumerator withholds "done" while a menace attacker has exactly one
    // staged blocker: we owe a second blocker, any legal one.
    if (!done) return this.rng.pick(blocks, "pick");

    const objById = new Map(view.battlefield.map((o) => [o.id, o.cardId]));
    const d = (id: string) => this.def(objById.get(id) ?? "");
    const good = blocks.filter((b) => {
      if (this.blockedAttackers.has(b.attacker)) return false;
      const atk = d(b.attacker);
      const blk = d(b.blocker);
      if ((atk.keywords ?? []).includes("menace")) return false; // pair-planning is M4's job
      const kills = (blk.power ?? 0) >= (atk.toughness ?? 0);
      const safelySaves = (atk.power ?? 0) >= 2 && (blk.toughness ?? 0) > (atk.power ?? 0);
      return kills || safelySaves;
    });
    if (good.length === 0) return done;
    const ranked = [...good].sort((a, b) => {
      const pDiff = (d(b.attacker).power ?? 0) - (d(a.attacker).power ?? 0); // biggest threat first
      if (pDiff !== 0) return pDiff;
      const bDiff = (d(a.blocker).power ?? 0) - (d(b.blocker).power ?? 0); // cheapest sufficient blocker
      if (bDiff !== 0) return bDiff;
      return a.blocker.localeCompare(b.blocker);
    });
    const chosen = ranked[0]!;
    this.blockedAttackers.add(chosen.attacker);
    return chosen;
  }
}
