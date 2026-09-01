import { type TargetSpec,
  parseManaProduction,
  parseManaCost,
  manaValue,
  type Amount,
  type CounterKind,
  type DiscardFilter,
  type DiscardMode,
  type EffectContext,
  type ResolvedContinuousEffect,
  type ResolvedTarget,
  type Scope,
  type ValueRef,
  type Who,
} from "@shandalar/cards";
import type { Action } from "./actions.js";
import type { EngineCtx } from "./ctx.js";
import { isLegalTarget } from "./targeting.js";
import { dealDamage, discardCard, drawCard, gainLife, loseLife } from "./ops.js";
import { createObject, moveBatchToGraveyard, moveObject } from "./zones.js";
import { getObject, nextTimestamp, opponentOf, type PlayerId, type StackItem } from "./state.js";
import { characteristics, isCreature } from "./characteristics.js";

/**
 * Decision seam for effects that ask a player something (ADR-029 discard).
 * The Game provides its request(); the init context has none.
 */
export type EffectRequester = (
  player: PlayerId,
  purpose: "discard" | "searchLibrary",
  actions: Action[],
  revealed?: { objectId: string; cardId: string }[],
) => Promise<Action>;

/** Last known information per target (CR 608.2h, ADR-028): captured at resolution start.
 * A10 (S22): mana value joins the snapshot (Aether Mutation counts the creature it just bounced;
 * X in a battlefield permanent's cost is 0 per CR 202.3b — tokens with no cost read 0). */
interface TargetLki {
  power: number;
  controller: PlayerId;
  manaValue: number;
}

/** Engine implementation of the cards package's EffectContext seam. */
/** A8 (S20): fixed specs consume `count` flat slots in order; a range spec (validator: last) consumes the rest. */
function specOfFlatIndex(specs: readonly TargetSpec[], flat: number): TargetSpec | undefined {
  let at = 0;
  for (const spec of specs) {
    if (typeof spec.count === "number") {
      if (flat < at + spec.count) return spec;
      at += spec.count;
    } else {
      return spec; // range: everything from here on
    }
  }
  return undefined;
}

function flatRangeOfSpec(specs: readonly TargetSpec[], si: number, totalTargets: number): { start: number; end: number; spec?: TargetSpec } {
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const width = typeof spec.count === "number" ? spec.count : totalTargets - at;
    if (i === si) return { start: at, end: at + width, spec };
    at += width;
  }
  return { start: 0, end: 0 };
}

