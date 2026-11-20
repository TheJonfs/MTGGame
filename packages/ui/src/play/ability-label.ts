/**
 * Post-S73a (Chris: a Manaba beside a Silt Spirit offered "Ability 1" and "Ability 2"): the label of an activated
 * ability in the "Activate which ability?" menu. Every ability gets a line that says what it costs and what it does:
 *
 *  1. the ability's own line of rules text, when one can be found — on the card (its `text`, or the oracle text of a
 *     real card), or, for an ability another permanent grants, inside the quotation marks of the granting card's text.
 *     A line is matched by the SHAPE of its cost (the same mana symbols, {T} or not, and each further cost word:
 *     sacrifice, discard, tap an untapped creature, return, pay life, exile, remove a counter);
 *  2. else a line written from the ability's data: its cost, then each effect in a few words.
 *
 * A granted ability is marked with the card that grants it. Two abilities that would read the same (a dual land's two
 * mana abilities share one printed line, "{T}: Add {R} or {W}.") are told apart by what each one makes.
 */
import type { ActivatedAbilityDef, ActivatedCost, Effect } from "@shandalar/cards";

const symbols = (s: string): string => (s.match(/\{[^}]+\}/g) ?? []).filter((x) => x !== "{T}" && x !== "{Q}").join("");
const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);
const NUM = ["zero", "a", "two", "three", "four", "five", "six", "seven"];
const count = (n: number): string => NUM[n] ?? String(n);
const noun = (predicate: string): string => {
  const sub = /subtype:(\w+)/.exec(predicate)?.[1];
  if (sub) return sub;
  if (predicate === "self") return "this permanent";
  return predicate.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/YouControl$/i, "").trim().toLowerCase() || "permanent";
};
const article = (w: string): string => (w.startsWith("this ") ? w : `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`);

/** The cost as rules text writes it: mana, {T}, then each further cost. */
export function costText(cost: ActivatedCost): string {
  const parts: string[] = [];
  if (cost.mana) parts.push(cost.mana);
  if (cost.tap) parts.push("{T}");
  if (cost.tapCreature) parts.push(`Tap ${cost.tapCreature.count === 1 ? "an" : count(cost.tapCreature.count)} untapped ${plural(cost.tapCreature.count, noun(cost.tapCreature.predicate))} you control`);
  if (cost.life) parts.push(`Pay ${cost.life} life`);
  if (cost.discard) parts.push(`Discard ${count(cost.discard)} ${plural(cost.discard, "card")}`);
  if (cost.discardSelf) parts.push("Discard this card");
  if (cost.sacrifice) parts.push(`Sacrifice ${article(noun(cost.sacrifice.predicate))}`);
  if (cost.returnToHand) parts.push(`Return ${article(noun(cost.returnToHand.predicate))} you control to your hand`);
  if (cost.exileSelf) parts.push("Exile this card");
  if (cost.exileTop) parts.push(`Exile the top ${count(cost.exileTop)} ${plural(cost.exileTop, "card")} of your library`);
  if (cost.removeCounters) parts.push(`Remove ${count(cost.removeCounters.count)} ${cost.removeCounters.kind} ${plural(cost.removeCounters.count, "counter")}`);
  return parts.join(", ");
}

