import { characteristics, type EngineCtx, type PlayerId } from "@shandalar/engine";

/** Whose permanent a dialog option names, relative to the seated player. "stolen": you control it, they own it;
 * "taken": they control it, you own it — the two a controller-only tag called "yours" and "theirs". */
export type OptionTag = "you" | "them" | "stolen" | "taken";

/** Post-S71 (Chris: which Lumen does the legend rule keep, which creature pays for Cairnbrand — the stolen one or
 * my own?): the facts that tell one permanent from another of the same name — its whose, its live P/T, tapped,
 * summoning sick, its counters, what is attached to it. The dialog shows them under each battlefield option. */
export function optionFacts(ctx: EngineCtx, id: string, you: PlayerId): { tag: OptionTag; facts: string[] } | null {
  const state = ctx.state;
  const o = state.objects[id];
  if (!o || o.zone !== "battlefield") return null;
  const mine = o.controller === you, owned = o.owner === you;
  const tag: OptionTag = mine ? (owned ? "you" : "stolen") : (owned ? "taken" : "them");
  const def = ctx.defs.def(o.cardId);
  const facts: string[] = [];
  if (def.types.includes("Creature")) {
    const ch = characteristics(ctx, id);
    facts.push(`${ch.power}/${ch.toughness}${o.damage > 0 ? ` (${o.damage} damage)` : ""}`);
    if (o.summoningSick) facts.push("summoning sick");
  }
  if (o.tapped) facts.push("tapped");
  for (const [k, n] of Object.entries(o.counters)) if (n > 0) facts.push(`${k} ×${n}`);
  for (const a of state.battlefield) {
    const x = state.objects[a];
    if (x?.attachedTo === id) facts.push(`under ${ctx.defs.def(x.cardId).name}${x.controller !== o.controller ? (x.controller === you ? " (yours)" : " (theirs)") : ""}`);
  }
  return { tag, facts };
}

export const TAG_LABEL: Record<OptionTag, string> = { you: "yours", them: "theirs", stolen: "stolen", taken: "taken from you" };