export function makeEffectContext(ctx: EngineCtx, item: StackItem, requester?: EffectRequester): EffectContext {
  const controller = item.controller;

  // LKI snapshot before any effect applies: an object exiled by effect 1 can
  // still feed effect 2's targetPower / controllerOfTarget (Swords).
  const lki: (TargetLki | null)[] = item.targets.map((t) => {
    if (t.kind !== "object") return null;
    const obj = ctx.state.objects[t.id];
    if (!obj || obj.zone !== "battlefield") return null;
    return { power: characteristics(ctx, t.id).power, controller: obj.controller, manaValue: manaValue(parseManaCost(ctx.defs.def(obj.cardId).manaCost)) };
  });

  const sourceForDamage = () => {
    // A spell's damage source is the spell object; an ability's is its source permanent.
    const id = item.objectId ?? item.sourceId ?? "";
    return { id, cardId: item.sourceCardId, controller };
  };

  return {
    target(i: number): ResolvedTarget | null {
      const t = item.targets[i];
      const spec = specOfFlatIndex(item.targetSpecs, i);
      if (!t || !spec) return null;
      return isLegalTarget(ctx, spec, t, controller, item.sourceId ?? item.objectId) ? t : null;
    },

    // A8 (S20): the still-legal targets a RANGE spec chose (per-target fizzle — one dying before
    // resolution never blanks its siblings).
    targetsOfSpec(si: number): ResolvedTarget[] {
      const { start, end, spec } = flatRangeOfSpec(item.targetSpecs, si, item.targets.length);
      if (!spec) return [];
      const out: ResolvedTarget[] = [];
      for (let i = start; i < end; i++) {
        const t = item.targets[i];
        if (t && isLegalTarget(ctx, spec, t, controller, item.sourceId ?? item.objectId)) out.push(t);
      }
      return out;
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

    objectsInScope(scope: Scope, params: { subtype?: string; cardType?: string; other?: boolean } = {}): string[] {
      // ADR-020 params on resolved effects (S17: Aristocrat's "each Vampire you control").
      const sourceId = item.sourceId ?? item.objectId;
      const narrow = (ids: string[]) =>
        ids.filter((id) => {
          if (params.other && id === sourceId) return false;
          const def = ctx.defs.def(getObject(ctx.state, id).cardId);
          if (params.subtype && !(def.subtypes ?? []).includes(params.subtype)) return false;
          if (params.cardType && !def.types.includes(params.cardType as never)) return false;
          return true;
        });
      switch (scope) {
        case "creaturesYouControl":
          return narrow(ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller === controller && isCreature(ctx, id),
          ));
        case "creaturesYouDontControl":
          return narrow(ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller !== controller && isCreature(ctx, id),
          ));
        case "allCreatures":
          return narrow(ctx.state.battlefield.filter((id) => isCreature(ctx, id)));
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
      if (a.ref === "targetPower") {
        // ValueRef (ADR-028): last known information from the resolution snapshot.
        const snap = lki[a.target];
        return snap ? snap.power : 0;
      }
      if (a.ref === "targetManaValue") {
        // A10 (S22): LKI mana value — the bounced creature still feeds the Saproling count.
        const snap = lki[a.target];
        return snap ? snap.manaValue : 0;
      }
      if (a.ref === "eventDamage") {
        // S23 (ADR-084, member six): the triggering event's damage amount × the bounded literal
        // multiplier (the Traumatizer's "twice that many"). Zero when the item carries no event
        // damage — the ref is validator-confined to damage-event triggers, so that's belt-and-braces.
        return (item.eventContext?.amount ?? 0) * (a.times ?? 1);
      }
      if (a.ref === "xPaid") {
        // S25 (ADR-088, member seven): the announced X, captured into the ETB trigger's event
        // context at collection (LKI — the Keeper's death in response does not blank the pump).
        // Fallback to the live object for belt-and-braces; zero when neither speaks.
        const live = item.sourceId ? ctx.state.objects[item.sourceId]?.xPaid : undefined;
        return item.eventContext?.amount ?? live ?? 0;
      }
      // A4 counting refs: evaluated NOW, from the controller's point of view (608.2h: Tendrils' X at resolution).
      return evaluateValueRef(ctx, a, controller, item.sourceId ?? item.objectId);
    },

    eventPlayer(): number | null {
      // A10 (S22): the triggering event's player (the Warden's untapped-creature controller).
      return item.eventContext?.player ?? null;
    },

    sacrificeSource(): void {
      // S23 (ADR-084): the resolving ability's own source pays with itself (the Thundersnake's
      // exit) — a SACRIFICE through the one zone-move primitive (DIES fires; indestructible is
      // no shield: sacrifice is not destruction). No-op if it already left the battlefield
      // (bounced or died in response — the trigger's source id is stale then).
      const src = item.sourceId ? ctx.state.objects[item.sourceId] : undefined;
      if (!src || src.zone !== "battlefield") return;
      ctx.bus.emit("SACRIFICED", { objectId: item.sourceId!, cardId: src.cardId }); // S24 r5: the cause marker
      moveObject(ctx, item.sourceId!, "graveyard");
    },

    targetMatches(cond: { target: number; subtype?: string; cardType?: string }): boolean {
      const t = item.targets[cond.target];
      if (!t || t.kind !== "object") return false;
      const obj = ctx.state.objects[t.id];
      if (!obj || obj.zone !== "battlefield") return false;
      const ch = characteristics(ctx, t.id);
      if (cond.subtype && !ch.subtypes.includes(cond.subtype)) return false;
      if (cond.cardType && !ch.types.includes(cond.cardType)) return false;
      return true;
    },

    exileThenReturn(objectId: string): void {
      // A8 blink: exile (not a death), then back under the effect controller's
      // control as a NEW object — ETB triggers fire from the second move.
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      const exiled = moveObject(ctx, objectId, "exile");
      if (!exiled || !ctx.state.objects[exiled]) return; // tokens cease to exist in exile
      moveObject(ctx, exiled, "battlefield", { controller });
    },

    dealDamage(target: ResolvedTarget, amount: number, from?: "eventObject"): void {
      if (target.kind === "stackItem") throw new Error("cannot damage a stack item");
      // A10 (S22): the Warden's law — the EVENT's object is the damage source, so its own
      // lifelink/deathtouch apply (lifelink walks free: its controller nets zero).
      if (from === "eventObject" && item.eventContext?.objectId) {
        const ec = item.eventContext;
        dealDamage(ctx, { id: ec.objectId!, cardId: ec.cardId ?? item.sourceCardId, controller: (ec.player ?? controller) as PlayerId }, target, amount, false);
        return;
      }
      dealDamage(ctx, sourceForDamage(), target, amount, false);
    },

    bounce(objectId: string, to: "hand" | "libraryTop" = "hand"): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      // A10 (S22): libraryTop — Temporal Spring. Not a hand return: RETURNED_TO_HAND never fires.
      if (to === "libraryTop") moveObject(ctx, objectId, "library", { position: "top" });
      else moveObject(ctx, objectId, "hand");
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
        ...(effect.controller !== undefined && { controller: effect.controller as PlayerId }),
        duration: effect.duration,
        sourceStackItemId: item.id,
        timestamp: nextTimestamp(ctx.state),
      });
    },

    addMana(player: number, mana: string): void {
      const pool = ctx.state.players[player as PlayerId].manaPool;
      for (const sym of parseManaProduction(mana)) pool[sym.symbol] += 1;
    },

    ...sharedOps(ctx, controller),
    ...discardOp(ctx, controller, requester),
    ...searchOp(ctx, requester),
  };
}

