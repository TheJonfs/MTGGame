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
    // Post-S70 (the Mountain ritual's rider): Mountaincycling at that cost, compiled as the loader compiles typed cycling
    else if (k === "mcycle") out.abilities = [...(out.abilities ?? d.abilities ?? []), { kind: "activated", zone: "hand", cost: { mana: v, discardSelf: true }, effects: [{ type: "searchLibrary", predicate: "subtype:Mountain", to: "hand" }] }];
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
    // S70 (the High Grounds' corners, ADR-182): the STUDY ability — the last activated ability with an effect beyond
    // mana — at another cost (`acost={3}{R}{W}`), or another size (`n=3`: its damage and life gained, its mill, its
    // copies; a search's count is not touched, nor a damage that rides a search — Burnfallow's ping is `ping=2`).
    else if (k === "acost" || k === "n" || k === "ping") {
      const abil = [...(out.abilities ?? d.abilities ?? [])];
      const at = abil.map((a, i) => (a.kind === "activated" && a.effects.some((e) => e.type !== "addMana") ? i : -1)).filter((i) => i >= 0).pop();
      if (at === undefined) throw new Error(`card-test: ${id} has no study ability for ${k}`);
      const a = abil[at] as Extract<(typeof abil)[number], { kind: "activated" }>;
      const searches = a.effects.some((e) => e.type === "searchLibrary");
      if (k === "acost") abil[at] = { ...a, cost: { ...a.cost, mana: v } };
      else abil[at] = { ...a, effects: a.effects.map((e) => {
        const n = Number(v);
        if (k === "ping") return e.type === "damage" ? { ...e, amount: n } : e;
        if (e.type === "damage" && !searches) return { ...e, amount: n };
        if (e.type === "gainLife" && typeof e.amount === "number") return { ...e, amount: n };
        if (e.type === "mill" && typeof e.count === "number") return { ...e, count: n };
        if (e.type === "copyToken") return { ...e, count: n };
        return e;
      }) };
      out.abilities = abil;
    }
    else throw new Error(`card-test: unknown modifier ${m}`);
  }
  return out;
}
