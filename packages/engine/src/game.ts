import { EventBus, IdGen, type LogSink, type Rng } from "@shandalar/core";
import { parseManaCost, resolveEffect, type CardDef, type Effect, isChoiceManaAbility, parseManaProduction } from "@shandalar/cards";
import { sameAction, type Action } from "./actions.js";
import {
  assignCombatDamage,
  combatHasFirstStrikers,
  commitAttackers,
  commitBlockers,
  dealCombatDamage,
  setBlockOrder,
  stageAttacker,
  stageBlock,
} from "./combat.js";
import type { EngineCtx } from "./ctx.js";
import { expireEndOfTurnEffects } from "./characteristics.js";
import { makeEffectContext } from "./effect-context.js";
import { attackerChoices, blockerChoices, bottomChoices, discardChoices, effectiveAbilityCost, legalActions } from "./enumerator.js";
import type { GameEventMap } from "./events.js";
import { autoPay, canPay, emptyManaPools, tapForMana } from "./mana.js";
import { applyModifiers, type Modifier } from "./modifiers.js";
import { loseLife, discardCard, drawCard } from "./ops.js";
import { runSBAs } from "./sba.js";
import { sacrificeCandidates, returnToHandCandidates, tapCreatureCandidates } from "./sacrifice.js";
import { abilitiesOf } from "./granted.js";
import {
  emptyCombat,
  getObject,
  initialGameState,
  makeDefSource,
  opponentOf,
  STEPS,
  type GameState,
  type PlayerId,
  type StackItem,
  type Step,
} from "./state.js";
import { isLegalTarget, targetCandidates } from "./targeting.js";
import { placePendingTriggers, wireTriggerCollection } from "./triggers.js";
import { buildView, type GameView } from "./view.js";
import { createObject, moveObject } from "./zones.js";

export type RequestPurpose =
  | "priority"
  | "chooseSacrifice"
  | "legendRule"
  | "optionalTrigger"
  | "declareAttacker"
  | "declareBlocker"
  | "orderTriggers"
  | "orderBlockerDamage"
  | "chooseTarget"
  | "mulligan"
  | "bottomCards"
  | "discard"
  /** ADR-068 Amendment 1: pick a matching library card (request carries the candidates as `revealed`) or decline. */
  | "searchLibrary"
  /** ADR-075 A6: pick a mode for a modal trigger as it goes on the stack (spells pick at cast — one castSpell action per mode). */
  | "chooseMode"
  /** ADR-076: pick the card(s) to discard as an activation cost (Waterfront Bouncer). */
  | "discardCost"
  /** A9 (S20): the shock clause — pay life to enter untapped, or enter tapped. */
  | "entersChoice"
  /** A10 word 2 (S22): pick the permanent to bounce as an activation cost (the Unwinder). */
  | "chooseBounceCost"
  /** A10 word 6 (S22): pick the untapped creature to tap as an activation cost (Glare). */
  | "chooseTapCost"
  /** A10 word 4 (S22): the any-number cast loop — add a target or done (Phyrexian Purge). */
  | "chooseVariableTarget"
  /** A10 word 7 (S22): the punisher fork — pay the stated cost or suffer the effect (the Stoker). */
  | "unlessPay";

/** ADR-048: identity + pending effects of the thing asking for targets, so
 * agents can classify (rule 8 / evaluation) without guessing the source. */
export interface RequestSource {
  cardId: string;
  effects: Effect[];
}

export interface ActionRequest {
  player: PlayerId;
  purpose: RequestPurpose;
  actions: Action[];
  /** ADR-029: cards revealed to the chooser for this decision only (Duress). */
  revealed?: { objectId: string; cardId: string }[];
  /** ADR-048: present on target-choice requests (trigger targets today).
   * S8 concern 5 (noted per S9 rider): chooseSacrifice requests carry no
   * source identity — fine while sacrifices are pure costs, but a future
   * "sacrifice unless you pay" effect would want `source` here too. */
  source?: RequestSource;
}

/** Live play wraps agents; replay feeds logged actions. Same seam for both. */
export type ActionSource = (req: ActionRequest, view: GameView) => Promise<Action>;

export interface GameRules {
  startingLife: number;
  handSize: number;
  maxTurns: number;
  /** S12 (R-043): stakes — after the shuffle, before hands, each library's top
   * `ante` NONLAND cards move to the ante zone. 0 = off (the engine's default;
   * the overworld passes its knob). */
  ante: number;
  /** S22 r2 (Chris — the Shandalar coin flip): who takes turn 1 (and skips its draw, CR 103.8a).
   * Default 0 — every existing spec, replay, and sim is unchanged. The WORLD rolls it from its
   * seeded RNG; the engine just obeys the spec (determinism as ever). */
  startingPlayer?: PlayerId;
}

export const DEFAULT_RULES: GameRules = { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 };

export class Game {
  readonly ctx: EngineCtx;

