import { cardColors, type ResolvedTarget, type TargetSpec } from "@shandalar/cards";
import { characteristics, isCreature } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import type { PlayerId } from "./state.js";

/** Hexproof/shroud live in the predicate layer (engine-design §10). */
function canBeTargeted(ctx: EngineCtx, objectId: string, by: PlayerId): boolean {
  const obj = ctx.state.objects[objectId];
  if (!obj) return false;
  const chars = characteristics(ctx, objectId);
  if (chars.keywords.has("shroud")) return false;
  if (chars.keywords.has("hexproof") && obj.controller !== by) return false;
  return true;
}

/** Is `target` legal for `spec` right now, targeted by `by`? Used at cast and re-checked at resolution (CR 608.2b).
 * ADR-076 (S17): the base predicate is composed with filters — `anyOf` (or), `withKeyword`/`withoutKeyword`,
 * `notSubtype`, and `other` (never the ability's own `sourceId`). */
export function isLegalTarget(ctx: EngineCtx, spec: TargetSpec, target: ResolvedTarget, by: PlayerId, sourceId?: string): boolean {
  if (spec.anyOf && spec.anyOf.length > 0) {
    if (!spec.anyOf.some((alt) => isLegalTarget(ctx, alt, target, by, sourceId))) return false;
  } else if (!basePredicate(ctx, spec, target, by)) {
    return false;
  }
  if (spec.other && sourceId && target.kind === "object" && target.id === sourceId) return false;
  if (target.kind === "object" && (spec.withKeyword || spec.withoutKeyword || spec.notSubtype)) {
    const obj = ctx.state.objects[target.id];
    if (!obj || obj.zone !== "battlefield") return false;
    const ch = characteristics(ctx, target.id);
    if (spec.withKeyword && !ch.keywords.has(spec.withKeyword)) return false;
    if (spec.withoutKeyword && ch.keywords.has(spec.withoutKeyword)) return false;
    if (spec.notSubtype && ch.subtypes.includes(spec.notSubtype)) return false;
  }
  // A10 (S22): power ceiling (Graceful Restoration's "power 2 or less") — live characteristics on
  // the battlefield, printed power for cards in other zones (CR 611.3c has nothing to modify there).
  if (spec.powerAtMost !== undefined && target.kind === "object") {
    const obj = ctx.state.objects[target.id];
    if (!obj) return false;
    const power = obj.zone === "battlefield" ? characteristics(ctx, target.id).power : (ctx.defs.def(obj.cardId).power ?? 0);
    if (power > spec.powerAtMost) return false;
  }
  return true;
}

function basePredicate(ctx: EngineCtx, spec0: TargetSpec, target: ResolvedTarget, by: PlayerId): boolean {
  const state = ctx.state;
  // Recursive base checks below compose predicates only — filters are applied once, by the caller.
  // `who` rides along (A10/ADR-038: whose graveyard a graveyard predicate scans).
  const spec: TargetSpec = { count: spec0.count, predicate: spec0.predicate, zone: spec0.zone, ...(spec0.who ? { who: spec0.who } : {}) };
  switch (spec.predicate) {
    case "creature": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "battlefield" && isCreature(ctx, target.id) && canBeTargeted(ctx, target.id, by);
    }
    case "tappedCreature": {
      // S26 (Seraphina, the Initiative): the status-predicate door. Tapped is read live — at
      // enumeration AND at resolution (CR 608.2b: an untap in response fizzles the kill).
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.tapped;
    }
    case "nonblackCreature": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      // ADR-019: color predicates read the explicit/derived colors field.
      return target.kind === "object" && !cardColors(ctx.defs.def(state.objects[target.id]!.cardId)).includes("B");
    }
    case "nonartifactNonblackCreature": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "nonblackCreature" }, target, by)) return false;
      return target.kind === "object" && !ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Artifact");
    }
    case "creatureYouControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller === by;
    }
    case "creatureYouDontControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller !== by;
    }
    case "permanent": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "battlefield" && canBeTargeted(ctx, target.id, by);
    }
    // S25 (the Sapphire Sage): controller-scoped permanents (the creatureYouControl pattern).
    case "permanentYouControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller === by;
    }
    case "permanentYouDontControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller !== by;
    }
    case "anyTarget":
      if (target.kind === "player") return true;
      return isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by);
    case "player":
      return target.kind === "player";
    case "opponentPlayer":
      return target.kind === "player" && target.player !== by;
    case "spell":
      return target.kind === "stackItem" && state.stack.some((s) => s.id === target.id && s.kind === "spell");
    case "cardInYourGraveyard": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      // A10/ADR-038 amendment: who "any" opens every graveyard (the Usher — the Court claims all
      // the dead); the default "you" keeps every prior card's own-graveyard reading.
      return !!obj && obj.zone === "graveyard" && ((spec.who ?? "you") === "any" || obj.owner === by);
    }
    case "creatureCardInYourGraveyard": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "cardInYourGraveyard" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Creature");
    }
    // S20 (ADR-079): Titania's ETB — the land predicate on graveyard returns.
    case "landCardInYourGraveyard": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "cardInYourGraveyard" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Land");
    }
    // ADR-076 (S17)
    case "artifact": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Artifact");
    }
    case "enchantment": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Enchantment");
    }
    case "nonlandPermanent": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && !ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Land");
    }
    case "creatureSpell":
      return target.kind === "stackItem" && state.stack.some((s) => s.id === target.id && s.kind === "spell" && ctx.defs.def(s.sourceCardId).types.includes("Creature"));
    // A10 (S22): Experimental Overload's regrowth.
    case "instantOrSorceryCardInYourGraveyard": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "cardInYourGraveyard" }, target, by)) return false;
      const d = ctx.defs.def(state.objects[(target as { id: string }).id]!.cardId);
      return target.kind === "object" && (d.types.includes("Instant") || d.types.includes("Sorcery"));
    }
  }
}

