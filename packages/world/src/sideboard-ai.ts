/**
 * S49 (Part 2; the S47 plan's shape-keyed rules): the AI's sideboarding between games — from the seat's unused
 * playables, keyed on the SHAPE of the opponent's registered list, never a card:
 *  1. against three or more noncreature artifacts and enchantments (auras, equipment — what such removal hits):
 *     artifact/enchantment removal comes in;
 *  2. against fifteen or more creatures: creature removal comes in;
 *  3. against fifteen or more creatures: counterspells go out for the best playables left.
 * Each swap is one nonland card for one, inside the deck's colours, so the lands and the count stand. The card that
 * leaves is the lowest-rated one that is not itself an answer of the kind coming in. At most two cards per rule.
 * Deterministic (ties by card id). Stateless: it is computed from the REGISTERED deck each game, so it follows the
 * opponent's current list (a human who sideboards) and never drifts.
 */
import { cardColors, type CardDef } from "@shandalar/cards";
import type { Decklist } from "./state.js";
import { isBasic } from "./legality.js";
import { cardRating, type CardRatingTable } from "./rating.js";

export const AI_SIDEBOARD = { relicsSeen: 3, creaturesSeen: 15, perRule: 2 } as const;
type Spec = { predicate?: string; anyOf?: { predicate?: string }[] };
/** What a spell may target: a slot's `anyOf` kinds when it has them (Disenchant: artifact or enchantment), else its predicate. */
const predicates = (d: CardDef): string[] => ((d.targets ?? []) as Spec[]).flatMap((t) => (t.anyOf?.length ? t.anyOf.map((x) => x.predicate ?? "") : [t.predicate ?? ""]));
const removes = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile" || e.type === "damage");
/** Removal that can hit an artifact or an enchantment (Disenchant's shape; a destroy-any-permanent counts). */
export const answersRelics = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile") && predicates(d).some((p) => /^(artifact|enchantment|permanent|nonlandPermanent|artifactOrEnchantment)$/.test(p));
/** Removal that can hit a creature (destroy, exile or damage at a creature or at any target). */
export const answersCreatures = (d: CardDef) => removes(d) && predicates(d).some((p) => /creature$/i.test(p) || p === "anyTarget" || p === "permanent");
export const isCounter = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "counter");

export interface AiSideboarding { deck: Decklist; sideboard: Decklist; swaps: { out: string; in: string; rule: "relics" | "creatures" | "counters" }[] }

export function aiSideboard(deck: Decklist, sideboard: Decklist, opponentDeck: Decklist, cards: Map<string, CardDef>, rating: CardRatingTable): AiSideboarding {
  const def = (id: string) => cards.get(id)!;
  const rate = (id: string) => cardRating(def(id), rating);
  const expand = (l: Decklist) => l.flatMap((e) => Array.from({ length: e.count }, () => e.cardId));
  const main = expand(deck), side = expand(sideboard).filter((id) => !isBasic(id));
  const colors = new Set(main.filter((id) => !def(id).types.includes("Land")).flatMap((id) => cardColors(def(id))));
  const castable = (id: string) => !def(id).types.includes("Land") && cardColors(def(id)).every((c) => colors.has(c));
  const opp = expand(opponentDeck).map(def);
  const oppCreatures = opp.filter((d) => d.types.includes("Creature")).length;
  const oppRelics = opp.filter((d) => !d.types.includes("Creature") && !d.types.includes("Land") && (d.types.includes("Artifact") || d.types.includes("Enchantment"))).length;
  const swaps: AiSideboarding["swaps"] = [];
  const swap = (rule: "relics" | "creatures" | "counters", wantIn: (d: CardDef) => boolean, mayLeave: (d: CardDef) => boolean, onlyIfBetter = false) => {
    for (let n = 0; n < AI_SIDEBOARD.perRule; n++) {
      const inId = side.filter((id) => castable(id) && wantIn(def(id))).sort((a, b) => rate(b) - rate(a) || a.localeCompare(b))[0];
      const outId = main.filter((id) => !def(id).types.includes("Land") && mayLeave(def(id))).sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
      if (!inId || !outId || (onlyIfBetter && rate(inId) <= rate(outId))) return;
      main.splice(main.indexOf(outId), 1, inId); side.splice(side.indexOf(inId), 1, outId);
      swaps.push({ out: outId, in: inId, rule });
    }
  };
  if (oppRelics >= AI_SIDEBOARD.relicsSeen) swap("relics", (d) => answersRelics(d) && !d.types.includes("Creature"), (d) => !answersRelics(d));
  if (oppCreatures >= AI_SIDEBOARD.creaturesSeen) {
    swap("creatures", (d) => answersCreatures(d) && !d.types.includes("Creature"), (d) => !answersCreatures(d) && !answersRelics(d));
    swap("counters", (d) => !isCounter(d), (d) => isCounter(d));
  }
  const pack = (ids: string[]): Decklist => { const out: Decklist = []; for (const id of ids) { const e = out.find((x) => x.cardId === id); if (e) e.count += 1; else out.push({ cardId: id, count: 1 }); } return out; };
  // keep the registered deck's order and its basics; only the swapped cards change
  const basics = sideboard.filter((e) => isBasic(e.cardId));
  return { deck: pack(main), sideboard: [...pack(side), ...basics], swaps };
}
