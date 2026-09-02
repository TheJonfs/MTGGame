import { resolveEffect, type Effect } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { makeInitEffectContext } from "./effect-context.js";
import { drawCard } from "./ops.js";
import { getObject, type PlayerId } from "./state.js";
import { createObject, moveObject } from "./zones.js";

/** Overworld-imposed match modifiers (data-model §5). Applied at initialization only (ADR-002). */
export type Modifier =
  | { type: "startingLife"; player: PlayerId; value: number }
  | { type: "extraCards"; player: PlayerId; count: number }
  | { type: "permanentOnBattlefield"; player: PlayerId; cardId: string }
  | { type: "effectAtStart"; player: PlayerId; effects: Effect[] }
  /** S22b — the lord's entrance (Chris-ratified): after the final mulligan keep (modifiers run
   * post-setup, ADR-002), one random nonland hand card returns to the library, the signature
   * comes to hand, shuffle. Logged via the game RNG — deterministic, replay-clean. Already in
   * hand → nothing happens (the danger already looms); no library copy → nothing happens
   * (a Hymn'd or drawn-out signature is NOT restored — the discard counterplay). */
  | { type: "signatureToHand"; player: PlayerId; cardId: string }
  /** S27 (ADR-093): the law sequence the Manafleur walks — an ascension hook by data. Omitted
   * fields keep the defaults (the WBRUG ring; `sequence`). */
  | { type: "lawSequence"; order?: string[]; mode?: "sequence" | "random" | "accumulate" };

export function applyModifiers(ctx: EngineCtx, modifiers: Modifier[]): void {
  for (const m of modifiers) {
    switch (m.type) {
      case "startingLife":
        ctx.state.players[m.player].life = m.value;
        break;
      case "extraCards":
        for (let i = 0; i < m.count; i++) drawCard(ctx, m.player);
        break;
      case "permanentOnBattlefield": {
        // S26 r3 (Chris notes 1–2): a token DEF (the empowerment's 2/2, a boon Soldier, the
        // Barrowlands' Zombie) and a LAW (uncastable) enter as TOKENS — they cease to exist on
        // leaving the battlefield (CR 111.7): a blink removes them, a bounce or a kill ends them
        // (the S22b "stuck in hand" quirk is retired; the law returns next fight by re-injection).
        // Real cards placed this way (a manalink's Plains, the Deepwood's Elves) stay real.
        const def = ctx.defs.def(m.cardId);
        createObject(ctx, m.cardId, m.player, "battlefield", { isToken: !!(def.isTokenDef || def.uncastable) });
        break;
      }
      case "effectAtStart": {
        const ectx = makeInitEffectContext(ctx, m.player);
        for (const e of m.effects) resolveEffect(e, ectx);
        break;
      }
      case "lawSequence":
        if (m.order && m.order.length > 0) ctx.state.lawSequence.order = [...m.order];
        if (m.mode) ctx.state.lawSequence.mode = m.mode;
        ctx.state.lawSequence.next = 0;
        break;
      case "signatureToHand": {
        const p = ctx.state.players[m.player];
        if (p.hand.some((id) => getObject(ctx.state, id).cardId === m.cardId)) break; // already looming
        const inLibrary = p.library.find((id) => getObject(ctx.state, id).cardId === m.cardId);
        if (!inLibrary) break; // stripped or absent: he must draw into his copies
        // One random card back — nonland preferred (the kept hand's lands stay); all-lands hands
        // return a land (the swap keeps hand size honest).
        const nonlands = p.hand.filter((id) => !ctx.defs.def(getObject(ctx.state, id).cardId).types.includes("Land"));
        const pool = nonlands.length > 0 ? nonlands : [...p.hand];
        if (pool.length > 0) moveObject(ctx, pool[ctx.rng.int(pool.length, "entrance")]!, "library");
        moveObject(ctx, inLibrary, "hand");
        p.library = ctx.rng.shuffle(p.library, "shuffle");
        break;
      }
    }
  }
  // Planner ruling (S2 brief fixture 14): modifiers apply before the first
  // turn, and triggers collected during initialization are discarded — a
  // permanentOnBattlefield Pelakka does not gain 7 life.
  ctx.state.pendingTriggers = [];
}
