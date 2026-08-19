import {
  parseManaProduction,
  type Amount,
  type EffectContext,
  type ResolvedContinuousEffect,
  type ResolvedTarget,
  type Scope,
  type Who,
} from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { isLegalTarget } from "./targeting.js";
import { dealDamage, drawCard, gainLife } from "./ops.js";
import { createObject, moveObject } from "./zones.js";
import { getObject, nextTimestamp, opponentOf, type PlayerId, type StackItem } from "./state.js";
import { characteristics, isCreature } from "./characteristics.js";

/** Engine implementation of the cards package's EffectContext seam. */
export function makeEffectContext(ctx: EngineCtx, item: StackItem): EffectContext {
  const controller = item.controller;

  const sourceForDamage = () => {
    // A spell's damage source is the spell object; an ability's is its source permanent.
    const id = item.objectId ?? item.sourceId ?? "";
    return { id, cardId: item.sourceCardId, controller };
  };

  return {
    target(i: number): ResolvedTarget | null {
      const t = item.targets[i];
      const spec = item.targetSpecs[i];
      if (!t || !spec) return null;
      return isLegalTarget(ctx, spec, t, controller) ? t : null;
    },

    players(who: Who): PlayerId[] {
      switch (who) {
        case "you":
          return [controller];
        case "opponent":
          return [opponentOf(controller)];
        case "eachPlayer": {
          // APNAP order (CR 101.4).
          const active = ctx.state.activePlayer;
          return [active, opponentOf(active)];
        }
      }
    },

    objectsInScope(scope: Scope): string[] {
      switch (scope) {
        case "creaturesYouControl":
          return ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller === controller && isCreature(ctx, id),
          );
        case "allCreatures":
          return ctx.state.battlefield.filter((id) => isCreature(ctx, id));
        case "attached":
          throw new Error(`scope "attached" is only valid on static abilities`);
        case "you":
        case "opponent":
        case "eachPlayer":
          return [];
      }
    },

    amount(a: Amount): number {
      return a === "X" ? item.x : a;
    },

    dealDamage(target: ResolvedTarget, amount: number): void {
      if (target.kind === "stackItem") throw new Error("cannot damage a stack item");
      dealDamage(ctx, sourceForDamage(), target, amount, false);
    },

    bounce(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      moveObject(ctx, objectId, "hand");
    },

    counterSpell(stackItemId: string): void {
      const idx = ctx.state.stack.findIndex((s) => s.id === stackItemId);
      if (idx === -1) return;
      // "This spell can't be countered" (Blurred Mongoose): the counter
      // resolves but does nothing to it.
      const target = ctx.state.stack[idx]!;
      if ((ctx.defs.def(target.sourceCardId).keywords ?? []).includes("cant be countered")) return;
      const [countered] = ctx.state.stack.splice(idx, 1);
      if (countered!.objectId) moveObject(ctx, countered!.objectId, "graveyard");
    },

    draw(player: number, count: number): void {
      for (let i = 0; i < count; i++) drawCard(ctx, player as PlayerId);
    },

    addContinuousEffect(effect: ResolvedContinuousEffect): void {
      if (effect.duration === "WHILE_SOURCE_ON_BATTLEFIELD") {
        throw new Error("resolved effects cannot have static duration");
      }
      ctx.state.continuousEffects.push({
        kind: effect.kind,
        objectId: effect.objectId,
        ...(effect.power !== undefined && { power: effect.power }),
        ...(effect.toughness !== undefined && { toughness: effect.toughness }),
        ...(effect.keyword !== undefined && { keyword: effect.keyword }),
        ...(effect.what !== undefined && { what: effect.what }),
        duration: effect.duration,
        sourceStackItemId: item.id,
        timestamp: nextTimestamp(ctx.state),
      });
    },

    addMana(player: number, mana: string): void {
      const pool = ctx.state.players[player as PlayerId].manaPool;
      for (const sym of parseManaProduction(mana)) pool[sym.symbol] += 1;
    },

    ...sharedOps(ctx),
  };
}

/** Ops with no dependency on a stack item, shared with the init context. */
function sharedOps(ctx: EngineCtx) {
  return {
    createToken(player: number, tokenId: string, count: number): void {
      for (let i = 0; i < count; i++) {
        createObject(ctx, tokenId, player as PlayerId, "battlefield", { isToken: true });
      }
    },

    addCounters(objectId: string, kind: "+1/+1" | "-1/-1", count: number): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      obj.counters[kind] = (obj.counters[kind] ?? 0) + count;
    },

    gainLife(player: number, amount: number): void {
      gainLife(ctx, player as PlayerId, amount);
    },

    destroy(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      if (characteristics(ctx, objectId).keywords.has("indestructible")) return;
      moveObject(ctx, objectId, "graveyard");
    },

    fight(idA: string, idB: string): void {
      const a = ctx.state.objects[idA];
      const b = ctx.state.objects[idB];
      if (!a || !b || a.zone !== "battlefield" || b.zone !== "battlefield") return;
      // Simultaneous (CR 701.12a): read both powers before dealing either side.
      const powerA = characteristics(ctx, idA).power;
      const powerB = characteristics(ctx, idB).power;
      if (powerA > 0) {
        dealDamage(ctx, { id: idA, cardId: a.cardId, controller: a.controller }, { kind: "object", id: idB }, powerA, false);
      }
      if (powerB > 0) {
        dealDamage(ctx, { id: idB, cardId: b.cardId, controller: b.controller }, { kind: "object", id: idA }, powerB, false);
      }
    },
  };
}

/**
 * Stack-item-less EffectContext for initialization-time effects — MatchSpec
 * `effectAtStart` modifiers (ADR-012). No targets, no X.
 */
export function makeInitEffectContext(ctx: EngineCtx, player: PlayerId): EffectContext {
  return {
    target(): ResolvedTarget | null {
      throw new Error("initialization effects cannot target");
    },
    players(who: Who): PlayerId[] {
      switch (who) {
        case "you":
          return [player];
        case "opponent":
          return [opponentOf(player)];
        case "eachPlayer":
          return [0, 1];
      }
    },
    objectsInScope(scope: Scope): string[] {
      switch (scope) {
        case "creaturesYouControl":
          return ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller === player && isCreature(ctx, id),
          );
        case "allCreatures":
          return ctx.state.battlefield.filter((id) => isCreature(ctx, id));
        default:
          return [];
      }
    },
    amount(a: Amount): number {
      return a === "X" ? 0 : a;
    },
    dealDamage(target: ResolvedTarget, amount: number): void {
      if (target.kind === "stackItem") throw new Error("cannot damage a stack item");
      dealDamage(ctx, { id: "init", cardId: "init", controller: player }, target, amount, false);
    },
    bounce(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      moveObject(ctx, objectId, "hand");
    },
    counterSpell(): void {
      throw new Error("initialization effects cannot counter");
    },
    draw(player_: number, count: number): void {
      for (let i = 0; i < count; i++) drawCard(ctx, player_ as PlayerId);
    },
    addContinuousEffect(): void {
      throw new Error("initialization effects cannot create continuous effects (no source to bound them)");
    },
    addMana(): void {
      throw new Error("initialization effects cannot add mana (pools empty before turn 1)");
    },
    ...sharedOps(ctx),
  };
}
