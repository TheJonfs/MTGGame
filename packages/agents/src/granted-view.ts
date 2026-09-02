import type { ActivatedAbilityDef, AbilityDef, CardDef, Effect, Keyword } from "@shandalar/cards";
import type { GameView } from "@shandalar/engine";

/**
 * S22 (A10 word 8): the VIEW-side mirror of the engine's abilitiesOf — agents receive
 * `activateAbility` actions whose abilityIndex runs over the virtual list (printed abilities
 * followed by granted ones, in battlefield order of the granting permanents). Every agent-side
 * `def.abilities[abilityIndex]` lookup must use this instead, or granted abilities (the Stoker's
 * cycling, the Felidar's tapper) mis-resolve and slip past their pins (pin 13 rides on it).
 *
 * Known simplification: conditional statics (A4 staticActive) are treated as active — no current
 * granter is conditional; revisit if one arrives.
 */
export function viewAbilityAt(view: GameView, defs: Map<string, CardDef>, objectId: string, index: number): AbilityDef | undefined {
  const onBf = view.battlefield.find((o) => o.id === objectId);
  const inHand = view.hand.find((c) => c.objectId === objectId);
  const inGy = view.graveyardObjects.flatMap((g) => g).find((c) => c.objectId === objectId);
  const cardId = onBf?.cardId ?? inHand?.cardId ?? inGy?.cardId;
  const def = cardId ? defs.get(cardId) : undefined;
  if (!def) return undefined;
  const printed = def.abilities ?? [];
  if (index < printed.length) return printed[index];
  if (!onBf && !inHand) return undefined; // grants reach only hand and battlefield

  let k = index - printed.length;
  for (const src of view.battlefield) {
    const sdef = defs.get(src.cardId);
    for (const ab of sdef?.abilities ?? []) {
      if (ab.kind !== "static") continue;
      for (const e of ab.effects as Effect[]) {
        if (e.type !== "grantAbility") continue;
        let applies = false;
        if (e.zone === "hand") {
          // The static controller's whole hand; the view only shows OUR hand, and the engine only
          // enumerates our actions — so a hand grant applies when the granter is ours.
          applies = !!inHand && src.controller === view.you && (!e.cardType || def.types.includes(e.cardType));
        } else if (e.zone === "battlefield" && onBf) {
          applies = battlefieldScopeIncludes(view, defs, src, e, onBf);
        }
        if (applies) {
          if (k === 0) return grantedActivated(e.ability, e.zone);
          k -= 1;
        }
      }
    }
  }
  return undefined;
}

function battlefieldScopeIncludes(
  view: GameView,
  defs: Map<string, CardDef>,
  src: GameView["battlefield"][number],
  e: { scope?: string; withKeyword?: Keyword; cardType?: string },
  target: GameView["battlefield"][number],
): boolean {
  const tdef = defs.get(target.cardId);
  if (!tdef) return false;
  if (e.cardType && !tdef.types.includes(e.cardType as never)) return false;
  if (e.withKeyword && !target.keywords.includes(e.withKeyword)) return false;
  switch (e.scope) {
    case "creaturesYouControl":
      return target.controller === src.controller && tdef.types.includes("Creature");
    case "creaturesYouDontControl":
      return target.controller !== src.controller && tdef.types.includes("Creature");
    case "laws":
      return tdef.law === true;
    case "allCreatures":
      return tdef.types.includes("Creature");
    case "self":
      return target.id === src.id;
    default:
      return false;
  }
}

function grantedActivated(a: ActivatedAbilityDef, zone: "hand" | "battlefield"): ActivatedAbilityDef {
  return a.zone === zone ? a : { ...a, zone };
}