  constructor(
    cards: Map<string, CardDef>,
    private readonly decklists: [string[], string[]],
    rng: Rng,
    log: LogSink<Action>,
    private readonly source: ActionSource,
    private readonly rules: GameRules = DEFAULT_RULES,
  ) {
    this.ctx = {
      state: initialGameState(rules.startingLife),
      defs: makeDefSource(cards),
      ids: new IdGen(),
      bus: new EventBus<GameEventMap>(),
      log,
      rng,
    };
    wireTriggerCollection(this.ctx);
    this.wireFactEvents();
  }

  get state(): GameState {
    return this.ctx.state;
  }

  /** S11 observation seam: awaited before a lone-pass priority window is
   * auto-taken (ADR-014 unchanged: nothing is requested or logged). Play mode
   * uses it to pause with an opponent's spell visible on the stack. */
  onLonePass?: (player: PlayerId, view: GameView) => Promise<void>;

  /** EVENT log entries used to derive MatchResult facts (not consumed by replay). */
  private wireFactEvents(): void {
    const { bus, log } = this.ctx;
    bus.on("DAMAGE", (e) => log.append({ t: "EVENT", name: "DAMAGE", payload: e }));
    bus.on("ATTACHED", (e) => log.append({ t: "EVENT", name: "ATTACHED", payload: e }));
    bus.on("CARD_DRAWN", (e) => log.append({ t: "EVENT", name: "CARD_DRAWN", payload: e }));
    bus.on("SPELL_CAST", (e) => log.append({ t: "EVENT", name: "SPELL_CAST", payload: e }));
    bus.on("ANTE_SET", (e) => log.append({ t: "EVENT", name: "ANTE_SET", payload: e }));
    bus.on("MILLED", (e) => log.append({ t: "EVENT", name: "MILLED", payload: e })); // ADR-070: narration/facts; replay ignores EVENTs
    bus.on("ZONE_CHANGE", (e) => {
      if (e.from === "battlefield" && e.to === "graveyard") {
        log.append({ t: "EVENT", name: "DIES", payload: { cardId: e.cardId, owner: e.owner } });
      }
      // Landfall's event exists from S2 even though nothing listens yet (skeleton-first).
      if (e.to === "battlefield" && e.newId && this.ctx.defs.def(e.cardId).types.includes("Land")) {
        bus.emit("LAND_ENTERS_UNDER_YOUR_CONTROL", { objectId: e.newId, controller: e.controller });
      }
    });
  }

  /** Ask the action source for a decision; validate and log it. */
  private async request(
    player: PlayerId,
    purpose: RequestPurpose,
    actions: Action[],
    revealed?: { objectId: string; cardId: string }[],
    source?: RequestSource,
  ): Promise<Action> {
    if (actions.length === 0) throw new Error(`request with no actions (${purpose})`);
    const chosen = await this.source(
      { player, purpose, actions, ...(revealed ? { revealed } : {}), ...(source ? { source } : {}) },
      buildView(this.ctx, player),
    );
    if (!actions.some((a) => sameAction(a, chosen))) {
      throw new Error(`Agent for player ${player} returned an illegal action: ${JSON.stringify(chosen)}`);
    }
    this.ctx.log.append({
      t: "ACTION",
      turn: this.state.turn,
      step: this.state.step,
      player,
      action: chosen,
    });
    return chosen;
  }

  // ---------- Setup ----------

  async setup(): Promise<void> {
    const { state } = this.ctx;
    for (const player of [0, 1] as PlayerId[]) {
      for (const cardId of this.decklists[player]) {
        createObject(this.ctx, cardId, player, "library");
      }
      state.players[player].library = this.ctx.rng.shuffle(state.players[player].library, "shuffle");
    }
    // S12 ante (R-043): after the shuffle, before hands — the top n NONLAND
    // cards of each library are set aside as stakes (a shuffled library makes
    // "top n" the CR 407 random pick; lands are skipped, not moved). An
    // all-lands library antes fewer or none — reported as found.
    if (this.rules.ante > 0) {
      for (const player of [0, 1] as PlayerId[]) this.setAside(player, this.rules.ante);
    }
    for (const player of [0, 1] as PlayerId[]) {
      for (let i = 0; i < this.rules.handSize; i++) drawCard(this.ctx, player);
    }
    await this.mulligans();
  }

  private setAside(player: PlayerId, n: number): void {
    const p = this.state.players[player];
    const picked: string[] = [];
    for (const id of [...p.library]) {
      if (picked.length >= n) break;
      if (this.ctx.defs.def(getObject(this.state, id).cardId).types.includes("Land")) continue;
      picked.push(id);
    }
    const objectIds: string[] = [];
    const cardIds: string[] = [];
    for (const id of picked) {
      const cardId = getObject(this.state, id).cardId;
      const newId = moveObject(this.ctx, id, "ante");
      if (newId) {
        objectIds.push(newId);
        cardIds.push(cardId);
      }
    }
    this.ctx.bus.emit("ANTE_SET", { player, cardIds, objectIds });
  }

