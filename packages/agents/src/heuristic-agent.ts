import { NullLog, SeededRng } from "@shandalar/core";
import { parseManaCost, manaValue, type CardDef } from "@shandalar/cards";
import type { Action, ActionRequest, Agent, GameView, PlayerId } from "@shandalar/engine";
import { preferSide, targetSide, classifyEffects } from "./effect-classification.js";
import { evaluate, objectValue, type AiProfile } from "./evaluator.js";
import { predictAction } from "./view-sim.js";
import { simulateCombat, viewCreatures, type SimObject } from "./combat-sim.js";

/**
 * HeuristicAgent v1 (S8 brief Parts 1–2; ADR-049..051): evaluator-scored
 * action policy with simulated combat and softmax selection (ADR-050).
 *
 * - Priority actions are scored by predicting the resulting view (view-sim)
 *   and evaluating it; consequences a view copy can't express contribute
 *   score adjustments instead. Pass holds counterspell mana when the known
 *   opponent list still threatens (ADR-051).
 * - Attacks are chosen by greedy set construction, each candidate set played
 *   out against the opponent's greedy best-response blocks using the
 *   engine's real assignment/dealing functions on a throwaway state
 *   (combat-sim — the one seam where the agent runs engine code forward).
 * - Blocks use the same greedy per-creature construction, plus chump blocks
 *   only under lethal threat.
 * - Selection is softmax over scores at the profile's temperature on the
 *   agent PRNG (ADR-015): near-ties are coin flips, clear gaps near-certain.
 *
 * Known-dumb moves are pinned by the book-of-shame suite (score-ordering
 * assertions, noise-immune per ADR-050).
 */
export class HeuristicAgent implements Agent {
  private readonly rng: SeededRng;
  /** Attack-set sim memo (S9 Part 0.2): successive declareAttacker requests in
   * one combat re-derive the same greedy plan, re-simulating identical sets.
   * The board is stable during declarations (taps land at commit), so keying
   * by turn + set + life is sound; cleared each new turn. */
  private simMemo = new Map<string, number>();
  private simMemoTurn = -1;

