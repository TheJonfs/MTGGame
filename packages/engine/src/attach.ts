import type { Effect } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import type { EffectRequester } from "./effect-context.js";
import type { PlayerId } from "./state.js";
import { isLegalAttachment } from "./targeting.js";

/**
 * Post-S65 (R-114) — an Aura put onto the battlefield without being cast (CR 303.4f): "the player putting it onto the
 * battlefield chooses an object … for the Aura to enchant even though no player is targeting that object." The legal
 * hosts are the battlefield objects its enchant restriction (the Aura's own first target spec) allows, read without
 * targeting — hexproof and shroud do not stop it. With none, it stays where it is (CR 303.4g): the caller does not move it.
 * The general step for any card that puts an Aura onto the battlefield (today: a return from the graveyard — Karmic Mentor).
 */
export function auraHosts(ctx: EngineCtx, auraCardId: string, chooser: PlayerId): string[] {
  const spec = ctx.defs.def(auraCardId).targets?.[0];
  if (!spec) return [];
  return ctx.state.battlefield.filter((id) => isLegalAttachment(ctx, spec, id, chooser));
}

/** The host chosen for an entering Aura, or null when there is none (it stays put). One `chooseAttachHost` request. */
export async function chooseAuraHost(ctx: EngineCtx, auraCardId: string, chooser: PlayerId, requester?: EffectRequester): Promise<string | null> {
  const hosts = auraHosts(ctx, auraCardId, chooser);
  if (hosts.length === 0) return null;
  if (!requester) return hosts[0]!; // the initialization context has no agent (no Aura enters there)
  const def = ctx.defs.def(auraCardId);
  const effects = (def.abilities ?? []).flatMap((a) => ("effects" in a ? (a.effects as Effect[]) : []));
  const pick = await requester(chooser, "chooseAttachHost", hosts.map((objectId) => ({ type: "chooseAttachHost" as const, objectId })), undefined, { cardId: auraCardId, effects });
  if (pick.type !== "chooseAttachHost" || !hosts.includes(pick.objectId)) throw new Error("chooseAttachHost: expected one of the offered hosts");
  return pick.objectId;
}