  /** London mulligan, simplified to sequential players (R-027): draw 7, bottom N — each bottomed card is a choice (ADR-011). */
  private async mulligans(): Promise<void> {
    const { state } = this.ctx;
    for (const player of [0, 1] as PlayerId[]) {
      let mulls = 0;
      for (;;) {
        const canMull = mulls < this.rules.handSize;
        const actions: Action[] = canMull ? [{ type: "keepHand" }, { type: "mulligan" }] : [{ type: "keepHand" }];
        const chosen = await this.request(player, "mulligan", actions);
        if (chosen.type === "mulligan") {
          mulls += 1;
          const p = state.players[player];
          p.mulligans = mulls;
          while (p.hand.length > 0) moveObject(this.ctx, p.hand[0]!, "library");
          p.library = this.ctx.rng.shuffle(p.library, "shuffle");
          for (let i = 0; i < this.rules.handSize; i++) drawCard(this.ctx, player);
        } else {
          for (let i = 0; i < mulls; i++) {
            const choices = bottomChoices(this.ctx, player);
            if (choices.length === 0) break;
            const pick = choices.length === 1 ? choices[0]! : await this.request(player, "bottomCards", choices);
            if (pick.type !== "bottomCard") throw new Error("expected bottomCard");
            moveObject(this.ctx, pick.objectId, "library", { position: "bottom" });
          }
          break;
        }
      }
    }
  }

  // ---------- Main loop ----------

  async run(modifiers: Modifier[] = []): Promise<void> {
    // S13 (Chris): life modifiers apply at state creation, before mulligans,
    // so the first view already shows the real totals (an enemy at world
    // life 8 used to read 10 through the mulligan dialog, then jump). Every
    // other modifier still applies after setup (zones must exist first).
    // All of it is still "initialization" per ADR-002.
    applyModifiers(this.ctx, modifiers.filter((m) => m.type === "startingLife"));
    await this.setup();
    applyModifiers(this.ctx, modifiers.filter((m) => m.type !== "startingLife")); // hook always runs (ADR-002)
    while (!this.state.result) {
      this.state.turn += 1;
      if (this.state.turn > this.rules.maxTurns) {
        this.state.result = { winner: null, reason: "MAX_TURNS" };
        break;
      }
      this.state.activePlayer = ((this.state.turn - 1 + (this.rules.startingPlayer ?? 0)) % 2) as PlayerId;
      for (const p of this.state.players) p.landsPlayedThisTurn = 0;
      for (const step of STEPS) {
        await this.runStep(step);
        if (this.state.result) break;
      }
    }
  }

  async runStep(step: Step): Promise<void> {
    const { state, bus } = this.ctx;
    state.step = step;
    bus.emit("STEP_BEGIN", { step, turn: state.turn, activePlayer: state.activePlayer });
    const active = state.activePlayer;

    switch (step) {
      case "UNTAP": {
        for (const id of state.battlefield) {
          const obj = getObject(state, id);
          if (obj.controller === active) {
            const wasTapped = obj.tapped;
            obj.tapped = false;
            obj.summoningSick = false;
            // A10 word 5 (S22): the untap announces itself; triggers collected here wait for the
            // upkeep's priority (CR 502.4/503.1a — no priority during untap).
            if (wasTapped) bus.emit("UNTAPPED", { objectId: id });
          }
        }
        break; // no priority (CR 502.4)
      }
      case "UPKEEP":
        this.ctx.bus.emit("UPKEEP_BEGIN", { player: active }); // ADR-076: upkeep triggers (Bitterblossom)
        await this.priorityRound();
        break;
      case "DRAW": {
        // First turn of the game: the starting player skips the draw (CR 103.8a).
        if (!(state.turn === 1 && active === (this.rules.startingPlayer ?? 0))) drawCard(this.ctx, active);
        await this.priorityRound();
        break;
      }
      case "MAIN1":
      case "MAIN2":
        await this.priorityRound();
        break;
      case "COMBAT_BEGIN":
        state.combat = emptyCombat();
        await this.priorityRound();
        break;
      case "DECLARE_ATTACKERS": {
        // Incremental declaration (ADR-013): declare one attacker per action
        // until done; taps commit all at once.
        for (;;) {
          const choices = attackerChoices(this.ctx);
          // A lone "done" (nothing can attack / nothing left) is forced and silent (ADR-014).
          const chosen = choices.length === 1 ? choices[0]! : await this.request(active, "declareAttacker", choices);
          if (chosen.type === "doneDeclaringAttackers") break;
          if (chosen.type !== "declareAttacker") throw new Error("expected declareAttacker/done");
          stageAttacker(this.ctx, chosen.objectId);
        }
        commitAttackers(this.ctx);
        if (state.combat.attackers.length === 0) break; // skip rest of combat (CR 508.8)
        await this.priorityRound();
        break;
      }
      case "DECLARE_BLOCKERS": {
        if (state.combat.attackers.length === 0) break;
        const defender = opponentOf(active);
        for (;;) {
          const choices = blockerChoices(this.ctx);
          const chosen = choices.length === 1 ? choices[0]! : await this.request(defender, "declareBlocker", choices);
          if (chosen.type === "doneDeclaringBlockers") break;
          if (chosen.type !== "declareBlocker") throw new Error("expected declareBlocker/done");
          stageBlock(this.ctx, chosen.blocker, chosen.attacker);
        }
        commitBlockers(this.ctx);
        await this.orderBlockerDamage();
        await this.priorityRound();
        break;
      }
      case "FIRST_STRIKE_DAMAGE": {
        if (state.combat.attackers.length === 0) break;
        if (!combatHasFirstStrikers(this.ctx)) break; // step only exists when relevant (R-010)
        dealCombatDamage(this.ctx, assignCombatDamage(this.ctx, true));
        await this.priorityRound();
        break;
      }
      case "COMBAT_DAMAGE": {
        if (state.combat.attackers.length === 0) break;
        dealCombatDamage(this.ctx, assignCombatDamage(this.ctx, false));
        await this.priorityRound();
        break;
      }
      case "COMBAT_END": {
        if (state.combat.attackers.length > 0) await this.priorityRound();
        state.combat = emptyCombat();
        break;
      }
      case "END": {
        // A10 word 3 (S22): the temporary guests pay their exit toll at the beginning of the end
        // step — a sacrifice (no destroy, no indestructible), whose DIES triggers pend and are
        // placed in this step's priority round (the Usher's drain collects its own toll).
        const due = state.endStepSacrifices.filter((s) => s.dueTurn <= state.turn);
        if (due.length > 0) {
          state.endStepSacrifices = state.endStepSacrifices.filter((s) => s.dueTurn > state.turn);
          for (const s of due) {
            if (state.objects[s.objectId]?.zone === "battlefield") moveObject(this.ctx, s.objectId, "graveyard");
          }
        }
        await this.priorityRound();
        break;
      }
      case "CLEANUP": {
        await this.cleanup();
        break;
      }
    }

    emptyManaPools(this.ctx); // pools empty at end of every step (CR 500.4, no mana burn)
  }

