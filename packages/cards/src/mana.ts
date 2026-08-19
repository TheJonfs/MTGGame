/** Mana cost/production parsing. Format: "{X}{2}{W}{W}", "" for lands. */

export const COLORS = ["W", "U", "B", "R", "G"] as const;
export type Color = (typeof COLORS)[number];

/** What a mana ability can produce: a color or colorless {C} (S3, Mind Stone). */
export const MANA_SYMBOLS = ["W", "U", "B", "R", "G", "C"] as const;
export type ManaSymbol = (typeof MANA_SYMBOLS)[number];

export interface ManaCost {
  generic: number;
  xCount: number; // number of {X} symbols (Blaze has 1; no pool card has 2)
  colored: Record<Color, number>;
}

export function emptyManaCost(): ManaCost {
  return { generic: 0, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 } };
}

const SYMBOL_RE = /\{([^}]+)\}/g;

export function parseManaCost(text: string): ManaCost {
  const cost = emptyManaCost();
  if (text === "") return cost;
  let matchedLength = 0;
  for (const m of text.matchAll(SYMBOL_RE)) {
    matchedLength += m[0].length;
    const sym = m[1]!;
    if (sym === "X") cost.xCount += 1;
    else if (/^\d+$/.test(sym)) cost.generic += parseInt(sym, 10);
    else if ((COLORS as readonly string[]).includes(sym)) cost.colored[sym as Color] += 1;
    else throw new Error(`Unknown mana symbol {${sym}} in "${text}"`);
  }
  if (matchedLength !== text.length) throw new Error(`Malformed mana cost "${text}"`);
  return cost;
}

/** Converted cost given a chosen X (CR 202.3). */
export function manaValue(cost: ManaCost, x = 0): number {
  return cost.generic + cost.xCount * x + COLORS.reduce((n, c) => n + cost.colored[c], 0);
}

/** Parse mana produced by addMana effects, e.g. "{R}", "{C}", "{G}{G}". No X. */
export function parseManaProduction(text: string): { symbol: ManaSymbol }[] {
  const out: { symbol: ManaSymbol }[] = [];
  let matchedLength = 0;
  for (const m of text.matchAll(SYMBOL_RE)) {
    matchedLength += m[0].length;
    const sym = m[1]!;
    if ((MANA_SYMBOLS as readonly string[]).includes(sym)) out.push({ symbol: sym as ManaSymbol });
    else throw new Error(`Unknown mana production symbol {${sym}}`);
  }
  if (matchedLength !== text.length || out.length === 0) {
    throw new Error(`Malformed mana production "${text}"`);
  }
  return out;
}