const amount = (v: unknown): string | null => (typeof v === "number" ? String(v) : v === "X" ? "X" : null);
const who = (w: unknown): string => (w === "you" ? "you" : w === "opponent" ? "each opponent" : w === "eachPlayer" ? "each player" : w === "target" ? "target player" : "a player");
const humanise = (type: string): string => { const s = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

/** One effect in a few words. Not rules text: enough to tell two abilities apart at a glance. */
export function effectText(e: Effect): string {
  const x = e as unknown as Record<string, unknown>;
  switch (e.type) {
    case "addMana": {
      if (typeof x.mana === "string" && x.mana) return `Add ${x.mana}`;
      const c = x.choice as { count?: number; anyOneColor?: boolean } | undefined;
      return c ? `Add ${c.count && c.count > 1 ? `${count(c.count)} mana` : "one mana"} of any ${c.anyOneColor ? "one color" : "color"}`.replace("one mana of any one color", "one mana of any color") : "Add mana";
    }
    case "draw": { const n = amount(x.count); const w = who(x.who); return w === "you" ? `Draw ${n === "1" ? "a card" : n ? `${n} cards` : "cards"}` : `${w[0]!.toUpperCase() + w.slice(1)} draws ${n === "1" ? "a card" : n ? `${n} cards` : "cards"}`; }
    case "damage": { const n = amount(x.amount); const to = x.to === "opponent" ? " to each opponent" : x.to === "you" ? " to you" : ""; return `Deal ${n ?? "damage"}${n ? " damage" : ""}${to}`; }
    case "damageAll": return `Deal ${amount(x.amount) ?? ""} damage to each creature`.replace("  ", " ");
    case "mill": { const n = amount(x.count); const w = who(x.who); return `${w[0]!.toUpperCase() + w.slice(1)} ${w === "you" ? "mill" : "mills"} ${n === "1" ? "a card" : n ? `${n} cards` : "cards"}`; }
    case "gainLife": { const n = amount(x.amount); const w = who(x.who); return `${w === "you" ? "Gain" : `${w[0]!.toUpperCase() + w.slice(1)} gains`} ${n ?? ""} life`.replace("  ", " "); }
    case "loseLife": { const n = amount(x.amount); const w = who(x.who); return `${w === "you" ? "Lose" : `${w[0]!.toUpperCase() + w.slice(1)} loses`} ${n ?? ""} life`.replace("  ", " "); }
    case "createToken": { const n = amount(x.count); return `Create ${n === "1" ? "a token" : n ? `${n} tokens` : "tokens"}`; }
    case "copyToken": return "Copy a token";
    case "destroy": return "Destroy";
    case "destroyAll": return "Destroy all";
    case "exile": return "Exile";
    case "exileGraveyard": return "Exile a graveyard";
    case "exileThenReturn": return "Exile, then return";
    case "bounce": return x.to === "libraryTop" ? "Put on top of its owner's library" : "Return to hand";
    case "tapTarget": return "Tap";
    case "untapTarget": return "Untap";
    case "counter": return "Counter";
    case "fight": return "Fight";
    case "gainControl": return "Gain control";
    case "exchangeControl": return "Exchange control";
    case "sacrifice": return "Sacrifice";
    case "discard": return `${who(x.who) === "you" ? "Discard" : "Target player discards"}`;
    case "searchLibrary": return `Search your library${x.predicate === "basicLand" ? " for a basic land" : x.predicate === "landCard" ? " for a land" : x.predicate === "creatureCard" ? " for a creature" : typeof x.predicate === "string" && x.predicate.startsWith("subtype:") ? ` for ${article(x.predicate.slice(8))}` : ""}`;
    case "returnFromGraveyard": return x.to === "battlefield" ? "Return from a graveyard to the battlefield" : "Return from your graveyard to your hand";
    case "modifyPT": { const p = amount(x.power), t = amount(x.toughness); const sign = (v: string | null) => (v === null ? "X" : Number(v) >= 0 || v === "X" ? `+${v}` : v); const s = x.scope === "creaturesYouControl" ? "Creatures you control get " : x.scope === "allCreatures" ? "Creatures get " : ""; return `${s}${sign(p)}/${sign(t)}`; }
    case "grantKeyword": return `${x.scope === "creaturesYouControl" ? "Creatures you control gain" : "Gains"} ${String(x.keyword)}`;
    case "addCounters": { const n = amount(x.count); return `Put ${n === "1" ? "a" : n ?? ""} ${String(x.kind)} ${n === "1" ? "counter" : "counters"}`.replace("  ", " "); }
    case "extraTurn": return "Take an extra turn";
    case "revealRandomIfNamed": return "Name a card, then reveal one at random";
    default: return humanise(e.type);
  }
}

/** The written line: cost, a colon, the effects. */
export function writtenLabel(ability: ActivatedAbilityDef): string {
  if ((ability as { equip?: boolean }).equip) return `Equip ${ability.cost.mana ?? "{0}"}`;
  const cost = costText(ability.cost), effects = ability.effects.map(effectText).filter(Boolean);
  const body = effects.length ? `${effects.join(". ")}.` : "(no effect)";
  return cost ? `${cost}: ${body}` : body;
}

/** Whether a line's cost (the text before its first colon) has the shape of this ability's cost. */
function costMatches(costPart: string, cost: ActivatedCost): boolean {
  if (!cost.reduceBy && symbols(costPart) !== symbols(cost.mana ?? "")) return false;
  const has = (re: RegExp) => re.test(costPart);
  return (
    costPart.includes("{T}") === !!cost.tap &&
    has(/\bsacrifice\b/i) === !!cost.sacrifice &&
    has(/\bdiscard\b/i) === !!(cost.discard || cost.discardSelf) &&
    has(/\btap\b[^,]*\buntapped\b/i) === !!cost.tapCreature &&
    has(/\breturn\b/i) === !!cost.returnToHand &&
    has(/\bpay\b[^,]*\blife\b/i) === !!cost.life &&
    has(/\bexile\b/i) === !!(cost.exileSelf || cost.exileTop) &&
    has(/\bremove\b/i) === !!cost.removeCounters
  );
}

/** A word a line's effect should hold for an ability whose first effect is of this type — used only to choose between
 * two lines with the same cost (Library of Alexandria: "{T}: Add {C}." and "{T}: Draw a card. …"). */
const EFFECT_WORD: Partial<Record<Effect["type"], RegExp>> = {
  addMana: /\badd\b/i, draw: /\bdraws?\b/i, damage: /\bdamage\b/i, damageAll: /\bdamage\b/i, mill: /\bmills?\b/i, destroy: /\bdestroy\b/i, gainLife: /\bgains?\b/i,
  loseLife: /\bloses?\b/i, createToken: /\bcreate\b/i, copyToken: /\bcopy\b/i, searchLibrary: /\bsearch\b/i, returnFromGraveyard: /\breturn\b/i, bounce: /\breturn\b/i,
  tapTarget: /\btap\b/i, untapTarget: /\buntap\b/i, counter: /\bcounter\b/i, sacrifice: /\bsacrifices?\b/i, exile: /\bexile\b/i, addCounters: /\bcounters?\b/i,
  modifyPT: /\bgets?\b/i, grantKeyword: /\bgains?\b/i, fight: /\bfights?\b/i, discard: /\bdiscards?\b/i,
};

/** The ability's line in a rules text, or null. `quoted`: look only inside quotation marks (a granting card's text). */
export function printedLine(ability: ActivatedAbilityDef, text: string | undefined, quoted = false): string | null {
  if (!text) return null;
  const chunks = quoted ? [...text.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]!) : text.split("\n");
  const found: string[] = [];
  for (const raw of chunks) {
    const line = raw.trim().replace(/\s*\([^)]*\)\s*$/, ""); // a trailing reminder in brackets is not the ability
    // keywords that carry their cost after them, with no colon: "Mountaincycling {2}", "Equip {1}"
    if (ability.cost.discardSelf && /cycling\s*\{/i.test(line) && symbols(line) === symbols(ability.cost.mana ?? "")) return line;
    if ((ability as { equip?: boolean }).equip) { if (/^equip\s*\{/i.test(line) && symbols(line) === symbols(ability.cost.mana ?? "")) return line; continue; }
    const at = line.indexOf(":");
    if (at <= 0 || line.slice(0, at).includes(".")) continue; // a colon after a full stop is prose, not a cost
    if (costMatches(line.slice(0, at), ability.cost)) found.push(line);
  }
  if (found.length <= 1) return found[0] ?? null;
  // two lines with this cost: the one whose effect reads like this ability's first effect
  const word = ability.effects[0] ? EFFECT_WORD[ability.effects[0].type] : undefined;
  return (word ? found.find((l) => word.test(l.slice(l.indexOf(":")))) : undefined) ?? found[0]!;
}

export interface AbilityLabelSource {
  ability: ActivatedAbilityDef;
  /** The rules texts of the card the ability is on (its def's text, a real card's oracle text) — first found wins. */
  texts: readonly (string | undefined)[];
  /** For an ability another permanent grants: that permanent's name and rules texts. */
  grantedBy?: { name: string; texts: readonly (string | undefined)[] };
}

/** One ability's label. */
export function abilityLabel(src: AbilityLabelSource): string {
  const mana = src.ability.effects.length === 1 && src.ability.effects[0]!.type === "addMana" ? (src.ability.effects[0] as { mana?: string }).mana : undefined;
  let line: string | null = null;
  if (src.grantedBy) for (const t of src.grantedBy.texts) { line = printedLine(src.ability, t, true); if (line) break; }
  else for (const t of src.texts) { line = printedLine(src.ability, t); if (line) break; }
  // a mana ability that makes one fixed colour, printed on a line offering several ("Add {R} or {W}."): say which
  if (line && mana && / or /.test(line.slice(line.indexOf(":")))) line = null;
  const label = line ?? writtenLabel(src.ability);
  return src.grantedBy ? `${label} (from ${src.grantedBy.name})` : label;
}

/** The labels of a menu's abilities, in order; any two that still read the same are numbered. */
export function abilityLabels(sources: readonly AbilityLabelSource[]): string[] {
  const labels = sources.map(abilityLabel);
  const seen = new Map<string, number>();
  for (const l of labels) seen.set(l, (seen.get(l) ?? 0) + 1);
  const nth = new Map<string, number>();
  return labels.map((l) => { if ((seen.get(l) ?? 0) < 2) return l; const n = (nth.get(l) ?? 0) + 1; nth.set(l, n); return `${l} (${n})`; });
}