  /**
   * The attacking player orders blockers for each multi-blocked attacker
   * (CR 509.2), one pick per action (ADR-011); the last blocker is forced.
   */
  private async orderBlockerDamage(): Promise<void> {
    const { state } = this.ctx;
    for (const attacker of state.combat.attackers) {
      const blockers = state.combat.blockOrder[attacker];
      if (!blockers || blockers.length < 2) continue;
      const remaining = [...blockers];
      const order: string[] = [];
      while (remaining.length > 1) {
        const actions: Action[] = remaining.map((blocker) => ({ type: "orderBlocker", attacker, blocker }));
        const chosen = await this.request(state.activePlayer, "orderBlockerDamage", actions);
        if (chosen.type !== "orderBlocker") throw new Error("expected orderBlocker");
        order.push(chosen.blocker);
        remaining.splice(remaining.indexOf(chosen.blocker), 1);
      }
      order.push(remaining[0]!);
      setBlockOrder(this.ctx, attacker, order);
    }
  }

  private async cleanup(): Promise<void> {
    const { state } = this.ctx;
    const active = state.activePlayer;
    while (state.players[active].hand.length > this.rules.handSize) {
      const chosen = await this.request(active, "discard", discardChoices(this.ctx, active));
      if (chosen.type !== "discard") throw new Error("expected discard");
      discardCard(this.ctx, chosen.objectId);
    }
    for (const id of state.battlefield) getObject(state, id).damage = 0;
    expireEndOfTurnEffects(state);
    // No priority in cleanup unless something triggered (CR 514.3a); the
    // general path exists for safety.
    await runSBAs(this.ctx, (player, purpose, actions) => this.request(player, purpose, actions));
    if (state.pendingTriggers.length > 0) await this.priorityRound();
  }

  // ---------- Priority ----------

  /** SBAs then trigger placement, looped, before anyone receives priority (CR 117.5). */
  private async checkStateAndTriggers(): Promise<void> {
    for (;;) {
      await runSBAs(this.ctx, (player, purpose, actions) => this.request(player, purpose, actions));
      if (this.state.result) return;
      const placed = await placePendingTriggers(this.ctx, (player, purpose, actions, source) =>
        this.request(player, purpose, actions, undefined, source),
      );
      if (!placed) return;
    }
  }

