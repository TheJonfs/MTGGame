import {
  parseManaProduction,
  type Amount,
  type DiscardFilter,
  type DiscardMode,
  type EffectContext,
  type ResolvedContinuousEffect,
  type ResolvedTarget,
  type Scope,
  type Who,
} from "@shandalar/cards";
import type { Action } from "./actions.js";
import type { EngineCtx } from "./ctx.js";
import { isLegalTarget } from "./targeting.js";
import { dealDamage, drawCard, gainLife, loseLife } from "./ops.js";
import { createObject, moveObject } from "./zones.js";
import { getObject, nextTimestamp, opponentOf, type PlayerId, type StackItem } from "./state.js";
import { characteristics, isCreature } from "./characteristics.js";

/**
 * Decision seam for effects that ask a player something (ADR-029 discard).
 * The Game provides its request(); the init context has none.
 */
export type EffectRequester = (
  player: PlayerId,
  purpose: "discard",
  actions: Action[],
  revealed?: { objectId: string; cardId: string }[],
) => Promise<Action>;

/** Last known information per target (CR 608.2h, ADR-028): captured at resolution start. */
interface TargetLki {
  power: number;
  controller: PlayerId;
}

/** Engine implementation of the cards package's EffectContext seam. */
export function makeEffectContext(ctx: EngineCtx, item: StackItem, requester?: EffectRequester): EffectContext {
  const controller = item.controller;

  // LKI snapshot before any effect applies: an object exiled by effect 1 can
  // still feed effect 2's targetPower / controllerOfTarget (Swords).
  const lki: (TargetLki | null)[] = item.targets.map((t) => {
    if (t.kind !== "object") return null;
    const obj = ctx.state.objects[t.id];
    if (!obj || obj.zone !== "battlefield") return null;
    return { power: characteristics(ctx, t.id).power, controller: obj.controller };
  });

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
        case "target": {
          const t = item.targets[0];
          return t?.kind === "player" ? [t.player as PlayerId] : [];
        }
        case "controllerOfTarget": {
          // LKI controller of the first object target (ADR-028; Swords).
          const snap = lki.find((l) => l !== null);
          return snap ? [snap.controller] : [];
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
        case "self": {
          // The resolving item's source, wherever it now is — Drana pumps
          // herself on the battlefield; Rancor returns itself from the graveyard.
          const id = item.sourceId ?? item.objectId;
          return id && ctx.state.objects[id] ? [id] : [];
        }
        case "you":
        case "opponent":
        case "eachPlayer":
          return [];
      }
    },

    amount(a: Amount): number {
      if (a === "X") return item.x;
      if (typeof a === "number") return a;
      // ValueRef (ADR-028): last known information from the resolution snapshot.
      const snap = lki[a.target];
      return snap ? snap.power : 0;
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
    ...discardOp(ctx, controller, requester),
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

    loseLife(player: number, amount: number): void {
      loseLife(ctx, player as PlayerId, amount);
    },

    destroy(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      if (characteristics(ctx, objectId).keywords.has("indestructible")) return;
      moveObject(ctx, objectId, "graveyard");
    },

    tap(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield" || obj.tapped) return;
      obj.tapped = true;
      ctx.bus.emit("TAPPED", { objectId });
    },

    exile(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      moveObject(ctx, objectId, "exile"); // not a death: no DIES trigger fires (700.4)
    },

    returnFromGraveyard(objectId: string, to: "battlefield" | "hand"): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "graveyard") return; // raced away: nothing to return
      moveObject(ctx, objectId, to); // to battlefield fires ETB triggers normally
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

/** ADR-029 discard implementation. `caster` = controller of the discarding effect. */
function discardOp(ctx: EngineCtx, caster: PlayerId, requester?: EffectRequester) {
  const matchesFilter = (cardId: string, filter?: DiscardFilter): boolean => {
    if (!filter) return true;
    const def = ctx.defs.def(cardId);
    return !def.types.includes("Creature") && !def.types.includes("Land"); // noncreatureNonland
  };

  return {
    async discard(playerNum: number, count: number, mode: DiscardMode, filter?: DiscardFilter): Promise<void> {
      const player = playerNum as PlayerId;
      for (let i = 0; i < count; i++) {
        const hand = ctx.state.players[player].hand;
        if (hand.length === 0) return;

        if (mode === "random") {
          const idx = ctx.rng.int(hand.length, "discard");
          moveObject(ctx, hand[idx]!, "graveyard");
          continue;
        }

        // Choice modes: one representative per cardId (identical picks are one decision).
        const chooser = mode === "casterChooses" ? caster : player;
        const seen = new Set<string>();
        const candidates: string[] = [];
        for (const id of hand) {
          const cardId = getObject(ctx.state, id).cardId;
          if (seen.has(cardId)) continue;
          if (mode === "casterChooses" && !matchesFilter(cardId, filter)) continue;
          seen.add(cardId);
          candidates.push(id);
        }
        if (candidates.length === 0) return; // no filter match: nothing is discarded

        let pickId = candidates[0]!;
        if (candidates.length > 1) {
          if (!requester) throw new Error("discard choice modes need an agent (not available at initialization)");
          // Hand reveal (ADR-029): the chooser sees the revealed cards for
          // this decision only, via the request payload.
          const revealed =
            mode === "casterChooses"
              ? hand.map((id) => ({ objectId: id, cardId: getObject(ctx.state, id).cardId }))
              : undefined;
          const actions: Action[] = candidates.map((objectId) => ({ type: "discard", objectId }));
          const pick = await requester(chooser, "discard", actions, revealed);
          if (pick.type !== "discard") throw new Error("expected discard action");
          pickId = pick.objectId;
        }
        moveObject(ctx, pickId, "graveyard");
      }
    },
  };
}

/**
 * Stack-item-less EffectContext for initialization-time effects — MatchSpec
 * `effectAtStart` modifiers (ADR-012). No targets, no X, no agent choices.
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
        case "target":
        case "controllerOfTarget":
          throw new Error("initialization effects cannot reference targets");
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
          return []; // no source at initialization: "self"/"attached" select nothing
      }
    },
    amount(a: Amount): number {
      if (typeof a === "number") return a;
      return 0; // no X, no LKI at initialization
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
    ...discardOp(ctx, player), // random mode works; choice modes throw without a requester
  };
}