/** ADR-068 Amendment 1: search implementation. Candidates are the matching
 * library cards, deduplicated by cardId for the request (one action per
 * distinct card, like R-029's hand dedup); the chooser sees them as
 * `revealed`; decline is always actions[0] (ADR-014 auto-takes it when
 * nothing matches). The library is shuffled afterwards no matter what
 * (CR 701.19) through the logged game RNG, so replay reproduces it. */
function searchOp(ctx: EngineCtx, requester?: EffectRequester) {
  return {
    async searchLibrary(playerNum: number, predicate: "basicLand" | "anyCard" | `subtype:${string}`, to: "hand" | "battlefield", entersTapped: boolean): Promise<void> {
      const player = playerNum as PlayerId;
      const p = ctx.state.players[player];
      const matches = p.library.filter((id) => {
        const def = ctx.defs.def(getObject(ctx.state, id).cardId);
        if (predicate === "anyCard") return true;
        if (predicate.startsWith("subtype:")) return (def.subtypes ?? []).includes(predicate.slice("subtype:".length)); // ADR-076: Goblin Matron
        return def.types.includes("Land") && (def.supertypes ?? []).includes("Basic");
      });
      const seen = new Set<string>();
      const candidates: string[] = [];
      for (const id of matches) {
        const cardId = getObject(ctx.state, id).cardId;
        if (seen.has(cardId)) continue;
        seen.add(cardId);
        candidates.push(id);
      }
      const actions: Action[] = [{ type: "declineSearch" }, ...candidates.map((objectId) => ({ type: "searchPick" as const, objectId }))];
      let pick: Action = actions[0]!;
      if (candidates.length > 0) {
        if (!requester) throw new Error("searchLibrary needs an agent (not available at initialization)");
        const revealed = candidates.map((objectId) => ({ objectId, cardId: getObject(ctx.state, objectId).cardId }));
        pick = await requester(player, "searchLibrary", actions, revealed);
      }
      if (pick.type === "searchPick") {
        const foundCardId = getObject(ctx.state, pick.objectId).cardId; // before the move — ids die on zone moves
        moveObject(ctx, pick.objectId, to, to === "battlefield" ? { tapped: entersTapped } : {});
        // S22 r4 (CR 701.19.4): a restricted search reveals its find (Goblin Matron's Goblin,
        // Rampant Growth's basic); anyCard (Demonic Tutor) stays hidden.
        if (predicate !== "anyCard") ctx.bus.emit("SEARCH_REVEAL", { player, cardId: foundCardId });
      }
      // Shuffle always follows a search (CR 701.19) — logged RNG, replay-covered.
      p.library = ctx.rng.shuffle(p.library, "shuffle");
      ctx.bus.emit("SHUFFLED", { player }); // S24 r3: the shuffle sound's event
    },
  };
}

/** Ops with no dependency on a stack item, shared with the init context. `asController` = the
 * effect's controller — battlefield returns enter under THEIR control (CR 611.2-family: the player
 * instructed to put it there controls it). Own-graveyard customers never noticed (owner == effect
 * controller); the ADR-038 who:"any" amendment makes it load-bearing (the Usher claims the guest). */
