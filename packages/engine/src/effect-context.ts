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
import { dealDamage, drawCard } from "./ops.js";
import { moveObject } from "./zones.js";
import { getObject, nextTimestamp, opponentOf, type PlayerId, type StackItem } from "./state.js";
import { isCreature } from "./characteristics.js";

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
      for (const sym of parseManaProduction(mana)) {
        if (sym.color) pool[sym.color] += 1;
      }
    },
  };
}
