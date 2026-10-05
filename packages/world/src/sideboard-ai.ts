/**
 * S49 (Part 2; the S47 plan's shape-keyed rules): the AI's sideboarding between games — from the seat's unused
 * playables, keyed on the SHAPE of the opponent's registered list, never a card:
 *  1. against three or more noncreature artifacts and enchantments (auras, equipment — what such removal hits):
 *     artifact/enchantment removal comes in;
 *  2. against fifteen or more creatures: creature removal comes in;
 *  3. against fifteen or more creatures: counterspells go out for the best playables left.
 *  4. (S55, ADR-162) against a list that works from the graveyard — four or more copies of cards that return a
 *     creature card to the battlefield or search one into a graveyard (Zombify, Unearth, Buried Alive, Entomb, the
 *     Reeve, Cairnbrand, the Usher) — graveyard exile comes in (Tormod's Crypt, Faerie Macabre). These cost no mana
 *     to use, so the deck's colours do not matter; they come in whatever they rate (they are sideboard cards by
 *     nature and no game has rated them).
 * Each swap is one nonland card for one, inside the deck's colours, so the lands and the count stand. The card that
 * leaves is the lowest-rated one that is not itself an answer of the kind coming in. At most two cards per rule.
 * Deterministic (ties by card id). Stateless: it is computed from the REGISTERED deck each game, so it follows the
 * opponent's current list (a human who sideboards) and never drifts.
 */
import { cardColors, type CardDef } from "@shandalar/cards";
import type { Decklist } from "./state.js";
import { isBasic } from "./legality.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { PLANS, matchPlan } from "@shandalar/agents";

export const AI_SIDEBOARD = { relicsSeen: 3, creaturesSeen: 15, perRule: 2 } as const;
/** Post-S54 (Chris: Constructed sideboards): the same three rules over sixty cards and a registered fifteen — a deck
 * that wins with creatures holds sixteen or more, one that leans on artifacts and enchantments four or more, and
 * three cards a rule come in (the fifteen is built to hold them: constructed-builder.buildSideboard). */
export const AI_SIDEBOARD_CONSTRUCTED = { relicsSeen: 4, creaturesSeen: 16, perRule: 3, betterOnly: true, graveyardSeen: 4, graveyardIn: 4 } as const;
/** `betterOnly`: an answer comes in only for a card it out-rates. A Limited deck's last cards are filler, and any
 * answer beats them; a tuned sixty's lowest-rated card is often what the deck runs on (measured: without it the
 * Levy, the Sweep, the Wurmspeaker and the Warband each lost about three points by sideboarding). */
export type AiSideboardTerms = { relicsSeen: number; creaturesSeen: number; perRule: number; betterOnly?: boolean; /** S55, rule 4: the opponent's copies of graveyard cards that bring it on, and how many answers come in */ graveyardSeen?: number; graveyardIn?: number };
type Spec = { predicate?: string; anyOf?: { predicate?: string }[] };
/** What a spell may target: a slot's `anyOf` kinds when it has them (Disenchant: artifact or enchantment), else its predicate. */
const predicates = (d: CardDef): string[] => ((d.targets ?? []) as Spec[]).flatMap((t) => (t.anyOf?.length ? t.anyOf.map((x) => x.predicate ?? "") : [t.predicate ?? ""]));
const removes = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile" || e.type === "damage");
/** Removal that can hit an artifact or an enchantment (Disenchant's shape; a destroy-any-permanent counts). */
export const answersRelics = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile") && predicates(d).some((p) => /^(artifact|enchantment|permanent|nonlandPermanent|artifactOrEnchantment)$/.test(p));
/** Removal that can hit a creature (destroy, exile or damage at a creature or at any target). */
export const answersCreatures = (d: CardDef) => removes(d) && predicates(d).some((p) => /creature$/i.test(p) || p === "anyTarget" || p === "permanent");
export const isCounter = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "counter");
type AnyEffect = { type: string; to?: string; scope?: string };
const everyEffect = (d: CardDef): AnyEffect[] => [...((d.spellEffect ?? []) as AnyEffect[]), ...(d.abilities ?? []).flatMap((a) => ("effects" in a ? (a.effects as AnyEffect[]) : []))];
/** S55 (rule 4): graveyard exile — a player's whole graveyard, or cards targeted in one (Tormod's Crypt, Faerie Macabre). */
export const answersGraveyards = (d: CardDef) => everyEffect(d).some((e) => e.type === "exileGraveyard") || (d.abilities ?? []).some((a) => a.kind === "activated" && a.effects.some((e) => e.type === "exile") && (a.targets ?? []).some((t) => t.zone === "graveyard"));
/** S55 (rule 4): a card that works from the graveyard — it returns a creature card (not itself) to the battlefield, or searches a card into a graveyard. */
export const usesGraveyard = (d: CardDef) => everyEffect(d).some((e) => (e.type === "returnFromGraveyard" && e.to === "battlefield" && e.scope !== "self") || (e.type === "searchLibrary" && e.to === "graveyard"));
/** An answer usable by any deck: it is used for no mana (a zero-cost artifact; an ability from the hand that costs no mana). */
export const usableByAnyDeck = (d: CardDef) => d.manaCost === "{0}" || (d.abilities ?? []).some((a) => a.kind === "activated" && a.zone === "hand" && !a.cost.mana);

export interface AiSideboarding { deck: Decklist; sideboard: Decklist; swaps: { out: string; in: string; rule: "relics" | "creatures" | "counters" | "graveyards" }[] }

