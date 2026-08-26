import type { ActivatedAbilityDef, AbilityDef } from "@shandalar/cards";
import { objectsInScope, staticActive, type ScopeParams } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import { getObject } from "./state.js";

/**
 * A10 word 8 (S22): grantAbility — enumeration-time ability grants (no ADR-003 layer contact).
 * A card's effective ability list is its printed abilities followed by every ability granted to it
 * by battlefield statics, in battlefield (timestamp) order of the granting permanents. Both the
 * enumerator and the activation path address abilities by index into THIS list, so a granted
 * ability's index is stable between enumeration and activation (nothing moves inside one priority
 * window). Grants:
 *   zone "hand"        — to every card in the static's controller's hand (the Stoker's cycling;
 *                        lands cycle too — the grant is unconditional unless cardType narrows it).
 *   zone "battlefield" — to permanents selected by the scope + filters (Frondland Felidar:
 *                        creaturesYouControl withKeyword vigilance — including himself, per ruling).
 */
export interface AbilityEntry {
  ability: AbilityDef;
  /** The granting permanent's object id, when the ability is not printed on the card. */
  grantedBy?: string;
}

export function abilitiesOf(ctx: EngineCtx, objectId: string): AbilityEntry[] {
  const obj = ctx.state.objects[objectId];
  if (!obj) return [];
  const def = ctx.defs.def(obj.cardId);
  const out: AbilityEntry[] = (def.abilities ?? []).map((ability) => ({ ability }));
  if (obj.zone !== "hand" && obj.zone !== "battlefield") return out;

  for (const srcId of ctx.state.battlefield) {
    const src = getObject(ctx.state, srcId);
    for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
      if (ability.kind !== "static" || !staticActive(ctx, srcId, ability.condition)) continue;
      for (const e of ability.effects) {
        if (e.type !== "grantAbility") continue;
        if (e.zone === "hand") {
          // "Cards in your hand": the static controller's hand (hand objects' controller = owner).
          if (obj.zone !== "hand" || obj.controller !== src.controller) continue;
          if (e.cardType && !def.types.includes(e.cardType)) continue;
          out.push({ ability: grantedActivated(e.ability, "hand"), grantedBy: srcId });
        } else {
          if (obj.zone !== "battlefield" || !e.scope) continue;
          const params: ScopeParams = {
            ...(e.withKeyword ? { withKeyword: e.withKeyword } : {}),
            ...(e.cardType ? { cardType: e.cardType } : {}),
          };
          if (!objectsInScope(ctx, srcId, e.scope, params).includes(objectId)) continue;
          out.push({ ability: grantedActivated(e.ability, "battlefield"), grantedBy: srcId });
        }
      }
    }
  }
  return out;
}

/** The granted ability, pinned to the zone the grant addresses (defensive: the def is data). */
function grantedActivated(a: ActivatedAbilityDef, zone: "hand" | "battlefield"): ActivatedAbilityDef {
  return a.zone === zone ? a : { ...a, zone };
}
