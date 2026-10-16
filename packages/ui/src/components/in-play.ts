import { characteristicsTrace, type EngineCtx } from "@shandalar/engine";

/** S65 (Chris: Baru's token read as a vanilla 6/6): what has changed on a permanent in play against its printed card —
 * each P/T change, each keyword gained or lost, restrictions, counters, control and attachments, with their sources
 * and durations. Nothing when the permanent is as printed. */
export function inPlayLines(ctx: EngineCtx, objectId: string): { text: string; tone: "boost" | "reduce" | "plain" }[] {
  const obj = ctx.state.objects[objectId];
  if (!obj || obj.zone !== "battlefield") return [];
  const def = ctx.defs.def(obj.cardId), isCreature = def.types.includes("Creature");
  const t = characteristicsTrace(ctx, objectId);
  const name = (id?: string) => (id ? ctx.defs.def(id).name : "an effect");
  const when = (d: string) => (d === "untilEndOfTurn" ? " until end of turn" : "");
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const out: { text: string; tone: "boost" | "reduce" | "plain" }[] = [];
  if (isCreature && (t.power !== t.printed.power || t.toughness !== t.printed.toughness)) out.push({ text: `${t.power}/${t.toughness} (printed ${t.printed.power}/${t.printed.toughness})`, tone: t.power + t.toughness >= t.printed.power + t.printed.toughness ? "boost" : "reduce" });
  for (const c of t.contributions) {
    if (c.what === "pt" && (c.power || c.toughness)) out.push({ text: `${signed(c.power ?? 0)}/${signed(c.toughness ?? 0)} from ${name(c.sourceCardId)}${when(c.duration)}`, tone: (c.power ?? 0) + (c.toughness ?? 0) >= 0 ? "boost" : "reduce" });
    if (c.what === "counters") out.push({ text: `${signed(c.power ?? 0)}/${signed(c.toughness ?? 0)} from counters`, tone: (c.power ?? 0) >= 0 ? "boost" : "reduce" });
    if (c.what === "keyword" && c.keyword && t.gained.includes(c.keyword)) out.push({ text: `${c.keyword[0]!.toUpperCase()}${c.keyword.slice(1)} from ${name(c.sourceCardId)}${when(c.duration)}`, tone: "boost" });
    if (c.what === "restrict") out.push({ text: `${c.restrict === "attack" ? "Can't attack" : c.restrict === "block" ? "Can't block" : "Can't attack or block"} — ${name(c.sourceCardId)}${when(c.duration)}`, tone: "reduce" });
    if (c.what === "control") out.push({ text: `Controlled by ${obj.controller === obj.owner ? "its owner" : "the other player"} — ${name(c.sourceCardId)}${when(c.duration)}`, tone: "plain" });
  }
  for (const k of t.lost) out.push({ text: `Loses ${k}`, tone: "reduce" });
  for (const id of ctx.state.battlefield) { const a = ctx.state.objects[id]!; if (a.attachedTo === objectId) { const ad = ctx.defs.def(a.cardId); out.push({ text: `${(ad.subtypes ?? []).includes("Equipment") ? "Equipped with" : "Enchanted by"} ${ad.name}${a.controller !== obj.controller ? " (the other player's)" : ""}`, tone: "plain" }); } }
  if (obj.controller !== obj.owner && !t.contributions.some((c) => c.what === "control")) out.push({ text: "Controlled by the other player", tone: "plain" });
  return out;
}

