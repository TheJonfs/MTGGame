/**
 * S55 (ADR-161) — THE COMBO ARCHETYPE'S RULES, in one place: piloting a deck that carries a plan, and playing against
 * one. Moved out of heuristic-agent.ts after S55 (Chris: the combo logic stays separable from the broader AI) with no
 * change in behaviour; the agent calls in at a handful of named points and keeps thin methods of the same names.
 *
 * What keeps this from becoming bespoke to one deck:
 *  - Every rule here runs only for a deck with a plan (`profile.plan`) or against one (`profile.opponentPlan`); for
 *    every other deck it is inert. (Graveyard exile's own discipline is the one rule that also runs with no plan.)
 *  - The CONDITIONS come from the plan's data (agents/plans.ts — authored with the list) and from card data; no card
 *    is named in this file. A rule a deck needs and another does not is a FIELD on the plan (e.g. `setup.holdAgainst`),
 *    so the next combo list gets the machinery by filling in its plan.
 *  - Longer and more intricate logic is welcome here: it costs nothing to a deck without a plan.
 */
import { parseManaCost, type CardDef, type Effect, type ResolvedTarget } from "@shandalar/cards";
import type { Action, ActionRequest, GameView } from "@shandalar/engine";
import { viewAbilityAt } from "./granted-view.js";
import { LOOP_WORTH, reanimationWorth, type AiProfile } from "./evaluator.js";

/** What the plan rules need of the agent they serve. */
export interface PlanHost {
  profile: AiProfile;
  defs: Map<string, CardDef>;
  def(cardId: string): CardDef | undefined;
  mv(cardId: string): number;
  /** The actions on offer at the priority decision being scored (null outside one: the book's direct calls). */
  offered(): Action[] | null;
  actionEffects(view: GameView, action: Action): Effect[] | null;
}

export class PlanPlay {
  constructor(private readonly h: PlanHost) {}

