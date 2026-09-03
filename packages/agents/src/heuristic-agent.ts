import { NullLog, SeededRng } from "@shandalar/core";
import { parseManaCost, manaValue, type CardDef, type Effect, type ResolvedTarget } from "@shandalar/cards";
import type { Action, ActionRequest, Agent, GameView, PlayerId } from "@shandalar/engine";
import { preferSide, targetSide, classifyEffects, effectsForAction, ptSign } from "./effect-classification.js";
import { DEFAULT_CONSTANTS, deterrence, evaluate, objectValue, type AiProfile, type EvalConstants } from "./evaluator.js";
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
      case "searchLibrary":
        return this.searchChoice(view, request);
      case "chooseMode":
        return this.modeChoice(view, request);
      case "discardCost":
        return this.lowestValueCard(view, request, "discard");
      case "entersChoice":
        return this.entersChoice(view, request);
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

  private lowestValueCard(view: GameView, request: ActionRequest, type: "bottomCard" | "discard"): Action {
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
    if (this.pumpWasteGated(view, action)) return -Infinity; // Giant Growth outside combat, empty stack
    if (this.fleetingWasteGated(view, action)) return -Infinity; // S23: the Thundersnake outside its window
    if (this.threatenGated(view, action)) return -Infinity; // S26: Lumen's steal only where the swing cashes
    if (this.tapperGated(view, action)) return -Infinity; // S26 r3: hold the tapper for the opponent's turn
    if (this.legendDuplicateGated(view, action)) return -Infinity; // S27 r2: never cast a second copy of a legend we control
    if (this.lifeForCardsGated(view, action)) return -Infinity; // S27 r2: the Witch's discipline
    if (this.accumulatorSpendGated(view, action)) return -Infinity; // S26: Clio holds the tax while the board threatens
    // The misaim rule: a FINITE cliff (not -Infinity) so book-of-shame orderings among
    // bad aims survive — at any softmax temperature exp(-MISAIM/t) is 0, so a misaimed
    // variant is never picked while any legitimate action (pass included) exists.
    const misaim = this.misaimPenalty(view, action);
    const pred = predictAction(view, action, this.defs, this.C);
    if (pred.unchanged) {
      // Friction: an action that visibly does nothing scores strictly below
      // passing (kills same-host re-equip churn and no-benefit activations).
      return evaluate(view, this.profile, this.defs) - 0.25 - misaim;
    }
    return evaluate(pred.view, this.profile, this.defs) + pred.adjustment - misaim;
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
    const effects = this.actionEffects(view, action);
    if (!effects || effects.length === 0) return false;
    const allEotBuffs = effects.every(
      (e) =>
        (e.type === "modifyPT" && e.duration === "UNTIL_END_OF_TURN" && ptSign(e.power) + ptSign(e.toughness) > 0) ||
        (e.type === "grantKeyword" && e.duration === "UNTIL_END_OF_TURN"),
    );
    if (!allEotBuffs) return false;
    const combatLive = view.combat.attackers.length > 0;
    const oppOnStack = view.stack.some((s) => s.controller !== view.you);
    return !combatLive && !oppOnStack;
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
    if (action.type === "castSpell") {
      const card = view.hand.find((c) => c.objectId === action.objectId);
      const d = card ? this.def(card.cardId) : undefined;
      if (!d || !d.spellEffect || d.spellEffect.length === 0 || !d.spellEffect.every((e) => e.type === "addMana")) return null;
      for (const e of d.spellEffect) if (e.type === "addMana" && e.mana) produced += (e.mana.match(/\{/g) ?? []).length;
      produced -= Math.max(1, manaValue(parseManaCost(d.manaCost))); // net of its own cost
      spendsCard = card!.objectId;
    } else if (action.type === "activateAbility") {
      const o = view.battlefield.find((b) => b.id === action.objectId);
      const d = o ? this.def(o.cardId) : undefined;
      const ab = d?.abilities?.[action.abilityIndex];
      if (!ab || ab.kind !== "activated" || !ab.cost.sacrifice || !ab.effects.every((e) => e.type === "addMana")) return null;
      for (const e of ab.effects) if (e.type === "addMana" && e.mana) produced += (e.mana.match(/\{/g) ?? []).length;
      // S26: the Lotus — N of one chosen colour; the enabling card must WANT that colour (or none).
      for (const e of ab.effects) if (e.type === "addMana" && e.choice) { produced += e.choice.count; burstColor = action.color ?? null; }
    } else return null;
    const pool = Object.values(view.manaPool).reduce((a, b) => a + b, 0);
    const producers = view.battlefield.filter((o) => {
      if (o.controller !== me || o.tapped) return false;
      const d = this.def(o.cardId);
      if (!d) return false;
      const isLand = d.types.includes("Land");
      const hasMana = (d.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && !a.cost.sacrifice && a.effects.every((e) => e.type === "addMana" && !e.choice));
      return hasMana && (isLand || true);
    }).length;
    const available = pool + producers;
    const enables = view.hand.some((c) => {
      if (c.objectId === spendsCard) return false;
      const d = this.def(c.cardId);
      if (!d || d.types.includes("Land")) return false;
      const mv = manaValue(parseManaCost(d.manaCost));
      if (!(mv > available && mv <= available + produced)) return false;
      // S26: a coloured burst must match a pip of the card it enables (a Lotus popped for red
      // enables nothing blue); colourless costs take any colour.
      if (burstColor) {
        const pips = d.manaCost.replace(/[^WUBRG]/g, "");
        if (pips.length > 0 && !pips.includes(burstColor)) return false;
      }
      return true;
    });
    return { enables };
  }

  /** S17: a hand-zone self-discard ability (cycling). S22: resolved through the virtual list so the
   * Stoker's granted cycling is recognized too (pin 13 rides unchanged). */
  isCycling(view: GameView, action: Action): boolean {
    if (action.type !== "activateAbility") return false;
    if (!view.hand.some((c) => c.objectId === action.objectId)) return false;
    const ab = viewAbilityAt(view, this.defs, action.objectId, action.abilityIndex);
    return !!ab && ab.kind === "activated" && ab.zone === "hand" && ab.cost.discardSelf === true;
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
    const bestLand = [...lands].sort((a, b) => (need[basicColor(cardOf.get(b.objectId) ?? "") ?? ""] ?? -99) - (need[basicColor(cardOf.get(a.objectId) ?? "") ?? ""] ?? -99))[0];
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
    const scores = candidates.map((a) => this.scorePriorityAction(view, a));
    const pick = candidates[this.softmaxPick(scores)]!;
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
    // S9 Part 1.1: our lifelink attackers' gains show up as negative own
    // damage in the sim — credit them. (Opponent lifelink blockers already
    // debit through negative playerDamage[opp].)
    score += Math.max(0, -outcome.playerDamage[me]) * 0.2;
    // ADR-060.1: attacking abandons defense — each non-vigilance attacker
    // pays the deterrence it was providing (evaluate credits the same term
    // to untapped holders; that asymmetry prices the Rats over-attack).
    const oppCreatures = view.battlefield.filter((o) => o.controller !== me && o.power !== null);
    // S27 r2 (Chris: the Manafleur never swung its 7/7 into a board of 2/2s): deterrence is only worth
    // what the counter-swing could take — scale the deduction by the race risk (the opponent's
    // untapped power against our life above a margin). At 35 life facing six power the 7/7 attacks;
    // at 6 life it holds. Vigilance still pays nothing. Exposed through the book (29).
    const untappedOpp = oppCreatures.filter((o) => !o.tapped);
    const oppPower = untappedOpp.reduce((n, o) => n + (o.power ?? 0), 0);
    const maxOppPower = untappedOpp.reduce((m, o) => Math.max(m, o.power ?? 0), 0);
    const oppDeathtouch = untappedOpp.some((o) => o.keywords.includes("deathtouch"));
    const raceRisk = Math.min(1, oppPower / Math.max(1, view.life[me] - 5));
    for (const id of attackers) {
      const o = view.battlefield.find((b) => b.id === id);
      if (!o || o.keywords.includes("vigilance")) continue;
      // Only a SAFE attacker (no single block can kill it) trades its deterrence for race risk; a
      // fragile trader (the deathtouch 1/1 of book-of-shame's deterrence pin) keeps the full deduction.
      const safe = (o.toughness ?? 0) > maxOppPower && !oppDeathtouch;
      score -= deterrence(this.defs, o, oppCreatures, this.C) * (safe ? raceRisk : 1);
    }
    // S23 (the Gallows Djinn): each attacker's own attack tax is priced at the archetype's
    // own-life rate — the 5/5's swing is honest, not free.
    for (const id of attackers) score -= this.selfTax(view, id, "ATTACKS") * this.C.weights[this.profile.archetype].ownLife;
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
    return (kills ? valueOf(attacker.id) : 0) - (dies ? valueOf(blocker.id) : 0) + prevented * w + lifelinkDenied - blockTax;
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
    if (view.activePlayer !== me) return !["UPKEEP", "DRAW", "MAIN1", "COMBAT_BEGIN"].includes(view.step);
    // S27 r2 (Chris: Glare of Subdual tapped its own board down instead of attacking for lethal): a
    // tap-a-creature COST spends an attacker — on our own turn the Glare never fires.
    if (ab.cost.tapCreature) return true;
    if (!(view.step === "MAIN1" || view.step === "COMBAT_BEGIN")) return true;
    const swing = view.battlefield.some((o) => o.controller === me && !o.tapped && o.power !== null && o.id !== action.objectId);
    return !swing;
  }

  /** S27 r2 (Chris: the AI threw away drawn Manafleurs to the legend rule): a legendary permanent
   * we already control is never cast again — the copy is worth more in hand as insurance against
   * removal. Exposed for the book. */
  legendDuplicateGated(view: GameView, action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? this.def(card.cardId) : undefined;
    if (!d || !(d.supertypes ?? []).includes("Legendary")) return false;
    return view.battlefield.some((o) => o.controller === view.you && o.cardId === d.id);
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
    if (view.hand.length > 2) return true;
    const oppPower = view.battlefield.filter((o) => o.controller !== me && !o.tapped && o.power !== null).reduce((n, o) => n + (o.power ?? 0), 0);
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
    const candidates = request.actions.filter((a) => a.type === "sacrifice") as { type: string; objectId: string }[];
    if (candidates.length === 0) return request.actions[0]!;
    const boosted = new Set<string>();
    for (const e of request.source?.effects ?? []) {
      if (e.type === "addCounters" && "subtype" in e && typeof (e as { subtype?: string }).subtype === "string") boosted.add((e as { subtype: string }).subtype);
    }
    const cost = (objectId: string): number => {
      let v = this.boardValue(view, objectId);
      const o = view.battlefield.find((b) => b.id === objectId);
      const def = o ? this.defs.get(o.cardId) : undefined;
      if (!def) return v;
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
