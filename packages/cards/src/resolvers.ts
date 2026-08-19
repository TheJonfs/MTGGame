import type { Amount, Duration, Effect, EffectType, Keyword, Scope, Who } from "./types.js";

/**
 * The seam between vocabulary and engine (engine-design §1 dependency rule):
 * resolvers live here, but state mutation happens through EffectContext,
 * which the engine implements. Resolvers never see engine internals.
 */

export type ResolvedTarget =
  | { kind: "object"; id: string }
  | { kind: "player"; player: number }
  | { kind: "stackItem"; id: string };

/** A continuous effect created by a resolved spell/ability (pump, EOT restrict). */
export interface ResolvedContinuousEffect {
  kind: "modifyPT" | "grantKeyword" | "restrict";
  objectId: string;
  power?: number;
  toughness?: number;
  keyword?: Keyword;
  what?: "attack" | "block" | "both";
  duration: Duration;
}

export interface EffectContext {
  /** Re-checked target by index; null if the target is now illegal (skip it, CR 608.2b). */
  target(i: number): ResolvedTarget | null;
  /** Players selected by a `who` param. */
  players(who: Who): number[];
  /** Object ids selected by a scope, evaluated now. */
  objectsInScope(scope: Scope): string[];
  /** Numeric value of an amount ("X" resolves from the stack item). */
  amount(a: Amount): number;

  dealDamage(target: ResolvedTarget, amount: number): void;
  bounce(objectId: string): void;
  counterSpell(stackItemId: string): void;
  draw(player: number, count: number): void;
  addContinuousEffect(effect: ResolvedContinuousEffect): void;
  addMana(player: number, mana: string): void;
  createToken(player: number, tokenId: string, count: number): void;
  addCounters(objectId: string, kind: "+1/+1" | "-1/-1", count: number): void;
  gainLife(player: number, amount: number): void;
  /** Destruction by effect (CR 701.7); honors indestructible. Death itself is still the SBA's call. */
  destroy(objectId: string): void;
}

export class NotImplementedError extends Error {
  constructor(readonly word: string) {
    super(`Effect resolver not implemented: "${word}" (add it via a session brief, not ad hoc)`);
    this.name = "NotImplementedError";
  }
}

export type EffectResolver = (effect: Effect, ctx: EffectContext) => void;

function targeted(effect: Effect & { target?: number; scope?: Scope }, ctx: EffectContext): ResolvedTarget[] {
  // Effects address objects either by declared-target index or by scope.
  if (effect.target !== undefined) {
    const t = ctx.target(effect.target);
    return t ? [t] : [];
  }
  if (effect.scope !== undefined) {
    return ctx.objectsInScope(effect.scope).map((id) => ({ kind: "object" as const, id }));
  }
  throw new Error(`Effect "${effect.type}" has neither target nor scope`);
}

const implemented: Partial<Record<EffectType, EffectResolver>> = {
  damage: (e, ctx) => {
    if (e.type !== "damage") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t) ctx.dealDamage(t, ctx.amount(e.amount));
  },

  bounce: (e, ctx) => {
    if (e.type !== "bounce") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t && t.kind === "object") ctx.bounce(t.id);
  },

  counter: (e, ctx) => {
    if (e.type !== "counter") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t && t.kind === "stackItem") ctx.counterSpell(t.id);
  },

  draw: (e, ctx) => {
    if (e.type !== "draw") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) ctx.draw(p, e.count);
  },

  modifyPT: (e, ctx) => {
    if (e.type !== "modifyPT") throw new Error("resolver mismatch");
    for (const t of targeted(e, ctx)) {
      if (t.kind !== "object") continue;
      ctx.addContinuousEffect({
        kind: "modifyPT",
        objectId: t.id,
        power: e.power,
        toughness: e.toughness,
        duration: e.duration,
      });
    }
  },

  restrict: (e, ctx) => {
    if (e.type !== "restrict") throw new Error("resolver mismatch");
    for (const t of targeted(e, ctx)) {
      if (t.kind !== "object") continue;
      ctx.addContinuousEffect({
        kind: "restrict",
        objectId: t.id,
        what: e.what,
        duration: e.duration,
      });
    }
  },

  addMana: (e, ctx) => {
    if (e.type !== "addMana") throw new Error("resolver mismatch");
    for (const p of ctx.players("you")) ctx.addMana(p, e.mana);
  },

  createToken: (e, ctx) => {
    if (e.type !== "createToken") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) ctx.createToken(p, e.tokenId, e.count);
  },

  addCounters: (e, ctx) => {
    if (e.type !== "addCounters") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t && t.kind === "object") ctx.addCounters(t.id, e.kind, e.count);
  },

  gainLife: (e, ctx) => {
    if (e.type !== "gainLife") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) ctx.gainLife(p, e.amount);
  },

  destroyAll: (e, ctx) => {
    if (e.type !== "destroyAll") throw new Error("resolver mismatch");
    for (const id of ctx.objectsInScope(e.scope)) ctx.destroy(id);
  },
};

export const IMPLEMENTED_EFFECT_TYPES: ReadonlySet<EffectType> = new Set(
  Object.keys(implemented) as EffectType[],
);

/** Resolve one effect. Unimplemented vocabulary throws NotImplementedError by design (brief Part 2). */
export function resolveEffect(effect: Effect, ctx: EffectContext): void {
  const resolver = implemented[effect.type];
  if (!resolver) throw new NotImplementedError(effect.type);
  resolver(effect, ctx);
}
