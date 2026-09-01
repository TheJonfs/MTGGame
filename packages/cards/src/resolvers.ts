import type { Amount, CounterKind, DiscardFilter, DiscardMode, Duration, Effect, EffectCondition, EffectType, Keyword, PTAmount, Scope, Who } from "./types.js";

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
  kind: "modifyPT" | "grantKeyword" | "restrict" | "gainControl";
  objectId: string;
  /** S26 (gainControl): the seat that gains control — the effect's controller. */
  controller?: number;
  power?: number;
  toughness?: number;
  keyword?: Keyword;
  what?: "attack" | "block" | "both";
  duration: Duration;
}

/** Player selection that needs target LKI resolves through the context (ADR-028). */

export interface EffectContext {
  /** Re-checked target by index; null if the target is now illegal (skip it, CR 608.2b). */
  target(i: number): ResolvedTarget | null;
  /** A8 (S20): every STILL-LEGAL target chosen for spec index `i` (range specs; per-target fizzle). */
  targetsOfSpec(i: number): ResolvedTarget[];
  /** Players selected by a `who` param. */
  players(who: Who): number[];
  /** Object ids selected by a scope, evaluated now (ADR-020 params: subtype/cardType/other). */
  objectsInScope(scope: Scope, params?: { subtype?: string; cardType?: string; other?: boolean }): string[];
  /** ADR-076: does the target at index i currently match these characteristics? (Little Bear's "if it's a Bear".) */
  targetMatches(cond: EffectCondition): boolean;
  /** Numeric value of an amount ("X" resolves from the stack item). */
  amount(a: Amount): number;
  /** A10 (S22): the triggering event's player (the untapped creature's controller, the caster), or
   * null when the item carries no event context. */
  eventPlayer(): number | null;

  /** A10 (S22): `from: "eventObject"` makes the event's object the damage source (the Warden's law —
   * the untapped creature's own lifelink/deathtouch apply). */
  dealDamage(target: ResolvedTarget, amount: number, from?: "eventObject"): void;
  /** A10 (S22): `to: "libraryTop"` — Temporal Spring (default hand). */
  bounce(objectId: string, to?: "hand" | "libraryTop"): void;
  counterSpell(stackItemId: string): void;
  draw(player: number, count: number): void;
  /** ADR-070 Amendment 3: mill — top `count` cards of the player's library to their graveyard (zone-change events fire per card; not a draw). */
  mill(player: number, count: number): void;
  addContinuousEffect(effect: ResolvedContinuousEffect): void;
  addMana(player: number, mana: string): void;
  /**
   * ADR-068 Amendment 1: search the player's library for cards matching the
   * predicate; the chooser sees the candidates (request payload, ADR-032
   * pattern) and may take one (to hand, or to the battlefield, tapped if
   * asked) or decline; the library is ALWAYS shuffled after (CR 701.19),
   * through the logged game RNG. Async: it is a DecisionRequest.
   */
  searchLibrary(player: number, predicate: "basicLand" | "anyCard" | `subtype:${string}`, to: "hand" | "battlefield", entersTapped: boolean): Promise<void>;
  /** ADR-075 A8: exile the object and return it to the battlefield under the effect controller's control as a new object (ETBs fire). */
  exileThenReturn(objectId: string): void;
  /** A10 (S22): `pt` sets the tokens' base P/T, locked at creation (Overload's Weird). */
  createToken(player: number, tokenId: string, count: number, pt?: { power: number; toughness: number }): void;
  addCounters(objectId: string, kind: CounterKind, count: number): void;
  gainLife(player: number, amount: number): void;
  /** Destruction by effect (CR 701.7); honors indestructible. Death itself is still the SBA's call. */
  destroy(objectId: string): void;
  /** ADR-076: destroy several at once (Wrath) — a simultaneous batch for look-back purposes. */
  destroyMany(objectIds: string[]): void;
  /** Tap by effect (CR 701.27a): no-op if already tapped or gone. */
  tap(objectId: string): void;
  /** Untap by effect (CR 701.21a): no-op if already untapped or gone. */
  untap(objectId: string): void;
  /**
   * Two creatures fight (CR 701.12): each deals damage equal to its power to
   * the other, simultaneously, with the creatures as damage sources (so
   * deathtouch/lifelink apply). Callers have already verified both are legal.
   */
  fight(idA: string, idB: string): void;
  /** Exile (CR 700.4: not a death — no DIES trigger). */
  exile(objectId: string): void;
  /** S23 (ADR-084): sacrifice the resolving ability's own SOURCE (the Thundersnake) — a sacrifice,
   * not a destruction (no indestructible shield); DIES fires; no-op if the source left already. */
  sacrificeSource(): void;
  /** Move a card from a graveyard to the battlefield or its owner's hand (Zombify, Gravedigger, Rancor's self-return).
   * A10 (S22): `temporary` — the package rule (haste; sacrificed at the beginning of the next end
   * step); `withCounters` — it enters with counters (Graceful Restoration). */
  returnFromGraveyard(objectId: string, to: "battlefield" | "hand", opts?: { temporary?: boolean; withCounters?: { kind: "+1/+1"; count: number } }): void;
  loseLife(player: number, amount: number): void;
  /**
   * Discard N from a player's hand per ADR-029. Chooser interaction makes
   * this the one async op: ownerChooses/casterChooses issue DecisionRequests;
   * random draws from the game RNG (logged).
   */
  discard(player: number, count: number, mode: DiscardMode, filter?: DiscardFilter): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(readonly word: string) {
    super(`Effect resolver not implemented: "${word}" (add it via a session brief, not ad hoc)`);
    this.name = "NotImplementedError";
  }
}

