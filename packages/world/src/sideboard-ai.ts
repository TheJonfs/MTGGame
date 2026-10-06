/**
 * S49 (Part 2; the S47 plan's shape-keyed rules): the AI's sideboarding between games — from the seat's unused
 * playables, keyed on the SHAPE of the opponent's registered list, never a card:
 *  1. against three or more noncreature artifacts and enchantments (auras, equipment — what such removal hits):
 *     artifact/enchantment removal comes in;
 *  2. against fifteen or more creatures: creature removal comes in;
 *  3. against fifteen or more creatures: counterspells go out for the best playables left.
 *  4. (S55, ADR-162) against a list that works from the graveyard — eight or more copies of cards that return a
 *     creature card to the battlefield or search one into a graveyard (Zombify, Unearth, Buried Alive, Entomb, the
 *     Reeve, Cairnbrand, the Usher) — graveyard exile comes in (Tormod's Crypt, Faerie Macabre). These cost no mana
 *     to use, so the deck's colours do not matter; they come in whatever they rate (they are sideboard cards by
 *     nature and no game has rated them).
 *  S56 (Part 2 — "the AI sideboards by three narrow shapes": a hand-built fifteen went mostly unused), four more, after
 *  the first four and in this order, each keyed on the opponent's registered list:
 *  5. SWEEPERS against a wide board — fifteen or more creatures of power two or less, and at least twice our own
 *     count of creatures a sweeper would take — mass damage or destruction comes in (Pyroclasm, Savage Twister, Wrath);
 *  6. CREATURE COUNTERS against a creature deck — twenty or more creatures: a counter that hits only creature spells
 *     comes in for a general one, never the reverse (Essence Scatter for Counterspell); rule 3 leaves them in;
 *  7. A STEAL against prizes — three or more copies of creatures rated 2.5 or better: an Aura that takes control of
 *     a creature comes in (Control Magic);
 *  8. BLOCKERS — against eight or more fliers, creatures with reach or flying built to block (toughness at least
 *     two over power); against an aggressive list (twelve or more creatures of mana value two or less), defenders.
 * Each swap is one nonland card for one, inside the deck's colours, so the lands and the count stand. The card that
 * leaves is the lowest-rated one that is not itself an answer of the kind coming in. At most two cards per rule.
 * Deterministic (ties by card id). Stateless: it is computed from the REGISTERED deck each game, so it follows the
 * opponent's current list (a human who sideboards) and never drifts.
 */
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Decklist } from "./state.js";
import { isBasic } from "./legality.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { PLANS, matchPlan } from "@shandalar/agents";

export const AI_SIDEBOARD = { relicsSeen: 3, creaturesSeen: 15, perRule: 2 } as const;
/** `betterOnly`: an answer comes in only for a card it out-rates. A Limited deck's last cards are filler, and any
 * answer beats them; a tuned sixty's lowest-rated card is often what the deck runs on (measured: without it the
 * Levy, the Sweep, the Wurmspeaker and the Warband each lost about three points by sideboarding). */
export type AiSideboardTerms = { relicsSeen: number; creaturesSeen: number; perRule: number; betterOnly?: boolean; /** S55, rule 4: the opponent's copies of graveyard cards that bring it on, and how many answers come in */ graveyardSeen?: number; graveyardIn?: number; /** S56: rule 3 off, and rules 1–2 never take a counterspell out (measured for Constructed) */ countersStay?: boolean; /** S56, rules 5–8: each present only where the rule runs */ shapes?: SideboardShapes };
/** S56 (rules 5–8): what the opponent's list must show for each shape, and how many cards a shape brings in. */
export interface SideboardShapes { sweepers?: { wide: number; power: number }; creatureCounters?: { creatures: number }; steal?: { prizes: number; rating: number }; blockers?: { fliers: number; cheap: number; cheapMv: number }; perShape: number }
export const SIDEBOARD_SHAPES: SideboardShapes = { sweepers: { wide: 15, power: 2 }, creatureCounters: { creatures: 20 }, steal: { prizes: 3, rating: 2.5 }, blockers: { fliers: 8, cheap: 12, cheapMv: 2 }, perShape: 2 };
/** Post-S54 (Chris: Constructed sideboards): the same three rules over sixty cards and a registered fifteen — a deck
 * that wins with creatures holds sixteen or more, one that leans on artifacts and enchantments four or more, and
 * three cards a rule come in (the fifteen is built to hold them: constructed-builder.buildSideboard). */
