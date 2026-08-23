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
import { attackerChoices, blockerChoices, bottomChoices, discardChoices, legalActions } from "./enumerator.js";
import type { GameEventMap } from "./events.js";
import { autoPay, emptyManaPools, tapForMana } from "./mana.js";
import { applyModifiers, type Modifier } from "./modifiers.js";
import { drawCard } from "./ops.js";
import { runSBAs } from "./sba.js";
import { sacrificeCandidates } from "./sacrifice.js";
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
import { isLegalTarget } from "./targeting.js";
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
  | "searchLibrary";

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
      this.state.activePlayer = ((this.state.turn - 1) % 2) as PlayerId;
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
            obj.tapped = false;
            obj.summoningSick = false;
          }
        }
        break; // no priority (CR 502.4)
      }
      case "UPKEEP":
        await this.priorityRound();
        break;
      case "DRAW": {
        // First turn of the game: the starting player skips the draw (CR 103.8a).
        if (!(state.turn === 1 && active === 0)) drawCard(this.ctx, active);
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
      case "END":
        await this.priorityRound();
        break;
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
      moveObject(this.ctx, chosen.objectId, "graveyard");
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
        moveObject(this.ctx, action.objectId, "battlefield");
        state.players[player].landsPlayedThisTurn += 1;
        break;
      }
      case "castSpell": {
        const obj = getObject(state, action.objectId);
        const def = this.ctx.defs.def(obj.cardId);
        const specs = def.targets ?? [];
        action.targets.forEach((t, i) => {
          const spec = specs[i];
          if (!spec || !isLegalTarget(this.ctx, spec, t, player)) {
            throw new Error(`castSpell with illegal target ${JSON.stringify(t)}`);
          }
        });
        autoPay(this.ctx, player, parseManaCost(def.manaCost), action.x ?? 0);
        const newId = moveObject(this.ctx, action.objectId, "stack");
        if (!newId) throw new Error("spell object vanished moving to stack");
        state.stack.push({
          id: this.ctx.ids.next("stk"),
          kind: "spell",
          objectId: newId,
          sourceCardId: obj.cardId,
          controller: player,
          targetSpecs: specs,
          targets: action.targets,
          effects: def.spellEffect ?? [],
          x: action.x ?? 0,
        });
        this.ctx.bus.emit("SPELL_CAST", { cardId: obj.cardId, controller: player });
        break;
      }
      case "tapForMana": {
        tapForMana(this.ctx, action.objectId);
        break;
      }
      case "activateAbility": {
        const obj = getObject(state, action.objectId);
        const def = this.ctx.defs.def(obj.cardId);
        const ability = def.abilities?.[action.abilityIndex];
        if (!ability || ability.kind !== "activated") throw new Error("no such activated ability");
        if (ability.cost.tap) {
          if (obj.tapped) throw new Error("tap cost on tapped object");
          obj.tapped = true;
          this.ctx.bus.emit("TAPPED", { objectId: obj.id });
        }
        if (ability.cost.mana) autoPay(this.ctx, player, parseManaCost(ability.cost.mana), action.x ?? 0);
        // Sacrifice is paid before the ability is on the stack (CR 601.2h,
        // 602.2b); a resulting DIES trigger pends and is ordered normally.
        if (ability.cost.sacrifice) {
          const candidates = sacrificeCandidates(this.ctx, player, obj.id, ability.cost.sacrifice.predicate);
          if (candidates.length === 0) throw new Error("no legal sacrifice");
          const options: Action[] = candidates.map((objectId) => ({ type: "sacrifice", objectId }));
          const pick = options.length === 1 ? options[0]! : await this.request(player, "chooseSacrifice", options);
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
          sourceId: obj.id,
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
    // fizzles — "countered by game rules" (CR 608.2b, R-004).
    if (item.targetSpecs.length > 0) {
      const anyLegal = item.targets.some((t, i) => isLegalTarget(this.ctx, item.targetSpecs[i]!, t, item.controller));
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
      const chosen = await this.request(
        item.controller,
        "optionalTrigger",
        [{ type: "acceptOptional" }, { type: "declineOptional" }],
        undefined,
        { cardId: item.sourceCardId, effects: item.effects },
      );
      if (chosen.type === "declineOptional") return;
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
        moveObject(this.ctx, item.objectId, "graveyard");
      }
    }
  }
}