export type EffectResolver = (effect: Effect, ctx: EffectContext) => void | Promise<void>;

function targeted(effect: Effect & { target?: number; scope?: Scope; targetSpec?: number }, ctx: EffectContext): ResolvedTarget[] {
  // Effects address objects by declared-target index, by scope, or (A8) by SPEC index — every
  // still-legal target the range spec chose (fizzle independence per target).
  if (effect.target !== undefined) {
    const t = ctx.target(effect.target);
    return t ? [t] : [];
  }
  if (effect.targetSpec !== undefined) return ctx.targetsOfSpec(effect.targetSpec);
  if (effect.scope !== undefined) {
    return ctx.objectsInScope(effect.scope).map((id) => ({ kind: "object" as const, id }));
  }
  throw new Error(`Effect "${effect.type}" has neither target nor scope`);
}

const implemented: Partial<Record<EffectType, EffectResolver>> = {
  damage: (e, ctx) => {
    if (e.type !== "damage") throw new Error("resolver mismatch");
    // A10: the Warden's law addresses the event — the untapped creature damages its own controller.
    if (e.to === "eventPlayer") {
      const p = ctx.eventPlayer();
      if (p !== null) ctx.dealDamage({ kind: "player", player: p }, ctx.amount(e.amount), e.from);
      return;
    }
    // S25: the controller's own recoil (the Ruby Tyrant) — the resolving source deals it.
    if (e.to === "you") {
      ctx.dealDamage({ kind: "player", player: ctx.players("you")[0]! }, ctx.amount(e.amount));
      return;
    }
    for (const t of targeted(e, ctx)) ctx.dealDamage(t, ctx.amount(e.amount), e.from); // A8: targetSpec fans out
  },

  bounce: (e, ctx) => {
    if (e.type !== "bounce") throw new Error("resolver mismatch");
    for (const t of targeted(e, ctx)) if (t.kind === "object") ctx.bounce(t.id, e.to); // S20: Arcanis self-bounce via scope
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

  mill: (e, ctx) => {
    if (e.type !== "mill") throw new Error("resolver mismatch");
    // S23: count may be a value ref (the Traumatizer's eventDamage ×2).
    for (const p of ctx.players(e.who)) ctx.mill(p, ctx.amount(e.count));
  },

  sacrifice: (e, ctx) => {
    if (e.type !== "sacrifice") throw new Error("resolver mismatch");
    // S23 (ADR-084): self-only v1 — the Thundersnake's exit. No-op if the source raced away.
    ctx.sacrificeSource();
  },

  modifyPT: (e, ctx) => {
    if (e.type !== "modifyPT") throw new Error("resolver mismatch");
    // P/T deltas may reference X, positively or negated (Drana: -0/-X and +X/+0).
    const pt = (v: PTAmount): number =>
      v === "X" ? ctx.amount("X") : v === "-X" ? -ctx.amount("X") : typeof v === "number" ? v : ctx.amount(v);
    for (const t of targeted(e, ctx)) {
      if (t.kind !== "object") continue;
      ctx.addContinuousEffect({
        kind: "modifyPT",
        objectId: t.id,
        power: pt(e.power),
        toughness: pt(e.toughness),
        duration: e.duration,
      });
    }
  },

  grantKeyword: (e, ctx) => {
    // S25 word 5 (ADR-088): keyword-until-EOT as a RESOLVED effect (the Pearl Cleric's
    // indestructible) — grantKeyword had been static-only; the resolved form rides the
    // modifyPT/restrict continuous-effect machinery unchanged. characteristics() already
    // merges stored grantKeyword effects (the temporary-reanimation haste rider proved it).
    if (e.type !== "grantKeyword") throw new Error("resolver mismatch");
    for (const t of targeted(e, ctx)) {
      if (t.kind !== "object") continue;
      ctx.addContinuousEffect({
        kind: "grantKeyword",
        objectId: t.id,
        keyword: e.keyword,
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
    // Choice-bearing production (Lotus) is resolved at activation, not here:
    // the engine adds the chosen colour directly (CR 605: no stack). A
    // fixed-production ability that somehow reaches the stack still works.
    if (e.mana) for (const p of ctx.players("you")) ctx.addMana(p, e.mana);
  },

  searchLibrary: async (e, ctx) => {
    if (e.type !== "searchLibrary") throw new Error("resolver mismatch");
    for (const p of ctx.players("you")) await ctx.searchLibrary(p, e.predicate, e.to, e.entersTapped === true);
  },

  createToken: (e, ctx) => {
    if (e.type !== "createToken") throw new Error("resolver mismatch");
    // A10: count-as-ref (Aether Mutation's X) and pt locked at resolution (Overload's Weird).
    const count = ctx.amount(e.count);
    const pt = e.pt ? { power: ctx.amount(e.pt), toughness: ctx.amount(e.pt) } : undefined;
    for (const p of ctx.players(e.who)) ctx.createToken(p, e.tokenId, count, pt);
  },

  addCounters: (e, ctx) => {
    if (e.type !== "addCounters") throw new Error("resolver mismatch");
    // S25: count may be a value ref (the Keeper's xPaid); zero counters is a clean no-op.
    const count = typeof e.count === "number" ? e.count : ctx.amount(e.count);
    if (count <= 0) return;
    // ADR-076: target OR scope ("each Vampire you control" — Indulgent Aristocrat).
    if (e.target !== undefined) {
      const t = ctx.target(e.target);
      if (t && t.kind === "object") ctx.addCounters(t.id, e.kind, count);
      return;
    }
    if (e.scope !== undefined) {
      for (const id of ctx.objectsInScope(e.scope, { ...(e.subtype ? { subtype: e.subtype } : {}), ...(e.cardType ? { cardType: e.cardType } : {}), ...(e.other ? { other: true } : {}) })) ctx.addCounters(id, e.kind, count);
    }
  },

  exileThenReturn: (e, ctx) => {
    if (e.type !== "exileThenReturn") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t && t.kind === "object") ctx.exileThenReturn(t.id);
  },

  gainControl: (e, ctx) => {
    // S26 (Lumen, the Hearth Fire): the RESOLVED form — a stored control effect for the turn
    // (the static form never resolves; the validator keeps the two apart). The control layer
    // reads it beside the aura statics at the next SBA pass; cleanup expires it.
    if (e.type !== "gainControl") throw new Error("resolver mismatch");
    if (e.target === undefined) return; // static form — interpreted live, never here
    const t = ctx.target(e.target);
    if (!t || t.kind !== "object") return;
    ctx.addContinuousEffect({ kind: "gainControl", objectId: t.id, controller: ctx.players("you")[0]!, duration: e.duration ?? "UNTIL_END_OF_TURN" });
  },

  gainLife: (e, ctx) => {
    if (e.type !== "gainLife") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) ctx.gainLife(p, ctx.amount(e.amount));
  },

  loseLife: (e, ctx) => {
    if (e.type !== "loseLife") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) ctx.loseLife(p, ctx.amount(e.amount));
  },

  destroy: (e, ctx) => {
    if (e.type !== "destroy") throw new Error("resolver mismatch");
    // A10: targetSpec fans out (Purge destroys every still-legal pick; per-target fizzle).
    for (const t of targeted(e, ctx)) if (t.kind === "object") ctx.destroy(t.id);
  },

  exile: (e, ctx) => {
    if (e.type !== "exile") throw new Error("resolver mismatch");
    const t = ctx.target(e.target);
    if (t && t.kind === "object") ctx.exile(t.id);
  },

  discard: async (e, ctx) => {
    if (e.type !== "discard") throw new Error("resolver mismatch");
    for (const p of ctx.players(e.who)) await ctx.discard(p, e.count, e.mode, e.filter);
  },

  returnFromGraveyard: (e, ctx) => {
    if (e.type !== "returnFromGraveyard") throw new Error("resolver mismatch");
    for (const t of targeted(e, ctx)) {
      if (t.kind === "object") ctx.returnFromGraveyard(t.id, e.to, { ...(e.temporary ? { temporary: true } : {}), ...(e.withCounters ? { withCounters: e.withCounters } : {}) });
    }
  },

  destroyAll: (e, ctx) => {
    if (e.type !== "destroyAll") throw new Error("resolver mismatch");
    ctx.destroyMany(ctx.objectsInScope(e.scope));
  },

  damageAll: (e, ctx) => {
    if (e.type !== "damageAll") throw new Error("resolver mismatch");
    const amount = ctx.amount(e.amount);
    for (const id of ctx.objectsInScope(e.scope)) ctx.dealDamage({ kind: "object", id }, amount);
  },

  fight: (e, ctx) => {
    if (e.type !== "fight") throw new Error("resolver mismatch");
    // ADR-022: all-or-nothing. If either target is illegal at resolution,
    // neither creature deals or takes damage.
    const a = ctx.target(e.targets[0]);
    const b = ctx.target(e.targets[1]);
    if (!a || !b || a.kind !== "object" || b.kind !== "object") return;
    ctx.fight(a.id, b.id);
  },

  tapTarget: (e, ctx) => {
    if (e.type !== "tapTarget") throw new Error("resolver mismatch");
    // First user: Cunning Tactician (ADR-053). Tapping neither removes a
    // declared blocker nor undoes an attack (CR 506.4c-adjacent: nothing in
    // tapping removes a creature from combat).
    for (const t of targeted(e, ctx)) {
      if (t.kind === "object") ctx.tap(t.id);
    }
  },

  untapTarget: (e, ctx) => {
    if (e.type !== "untapTarget") throw new Error("resolver mismatch");
    // First user: Little Bear (S17). Untap by effect (CR 701.21a): no-op if already untapped or gone.
    for (const t of targeted(e, ctx)) {
      if (t.kind === "object") ctx.untap(t.id);
    }
  },
};

export const IMPLEMENTED_EFFECT_TYPES: ReadonlySet<EffectType> = new Set(
  Object.keys(implemented) as EffectType[],
);

/** Resolve one effect. Unimplemented vocabulary throws NotImplementedError by design (brief Part 2). */
export async function resolveEffect(effect: Effect, ctx: EffectContext): Promise<void> {
  const resolver = implemented[effect.type];
  if (!resolver) throw new NotImplementedError(effect.type);
  // ADR-076: a conditioned clause is skipped when its target no longer matches (evaluated at resolution).
  if (effect.if && !ctx.targetMatches(effect.if)) return;
  await resolver(effect, ctx);
}
