import type { Effect, Keyword, Scope } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { getObject, type GameState } from "./state.js";

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
    power: def.power ?? 0,
    toughness: def.toughness ?? 0,
    keywords: new Set(def.keywords ?? []),
    cantAttack: false,
    cantBlock: false,
    types: [...def.types],
    subtypes: [...(def.subtypes ?? [])],
  };

  const applyEffect = (e: Effect, phase: "pt" | "grants") => {
    if (phase === "pt" && e.type === "modifyPT") {
      // Statics carry literal deltas only ("X" P/T belongs to resolved
      // abilities, which store numbers) — the validator enforces this.
      result.power += typeof e.power === "number" ? e.power : 0;
      result.toughness += typeof e.toughness === "number" ? e.toughness : 0;
    }
    if (phase === "grants" && e.type === "grantKeyword") result.keywords.add(e.keyword);
    if (phase === "grants" && e.type === "restrict") {
      if (e.what === "attack" || e.what === "both") result.cantAttack = true;
      if (e.what === "block" || e.what === "both") result.cantBlock = true;
    }
  };

  // Static abilities of battlefield permanents whose scope covers this object.
  // Two passes preserve ADR-003 ordering: static P/T before grants/restrictions.
  const staticHits: Effect[] = [];
  for (const srcId of state.battlefield) {
    const src = getObject(state, srcId);
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static") continue;
      for (const e of ability.effects) {
        const scope = "scope" in e ? e.scope : undefined;
        if (!scope) continue;
        const params = {
          ...("subtype" in e && e.subtype ? { subtype: e.subtype } : {}),
          ...("cardType" in e && e.cardType ? { cardType: e.cardType } : {}),
          ...("other" in e && e.other ? { other: e.other } : {}),
        };
        if (objectsInScope(ctx, srcId, scope, params).includes(objectId)) staticHits.push(e);
      }
    }
  }
  for (const e of staticHits) applyEffect(e, "pt");

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
  for (const e of staticHits) applyEffect(e, "grants");
  for (const ce of stored) {
    if (ce.kind === "grantKeyword" && ce.keyword) result.keywords.add(ce.keyword);
    if (ce.kind === "restrict") {
      if (ce.what === "attack" || ce.what === "both") result.cantAttack = true;
      if (ce.what === "block" || ce.what === "both") result.cantBlock = true;
    }
  }

  return result;
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
