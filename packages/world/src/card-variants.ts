/** Post-S53 (card-test) / S56 (open:rr --swap): a card under test with fields overridden — never written to data/cards. */
import type { CardDef } from "@shandalar/cards";

/** A variant's card: an existing def with fields overridden, under the spec as its id. */
export function variantDef(spec: string, cards: Map<string, CardDef>): CardDef {
  const [id, ...mods] = spec.split("~");
  const d = cards.get(id!); if (!d) throw new Error(`card-test: no card ${id}`);
  if (!mods.length) return d;
  const out: CardDef = { ...d, id: spec };
  for (const m of mods) {
    if (m === "copy") continue;
    const [k, v = ""] = m.split("=");
    if (k === "cost") out.manaCost = v;
    else if (k === "pt") { const [p = 0, t = 0] = v.split("/").map(Number); (out as { power?: number }).power = p; (out as { toughness?: number }).toughness = t; }
    else if (k === "kw") (out as { keywords?: string[] }).keywords = v ? v.split("+") : [];
    // S56 (Protocol's sensitivity): the power an Aura takes from the enchanted creature
    else if (k === "shrink") out.abilities = (d.abilities ?? []).map((a) => (a.kind === "static" ? { ...a, effects: a.effects.map((e) => (e.type === "modifyPT" && e.scope === "attached" ? { ...e, power: -Number(v) } : e)) } : a));
    else throw new Error(`card-test: unknown modifier ${m}`);
  }
  return out;
}