  /** One full priority round: both players until both pass on an empty stack (CR 117). */
  async priorityRound(): Promise<void> {
    const { state } = this.ctx;
    await this.checkStateAndTriggers();
    if (state.result) return;

    let holder = state.activePlayer;
    let passes = 0;
    for (;;) {
      if (state.result) return;
      const actions = legalActions(this.ctx, holder);
      // A lone "pass" is not a decision; auto-pass silently (deterministic,
      // identical in replay, keeps the log readable). S11: an observer may
      // still be shown the window (play-mode "stop on opponent's spell" —
      // the human sees the Hymn before it resolves). Observation only: no
      // request, no log entry, replay unaffected.
      if (actions.length === 1 && this.onLonePass) await this.onLonePass(holder, buildView(this.ctx, holder));
      const chosen = actions.length === 1 ? actions[0]! : await this.request(holder, "priority", actions);
      if (chosen.type === "pass") {
        passes += 1;
        if (passes === 2) {
          if (state.stack.length === 0) return;
          await this.resolveTop();
          if (state.result) return;
          passes = 0;
          holder = state.activePlayer;
          await this.checkStateAndTriggers();
          if (state.result) return;
        } else {
          holder = opponentOf(holder);
        }
      } else {
        await this.applyPriorityAction(holder, chosen);
        passes = 0; // the acting player retains priority (CR 117.3c)
        await this.checkStateAndTriggers();
        if (state.result) return;
      }
    }
  }