/** All legal targets for a spec (deterministic order: battlefield/stack order, then players 0,1). */
export function targetCandidates(ctx: EngineCtx, spec: TargetSpec, by: PlayerId, sourceId?: string): ResolvedTarget[] {
  const state = ctx.state;
  const out: ResolvedTarget[] = [];
  for (const id of state.battlefield) {
    const t: ResolvedTarget = { kind: "object", id };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  for (const item of state.stack) {
    const t: ResolvedTarget = { kind: "stackItem", id: item.id };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  for (const player of [0, 1] as PlayerId[]) {
    const t: ResolvedTarget = { kind: "player", player };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  const graveyardy = (sp: TargetSpec): boolean => sp.predicate === "cardInYourGraveyard" || sp.predicate === "creatureCardInYourGraveyard" || sp.predicate === "landCardInYourGraveyard" || sp.predicate === "instantOrSorceryCardInYourGraveyard" || (sp.anyOf ?? []).some(graveyardy);
  const anyYard = (sp: TargetSpec): boolean => sp.who === "any" || (sp.anyOf ?? []).some(anyYard);
  if (graveyardy(spec)) {
    // A10/ADR-038: who "any" scans BOTH graveyards (own first — deterministic order); default scans yours.
    const yards = anyYard(spec) ? [state.players[by].graveyard, state.players[by === 0 ? 1 : 0].graveyard] : [state.players[by].graveyard];
    for (const yard of yards) {
      for (const id of yard) {
        const t: ResolvedTarget = { kind: "object", id };
        if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
      }
    }
  }
  return out;
}

/**
 * All legal target tuples for a spell/ability's specs (each spec count=1 in
 * the current pool; the cartesian product is bounded by ADR-004's reasoning).
 */
export function targetCombinations(ctx: EngineCtx, specs: TargetSpec[], by: PlayerId, sourceId?: string): ResolvedTarget[][] {
  if (specs.length === 0) return [[]];
  const key = (t: ResolvedTarget) => JSON.stringify(t);
  let combos: ResolvedTarget[][] = [[]];
  for (const spec of specs) {
    const next: ResolvedTarget[][] = [];
    if (spec.count === "any") {
      // A10 word 4: any-number targets are chosen in the cast's request-loop, never enumerated
      // (the validator confines "any" to a spell's sole spec; the enumerator short-circuits it).
      throw new Error(`targetCombinations reached an "any"-count spec — the request-loop owns it (A10)`);
    }
    if (typeof spec.count === "number") {
      if (spec.count !== 1) throw new Error("fixed multi-target specs not yet supported (no pool card needs them)");
      const cands = targetCandidates(ctx, spec, by, sourceId);
      for (const combo of combos) {
        for (const c of cands) {
          if (spec.distinctFromPrior && combo.some((t) => key(t) === key(c))) continue;
          next.push([...combo, c]);
        }
      }
    } else {
      // A8 range spec ("up to N"): subsets of size min..max in candidate order — inherently distinct
      // within the group; distinctFromPrior also excludes earlier picks (the no-stacking ruling).
      const { min, max } = spec.count;
      for (const combo of combos) {
        const cands = targetCandidates(ctx, spec, by, sourceId).filter(
          (c) => !spec.distinctFromPrior || !combo.some((t) => key(t) === key(c)),
        );
        const subsets: ResolvedTarget[][] = [[]];
        for (const c of cands) {
          const grown = subsets.filter((sub) => sub.length < max).map((sub) => [...sub, c]);
          subsets.push(...grown);
        }
        for (const sub of subsets) if (sub.length >= min && sub.length <= max) next.push([...combo, ...sub]);
      }
    }
    combos = next;
  }
  return combos;
}
