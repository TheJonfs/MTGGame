import type { Effect, Keyword, Scope, ValueRef } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { evaluateValueRef } from "./effect-context.js";
import { getObject, type GameState, type PlayerId } from "./state.js";

export interface Characteristics {
  power: number;
  toughness: number;
  keywords: Set<Keyword>;
  cantAttack: boolean;
  cantBlock: boolean;
  types: string[];
  subtypes: string[];
}

/** ADR-020 scope parameters: optional subtype/type narrowing and source exclusion. */
export interface ScopeParams {
  subtype?: string;
  cardType?: string;
  other?: boolean;
  /** ADR-076 keyword filters (evaluated on printed + non-filtered keywords — see baseKeywords). */
  withKeyword?: Keyword;
  withoutKeyword?: Keyword;
}

/** Objects selected by a static ability's scope, from the source's point of view. */
export function objectsInScope(ctx: EngineCtx, sourceId: string, scope: Scope, params: ScopeParams = {}): string[] {
  const state = ctx.state;
  const source = state.objects[sourceId];
  if (!source) return [];
  const narrow = (ids: string[]): string[] =>
    ids.filter((id) => {
      if (params.other && id === sourceId) return false; // "other ... you control" (Goblin Chieftain)
      const def = ctx.defs.def(getObject(state, id).cardId);
      if (params.subtype && !(def.subtypes ?? []).includes(params.subtype)) return false;
      if (params.cardType && !def.types.includes(params.cardType as never)) return false;
      if (params.withKeyword && !baseKeywords(ctx, id).has(params.withKeyword)) return false;
      if (params.withoutKeyword && baseKeywords(ctx, id).has(params.withoutKeyword)) return false;
      return true;
    });
  switch (scope) {
    case "attached":
      return source.attachedTo && state.objects[source.attachedTo] ? [source.attachedTo] : [];
    case "self":
      return [sourceId];
    case "creaturesYouControl":
      return narrow(
        state.battlefield.filter((id) => {
          const o = getObject(state, id);
          return o.controller === source.controller && ctx.defs.def(o.cardId).types.includes("Creature");
        }),
      );
    case "allCreatures":
      return narrow(
        state.battlefield.filter((id) => ctx.defs.def(getObject(state, id).cardId).types.includes("Creature")),
      );
    case "you":
    case "opponent":
    case "eachPlayer":
      return []; // player scopes select no objects
  }
}

/** Keywords an object has BEFORE keyword-filtered statics are considered: printed keywords,
 * stored grants, and static grants whose scope has no keyword filter. Breaks the recursion a
 * "creatures with flying get +2/+0" static would otherwise cause (ADR-076; known simplification:
 * a keyword granted by a keyword-filtered static is invisible to other keyword filters). */
export function baseKeywords(ctx: EngineCtx, objectId: string): Set<Keyword> {
  const state = ctx.state;
  const obj = getObject(state, objectId);
  const out = new Set<Keyword>(ctx.defs.def(obj.cardId).keywords ?? []);
  for (const ce of state.continuousEffects) if (ce.objectId === objectId && ce.kind === "grantKeyword" && ce.keyword) out.add(ce.keyword);
  for (const srcId of state.battlefield) {
    const src = getObject(state, srcId);
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static" || !staticActive(ctx, srcId, ability.condition)) continue;
      for (const e of ability.effects) {
        if (e.type !== "grantKeyword" || !("scope" in e) || !e.scope || e.withKeyword || e.withoutKeyword) continue;
        const params: ScopeParams = { ...(e.subtype ? { subtype: e.subtype } : {}), ...(e.cardType ? { cardType: e.cardType } : {}), ...(e.other ? { other: true } : {}) };
        if (objectsInScope(ctx, srcId, e.scope, params).includes(objectId)) out.add(e.keyword);
      }
    }
  }
  return out;
}

/** A4: a conditional static (Werebear's threshold) applies only while its value condition holds. */
export function staticActive(ctx: EngineCtx, sourceId: string, condition?: { value: ValueRef; atLeast: number }): boolean {
  if (!condition) return true;
  const src = ctx.state.objects[sourceId];
  if (!src) return false;
  const v = condition.value;
  const n = v.ref === "targetPower" || v.ref === "targetManaValue" ? 0 : evaluateValueRef(ctx, v, src.controller as PlayerId, sourceId);
  return n >= condition.atLeast;
}

/**
 * characteristics() per ADR-003:
 * printed → copy(reserved) → control(reserved) → setPT(reserved) →
 * static P/T → EOT P/T (timestamp order) → counters → keyword grants/restrictions.
 * Restrictions are consulted by the enumerator and combat, never stored on objects.
 */