  /** Where the plan stands, from this seat. `ready`: a start would loop now — the piece cast with another in a
   * graveyard or on our battlefield, or the piece returned with a second in our graveyard or one on our battlefield
   * (the legend rule supplies the death either way: books 99, 100). */
  planFacts(view: GameView): { yardMine: number; yardTheirs: number; onField: boolean; pieceInHand: boolean; reanimInHand: boolean; startOnField: boolean; setupInHand: boolean; setUp: boolean; byCast: boolean; byReanim: boolean; assembled: boolean } {
    const p = this.h.profile.plan!, me = view.you, opp = (1 - me) as 0 | 1;
    const inHand = (id: string) => view.hand.some((c) => c.cardId === id);
    const yardMine = view.graveyards[me].filter((c) => c === p.piece).length, yardTheirs = view.graveyards[opp].filter((c) => c === p.piece).length;
    const onField = view.battlefield.some((o) => o.controller === me && o.cardId === p.piece);
    const pieceInHand = inHand(p.piece);
    const reanimInHand = p.start.some((x) => x.card !== p.piece && inHand(x.card));
    const startOnField = p.start.some((x) => x.card !== p.piece && view.battlefield.some((o) => o.controller === me && o.cardId === x.card));
    const setupInHand = p.setup.some((x) => inHand(x.card));
    const byCast = pieceInHand && (yardMine + yardTheirs >= 1 || onField);
    const byReanim = (reanimInHand || startOnField) && (yardMine >= 2 || (yardMine >= 1 && onField));
    const setUp = yardMine >= 2 || (yardMine >= 1 && (onField || pieceInHand)) || (yardTheirs >= 1 && pieceInHand) || (onField && pieceInHand);
    return { yardMine, yardTheirs, onField, pieceInHand, reanimInHand, startOnField, setupInHand, setUp, byCast, byReanim, assembled: byCast || byReanim };
  }
  /** The engine offers this card's cast now — its cost, colours and timing all met. Outside a decision: by mana count. */
  private castOffered(view: GameView, cardId: string, mana: number): boolean {
    const offered = this.h.offered();
    if (!offered) return this.h.mv(cardId) <= mana;
    return offered.some((a) => a.type === "castSpell" && view.hand.find((c) => c.objectId === a.objectId)?.cardId === cardId);
  }
  /** Book 102: a combo deck DIGS — while its plan is not assembled the life-for-cards draw of a plan `dig` card is
   * taken whatever the hand holds, down to a floor over the opponent's standing power (four, and never under five
   * life), six times a turn at most. Null when the card is not one of the plan's dig cards (the agent's own
   * discipline then applies); true blocks the draw. */
  digGated(view: GameView, action: Action, lifeCost: number, drawsThisTurn: number): boolean | null {
    const p = this.h.profile.plan, me = view.you;
    if (!p || action.type !== "activateAbility" || !p.dig.includes(view.battlefield.find((o) => o.id === action.objectId)?.cardId ?? "")) return null;
    const power = view.battlefield.filter((o) => o.controller !== me && o.power !== null && !o.keywords.includes("defender")).reduce((n, o) => n + Math.max(0, o.power ?? 0), 0);
    if (this.planFacts(view).assembled) return true;
    if (view.life[me] - lifeCost < Math.max(5, power + 4)) return true;
    return drawsThisTurn >= 6;
  }
  /** Could `cardId` be paid for with what we can make now plus `fuel` (colour symbols, e.g. "BBB"; "*" any colour)
   * after spending `spend` mana on the fuel itself — by COLOUR, not only by count (the Usher wants white and red: a
   * Ritual's black does not make them). Each untapped producer gives one mana of a colour it makes; pips are matched
   * scarcest first. */
  private payableWith(view: GameView, cardId: string, fuel: string, spend: number): boolean {
    const me = view.you, d = this.h.def(cardId); if (!d) return false;
    const cost = parseManaCost(d.manaCost);
    const all: string[][] = [];
    const sources = all;
    for (const o of view.battlefield) {
      if (o.controller !== me || o.tapped) continue;
      const od = this.h.def(o.cardId); if (!od) continue;
      if (od.types.includes("Creature") && o.summoningSick) continue;
      const cols = new Set<string>();
      for (const a of od.abilities ?? []) if (a.kind === "activated" && a.cost.tap && !a.cost.sacrifice) for (const e of a.effects) if (e.type === "addMana") { if (e.choice) "WUBRG".split("").forEach((c) => cols.add(c)); else for (const m of (e.mana ?? "").matchAll(/\{([WUBRGC])\}/g)) cols.add(m[1]!); }
      if (cols.size) sources.push([...cols]);
    }
    for (const [c, n] of Object.entries(view.manaPool)) for (let i = 0; i < n; i++) sources.push([c]);
    const pays = (left: string[][]): boolean => {
      const src = [...left, ...[...fuel].map((ch) => (ch === "*" ? "WUBRG".split("") : [ch]))];
      const pips = (Object.entries(cost.colored) as [string, number][]).flatMap(([c, n]) => Array<string>(n).fill(c));
      pips.sort((a, b) => src.filter((x) => x.includes(a)).length - src.filter((x) => x.includes(b)).length);
      for (const c of pips) {
        const cands = src.map((x, i) => ({ x, i })).filter(({ x }) => x.includes(c)).sort((a, b) => a.x.length - b.x.length);
        if (!cands.length) return false;
        src.splice(cands[0]!.i, 1);
      }
      return src.length >= cost.generic;
    };
    // the fuel's own cost: any one source may pay it — the one whose loss still leaves the card payable (a Ritual
    // paid from the Blood Crypt, not from the only white source)
    if (spend === 0) return pays(all);
    if (spend > 1) { const rest = [...all].sort((a, b) => a.length - b.length).slice(spend); return all.length >= spend && pays(rest); }
    return all.some((_, i) => pays(all.filter((__, j) => j !== i)));
  }
  /** Mana we could make now: each untapped mana producer as one, and what floats. */
  private manaNow(view: GameView): number {
    const me = view.you;
    return view.battlefield.filter((o) => o.controller === me && !o.tapped && (this.h.def(o.cardId)?.abilities ?? []).some((a) => a.kind === "activated" && a.cost.tap && !a.cost.sacrifice && a.effects.some((e) => e.type === "addMana"))).filter((o) => !o.summoningSick || !this.h.def(o.cardId)?.types.includes("Creature")).length
      + Object.values(view.manaPool).reduce((a, b) => a + b, 0);
  }
  /** Book 100: the plan's start is in hand or on the battlefield — or within two draws by the deck's own count (the
   * starts and the dig cards still in the library, of the library's size: one in four or better). A deck whose list
   * the caller did not give is taken to have it within reach. Exposed for the book. */
  planStartReachable(view: GameView): boolean {
    const p = this.h.profile.plan!, me = view.you;
    if (p.start.some((x) => view.hand.some((c) => c.cardId === x.card) || (x.card !== p.piece && view.battlefield.some((o) => o.controller === me && o.cardId === x.card)))) return true;
    if (p.dig.some((id) => view.battlefield.some((o) => o.controller === me && o.cardId === id) || view.hand.some((c) => c.cardId === id))) return true;
    const deck = this.h.profile.decklist;
    if (!deck) return true;
    const seen = (id: string) => view.hand.filter((c) => c.cardId === id).length + view.battlefield.filter((o) => o.controller === me && o.cardId === id).length + view.graveyards[me].filter((c) => c === id).length;
    const reach = [...new Set([...p.start.map((x) => x.card), ...p.dig])];
    const left = reach.reduce((n, id) => n + Math.max(0, deck.reduce((k, e) => k + (e.cardId === id ? e.count : 0), 0) - seen(id)), 0);
    const lib = Math.max(2, view.librarySizes[me]);
    const miss = ((lib - left) / lib) * ((lib - 1 - left) / (lib - 1));
    return 1 - Math.max(0, miss) >= 0.25;
  }
  /** What the plan wants cast next, by cost: the setup while it is not set up, the start once a start would loop, the
   * dig cards until then. */
  planWants(view: GameView): { cardId: string; mv: number }[] {
    const p = this.h.profile.plan!, f = this.planFacts(view), out: { cardId: string; mv: number }[] = [];
    const hand = (id: string) => view.hand.some((c) => c.cardId === id);
    if (!f.setUp || f.yardMine < 2) for (const x of p.setup) if (hand(x.card) && f.yardMine < 3 && this.planStartReachable(view)) out.push({ cardId: x.card, mv: this.h.mv(x.card) });
    if (f.byCast) out.push({ cardId: p.piece, mv: this.h.mv(p.piece) });
    if (f.byReanim) for (const x of p.start) if (x.card !== p.piece && hand(x.card)) out.push({ cardId: x.card, mv: this.h.mv(x.card) });
    if (!f.assembled) for (const id of p.dig) if (hand(id) && !(this.h.def(id)?.supertypes?.includes("Legendary") && view.battlefield.some((o) => o.controller === view.you && o.cardId === id))) out.push({ cardId: id, mv: this.h.mv(id) });
    return out;
  }
  /**
   * Books 100–103: a combo list plays its plan first.
   *  - 101 (the start's target): a reanimation that is the plan's start is aimed at the plan's piece — never spent on a
   *    fair body while the plan is live (a piece in our graveyard, or the setup in hand); a fair return is left for a
   *    deck out of pieces, or at ten life or less with neither.
   *  - 103 (fuel): a Ritual or the Lotus is spent only when it makes a wanted plan card castable that was not — never
   *    into a Nighthawk, and never when the card was castable without it.
   *  - 102 (plan before fair plays): a card outside the plan is not cast while a wanted plan card could be cast instead.
   *  - 100: a second setup is not cast into a graveyard that already holds three of the piece.
   * Exposed for the book.
   */
  planGated(view: GameView, action: Action): boolean {
    const p = this.h.profile.plan;
    if (!p || (action.type !== "castSpell" && action.type !== "activateAbility")) return false;
    const me = view.you, f = this.planFacts(view);
    const src = action.type === "castSpell" ? view.hand.find((c) => c.objectId === action.objectId)?.cardId : view.battlefield.find((o) => o.id === action.objectId)?.cardId;
    if (!src) return false;
    const d = this.h.def(src); if (!d) return false;
    const wants = this.planWants(view), now = this.manaNow(view);
    const tId = ((action as { targets?: ResolvedTarget[] }).targets ?? []).find((t) => t.kind === "object") as { id: string } | undefined;
    // 101: the start's target
    const startRole = p.start.find((x) => x.card === src && x.card !== p.piece);
    if (startRole && tId) {
      const g = [...view.graveyardObjects[0], ...view.graveyardObjects[1]].find((o) => o.objectId === tId.id);
      if (g && g.cardId !== startRole.on) { const live = f.yardMine >= 1 || f.setupInHand; if (live || view.life[me] > 10) return true; }
    }
    // 100: enough is buried
    if (action.type === "castSpell" && p.setup.some((x) => x.card === src) && f.yardMine >= 3) return true;
    // 103: fuel
    const isFuelSpell = action.type === "castSpell" && p.fuel.includes(src) && (d.spellEffect ?? []).some((e) => e.type === "addMana");
    const isFuelSac = action.type === "activateAbility" && p.fuel.includes(src) && (() => { const ab = viewAbilityAt(view, this.h.defs, action.objectId, action.abilityIndex); return !!ab && ab.kind === "activated" && !!ab.cost.sacrifice && ab.effects.some((e) => e.type === "addMana"); })();
    if (isFuelSpell || isFuelSac) {
      // the plan's cards are cast at sorcery speed: fuel on the opponent's turn, or with something on the stack, floats away
      if (view.activePlayer !== me || (view.step !== "MAIN1" && view.step !== "MAIN2") || view.stack.length > 0) return true;
      // spent only when it makes a wanted plan card castable that is not castable now — by colour as well as count
      const [yieldMana, spend] = isFuelSpell ? ["BBB", this.h.mv(src)] : ["***", 0];
      return !wants.some((w) => !this.castOffered(view, w.cardId, now) && this.payableWith(view, w.cardId, yieldMana, spend));
    }
    // 102: plan before fair plays — a nonland card outside the plan waits while a wanted plan card is castable
    if (action.type === "castSpell" && !d.types.includes("Land")) {
      const inPlan = src === p.piece || p.setup.some((x) => x.card === src) || p.start.some((x) => x.card === src) || p.dig.includes(src) || p.fuel.includes(src);
      if (!inPlan && view.activePlayer === me && wants.some((w) => w.cardId !== src && this.castOffered(view, w.cardId, now))) return true;
    }
    return false;
  }
  /** Books 100, 102: the plan's own plays are worth more than their board — the setup (a card that only fills a
   * graveyard) and the dig while the plan is not assembled. */
  planBonus(view: GameView, action: Action): number {
    const p = this.h.profile.plan;
    if (!p || action.type !== "castSpell") return 0;
    const src = view.hand.find((c) => c.objectId === action.objectId)?.cardId; if (!src) return 0;
    const f = this.planFacts(view);
    if (p.setup.some((x) => x.card === src)) return f.yardMine < 2 ? 8 : 0;
    if (p.dig.includes(src) && !f.assembled) return 4; // (the piece cast into its loop: loopCastBonus, for any deck)
    return 0;
  }
  /** Books 100–101: the setup buries the plan's cards up to their counts; a tutor fetches the missing half — the setup
   * while nothing is set up, else a start, else the piece, else fuel when the plan is in hand and mana is short. */
  planSearchPick(view: GameView, request: ActionRequest, picks: Extract<Action, { type: "searchPick" }>[], cardOf: Map<string, string>, toGraveyard: boolean): Action | null {
    const p = this.h.profile.plan; if (!p) return null;
    const me = view.you, f = this.planFacts(view);
    const find = (id: string) => picks.find((a) => cardOf.get(a.objectId) === id);
    if (toGraveyard) {
      const setup = p.setup.find((x) => x.card === request.source?.cardId) ?? p.setup[0];
      for (const b of setup?.bury ?? []) if (view.graveyards[me].filter((c) => c === b.card).length < b.count) { const a = find(b.card); if (a) return a; }
      return null;
    }
    if (!(request.source?.effects ?? []).some((e) => e.type === "searchLibrary" && e.to === "hand")) return null;
    const order: string[] = [];
    if (!f.setUp && !f.setupInHand) order.push(...p.setup.map((x) => x.card));
    if (!f.reanimInHand && !f.pieceInHand) order.push(...p.start.filter((x) => x.card !== p.piece && !this.h.def(x.card)?.types.includes("Land")).map((x) => x.card), p.piece);
    order.push(...p.setup.map((x) => x.card), ...p.fuel.filter((id) => (this.h.def(id)?.spellEffect ?? []).some((e) => e.type === "addMana") || this.h.mv(id) === 0));
    for (const id of order) { const a = find(id); if (a) return a; }
    return null;
  }