  private async applyPriorityAction(player: PlayerId, action: Action): Promise<void> {
    const { state } = this.ctx;
    switch (action.type) {
      case "playLand": {
        // A9 (S20): the shock clause — a logged DecisionRequest on the land PLAY only (put-onto-battlefield
        // paths enter tapped, choice-free). Life is paid before the permanent's ETB state is fixed, so
        // ETB triggers see the final state; paying to exactly 0 is legal and lethal (SBA catches it).
        const landDef = this.ctx.defs.def(getObject(state, action.objectId).cardId);
        let entersTapped = !!landDef.entersTapped; // S20: unconditional taplands (the cycling cycle) — no request
        if (landDef.entersChoice) {
          const payLife = landDef.entersChoice.pay.life;
          if (state.players[player].life >= payLife) {
            const pick = await this.request(player, "entersChoice", [{ type: "acceptOptional" }, { type: "declineOptional" }], undefined, { cardId: landDef.id, effects: [] });
            if (pick.type === "acceptOptional") loseLife(this.ctx, player, payLife);
            else entersTapped = true;
          } else entersTapped = true;
        }
        const playedId = moveObject(this.ctx, action.objectId, "battlefield", { tapped: entersTapped }); // explicit: the play path already asked
        state.players[player].landsPlayedThisTurn += 1;
        // A10 (S22): the special action announces itself (the Sower's trigger; effect-placed lands don't).
        if (playedId) this.ctx.bus.emit("LAND_PLAYED", { objectId: playedId, controller: player });
        break;
      }
      case "castSpell": {
        const obj = getObject(state, action.objectId);
        const def = this.ctx.defs.def(obj.cardId);
        // A6: a modal spell's mode was chosen at cast (one action per mode); its targets/effects are the mode's.
        const mode = def.modes ? def.modes[action.mode ?? -1] : undefined;
        if (def.modes && !mode) throw new Error("modal spell cast without a legal mode");
        const specs = mode ? (mode.targets ?? []) : (def.targets ?? []);
        const effects = mode ? mode.effects : (def.spellEffect ?? []);
        // A10 word 4 (S22): any-number targeting — the cast enters a logged choose-target/done loop
        // (the chooseMode/ADR-013 precedents fused) instead of enumerated combinations. Picks are
        // distinct; another pick is offered only while its per-target life is payable (CR 118.4 —
        // down to exactly 0 is legal and lethal, the A9 shock precedent). Done is always first.
        let targets = action.targets;
        const variable = specs.length === 1 && specs[0]!.count === "any";
        if (variable) {
          targets = [];
          const lifePer = def.additionalCost?.perTarget ? (def.additionalCost.life ?? 0) : 0;
          const key = (t: unknown) => JSON.stringify(t);
          for (;;) {
            const chosen = new Set(targets.map(key));
            const affordable = lifePer === 0 || state.players[player].life >= lifePer * (targets.length + 1);
            const cands = affordable ? targetCandidates(this.ctx, specs[0]!, player, action.objectId).filter((t) => !chosen.has(key(t))) : [];
            const options: Action[] = [{ type: "doneChoosingTargets" }, ...cands.map((target) => ({ type: "chooseVariableTarget" as const, target }))];
            const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseVariableTarget", options, undefined, { cardId: obj.cardId, effects });
            if (pick.type === "doneChoosingTargets") break;
            if (pick.type !== "chooseVariableTarget") throw new Error("expected chooseVariableTarget/done");
            targets = [...targets, pick.target];
          }
        } else {
          // A8 (S20): fixed specs consume their count in order; a trailing range spec takes the rest
          // (length within [min,max]; distinctness enforced when the spec asks).
          validateTargetsAgainstSpecs(this.ctx, specs, targets, player, action.objectId);
        }
        autoPay(this.ctx, player, parseManaCost(def.manaCost), action.x ?? 0);
        // A10 word 4 companion: the life cost computes at 601.2h from the final count, is paid at
        // cast, and is never refunded on counter/fizzle (the printed Purge ruling agrees).
        if (def.additionalCost?.life) {
          const lifeCost = def.additionalCost.life * (def.additionalCost.perTarget ? targets.length : 1);
          if (lifeCost > 0) loseLife(this.ctx, player, lifeCost);
        }
        // A7: additional cost — paid at 601.2h like an ability's sacrifice; a DIES trigger pends and orders normally.
        if (def.additionalCost?.sacrifice) {
          const candidates = sacrificeCandidates(this.ctx, player, action.objectId, def.additionalCost.sacrifice.predicate);
          if (candidates.length === 0) throw new Error("additional cost: no legal sacrifice");
          const options: Action[] = candidates.map((objectId) => ({ type: "sacrifice", objectId }));
          const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseSacrifice", options, undefined, { cardId: obj.cardId, effects });
          if (pick.type !== "sacrifice") throw new Error("expected sacrifice");
          moveObject(this.ctx, pick.objectId, "graveyard");
        }
        const newId = moveObject(this.ctx, action.objectId, "stack");
        if (!newId) throw new Error("spell object vanished moving to stack");
        state.stack.push({
          id: this.ctx.ids.next("stk"),
          kind: "spell",
          objectId: newId,
          sourceCardId: obj.cardId,
          controller: player,
          targetSpecs: specs,
          targets,
          effects,
          x: action.x ?? 0,
          ...(action.mode !== undefined ? { mode: action.mode } : {}),
        });
        this.ctx.bus.emit("SPELL_CAST", { cardId: obj.cardId, controller: player });
        break;
      }
      case "tapForMana": {
        tapForMana(this.ctx, action.objectId, action.color);
        break;
      }
      case "activateAbility": {
        const obj = getObject(state, action.objectId);
        // A10 word 8 (S22): the index addresses the VIRTUAL ability list — printed abilities followed
        // by granted ones (the Stoker's cycling, the Felidar's tapper). Stable within one priority
        // window, which is the only span between enumeration and this call.
        const entry = abilitiesOf(this.ctx, action.objectId)[action.abilityIndex];
        const ability = entry?.ability;
        if (!ability || ability.kind !== "activated") throw new Error("no such activated ability");
        const zone = ability.zone ?? "battlefield";
        if (obj.zone !== zone) throw new Error(`ability of ${obj.cardId} is activatable from the ${zone}, not the ${obj.zone} (A5)`);
        if (ability.cost.tap) {
          if (obj.tapped) throw new Error("tap cost on tapped object");
          obj.tapped = true;
          this.ctx.bus.emit("TAPPED", { objectId: obj.id });
        }
        // ADR-076: reduced costs (Baru) — the enumerator priced the same effective cost.
        const manaCost = effectiveAbilityCost(this.ctx, player, ability, obj.id);
        if (manaCost) autoPay(this.ctx, player, manaCost, action.x ?? 0);
        // ADR-076: discard N as a cost (Waterfront Bouncer) — chooser's pick, one request per card, deduped by cardId.
        for (let n = 0; n < (ability.cost.discard ?? 0); n++) {
          const hand = state.players[player].hand.filter((id) => id !== obj.id);
          const seen = new Set<string>();
          const options: Action[] = [];
          for (const id of hand) {
            const cid = getObject(state, id).cardId;
            if (seen.has(cid)) continue;
            seen.add(cid);
            options.push({ type: "discard", objectId: id });
          }
          if (options.length === 0) throw new Error("discard cost with an empty hand");
          const pick = options.length === 1 ? options[0]! : await this.request(player, "discardCost", options, undefined, { cardId: obj.cardId, effects: ability.effects });
          if (pick.type !== "discard") throw new Error("expected discard");
          discardCard(this.ctx, pick.objectId);
        }
        // A5: self-costs of zone abilities — cycling discards the card, Mother Bear exiles herself.
        // The ability's source becomes the card's new identity (its effects never reference it).
        let sourceId = obj.id;
        if (ability.cost.discardSelf) {
          const before = obj.id;
          discardCard(this.ctx, before);
          sourceId = before;
        }
        if (ability.cost.exileSelf) {
          const moved = moveObject(this.ctx, obj.id, "exile");
          sourceId = moved ?? obj.id;
        }
        // A10 word 2 (S22): bounce-own-permanent-as-cost (the Unwinder) — chosen like a sacrifice,
        // moved before the ability stacks. The resulting RETURNED_TO_HAND trigger pends and orders
        // normally (the interlock: his own cost feeds his own ping).
        if (ability.cost.returnToHand) {
          const candidates = returnToHandCandidates(this.ctx, player, obj.id, ability.cost.returnToHand.predicate);
          if (candidates.length === 0) throw new Error("no legal permanent to return for the cost");
          const options: Action[] = candidates.map((objectId) => ({ type: "returnToHand", objectId }));
          const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseBounceCost", options, undefined, { cardId: obj.cardId, effects: ability.effects });
          if (pick.type !== "returnToHand") throw new Error("expected returnToHand");
          const moved = moveObject(this.ctx, pick.objectId, "hand");
          if (pick.objectId === sourceId) sourceId = moved ?? sourceId; // a self-bounce updates the ability's source identity (the discardSelf pattern)
        }
        // A10 word 6 (S22): tap-untapped-creatures-as-cost (Glare) — one pick per required creature;
        // candidates re-evaluate between picks (each tap removes its creature from the pool).
        for (let n = 0; n < (ability.cost.tapCreature?.count ?? 0); n++) {
          const candidates = tapCreatureCandidates(this.ctx, player, ability.cost.tapCreature!.predicate);
          if (candidates.length === 0) throw new Error("no untapped creature to tap for the cost");
          const options: Action[] = candidates.map((objectId) => ({ type: "tapCreature", objectId }));
          const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseTapCost", options, undefined, { cardId: obj.cardId, effects: ability.effects });
          if (pick.type !== "tapCreature") throw new Error("expected tapCreature");
          const tapped = getObject(state, pick.objectId);
          tapped.tapped = true;
          this.ctx.bus.emit("TAPPED", { objectId: pick.objectId });
        }
        // Sacrifice is paid before the ability is on the stack (CR 601.2h,
        // 602.2b); a resulting DIES trigger pends and is ordered normally.
        if (ability.cost.sacrifice) {
          const candidates = sacrificeCandidates(this.ctx, player, obj.id, ability.cost.sacrifice.predicate);
          if (candidates.length === 0) throw new Error("no legal sacrifice");
          const options: Action[] = candidates.map((objectId) => ({ type: "sacrifice", objectId }));
          // S18 (S8 concern 5 resolved): the request carries the ability as its source so the chooser
          // can see what the sacrifice buys (the Aristocrat's Vampire counters — don't sac the Vampire).
          const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseSacrifice", options, undefined, { cardId: obj.cardId, effects: ability.effects });
          if (pick.type !== "sacrifice") throw new Error("expected sacrifice");
          moveObject(this.ctx, pick.objectId, "graveyard");
        }
        // ADR-068 Amendment 2: a choice-bearing mana ability (Lotus) resolves
        // immediately — mana abilities don't use the stack (CR 605.3b); the
        // colour choice is the logged action itself.
        if (isChoiceManaAbility(ability)) {
          const pool = state.players[player].manaPool;
          for (const e of ability.effects) {
            if (e.type !== "addMana") continue;
            if (e.choice) {
              if (!action.color) throw new Error("choice mana ability needs a colour");
              pool[action.color] += e.choice.count;
            } else if (e.mana) {
              for (const sym of parseManaProduction(e.mana)) pool[sym.symbol] += 1;
            }
          }
          break;
        }
        state.stack.push({
          id: this.ctx.ids.next("stk"),
          kind: "ability",
          sourceId,
          sourceCardId: obj.cardId,
          controller: player,
          targetSpecs: ability.targets ?? [],
          targets: action.targets,
          effects: ability.effects,
          x: action.x ?? 0,
          ...(ability.equip ? { isEquip: true } : {}),
        });
        break;
      }
      default:
        throw new Error(`Not a priority action: ${action.type}`);
    }
  }