  constructor(
    seed: number,
    private readonly defs: Map<string, CardDef>,
    private readonly profile: AiProfile,
  ) {
    this.rng = new SeededRng(seed, new NullLog());
  }

  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    switch (request.purpose) {
      case "mulligan":
        return this.mulliganChoice(view, request);
      case "bottomCards":
        return this.lowestValueCard(view, request, "bottomCard");
      case "discard":
        return this.lowestValueCard(view, request, "discard");
      case "priority":
        return this.priorityChoice(view, request);
      case "declareAttacker":
        return await this.attackChoice(view, request);
      case "declareBlocker":
        return this.blockChoice(view, request);
      case "chooseSacrifice":
        return this.sacrificeChoice(view, request);
      case "chooseTarget":
        return this.targetChoice(view, request);
      case "optionalTrigger":
        return request.actions.find((a) => a.type === "acceptOptional") ?? request.actions[0]!;
      default:
        return request.actions[0]!;
    }
  }

  private def(cardId: string): CardDef | undefined {
    return this.defs.get(cardId);
  }

  private mv(cardId: string): number {
    const d = this.def(cardId);
    return d ? manaValue(parseManaCost(d.manaCost)) : 0;
  }

  // ---------- Openers (the sane floor's rules — no evaluation needed here) ----------

  private mulliganChoice(view: GameView, request: ActionRequest): Action {
    const keep = request.actions.find((a) => a.type === "keepHand");
    const mull = request.actions.find((a) => a.type === "mulligan");
    if (!keep || !mull) return request.actions[0]!;
    const effective = 7 - view.mulliganCount;
    const lands = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    const keepIt = effective <= 5 ? true : effective === 7 ? lands >= 2 && lands <= 5 : lands >= 2;
    return keepIt ? keep : mull;
  }

  private lowestValueCard(view: GameView, request: ActionRequest, type: "bottomCard" | "discard"): Action {
    const cardOf = new Map(view.hand.map((c) => [c.objectId, c.cardId]));
    const candidates = request.actions.filter((a) => a.type === type) as { type: string; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    const lands = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    const ranked = [...candidates].sort((a, b) => {
      const ca = cardOf.get(a.objectId) ?? "";
      const cb = cardOf.get(b.objectId) ?? "";
      const landA = this.def(ca)?.types.includes("Land") ? 1 : 0;
      const landB = this.def(cb)?.types.includes("Land") ? 1 : 0;
      // Bottoming (sane's rule): ditch expensive spells first, keep lands —
      // unless we're flooding (5+ lands), then lands go first.
      const landFirst = type === "discard" && lands >= 4 ? -1 : 1;
      if (landA !== landB) return (landA - landB) * landFirst;
      const mvDiff = this.mv(cb) - this.mv(ca);
      if (mvDiff !== 0) return mvDiff;
      return ca.localeCompare(cb);
    });
    return ranked[0]! as Action;
  }

  // ---------- Priority: score → softmax ----------

  /** Exposed for the book-of-shame suite: the score one action would get. */
  scorePriorityAction(view: GameView, action: Action): number {
    if (action.type === "pass") {
      return evaluate(view, this.profile, this.defs) + this.counterHoldBonus(view);
    }
    if (action.type === "tapForMana") return -Infinity; // never standalone
    const pred = predictAction(view, action, this.defs);
    if (pred.unchanged) {
      // Friction: an action that visibly does nothing scores strictly below
      // passing (kills same-host re-equip churn and no-benefit activations).
      return evaluate(view, this.profile, this.defs) - 0.25;
    }
    return evaluate(pred.view, this.profile, this.defs) + pred.adjustment;
  }

  private priorityChoice(view: GameView, request: ActionRequest): Action {
    const candidates = request.actions.filter((a) => a.type !== "tapForMana");
    if (candidates.length === 1) return candidates[0]!;
    const scores = candidates.map((a) => this.scorePriorityAction(view, a));
    return candidates[this.softmaxPick(scores)]!;
  }

  /** ADR-051: passing with counter mana up is worth something while the known list still threatens. */
  private counterHoldBonus(view: GameView): number {
    const counterCard = view.hand.find((c) =>
      this.def(c.cardId)?.spellEffect?.some((e) => e.type === "counter"),
    );
    if (!counterCard) return 0;
    const cost = this.mv(counterCard.cardId);
    const untappedLands = view.battlefield.filter(
      (o) => o.controller === view.you && !o.tapped && this.def(o.cardId)?.types.includes("Land"),
    ).length;
    if (untappedLands < cost) return 0;
    const threatens = this.profile.opponentDecklist.some(({ cardId }) => this.mv(cardId) >= 4);
    return threatens ? 0.6 : 0.2;
  }

  private softmaxPick(scores: number[]): number {
    const t = Math.max(0.05, this.profile.temperature);
    const max = Math.max(...scores.filter((s) => Number.isFinite(s)));
    const weights = scores.map((s) => (Number.isFinite(s) ? Math.exp((s - max) / t) : 0));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = (this.rng.int(1_000_000, "pick") / 1_000_000) * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  // ---------- Combat: simulated attacks, greedy blocks ----------

  private async attackChoice(view: GameView, request: ActionRequest): Promise<Action> {
    const done = request.actions.find((a) => a.type === "doneDeclaringAttackers");
    const offered = request.actions.filter((a) => a.type === "declareAttacker") as { type: string; objectId: string }[];
    if (offered.length === 0) return done ?? request.actions[0]!;

    const staged = new Set(view.combat.attackers);
    const creatures = viewCreatures(view);
    const me = view.you as PlayerId;

    let bestSet = [...staged];
    let bestScore = await this.scoreAttackSet(view, creatures, me, bestSet);
    let improved = true;
    while (improved) {
      improved = false;
      for (const cand of offered) {
        if (bestSet.includes(cand.objectId)) continue;
        const trial = [...bestSet, cand.objectId];
        const s = await this.scoreAttackSet(view, creatures, me, trial);
        if (s > bestScore + 0.01) {
          bestScore = s;
          bestSet = trial;
          improved = true;
        }
      }
    }
    const next = offered.find((a) => bestSet.includes(a.objectId) && !staged.has(a.objectId));
    return (next as Action | undefined) ?? done ?? request.actions[0]!;
  }

  private async scoreAttackSet(
    view: GameView,
    creatures: SimObject[],
    me: PlayerId,
    attackers: string[],
  ): Promise<number> {
    if (attackers.length === 0) return 0;
    if (this.simMemoTurn !== view.turn) {
      this.simMemo.clear();
      this.simMemoTurn = view.turn;
    }
    const memoKey = `${[...attackers].sort().join(",")}|${view.life[0]},${view.life[1]}`;
    const hit = this.simMemo.get(memoKey);
    if (hit !== undefined) return hit;
    const opp = (me === 0 ? 1 : 0) as PlayerId;
    const blocks = this.greedyBlocks(view, creatures, attackers, opp, /*lethalChumps*/ false);
    const outcome = await simulateCombat(creatures, me, attackers, blocks, [view.life[0], view.life[1]]);
    const valueOf = (id: string) => {
      const o = view.battlefield.find((b) => b.id === id);
      return o ? objectValue(this.defs, o) : 1;
    };
    // Exchange rates: aggro creatures exist to die profitably, and face
    // damage compounds (it never heals back in this pool); both are priced
    // per archetype, with damage worth half again more once the opponent is
    // within burn/alpha range.
    const ownLossWeight = { aggro: 0.6, midrange: 0.85, control: 1.0 }[this.profile.archetype];
    let dmgWeight = { aggro: 0.9, midrange: 0.55, control: 0.4 }[this.profile.archetype];
    if (view.life[opp] <= 10) dmgWeight *= 1.5;
    let score = 0;
    for (const id of outcome.dead) {
      const c = creatures.find((s) => s.id === id);
      if (!c) continue;
      score += c.controller === me ? -ownLossWeight * valueOf(id) : valueOf(id);
    }
    score += outcome.playerDamage[opp] * dmgWeight;
    // S9 Part 1.1: our lifelink attackers' gains show up as negative own
    // damage in the sim — credit them. (Opponent lifelink blockers already
    // debit through negative playerDamage[opp].)
    score += Math.max(0, -outcome.playerDamage[me]) * 0.2;
    if (view.life[opp] - outcome.playerDamage[opp] <= 0) score += 1000;
    this.simMemo.set(memoKey, score);
    return score;
  }

  /** Exposed for the book-of-shame suite: gain of one block, in mana units. */
  blockGain(view: GameView, blocker: SimObject, attacker: SimObject): number {
    const valueOf = (id: string) => {
      const o = view.battlefield.find((b) => b.id === id);
      return o ? objectValue(this.defs, o) : 1;
    };
    const aFirst = attacker.keywords.includes("first strike") || attacker.keywords.includes("double strike");
    const bFirst = blocker.keywords.includes("first strike") || blocker.keywords.includes("double strike");
    const aDeathtouch = attacker.keywords.includes("deathtouch");
    const bDeathtouch = blocker.keywords.includes("deathtouch");
    let kills = blocker.power >= attacker.toughness - attacker.damage || bDeathtouch;
    let dies = attacker.power >= blocker.toughness || aDeathtouch;
    if (aFirst && !bFirst && dies) kills = false; // struck down before dealing
    if (bFirst && !aFirst && kills) dies = false;
    const trampleThrough = attacker.keywords.includes("trample")
      ? Math.max(0, attacker.power - blocker.toughness)
      : 0;
    const prevented = attacker.power - trampleThrough;
    const w = this.profile.archetype === "control" ? 0.3 : 0.2;
    // S9 Part 1.1: blocking a lifelinker also denies its controller the
    // lifegain — prevented damage counts again at the lifegain rate.
    const lifelinkDenied = attacker.keywords.includes("lifelink") ? prevented * 0.25 : 0;
    return (kills ? valueOf(attacker.id) : 0) - (dies ? valueOf(blocker.id) : 0) + prevented * w + lifelinkDenied;
  }

  /** Gain of double-blocking a menace attacker: kills if combined power is
   * lethal; the attacker's damage fells blockers lethal-in-order (worst case
   * for us: it takes the cheaper toughness first, maximizing kills). */
  private pairBlockGain(view: GameView, b1: SimObject, b2: SimObject, attacker: SimObject): number {
    const valueOf = (id: string) => {
      const o = view.battlefield.find((x) => x.id === id);
      return o ? objectValue(this.defs, o) : 1;
    };
    const aDeathtouch = attacker.keywords.includes("deathtouch");
    const kills = b1.power + b2.power >= attacker.toughness - attacker.damage || b1.keywords.includes("deathtouch") || b2.keywords.includes("deathtouch");
    let remaining = attacker.power;
    let deadValue = 0;
    for (const b of [b1, b2].sort((x, y) => x.toughness - y.toughness)) {
      if (aDeathtouch ? remaining >= 1 : remaining >= b.toughness) {
        deadValue += valueOf(b.id);
        remaining -= aDeathtouch ? 1 : b.toughness;
      }
    }
    const prevented = attacker.keywords.includes("trample")
      ? Math.min(attacker.power, b1.toughness + b2.toughness)
      : attacker.power;
    const w = this.profile.archetype === "control" ? 0.3 : 0.2;
    const lifelinkDenied = attacker.keywords.includes("lifelink") ? prevented * 0.25 : 0;
    return (kills ? valueOf(attacker.id) : 0) - deadValue + prevented * w + lifelinkDenied;
  }

  private greedyBlocks(
    view: GameView,
    creatures: SimObject[],
    attackers: string[],
    blockingPlayer: PlayerId,
    lethalChumps: boolean,
  ): { blocker: string; attacker: string }[] {
    const available = creatures.filter(
      (c) => c.controller === blockingPlayer && !c.tapped && !attackers.includes(c.id),
    );
    const attackerObjs = attackers
      .map((id) => creatures.find((c) => c.id === id))
      .filter((c): c is SimObject => !!c);
    const blocks: { blocker: string; attacker: string }[] = [];
    const blocked = new Set<string>();

    const canBlock = (b: SimObject, a: SimObject) =>
      !(a.keywords.includes("flying") && !b.keywords.includes("flying") && !b.keywords.includes("reach"));

    for (const b of available) {
      let best: { attacker: string; gain: number } | null = null;
      for (const a of attackerObjs) {
        if (blocked.has(a.id)) continue;
        if (a.keywords.includes("menace")) continue; // pairs handled below (S9 Part 1.2)
        if (!canBlock(b, a)) continue;
        const gain = this.blockGain(view, b, a);
        if (best === null || gain > best.gain) best = { attacker: a.id, gain };
      }
      if (best && best.gain > 0) {
        blocks.push({ blocker: b.id, attacker: best.attacker });
        blocked.add(best.attacker);
      }
    }

    // S9 Part 1.2: menace pair-planning — commit two blockers to a menace
    // attacker when the pair exchange evaluates positive. Used by own blocks
    // AND by the opponent model inside the attack sim, so menace attacks are
    // no longer priced against a blocker model that can never answer them.
    const free = () => available.filter((c) => !blocks.some((x) => x.blocker === c.id));
    for (const a of attackerObjs) {
      if (blocked.has(a.id) || !a.keywords.includes("menace")) continue;
      const candidates = free().filter((b) => canBlock(b, a));
      let best: { pair: [SimObject, SimObject]; gain: number } | null = null;
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const gain = this.pairBlockGain(view, candidates[i]!, candidates[j]!, a);
          if (best === null || gain > best.gain) best = { pair: [candidates[i]!, candidates[j]!], gain };
        }
      }
      if (best && best.gain > 0) {
        blocks.push({ blocker: best.pair[0].id, attacker: a.id });
        blocks.push({ blocker: best.pair[1].id, attacker: a.id });
        blocked.add(a.id);
      }
    }

    if (lethalChumps) {
      const unblockedDamage = attackerObjs
        .filter((a) => !blocked.has(a.id))
        .reduce((n, a) => n + a.power, 0);
      if (unblockedDamage >= view.life[blockingPlayer]) {
        for (const b of available.filter((c) => !blocks.some((x) => x.blocker === c.id))) {
          const target = attackerObjs
            .filter((a) => !blocked.has(a.id) && !a.keywords.includes("menace"))
            .filter((a) => !(a.keywords.includes("flying") && !b.keywords.includes("flying") && !b.keywords.includes("reach")))
            .sort((x, y) => y.power - x.power)[0];
          if (!target) break;
          blocks.push({ blocker: b.id, attacker: target.id });
          blocked.add(target.id);
        }
      }
    }
    return blocks;
  }

  private blockChoice(view: GameView, request: ActionRequest): Action {
    const done = request.actions.find((a) => a.type === "doneDeclaringBlockers");
    const offered = request.actions.filter((a) => a.type === "declareBlocker") as Extract<
      Action,
      { type: "declareBlocker" }
    >[];
    if (!done) return offered.length > 0 ? this.rngPick(offered) : request.actions[0]!; // forced menace pair
    const creatures = viewCreatures(view);
    const plan = this.greedyBlocks(view, creatures, view.combat.attackers, view.you as PlayerId, true);
    const stagedBlockers = new Set(view.combat.blocks.map((b) => b.blocker));
    const next = offered.find((a) =>
      plan.some((p) => p.blocker === a.blocker && p.attacker === a.attacker && !stagedBlockers.has(p.blocker)),
    );
    return next ?? done;
  }

  // ---------- Choices ----------

  private sacrificeChoice(view: GameView, request: ActionRequest): Action {
    const candidates = request.actions.filter((a) => a.type === "sacrifice") as { type: string; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    const ranked = [...candidates].sort((a, b) => {
      const va = this.boardValue(view, a.objectId);
      const vb = this.boardValue(view, b.objectId);
      if (va !== vb) return va - vb;
      return a.objectId.localeCompare(b.objectId);
    });
    return ranked[0]! as Action;
  }

  private boardValue(view: GameView, objectId: string): number {
    const o = view.battlefield.find((b) => b.id === objectId);
    return o ? objectValue(this.defs, o) : 0;
  }

  private targetChoice(view: GameView, request: ActionRequest): Action {
    const variants = request.source
      ? preferSide(view, request.actions, request.source.effects)
      : request.actions;
    if (variants.length === 1) return variants[0]!;
    // Within the preferred side: harmful → hit their most valuable; helpful →
    // help our most valuable. Neutral → uniform.
    const cls = request.source ? classifyEffects(request.source.effects) : "neutral";
    if (cls === "neutral") return this.rngPick(variants);
    const score = (a: Action): number => {
      const ts = (a as { targets?: { kind: string; id?: string }[] }).targets ?? [];
      let s = 0;
      for (const t of ts) {
        if (t.kind === "object" && t.id) s += this.boardValue(view, t.id);
        if (t.kind === "player") s += 2; // face is worth a couple of mana units
        const side = targetSide(view, t as never);
        if (side === null) continue;
      }
      return s;
    };
    return [...variants].sort((a, b) => score(b) - score(a))[0]!;
  }

  private rngPick<T>(items: readonly T[]): T {
    return items[this.rng.int(items.length, "pick")]!;
  }
}
