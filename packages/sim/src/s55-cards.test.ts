import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const scripted = (f: (v: GameView, r: ActionRequest) => Action | undefined): Agent => ({ chooseAction: async (v, r) => f(v, r) ?? r.actions.find((a) => a.type === "pass") ?? r.actions[0]! });
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId ?? [...v.graveyardObjects[0], ...v.graveyardObjects[1]].find((g) => g.objectId === id)?.cardId) : undefined);
const targets = (a: Action) => (a as { targets?: { kind: string; id?: string; player?: number }[] }).targets ?? [];
const final = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as { players: [{ graveyard: string[]; exile: string[]; hand: string[]; life: number }, { graveyard: string[]; exile: string[]; hand: string[]; life: number }]; objects: Record<string, { cardId: string; zone: string }> };
const names = (st: ReturnType<typeof final>, ids: string[]) => ids.map((id) => st.objects[id]!.cardId).sort();
const RULES = (maxTurns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 }) as MatchSpec["rules"];

/**
 * S55 Part 3 (ADR-162, R-104). Oracle verified against Scryfall 2026-10-05:
 *  - Tormod's Crypt — {0} Artifact. "{T}, Sacrifice this artifact: Exile target player's graveyard."
 *  - Faerie Macabre — {1}{B}{B} Creature — Faerie Rogue 2/2. "Flying. Discard this card: Exile up to two target cards
 *    from graveyards." (The brief did not trust its memory of the cost or the body; these are the printed ones.)
 */
