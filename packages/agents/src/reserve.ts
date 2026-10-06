/**
 * S56 (Part 1, the counter rule; book 108): paying for one thing so that another stays payable.
 *
 * The probe's finding (counter-probe): the pilot's counterspells went uncast mostly because the mana left untapped was
 * the wrong COLOUR — the engine's automatic payment taps whatever pays, and a three-colour control deck that paid for
 * a Vindicate with its Islands faced the opponent's turn with two Swamps and an Absorb. A person taps the lands the
 * held card does not need.
 *
 * `reserveTaps` chooses which producers pay a cost so that what is left can still pay a second (held) cost; the agent
 * then taps those by hand (the tapForMana actions the engine already offers a human) before the cast. Pure functions
 * over what the request offers — no card names, no game state.
 */
export interface ManaSource { id: string; colors: string[]; creature: boolean }
export interface Tap { id: string; color: string }

const pipsOf = (cost: string): string[] => cost.match(/\{([WUBRGC])\}/g)?.map((x) => x[1]!) ?? [];
const genericOf = (cost: string): number => (cost.match(/\{(\d+)\}/g) ?? []).reduce((n, x) => n + Number(x.slice(1, -1)), 0);

/** Can these sources (each one mana, of one of its colours) pay the cost? Pips matched by backtracking; generic by count. */
export function payableBy(sources: ManaSource[], cost: string, extraGeneric = 0): boolean {
  const pips = pipsOf(cost), generic = genericOf(cost) + extraGeneric;
  if (sources.length < pips.length + generic) return false;
  const used = new Array<boolean>(sources.length).fill(false);
  const match = (k: number): boolean => {
    if (k === pips.length) return true;
    for (let i = 0; i < sources.length; i++) {
      if (used[i] || !sources[i]!.colors.includes(pips[k]!)) continue;
      used[i] = true; if (match(k + 1)) return true; used[i] = false;
    }
    return false;
  };
  return match(0);
}

/** The taps that pay `cost` (plus `x` generic) and leave `hold` payable; null when no such payment exists. A source
 * the held cost has no use for is spent first; a creature last (the engine's own preference: bodies stay untapped). */
export function reserveTaps(sources: ManaSource[], cost: string, x: number, hold: string): Tap[] | null {
  const pips = pipsOf(cost), generic = genericOf(cost) + x, holdPips = new Set(pipsOf(hold));
  if (pips.length + generic === 0) return null;
  if (sources.length < pips.length + generic + pipsOf(hold).length + genericOf(hold)) return null;
  // cheapest to give up first: makes nothing the held cost wants, then fewest colours, then non-creatures
  const need = (s: ManaSource) => s.colors.filter((c) => holdPips.has(c)).length;
  const order = sources.map((s, i) => ({ s, i })).sort((a, b) => need(a.s) - need(b.s) || Number(a.s.creature) - Number(b.s.creature) || a.s.colors.length - b.s.colors.length || a.i - b.i).map((x) => x.s);
  const used = new Array<boolean>(order.length).fill(false), taps: Tap[] = [];
  const rest = () => order.filter((_, i) => !used[i]);
  const generics = (from: number, left: number): boolean => {
    if (left === 0) return payableBy(rest(), hold);
    for (let i = from; i < order.length; i++) {
      if (used[i]) continue;
      used[i] = true; taps.push({ id: order[i]!.id, color: order[i]!.colors.includes("C") ? "C" : order[i]!.colors[0]! });
      if (generics(i + 1, left - 1)) return true;
      used[i] = false; taps.pop();
    }
    return false;
  };
  const colored = (k: number): boolean => {
    if (k === pips.length) return generics(0, generic);
    for (let i = 0; i < order.length; i++) {
      if (used[i] || !order[i]!.colors.includes(pips[k]!)) continue;
      used[i] = true; taps.push({ id: order[i]!.id, color: pips[k]! });
      if (colored(k + 1)) return true;
      used[i] = false; taps.pop();
    }
    return false;
  };
  return colored(0) ? taps : null;
}