export function characteristics(ctx: EngineCtx, objectId: string): Characteristics {
  const state = ctx.state;
  const obj = getObject(state, objectId);
  const def = ctx.defs.def(obj.cardId);

  const result: Characteristics = {
    // A10 (S22): a creation-locked base P/T (Overload's Weird) overrides the printed values.
    power: obj.basePT?.power ?? def.power ?? 0,
    toughness: obj.basePT?.toughness ?? def.toughness ?? 0,
    keywords: new Set(def.keywords ?? []),
    cantAttack: false,
    cantBlock: false,
    types: [...def.types],
    subtypes: [...(def.subtypes ?? [])],
  };

  const applyEffect = (e: Effect, phase: "pt" | "grants", srcId: string) => {
    if (phase === "pt" && e.type === "modifyPT") {
      // Statics carry literal deltas or A4 count refs, evaluated live from the
      // source's point of view (Gaean Wurm: +1/+1 per Forest you control).
      const src = getObject(state, srcId);
      const val = (v: typeof e.power): number =>
        typeof v === "number" ? v : typeof v === "object" && v.ref !== "targetPower" && v.ref !== "targetManaValue" ? evaluateValueRef(ctx, v, src.controller, srcId) : 0;
      result.power += val(e.power);
      result.toughness += val(e.toughness);
    }
    if (phase === "grants" && e.type === "grantKeyword") result.keywords.add(e.keyword);
    if (phase === "grants" && e.type === "restrict") {
      if (e.what === "attack" || e.what === "both") result.cantAttack = true;
      if (e.what === "block" || e.what === "both") result.cantBlock = true;
    }
  };

  // Static abilities of battlefield permanents whose scope covers this object.
  // Two passes preserve ADR-003 ordering: static P/T before grants/restrictions.
  const staticHits: { e: Effect; srcId: string }[] = [];
  for (const srcId of state.battlefield) {
    const src = getObject(state, srcId);
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static") continue;
      if (!staticActive(ctx, srcId, ability.condition)) continue; // A4 conditional static
      for (const e of ability.effects) {
        const scope = "scope" in e ? e.scope : undefined;
        if (!scope) continue;
        const params: ScopeParams = {
          ...("subtype" in e && e.subtype ? { subtype: e.subtype } : {}),
          ...("cardType" in e && e.cardType ? { cardType: e.cardType } : {}),
          ...("other" in e && e.other ? { other: e.other } : {}),
          ...("withKeyword" in e && e.withKeyword ? { withKeyword: e.withKeyword } : {}),
          ...("withoutKeyword" in e && e.withoutKeyword ? { withoutKeyword: e.withoutKeyword } : {}),
        };
        if (objectsInScope(ctx, srcId, scope, params).includes(objectId)) staticHits.push({ e, srcId });
      }
    }
  }
  for (const h of staticHits) applyEffect(h.e, "pt", h.srcId);

  // Stored effects from resolved spells/abilities, timestamp order.
  const stored = state.continuousEffects
    .filter((ce) => ce.objectId === objectId)
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const ce of stored) {
    if (ce.kind === "modifyPT") {
      result.power += ce.power ?? 0;
      result.toughness += ce.toughness ?? 0;
    }
  }

  // Counters (S1: +1/+1 and -1/-1 slots; no card creates them yet).
  const plus = obj.counters["+1/+1"] ?? 0;
  const minus = obj.counters["-1/-1"] ?? 0;
  result.power += plus - minus;
  result.toughness += plus - minus;

  // Keyword grants and restrictions, statics then stored.
  for (const h of staticHits) applyEffect(h.e, "grants", h.srcId);
  for (const ce of stored) {
    if (ce.kind === "grantKeyword" && ce.keyword) result.keywords.add(ce.keyword);
    if (ce.kind === "restrict") {
      if (ce.what === "attack" || ce.what === "both") result.cantAttack = true;
      if (ce.what === "block" || ce.what === "both") result.cantBlock = true;
    }
  }

  return result;
}

/** S22b law-word (the Risen Tide): lands a player may play per turn — 1 plus every active
 * extraLandDrops static they control. The enumerator's land-play legality reads this. */
export function maxLandDrops(ctx: EngineCtx, player: PlayerId): number {
  let extra = 0;
  for (const srcId of ctx.state.battlefield) {
    const src = getObject(ctx.state, srcId);
    if (src.controller !== player) continue;
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static" || !staticActive(ctx, srcId, ability.condition)) continue;
      for (const e of ability.effects) if (e.type === "extraLandDrops") extra += e.count;
    }
  }
  return 1 + extra;
}

/** S22b law-word (the Intake): does an active static impose enters-tapped on a matching permanent
 * entering under `enteringController`? Consulted by the one zone-move primitive — every entry path
 * (play, put, search, reanimate, token) pays the law. `who` is relative to the static's controller. */
export function imposedEntersTapped(ctx: EngineCtx, def: { types: readonly string[] }, enteringController: PlayerId): boolean {
  for (const srcId of ctx.state.battlefield) {
    const src = getObject(ctx.state, srcId);
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static" || !staticActive(ctx, srcId, ability.condition)) continue;
      for (const e of ability.effects) {
        if (e.type !== "imposeEntersTapped") continue;
        if (e.cardType && !def.types.includes(e.cardType)) continue;
        if (e.who === "you" && enteringController !== src.controller) continue;
        if (e.who === "opponent" && enteringController === src.controller) continue;
        return true;
      }
    }
  }
  return false;
}

export function isCreature(ctx: EngineCtx, objectId: string): boolean {
  const obj = ctx.state.objects[objectId];
  if (!obj) return false;
  return ctx.defs.def(obj.cardId).types.includes("Creature");
}

/** Remove UNTIL_END_OF_TURN effects (cleanup step). */
export function expireEndOfTurnEffects(state: GameState): void {
  state.continuousEffects = state.continuousEffects.filter((ce) => ce.duration !== "UNTIL_END_OF_TURN");
}
