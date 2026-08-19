import { EventBus, IdGen, type LogSink, type Rng } from "@shandalar/core";
import { parseManaCost, resolveEffect, type CardDef } from "@shandalar/cards";
import { sameAction, type Action } from "./actions.js";
import {
  assignCombatDamage,
  combatHasFirstStrikers,
  dealCombatDamage,
  declareAttackers,
  declareBlockers,
} from "./combat.js";
import type { EngineCtx } from "./ctx.js";
import { expireEndOfTurnEffects } from "./characteristics.js";
import { makeEffectContext } from "./effect-context.js";
import { attackDeclarations, blockDeclarations, discardChoices, legalActions } from "./enumerator.js";
import type { GameEventMap } from "./events.js";
import { autoPay, emptyManaPools, tapForMana } from "./mana.js";
import { applyModifiers, type Modifier } from "./modifiers.js";
import { drawCard } from "./ops.js";
import { runSBAs } from "./sba.js";
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
  | "declareAttackers"
  | "declareBlockers"
  | "mulligan"
  | "discard"
  | "triggerTargets";

export interface ActionRequest {
  player: PlayerId;
  purpose: RequestPurpose;
  actions: Action[];
}

/** Live play wraps agents; replay feeds logged actions. Same seam for both. */
export type ActionSource = (req: ActionRequest, view: GameView) => Promise<Action>;

export interface GameRules {
  startingLife: number;
  handSize: number;
  maxTurns: number;
}

export const DEFAULT_RULES: GameRules = { startingLife: 20, handSize: 7, maxTurns: 100 };

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

  /** EVENT log entries used to derive MatchResult facts (not consumed by replay). */
  private wireFactEvents(): void {
    const { bus, log } = this.ctx;
    bus.on("DAMAGE", (e) => log.append({ t: "EVENT", name: "DAMAGE", payload: e }));
    bus.on("CARD_DRAWN", (e) => log.append({ t: "EVENT", name: "CARD_DRAWN", payload: e }));
    bus.on("SPELL_CAST", (e) => log.append({ t: "EVENT", name: "SPELL_CAST", payload: e }));
    bus.on("ZONE_CHANGE", (e) => {
      if (e.from === "battlefield" && e.to === "graveyard") {
        log.append({ t: "EVENT", name: "DIES", payload: { cardId: e.cardId, owner: e.owner } });
      }
    });
  }

  /** Ask the action source for a decision; validate and log it. */
  private async request(player: PlayerId, purpose: RequestPurpose, actions: Action[]): Promise<Action> {
    if (actions.length === 0) throw new Error(`request with no actions (${purpose})`);
    const chosen = await this.source({ player, purpose, actions }, buildView(this.ctx, player));
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
    for (const player of [0, 1] as PlayerId[]) {
      for (let i = 0; i < this.rules.handSize; i++) drawCard(this.ctx, player);
    }
    await this.mulligans();
  }

  /** London mulligan, simplified (R-027): draw 7, bottom N; bottomed cards are the last N drawn (deterministic interim). */
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
          while (p.hand.length > 0) moveObject(this.ctx, p.hand[0]!, "library");
          p.library = this.ctx.rng.shuffle(p.library, "shuffle");
          for (let i = 0; i < this.rules.handSize; i++) drawCard(this.ctx, player);
        } else {
          const p = state.players[player];
          for (let i = 0; i < mulls; i++) {
            const last = p.hand[p.hand.length - 1];
            if (last === undefined) break;
            moveObject(this.ctx, last, "library", { position: "bottom" });
          }
          break;
        }
      }
    }
  }

  // ---------- Main loop ----------

  async run(modifiers: Modifier[] = []): Promise<void> {
    await this.setup();
    applyModifiers(this.ctx, modifiers); // hook always runs, empty in v1 (ADR-002)
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
        const declarations = attackDeclarations(this.ctx);
        // A single option (attack with nothing) is not a decision; skip the ask.
        const chosen =
          declarations.length === 1
            ? declarations[0]!
            : await this.request(active, "declareAttackers", declarations);
        if (chosen.type !== "declareAttackers") throw new Error("expected declareAttackers");
        declareAttackers(this.ctx, chosen.attackers);
        if (state.combat.attackers.length === 0) break; // skip rest of combat (CR 508.8)
        await this.priorityRound();
        break;
      }
      case "DECLARE_BLOCKERS": {
        if (state.combat.attackers.length === 0) break;
        const declarations = blockDeclarations(this.ctx);
        const defender = opponentOf(active);
        const chosen =
          declarations.length === 1
            ? declarations[0]!
            : await this.request(defender, "declareBlockers", declarations);
        if (chosen.type !== "declareBlockers") throw new Error("expected declareBlockers");
        declareBlockers(this.ctx, chosen.blocks);
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
    // No priority in cleanup unless something triggered (CR 514.3a). S1 has no
    // cleanup triggers, but the general path is kept for safety.
    runSBAs(this.ctx);
    if (state.pendingTriggers.length > 0) await this.priorityRound();
  }

  // ---------- Priority ----------

  /** SBAs then trigger placement, looped, before anyone receives priority (CR 117.5). */
  private async checkStateAndTriggers(): Promise<void> {
    for (;;) {
      runSBAs(this.ctx);
      if (this.state.result) return;
      const placed = await placePendingTriggers(this.ctx, (player, purpose, actions) =>
        this.request(player, purpose, actions),
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
      // identical in replay, keeps the log readable).
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
        this.applyPriorityAction(holder, chosen);
        passes = 0; // the acting player retains priority (CR 117.3c)
        await this.checkStateAndTriggers();
        if (state.result) return;
      }
    }
  }

  private applyPriorityAction(player: PlayerId, action: Action): void {
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

    const ectx = makeEffectContext(this.ctx, item);
    for (const effect of item.effects) resolveEffect(effect, ectx);

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