describe("S55 — Tormod's Crypt and Faerie Macabre (R-104)", () => {
  it("the cards as printed", () => {
    const crypt = cards.get("tormods_crypt")!, mac = cards.get("faerie_macabre")!;
    expect([crypt.manaCost, crypt.types, crypt.shopTier]).toEqual(["{0}", ["Artifact"], 2]);
    expect([mac.manaCost, mac.types, mac.subtypes, mac.power, mac.toughness, mac.keywords, mac.shopTier]).toEqual(["{1}{B}{B}", ["Creature"], ["Faerie", "Rogue"], 2, 2, ["flying"], 2]);
  });

  it("Tormod's Crypt: tapped and sacrificed, it exiles every card in the target player's graveyard and none of the other's; it is spent", async () => {
    let used = false;
    const pilot = scripted((v, r) => {
      if (r.purpose !== "priority" || used || v.activePlayer !== 0 || v.step !== "MAIN1") return undefined;
      const a = r.actions.find((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "tormods_crypt" && targets(x)[0]?.player === 1);
      if (a) used = true;
      return a;
    });
    const spec: MatchSpec = { seed: 3, players: [{ name: "a", decklist: D({ swamp: 40 }), agent: "x" }, { name: "b", decklist: D({ grizzly_bears: 30, forest: 10 }), agent: "x" }], rules: RULES(1),
      modifiers: [perm(0, "tormods_crypt"), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 5, who: "opponent" }, { type: "mill", count: 3, who: "you" }] } as Modifier] };
    const r = await runMatch(spec, cards, [pilot, scripted(() => undefined)]);
    const st = final(r);
    expect(used).toBe(true);
    expect(st.players[1].graveyard).toEqual([]);
    expect(st.players[1].exile).toHaveLength(5);
    expect(names(st, st.players[0].graveyard)).toEqual(["swamp", "swamp", "swamp", "tormods_crypt"]); // ours untouched; the Crypt beside them
    expect(st.players[0].exile).toEqual([]);
  });

  it("Tormod's Crypt aimed at its own controller takes the Crypt too (sacrificed as the cost, it is in that graveyard when the ability resolves)", async () => {
    let used = false;
    const pilot = scripted((v, r) => {
      if (r.purpose !== "priority" || used || v.activePlayer !== 0 || v.step !== "MAIN1") return undefined;
      const a = r.actions.find((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "tormods_crypt" && targets(x)[0]?.player === 0);
      if (a) used = true;
      return a;
    });
    const spec: MatchSpec = { seed: 3, players: [{ name: "a", decklist: D({ swamp: 40 }), agent: "x" }, { name: "b", decklist: D({ forest: 40 }), agent: "x" }], rules: RULES(1),
      modifiers: [perm(0, "tormods_crypt"), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 2, who: "you" }] } as Modifier] };
    const st = final(await runMatch(spec, cards, [pilot, scripted(() => undefined)]));
    expect(st.players[0].graveyard).toEqual([]);
    expect(names(st, st.players[0].exile)).toEqual(["swamp", "swamp", "tormods_crypt"]);
  });

  it("Faerie Macabre: from the hand, for no mana, at instant speed — it is discarded and exiles up to two cards, from either graveyard; with nothing to exile it may still be discarded for none", async () => {
    const offers: number[] = [];
    let used = false;
    // on the OPPONENT's turn (instant speed), with no mana of ours untapped
    const pilot = scripted((v, r) => {
      if (r.purpose !== "priority" || used) return undefined;
      const mine = r.actions.filter((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "faerie_macabre");
      if (!mine.length || v.activePlayer !== 1) return undefined;
      offers.push(...mine.map((x) => targets(x).length));
      // one card from each graveyard
      const a = mine.find((x) => targets(x).length === 2 && targets(x).some((t) => v.graveyardObjects[0].some((g) => g.objectId === t.id)) && targets(x).some((t) => v.graveyardObjects[1].some((g) => g.objectId === t.id)));
      if (a) used = true;
      return a;
    });
    const spec: MatchSpec = { seed: 4, players: [{ name: "a", decklist: D({ faerie_macabre: 30, swamp: 10 }), agent: "x" }, { name: "b", decklist: D({ grizzly_bears: 30, forest: 10 }), agent: "x" }], rules: RULES(2),
      modifiers: [{ type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 3, who: "opponent" }, { type: "mill", count: 3, who: "you" }] } as Modifier] };
    const r = await runMatch(spec, cards, [pilot, scripted(() => undefined)]);
    const st = final(r);
    expect(used).toBe(true);
    expect(new Set(offers)).toEqual(new Set([0, 1, 2])); // up to two: none, one or two
    expect(st.players[0].exile).toHaveLength(1);
    expect(st.players[1].exile).toHaveLength(1);
    expect(names(st, st.players[0].graveyard).filter((c) => c === "faerie_macabre").length).toBeGreaterThanOrEqual(1); // the discarded Macabre
  });

  it("Faerie Macabre answers the Usher's loop: in response to the returning trigger it exiles the Usher that trigger targets — the trigger is countered on resolution (CR 608.2b), no second Usher arrives, and nobody is drained", async () => {
    let answered = false;
    const usher = scripted((v, r) => {
      if (r.purpose === "priority") return v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0 && !v.battlefield.some((b) => b.cardId === "the_usher") ? r.actions.find((a) => a.type === "castSpell" && cardOf(v, a.objectId) === "the_usher") : undefined;
      if (r.actions.some((a) => a.type === "chooseTriggerTargets")) return r.actions.find((a) => cardOf(v, targets(a)[0]?.id) === "the_usher");
      return r.actions[0];
    });
    const macabre = scripted((v, r) => {
      if (r.purpose !== "priority" || answered) return undefined;
      const trig = v.stack.find((s) => s.cardId === "the_usher" && s.kind !== "spell" && (s.targets ?? []).some((t) => t.kind === "object"));
      if (!trig) return undefined;
      const want = (trig.targets ?? []).find((t) => t.kind === "object") as { id: string };
      const a = r.actions.find((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "faerie_macabre" && targets(x).length === 1 && targets(x)[0]!.id === want.id);
      if (a) answered = true;
      return a;
    });
    const spec: MatchSpec = { seed: 55, players: [{ name: "a", decklist: D({ the_usher: 30, swamp: 10 }), agent: "x" }, { name: "b", decklist: D({ faerie_macabre: 30, swamp: 10 }), agent: "x" }], rules: RULES(1),
      modifiers: [...["swamp", "swamp", "plains", "mountain", "swamp"].map((l) => perm(0, l)), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 1, who: "you" }] } as Modifier] };
    const r = await runMatch(spec, cards, [usher, macabre]);
    const st = final(r);
    expect(answered).toBe(true);
    expect((r.log as { t: string; name?: string; payload?: { cardId?: string } }[]).some((e) => e.t === "EVENT" && e.name === "FIZZLE" && e.payload?.cardId === "the_usher")).toBe(true);
    expect(r.finalLife).toEqual([20, 20]);
    expect(names(st, st.players[0].exile)).toEqual(["the_usher"]);
    expect(names(st, st.players[1].graveyard)).toEqual(["faerie_macabre"]);
    expect(Object.values(st.objects).filter((o) => o.cardId === "the_usher" && o.zone === "battlefield")).toHaveLength(1);
  });
});