export function aiSideboard(deck: Decklist, sideboard: Decklist, opponentDeck: Decklist, cards: Map<string, CardDef>, rating: CardRatingTable, terms: AiSideboardTerms = AI_SIDEBOARD): AiSideboarding {
  const def = (id: string) => cards.get(id)!;
  const rate = (id: string) => cardRating(def(id), rating);
  const expand = (l: Decklist) => l.flatMap((e) => Array.from({ length: e.count }, () => e.cardId));
  const main = expand(deck), side = expand(sideboard).filter((id) => !isBasic(id));
  const colors = new Set(main.filter((id) => !def(id).types.includes("Land")).flatMap((id) => cardColors(def(id))));
  const castable = (id: string) => !def(id).types.includes("Land") && cardColors(def(id)).every((c) => colors.has(c));
  const opp = expand(opponentDeck).map(def);
  const oppCreatures = opp.filter((d) => d.types.includes("Creature")).length;
  // post-S54: a permanent whose every ability only makes mana (a Mox, the Lotus) is not what such removal is brought
  // in for — the Open's lists nearly all hold four or five, and the rule fired against everything
  const manaOnly = (d: CardDef) => (d.abilities ?? []).length > 0 && (d.abilities ?? []).every((a) => a.kind === "activated" && a.effects.every((e) => e.type === "addMana"));
  const oppRelics = opp.filter((d) => !d.types.includes("Creature") && !d.types.includes("Land") && (d.types.includes("Artifact") || d.types.includes("Enchantment")) && !manaOnly(d)).length;
  const oppGraveyard = opp.filter(usesGraveyard).length;
  // Post-S55 (Chris's matchup study: the Pall's own sideboarding cut two Buried Alives for two Tendrils, and the Locks
  // took their Counterspells out against it): the rules read PLANS. A deck never sideboards out a card of its own plan
  // (its lowest-RATED cards are the plan's — a card that only fills a graveyard rates badly); and against a plan whose
  // answers name counterspells, the counters stay in.
  const myPlan = matchPlan(deck, PLANS), theirPlan = matchPlan(opponentDeck, PLANS);
  const planCards = new Set(myPlan ? [myPlan.piece, ...myPlan.setup.map((x) => x.card), ...myPlan.start.map((x) => x.card), ...myPlan.dig, ...myPlan.fuel] : []);
  const swaps: AiSideboarding["swaps"] = [];
  // S55 (rule 4), first: its answers come in whatever the deck's colours, for the lowest-rated cards that answer nothing
  if (terms.graveyardSeen !== undefined && oppGraveyard >= terms.graveyardSeen) {
    for (let n = 0; n < (terms.graveyardIn ?? terms.perRule); n++) {
      const ins = side.filter((id) => answersGraveyards(def(id)) && (usableByAnyDeck(def(id)) || castable(id))).sort((a, b) => a.localeCompare(b));
      const inId = n % 2 === 0 ? ins[0] : ins[ins.length - 1]; // one of each kind in turn (the Crypt on the board, the Macabre in hand)
      const outId = main.filter((id) => !def(id).types.includes("Land") && !planCards.has(id) && !answersGraveyards(def(id)) && !answersCreatures(def(id)) && !answersRelics(def(id)) && !isCounter(def(id))).sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
      if (!inId || !outId) break;
      main.splice(main.indexOf(outId), 1, inId); side.splice(side.indexOf(inId), 1, outId);
      swaps.push({ out: outId, in: inId, rule: "graveyards" });
    }
  }
  const swap = (rule: "relics" | "creatures" | "counters", wantIn: (d: CardDef) => boolean, mayLeave: (d: CardDef) => boolean, onlyIfBetter = false) => {
    for (let n = 0; n < terms.perRule; n++) {
      const inId = side.filter((id) => castable(id) && wantIn(def(id))).sort((a, b) => rate(b) - rate(a) || a.localeCompare(b))[0];
      // (post-S55: never a graveyard answer rule 4 has just brought in — unrated, they read as the deck's worst cards,
      // and the black lists' creature answers were swapping three of the four straight back out)
      const outId = main.filter((id) => !def(id).types.includes("Land") && !planCards.has(id) && mayLeave(def(id)) && !answersGraveyards(def(id))).sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
      if (!inId || !outId || (onlyIfBetter && rate(inId) <= rate(outId))) return;
      main.splice(main.indexOf(outId), 1, inId); side.splice(side.indexOf(inId), 1, outId);
      swaps.push({ out: outId, in: inId, rule });
    }
  };
  const keepCounters = (d: CardDef) => !(theirPlan?.answers.counter.length && isCounter(d));
  if (oppRelics >= terms.relicsSeen) swap("relics", (d) => answersRelics(d) && !d.types.includes("Creature"), (d) => !answersRelics(d) && keepCounters(d), !!terms.betterOnly);
  if (oppCreatures >= terms.creaturesSeen) {
    swap("creatures", (d) => answersCreatures(d) && !d.types.includes("Creature"), (d) => !answersCreatures(d) && !answersRelics(d) && keepCounters(d), !!terms.betterOnly);
    if (!theirPlan?.answers.counter.length) swap("counters", (d) => !isCounter(d), (d) => isCounter(d));
  }
  const pack = (ids: string[]): Decklist => { const out: Decklist = []; for (const id of ids) { const e = out.find((x) => x.cardId === id); if (e) e.count += 1; else out.push({ cardId: id, count: 1 }); } return out; };
  // keep the registered deck's order and its basics; only the swapped cards change
  const basics = sideboard.filter((e) => isBasic(e.cardId));
  return { deck: pack(main), sideboard: [...pack(side), ...basics], swaps };
}