  /** The cards that return a creature card from a graveyard, or put the opponent's dead to work, are what graveyard
   * exile answers; this is the opposing stack's item aimed at a graveyard card, if any. */
  private graveyardAimed(view: GameView): { item: GameView["stack"][number]; targetId: string } | null {
    const opp = (1 - view.you) as 0 | 1;
    for (let i = view.stack.length - 1; i >= 0; i--) {
      const it = view.stack[i]!;
      if (it.controller !== opp) continue;
      for (const t of it.targets ?? []) if (t.kind === "object" && [...view.graveyardObjects[0], ...view.graveyardObjects[1]].some((g) => g.objectId === t.id)) return { item: it, targetId: t.id };
    }
    return null;
  }
  private isGraveyardExile(view: GameView, action: Action): { whole: boolean } | null {
    if (action.type !== "activateAbility") return null;
    const ab = viewAbilityAt(view, this.h.defs, action.objectId, action.abilityIndex);
    if (!ab || ab.kind !== "activated") return null;
    if (ab.effects.some((e) => e.type === "exileGraveyard")) return { whole: true };
    if (ab.effects.some((e) => e.type === "exile") && (ab.targets ?? []).some((t) => t.zone === "graveyard")) return { whole: false };
    return null;
  }
  /**
   * Book 105: graveyard exile is a card spent once, so it is held for the moment it answers something.
   *  - A whole-graveyard exile (Tormod's Crypt) is aimed at the OPPONENT, and used when an opposing spell, ability or
   *    trigger on the stack is aimed at a card in that graveyard, or — against a deck with a plan — as soon as that
   *    graveyard holds the plan's piece (the setup has resolved; the start may come any turn, uncounterably).
   *  - A targeted exile (Faerie Macabre) is used ONLY in response to an opposing stack item aimed at a graveyard card,
   *    and must exile that card (its second target is the best other answer: another of the plan's pieces first).
   * Faerie Macabre is not cast as a 2/2 while the opponent's plan stands (it is held for the trigger).
   * Exposed for the book.
   */
  graveyardHateGated(view: GameView, action: Action): boolean {
    const me = view.you, opp = (1 - me) as 0 | 1, op = this.h.profile.opponentPlan;
    if (action.type === "castSpell") {
      const d = this.h.def(view.hand.find((c) => c.objectId === action.objectId)?.cardId ?? "");
      const holds = !!d && (d.abilities ?? []).some((a) => a.kind === "activated" && a.zone === "hand" && a.effects.some((e) => e.type === "exile") && (a.targets ?? []).some((t) => t.zone === "graveyard"));
      return holds && !!op && op.answers.graveyardExile;
    }
    const kind = this.isGraveyardExile(view, action); if (!kind) return false;
    const targets = (action as { targets?: ResolvedTarget[] }).targets ?? [];
    const aimed = this.graveyardAimed(view);
    if (kind.whole) {
      if (!targets.some((t) => t.kind === "player" && t.player === opp)) return true;
      if (aimed && view.graveyardObjects[opp].some((g) => g.objectId === aimed.targetId)) return false;
      return !(op && view.graveyards[opp].includes(op.piece));
    }
    if (!aimed) return true;
    if (!targets.some((t) => t.kind === "object" && t.id === aimed.targetId)) return true;
    // the second target: the best other card to deny — the plan's piece first, else the dearest creature card of theirs
    const others = [...view.graveyardObjects[opp]].filter((g) => g.objectId !== aimed.targetId);
    const worth = (g: { cardId: string }) => (op && g.cardId === op.piece ? 100 : 0) + reanimationWorth(this.h.def(g.cardId));
    const best = others.sort((a, b) => worth(b) - worth(a) || a.objectId.localeCompare(b.objectId))[0];
    const second = targets.find((t) => t.kind === "object" && t.id !== aimed.targetId) as { id: string } | undefined;
    if (best && worth(best) > 0) return second?.id !== best.objectId;
    return !!second;
  }
  /**
   * Books 104–106: playing against a plan, read from the opponent's list like the list itself.
   *  - 104 (the counter): a counterspell aimed at the plan's setup or start is worth the game; at anything else, a
   *    little less than usual while the plan stands (the counter is being held).
   *  - 105: graveyard exile that passes its gate is worth what it stops.
   *  - 106 (discard): against a plan, discard is worth most before the turn the plan names.
   */
  againstPlanBonus(view: GameView, action: Action): number {
    const me = view.you, opp = (1 - me) as 0 | 1, op = this.h.profile.opponentPlan;
    if (this.isGraveyardExile(view, action)) return this.graveyardAimed(view) ? LOOP_WORTH : op ? 6 : 2;
    if (!op || action.type !== "castSpell") return 0;
    const effects = this.h.actionEffects(view, action) ?? [];
    if (effects.some((e) => e.type === "counter")) {
      const t = ((action as { targets?: ResolvedTarget[] }).targets ?? []).find((x) => x.kind === "stackItem") as { id: string } | undefined;
      const it = t ? view.stack.find((x) => x.id === t.id) : undefined;
      if (!it || it.controller !== opp) return 0;
      return op.answers.counter.includes(it.cardId) ? 30 : -2;
    }
    if (effects.some((e) => e.type === "discard") && ((action as { targets?: ResolvedTarget[] }).targets ?? []).some((t) => t.kind === "player" && t.player === opp)) {
      const theirTurns = Math.ceil(view.turn / 2);
      return theirTurns < op.answers.discardBeforeTurn ? 3 : 0;
    }
    return 0;
  }
}
