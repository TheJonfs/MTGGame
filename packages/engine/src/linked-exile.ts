import type { EngineCtx } from "./ctx.js";
import { chooseAuraHost } from "./attach.js";
import type { EffectRequester } from "./effect-context.js";
import type { PlayerId } from "./state.js";
import { moveObject } from "./zones.js";

/**
 * Post-S72 (R-130, the Banisher) — "exile … until this leaves the battlefield" (CR 610.3). Every linked card whose
 * source is no longer on the battlefield returns under its OWNER's control (a new object; CR 610.3c). The rules say
 * "immediately after" the source leaves; we apply it at the next SBA check, before any player receives priority —
 * observably the same, and it lets a returning Aura ask for its host (CR 303.4f; with none it stays exiled, 303.4g).
 * Object ids are never reused, so a source id that names no battlefield object has left. Returns true if anything moved.
 */
export async function returnLinkedExiles(ctx: EngineCtx, requester?: EffectRequester): Promise<boolean> {
  const state = ctx.state;
  if (!state.linkedExiles) return false; // a state saved before R-130
  const due = state.linkedExiles.filter((l) => state.objects[l.sourceId]?.zone !== "battlefield");
  if (due.length === 0) return false;
  state.linkedExiles = state.linkedExiles.filter((l) => !due.includes(l));
  let moved = false;
  for (const l of due) {
    const card = state.objects[l.exiledId];
    if (!card || card.zone !== "exile") continue; // it left exile some other way: the link is spent
    const owner = card.owner as PlayerId;
    let attachedTo: string | undefined;
    if ((ctx.defs.def(card.cardId).subtypes ?? []).includes("Aura")) {
      const host = await chooseAuraHost(ctx, card.cardId, owner, requester);
      if (!host) continue;
      attachedTo = host;
    }
    moveObject(ctx, l.exiledId, "battlefield", { controller: owner, ...(attachedTo ? { attachedTo } : {}) });
    moved = true;
  }
  return moved;
}