// (post-S55, the Kiln's tuning: graveyardSeen was 4, which brought the exile in against the Coin, the Loop and the
// Hearth — four or five Ushers each, but fair decks that do not need their graveyards; there it cost the Kiln two to
// ten points. Eight separates the decks built on the graveyard — the Pall 13, the Larder 16 — from those.)
export const AI_SIDEBOARD_CONSTRUCTED: AiSideboardTerms = { relicsSeen: 4, creaturesSeen: 16, perRule: 3, betterOnly: true, graveyardSeen: 8, graveyardIn: 4, shapes: SIDEBOARD_SHAPES };
type Spec = { predicate?: string; anyOf?: { predicate?: string }[] };
/** What a spell may target: a slot's `anyOf` kinds when it has them (Disenchant: artifact or enchantment), else its predicate. */
const predicates = (d: CardDef): string[] => ((d.targets ?? []) as Spec[]).flatMap((t) => (t.anyOf?.length ? t.anyOf.map((x) => x.predicate ?? "") : [t.predicate ?? ""]));
const removes = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile" || e.type === "damage");
/** Removal that can hit an artifact or an enchantment (Disenchant's shape; a destroy-any-permanent counts). */
export const answersRelics = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "destroy" || e.type === "exile") && predicates(d).some((p) => /^(artifact|enchantment|permanent|nonlandPermanent|artifactOrEnchantment)$/.test(p));
/** Removal that can hit a creature (destroy, exile or damage at a creature or at any target). */
export const answersCreatures = (d: CardDef) => removes(d) && predicates(d).some((p) => /creature$/i.test(p) || p === "anyTarget" || p === "permanent");
export const isCounter = (d: CardDef) => (d.spellEffect ?? []).some((e) => e.type === "counter");
/** S56 (rule 5): mass damage or destruction of creatures (Pyroclasm, Savage Twister, Wrath of God). */
export const isSweeper = (d: CardDef) => !d.types.includes("Creature") && ((d.spellEffect ?? []) as { type: string; scope?: string }[]).some((e) => (e.type === "damageAll" || e.type === "destroyAll") && e.scope === "allCreatures");
/** S56 (rule 6): a counter that can hit only a creature spell (Essence Scatter). */
export const isCreatureCounter = (d: CardDef) => isCounter(d) && predicates(d).length > 0 && predicates(d).every((p) => p === "creatureSpell");
/** S56 (rule 7): a noncreature permanent that takes control of what it is attached to (Control Magic). */
export const stealsCreatures = (d: CardDef) => !d.types.includes("Creature") && (d.abilities ?? []).some((a) => a.kind === "static" && (a.effects as { type: string; scope?: string }[]).some((e) => e.type === "gainControl" && e.scope === "attached")) && predicates(d).some((p) => p === "creature");
/** S56 (rule 8): a creature built to block in the air — reach, or flying with toughness at least two over power — at four mana or less (a nine-mana Angel is not a sideboard blocker). */
export const blocksFliers = (d: CardDef) => d.types.includes("Creature") && manaValue(parseManaCost(d.manaCost)) <= 4 && ((d.keywords ?? []).includes("reach") || ((d.keywords ?? []).includes("flying") && (d.toughness ?? 0) >= (d.power ?? 0) + 2));
/** S56 (rule 8): a defender (Wall of Air, Wall of Blossoms, Tidewall). */
export const isWall = (d: CardDef) => d.types.includes("Creature") && (d.keywords ?? []).includes("defender");
type AnyEffect = { type: string; to?: string; scope?: string };
const everyEffect = (d: CardDef): AnyEffect[] => [...((d.spellEffect ?? []) as AnyEffect[]), ...(d.abilities ?? []).flatMap((a) => ("effects" in a ? (a.effects as AnyEffect[]) : []))];
/** S55 (rule 4): graveyard exile — a player's whole graveyard, or cards targeted in one (Tormod's Crypt, Faerie Macabre). */
export const answersGraveyards = (d: CardDef) => everyEffect(d).some((e) => e.type === "exileGraveyard") || (d.abilities ?? []).some((a) => a.kind === "activated" && a.effects.some((e) => e.type === "exile") && (a.targets ?? []).some((t) => t.zone === "graveyard"));
/** S55 (rule 4): a card that works from the graveyard — it returns a creature card (not itself) to the battlefield, or searches a card into a graveyard. */
export const usesGraveyard = (d: CardDef) => everyEffect(d).some((e) => (e.type === "returnFromGraveyard" && e.to === "battlefield" && e.scope !== "self") || (e.type === "searchLibrary" && e.to === "graveyard"));
/** An answer usable by any deck: it is used for no mana (a zero-cost artifact; an ability from the hand that costs no mana). */
export const usableByAnyDeck = (d: CardDef) => d.manaCost === "{0}" || (d.abilities ?? []).some((a) => a.kind === "activated" && a.zone === "hand" && !a.cost.mana);

