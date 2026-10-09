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
    // Post-S58 (Reaper's Forerunner's matrix): "choose two" — a modal trigger's modes replaced by every pair of them. A
    // mode that reads `who: "target"` (the first target) goes first in its pair; the other's target indices move up.
    else if (k === "modes" && v === "2") out.abilities = (d.abilities ?? []).map((a) => {
      if (a.kind !== "triggered" || !a.modes || a.modes.length < 2) return a;
      const first = (m: (typeof a.modes)[number]) => (m.effects.some((e) => "who" in e && e.who === "target") ? 0 : 1);
      const pairs = a.modes.flatMap((x, i) => a.modes!.slice(i + 1).map((y) => {
        const [p, q] = first(x) <= first(y) ? [x, y] : [y, x], shift = (p.targets ?? []).length;
        return { label: `${p.label}; ${q.label}`, targets: [...(p.targets ?? []), ...(q.targets ?? [])], effects: [...p.effects, ...q.effects.map((e) => ("target" in e && typeof e.target === "number" ? { ...e, target: e.target + shift } : e))] };
      }));
      return { ...a, modes: pairs.map((m) => (m.targets.length ? m : { label: m.label, effects: m.effects })) } as typeof a;
    });
    else throw new Error(`card-test: unknown modifier ${m}`);
  }
  return out;
}
