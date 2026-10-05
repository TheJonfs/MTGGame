import { NullLog, SeededRng } from "@shandalar/core";
import { parseManaCost, manaValue, type CardDef, type Effect, type ResolvedTarget } from "@shandalar/cards";
import type { Action, ActionRequest, Agent, GameView, PlayerId } from "@shandalar/engine";
import { preferSide, targetSide, classifyEffects, effectsForAction, ptSign } from "./effect-classification.js";
import { DEFAULT_CONSTANTS, deterrence, evaluate, legendLoopWorth, LOOP_WORTH, millPerDamage, millValue, objectValue, reanimationWorth, type AiProfile, type EvalConstants } from "./evaluator.js";
import { predictAction } from "./view-sim.js";
import { viewAbilityAt } from "./granted-view.js";
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
  /** S22 (A10 word 4, the pin-17 family): picks already made in the CURRENT any-number cast loop.
   * Reset by any non-loop request (the SanePolicy per-instance-memory precedent). */
  private variablePicks = 0;

  constructor(
    seed: number,
    private readonly defs: Map<string, CardDef>,
    private readonly profile: AiProfile,
  ) {
    this.rng = new SeededRng(seed, new NullLog());
  }

  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    if (request.purpose !== "chooseVariableTarget") this.variablePicks = 0; // the loop ended (or never started)
    switch (request.purpose) {
      case "mulligan":
        return this.mulliganChoice(view, request);
      case "bottomCards":
        return this.lowestValueCard(view, request, "bottomCard");
      case "chooseName":
        return this.nameChoice(view, request);
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
        // S40 (the Bailiff, book 57): a "may" whose harm points only at OUR side is declined — the self-bounce
        // of an ETB creature is a line the evaluator cannot price, so it is never taken.
        if (this.optionalHarmsOnlyUs(view)) return request.actions.find((a) => a.type === "declineOptional") ?? request.actions[0]!;
        return request.actions.find((a) => a.type === "acceptOptional") ?? request.actions[0]!;
      case "searchLibrary":
        return this.searchChoice(view, request);
      case "chooseMode":
        return this.modeChoice(view, request);
      case "discardCost":
        return this.lowestValueCard(view, request, "discard");
      case "putOnTop":
        // S28 (Brainstorm): put back the two lowest-valued cards — lands first once the mana is
        // comfortable (≥ 4 lands between play and hand). Not Legacy-grade Brainstorm; that's fine.
        return this.putOnTopChoice(view, request);
      case "entersChoice":
        return this.entersChoice(view, request);
      // S46 (Ponder): the top three by the hand's needs, and the shuffle only when all three are poor.
      case "orderTop":
        return this.orderTopChoice(view, request);
      case "mayShuffle":
        return this.mayShuffleChoice(view, request);
      // S22 (A10) — the new cost/fork/loop requests:
      case "chooseBounceCost":
        return this.bounceCostChoice(view, request);
      case "chooseTapCost":
        return this.tapCostChoice(view, request);
      case "chooseVariableTarget":
        return this.variableTargetChoice(view, request);
      case "unlessPay":
        return this.unlessPayChoice(view, request);
      default:
        return request.actions[0]!;
    }
  }

  private def(cardId: string): CardDef | undefined {
    return this.defs.get(cardId);
  }

  private get C(): EvalConstants {
    return this.profile.constants ?? DEFAULT_CONSTANTS;
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

  private putOnTopChoice(view: GameView, request: ActionRequest): Action {
    const me = view.you;
    const landsInPlay = view.battlefield.filter((o) => o.controller === me && this.def(o.cardId)?.types.includes("Land")).length;
    const landsInHand = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    if (landsInPlay + landsInHand >= 4) {
      const land = request.actions.find((a) => a.type === "putOnTop" && this.def(view.hand.find((c) => c.objectId === a.objectId)?.cardId ?? "")?.types.includes("Land"));
      if (land) return land;
    }
    return this.lowestValueCard(view, request, "putOnTop");
  }

  private lowestValueCard(view: GameView, request: ActionRequest, type: "bottomCard" | "discard" | "putOnTop"): Action {
    const cardOf = new Map(view.hand.map((c) => [c.objectId, c.cardId]));
    // S19 round 2: a caster-chooses discard (Duress) picks from the OPPONENT's revealed hand — card
    // identity comes from the request payload, and the ranking flips: take their BEST, not our worst.
    for (const r of request.revealed ?? []) if (!cardOf.has(r.objectId)) cardOf.set(r.objectId, r.cardId);
    const candidates = request.actions.filter((a) => a.type === type) as { type: string; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    if (type === "discard" && candidates.some((c) => !view.hand.some((h) => h.objectId === c.objectId))) {
      const best = [...candidates].sort((a, b) => this.mv(cardOf.get(b.objectId) ?? "") - this.mv(cardOf.get(a.objectId) ?? "") || a.objectId.localeCompare(b.objectId));
      return best[0]! as Action;
    }
    const lands = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    const ranked = [...candidates].sort((a, b) => {
      const ca = cardOf.get(a.objectId) ?? "";
      const cb = cardOf.get(b.objectId) ?? "";
      const landA = this.def(ca)?.types.includes("Land") ? 1 : 0;
      const landB = this.def(cb)?.types.includes("Land") ? 1 : 0;
      // Bottoming (sane's rule): ditch expensive spells first, keep lands —
      // unless we're flooding (5+ lands), then lands go first.
      // S50 (book 91, Seasoned Pyromancer): our OWN discard gives up a land first once the mana is comfortable —
      // five or more lands between the battlefield and the hand (Brainstorm's line, S28).
      const boardLands = view.battlefield.filter((o) => o.controller === view.you && this.def(o.cardId)?.types.includes("Land")).length;
      const landFirst = type === "discard" && (lands >= 4 || lands + boardLands >= 5) ? -1 : 1;
      if (landA !== landB) return (landA - landB) * landFirst;
      const mvDiff = this.mv(cb) - this.mv(ca);
      if (mvDiff !== 0) return mvDiff;
      return ca.localeCompare(cb);
    });
    return ranked[0]! as Action;
  }

  // ---------- Priority: score → softmax ----------

  /** S45 follow-up (Chris: the AI could not see summoning sickness): can OUR permanent act this turn — attack or pay a
   * {T} cost? Untapped and not summoning-sick (the view's flag is the engine's rule: entered this turn, no haste). Used
   * for our own attack and tap READINESS only — a sick creature still blocks, and the opponent's sick creatures still
   * threaten their next turn, so the blocker and threat readers keep "untapped". */
  private canActNow(o: GameView["battlefield"][number]): boolean {
    return !o.tapped && !o.summoningSick;
  }

  /** Exposed for the book-of-shame suite: the score one action would get. */
  scorePriorityAction(view: GameView, action: Action): number {
    if (action.type === "pass") {
      return evaluate(view, this.profile, this.defs) + this.counterHoldBonus(view) + this.flashHoldBonus(view);
    }
    if (action.type === "tapForMana") return -Infinity; // never standalone
    // S13 (Chris's playtest: apprentice cast Blaze for X=0 on turn one): an
    // X-cost spell or ability at X=0 spends the card/mana for nothing in this
    // pool — never a play, at any temperature (softmax noise had been
    // coin-flipping a 0.25-point gap at apprentice's 1.2).
    if ((action as { x?: number }).x === 0 && this.hasXCost(view, action)) return -Infinity;
    // S15 v1: a choice-bearing mana ability (Lotus) is never activated
    // proactively — the view-sim can't price floating mana, and popping the
    // Lotus for nothing is the classic blunder. (Lotus is prize-only; a human
    // holds it, the AI essentially never will.)
    // S26 (the Mirror's honesty — mirror-sim showed the reflection WEAKER with the Lotus than
    // without: a dead card in 41): a choice-bearing mana ability is a BURST like Dark Ritual —
    // popped only when its three mana of the chosen colour enable a cast this step that we
    // couldn't otherwise pay, and only in the colour that cast wants. Every other colour, and
    // every idle window, stays at -Infinity (the S15 blunder guard holds).
    const burst = this.manaBurst(view, action);
    // S55 (book 103): a combo list's fuel answers to its plan first — a Ritual that would enable only a fair card stays in hand
    if (burst !== null && this.profile.plan && this.planGated(view, action)) return -Infinity;
    if (burst !== null) return burst.enables ? evaluate(view, this.profile, this.defs) + 0.6 : -Infinity;
    if (action.type === "activateAbility" && action.color !== undefined) return -Infinity;
    // S17 (book of shame 13): cycling a spell is a cantrip of last resort — only when the card has
    // no legal use on this board (Airship Crash with nothing to crash); never while it could be cast.
    // S22: the Stoker's GRANTED cycling rides this unchanged (viewAbilityAt resolves it), and lands
    // join cardIsDead's vocabulary (flooded draws are fuel — the blessed wrinkle).
    if (this.isCycling(view, action)) return this.cardIsDead(view, action) ? evaluate(view, this.profile, this.defs) + 0.3 : -Infinity;
    // S22 (A10 word 2 — the Unwinder's activation-discipline pin, per the boss doc's sketch):
    // a bounce-cost activation only with a land in hand to replay, or with lands beyond next
    // turn's planned cast; never one that drops development below the curve.
    if (this.bounceCostBlocked(view, action)) return -Infinity;
    // S25 (the Mox court's floors — the pin-17 family): self-charging activation costs stop at
    // the cliff. The Witch never reads fortunes at life ≤ 2; the Tyrant never pulls a lethal
    // recoil (the Djinn's sibling); the Cleric never walks the library below her floor (DECKED).
    if (this.costFloorBlocked(view, action)) return -Infinity;
    // S22 playtest r3 (Chris's seed-42 run — the misplay cluster: Swords at its own creature,
    // Boomerang at its own Island, Mind Rot at its own head, Rancor on Chris's creature):
    // spending a card on provably nothing is never a play, at any temperature (the X=0 family).
    if (this.discardWasteGated(view, action)) return -Infinity; // Duress/Mind Rot into an empty hand
    if (this.emptyTargetsWasteGated(view, action)) return -Infinity; // post-S43: an "up to" spell cast at nothing (Graceful Restoration's second mode)
    if (this.pumpWasteGated(view, action)) return -Infinity; // Giant Growth outside combat, empty stack
    if (this.fleetingWasteGated(view, action)) return -Infinity; // S23: the Thundersnake outside its window
    if (this.threatenGated(view, action)) return -Infinity; // S26: Lumen's steal only where the swing cashes
    if (this.tapperGated(view, action)) return -Infinity; // S26 r3: hold the tapper for the opponent's turn
    if (this.legendDuplicateGated(view, action)) return -Infinity; // S27 r2: never cast a second copy of a legend we control
    if (this.cantripTimingGated(view, action)) return -Infinity; // S28: Brainstorm at the opponent's end step or in response
    if (this.flashTimingGated(view, action)) return -Infinity; // S32: the Escort at the opponent's end step, in response, or when the mana is idle
    if (this.selfCounterGated(view, action)) return -Infinity; // post-S43: Mystic Snake with only our own spell to hit
    if (this.spellPayoffHoldGated(view, action)) return -Infinity; // S45: hold the cheap spell for the Guttersnipe / Pyromancer in hand
    if (this.faceBurnHoldGated(view, action)) return -Infinity; // post-S49 (book 88): removal is not thrown at a healthy face
    if (this.counterWarGated(view, action)) return -Infinity; // post-S52 (book 94): one counter answers one spell
    if (this.entersHarmGated(view, action)) return -Infinity; // S50 (book 89): the Kavu is not cast into a board where its four can only hit us
    if (this.selfPumpGated(view, action)) return -Infinity; // S50 (book 90): the Whelp's pump is combat damage or a won fight, never idle
    if (this.graveyardTokensGated(view, action)) return -Infinity; // S50 (book 91): the Pyromancer's second life spends only idle mana
    if (this.idleSinkGated(view, action)) return -Infinity; // post-S43: the Cleric / Faerie Formation spend only mana that would idle
    if (this.glaciersDropGated(view, action)) return -Infinity; // S36 (book 52): the Glaciers as the land drop only for a reason; otherwise the real land
    if (this.glaciersActivationGated(view, action)) return -Infinity; // S36 (book 52): fetch at their end step, or on our turn for a colour we lack
    if (this.libraryDrawGated(view, action)) return -Infinity; // S36: the Library draws at the opponent's end step only
    if (this.collectorGated(view, action)) return -Infinity; // S36: the Collector at the opponent's end step (every turn at one card in hand)
    if (this.plainscyclingGated(view, action)) return -Infinity; // S36 (book 53): the Angel cycles for a reanimator in hand or a short land count
    if (this.edictWasteGated(view, action)) return -Infinity; // S32: never an Edict into no creatures, a token shield, or our own face
    if (this.altarGated(view, action)) return -Infinity; // S29: the Altar feeds a creature for lethal mill, or one already dying
    if (this.buriedGated(view, action)) return -Infinity; // S30: Buried Alive only with a reanimator in hand
    if (this.planGated(view, action)) return -Infinity; // S55 (books 100–103): the combo plan's discipline
    if (this.graveyardHateGated(view, action)) return -Infinity; // S55 (book 105): graveyard exile is held for the moment it answers
    if (this.skeletonGated(view, action)) return -Infinity; // S30: the Skeleton returns with mana to spare, or as a blocker when behind
    if (this.yardReturnPending(view, action)) return -Infinity; // book 98: its return is already on the stack
    if (this.lifeForCardsGated(view, action)) return -Infinity; // S27 r2: the Witch's discipline
    if (this.accumulatorSpendGated(view, action)) return -Infinity; // S26: Clio holds the tax while the board threatens
    if (this.floodSinkGated(view, action)) return -Infinity; // S40 (books 58–63): the flood's repeatable sinks — timing, targets, spare lands
    // The misaim rule: a FINITE cliff (not -Infinity) so book-of-shame orderings among
    // bad aims survive — at any softmax temperature exp(-MISAIM/t) is 0, so a misaimed
    // variant is never picked while any legitimate action (pass included) exists.
    const misaim = this.misaimPenalty(view, action);
    const pred = predictAction(view, action, this.defs, this.C);
    if (pred.unchanged) {
      // Post-S52 (book 93; Chris: a Bonesplitter passed back and forth to use up the mana — again): an EQUIP the
      // predictor calls unchanged (the same host, or a move that puts nothing to work — book 86) is refused outright.
      // The friction below is only a lower SCORE: under the softmax an action a quarter-point under passing is still
      // picked about one window in ten, and an idle turn offers many windows — 58 of 154 moves in a 200-game probe
      // were between two ready creatures.
      if (action.type === "activateAbility") { const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex); if (ab && ab.kind === "activated" && ab.equip) return -Infinity; }
      // Friction: an action that visibly does nothing scores strictly below
      // passing (kills same-host re-equip churn and no-benefit activations).
      return evaluate(view, this.profile, this.defs) - 0.25 - misaim;
    }
    return evaluate(pred.view, this.profile, this.defs) + pred.adjustment - misaim + this.wheelSpendBonus(view, action) + this.lifegainPayoffBonus(view, action) + this.entersKillBonus(view, action) + this.planBonus(view, action) + this.againstPlanBonus(view, action) + this.loopCastBonus(view, action);
  }

  /** S46 (Vitalist — the brief's "a term, not a rule"): while we control a LIFE_GAINED payoff (the shape: a trigger on
   * our life gain), a play that gains life is worth more — the gain becomes counters. A spell/ability's own gainLife
   * (0.4 per life), a creature with lifelink or its own gainLife trigger (0.6). Exposed for the book. */
  lifegainPayoffBonus(view: GameView, action: Action): number {
    if (action.type !== "castSpell" && action.type !== "activateAbility") return 0;
    const payoff = view.battlefield.some((o) => o.controller === view.you && (this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "LIFE_GAINED"));
    if (!payoff) return 0;
    const effects = this.actionEffects(view, action) ?? [];
    let bonus = effects.reduce((n, e) => n + (e.type === "gainLife" && e.who === "you" && typeof e.amount === "number" ? 0.4 * e.amount : 0), 0);
    if (action.type === "castSpell") {
      const d = this.def(view.hand.find((c) => c.objectId === action.objectId)?.cardId ?? "");
      if (d?.types.includes("Creature") && ((d.keywords ?? []).includes("lifelink") || (d.abilities ?? []).some((a) => a.kind === "triggered" && a.effects.some((e) => e.type === "gainLife" && e.who === "you")))) bonus += 0.6;
    }
    return bonus;
  }

  /** S45 (the Dragon Mage — the planner's restated line: SPEND BEFORE THE WHEEL): in our first main phase, with a
   * creature of ours ready to attack whose combat-damage trigger discards our whole hand, an instant or sorcery in hand
   * is worth nothing held — the wheel discards what it does not refill in kind — so casting it is credited the card it
   * would otherwise lose. Keyed on the SHAPE (a DEALS_COMBAT_DAMAGE_TO_PLAYER trigger with `discard count: "all"` that
   * reaches us). Approximation: the view carries no summoning sickness, so a wheel cast this turn counts as ready. */
  wheelSpendBonus(view: GameView, action: Action): number {
    if (action.type !== "castSpell" || view.activePlayer !== view.you || view.step !== "MAIN1") return 0;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.types.includes("Instant") || d.types.includes("Sorcery"))) return 0;
    const wheels = (cd: CardDef | undefined) => !!cd && (cd.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "DEALS_COMBAT_DAMAGE_TO_PLAYER" && a.effects.some((e) => e.type === "discard" && e.count === "all" && (e.who === "eachPlayer" || e.who === "you")));
    const ready = view.battlefield.some((o) => o.controller === view.you && this.canActNow(o) && !o.cantAttack && o.power !== null && wheels(this.def(o.cardId))); // S45: a sick wheel does not swing this turn
    return ready ? 1.0 : 0;
  }

  /** S22 playtest r3: the effects an action's targets receive — mode-aware for A6 modal casts,
   * virtual-list-aware for activations (granted abilities resolve through viewAbilityAt). */
  private actionEffects(view: GameView, action: Action): Effect[] | null {
    if (action.type === "castSpell") {
      const card = view.hand.find((c) => c.objectId === action.objectId);
      const d = card ? this.def(card.cardId) : undefined;
      if (!d) return null;
      if (d.modes && action.mode !== undefined) return d.modes[action.mode]?.effects ?? [];
      return effectsForAction(d, action);
    }
    if (action.type === "activateAbility") {
      const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
      if (ab && ab.kind === "activated" && ab.effects.length > 0) return ab.effects;
      const o = view.battlefield.find((b) => b.id === action.objectId);
      const d = o ? this.def(o.cardId) : undefined;
      return d ? effectsForAction(d, action) : null; // equip: the equipment's statics
    }
    return null;
  }

  /** S22 playtest r3 — the misaim rule (rule 8 hardened from preference to cliff): harmful
   * effects never point at our own side, helpful effects never at the opponent's. Exposed for
   * the book of shame. Known simplification (R-080): forbids the exotic saves too (Boomerang
   * rescuing our own creature from removal, self-target Aether Mutation) — lines this
   * evaluator could not price anyway. */
  misaimPenalty(view: GameView, action: Action): number {
    const MISAIM = 100; // mana units — a cliff softmax cannot climb at any temperature
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    if (targets.length === 0) return 0;
    const effects = this.actionEffects(view, action);
    if (!effects) return 0;
    const cls = classifyEffects(effects);
    if (cls === "neutral") return 0;
    const me = view.you;
    for (const t of targets) {
      const side = targetSide(view, t);
      if (side === null) continue;
      if (cls === "harmful" && side === me) return MISAIM;
      if (cls === "helpful" && side !== me) return MISAIM;
    }
    return 0;
  }

  /** S22 playtest r3 (Chris: Duress at an empty hand, Mind Rot at a hand of nothing): a spell
   * whose only effects are discards aimed at players with no cards changes nothing — gated
   * like X=0. Exposed for the book of shame. */
  discardWasteGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const effects = this.actionEffects(view, action);
    if (!effects || effects.length === 0 || !effects.every((e) => e.type === "discard")) return false;
    const me = view.you;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    const affected = effects.flatMap((e) =>
      e.who === "you" ? [me]
      : e.who === "opponent" ? [1 - me]
      : e.who === "eachPlayer" ? [me, 1 - me]
      : targets.flatMap((t) => (t.kind === "player" ? [t.player] : [])),
    );
    if (affected.length === 0) return false;
    return affected.every((p) => (p === me ? view.hand.length : view.opponentHandCount) === 0);
  }

  /** S22 playtest r3 (Chris: Giant Growth cast after combat "to maximize mana usage"): a spell
   * whose only effects are until-end-of-turn buffs is a combat trick — with no combat live and
   * no opponent spell on the stack it evaporates at cleanup for nothing. Exposed for the book
   * of shame. */
  pumpWasteGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    // S32: a PERMANENT whose ETB is an until-end-of-turn grant (the Escort's hexproof) is a body, not a
    // trick — the gate reads instants and sorceries only.
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const cd = card ? this.def(card.cardId) : undefined;
    if (cd && !cd.types.includes("Instant") && !cd.types.includes("Sorcery")) return false;
    const effects = this.actionEffects(view, action);
    if (!effects || effects.length === 0) return false;
    const allEotBuffs = effects.every(
      (e) =>
        (e.type === "modifyPT" && e.duration === "UNTIL_END_OF_TURN" && ptSign(e.power) + ptSign(e.toughness) > 0) ||
        (e.type === "grantKeyword" && e.duration === "UNTIL_END_OF_TURN"),
    );
    if (!allEotBuffs) return false;
    // Deploy playtest r9 (Chris: Giant Growth at declare attackers, or at random moments): the trick's window is
    // AFTER blocks are declared — the DECLARE_BLOCKERS priority round or the damage steps (the blocks are final,
    // the trap springs) — on either player's turn; earlier in combat it only tells the opponent what to block.
    // An opponent spell on the stack keeps the save window. Book 22 (amended), book 55.
    const combatLive = view.combat.attackers.length > 0;
    const blocksFinal = combatLive && (view.step === "DECLARE_BLOCKERS" || view.step === "FIRST_STRIKE_DAMAGE" || view.step === "COMBAT_DAMAGE");
    const oppOnStack = view.stack.some((s) => s.controller !== view.you);
    return !blocksFinal && !oppOnStack;
  }

  /** Deploy playtest r9 (Chris: the Crab cast AFTER the land drop, the landfall mill missed): when a castable
   * candidate is a permanent with a landfall trigger, the land drop waits for it — the land is withheld from
   * this decision (it returns the moment the permanent is cast or stops being castable). Null when the rule
   * does not apply. Exposed for the book (56). */
  landfallFirstCandidates(view: GameView, candidates: Action[]): Action[] | null {
    if (!candidates.some((a) => a.type === "playLand")) return null;
    const landfallInHand = candidates.some((a) => {
      if (a.type !== "castSpell") return false;
      const card = view.hand.find((c) => c.objectId === a.objectId);
      const d = card ? this.def(card.cardId) : undefined;
      if (!d || d.types.includes("Instant") || d.types.includes("Sorcery")) return false;
      return (d.abilities ?? []).some((ab) => ab.kind === "triggered" && ab.event === "LAND_ENTERS_UNDER_YOUR_CONTROL");
    });
    if (!landfallInHand) return null;
    const rest = candidates.filter((a) => a.type !== "playLand");
    return rest.length > 0 ? rest : null;
  }

  /** Post-S48 (book 87; Chris: a creature cast before the Soul Warden, the life missed): a permanent in hand that
   * WATCHES creatures enter (the shape: a trigger on ENTERS_BATTLEFIELD whose source is another permanent and whose
   * type is Creature, ours or anyone's) is cast before the other creatures it would watch — when the mana covers
   * both this turn (colour-blind: untapped lands against the two mana values). Then the other creature casts leave
   * the pool; the watcher and everything else stay. The landfall-first rule's shape (book 56), one step along. */
  watcherFirstCandidates(view: GameView, candidates: Action[]): Action[] | null {
    const cardOf = (a: Action) => (a.type === "castSpell" ? view.hand.find((c) => c.objectId === a.objectId) : undefined);
    const watches = (d: CardDef | undefined) => !!d && !d.types.includes("Instant") && !d.types.includes("Sorcery") && (d.abilities ?? []).some((ab) => {
      if (ab.kind !== "triggered" || ab.event !== "ENTERS_BATTLEFIELD") return false;
      const c = ab.condition as { source?: string; controller?: string; type?: string[] } | undefined;
      return c?.source === "other" && (c.controller === "any" || c.controller === "you" || c.controller === undefined) && (!c.type || c.type.includes("Creature"));
    });
    const watchers = candidates.filter((a) => watches(this.def(cardOf(a)?.cardId ?? "")));
    if (!watchers.length) return null;
    const lands = view.battlefield.filter((o) => o.controller === view.you && !o.tapped && this.def(o.cardId)?.types.includes("Land")).length;
    const cheapest = Math.min(...watchers.map((a) => this.mv(cardOf(a)!.cardId)));
    const watcherIds = new Set(watchers.map((a) => (a as { objectId: string }).objectId));
    const rest = candidates.filter((a) => {
      const card = cardOf(a);
      if (!card || watcherIds.has(card.objectId)) return true;
      const d = this.def(card.cardId);
      if (!d?.types.includes("Creature")) return true;
      return this.mv(card.cardId) + cheapest > lands; // not both this turn: the other creature stays a candidate
    });
    return rest.length < candidates.length ? rest : null;
  }

  /** S17: is this action a mana burst (a spell whose only effect is addMana, or a sacrifice-cost
   * mana ability)? If so, does the burst enable a cast from hand this step that we couldn't pay now?
   * Mana model: untapped lands + untapped rested creature producers + the floating pool vs. nonland
   * cards' mana values (colour-blind — v1). Returns null for non-burst actions. */
  manaBurst(view: GameView, action: Action): { enables: boolean } | null {
    const me = view.you;
    let produced = 0;
    let spendsCard: string | null = null;
    let burstColor: string | null = null;
    let burstColors: string[] | null = null;
    let fixedColors: string[] = []; // post-S43: a Ritual's BBB — the enabled card's OTHER pips come from the lands
    let ownCost = 0;
    if (action.type === "castSpell") {
      const card = view.hand.find((c) => c.objectId === action.objectId);
      const d = card ? this.def(card.cardId) : undefined;
      if (!d || !d.spellEffect || d.spellEffect.length === 0 || !d.spellEffect.every((e) => e.type === "addMana")) return null;
      for (const e of d.spellEffect) if (e.type === "addMana" && e.mana) { produced += (e.mana.match(/\{/g) ?? []).length; fixedColors.push(...(e.mana.match(/[WUBRG]/g) ?? [])); }
      ownCost = Math.max(1, manaValue(parseManaCost(d.manaCost)));
      produced -= ownCost; // net of its own cost
      spendsCard = card!.objectId;
    } else if (action.type === "activateAbility") {
      const o = view.battlefield.find((b) => b.id === action.objectId);
      const d = o ? this.def(o.cardId) : undefined;
      const ab = d?.abilities?.[action.abilityIndex];
      if (!ab || ab.kind !== "activated" || !ab.cost.sacrifice || !ab.effects.every((e) => e.type === "addMana")) return null;
      for (const e of ab.effects) if (e.type === "addMana" && e.mana) produced += (e.mana.match(/\{/g) ?? []).length;
      // S26: the Lotus — N of one chosen colour; the enabling card must WANT that colour (or none).
      for (const e of ab.effects) if (e.type === "addMana" && e.choice) { produced += e.choice.count; burstColor = action.color ?? null; }
      // S28 (ADR-098, Orcish Lumberjack): a COMBINATION burst — its multiset must cover the enabled
      // card's pips in those colours; and the LAST Forest is never fed to it while a green card waits
      // in hand with no other green source (the Forest is worth more standing).
      if (action.colors) {
        burstColors = [...action.colors];
        if (ab.cost.sacrifice?.predicate === "land.subtype:Forest") {
          const forests = view.battlefield.filter((b) => b.controller === me && (this.def(b.cardId)?.subtypes ?? []).includes("Forest"));
          const otherGreen = view.battlefield.some((b) => b.controller === me && !(this.def(b.cardId)?.subtypes ?? []).includes("Forest") && (this.def(b.cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.effects.some((e) => e.type === "addMana" && e.mana?.includes("G"))));
          const greenInHand = view.hand.some((c) => (this.def(c.cardId)?.manaCost ?? "").includes("G"));
          if (forests.length === 1 && greenInHand && !otherGreen) return { enables: false };
        }
      }
    } else return null;
    const pool = Object.values(view.manaPool).reduce((a, b) => a + b, 0);
    const producers = view.battlefield.filter((o) => {
      if (o.controller !== me || !this.canActNow(o)) return false; // S45: a sick mana creature is no mana this turn
      const d = this.def(o.cardId);
      if (!d) return false;
      const isLand = d.types.includes("Land");
      const hasMana = (d.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && !a.cost.sacrifice && a.effects.every((e) => e.type === "addMana" && !e.choice));
      return hasMana && (isLand || true);
    }).length;
    const available = pool + producers;
    // Post-S43 (Chris: "a Dark Ritual and then nothing" — 68 of 82 Rituals wasted in a probe, 50 of them in the
    // AI's own upkeep or draw step): the burst's mana empties at the step's end, so the card it enables must be
    // castable in THIS step — a sorcery-speed card only in our main phase on an empty stack.
    const sorceryWindow = view.activePlayer === me && (view.step === "MAIN1" || view.step === "MAIN2") && view.stack.length === 0;
    const enables = view.hand.some((c) => {
      if (c.objectId === spendsCard) return false;
      const d = this.def(c.cardId);
      if (!d || d.types.includes("Land")) return false;
      const mv = manaValue(parseManaCost(d.manaCost));
      if (!(mv > available && mv <= available + produced)) return false;
      if (!sorceryWindow && !d.types.includes("Instant") && !(d.keywords ?? []).includes("flash")) return false;
      if (this.targetsAbsent(view, d)) return false; // a Terror with nothing to kill enables nothing
      // An untargeted, unmoded, X-less card is its own cast action — ask our own scorer whether we would cast
      // it at all (Buried Alive without a reanimator, a second copy of a legend: the gates say no).
      if (!d.targets?.length && !d.modes && !/\{X\}/.test(d.manaCost) && action.type === "castSpell") {
        if (this.scorePriorityAction(view, { type: "castSpell", objectId: c.objectId, targets: [] }) === -Infinity) return false;
      }
      if (fixedColors.length > 0 && !this.burstPayable(view, spendsCard!, fixedColors, d.manaCost)) return false;
      // S26: a coloured burst must match a pip of the card it enables (a Lotus popped for red
      // enables nothing blue); colourless costs take any colour.
      if (burstColor) {
        const pips = d.manaCost.replace(/[^WUBRG]/g, "");
        if (pips.length > 0 && !pips.includes(burstColor)) return false;
      }
      if (burstColors) {
        // The multiset must supply every pip of ITS colours that the card asks for (RG for {R}{G};
        // a green card wants at least one G in the mix); other colours come from the lands.
        const pips = d.manaCost.replace(/[^WUBRG]/g, "").split("");
        for (const c of new Set(burstColors)) {
          const need = pips.filter((p) => p === c).length;
          const have = burstColors.filter((p) => p === c).length;
          if (need > 0 && have < Math.min(need, burstColors.length)) return false;
        }
        const wanted = pips.filter((p) => burstColors.includes(p));
        if (pips.length > 0 && wanted.length === 0 && pips.some((p) => ["R", "G"].includes(p) === false) && pips.every((p) => !burstColors.includes(p))) return false;
      }
      return true;
    });
    return { enables };
  }

  /** Post-S43 (Chris: Graceful Restoration cast "with nothing happening" — its second mode, "up to two",
   * cast with zero targets into a graveyard with no creatures: 27 of 124 casts in a probe). A spell whose
   * every effect acts on its targets, cast with none chosen, does provably nothing — the X=0 family. */
  private emptyTargetsWasteGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell" || (action.targets?.length ?? 0) > 0) return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d) return false;
    const specs = d.modes && action.mode !== undefined ? d.modes[action.mode]?.targets ?? [] : d.targets ?? [];
    if (specs.length === 0) return false; // untargeted: its effects need no targets
    const effects = d.modes && action.mode !== undefined ? d.modes[action.mode]?.effects ?? [] : d.spellEffect ?? [];
    return effects.length > 0 && effects.every((e) => "target" in e || "targetSpec" in e);
  }

  /** Post-S43: can the Ritual be cast AND the card it enables be paid after it resolves — by colour? The
   * Ritual's own pips and the card's pips its mana does not make are matched to our untapped producers
   * (each by the colours it taps for) and the floating pool; the generic parts take whatever is left. */
  private burstPayable(view: GameView, ritualId: string, burst: string[], costText: string): boolean {
    const me = view.you;
    const sources: string[][] = [];
    for (const [c, n] of Object.entries(view.manaPool)) for (let i = 0; i < n; i++) sources.push([c]);
    for (const o of view.battlefield) {
      if (o.controller !== me || !this.canActNow(o)) continue; // S45: a sick mana creature pays nothing
      // S55: every mana ability of the permanent — a dual land has one per colour, and only its first was read (a
      // Badlands made no red, so a Ritual never "enabled" the Usher)
      const cols = new Set<string>();
      for (const ab of this.def(o.cardId)?.abilities ?? []) {
        if (!(ab.kind === "activated" && ab.cost.tap && !ab.cost.sacrifice && !ab.cost.mana && ab.effects.length > 0 && ab.effects.every((e) => e.type === "addMana" && !e.choice))) continue;
        for (const e of ab.effects) if (e.type === "addMana") for (const c of (e.mana ?? "").match(/[WUBRGC]/g) ?? []) cols.add(c);
      }
      if (cols.size > 0) sources.push([...cols]);
    }
    const ritualCost = parseManaCost(this.def(view.hand.find((c) => c.objectId === ritualId)?.cardId ?? "")?.manaCost ?? "");
    const cardCost = parseManaCost(costText);
    const pipsOf = (text: string) => text.match(/\{([WUBRG])\}/g)?.map((x) => x[1]!) ?? [];
    const ritualPips = pipsOf(this.def(view.hand.find((c) => c.objectId === ritualId)?.cardId ?? "")?.manaCost ?? "");
    const left = [...burst];
    const cardPips = pipsOf(costText).filter((p) => { const i = left.indexOf(p); if (i === -1) return true; left.splice(i, 1); return false; });
    const need = [...ritualPips, ...cardPips];
    const used = new Array(sources.length).fill(false);
    const match = (k: number): boolean => {
      if (k === need.length) return true;
      for (let i = 0; i < sources.length; i++) {
        if (used[i] || !sources[i]!.includes(need[k]!)) continue;
        used[i] = true;
        if (match(k + 1)) return true;
        used[i] = false;
      }
      return false;
    };
    if (!match(0)) return false;
    const spare = used.filter((u) => !u).length + left.length;
    return spare >= ritualCost.generic + cardCost.generic;
  }

  /** S46 (Ponder — the brief's Part 3): what the next draw wants. Short of mana (fewer than three lands in play, or no
   * land in hand and fewer than five in play) → a land; otherwise the best spell castable soon (mana value ≤ lands + 1,
   * the dearest first). A card is POOR when it is a land we do not need or a spell two beyond our mana. Exposed. */
  ponderWants(view: GameView): { land: boolean; lands: number } {
    const me = view.you;
    const lands = view.battlefield.filter((o) => o.controller === me && this.def(o.cardId)?.types.includes("Land")).length;
    const landInHand = view.hand.some((c) => this.def(c.cardId)?.types.includes("Land"));
    return { land: lands < 3 || (!landInHand && lands < 5), lands };
  }
  ponderPoor(view: GameView, cardId: string): boolean {
    const d = this.def(cardId);
    const w = this.ponderWants(view);
    if (!d) return true;
    if (d.types.includes("Land")) return !w.land;
    return this.mv(cardId) > w.lands + 2;
  }
  orderTopChoice(view: GameView, request: ActionRequest): Action {
    const picks = request.actions.filter((a): a is Extract<Action, { type: "putOnTop" }> => a.type === "putOnTop");
    if (picks.length === 0) return request.actions[0]!;
    const cardOf = new Map((request.revealed ?? []).map((r) => [r.objectId, r.cardId]));
    const w = this.ponderWants(view);
    const score = (a: (typeof picks)[number]): number => {
      const id = cardOf.get(a.objectId) ?? "";
      const d = this.def(id);
      if (!d) return -10;
      if (d.types.includes("Land")) return w.land ? 10 : -5;
      const mv = this.mv(id);
      return mv <= w.lands + 1 ? 5 + mv : 1 - (mv - w.lands);
    };
    return [...picks].sort((x, y) => score(y) - score(x) || (cardOf.get(x.objectId) ?? "").localeCompare(cardOf.get(y.objectId) ?? ""))[0]!;
  }
  mayShuffleChoice(view: GameView, request: ActionRequest): Action {
    const seen = (request.revealed ?? []).map((r) => r.cardId);
    const allPoor = seen.length > 0 && seen.every((id) => this.ponderPoor(view, id));
    return request.actions.find((a) => a.type === (allPoor ? "acceptOptional" : "declineOptional")) ?? request.actions[0]!;
  }

  /** S17: a hand-zone self-discard ability (cycling). S22: resolved through the virtual list so the
   * Stoker's granted cycling is recognized too (pin 13 rides unchanged). */
  isCycling(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    if (!view.hand.some((c) => c.objectId === action.objectId)) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    // S55: cycling REPLACES the card (a draw, or its search) — Faerie Macabre's discard is an answer, not a cantrip
    return !!ab && ab.kind === "activated" && ab.zone === "hand" && ab.cost.discardSelf === true && ab.effects.some((e) => e.type === "draw" || e.type === "searchLibrary");
  }

  /** S22 (A10 word 2): the Unwinder-discipline gate — true blocks the activation. */
  private bounceCostBlocked(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.returnToHand) return false;
    const me = view.you;
    const landsInPlay = view.battlefield.filter((o) => o.controller === me && (this.def(o.cardId)?.types ?? []).includes("Land")).length;
    const landInHand = view.hand.some((c) => this.def(c.cardId)?.types.includes("Land"));
    const maxNeed = Math.max(0, ...view.hand.filter((c) => !this.def(c.cardId)?.types.includes("Land")).map((c) => this.mv(c.cardId)));
    // Allowed with a land to replay, or when even after the bounce we can still pay next turn's plan.
    return !(landInHand || landsInPlay - 1 >= maxNeed);
  }

  /** S25 (the court's pins, pin-17 family): floors on self-charging activation costs.
   * Life cost: blocked at life ≤ 2 (the Witch's floor — at 3 the knife still has a handle).
   * Recoil (damage to:"you" in the effects): blocked when it meets-or-beats current life
   * (the Tyrant — the Gallows Djinn's never-lethal sibling).
   * Exile-top cost: blocked when it would leave the library under 3 (the Cleric's DECKED
   * walk; the floor is a first guess for guardian-sim to argue). */
  private costFloorBlocked(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated") return false;
    const me = view.you;
    if (ab.cost.life && view.life[me] - ab.cost.life <= 0) return true;
    if (ab.cost.life && view.life[me] <= 2) return true;
    if (ab.cost.exileTop && view.librarySizes[me] - ab.cost.exileTop < 3) return true;
    let recoil = 0;
    for (const e of ab.effects) if (e.type === "damage" && e.to === "you" && typeof e.amount === "number") recoil += e.amount;
    if (recoil > 0 && recoil >= view.life[me]) return true;
    return false;
  }

  /** S17: a spell in hand with no legal target on this board (so cycling it loses nothing).
   * S22: a LAND is dead to hand when we are flooded (≥6 in play with another land in hand) —
   * the Stoker's grant turns flooded draws into fuel. */
  cardIsDead(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d) return true;
    if (d.types.includes("Land")) {
      const inPlay = view.battlefield.filter((o) => o.controller === view.you && (this.def(o.cardId)?.types ?? []).includes("Land")).length;
      const spareLands = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
      return inPlay >= 6 && spareLands >= 2;
    }
    return this.targetsAbsent(view, d);
  }

  /** S17 (cycling's dead-card test), shared post-S43 with the mana burst: a spell whose target specs
   * cannot all be met on this board. Approximate — graveyard and unknown predicates count as met. */
  private targetsAbsent(view: GameView, d: CardDef): boolean {
    const specs = d.targets ?? [];
    if (specs.length === 0) return false; // untargeted spells always have a use
    // Approximate legality from the view: any battlefield object the spec's base/anyOf predicates could accept.
    const accepts = (spec: { predicate: string; anyOf?: { predicate: string; withKeyword?: string }[]; withKeyword?: string }, o: GameView["battlefield"][number]): boolean => {
      if (spec.anyOf) return spec.anyOf.some((alt) => accepts(alt, o));
      const dd = this.def(o.cardId);
      if (!dd) return false;
      const kw = spec.withKeyword ? o.keywords.includes(spec.withKeyword) : true;
      switch (spec.predicate) {
        case "artifact": return dd.types.includes("Artifact");
        case "enchantment": return dd.types.includes("Enchantment");
        case "creature": case "nonblackCreature": case "nonartifactNonblackCreature": case "anyTarget": return o.power !== null && kw;
        case "creatureYouControl": return o.power !== null && o.controller === view.you && kw;
        case "creatureYouDontControl": return o.power !== null && o.controller !== view.you && kw;
        case "permanent": case "nonlandPermanent": return kw;
        default: return true;
      }
    };
    return !specs.every((spec) => view.battlefield.some((o) => accepts(spec, o)));
  }

  /** S17 (A6): modal choice v1 — Aether Channeler's shape. Prefer bouncing an opposing nonland
   * permanent worth ≥ 2.5 (their best), else draw, else the token; other modal cards fall back to
   * the first offered mode. Exposed for the book of shame. */
  modeChoice(view: GameView, request: ActionRequest): Action {
    const modes = request.actions.filter((a) => a.type === "chooseMode") as Extract<Action, { type: "chooseMode" }>[];
    if (modes.length <= 1) return modes[0] ?? request.actions[0]!;
    const me = view.you;
    const labelOf = (m: (typeof modes)[number]) => m.label.toLowerCase();
    const bounce = modes.find((m) => labelOf(m).includes("return"));
    const draw = modes.find((m) => labelOf(m).includes("draw"));
    const token = modes.find((m) => labelOf(m).includes("token"));
    const theirBest = Math.max(0, ...view.battlefield.filter((o) => o.controller !== me && !(this.def(o.cardId)?.types.includes("Land") ?? false)).map((o) => objectValue(this.defs, o, this.C)));
    if (bounce && theirBest >= 2.5) return bounce;
    // S45 (Dread Presence — the draw was taken 95 of 95): a DAMAGE mode beside a draw is chosen by the board — a
    // creature it kills, a lethal point, or our own life low (the draw costs life; the burn mode heals); else the
    // draw while the hand is short, the face once it is full. Keyed on the labels' shape, not the card.
    const damage = modes.find((m) => labelOf(m).includes("damage"));
    if (damage && draw) {
      const n = Number(/(\d+) damage/.exec(labelOf(damage))?.[1] ?? 2);
      const killable = view.battlefield.some((o) => o.controller !== me && o.toughness !== null && o.toughness - o.damage <= n && objectValue(this.defs, o, this.C) >= 1);
      const lethal = view.life[(1 - me) as 0 | 1] <= n;
      if (killable || lethal || view.life[me] <= 5) return damage;
      return view.hand.length <= 3 ? draw : damage;
    }
    if (draw) return draw;
    return token ?? modes[0]!;
  }

  /** S15 Part 3.1 — ranked tutor policy v1 (exposed for the book of shame).
   * Growth (basics only): the basic of a colour we need most — coloured
   * symbols in hand minus lands of that colour on our battlefield.
   * Tutor (any card): if the hand is land-light (<2), a needed basic; else
   * the best castable-soon nonland (mv ≤ lands+1), highest mv first — the
   * discard/bottom ranking inverted; never a land while holding ≥3 lands. */
  searchChoice(view: GameView, request: ActionRequest): Action {
    const picks = request.actions.filter((a): a is Extract<Action, { type: "searchPick" }> => a.type === "searchPick");
    const decline = request.actions.find((a) => a.type === "declineSearch") ?? request.actions[0]!;
    if (picks.length === 0) return decline;
    const cardOf = new Map((request.revealed ?? []).map((r) => [r.objectId, r.cardId]));
    const me = view.you;
    const myLands = view.battlefield.filter((o) => o.controller === me && this.def(o.cardId)?.types.includes("Land"));
    const handLands = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    // Colour need: symbols in hand costs minus lands producing that colour.
    const need: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const c of view.hand) {
      const cost = this.def(c.cardId)?.manaCost ?? "";
      for (const col of Object.keys(need)) need[col]! += (cost.match(new RegExp(`\\{${col}\\}`, "g")) ?? []).length;
    }
    for (const l of myLands) {
      const prod = this.def(l.cardId)?.abilities?.flatMap((a) => ("effects" in a ? a.effects : []))?.find((e) => e.type === "addMana");
      const m = prod && prod.type === "addMana" ? prod.mana ?? "" : "";
      for (const col of Object.keys(need)) if (m.includes(`{${col}}`)) need[col]! -= 1;
    }
    const basicColor = (cardId: string): string | null => {
      const d = this.def(cardId);
      if (!d?.types.includes("Land")) return null;
      const m = d.abilities?.flatMap((a) => ("effects" in a ? a.effects : [])).find((e) => e.type === "addMana");
      const s = m && m.type === "addMana" ? m.mana ?? "" : "";
      return (["W", "U", "B", "R", "G"].find((c) => s.includes(`{${c}}`)) as string | undefined) ?? null;
    };
    const lands = picks.filter((a) => this.def(cardOf.get(a.objectId) ?? "")?.types.includes("Land"));
    const nonlands = picks.filter((a) => !lands.includes(a));
    // S31 (book 47 — Buried Alive under the Artisan): a search that puts its find in the GRAVEYARD is
    // stocking a reanimator — take the best body to bring back (the Zombify/Unearth valuation: mana
    // value, size, an ETB), never the Tutor's castable-soon pick. The Artisan before the Serra before
    // the Gravedigger; S30's cast counts had the chooser burying Gravediggers.
    const toGraveyard = (request.source?.effects ?? []).some((e) => e.type === "searchLibrary" && e.to === "graveyard");
    // S55 (books 100–101): a combo list's searches are the plan's — the setup buries the piece (three Ushers), the
    // tutor fetches the missing half
    const planPick = this.planSearchPick(view, request, picks, cardOf, toGraveyard);
    if (planPick) return planPick;
    if (toGraveyard && nonlands.length > 0) {
      // book 99: the loop's second copy goes to the graveyard when the first is in hand or on our battlefield
      const holds = (cardId: string) => view.hand.some((c) => c.cardId === cardId) || view.battlefield.some((o) => o.controller === view.you && o.cardId === cardId);
      const worth = (cardId: string): number => reanimationWorth(this.def(cardId)) + (holds(cardId) && legendLoopWorth({ ...view, graveyardObjects: view.graveyardObjects.map((g, p) => (p === view.you ? [...g, { objectId: "pred_buried", cardId }] : g)) as GameView["graveyardObjects"] }, this.defs, this.def(cardId), view.hand.some((c) => c.cardId === cardId) ? undefined : "pred_buried") > 0 ? LOOP_WORTH : 0);
      return [...nonlands].sort((a, b) => worth(cardOf.get(b.objectId) ?? "") - worth(cardOf.get(a.objectId) ?? "") || (cardOf.get(a.objectId) ?? "").localeCompare(cardOf.get(b.objectId) ?? ""))[0]!;
    }
    // S30 (Wood Elves — Pell, Quill): a land is scored by the BEST need over every colour it produces,
    // so a Breeding Pool covers the blue pip a Forest cannot; a dual wins ties (book 44).
    const landColors = (cardId: string): string[] => {
      const d = this.def(cardId);
      if (!d?.types.includes("Land")) return [];
      const out = new Set<string>();
      for (const a of d.abilities ?? []) for (const e of ("effects" in a ? a.effects : [])) if (e.type === "addMana" && e.mana) for (const c of ["W", "U", "B", "R", "G"]) if (e.mana.includes(`{${c}}`)) out.add(c);
      return [...out];
    };
    const landScore = (cardId: string): number => { const cs = landColors(cardId); return cs.length === 0 ? -99 : Math.max(...cs.map((c) => need[c] ?? 0)) + 0.1 * (cs.length - 1); };
    void basicColor;
    const bestLand = [...lands].sort((a, b) => landScore(cardOf.get(b.objectId) ?? "") - landScore(cardOf.get(a.objectId) ?? ""))[0];
    if (nonlands.length === 0) return bestLand ?? decline;
    if (handLands < 2 && bestLand) return bestLand;
    const castableSoon = (a: Extract<Action, { type: "searchPick" }>) => this.mv(cardOf.get(a.objectId) ?? "") <= myLands.length + 1;
    const ranked = [...nonlands].sort((a, b) => {
      const ca = castableSoon(a) ? 1 : 0, cb = castableSoon(b) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const d = this.mv(cardOf.get(b.objectId) ?? "") - this.mv(cardOf.get(a.objectId) ?? "");
      if (d !== 0) return d;
      return (cardOf.get(a.objectId) ?? "").localeCompare(cardOf.get(b.objectId) ?? "");
    });
    return ranked[0]!;
  }

  private hasXCost(view: GameView, action: Action): boolean {
    if (action.type === "castSpell") {
      const card = view.hand.find((c) => c.objectId === action.objectId);
      const d = card ? this.def(card.cardId) : undefined;
      return !!d && d.manaCost.includes("X");
    }
    if (action.type === "activateAbility") {
      const o = view.battlefield.find((b) => b.id === action.objectId);
      const ab = o ? this.def(o.cardId)?.abilities?.[action.abilityIndex] : undefined;
      return !!ab && ab.kind === "activated" && typeof ab.cost.mana === "string" && ab.cost.mana.includes("X");
    }
    return false;
  }

  private priorityChoice(view: GameView, request: ActionRequest): Action {
    const candidates = request.actions.filter((a) => a.type !== "tapForMana" && a.type !== "untapForMana"); // S25 r3: takebacks are human conveniences
    if (candidates.length === 1) return candidates[0]!;
    // S35 Part 3 (Chris: Oriel skipped her first land twice; measured 24.7% of apprentice first main phases
    // passed over an available land when pass was the only alternative — the softmax at 1.2 over a small
    // gap): a land drop with NO competing play is never passed over, at any profile (book 51).
    const landsOnly = this.landOnlyCandidates(candidates);
    if (landsOnly) {
      if (landsOnly.length === 1) return landsOnly[0]!;
      return landsOnly[this.softmaxPick(landsOnly.map((a) => this.scorePriorityAction(view, a)))]!; // which land — a real choice; passing is not
    }
    // r9: a landfall permanent in hand is cast before the land drop (book 56).
    const first = this.landfallFirstCandidates(view, candidates) ?? candidates;
    const pool = this.watcherFirstCandidates(view, first) ?? first; // post-S48 (book 87)
    this.offered = candidates; // S55: the plan reads what the engine actually offers (colours and timing included)
    const scores = pool.map((a) => this.scorePriorityAction(view, a));
    this.offered = null;
    const pick = pool[this.softmaxPick(scores)]!;
    // S27 r2: the Witch's per-turn budget — count each life-for-cards activation taken.
    if (pick.type === "activateAbility") {
      const ab = viewAbilityAt(view, this.defs, pick.objectId, pick.abilityIndex);
      if (ab && ab.kind === "activated" && ab.cost.life && ab.effects.some((e) => e.type === "draw")) {
        if (this.lifeDrawsThisTurn.turn !== view.turn) this.lifeDrawsThisTurn = { turn: view.turn, n: 0 };
        this.lifeDrawsThisTurn.n += 1;
      }
    }
    return pick;
  }

  /** ADR-060.2 posture switch (exposed for tests): hold tricks only when not
   * behind on board value — behind, holding mana is a luxury; develop instead. */
  holdActive(view: GameView): boolean {
    if (this.profile.holdTricks === false) return false;
    const me = view.you;
    let delta = 0;
    for (const o of view.battlefield) {
      const v = objectValue(this.defs, o, this.C);
      delta += o.controller === me ? v : -v;
    }
    return delta >= -this.C.posture.behindThreshold;
  }

  /** ADR-051 / S9 Part 2a: passing with counter mana up is worth something
   * in proportion to what the opponent could actually cast soon — threats in
   * the known list with mv 3..(their lands + 1), counted by copies — rather
   * than a flat "the list has something big" bonus. */
  private counterHoldBonus(view: GameView): number {
    if (!this.holdActive(view)) return 0;
    const counterCard = view.hand.find((c) =>
      this.def(c.cardId)?.spellEffect?.some((e) => e.type === "counter"),
    );
    if (!counterCard) return 0;
    const cost = this.mv(counterCard.cardId);
    const me = view.you;
    const untappedLands = view.battlefield.filter(
      (o) => o.controller === me && !o.tapped && this.def(o.cardId)?.types.includes("Land"),
    ).length;
    if (untappedLands < cost) return 0;
    const oppLands = view.battlefield.filter(
      (o) => o.controller !== me && this.def(o.cardId)?.types.includes("Land"),
    ).length;
    const oppMana = oppLands + 1; // next turn's land drop
    let threatCopies = 0;
    for (const { cardId, count } of this.profile.opponentDecklist) {
      const mv = this.mv(cardId);
      if (mv >= 3 && mv <= oppMana && !this.def(cardId)?.types.includes("Land")) threatCopies += count;
    }
    if (threatCopies === 0) return 0;
    return Math.min(0.9, 0.3 + 0.06 * threatCopies);
  }

  /** S9 Part 2b: an affordable flash creature is better cast at instant
   * speed (ambush blocks, Snake-as-counterspell) than on our own main phase
   * — a small pass bonus during our turn only, so it still comes down when
   * the board needs it and never delays on the opponent's turn. */
  private flashHoldBonus(view: GameView): number {
    if (!this.holdActive(view)) return 0;
    if (view.activePlayer !== view.you) return 0;
    const me = view.you;
    const untappedLands = view.battlefield.filter(
      (o) => o.controller === me && !o.tapped && this.def(o.cardId)?.types.includes("Land"),
    ).length;
    const holdable = view.hand.some((c) => {
      const d = this.def(c.cardId);
      return d?.keywords?.includes("flash") && this.mv(c.cardId) <= untappedLands;
    });
    return holdable ? 0.35 : 0;
  }

  /** S35: when every candidate is a land drop or a pass, the pass is never taken — the land drops (one or a
   * choice of which) are the only candidates. Null when any other play competes. Exposed for the book. */
  landOnlyCandidates(candidates: Action[]): Action[] | null {
    const lands = candidates.filter((a) => a.type === "playLand");
    if (lands.length === 0) return null;
    return candidates.every((a) => a.type === "playLand" || a.type === "pass") ? lands : null;
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

  /** Exposed for the book-of-shame suite (16). */
  async attackChoice(view: GameView, request: ActionRequest): Promise<Action> {
    const done = request.actions.find((a) => a.type === "doneDeclaringAttackers");
    // S23 (the Gallows Djinn's pin — the pin-17 family): never declare an attacker whose own
    // attack tax is lethal to us (the Djinn at life 1 kills its keeper before damage is dealt).
    const offered = (request.actions.filter((a) => a.type === "declareAttacker") as { type: string; objectId: string }[]).filter(
      (a) => this.selfTax(view, a.objectId, "ATTACKS") < view.life[view.you],
    );
    if (offered.length === 0) return done ?? request.actions[0]!;

    const staged = new Set(view.combat.attackers);
    const creatures = this.attackSimCreatures(view);
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
    // S18 director round (Chris's Nighthawk game, book of shame 16): greedy ADDITION from the empty set
    // never finds the swarm — each lone X/1 into one untapped 1/1 blocker is a bad trade, so nothing is
    // ever added, though three of them together push two through. Second search: start from EVERYTHING
    // offered and greedily REMOVE; keep whichever search scores higher (alpha-strike sizing, ADR-062's
    // "surgical" item done the cheap way — still one sim per candidate set).
    let allSet = [...new Set([...staged, ...offered.map((a) => a.objectId)])];
    let allScore = await this.scoreAttackSet(view, creatures, me, allSet);
    improved = true;
    while (improved && allSet.length > staged.size) {
      improved = false;
      for (const id of allSet) {
        if (staged.has(id)) continue;
        const trial = allSet.filter((x) => x !== id);
        const s = await this.scoreAttackSet(view, creatures, me, trial);
        if (s > allScore + 0.01) {
          allScore = s;
          allSet = trial;
          improved = true;
          break; // re-scan from the new set
        }
      }
    }
    if (allScore > bestScore + 0.01) {
      bestScore = allScore;
      bestSet = allSet;
    }
    const next = offered.find((a) => bestSet.includes(a.objectId) && !staged.has(a.objectId));
    return (next as Action | undefined) ?? done ?? request.actions[0]!;
  }

  /** Exposed for the book-of-shame suite: score of one candidate attack set. */
  async scoreAttackSet(
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
    // S45 (the Tidewall): an attack its block trigger meets costs us the card it hands back.
    const handedBack = blocks.reduce((n, b) => n + this.blockReturnValue(view, b.blocker), 0);
    const valueOf = (id: string) => {
      const o = view.battlefield.find((b) => b.id === id);
      return o ? objectValue(this.defs, o, this.C) : 1;
    };
    // Exchange rates: aggro creatures exist to die profitably, and face
    // damage compounds (it never heals back in this pool); both are priced
    // per archetype, with damage worth half again more once the opponent is
    // within burn/alpha range.
    const ownLossWeight = { aggro: 0.6, midrange: 0.85, control: 1.0 }[this.profile.archetype];
    let dmgWeight = { aggro: 0.9, midrange: 0.55, control: 0.4 }[this.profile.archetype];
    // S12 (Chris): race mode at 8 life OR half the starting life, whichever
    // comes first — identical to the old fixed 10 at 20-life games, and no
    // longer all-in from turn one when world life starts at 10.
    if (view.life[opp] <= Math.max(8, view.startingLife / 2)) dmgWeight *= 1.5;
    let score = 0;
    for (const id of outcome.dead) {
      const c = creatures.find((s) => s.id === id);
      if (!c) continue;
      score += c.controller === me ? -ownLossWeight * valueOf(id) : valueOf(id);
    }
    score += outcome.playerDamage[opp] * dmgWeight;
    // S31 (R-094, the Traumatizer — ADR-107): every point of combat damage our creatures deal the
    // opponent also mills under our controller-wide mill observers — priced on the S29 curve against
    // their library (book 45); an attack that EMPTIES it is the win next draw.
    const per = millPerDamage(view, this.defs, me);
    if (per > 0 && outcome.playerDamage[opp] > 0) {
      const n = per * outcome.playerDamage[opp];
      const lib = view.librarySizes[opp] ?? 0;
      score += millValue(n, lib) + (lib > 0 && n >= lib ? 200 : 0);
    }
    // S31 (R-094 word 1, Artisan of Kozilek — book 46): an attacker whose attack trigger makes the
    // defender sacrifice is worth what their cheapest permanents cost them, plus a tempo half-point
    // each — the annihilator swings every turn it is safe to.
    for (const id of attackers) score += this.edictGainOnAttack(view, id, opp);
    // S9 Part 1.1: our lifelink attackers' gains show up as negative own
    // damage in the sim — credit them. (Opponent lifelink blockers already
    // debit through negative playerDamage[opp].)
    score += Math.max(0, -outcome.playerDamage[me]) * 0.2;
    // ADR-060.1: attacking abandons defense — each non-vigilance attacker
    // pays the deterrence it was providing (evaluate credits the same term
    // to untapped holders; that asymmetry prices the Rats over-attack).
    // Post-S43 (Chris, book 69): a creature under a public "can't attack" (Pacifism) threatens no counter-swing — it
    // deters nothing and adds no race risk.
    const oppCreatures = view.battlefield.filter((o) => o.controller !== me && o.power !== null && !o.cantAttack);
    // S27 r2 (Chris: the Manafleur never swung its 7/7 into a board of 2/2s): deterrence is only worth
    // what the counter-swing could take — scale the deduction by the race risk (the opponent's
    // untapped power against our life above a margin). At 35 life facing six power the 7/7 attacks;
    // at 6 life it holds. Vigilance still pays nothing. Exposed through the book (29).
    const untappedOpp = oppCreatures.filter((o) => !o.tapped && !o.keywords.includes("defender")); // S30: a Wall is no race
    const oppPower = untappedOpp.reduce((n, o) => n + (o.power ?? 0), 0);
    const maxOppPower = untappedOpp.reduce((m, o) => Math.max(m, o.power ?? 0), 0);
    const oppDeathtouch = untappedOpp.some((o) => o.keywords.includes("deathtouch") || this.destroysWhatItDamages(o.id, view)); // book 95
    const raceRisk = Math.min(1, oppPower / Math.max(1, view.life[me] - 5));
    // S45 (Seedborn Muse): under an untap-in-their-untap-step static every attacker stands again to block — the
    // counter-swing costs nothing, as vigilance.
    const untapsForTheirTurn = view.battlefield.some((b) => b.controller === me && (this.def(b.cardId)?.abilities ?? []).some((a) => a.kind === "static" && a.effects.some((e) => e.type === "untapDuringOthersUntap")));
    for (const id of attackers) {
      const o = view.battlefield.find((b) => b.id === id);
      if (!o || o.keywords.includes("vigilance") || untapsForTheirTurn) continue;
      // Only a SAFE attacker (no single block can kill it) trades its deterrence for race risk; a
      // fragile trader (the deathtouch 1/1 of book-of-shame's deterrence pin) keeps the full deduction.
      const safe = (o.toughness ?? 0) > maxOppPower && !oppDeathtouch;
      score -= deterrence(this.defs, o, oppCreatures, this.C) * (safe ? raceRisk : 1);
    }
    // S23 (the Gallows Djinn): each attacker's own attack tax is priced at the archetype's
    // own-life rate — the 5/5's swing is honest, not free.
    for (const id of attackers) score -= this.selfTax(view, id, "ATTACKS") * this.C.weights[this.profile.archetype].ownLife;
    score -= handedBack;
    if (view.life[opp] - outcome.playerDamage[opp] <= 0) score += 1000;
    this.simMemo.set(memoKey, score);
    return score;
  }

  /** Exposed for the book-of-shame suite: gain of one block, in mana units. */
  blockGain(view: GameView, blocker: SimObject, attacker: SimObject): number {
    const valueOf = (id: string) => {
      const o = view.battlefield.find((b) => b.id === id);
      return o ? objectValue(this.defs, o, this.C) : 1;
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
    // S23 (the Gallows Djinn): blocking's own tax is part of the exchange.
    const blockTax = this.selfTax(view, blocker.id, "BLOCKS") * this.C.weights[this.profile.archetype].ownLife;
    // S40 (Voracious Cobra): a creature that destroys what it deals combat damage to trades like deathtouch.
    if (attacker.power > 0 && this.destroysWhatItDamages(attacker.id, view) && !(bFirst && !aFirst && kills)) dies = true;
    if (blocker.power > 0 && this.destroysWhatItDamages(blocker.id, view) && !(aFirst && !bFirst && dies)) kills = true;
    // S40 (Meliyan, book 63): under a death-burn observer of ours, a blocker that dies is a burn spell for its
    // power — counters-bearing bodies block more freely.
    const deathBurn = dies ? this.deathBurnObservers(view, blocker.id) * blocker.power * 0.35 : 0;
    // S45 (the Tidewall): a block that hands back a spell is worth that card — the 0/4 wall blocks whenever it is safe.
    const trigger = dies ? 0 : this.blockReturnValue(view, blocker.id);
    return (kills ? valueOf(attacker.id) : 0) - (dies ? valueOf(blocker.id) : 0) + prevented * w + lifelinkDenied - blockTax + deathBurn + trigger;
  }

  /** S45 (the Tidewall): what a blocker's "whenever this blocks, return target instant or sorcery card from your
   * graveyard to your hand" is worth now — the dearest spell in its controller's yard (mana value, a counter +0.5),
   * scaled as a card; 0 when the yard holds none or the blocker has no such trigger. Keyed on the SHAPE. */
  blockReturnValue(view: GameView, blockerId: string): number {
    const o = view.battlefield.find((b) => b.id === blockerId);
    const d = o ? this.def(o.cardId) : undefined;
    if (!o || !d) return 0;
    const returns = (d.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "BLOCKS" && a.effects.some((e) => e.type === "returnFromGraveyard" && e.to === "hand"));
    if (!returns) return 0;
    const spells = view.graveyardObjects[o.controller as 0 | 1].map((g) => this.def(g.cardId)).filter((x): x is CardDef => !!x && (x.types.includes("Instant") || x.types.includes("Sorcery")));
    if (spells.length === 0) return 0;
    return 1 + 0.3 * Math.max(...spells.map((x) => manaValue(parseManaCost(x.manaCost)) + (x.spellEffect?.some((e) => e.type === "counter") ? 0.5 : 0)));
  }

  /** Gain of double-blocking a menace attacker: kills if combined power is
   * lethal; the attacker's damage fells blockers lethal-in-order (worst case
   * for us: it takes the cheaper toughness first, maximizing kills). */
  private pairBlockGain(view: GameView, b1: SimObject, b2: SimObject, attacker: SimObject): number {
    const valueOf = (id: string) => {
      const o = view.battlefield.find((x) => x.id === id);
      return o ? objectValue(this.defs, o, this.C) : 1;
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
      (c) =>
        c.controller === blockingPlayer &&
        !c.tapped &&
        !c.cantBlock && // post-S43 (Chris): a Pacified creature is no wall — the Lions need not fear it
        !attackers.includes(c.id) &&
        // S23 (the Gallows Djinn's pin): never block with a creature whose own block tax is
        // lethal to its controller — the wall that kills you is no wall.
        this.selfTax(view, c.id, "BLOCKS") < view.life[blockingPlayer],
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
      // S16 (Chris's playtest, book of shame 11): at 5 life facing 3/3, 3/3, 1/1 the
      // value pass gave the only blocker to the 1/1 (a clean kill) and the old
      // lethal pass found no FREE blocker left — dead on board. Survival first:
      // when the planned blocks still let lethal through, re-plan from scratch —
      // biggest unblocked attackers get blockers until the damage through drops
      // below life (trample leaks power − toughness), THEN spend what is left
      // on value. If nothing can save us, the chumps stand anyway.
      const life = view.life[blockingPlayer];
      const toughnessOn = (a: SimObject) => blocks.filter((x) => x.attacker === a.id).reduce((n, x) => n + (creatures.find((c) => c.id === x.blocker)?.toughness ?? 0), 0);
      const damageThrough = () =>
        attackerObjs.reduce((n, a) => n + (blocked.has(a.id) ? (a.keywords.includes("trample") ? Math.max(0, a.power - toughnessOn(a)) : 0) : a.power), 0);
      if (damageThrough() >= life) {
        blocks.length = 0;
        blocked.clear();
        const pool = [...available];
        const take = (b: SimObject) => pool.splice(pool.indexOf(b), 1);
        for (const a of [...attackerObjs].sort((x, y) => y.power - x.power)) {
          if (damageThrough() < life) break;
          const cands = pool.filter((b) => canBlock(b, a));
          if (a.keywords.includes("menace")) {
            if (cands.length < 2) continue;
            const [b1, b2] = [...cands].sort((x, y) => this.blockGain(view, y, a) - this.blockGain(view, x, a));
            blocks.push({ blocker: b1!.id, attacker: a.id }, { blocker: b2!.id, attacker: a.id });
            blocked.add(a.id);
            take(b1!);
            take(b2!);
            continue;
          }
          if (cands.length === 0) continue;
          // Among the blockers that can take this attacker, the best exchange (kill/survive beats chump; cheapest chump otherwise).
          const b = [...cands].sort((x, y) => this.blockGain(view, y, a) - this.blockGain(view, x, a) || objectValue(this.defs, view.battlefield.find((o) => o.id === x.id)!, this.C) - objectValue(this.defs, view.battlefield.find((o) => o.id === y.id)!, this.C))[0]!;
          blocks.push({ blocker: b.id, attacker: a.id });
          blocked.add(a.id);
          take(b);
        }
        // Spare blockers: value blocks on what is still unblocked.
        for (const b of [...pool]) {
          let best: { attacker: string; gain: number } | null = null;
          for (const a of attackerObjs) {
            if (blocked.has(a.id) || a.keywords.includes("menace") || !canBlock(b, a)) continue;
            const gain = this.blockGain(view, b, a);
            if (best === null || gain > best.gain) best = { attacker: a.id, gain };
          }
          if (best && best.gain > 0) {
            blocks.push({ blocker: b.id, attacker: best.attacker });
            blocked.add(best.attacker);
            take(b);
          }
        }
      }
    }
    return blocks;
  }

  /** Test seam (book of shame): the block plan for the given attackers, as the blocker sees it. */
  planBlocks(view: GameView, attackers: string[]): { blocker: string; attacker: string }[] {
    return this.greedyBlocks(view, viewCreatures(view), attackers, view.you as PlayerId, true);
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

  /** Sacrifice the cheapest thing — where "cheap" is board value PLUS what the body is worth beyond its
   * stats (S18 director round, book of shame 15 — the Nighthawk AI fed a Blood Artist to the Aristocrat
   * over a Typhoid Rats): an observed-DIES engine (Blood Artist) is worth keeping; a body that would
   * RECEIVE the effect (the Aristocrat's Vampire counters) is worth keeping; a body whose own death pays
   * us back (Aven Fisher's draw) is cheap to sacrifice. Request.source carries the paying ability. */
  /** A9 (S20): the shock pay-2 heuristic — pay when the untapped land could matter THIS turn and life
   * is above the floor; book of shame 17: never pay at life ≤ 2 (the engine only asks at life ≥ 2, so
   * paying there is paying to 0). Floor baseline 4 per the dual doc. */
  entersChoice(view: GameView, request: ActionRequest): Action {
    const decline = request.actions.find((a) => a.type === "declineOptional") ?? request.actions[0]!;
    const accept = request.actions.find((a) => a.type === "acceptOptional");
    if (!accept) return decline;
    const PAY_FLOOR = 4;
    if (view.life[view.you] <= PAY_FLOOR) return decline;
    // Could the extra untapped source matter this turn? Rough: some nonland in hand costs exactly one
    // more than the producers already untapped (the new land closes the gap), and it is our main phase.
    const untapped = view.battlefield.filter((o) => o.controller === view.you && !o.tapped && this.def(o.cardId)?.types.includes("Land")).length;
    const enables = view.hand.some((c) => {
      const d = this.def(c.cardId);
      if (!d || d.types.includes("Land")) return false;
      const mv = this.mv(c.cardId);
      return mv > untapped && mv <= untapped + 1;
    });
    const ourMain = view.activePlayer === view.you && (view.step === "MAIN1" || view.step === "MAIN2");
    return enables && ourMain ? accept : decline;
  }

  /** S22 (A10 word 2): pay the bounce cost with a SPENT land — a tapped one first (its mana is
   * already used this turn), ties by cardId for determinism. */
  private bounceCostChoice(view: GameView, request: ActionRequest): Action {
    const candidates = request.actions.filter((a) => a.type === "returnToHand") as { type: "returnToHand"; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    const ranked = [...candidates].sort((a, b) => {
      const oa = view.battlefield.find((o) => o.id === a.objectId);
      const ob = view.battlefield.find((o) => o.id === b.objectId);
      const ta = oa?.tapped ? 0 : 1;
      const tb = ob?.tapped ? 0 : 1;
      if (ta !== tb) return ta - tb; // tapped first
      return (oa?.cardId ?? "").localeCompare(ob?.cardId ?? "");
    });
    return ranked[0]!;
  }

  /** S22 (A10 word 6): pay the tap cost with the least valuable untapped creature (Glare's fuel
   * preference — the boss doc wants vigilant attackers eventually; board value is the v1 proxy). */
  private tapCostChoice(view: GameView, request: ActionRequest): Action {
    const candidates = request.actions.filter((a) => a.type === "tapCreature") as { type: "tapCreature"; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    const ranked = [...candidates].sort((a, b) => this.boardValue(view, a.objectId) - this.boardValue(view, b.objectId));
    return ranked[0]!;
  }

  /** S22 (A10 word 4) — Purge discipline, the pin-17 family: take opponent creatures best-first,
   * never our own, and never a pick whose cumulative life cost drops us below the floor (4 — the
   * shock-clause floor; book of shame 17's "never pay at ≤ 2" is strictly inside it). */
  private variableTargetChoice(view: GameView, request: ActionRequest): Action {
    const done = request.actions.find((a) => a.type === "doneChoosingTargets") ?? request.actions[0]!;
    const picks = request.actions.filter((a) => a.type === "chooseVariableTarget") as Extract<Action, { type: "chooseVariableTarget" }>[];
    const PAY_FLOOR = 4;
    const srcDef = request.source ? this.def(request.source.cardId) : undefined;
    const lifePer = srcDef?.additionalCost?.perTarget ? (srcDef.additionalCost.life ?? 0) : 0;
    const projected = view.life[view.you] - lifePer * (this.variablePicks + 1);
    if (lifePer > 0 && projected < PAY_FLOOR) return done;
    const enemies = picks
      .map((a) => ({ a, o: a.target.kind === "object" ? view.battlefield.find((b) => a.target.kind === "object" && b.id === a.target.id) : undefined }))
      .filter((x) => x.o && x.o.controller !== view.you)
      .sort((x, y) => this.boardValue(view, y.o!.id) - this.boardValue(view, x.o!.id));
    const best = enemies[0];
    // A pick must be WORTH its life: board value at least half the life paid (v1; the S22b lord-sim measures).
    if (!best || (lifePer > 0 && this.boardValue(view, best.o!.id) < lifePer / 2)) return done;
    this.variablePicks += 1;
    return best.a;
  }

  /** S22 (A10 word 7) — the Stoker's fork from the paying side: pay the toll while healthy (denying
   * the draw), stop paying near the floor (the same floor family as the shock clause). */
  private unlessPayChoice(view: GameView, request: ActionRequest): Action {
    const accept = request.actions.find((a) => a.type === "acceptOptional");
    const decline = request.actions.find((a) => a.type === "declineOptional") ?? request.actions[0]!;
    if (!accept) return decline;
    const PAY_FLOOR = 4;
    const cost = 2; // v1: the only customer's cost; generalize when a second punisher arrives
    return view.life[view.you] - cost >= PAY_FLOOR ? accept : decline;
  }

  /** S26 r3 (Chris: the AI fired Scepter of Dominance the moment it untapped — the tapper discipline):
   * a {T}-cost ability whose whole payload is tapTarget is a DEFENSIVE tool first. On the opponent's
   * turn it may fire only before attackers are declared (their upkeep, draw, first main, beginning of
   * combat — tapping a declared attacker removes nothing from combat). On our own turn it may fire
   * only in MAIN1 or the beginning of combat AND only when we have an untapped creature to swing
   * with (a blocker tapped down cashes as an attack); otherwise hold it. Exposed for the book. */
  tapperGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !(ab.cost.tap || ab.cost.tapCreature)) return false;
    if (ab.effects.length === 0 || !ab.effects.every((e) => e.type === "tapTarget")) return false;
    const me = view.you;
    // Deploy playtest r1 (Chris: the Scepter pointed at lands): the tapper wants a CREATURE — with
    // no untapped enemy creature on the board there is nothing worth the mana; hold (book 33).
    if (!view.battlefield.some((o) => o.controller !== me && !o.tapped && o.power !== null)) return true;
    if (view.activePlayer !== me) return !["UPKEEP", "DRAW", "MAIN1", "COMBAT_BEGIN"].includes(view.step);
    // S27 r2 (Chris: Glare of Subdual tapped its own board down instead of attacking for lethal): a
    // tap-a-creature COST spends an attacker — on our own turn the Glare never fires.
    if (ab.cost.tapCreature) return true;
    if (!(view.step === "MAIN1" || view.step === "COMBAT_BEGIN")) return true;
    const swing = view.battlefield.some((o) => o.controller === me && this.canActNow(o) && !o.cantAttack && o.power !== null && o.id !== action.objectId); // S45: a creature cast this turn is no swing
    return !swing;
  }

  /** S30 (Part 3, Buried Alive — Corvane): a spell that searches creatures INTO the graveyard is a
   * reanimator's set-up — it fires only while the hand holds a card that returns a creature from the
   * graveyard to the battlefield (Zombify, Unearth, the Usher's ETB); the yard is no place to keep
   * angels otherwise. Exposed for the book (42). */
  buriedGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.spellEffect ?? []).some((e) => e.type === "searchLibrary" && e.to === "graveyard")) return false;
    // S55 (book 100): a combo list's setup is cast when its start is in hand, on the battlefield, or within reach
    if (this.profile.plan?.setup.some((x) => x.card === d.id)) return !this.planStartReachable(view);
    const reanimates = (x: CardDef | undefined): boolean =>
      !!x && ([...(x.spellEffect ?? []), ...(x.abilities ?? []).flatMap((a) => ("effects" in a ? a.effects : []))] as Effect[]).some((e) => e.type === "returnFromGraveyard" && e.to === "battlefield" && e.scope !== "self");
    // S46 (Entomb, the brief's "or on the board"): a reanimator of ours on the battlefield counts (the Reeve's activation).
    if (view.battlefield.some((o) => o.controller === view.you && reanimates(this.def(o.cardId)))) return false;
    return !view.hand.some((c) => c.objectId !== action.objectId && reanimates(this.def(c.cardId)));
  }

  // ---------- S55 (ADR-161): the combo archetype — piloting a plan, and playing against one ----------

  /** Where the plan stands, from this seat. `ready`: a start would loop now — the piece cast with another in a
   * graveyard or on our battlefield, or the piece returned with a second in our graveyard or one on our battlefield
   * (the legend rule supplies the death either way: books 99, 100). */
  planFacts(view: GameView): { yardMine: number; yardTheirs: number; onField: boolean; pieceInHand: boolean; reanimInHand: boolean; startOnField: boolean; setupInHand: boolean; setUp: boolean; byCast: boolean; byReanim: boolean; assembled: boolean } {
    const p = this.profile.plan!, me = view.you, opp = (1 - me) as 0 | 1;
    const inHand = (id: string) => view.hand.some((c) => c.cardId === id);
    const yardMine = view.graveyards[me].filter((c) => c === p.piece).length, yardTheirs = view.graveyards[opp].filter((c) => c === p.piece).length;
    const onField = view.battlefield.some((o) => o.controller === me && o.cardId === p.piece);
    const pieceInHand = inHand(p.piece);
    const reanimInHand = p.start.some((x) => x.card !== p.piece && inHand(x.card));
    const startOnField = p.start.some((x) => x.card !== p.piece && view.battlefield.some((o) => o.controller === me && o.cardId === x.card));
    const setupInHand = p.setup.some((x) => inHand(x.card));
    const byCast = pieceInHand && (yardMine + yardTheirs >= 1 || onField);
    const byReanim = (reanimInHand || startOnField) && (yardMine >= 2 || (yardMine >= 1 && onField));
    const setUp = yardMine >= 2 || (yardMine >= 1 && (onField || pieceInHand)) || (yardTheirs >= 1 && pieceInHand) || (onField && pieceInHand);
    return { yardMine, yardTheirs, onField, pieceInHand, reanimInHand, startOnField, setupInHand, setUp, byCast, byReanim, assembled: byCast || byReanim };
  }
  /** The actions on offer at the priority decision being scored (null outside one: the book's direct calls). */
  private offered: Action[] | null = null;
  /** The engine offers this card's cast now — its cost, colours and timing all met. Outside a decision: by mana count. */
  private castOffered(view: GameView, cardId: string, mana: number): boolean {
    if (!this.offered) return this.mv(cardId) <= mana;
    return this.offered.some((a) => a.type === "castSpell" && view.hand.find((c) => c.objectId === a.objectId)?.cardId === cardId);
  }
  /** Could `cardId` be paid for with what we can make now plus `fuel` (colour symbols, e.g. "BBB"; "*" any colour)
   * after spending `spend` mana on the fuel itself — by COLOUR, not only by count (the Usher wants white and red: a
   * Ritual's black does not make them). Each untapped producer gives one mana of a colour it makes; pips are matched
   * scarcest first. */
  private payableWith(view: GameView, cardId: string, fuel: string, spend: number): boolean {
    const me = view.you, d = this.def(cardId); if (!d) return false;
    const cost = parseManaCost(d.manaCost);
    const all: string[][] = [];
    const sources = all;
    for (const o of view.battlefield) {
      if (o.controller !== me || o.tapped) continue;
      const od = this.def(o.cardId); if (!od) continue;
      if (od.types.includes("Creature") && o.summoningSick) continue;
      const cols = new Set<string>();
      for (const a of od.abilities ?? []) if (a.kind === "activated" && a.cost.tap && !a.cost.sacrifice) for (const e of a.effects) if (e.type === "addMana") { if (e.choice) "WUBRG".split("").forEach((c) => cols.add(c)); else for (const m of (e.mana ?? "").matchAll(/\{([WUBRGC])\}/g)) cols.add(m[1]!); }
      if (cols.size) sources.push([...cols]);
    }
    for (const [c, n] of Object.entries(view.manaPool)) for (let i = 0; i < n; i++) sources.push([c]);
    const pays = (left: string[][]): boolean => {
      const src = [...left, ...[...fuel].map((ch) => (ch === "*" ? "WUBRG".split("") : [ch]))];
      const pips = (Object.entries(cost.colored) as [string, number][]).flatMap(([c, n]) => Array<string>(n).fill(c));
      pips.sort((a, b) => src.filter((x) => x.includes(a)).length - src.filter((x) => x.includes(b)).length);
      for (const c of pips) {
        const cands = src.map((x, i) => ({ x, i })).filter(({ x }) => x.includes(c)).sort((a, b) => a.x.length - b.x.length);
        if (!cands.length) return false;
        src.splice(cands[0]!.i, 1);
      }
      return src.length >= cost.generic;
    };
    // the fuel's own cost: any one source may pay it — the one whose loss still leaves the card payable (a Ritual
    // paid from the Blood Crypt, not from the only white source)
    if (spend === 0) return pays(all);
    if (spend > 1) { const rest = [...all].sort((a, b) => a.length - b.length).slice(spend); return all.length >= spend && pays(rest); }
    return all.some((_, i) => pays(all.filter((__, j) => j !== i)));
  }
  /** Mana we could make now: each untapped mana producer as one, and what floats. */
  private manaNow(view: GameView): number {
    const me = view.you;
    return view.battlefield.filter((o) => o.controller === me && !o.tapped && (this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && !a.cost.sacrifice && a.effects.some((e) => e.type === "addMana"))).filter((o) => !o.summoningSick || !this.def(o.cardId)?.types.includes("Creature")).length
      + Object.values(view.manaPool).reduce((a, b) => a + b, 0);
  }
  /** Book 100: the plan's start is in hand or on the battlefield — or within two draws by the deck's own count (the
   * starts and the dig cards still in the library, of the library's size: one in four or better). A deck whose list
   * the caller did not give is taken to have it within reach. Exposed for the book. */
  planStartReachable(view: GameView): boolean {
    const p = this.profile.plan!, me = view.you;
    if (p.start.some((x) => view.hand.some((c) => c.cardId === x.card) || (x.card !== p.piece && view.battlefield.some((o) => o.controller === me && o.cardId === x.card)))) return true;
    if (p.dig.some((id) => view.battlefield.some((o) => o.controller === me && o.cardId === id) || view.hand.some((c) => c.cardId === id))) return true;
    const deck = this.profile.decklist;
    if (!deck) return true;
    const seen = (id: string) => view.hand.filter((c) => c.cardId === id).length + view.battlefield.filter((o) => o.controller === me && o.cardId === id).length + view.graveyards[me].filter((c) => c === id).length;
    const reach = [...new Set([...p.start.map((x) => x.card), ...p.dig])];
    const left = reach.reduce((n, id) => n + Math.max(0, deck.reduce((k, e) => k + (e.cardId === id ? e.count : 0), 0) - seen(id)), 0);
    const lib = Math.max(2, view.librarySizes[me]);
    const miss = ((lib - left) / lib) * ((lib - 1 - left) / (lib - 1));
    return 1 - Math.max(0, miss) >= 0.25;
  }
  /** What the plan wants cast next, by cost: the setup while it is not set up, the start once a start would loop, the
   * dig cards until then. */
  private planWants(view: GameView): { cardId: string; mv: number }[] {
    const p = this.profile.plan!, f = this.planFacts(view), out: { cardId: string; mv: number }[] = [];
    const hand = (id: string) => view.hand.some((c) => c.cardId === id);
    if (!f.setUp || f.yardMine < 2) for (const x of p.setup) if (hand(x.card) && f.yardMine < 3 && this.planStartReachable(view)) out.push({ cardId: x.card, mv: this.mv(x.card) });
    if (f.byCast) out.push({ cardId: p.piece, mv: this.mv(p.piece) });
    if (f.byReanim) for (const x of p.start) if (x.card !== p.piece && hand(x.card)) out.push({ cardId: x.card, mv: this.mv(x.card) });
    if (!f.assembled) for (const id of p.dig) if (hand(id) && !(this.def(id)?.supertypes?.includes("Legendary") && view.battlefield.some((o) => o.controller === view.you && o.cardId === id))) out.push({ cardId: id, mv: this.mv(id) });
    return out;
  }
  /**
   * Books 100–103: a combo list plays its plan first.
   *  - 101 (the start's target): a reanimation that is the plan's start is aimed at the plan's piece — never spent on a
   *    fair body while the plan is live (a piece in our graveyard, or the setup in hand); a fair return is left for a
   *    deck out of pieces, or at ten life or less with neither.
   *  - 103 (fuel): a Ritual or the Lotus is spent only when it makes a wanted plan card castable that was not — never
   *    into a Nighthawk, and never when the card was castable without it.
   *  - 102 (plan before fair plays): a card outside the plan is not cast while a wanted plan card could be cast instead.
   *  - 100: a second setup is not cast into a graveyard that already holds three of the piece.
   * Exposed for the book.
   */
  planGated(view: GameView, action: Action): boolean {
    const p = this.profile.plan;
    if (!p || (action.type !== "castSpell" && action.type !== "activateAbility")) return false;
    const me = view.you, f = this.planFacts(view);
    const src = action.type === "castSpell" ? view.hand.find((c) => c.objectId === action.objectId)?.cardId : view.battlefield.find((o) => o.id === action.objectId)?.cardId;
    if (!src) return false;
    const d = this.def(src); if (!d) return false;
    const wants = this.planWants(view), now = this.manaNow(view);
    const tId = ((action as { targets?: ResolvedTarget[] }).targets ?? []).find((t) => t.kind === "object") as { id: string } | undefined;
    // 101: the start's target
    const startRole = p.start.find((x) => x.card === src && x.card !== p.piece);
    if (startRole && tId) {
      const g = [...view.graveyardObjects[0], ...view.graveyardObjects[1]].find((o) => o.objectId === tId.id);
      if (g && g.cardId !== startRole.on) { const live = f.yardMine >= 1 || f.setupInHand; if (live || view.life[me] > 10) return true; }
    }
    // 100: enough is buried
    if (action.type === "castSpell" && p.setup.some((x) => x.card === src) && f.yardMine >= 3) return true;
    // 103: fuel
    const isFuelSpell = action.type === "castSpell" && p.fuel.includes(src) && (d.spellEffect ?? []).some((e) => e.type === "addMana");
    const isFuelSac = action.type === "activateAbility" && p.fuel.includes(src) && (() => { const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex); return !!ab && ab.kind === "activated" && !!ab.cost.sacrifice && ab.effects.some((e) => e.type === "addMana"); })();
    if (isFuelSpell || isFuelSac) {
      // the plan's cards are cast at sorcery speed: fuel on the opponent's turn, or with something on the stack, floats away
      if (view.activePlayer !== me || (view.step !== "MAIN1" && view.step !== "MAIN2") || view.stack.length > 0) return true;
      // spent only when it makes a wanted plan card castable that is not castable now — by colour as well as count
      const [yieldMana, spend] = isFuelSpell ? ["BBB", this.mv(src)] : ["***", 0];
      return !wants.some((w) => !this.castOffered(view, w.cardId, now) && this.payableWith(view, w.cardId, yieldMana, spend));
    }
    // 102: plan before fair plays — a nonland card outside the plan waits while a wanted plan card is castable
    if (action.type === "castSpell" && !d.types.includes("Land")) {
      const inPlan = src === p.piece || p.setup.some((x) => x.card === src) || p.start.some((x) => x.card === src) || p.dig.includes(src) || p.fuel.includes(src);
      if (!inPlan && view.activePlayer === me && wants.some((w) => w.cardId !== src && this.castOffered(view, w.cardId, now))) return true;
    }
    return false;
  }
  /** Books 100, 102: the plan's own plays are worth more than their board — the setup (a card that only fills a
   * graveyard) and the dig while the plan is not assembled. */
  planBonus(view: GameView, action: Action): number {
    const p = this.profile.plan;
    if (!p || action.type !== "castSpell") return 0;
    const src = view.hand.find((c) => c.objectId === action.objectId)?.cardId; if (!src) return 0;
    const f = this.planFacts(view);
    if (p.setup.some((x) => x.card === src)) return f.yardMine < 2 ? 8 : 0;
    if (p.dig.includes(src) && !f.assembled) return 4; // (the piece cast into its loop: loopCastBonus, for any deck)
    return 0;
  }
  /** Books 100–101: the setup buries the plan's cards up to their counts; a tutor fetches the missing half — the setup
   * while nothing is set up, else a start, else the piece, else fuel when the plan is in hand and mana is short. */
  private planSearchPick(view: GameView, request: ActionRequest, picks: Extract<Action, { type: "searchPick" }>[], cardOf: Map<string, string>, toGraveyard: boolean): Action | null {
    const p = this.profile.plan; if (!p) return null;
    const me = view.you, f = this.planFacts(view);
    const find = (id: string) => picks.find((a) => cardOf.get(a.objectId) === id);
    if (toGraveyard) {
      const setup = p.setup.find((x) => x.card === request.source?.cardId) ?? p.setup[0];
      for (const b of setup?.bury ?? []) if (view.graveyards[me].filter((c) => c === b.card).length < b.count) { const a = find(b.card); if (a) return a; }
      return null;
    }
    if (!(request.source?.effects ?? []).some((e) => e.type === "searchLibrary" && e.to === "hand")) return null;
    const order: string[] = [];
    if (!f.setUp && !f.setupInHand) order.push(...p.setup.map((x) => x.card));
    if (!f.reanimInHand && !f.pieceInHand) order.push(...p.start.filter((x) => x.card !== p.piece && !this.def(x.card)?.types.includes("Land")).map((x) => x.card), p.piece);
    order.push(...p.setup.map((x) => x.card), ...p.fuel.filter((id) => (this.def(id)?.spellEffect ?? []).some((e) => e.type === "addMana") || this.mv(id) === 0));
    for (const id of order) { const a = find(id); if (a) return a; }
    return null;
  }

  /** The cards that return a creature card from a graveyard, or put the opponent's dead to work, are what graveyard
   * exile answers; this is the opposing stack's item aimed at a graveyard card, if any. */
  private graveyardAimed(view: GameView): { item: GameView["stack"][number]; targetId: string } | null {
    const opp = (1 - view.you) as 0 | 1;
    for (let i = view.stack.length - 1; i >= 0; i--) {
      const it = view.stack[i]!;
      if (it.controller !== opp) continue;
      for (const t of it.targets ?? []) if (t.kind === "object" && [...view.graveyardObjects[0], ...view.graveyardObjects[1]].some((g) => g.objectId === t.id)) return { item: it, targetId: t.id };
    }
    return null;
  }
  private isGraveyardExile(view: GameView, action: Action): { whole: boolean } | null {
    if (action.type !== "activateAbility") return null;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated") return null;
    if (ab.effects.some((e) => e.type === "exileGraveyard")) return { whole: true };
    if (ab.effects.some((e) => e.type === "exile") && (ab.targets ?? []).some((t) => t.zone === "graveyard")) return { whole: false };
    return null;
  }
  /**
   * Book 105: graveyard exile is a card spent once, so it is held for the moment it answers something.
   *  - A whole-graveyard exile (Tormod's Crypt) is aimed at the OPPONENT, and used when an opposing spell, ability or
   *    trigger on the stack is aimed at a card in that graveyard, or — against a deck with a plan — as soon as that
   *    graveyard holds the plan's piece (the setup has resolved; the start may come any turn, uncounterably).
   *  - A targeted exile (Faerie Macabre) is used ONLY in response to an opposing stack item aimed at a graveyard card,
   *    and must exile that card (its second target is the best other answer: another of the plan's pieces first).
   * Faerie Macabre is not cast as a 2/2 while the opponent's plan stands (it is held for the trigger).
   * Exposed for the book.
   */
  graveyardHateGated(view: GameView, action: Action): boolean {
    const me = view.you, opp = (1 - me) as 0 | 1, op = this.profile.opponentPlan;
    if (action.type === "castSpell") {
      const d = this.def(view.hand.find((c) => c.objectId === action.objectId)?.cardId ?? "");
      const holds = !!d && (d.abilities ?? []).some((a) => a.kind === "activated" && a.zone === "hand" && a.effects.some((e) => e.type === "exile") && (a.targets ?? []).some((t) => t.zone === "graveyard"));
      return holds && !!op && op.answers.graveyardExile;
    }
    const kind = this.isGraveyardExile(view, action); if (!kind) return false;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    const aimed = this.graveyardAimed(view);
    if (kind.whole) {
      if (!targets.some((t) => t.kind === "player" && t.player === opp)) return true;
      if (aimed && view.graveyardObjects[opp].some((g) => g.objectId === aimed.targetId)) return false;
      return !(op && view.graveyards[opp].includes(op.piece));
    }
    if (!aimed) return true;
    if (!targets.some((t) => t.kind === "object" && t.id === aimed.targetId)) return true;
    // the second target: the best other card to deny — the plan's piece first, else the dearest creature card of theirs
    const others = [...view.graveyardObjects[opp]].filter((g) => g.objectId !== aimed.targetId);
    const worth = (g: { cardId: string }) => (op && g.cardId === op.piece ? 100 : 0) + reanimationWorth(this.def(g.cardId));
    const best = others.sort((a, b) => worth(b) - worth(a) || a.objectId.localeCompare(b.objectId))[0];
    const second = targets.find((t) => t.kind === "object" && t.id !== aimed.targetId) as { id: string } | undefined;
    if (best && worth(best) > 0) return second?.id !== best.objectId;
    return !!second;
  }
  /**
   * Books 104–106: playing against a plan, read from the opponent's list like the list itself.
   *  - 104 (the counter): a counterspell aimed at the plan's setup or start is worth the game; at anything else, a
   *    little less than usual while the plan stands (the counter is being held).
   *  - 105: graveyard exile that passes its gate is worth what it stops.
   *  - 106 (discard): against a plan, discard is worth most before the turn the plan names.
   */
  againstPlanBonus(view: GameView, action: Action): number {
    const me = view.you, opp = (1 - me) as 0 | 1, op = this.profile.opponentPlan;
    if (this.isGraveyardExile(view, action)) return this.graveyardAimed(view) ? LOOP_WORTH : op ? 6 : 2;
    if (!op || action.type !== "castSpell") return 0;
    const effects = this.actionEffects(view, action) ?? [];
    if (effects.some((e) => e.type === "counter")) {
      const t = ((action as { targets?: ResolvedTarget[] }).targets ?? []).find((x) => x.kind === "stackItem") as { id: string } | undefined;
      const it = t ? view.stack.find((x) => x.id === t.id) : undefined;
      if (!it || it.controller !== opp) return 0;
      return op.answers.counter.includes(it.cardId) ? 30 : -2;
    }
    if (effects.some((e) => e.type === "discard") && ((action as { targets?: ResolvedTarget[] }).targets ?? []).some((t) => t.kind === "player" && t.player === opp)) {
      const theirTurns = Math.ceil(view.turn / 2);
      return theirTurns < op.answers.discardBeforeTurn ? 3 : 0;
    }
    return 0;
  }

  /** Post-S54 (book 98; Chris — a Reassembling Skeleton activated three times in one upkeep): a graveyard card's
   * ability that moves the card itself (its own return) resolves ONCE — the card is still in the graveyard while the
   * first activation waits on the stack, so the ability is offered again, and every further activation pays its cost
   * and finds nothing. Refused while one of ours from the same card is on the stack. (An ability that exiles its card
   * as a COST — Mother Bear — is never offered twice; one that leaves its card where it is may be repeated.) */
  yardReturnPending(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    if (!view.graveyardObjects[view.you].some((c) => c.objectId === action.objectId)) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.effects.some((e) => e.type === "returnFromGraveyard" && e.scope === "self")) return false;
    return view.stack.some((s) => s.kind === "ability" && s.controller === view.you && s.sourceId === action.objectId);
  }

  /** S30 (Part 3, Reassembling Skeleton): the graveyard return is a MANA question — on our own turn it
   * waits while a spell in hand could use the mana (the body is worth less than the play it would
   * cost), unless we are behind on creatures and need the blocker; on the opponent's turn it is a fine
   * end-of-turn buy. Exposed for the book (43). */
  skeletonGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const me = view.you;
    const gy = view.graveyardObjects[me].find((c) => c.objectId === action.objectId);
    if (!gy) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || ab.zone !== "graveyard" || !ab.effects.some((e) => e.type === "returnFromGraveyard" && e.scope === "self" && e.to === "battlefield")) return false;
    if (view.activePlayer !== me) return false;
    const mine = view.battlefield.filter((o) => o.controller === me && o.power !== null).length;
    const theirs = view.battlefield.filter((o) => o.controller !== me && o.power !== null && !o.keywords.includes("defender")).length;
    if (mine < theirs) return false; // behind: the blocker comes back
    const available = view.battlefield.filter((o) => o.controller === me && this.canActNow(o) && (this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && a.effects.every((e) => e.type === "addMana" && !e.choice))).length + Object.values(view.manaPool).reduce((a, b) => a + b, 0);
    const abilityCost = ab.cost.mana ? manaValue(parseManaCost(ab.cost.mana)) : 0;
    const wantsMana = view.hand.some((c) => { const d = this.def(c.cardId); if (!d || d.types.includes("Land")) return false; const mv = manaValue(parseManaCost(d.manaCost)); return mv <= available && mv > available - abilityCost; });
    return wantsMana;
  }

  /** S29 (Part 4, the Altar of Dementia): a sacrifice-outlet ability whose payload reads the sacrificed
   * creature's power fires only (a) for LETHAL mill — our strongest creature's power reaches the
   * opponent's library — or (b) to cash a creature that is about to die anyway: blocked or blocking
   * into lethal damage in the current combat, or targeted by an opposing spell on the stack; and
   * never our last untapped blocker while behind on board. Exposed for the book (37). */
  altarGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.sacrifice || ab.cost.sacrifice.predicate === "self") return false;
    if (!JSON.stringify(ab.effects).includes('"sacrificedPower"')) return false;
    if (!ab.effects.some((e) => e.type === "mill")) return false; // S40: the Reaper's harvest reads the same ref — its own gate (floodSinkGated)
    const me = view.you, opp = (1 - me) as 0 | 1;
    const mine = view.battlefield.filter((o) => o.controller === me && o.power !== null);
    if (mine.length === 0) return true;
    const best = Math.max(...mine.map((o) => o.power ?? 0));
    if (best >= (view.librarySizes[opp] ?? 99) && best > 0) return false; // lethal by library
    // Post-S43 (Chris: a creature about to die to removal was never cashed): a DOOMED creature is fed whatever the
    // board — the chooser takes the doomed one first, so the "last blocker" it would have been is already lost.
    return !mine.some((o) => this.creatureIsDoomed(view, o.id));
  }
  /** A creature of ours that is about to die: in combat against lethal power, or the target of an
   * opposing harmful spell on the stack. */
  private creatureIsDoomed(view: GameView, id: string): boolean {
    const o = view.battlefield.find((b) => b.id === id);
    if (!o || o.toughness === null) return false;
    const powerOf = (x: string) => view.battlefield.find((b) => b.id === x)?.power ?? 0;
    const combat = view.combat;
    if (combat) {
      const asAttacker = combat.attackers.includes(id) ? combat.blocks.filter((b) => b.attacker === id).reduce((n, b) => n + powerOf(b.blocker), 0) : 0;
      const asBlocker = combat.blocks.filter((b) => b.blocker === id).reduce((n, b) => n + powerOf(b.attacker), 0);
      if (Math.max(asAttacker, asBlocker) + o.damage >= o.toughness) return true;
    }
    return view.stack.some((it) => {
      if (it.controller === view.you) return false;
      if ((((it as { targets?: { kind: string; id?: string }[] }).targets) ?? []).some((t) => t.kind === "object" && t.id === id)) return true;
      // Post-S43: a SWEEPER on the stack dooms it too — damage to all creatures reaching its toughness, or destroy-all.
      const effects = this.def(it.cardId)?.spellEffect ?? [];
      return effects.some((e) => {
        const eff = e as { type: string; scope?: string; amount?: number };
        if (eff.scope !== "allCreatures") return false;
        if (eff.type === "destroyAll") return !o.keywords.includes("indestructible");
        if (eff.type === "damageAll") return (eff.amount ?? 0) + o.damage >= (o.toughness ?? 99);
        return false;
      });
    });
  }

  /** S28 (ADR-098, Brainstorm): an INSTANT whose whole payload is draw / put-back changes no board —
   * it is cast at the opponent's end step (the hand is then known for our turn) or in response to a
   * spell on the stack; never main-phase on our own turn, never in their combat. Exposed for the book. */
  cantripTimingGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !d.types.includes("Instant") || !d.spellEffect || d.spellEffect.length === 0) return false;
    if (!d.spellEffect.every((e) => e.type === "draw" || e.type === "putOnTop")) return false;
    // S34 (the second S28 erratum; S33 Part 4 measured 56–92% of own-turn Brainstorms cast over the caster's
    // OWN spell): "in response" means an OPPONENT's item on the stack — our own Crab on the stack is not a window.
    if (view.stack.some((it) => it.controller !== view.you)) return false;
    // S32: the engine's step is "END" (S28 wrote "END_STEP" here, so Brainstorm's end-step window
    // never opened live — only the in-response path did; caught by the Escort's pin).
    return !(view.activePlayer !== view.you && view.step === "END");
  }

  // ---------- S36 (ADR-121): the four cards' policies ----------

  /** The land drop in hand of a card whose ability returns itself at cleanup (the Glaciers). */
  private isGlaciers(cardId: string): boolean {
    return (this.def(cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.effects.some((e) => e.type === "returnSelfAtCleanup"));
  }
  /** Book 52: the Glaciers is played as the land drop only (a) as the only land in hand, (b) with a landfall
   * permanent on our board, or (c) when lands in play already meet the hand's top mana value (the drop is spare).
   * Otherwise the real land is played (the Glaciers' drop is gated); and when a reason holds, the other lands
   * yield to it. Exposed for the book. */
  glaciersDropGated(view: GameView, action: Action): boolean {
    if (action.type !== "playLand") return false;
    const me = view.you;
    const hand = view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land"));
    const glaciers = hand.filter((c) => this.isGlaciers(c.cardId));
    if (glaciers.length === 0) return false;
    const thisCard = view.hand.find((c) => c.objectId === action.objectId);
    const thisIsGlaciers = !!thisCard && this.isGlaciers(thisCard.cardId);
    const otherLands = hand.length - glaciers.length;
    if (otherLands === 0) return false; // the only land: play it
    const landfall = view.battlefield.some((o) => o.controller === me && (this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "LAND_ENTERS_UNDER_YOUR_CONTROL"));
    const landsInPlay = view.battlefield.filter((o) => o.controller === me && (this.def(o.cardId)?.types ?? []).includes("Land")).length;
    const topMv = Math.max(0, ...view.hand.filter((c) => !this.def(c.cardId)?.types.includes("Land")).map((c) => this.mv(c.cardId)));
    const reason = landfall || landsInPlay >= topMv;
    return reason ? !thisIsGlaciers : thisIsGlaciers;
  }
  /** Book 52: the Glaciers' fetch at the opponent's end step whenever it is untapped with the mana spare, or on
   * our own turn when the hand needs a colour our lands do not make. Exposed for the book. */
  glaciersActivationGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const o = view.battlefield.find((b) => b.id === action.objectId);
    if (!o || !this.isGlaciers(o.cardId)) return false;
    if (view.activePlayer !== view.you) return view.step !== "END";
    return !this.colourLacking(view);
  }
  /** A colour the hand's costs want that no land or mana rock we control produces. */
  private colourLacking(view: GameView): boolean {
    const me = view.you;
    const produced = new Set<string>();
    for (const o of view.battlefield) {
      if (o.controller !== me) continue;
      for (const a of this.def(o.cardId)?.abilities ?? []) if (a.kind === "activated") for (const e of a.effects) if (e.type === "addMana" && "mana" in e && typeof e.mana === "string") for (const c of e.mana.match(/[WUBRG]/g) ?? []) produced.add(c);
    }
    for (const c of view.hand) for (const sym of (this.def(c.cardId)?.manaCost ?? "").match(/[WUBRG]/g) ?? []) if (!produced.has(sym)) return true;
    return false;
  }
  /** The Library's draw only at the opponent's end step (the hand is at seven by construction). */
  libraryDrawGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.activateOnlyIf) return false;
    return !(view.activePlayer !== view.you && view.step === "END");
  }
  /** The Collector at the opponent's end step with the mana spare; at one card in hand, every turn (its own too). */
  collectorGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.effects.some((e) => e.type === "revealRandomIfNamed")) return false;
    if (view.hand.length === 0) return true;
    if (view.hand.length === 1) return false;
    return !(view.activePlayer !== view.you && view.step === "END");
  }
  /** Book 53: plainscycling when the hand holds a reanimator, or lands in play + hand < 5 by turn three; a dead
   * card cycles by the S17 rule regardless. Exposed for the book. */
  plainscyclingGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility" || !this.isCycling(view, action)) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.effects.some((e) => e.type === "searchLibrary")) return false;
    if (this.cardIsDead(view, action)) return false;
    const me = view.you;
    // S37: the reanimator must be able to RETURN the cycled card — a target ceiling (Unearth ≤ 3) below the
    // Angel's own mana value does not count (Zombify, any, does).
    const own = this.def(view.hand.find((c) => c.objectId === action.objectId)?.cardId ?? "");
    const ownMv = own ? manaValue(parseManaCost(own.manaCost)) : 0;
    const reanimator = view.hand.some((c) => {
      const d = this.def(c.cardId);
      if (!d) return false;
      return (d.spellEffect ?? []).some((e) => {
        if (e.type !== "returnFromGraveyard" || e.to !== "battlefield") return false;
        const ceiling = typeof e.target === "number" ? d.targets?.[e.target]?.manaValueAtMost : undefined;
        return ceiling === undefined || ceiling >= ownMv;
      });
    });
    const lands = view.battlefield.filter((o) => o.controller === me && (this.def(o.cardId)?.types ?? []).includes("Land")).length + view.hand.filter((c) => this.def(c.cardId)?.types.includes("Land")).length;
    return !(reanimator || (view.turn <= 3 && lands < 5));
  }
  /** The Collector's name: the most-duplicated card in hand (ties to the first). Exposed for the book. */
  nameChoice(view: GameView, request: ActionRequest): Action {
    const counts = new Map<string, number>();
    for (const c of view.hand) counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1);
    let best: Action | null = null, bestN = -1;
    for (const a of request.actions) {
      if (a.type !== "nameCard") continue;
      const n = counts.get(a.cardId) ?? 0;
      if (n > bestN) { best = a; bestN = n; }
    }
    return best ?? request.actions[0]!;
  }

  /** S32 (ADR-109, Plumecreed Escort — book 49): a FLASH creature is an instant, not a creature spell:
   * cast at the opponent's end step by default, in response to anything on the stack (the save rides
   * the view-sim credit), and on our own turn only when nothing else in hand could use the mana now.
   * Never on the opponent's turn outside the end step with an empty stack. Exposed for the book. */
  flashTimingGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !d.types.includes("Creature") || !(d.keywords ?? []).includes("flash")) return false;
    if (view.stack.some((it) => it.controller !== view.you)) return false; // in response to THEIRS: fine (S34, as the cantrip gate)
    if (view.activePlayer !== view.you) return view.step !== "END";
    const me = view.you;
    const untapped = view.battlefield.filter((o) => o.controller === me && !o.tapped && this.def(o.cardId)?.types.includes("Land")).length;
    return view.hand.some((c) => c.objectId !== action.objectId && !this.def(c.cardId)?.types.includes("Land") && !this.def(c.cardId)?.manaCost.includes("X") && this.mv(c.cardId) <= untapped);
  }

  /** Post-S43 (Chris, the Cinquefont fight: the Ruby Tyrant cast, then Mystic Snake in response — its mandatory
   * trigger's only target was our own Tyrant). A permanent whose enter-the-battlefield trigger counters a spell is
   * never cast while no OPPONENT's spell is on the stack: the trigger must take a target, and ours would be the one.
   * Keyed on the shape (a mandatory ETB counter), not the card. Exposed for the book. */
  selfCounterGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    const etbCounter = (d?.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "ENTERS_BATTLEFIELD" && a.condition?.source === "self" && !a.optional && a.effects.some((e) => e.type === "counter"));
    if (!etbCounter) return false;
    return !view.stack.some((it) => it.kind === "spell" && it.controller !== view.you);
  }

  /** S45 (the Guttersnipe — 69 of 90 spells cast while it waited in hand): a creature whose trigger pays on OUR
   * instant/sorcery casts (the shape: SPELL_CAST, controller you, type Instant/Sorcery — the Guttersnipe, Young
   * Pyromancer) makes a non-urgent spell worth holding until it is down. Held only while the payoff can land by next
   * turn (its mana value ≤ our lands + 1), our life is above 6, and the spell is not removal aimed at a creature or
   * lethal. Exposed for the book. */
  spellPayoffHoldGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const me = view.you;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.types.includes("Instant") || d.types.includes("Sorcery"))) return false;
    const isPayoff = (cd: CardDef | undefined) => !!cd && (cd.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "SPELL_CAST" && a.condition?.controller === "you" && (a.condition?.type ?? []).some((t) => t === "Instant" || t === "Sorcery"));
    if (view.battlefield.some((o) => o.controller === me && isPayoff(this.def(o.cardId)))) return false; // it is out: cast away
    const lands = view.battlefield.filter((o) => o.controller === me && this.def(o.cardId)?.types.includes("Land")).length;
    const waiting = view.hand.some((c) => c.objectId !== action.objectId && isPayoff(this.def(c.cardId)) && this.mv(c.cardId) <= lands + 1);
    if (!waiting || view.life[me] <= 6) return false;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    if (targets.some((t) => t.kind === "object" && view.battlefield.some((o) => o.id === t.id && o.controller !== me))) return false; // removal is never held
    if (targets.some((t) => t.kind === "stackItem")) return false; // a counter answers now or never
    const faceDamage = (d.spellEffect ?? []).reduce((n, e) => n + (e.type === "damage" && typeof e.amount === "number" ? e.amount : 0), 0);
    const opp = (1 - me) as 0 | 1;
    if (faceDamage > 0 && targets.some((t) => t.kind === "player" && t.player === opp) && faceDamage >= view.life[opp]) return false; // lethal now
    return true;
  }

  /** S50 (book 89, Flametongue Kavu): a creature whose own ENTERS trigger is a mandatory harmful effect at target
   * creature (the shape: a self ENTERS_BATTLEFIELD trigger, not optional, with a creature target and damage / destroy
   * / exile on it). Returns the trigger's read of this board, or null for any other card. */
  private entersHarm(view: GameView, action: Action): { kills: number; bestKill: number; theirs: number; safeOurs: boolean; selfLegal: boolean; ours: number } | null {
    if (action.type !== "castSpell") return null;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d?.types.includes("Creature")) return null;
    const ab = (d.abilities ?? []).find((a) => a.kind === "triggered" && a.event === "ENTERS_BATTLEFIELD" && a.condition?.source === "self" && a.optional !== true && (a.targets ?? []).length === 1 && a.effects.some((e) => (e.type === "damage" || e.type === "destroy" || e.type === "exile") && "target" in e && e.target === 0));
    if (!ab || ab.kind !== "triggered") return null;
    const pred = String((ab.targets![0] as { predicate?: string }).predicate ?? "");
    if (!/creature$/i.test(pred)) return null;
    const dmg = ab.effects.reduce((n, e) => n + (e.type === "damage" && typeof e.amount === "number" ? e.amount : 0), 0);
    const hard = ab.effects.some((e) => e.type === "destroy" || e.type === "exile");
    const dies = (o: { toughness: number | null; damage: number }) => hard || (o.toughness !== null && dmg >= o.toughness - o.damage);
    const creatures = view.battlefield.filter((o) => o.power !== null);
    const theirs = creatures.filter((o) => o.controller !== view.you), ours = creatures.filter((o) => o.controller === view.you);
    const killed = theirs.filter(dies);
    return {
      kills: killed.length, bestKill: Math.max(0, ...killed.map((o) => objectValue(this.defs, o, this.C))), theirs: theirs.length, ours: ours.length,
      safeOurs: ours.some((o) => !dies(o)),
      selfLegal: pred === "creature" && (hard || dmg >= (d.toughness ?? 0)), // the entering creature is itself a legal target, and would die
    };
  }
  /** S50 (book 89): with no creature across the table the mandatory trigger turns on us — on our own creature, or on
   * the entering one (CR 603.3d: a target is chosen if one can be). The cast waits unless one of ours would survive
   * it. With creatures across the table it is cast whatever it can kill — the body is the point (the brief). Exposed. */
  entersHarmGated(view: GameView, action: Action): boolean {
    const h = this.entersHarm(view, action);
    if (!h || h.theirs > 0) return false;
    return (h.selfLegal || h.ours > 0) && !h.safeOurs;
  }
  /** S50 (book 89): the cast is worth more when its trigger kills — the predictor does not resolve an enters trigger,
   * so the best kill's value is credited here (half: the trigger can still be answered). Exposed. */
  entersKillBonus(view: GameView, action: Action): number {
    const h = this.entersHarm(view, action);
    return h && h.kills > 0 ? 0.5 * h.bestKill : 0;
  }

  /** S50 (book 90, Furnace Whelp): a repeatable SELF-PUMP (the shape: an activation paid in mana alone whose every
   * effect is +N/+0-or-more on its own source until end of turn) is not a mana sink — it scored +0.2 at any moment
   * and drained the lands in the first main phase (the Warhammer's churn, book 86, in another coat). It is a play
   * only in combat, after blocks: on an UNBLOCKED attacker (each activation is damage), or in a fight it then wins
   * and survives — the pump lifting its power to what kills the creature it fights, and that creature not killing
   * it. Never into a fight that kills it anyway (the brief). Exposed. */
  selfPumpGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const src = view.battlefield.find((b) => b.id === action.objectId);
    if (!src || src.controller !== view.you || src.power === null || src.toughness === null) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.mana || ab.cost.tap || ab.cost.sacrifice || ab.equip || ab.modes || ab.zone) return false;
    const pump = ab.effects.length > 0 && ab.effects.every((e) => e.type === "modifyPT" && e.scope === "self" && e.duration === "UNTIL_END_OF_TURN" && typeof e.power === "number" && e.power > 0 && typeof e.toughness === "number" && e.toughness >= 0);
    if (!pump) return false;
    const toughUp = ab.effects.reduce((n, e) => n + (e.type === "modifyPT" && typeof e.toughness === "number" ? e.toughness : 0), 0);
    const afterBlocks = view.step === "DECLARE_BLOCKERS" || view.step === "FIRST_STRIKE_DAMAGE";
    if (!afterBlocks || view.stack.length > 0) return true;
    const combat = view.combat ?? { attackers: [], blocks: [] };
    const foes = combat.attackers.includes(src.id)
      ? combat.blocks.filter((b) => b.attacker === src.id).map((b) => b.blocker)
      : combat.blocks.filter((b) => b.blocker === src.id).map((b) => b.attacker);
    if (combat.attackers.includes(src.id) && foes.length === 0) return false; // unblocked: every activation is damage
    if (foes.length !== 1) return true; // not in combat, or a gang block: not priced
    const foe = view.battlefield.find((o) => o.id === foes[0]);
    if (!foe || foe.power === null || foe.toughness === null) return true;
    if (foe.power >= src.toughness - src.damage + toughUp) return true; // it dies anyway: never into that fight
    return src.power >= foe.toughness - foe.damage; // already enough to kill: no more
  }

  /** S50 (book 91, Seasoned Pyromancer's second life — Mother Bear's word): a GRAVEYARD activation that only makes
   * tokens is taken with idle mana — in our second main phase with nothing castable left in hand, or at the
   * opponent's end step when its timing allows. Exposed. */
  graveyardTokensGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || ab.zone !== "graveyard" || ab.effects.length === 0 || !ab.effects.every((e) => e.type === "createToken")) return false;
    const me = view.you;
    if (view.activePlayer !== me) return view.step !== "END";
    if (view.step !== "MAIN2" || view.stack.length > 0) return true;
    const lands = view.battlefield.filter((o) => o.controller === me && !o.tapped && this.def(o.cardId)?.types.includes("Land")).length;
    return view.hand.some((c) => { const d = this.def(c.cardId); return !!d && !d.types.includes("Land") && !d.manaCost.includes("X") && this.mv(c.cardId) <= lands; });
  }

  /** Post-S52 (book 94; Chris: three Essence Scatters spent on one creature spell, the second creature then walking
   * in): a counter is aimed at a stack item that is still going to RESOLVE. An item is "answered" when a live counter
   * of the other side targets it; a counter is live unless it is itself answered — read down the stack from the top
   * (the last cast resolves first). So: our second counter at a spell our first already answers is refused; when the
   * opponent counters our counter, the spell is unanswered again and either their counter or the spell is a target.
   * Keyed on the shape (a stack item whose card has a `counter` effect and whose target is a stack item). Exposed. */
  stackLive(view: GameView): Map<string, boolean> {
    const counters = (cardId: string) => { const d = this.def(cardId); return !!d && ((d.spellEffect ?? []).some((e) => e.type === "counter") || (d.modes ?? []).some((m) => m.effects.some((e) => e.type === "counter")) || (d.abilities ?? []).some((a) => (a.kind === "triggered" || a.kind === "activated") && a.effects.some((e) => e.type === "counter"))); };
    const live = new Map<string, boolean>();
    for (const it of view.stack) live.set(it.id, true);
    // from the top of the stack down: a live counter makes its target not live
    for (let i = view.stack.length - 1; i >= 0; i--) {
      const it = view.stack[i]!;
      if (!live.get(it.id) || !counters(it.cardId)) continue;
      for (const t of it.targets ?? []) if (t.kind === "stackItem" && live.has(t.id)) live.set(t.id, false);
    }
    return live;
  }
  counterWarGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell" && action.type !== "activateAbility") return false;
    const effects = this.actionEffects(view, action);
    if (!effects || !effects.some((e) => e.type === "counter")) return false;
    const targets = ((action as { targets?: ResolvedTarget[] }).targets ?? []).filter((t) => t.kind === "stackItem");
    if (!targets.length) return false;
    const live = this.stackLive(view);
    return targets.every((t) => t.kind === "stackItem" && live.get(t.id) === false); // every target is already answered
  }

  /** Post-S49 (book 88 — the Sealed probe: 69 of 195 Lightning Bolts went at the face of an opponent with an empty
   * board and thirteen or more life, on the first turns; the card's lift was −3.7 where Terror's was +1.7). A damage
   * spell that CAN hit a creature (the shape: numeric damage at an any-target slot) is removal first: aimed at the
   * opponent's face it waits, unless it is lethal, the opponent is within reach (eight life or less — the burn is
   * closing), or the deck's plan is the race (the aggro archetype: its burn is reach, as before). A creature target,
   * a planeswalker-less board and our own face are other gates' business. Exposed for the book. */
  faceBurnHoldGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell" || this.profile.archetype === "aggro") return false;
    const me = view.you, opp = (1 - me) as 0 | 1;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.types.includes("Instant") || d.types.includes("Sorcery"))) return false;
    const effects = d.modes && action.mode !== undefined ? (d.modes[action.mode]?.effects ?? []) : (d.spellEffect ?? []);
    const dmg = effects.reduce((n, e) => n + (e.type === "damage" && typeof e.amount === "number" && e.target !== undefined ? e.amount : 0), 0);
    if (dmg <= 0 || !((d.targets ?? []) as { predicate?: string }[]).some((t) => t.predicate === "anyTarget")) return false;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    if (!targets.some((t) => t.kind === "player" && t.player === opp)) return false;
    return view.life[opp] > dmg && view.life[opp] > 8;
  }

  /** Post-S43 (Chris: the Pearl Cleric and Faerie Formation "exhaust mana as soon as it untaps", before the draw and
   * before the hand). A REPEATABLE value sink — a permanent's activation paid in mana (no tap, no sacrifice) whose
   * every effect is value for us (life, tokens, cards) — spends only mana that would otherwise idle: at the
   * opponent's end step, or in our own second main phase when nothing in hand is castable with what is untapped.
   * The end step is always open, so the sink is never locked out. Exposed for the book. */
  idleSinkGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const src = view.battlefield.find((b) => b.id === action.objectId);
    if (!src || src.controller !== view.you) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.mana || ab.cost.tap || ab.cost.sacrifice || ab.equip || ab.modes || ab.zone === "hand") return false;
    const VALUE = new Set(["gainLife", "createToken", "draw"]); // team counters stay with the S40 sink gate (books 58–63)
    if (ab.effects.length === 0 || !ab.effects.every((e) => VALUE.has(e.type) && (!("who" in e) || e.who === "you" || e.who === undefined) && !("target" in e && e.target !== undefined))) return false;
    const me = view.you;
    if (view.activePlayer !== me) return view.step !== "END";
    if (view.step !== "MAIN2" || view.stack.length > 0) return true;
    const sources = view.battlefield.filter((o) => o.controller === me && this.canActNow(o) && (this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && a.effects.length > 0 && a.effects.every((e) => e.type === "addMana"))).length
      + Object.values(view.manaPool).reduce((a, b) => a + b, 0);
    return view.hand.some((c) => { const d = this.def(c.cardId); return !!d && !d.types.includes("Land") && !d.manaCost.includes("X") && this.mv(c.cardId) <= sources; });
  }

  /** S32 (ADR-109, Diabolic Edict — book 50): an edict is worth the LEAST creature its target would
   * give up (the predictor already prices it so); it is never cast at a player with no creatures, at
   * a board whose cheapest creature is a token shielding a real one, or at our own face. Exposed. */
  edictWasteGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const effects = this.actionEffects(view, action);
    if (!effects || effects.length === 0 || !effects.every((e) => e.type === "sacrifice" && "who" in e && e.who === "target")) return false;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    for (const t of targets) {
      if (t.kind !== "player") continue;
      if (t.player === view.you) return true;
      const theirs = view.battlefield.filter((o) => o.controller === t.player && o.power !== null);
      if (theirs.length === 0) return true;
      const cheapest = [...theirs].sort((a, b) => objectValue(this.defs, a, this.C) - objectValue(this.defs, b, this.C))[0]!;
      if (this.def(cheapest.cardId)?.isTokenDef && theirs.some((o) => !this.def(o.cardId)?.isTokenDef)) return true;
    }
    return false;
  }

  /** S27 r2 (Chris: the AI threw away drawn Manafleurs to the legend rule): a legendary permanent
   * we already control is never cast again — the copy is worth more in hand as insurance against
   * removal. Exposed for the book. */
  legendDuplicateGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.supertypes ?? []).includes("Legendary")) return false;
    // S55 (book 100, book 99's other door): a legend that LOOPS with its own copy is the exception — the second
    // Usher cast beside the first is the loop itself (the legend rule supplies the death; the newcomer returns it)
    if (legendLoopWorth(view, this.defs, d) > 0) return false;
    return view.battlefield.some((o) => o.controller === view.you && o.cardId === d.id);
  }
  /** S55 (book 100): casting a legend whose entering starts its loop — a second copy stands on our battlefield or
   * lies in a graveyard its trigger reaches — is worth the game, plan or no plan (book 99 priced the return; this is
   * the cast). Exposed for the book. */
  loopCastBonus(view: GameView, action: Action): number {
    if (action.type !== "castSpell") return 0;
    const d = this.def(view.hand.find((c) => c.objectId === action.objectId)?.cardId ?? "");
    return d && d.types.includes("Creature") && legendLoopWorth(view, this.defs, d) > 0 ? LOOP_WORTH : 0;
  }

  /** S27 r2 (Chris: the Jet Witch dumped as much life as it could into cards): life-for-cards is a
   * budgeted purchase, not a faucet. Pay only while the hand is thin (≤ 2 cards), only while the
   * life AFTER paying clears the opponent's untapped power on the board by a margin (3), and at most
   * twice per turn (per-instance memory keyed by turn, the S7 pattern). The pin-17 floor still holds
   * underneath. Exposed for the book. */
  private lifeDrawsThisTurn: { turn: number; n: number } = { turn: -1, n: 0 };
  lifeForCardsGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.life) return false;
    if (!ab.effects.some((e) => e.type === "draw")) return false;
    const me = view.you;
    // S55 (book 102): a combo deck DIGS — while its plan is not assembled the draw is taken whatever the hand holds,
    // down to a floor over the opponent's standing power (four, and never under five life), six times a turn at most
    if (this.profile.plan?.dig.includes(view.battlefield.find((o) => o.id === action.objectId)?.cardId ?? "")) {
      const power = view.battlefield.filter((o) => o.controller !== me && o.power !== null && !o.keywords.includes("defender")).reduce((n, o) => n + Math.max(0, o.power ?? 0), 0);
      if (this.planFacts(view).assembled) return true;
      if (view.life[me] - ab.cost.life < Math.max(5, power + 4)) return true;
      return this.lifeDrawsThisTurn.turn === view.turn && this.lifeDrawsThisTurn.n >= 6;
    }
    if (view.hand.length > 2) return true;
    const oppPower = view.battlefield.filter((o) => o.controller !== me && !o.tapped && o.power !== null && !o.keywords.includes("defender")).reduce((n, o) => n + (o.power ?? 0), 0);
    if (view.life[me] - ab.cost.life < oppPower + 3) return true;
    if (this.lifeDrawsThisTurn.turn === view.turn && this.lifeDrawsThisTurn.n >= 2) return true;
    return false;
  }

  /** S26 (Lumen, the Hearth Fire — the sequencing pin, the Thundersnake's gate family): a resolved
   * gainControl (the threaten class) is worth its swing and nothing else — activate only on our
   * own MAIN1 (the attack search cashes the hasted steal; MAIN2 hands the creature back untouched),
   * and only at an OPPONENT's creature (the misaim cliff already forbids our own). Exposed for the
   * book of shame. */
  threatenGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated") return false;
    if (!ab.effects.some((e) => e.type === "gainControl" && e.target !== undefined)) return false;
    return !(view.activePlayer === view.you && view.step === "MAIN1");
  }

  /** S26 (Clio, Lady of the Depths — the hold-vs-spend pin, the boss doc's sketch): the burst
   * (a remove-counters cost) spends the tax the static levies. Spend when the hand runs low
   * (≤ 2 cards) or the opponent's board is thin (≤ 1 creature); HOLD when the hand is stocked AND
   * the board threatens (≥ 2 opposing creatures — every depth counter is −1 power on each). The
   * enumerator already withholds the action under three counters. Exposed for the book of shame. */
  accumulatorSpendGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || !ab.cost.removeCounters) return false;
    const me = view.you;
    const oppCreatures = view.battlefield.filter((o) => o.controller !== me && o.power !== null).length;
    return view.hand.length >= 3 && oppCreatures >= 2;
  }

  /** S23 (fun batch — the Thundersnake discipline, the r3 gate family; Chris-ruled at kickoff):
   * a hasty creature that sacrifices itself at end of step is a burn spell with legs — castable
   * only on its controller's own MAIN1 (so the haste cashes into an attack), and never into an
   * untapped defender big enough to eat it whole (toughness ≥ its power blanks the swing).
   * Exposed for the book of shame. */
  fleetingWasteGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !d.types.includes("Creature") || !(d.keywords ?? []).includes("haste")) return false;
    const fleeting = (d.abilities ?? []).some(
      (a) => a.kind === "triggered" && a.event === "END_STEP" && a.effects.some((e) => e.type === "sacrifice"),
    );
    if (!fleeting) return false;
    if (!(view.activePlayer === view.you && view.step === "MAIN1")) return true;
    const wall = view.battlefield.some(
      (o) => o.controller !== view.you && !o.tapped && o.power !== null && (o.toughness ?? 0) >= (d.power ?? 0),
    );
    return wall;
  }

  /** S23 (fun batch — the Gallows Djinn's tax): the summed self-damage a creature's own ATTACKS or
   * BLOCKS triggers charge its controller (damage addressed to eventPlayer). */
  /** S31: the value an attacker's edict-on-attack (annihilator) takes from `opp` — their `count`
   * least-valued permanents of the predicate (the chooser's rule), plus a half-point of tempo each. */
  private edictGainOnAttack(view: GameView, objectId: string, opp: PlayerId): number {
    const o = view.battlefield.find((b) => b.id === objectId);
    const d = o ? this.def(o.cardId) : undefined;
    let gain = 0;
    for (const a of d?.abilities ?? []) {
      if (a.kind !== "triggered" || a.event !== "ATTACKS") continue;
      for (const e of a.effects) {
        if (e.type !== "sacrifice" || !("who" in e) || e.who !== "opponent") continue;
        const cands = view.battlefield
          .filter((b) => b.controller === opp && (e.predicate === "permanent" || b.power !== null))
          .sort((x, y) => objectValue(this.defs, x, this.C) - objectValue(this.defs, y, this.C))
          .slice(0, e.count);
        for (const b of cands) gain += objectValue(this.defs, b, this.C) + 0.5;
      }
    }
    return gain;
  }

  private selfTax(view: GameView, objectId: string, event: "ATTACKS" | "BLOCKS"): number {
    const o = view.battlefield.find((b) => b.id === objectId);
    const d = o ? this.def(o.cardId) : undefined;
    let tax = 0;
    for (const a of d?.abilities ?? []) {
      if (a.kind !== "triggered" || a.event !== event) continue;
      for (const e of a.effects) if (e.type === "damage" && e.to === "eventPlayer" && typeof e.amount === "number") tax += e.amount;
    }
    return tax;
  }

  sacrificeChoice(view: GameView, request: ActionRequest): Action {
    // S40 (the Reaper, book 62): a TEAM pump that reads the sacrificed creature's power wants the body that makes
    // the alpha biggest — (n−1)·power gained against the power lost — never the source himself.
    if (request.source && (request.source.effects ?? []).some((e) => e.type === "modifyPT" && e.scope === "creaturesYouControl" && typeof e.power === "object" && e.power.ref === "sacrificedPower")) {
      const pick = this.harvestPick(view, (request.actions.filter((a) => a.type === "sacrifice") as { type: "sacrifice"; objectId: string }[]).map((a) => a.objectId), request.source.cardId);
      const act = request.actions.find((a) => a.type === "sacrifice" && a.objectId === pick);
      if (act) return act;
    }
    // S29 (the Altar): the outlet that mills by POWER wants the biggest body when that closes the
    // library, and otherwise the creature already doomed (book 37).
    if (request.source && JSON.stringify(request.source.effects).includes('"sacrificedPower"')) {
      const me = view.you, opp = (1 - me) as 0 | 1;
      const cands = request.actions.filter((a) => a.type === "sacrifice") as { type: "sacrifice"; objectId: string }[];
      const pow = (id: string) => view.battlefield.find((o) => o.id === id)?.power ?? 0;
      const biggest = [...cands].sort((a, b) => pow(b.objectId) - pow(a.objectId))[0];
      if (biggest && pow(biggest.objectId) >= (view.librarySizes[opp] ?? 99)) return biggest;
      // Post-S43: of several doomed (a sweeper on the stack), the biggest body mills the most.
      const doomed = cands.filter((a) => this.creatureIsDoomed(view, a.objectId)).sort((a, b) => pow(b.objectId) - pow(a.objectId))[0];
      if (doomed) return doomed;
    }
    const candidates = request.actions.filter((a) => a.type === "sacrifice") as { type: string; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    // S31 (R-094 word 1 — the edict, book 46): when an opponent's annihilator (or an Edict) makes US
    // choose, tokens go first and lands go LAST (the brief's rule); the rest by board value.
    const edict = (request.source?.effects ?? []).some((e) => e.type === "sacrifice" && "who" in e);
    const boosted = new Set<string>();
    for (const e of request.source?.effects ?? []) {
      if (e.type === "addCounters" && "subtype" in e && typeof (e as { subtype?: string }).subtype === "string") boosted.add((e as { subtype: string }).subtype);
    }
    const cost = (objectId: string): number => {
      let v = this.boardValue(view, objectId);
      const o = view.battlefield.find((b) => b.id === objectId);
      const def = o ? this.defs.get(o.cardId) : undefined;
      if (!def) return v;
      if (edict) {
        if (def.isTokenDef) v -= 2;
        if (def.types.includes("Land")) v += 10;
      }
      for (const ab of def.abilities ?? []) {
        if (ab.kind !== "triggered" || ab.event !== "DIES") continue;
        const src = (ab.condition as { source?: string } | undefined)?.source;
        if (src === "any" || src === "other") {
          // S22 (pin 15 nudged for the Usher's doubled drain): an observed-DIES engine's keep-value
          // scales with its per-death swing (Blood Artist 1+1 → +1.5 exactly as before; the Usher
          // 2+2 → +3.0 — doubled rate, doubled keep-value). Ladder-neutral by construction.
          let swing = 0;
          for (const e of ab.effects) if ((e.type === "loseLife" || e.type === "gainLife" || e.type === "damage") && typeof e.amount === "number") swing += e.amount;
          v += 1.5 * Math.max(1, swing / 2);
        } else if (!ab.optional || ab.effects.some((e) => e.type === "draw")) v -= 0.5; // its own death pays us back
      }
      if ((def.subtypes ?? []).some((st) => boosted.has(st))) v += 1.0; // it would receive the counter
      return v;
    };
    const ranked = [...candidates].sort((a, b) => {
      const va = cost(a.objectId);
      const vb = cost(b.objectId);
      if (va !== vb) return va - vb;
      return a.objectId.localeCompare(b.objectId);
    });
    return ranked[0]! as Action;
  }

  // ---------- S40 (ADR-128): the flood's policies — shape-keyed, never card-keyed ----------

  /** Book 95 (Chris: the AI attacked into Voracious Cobra): the attack simulator knows keywords, not triggers — a
   * creature that destroys what it deals combat damage to is, for combat, a deathtoucher; it enters the simulation as
   * one (blocks already price it — S40's blockGain). Shape-keyed: the DEALS_DAMAGE → destroy-that-creature trigger. */
  private attackSimCreatures(view: GameView): SimObject[] {
    return viewCreatures(view).map((c) => (!c.keywords.includes("deathtouch") && this.destroysWhatItDamages(c.id, view) ? { ...c, keywords: [...c.keywords, "deathtouch"] as SimObject["keywords"] } : c));
  }
  private destroysWhatItDamages(objectId: string, view: GameView): boolean {
    const o = view.battlefield.find((b) => b.id === objectId);
    return (this.def(o?.cardId ?? "")?.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "DEALS_DAMAGE" && a.condition?.recipient === "creature" && a.effects.some((e) => e.type === "destroy" && e.eventObject));
  }
  /** Our permanents (other than `dyingId`) that burn the opponent for a dying creature's power. */
  private deathBurnObservers(view: GameView, dyingId: string): number {
    let n = 0;
    for (const o of view.battlefield) {
      if (o.controller !== view.you || o.id === dyingId) continue;
      if ((this.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "triggered" && a.event === "DIES" && a.condition?.source === "other" && a.condition.controller === "you" && a.effects.some((e) => e.type === "damage" && typeof e.amount === "object" && e.amount.ref === "eventPower"))) n += 1;
    }
    return n;
  }
  /** Book 57: the optional trigger on top of the stack is ours, harmful, and every object it targets is ours. */
  optionalHarmsOnlyUs(view: GameView): boolean {
    const top = view.stack[view.stack.length - 1];
    if (!top || top.controller !== view.you) return false;
    const harmful = (this.def(top.cardId)?.abilities ?? []).some((a) => a.kind === "triggered" && a.optional === true && classifyEffects(a.effects) === "harmful");
    const objs = (top.targets ?? []).filter((t) => t.kind === "object");
    return harmful && objs.length > 0 && objs.every((t) => targetSide(view, t) === view.you);
  }
  /** Book 62: which creature the harvest takes — maximise the team's added power net of the body spent; the
   * source never; ties to the cheaper body. */
  private harvestPick(view: GameView, candidates: string[], sourceCardId: string): string | undefined {
    const me = view.you;
    const team = view.battlefield.filter((o) => o.controller === me && o.power !== null);
    const score = (id: string): number => { const c = team.find((o) => o.id === id); const p = Math.max(0, c?.power ?? 0); return (team.length - 1) * p - p; };
    const pool = candidates.filter((id) => view.battlefield.find((o) => o.id === id)?.cardId !== sourceCardId);
    return [...(pool.length > 0 ? pool : candidates)].sort((a, b) => score(b) - score(a) || this.boardValue(view, a) - this.boardValue(view, b) || a.localeCompare(b))[0];
  }

  /**
   * Books 58–63 — the flood's repeatable sinks. One gate, dispatched on the ability's SHAPE:
   *  · a LAND's non-mana ability (the High Grounds; the Fordkeeper's granted ping): draw / return-to-hand at the
   *    opponent's end step; a ping there too (a kill, else face) or any time it kills or is lethal; put-on-top on
   *    their best creature at their end step or while it attacks; the team keyword grant before our combat with
   *    three or more ready creatures; reanimation-for-a-body when the best creature in our yard beats the
   *    cheapest body by two.
   *  · a CREATURE's free-repeat sink: a targeted shrink only where it kills (their end step, or in combat);
   *    a targeted mill at their end step; the team counters on our own main phase with three or more creatures;
   *    the harvest (sacrifice → team +X/+0) for a lethal or near-lethal (half their life) alpha, never the last blocker while
   *    behind; reanimation from a graveyard on the best creature card in either; the land-sacrifice rebuy with a
   *    SPARE land only (lands in play > the hand's top mana value + 1), on the best spell in the yard.
   */
  floodSinkGated(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    const src = view.battlefield.find((b) => b.id === action.objectId);
    if (!src) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated" || ab.effects.length === 0 || ab.effects.every((e) => e.type === "addMana") || ab.equip || ab.modes) return false;
    const me = view.you, opp = (1 - me) as 0 | 1;
    const srcDef = this.def(src.cardId);
    const onLand = !!srcDef?.types.includes("Land") && !!ab.cost.mana;
    const theirEnd = view.activePlayer !== me && view.step === "END";
    const ourMain = view.activePlayer === me && (view.step === "MAIN1" || view.step === "MAIN2") && view.stack.length === 0;
    const preCombat = view.activePlayer === me && (view.step === "MAIN1" || view.step === "COMBAT_BEGIN");
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    const objT = targets[0]?.kind === "object" ? view.battlefield.find((o) => o.id === (targets[0] as { id: string }).id) : undefined;
    const inCombat = (id: string) => view.combat.attackers.includes(id) || view.combat.blocks.some((b) => b.blocker === id);
    const myCreatures = view.battlefield.filter((o) => o.controller === me && o.power !== null);
    const e0 = ab.effects[0]!;
    const yardBest = (who: number[], pred: (d: CardDef) => boolean, worth: (d: CardDef) => number, extra?: (d: CardDef, objectId: string) => number): string | undefined => {
      let best: { id: string; w: number } | undefined;
      for (const p of who) for (const g of view.graveyardObjects[p as 0 | 1]) { const d = this.def(g.cardId); if (!d || !pred(d)) continue; const w = worth(d) + (extra ? extra(d, g.objectId) : 0); if (!best || w > best.w) best = { id: g.objectId, w }; }
      return best?.id;
    };
    const tId = targets[0]?.kind === "object" ? (targets[0] as { id: string }).id : undefined;

    // The harvest — before the generic branches (its cost is a creature, its payload the team).
    if (ab.cost.sacrifice && ab.effects.some((e) => e.type === "modifyPT" && e.scope === "creaturesYouControl" && typeof e.power === "object" && e.power.ref === "sacrificedPower")) {
      if (!preCombat || myCreatures.length < 2) return true;
      const pick = this.harvestPick(view, myCreatures.map((o) => o.id), src.cardId);
      const p = Math.max(0, myCreatures.find((o) => o.id === pick)?.power ?? 0);
      const attackers = myCreatures.filter((o) => o.id !== pick && this.canActNow(o) && !o.cantAttack).map((o) => Math.max(0, o.power ?? 0) + p).sort((a, b) => b - a); // S45: only who can swing this turn
      const blockers = view.battlefield.filter((o) => o.controller === opp && o.power !== null && !o.tapped).length;
      const through = attackers.slice(blockers).reduce((a, b) => a + b, 0); // their blockers stop our biggest
      const theirs = view.battlefield.filter((o) => o.controller === opp && o.power !== null).length;
      if (myCreatures.length - 1 <= 1 && myCreatures.length - 1 < theirs) return true; // never down to the last body while behind
      return through < Math.ceil(view.life[opp] * 0.5); // S41 (the planner's ruling): half, not three-fifths — he should PLAY like the Reaper
    }
    // Reanimation with a creature as the cost (the pyre), or free (the Reeve): the best card only, and worth the body.
    if (e0.type === "returnFromGraveyard" && e0.to === "battlefield" && e0.target !== undefined) {
      const spec = ab.targets?.[0];
      const best = yardBest(spec?.who === "any" ? [me, opp] : [me], (d) => d.types.includes("Creature"), reanimationWorth, (d, id) => legendLoopWorth(view, this.defs, d, id)); // book 99: the loop
      if (tId !== best) return true;
      if (ab.cost.sacrifice) {
        const cheapest = Math.min(...myCreatures.map((o) => objectValue(this.defs, o, this.C)));
        const g = [...view.graveyardObjects[me], ...view.graveyardObjects[opp]].find((o) => o.objectId === tId);
        if (!(reanimationWorth(g ? this.def(g.cardId) : undefined) >= cheapest + 2)) return true;
      }
      return !(ourMain || theirEnd);
    }
    // The rebuy that spends a land (the Dredger): a spare land only; the dearest spell in the yard.
    if (ab.cost.sacrifice?.predicate === "land") {
      const lands = view.battlefield.filter((o) => o.controller === me && this.def(o.cardId)?.types.includes("Land")).length;
      const topMv = Math.max(0, ...view.hand.filter((c) => !this.def(c.cardId)?.types.includes("Land")).map((c) => this.mv(c.cardId)));
      if (!(lands > topMv + 1)) return true;
      const best = yardBest([me], (d) => d.types.includes("Instant") || d.types.includes("Sorcery"), (d) => manaValue(parseManaCost(d.manaCost)) + (d.spellEffect?.some((x) => x.type === "counter") ? 0.5 : 0));
      if (tId !== best) return true;
      return !(theirEnd || (ourMain && view.step === "MAIN2"));
    }
    const repeatable = !ab.cost.tap && !ab.cost.sacrifice && !!ab.cost.mana && src.power !== null;
    if (!onLand && !repeatable) return false;
    const kills = (n: number) => !!objT && objT.controller === opp && objT.toughness !== null && objT.toughness - objT.damage <= n;
    // A creature's sinks are the shrink, the mill and the team counters only — every other creature ability keeps
    // its pre-S40 scoring (the Tyrant's gun, the Sower's Sphinx).
    if (!onLand && e0.type !== "modifyPT" && e0.type !== "mill" && e0.type !== "addCounters") return false;
    switch (e0.type) {
      case "draw":
        return !theirEnd;
      case "returnFromGraveyard": // to hand (Shevelport)
        return !theirEnd;
      case "damage": {
        const n = typeof e0.amount === "number" ? e0.amount : 1;
        if (targets[0]?.kind === "player") return !(targets[0].player === opp && (view.life[opp] <= n || (theirEnd && !view.battlefield.some((o) => o.controller === opp && o.toughness !== null && o.toughness - o.damage <= n))));
        return !kills(n);
      }
      case "modifyPT": {
        if (e0.target === undefined || typeof e0.toughness !== "number" || e0.toughness >= 0) return false;
        return !(kills(-e0.toughness) && (theirEnd || (!!objT && inCombat(objT.id))));
      }
      case "mill":
        return !(theirEnd && targets[0]?.kind === "player" && targets[0].player === opp);
      case "bounce": {
        if (!objT || objT.controller !== opp) return true;
        const best = [...view.battlefield.filter((o) => o.controller === opp && o.power !== null)].sort((a, b) => objectValue(this.defs, b, this.C) - objectValue(this.defs, a, this.C))[0];
        return !(view.combat.attackers.includes(objT.id) || (theirEnd && best?.id === objT.id));
      }
      case "grantKeyword":
        if (e0.scope !== "creaturesYouControl") return false;
        return !(preCombat && myCreatures.filter((o) => this.canActNow(o) && !o.cantAttack).length >= 3); // S45: ready attackers only
      case "addCounters":
        if (e0.scope !== "creaturesYouControl") return false;
        return !(ourMain && myCreatures.length >= 3);
      default:
        return false;
    }
  }

  private boardValue(view: GameView, objectId: string): number {
    const o = view.battlefield.find((b) => b.id === objectId);
    return o ? objectValue(this.defs, o, this.C) : 0;
  }

  private targetChoice(view: GameView, request: ActionRequest): Action {
    const variants = request.source
      ? preferSide(view, request.actions, request.source.effects)
      : request.actions;
    if (variants.length === 1) return variants[0]!;
    // Within the preferred side: harmful → hit their most valuable; helpful →
    // help our most valuable. Neutral → uniform.
    const cls = request.source ? classifyEffects(request.source.effects) : "neutral";
    // S45 (the Tidewall's return was a coin flip): a graveyard return is neutral by the table but never random — the
    // scorer below prices its card (a spell by mana value, a body by reanimationWorth). Gravedigger and the Usher gain too.
    const returnsFromYard = (request.source?.effects ?? []).some((e) => e.type === "returnFromGraveyard");
    const returnsToBattlefield = (request.source?.effects ?? []).some((e) => e.type === "returnFromGraveyard" && e.to === "battlefield");
    if (cls === "neutral" && !returnsFromYard) return this.rngPick(variants);
    // S50 (book 89, Flametongue Kavu): a harmful NUMERIC damage aims at the best creature it KILLS before the most
    // valuable one it only wounds; and when every legal target is our own (an empty table across), at the one that
    // survives it, else the one we lose least by.
    const dmgAmount = (request.source?.effects ?? []).reduce((n, e) => n + (e.type === "damage" && typeof e.amount === "number" && "target" in e && e.target !== undefined ? e.amount : 0), 0);
    const diesTo = (id: string) => { const o = view.battlefield.find((b) => b.id === id); return !!o && o.toughness !== null && dmgAmount > 0 && dmgAmount >= o.toughness - o.damage; };
    const allOurs = cls === "harmful" && variants.every((a) => ((a as { targets?: { kind: string; id?: string }[] }).targets ?? []).every((t) => t.kind === "object" && view.battlefield.some((b) => b.id === t.id && b.controller === view.you)));
    if (allOurs && dmgAmount > 0) {
      const loss = (a: Action) => ((a as { targets?: { id?: string }[] }).targets ?? []).reduce((n, t) => n + (t.id && diesTo(t.id) ? this.boardValue(view, t.id) : 0), 0);
      return [...variants].sort((a, b) => loss(a) - loss(b))[0]!;
    }
    const score = (a: Action): number => {
      const ts = (a as { targets?: { kind: string; id?: string }[] }).targets ?? [];
      let s = 0;
      for (const t of ts) {
        if (t.kind === "object" && t.id) s += this.boardValue(view, t.id);
        if (t.kind === "object" && t.id && cls === "harmful" && dmgAmount > 0 && diesTo(t.id)) s += 100; // a kill before a wound
        // S32 (the Escort's ETB): a HELPFUL effect goes to the creature UNDER FIRE first — the one an
        // opponent's stack item is aimed at (the save is the point of the flash).
        if (t.kind === "object" && t.id && cls === "helpful" && this.creatureIsDoomed(view, t.id)) s += 10;
        // S46 (Vitalist — the brief's Part 3): +1/+1 counters go on the best EVASIVE creature we control (flying,
        // trample), else the best body; never the opponent's (preferSide keeps the helpful effect on our side).
        if (t.kind === "object" && t.id && cls === "helpful" && (request.source?.effects ?? []).some((e) => e.type === "addCounters" && e.kind === "+1/+1")) {
          const o = view.battlefield.find((b) => b.id === t.id);
          if (o && o.controller === view.you && (o.keywords.includes("flying") || o.keywords.includes("trample"))) s += 3;
        }
        // S36 (book 53, the Angel of the Ruins): a HARMFUL effect on an opponent's aura that sits on OUR creature
        // is worth the creature it holds (Control Magic, Pacifism) — before their other artifacts and enchantments.
        if (t.kind === "object" && t.id && cls === "harmful") {
          const o = view.battlefield.find((b) => b.id === t.id);
          const host = o?.attachedTo ? view.battlefield.find((b) => b.id === o.attachedTo) : undefined;
          if (o && o.controller !== view.you && host && host.controller === view.you) s += this.boardValue(view, host.id);
        }
        // S28 (Unearth): a GRAVEYARD target is worth its card — the best MV≤3 body comes back.
        if (t.kind === "object" && t.id && !view.battlefield.some((o) => o.id === t.id)) {
          const g = view.graveyardObjects[view.you].find((o) => o.objectId === t.id) ?? view.graveyardObjects[(1 - view.you) as 0 | 1].find((o) => o.objectId === t.id); // S40: the Reeve reaches either yard
          const gd = g ? this.def(g.cardId) : undefined;
          // S45 (the Tidewall): a SPELL back to hand is worth its mana value, a counter half again — the dearest comes back.
          if (gd && (gd.types.includes("Instant") || gd.types.includes("Sorcery"))) s += manaValue(parseManaCost(gd.manaCost)) + (gd.spellEffect?.some((e) => e.type === "counter") ? 0.5 : 0);
          else s += reanimationWorth(gd) + (returnsToBattlefield ? legendLoopWorth(view, this.defs, gd, t.id) : 0); // S31: the one valuation (evaluator.reanimationWorth); book 99: the loop
        }
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