  // ---------- Resolution ----------

  private async resolveTop(): Promise<void> {
    const { state } = this.ctx;
    const item = state.stack.pop();
    if (!item) throw new Error("resolveTop on empty stack");

    // Re-check targets; if the item has targets and ALL are now illegal, it
    // fizzles — "countered by game rules" (CR 608.2b, R-004). A zero-target cast
    // (A10's any-number loop closed immediately) is not a fizzle — it resolves doing nothing.
    if (item.targetSpecs.length > 0 && item.targets.length > 0) {
      const anyLegal = item.targets.some((t, i) => isLegalTarget(this.ctx, item.targetSpecs[i]!, t, item.controller, item.sourceId ?? item.objectId));
      if (!anyLegal) {
        this.ctx.log.append({ t: "EVENT", name: "FIZZLE", payload: { cardId: item.sourceCardId } });
        if (item.objectId) moveObject(this.ctx, item.objectId, "graveyard");
        return;
      }
    }

    // Equip resolution (CR 702.6): attach the source to the target. Re-equip
    // is just reassignment — attachment is a field, not a zone change.
    if (item.isEquip) {
      const equipment = item.sourceId ? state.objects[item.sourceId] : undefined;
      const host = item.targets[0];
      if (equipment && equipment.zone === "battlefield" && host?.kind === "object" && state.objects[host.id]) {
        const previousHost = equipment.attachedTo;
        equipment.attachedTo = host.id;
        this.ctx.bus.emit("ATTACHED", { objectId: equipment.id, previousHost, newHost: host.id, cause: "equip" });
      }
      return;
    }

    // Optional ("you may") triggers ask their controller on resolution
    // (ADR-027, CR 603.5). Never silent: both options always exist. The
    // request carries the trigger's identity (ADR-048 source pattern; S10
    // playtest: the UI must show WHAT is asking).
    if (item.isOptionalTrigger) {
      // A10 word 9 rider (S22): an optionalCost gates the accept option on payability and pays on
      // yes (Tainted Phoenix's {B}); unpayable → the lone decline is auto-taken (ADR-014).
      const canAccept = !item.optionalCost || canPay(this.ctx, item.controller, parseManaCost(item.optionalCost.mana));
      const options: Action[] = canAccept ? [{ type: "acceptOptional" }, { type: "declineOptional" }] : [{ type: "declineOptional" }];
      const chosen =
        options.length === 1
          ? options[0]!
          : await this.request(item.controller, "optionalTrigger", options, undefined, { cardId: item.sourceCardId, effects: item.effects });
      if (chosen.type === "declineOptional") return;
      if (item.optionalCost) autoPay(this.ctx, item.controller, parseManaCost(item.optionalCost.mana), 0);
    }

    // A10 word 7 (S22) — the punisher fork: the event's player (the Stoker's caster; else the
    // controller's opponent) pays or the stated effects happen. Pay is offered only at life
    // STRICTLY above the cost (the ruled auto-resolve at life ≤ cost; ADR-014 takes the lone
    // decline silently). Single request, logged; paying ends the resolution.
    if (item.unlessPay) {
      const payer = item.eventContext?.player ?? opponentOf(item.controller);
      const cost = item.unlessPay.life;
      const options: Action[] =
        this.state.players[payer].life > cost
          ? [{ type: "acceptOptional" }, { type: "declineOptional" }]
          : [{ type: "declineOptional" }];
      const chosen =
        options.length === 1
          ? options[0]!
          : await this.request(payer, "unlessPay", options, undefined, { cardId: item.sourceCardId, effects: item.effects });
      if (chosen.type === "acceptOptional") {
        loseLife(this.ctx, payer, cost);
        return;
      }
    }

    const ectx = makeEffectContext(this.ctx, item, (player, purpose, actions, revealed) =>
      this.request(player, purpose, actions, revealed),
    );
    for (const effect of item.effects) await resolveEffect(effect, ectx);

    if (item.kind === "spell" && item.objectId && state.objects[item.objectId]) {
      const def = this.ctx.defs.def(item.sourceCardId);
      const isPermanent =
        def.types.includes("Creature") || def.types.includes("Enchantment") || def.types.includes("Artifact");
      if (isPermanent) {
        const isAura = def.subtypes?.includes("Aura") ?? false;
        if (isAura) {
          const host = item.targets[0];
          if (host?.kind !== "object") throw new Error("aura resolving without object target");
          moveObject(this.ctx, item.objectId, "battlefield", { attachedTo: host.id });
        } else {
          moveObject(this.ctx, item.objectId, "battlefield");
        }
      } else {
        // A10 (S22): Overload's rider — the resolving spell exiles itself; countered/fizzled
        // copies still reach the graveyard (CR 608.2b — the fizzle path above keeps that).
        moveObject(this.ctx, item.objectId, def.selfExileOnResolve ? "exile" : "graveyard");
      }
    }
  }
}