function sharedOps(ctx: EngineCtx, asController: PlayerId) {
  return {
    createToken(player: number, tokenId: string, count: number, pt?: { power: number; toughness: number }): void {
      for (let i = 0; i < count; i++) {
        // A10 (S22): pt locks the token's base P/T at creation (Overload's X/X Weird).
        createObject(ctx, tokenId, player as PlayerId, "battlefield", { isToken: true, ...(pt ? { basePT: pt } : {}) });
      }
    },

    addCounters(objectId: string, kind: CounterKind, count: number): void {
      // S26: named kinds (Clio's depth) share the record with the P/T pair — inert to characteristics().
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      obj.counters[kind] = (obj.counters[kind] ?? 0) + count;
    },

    gainLife(player: number, amount: number): void {
      gainLife(ctx, player as PlayerId, amount);
    },

    /** ADR-070 Amendment 3 (R-046): mill is a zone move, not a draw — an
     * empty library mills what it can and never sets attemptedDrawFromEmpty. */
    mill(player: number, count: number): void {
      const p = ctx.state.players[player as PlayerId];
      for (let i = 0; i < count; i++) {
        const top = p.library[0];
        if (top === undefined) return;
        const cardId = getObject(ctx.state, top).cardId; // before the move: ids are reissued on zone change (CR 400.7)
        moveObject(ctx, top, "graveyard");
        ctx.bus.emit("MILLED", { player: player as PlayerId, objectId: top, cardId });
      }
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

    destroyMany(objectIds: string[]): void {
      const ids = objectIds.filter((id) => {
        const obj = ctx.state.objects[id];
        return !!obj && obj.zone === "battlefield" && !characteristics(ctx, id).keywords.has("indestructible");
      });
      moveBatchToGraveyard(ctx, ids);
    },

    tap(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield" || obj.tapped) return;
      obj.tapped = true;
      ctx.bus.emit("TAPPED", { objectId });
    },

    untap(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield" || !obj.tapped) return;
      obj.tapped = false;
      ctx.bus.emit("UNTAPPED", { objectId });
    },

    exile(objectId: string): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      moveObject(ctx, objectId, "exile"); // not a death: no DIES trigger fires (700.4)
    },

    returnFromGraveyard(objectId: string, to: "battlefield" | "hand", opts?: { temporary?: boolean; withCounters?: { kind: "+1/+1"; count: number } }): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "graveyard") return; // raced away: nothing to return
      // Battlefield returns enter under the effect controller's control (the Usher's guest is
      // HERS); hand returns go to the owner's hand as ever (zone arrays are owner-keyed).
      const newId = moveObject(ctx, objectId, to, to === "battlefield" ? { controller: asController } : {}); // to battlefield fires ETB triggers normally
      if (!newId || to !== "battlefield" || !ctx.state.objects[newId]) return;
      // A10 (S22): Graceful Restoration's rider — it enters with counters.
      if (opts?.withCounters) {
        const back = ctx.state.objects[newId]!;
        back.counters[opts.withCounters.kind] = (back.counters[opts.withCounters.kind] ?? 0) + opts.withCounters.count;
      }
      // A10 word 3 (S22): the temporary package — haste (riding THIS object; a blinked guest is a
      // new object and sheds it — the launder) and the end-step sacrifice. During/after the END
      // step the toll falls due next turn (the delayed trigger's "next end step").
      if (opts?.temporary) {
        ctx.state.continuousEffects.push({
          kind: "grantKeyword",
          objectId: newId,
          keyword: "haste",
          duration: "UNTIL_SOURCE_LEAVES",
          sourceStackItemId: "temporary-reanimate",
          timestamp: nextTimestamp(ctx.state),
        });
        const atOrPastEnd = ctx.state.step === "END" || ctx.state.step === "CLEANUP";
        ctx.state.endStepSacrifices.push({ objectId: newId, dueTurn: atOrPastEnd ? ctx.state.turn + 1 : ctx.state.turn });
      }
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
        if (hand.length === 0 && mode !== "casterChooses") return;

        if (mode === "random") {
          const idx = ctx.rng.int(hand.length, "discard");
          discardCard(ctx, hand[idx]!);
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

        // S19 round 2 (Chris's Duress note): the CASTER's choice always reveals the hand and always
        // asks — CR-wise Duress reveals regardless of matches ("target opponent reveals their hand"),
        // and with 0 or 1 legal picks the old fast path skipped the request, so the caster never saw
        // anything. 0 candidates → a single acknowledge action (declineOptional) beside the reveal.
        if (mode === "casterChooses") {
          if (!requester) throw new Error("discard choice modes need an agent (not available at initialization)");
          const revealed = hand.map((id) => ({ objectId: id, cardId: getObject(ctx.state, id).cardId }));
          const actions: Action[] =
            candidates.length > 0 ? candidates.map((objectId) => ({ type: "discard", objectId })) : [{ type: "declineOptional" }];
          const pick = await requester(chooser, "discard", actions, revealed);
          if (pick.type === "discard") discardCard(ctx, pick.objectId);
          else if (candidates.length > 0) throw new Error("expected discard action");
          else return; // nothing to take; the reveal was the effect
          continue;
        }

        if (candidates.length === 0) return;
        let pickId = candidates[0]!;
        if (candidates.length > 1) {
          if (!requester) throw new Error("discard choice modes need an agent (not available at initialization)");
          const actions: Action[] = candidates.map((objectId) => ({ type: "discard", objectId }));
          const pick = await requester(chooser, "discard", actions, undefined);
          if (pick.type !== "discard") throw new Error("expected discard action");
          pickId = pick.objectId;
        }
        discardCard(ctx, pickId);
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
    targetsOfSpec(): ResolvedTarget[] {
      return []; // initialization effects have no targets (ADR-012)
    },
    objectsInScope(scope: Scope): string[] {
      switch (scope) {
        case "creaturesYouControl":
          return ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller === player && isCreature(ctx, id),
          );
        case "creaturesYouDontControl":
          return ctx.state.battlefield.filter(
            (id) => getObject(ctx.state, id).controller !== player && isCreature(ctx, id),
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
    eventPlayer(): number | null {
      return null; // initialization has no triggering event
    },
    sacrificeSource(): void {
      throw new Error("initialization effects have no source to sacrifice");
    },
    dealDamage(target: ResolvedTarget, amount: number): void {
      if (target.kind === "stackItem") throw new Error("cannot damage a stack item");
      dealDamage(ctx, { id: "init", cardId: "init", controller: player }, target, amount, false);
    },
    bounce(objectId: string, to: "hand" | "libraryTop" = "hand"): void {
      const obj = ctx.state.objects[objectId];
      if (!obj || obj.zone !== "battlefield") return;
      if (to === "libraryTop") moveObject(ctx, objectId, "library", { position: "top" });
      else moveObject(ctx, objectId, "hand");
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
    targetMatches(): boolean {
      return false; // no targets at initialization
    },
    exileThenReturn(): void {
      throw new Error("initialization effects cannot blink");
    },
    addMana(): void {
      throw new Error("initialization effects cannot add mana (pools empty before turn 1)");
    },
    ...sharedOps(ctx, player),
    ...discardOp(ctx, player), // random mode works; choice modes throw without a requester
    ...searchOp(ctx), // throws if a match exists (no agent at initialization); no-match shuffles
  };
}


/** A4: counting value refs, evaluated live. `count`/`maxPower` scan battlefield permanents
 * from `controller`'s point of view; `graveyardCount` counts cards. Used by resolved effects
 * (Tendrils), statics (Gaean Wurm, Werebear's threshold) and cost reduction (Baru). */
export function evaluateValueRef(ctx: EngineCtx, ref: Exclude<ValueRef, { ref: "targetPower" } | { ref: "targetManaValue" } | { ref: "eventDamage" } | { ref: "xPaid" }>, controller: PlayerId, sourceId?: string): number {
  if (ref.ref === "countersOnSelf") {
    // S26 (member eight — Clio): the source's own counters of a kind, live, times the bounded literal.
    // Zero when the source is gone (a graveyard card holds no counters — CR 122.2 by construction).
    const src = sourceId ? ctx.state.objects[sourceId] : undefined;
    if (!src || src.zone !== "battlefield") return 0;
    return (src.counters[ref.kind] ?? 0) * (ref.times ?? 1);
  }
  if (ref.ref === "graveyardCount") {
    const who = ref.who === "you" ? controller : opponentOf(controller);
    const yard = ctx.state.players[who].graveyard;
    // A10 (S22): typed counts (Overload's instants-and-sorceries).
    if (!ref.types) return yard.length;
    return yard.filter((id) => {
      const def = ctx.defs.def(getObject(ctx.state, id).cardId);
      return ref.types!.some((t) => def.types.includes(t));
    }).length;
  }
  const pred = ref.predicate;
  const ids = ctx.state.battlefield.filter((id) => {
    const obj = getObject(ctx.state, id);
    const want = pred.controller ?? "you";
    if (want === "you" && obj.controller !== controller) return false;
    if (want === "opponent" && obj.controller === controller) return false;
    if (pred.other && sourceId && id === sourceId) return false;
    const def = ctx.defs.def(obj.cardId);
    if (pred.cardType && !def.types.includes(pred.cardType)) return false;
    if (pred.subtype && !(def.subtypes ?? []).includes(pred.subtype)) return false;
    if (pred.attacking && !ctx.state.combat.attackers.includes(id)) return false;
    return true;
  });
  if (ref.ref === "count") return ids.length;
  let best = 0;
  for (const id of ids) best = Math.max(best, characteristics(ctx, id).power);
  return best;
}