export interface AiSideboarding { deck: Decklist; sideboard: Decklist; swaps: { out: string; in: string; rule: "relics" | "creatures" | "counters" | "graveyards" | "sweepers" | "creatureCounters" | "steal" | "blockers" }[] }

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
    // S56 (the Kiln's hand-tested plan against the Pall: 37% → 60% with four for its Tidewalls; the rule's four for
    // its lowest-rated cards, the Pyromancers, reached 42%): against a PLAN that graveyard exile answers, what leaves
    // first is what only blocks — a wall does not stop a combination. Measured: 35% → 59% (seven in, the three more
    // for the next-lowest cards, measured no better: 55%).
    const vsPlan = !!theirPlan?.answers.graveyardExile && !!terms.shapes;
    for (let n = 0; n < (terms.graveyardIn ?? terms.perRule); n++) {
      const ins = side.filter((id) => answersGraveyards(def(id)) && (usableByAnyDeck(def(id)) || castable(id))).sort((a, b) => a.localeCompare(b));
      const inId = n % 2 === 0 ? ins[0] : ins[ins.length - 1]; // one of each kind in turn (the Crypt on the board, the Macabre in hand)
      const outId = main.filter((id) => !def(id).types.includes("Land") && !planCards.has(id) && !answersGraveyards(def(id)) && !answersCreatures(def(id)) && !answersRelics(def(id)) && !isCounter(def(id))).sort((a, b) => (vsPlan ? Number(isWall(def(b))) - Number(isWall(def(a))) : 0) || rate(a) - rate(b) || b.localeCompare(a))[0];
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
  if (oppRelics >= terms.relicsSeen) swap("relics", (d) => answersRelics(d) && !d.types.includes("Creature"), (d) => !answersRelics(d) && keepCounters(d) && !(terms.countersStay && isCounter(d)), !!terms.betterOnly);
  if (oppCreatures >= terms.creaturesSeen) {
    swap("creatures", (d) => answersCreatures(d) && !d.types.includes("Creature"), (d) => !answersCreatures(d) && !answersRelics(d) && keepCounters(d) && !(terms.shapes && isSweeper(d)) && !(terms.countersStay && isCounter(d)), !!terms.betterOnly);
    // (S56: a creature counter is what a creature deck is answered with — it is not among the counters that leave)
    // (S56: nor is graveyard exile "the best playable left" — the Kiln was bringing a Tormod's Crypt in for a Counterspell against the Coin)
    if (!theirPlan?.answers.counter.length && !terms.countersStay) swap("counters", (d) => !isCounter(d) && !answersGraveyards(d), (d) => isCounter(d) && !(terms.shapes?.creatureCounters && isCreatureCounter(d)));
  }
  // S56 (rules 5–8): the shapes a person sideboards by. Each brings in up to `perShape` cards; what leaves is the
  // lowest-rated card that is no answer of any kind (removal, counters, sweepers, graveyard exile) and no plan card.
  const sh = terms.shapes;
  if (sh) {
    const mvOf = (d: CardDef) => manaValue(parseManaCost(d.manaCost));
    const isAnswer = (d: CardDef) => answersGraveyards(d) || answersCreatures(d) || answersRelics(d) || isCounter(d) || isSweeper(d) || stealsCreatures(d);
    const shape = (rule: "sweepers" | "creatureCounters" | "steal" | "blockers", wantIn: (d: CardDef) => boolean, mayLeave: (d: CardDef) => boolean = (d) => !isAnswer(d)) => {
      for (let n = 0; n < sh.perShape; n++) {
        const inId = side.filter((id) => castable(id) && wantIn(def(id))).sort((a, b) => rate(b) - rate(a) || a.localeCompare(b))[0];
        const outId = main.filter((id) => !def(id).types.includes("Land") && !planCards.has(id) && !manaOnly(def(id)) && mayLeave(def(id)) && !wantIn(def(id))).sort((a, b) => rate(a) - rate(b) || b.localeCompare(a))[0];
        if (!inId || !outId) return;
        main.splice(main.indexOf(outId), 1, inId); side.splice(side.indexOf(inId), 1, outId);
        swaps.push({ out: outId, in: inId, rule });
      }
    };
    const oppCr = opp.filter((d) => d.types.includes("Creature"));
    if (sh.sweepers) {
      const small = (d: CardDef) => d.types.includes("Creature") && (d.power ?? 0) <= sh.sweepers!.power;
      const theirs = oppCr.filter(small).length, ours = main.map(def).filter((d) => small(d) && (d.toughness ?? 0) <= 2).length;
      if (theirs >= sh.sweepers.wide && theirs >= 2 * ours) shape("sweepers", isSweeper);
    }
    // (not against a plan that counterspells answer: its setup and its start are sorceries)
    if (sh.creatureCounters && oppCr.length >= sh.creatureCounters.creatures && !theirPlan?.answers.counter.length) shape("creatureCounters", isCreatureCounter, (d) => isCounter(d) && !isCreatureCounter(d));
    if (sh.steal && oppCr.filter((d) => cardRating(d, rating) >= sh.steal!.rating).length >= sh.steal.prizes) shape("steal", stealsCreatures);
    if (sh.blockers) {
      if (oppCr.filter((d) => (d.keywords ?? []).includes("flying")).length >= sh.blockers.fliers) shape("blockers", blocksFliers);
      else if (oppCr.filter((d) => mvOf(d) <= sh.blockers!.cheapMv).length >= sh.blockers.cheap) shape("blockers", isWall);
    }
  }
  const pack = (ids: string[]): Decklist => { const out: Decklist = []; for (const id of ids) { const e = out.find((x) => x.cardId === id); if (e) e.count += 1; else out.push({ cardId: id, count: 1 }); } return out; };
  // keep the registered deck's order and its basics; only the swapped cards change
  const basics = sideboard.filter((e) => isBasic(e.cardId));
  return { deck: pack(main), sideboard: [...pack(side), ...basics], swaps };
}