/** A8 (S20): validate a flat target list against specs where the last spec may be a range. */
export function validateTargetsAgainstSpecs(
  ctx: EngineCtx,
  specs: readonly import("@shandalar/cards").TargetSpec[],
  targets: readonly import("@shandalar/cards").ResolvedTarget[],
  player: PlayerId,
  sourceId?: string,
): void {
  let at = 0;
  const key = (t: unknown) => JSON.stringify(t);
  for (const spec of specs) {
    const width = typeof spec.count === "number" ? spec.count : targets.length - at;
    if (typeof spec.count !== "number") {
      // A10: an "any"-count spec has no bounds — the cast loop chose the list; distinctness still holds.
      if (spec.count !== "any" && (width < spec.count.min || width > spec.count.max)) throw new Error(`range spec expects ${spec.count.min}..${spec.count.max} targets, got ${width}`);
      const seen = new Set<string>();
      for (let i = at; i < at + width; i++) {
        const k = key(targets[i]);
        if (seen.has(k)) throw new Error("range spec targets must be distinct");
        seen.add(k);
        if (spec.distinctFromPrior && targets.slice(0, at).some((t) => key(t) === k)) throw new Error("target repeats an earlier pick (distinctFromPrior)");
      }
    }
    for (let i = at; i < at + width; i++) {
      const t = targets[i];
      if (!t || !isLegalTarget(ctx, spec, t, player, sourceId)) throw new Error(`illegal target ${JSON.stringify(t)}`);
    }
    at += width;
  }
  if (at !== targets.length) throw new Error(`expected ${at} targets, got ${targets.length}`);
}

