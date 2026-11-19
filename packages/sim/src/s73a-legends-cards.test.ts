import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type GameView, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined);
type Final = { objects: Record<string, { cardId: string; zone: string; controller: number; owner: number; tapped?: boolean }> };
const onObject = (cardId: string) => (v: GameView, a: Action) => ((a as { targets?: { kind: string; id?: string }[] }).targets ?? []).some((t) => t.kind === "object" && v.battlefield.some((o) => o.id === t.id && o.cardId === cardId));

/** Seat 0 casts `card` once in its first main phase, takes the mode whose label holds `modes[n]` at its n-th trigger,
 * aims at `aim`, and attacks with the legend on every turn listed in `attackOn`. Seat 1 passes and does not block.
 * A request with one legal action is taken without asking (ADR-014), so a trigger with one choosable mode is not in `offered`. */
async function play(card: string, lands: string[], opts: { modes: string[]; aim?: (v: GameView, a: Action) => boolean; attackOn?: number[]; theirs?: string[]; modifiers?: Modifier[]; turns?: number; deck?: Record<string, number>; also?: string }) {
  let cast = false, trig = 0, maxHand = 0; const alsoDeclared = new Set<number>(); let untappedAfterAttack: string[] = []; const offered: string[][] = []; let last: GameView | undefined; const declared = new Set<number>();
  const me: Agent = { chooseAction: async (v: GameView, r: ActionRequest) => {
    last = v; maxHand = Math.max(maxHand, v.hand.length);
    if (opts.attackOn?.includes(v.turn) && declared.has(v.turn) && v.stack.length === 0 && v.step !== "DECLARE_ATTACKERS") untappedAfterAttack = v.battlefield.filter((o) => o.controller === 0 && !o.tapped).map((o) => o.cardId);
    if (r.purpose === "chooseMode") { offered.push(r.actions.flatMap((a) => (a.type === "chooseMode" ? [a.label] : []))); const want = opts.modes[trig++] ?? ""; return r.actions.find((a) => a.type === "chooseMode" && a.label.toLowerCase().includes(want)) ?? r.actions[0]!; }
    if (r.purpose === "searchLibrary") return r.actions.find((x) => x.type === "searchPick") ?? r.actions[0]!; // a search may fail to find: take the card
    if (r.purpose === "chooseTarget") return r.actions.find((a) => opts.aim?.(v, a)) ?? r.actions[0]!;
    if (r.purpose === "declareAttacker") {
      const a = r.actions.find((x) => x.type === "declareAttacker" && cardOf(v, x.objectId) === card);
      if (a && opts.attackOn?.includes(v.turn) && !declared.has(v.turn)) { declared.add(v.turn); return a; }
      const b = opts.also ? r.actions.find((x) => x.type === "declareAttacker" && cardOf(v, x.objectId) === opts.also) : undefined;
      if (b && opts.attackOn?.includes(v.turn) && !alsoDeclared.has(v.turn)) { alsoDeclared.add(v.turn); return b; }
      return r.actions.find((x) => x.type === "doneDeclaringAttackers") ?? r.actions[0]!;
    }
    if (r.purpose === "priority" && !cast && v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === card);
      if (a) { cast = true; return a; }
    }
    return r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
  } };
  const them: Agent = { chooseAction: async (_v: GameView, r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? r.actions[0]! };
  const spec: MatchSpec = { seed: 5, players: [{ name: "a", decklist: D(opts.deck ?? { [card]: 40, [lands[0]!]: 20 }), agent: "x" }, { name: "b", decklist: D({ mountain: 60 }), agent: "x" }],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: opts.turns ?? 1, startingPlayer: 0 } as MatchSpec["rules"],
    modifiers: [...lands.map((l) => perm(0, l)), ...(opts.theirs ?? []).map((c) => perm(1, c)), ...(opts.modifiers ?? [])] };
  const r = await runMatch(spec, cards, [me, them]);
  const final = JSON.parse(r.finalStateSerialized) as Final;
  const zone = (cardId: string, owner: 0 | 1) => Object.values(final.objects).filter((o) => o.cardId === cardId && o.owner === owner).map((o) => o.zone);
  const inZone = (z: string, owner: 0 | 1) => Object.values(final.objects).filter((o) => o.zone === z && o.owner === owner);
  return { cast, offered, last: last!, final, zone, inZone, maxHand, untappedAfterAttack, life: r.finalLife as [number, number] };
}
const BG = ["swamp", "swamp", "swamp", "forest", "forest", "forest"], RG = ["mountain", "mountain", "mountain", "forest", "forest", "forest"];
const milled = (n: number): Modifier => ({ type: "effectAtStart", player: 0, effects: [{ type: "mill", count: n, who: "you" }] });

/**
 * S73a — Hydroilaur and Drakonyx (Chris's cards; the first two of the five High Ground legends, encoded for study —
 * the text is not final). Each is {X}{X}{X/Y}{X/Y}{Y}{Y}, a legendary 5/5 with one keyword and "When this creature
 * enters or attacks, choose one —" (two triggered abilities with the same modes).
 * Rules (as R-106 cites them): 700.2b (a triggered ability's mode is chosen as it is put on the stack), 603.3c (a mode
 * that cannot be given its target cannot be chosen; with none choosable the ability is removed), 701.14a (a fight),
 * 702.2b and 704.5h (deathtouch), 508.1 and 508.3a (an "attacks" trigger goes on the stack in the declare attackers
 * step, before blockers are declared).
 */
describe("S73a — Hydroilaur", () => {
  it("the card as written", () => {
    const p = cards.get("hydroilaur")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.supertypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{B}{B}{B/G}{B/G}{G}{G}", ["Creature"], ["Hydra"], ["Legendary"], 5, 5, ["deathtouch"], "custom"]);
    expect(p.text).toBe("Deathtouch\nWhen this creature enters or attacks, choose one —\n• It fights target creature you don't control.\n• Return target card from your graveyard to your hand.");
  });
  it("enters and fights a 3/3: the 3/3 dies, the Hydra stays", async () => {
    const g = await play("hydroilaur", BG, { modes: ["fights"], aim: onObject("hill_giant"), theirs: ["hill_giant"] });
    expect(g.cast).toBe(true);
    expect(g.zone("hill_giant", 1)).toEqual(["graveyard"]);
    expect(g.zone("hydroilaur", 0).filter((z) => z === "battlefield")).toHaveLength(1);
  });
  it("enters and fights a 6/6: deathtouch kills it and its six kill the Hydra (701.14a)", async () => {
    const g = await play("hydroilaur", BG, { modes: ["fights"], aim: onObject("rampaging_baloths"), theirs: ["rampaging_baloths"] });
    expect(g.zone("rampaging_baloths", 1)).toEqual(["graveyard"]);
    expect(g.zone("hydroilaur", 0).filter((z) => z === "graveyard")).toHaveLength(1);
  });
  it("enters and returns a card from our graveyard — any card, a land among them", async () => {
    const g = await play("hydroilaur", BG, { modes: ["return"], modifiers: [milled(4)], deck: { hydroilaur: 30, swamp: 30 } });
    expect(g.offered).toEqual([]); // no creature across the table: the fight is not offered (603.3c), and the one mode left is taken
    expect(g.inZone("graveyard", 0)).toHaveLength(3);
  });
  it("603.3c: no creature across the table and an empty graveyard — no mode can be chosen, and the game goes on", async () => {
    const g = await play("hydroilaur", BG, { modes: [] });
    expect(g.cast).toBe(true);
    expect(g.offered.flat()).toEqual([]);
    expect(g.zone("hydroilaur", 0).filter((z) => z === "battlefield")).toHaveLength(1);
  });
  it("attacks: the trigger fights before blockers — it kills the second 3/3 and the attack lands (508.1)", async () => {
    const g = await play("hydroilaur", BG, { modes: ["fights", "fights"], aim: onObject("hill_giant"), theirs: ["hill_giant", "hill_giant"], turns: 3, attackOn: [3] });
    expect(g.zone("hill_giant", 1)).toEqual(["graveyard", "graveyard"]);
    expect(g.life[1]).toBe(15);
  });
  it("attacks and returns a second card: one on entering, one on the attack", async () => {
    const g = await play("hydroilaur", BG, { modes: ["return", "return"], modifiers: [milled(2)], deck: { hydroilaur: 30, swamp: 30 }, turns: 3, attackOn: [3] });
    expect(g.maxHand).toBe(9); // seven, less the Hydra, plus a card returned on entering; a draw and a second card returned on the attack
    expect(g.life[1]).toBe(15);
  });
});

describe("S73a — Drakonyx", () => {
  it("the card as written", () => {
    const p = cards.get("drakonyx")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.supertypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{R}{R}{R/G}{R/G}{G}{G}", ["Creature"], ["Dragon"], ["Legendary"], 5, 5, ["haste"], "custom"]);
    expect(p.text).toBe("Haste\nWhen this creature enters or attacks, choose one —\n• Search your library for a land card, put it onto the battlefield tapped, then shuffle.\n• Creatures you control get +1/+0 and gain trample until end of turn.");
  });
  it("enters and finds a land: it enters tapped, and any land card will do (a Valakut)", async () => {
    const g = await play("drakonyx", RG, { modes: ["search"], deck: { drakonyx: 30, valakut_the_molten_pinnacle: 30 } });
    expect(g.offered[0]).toHaveLength(2);
    const found = g.inZone("battlefield", 0).filter((o) => o.cardId === "valakut_the_molten_pinnacle");
    expect(found.map((o) => o.tapped)).toEqual([true]);
  });
  it("haste: two triggers the turn it lands — a land on entering, then +1/+0 and trample on the attack (six to the face)", async () => {
    const g = await play("drakonyx", RG, { modes: ["search", "trample"], attackOn: [1] });
    expect(g.offered).toHaveLength(2);
    expect(g.life[1]).toBe(14);
    expect(g.inZone("battlefield", 0).filter((o) => cards.get(o.cardId)!.types.includes("Land"))).toHaveLength(7);
  });
  it("two lands in a turn: the land mode on entering and again on the attack", async () => {
    const g = await play("drakonyx", RG, { modes: ["search", "search"], attackOn: [1] });
    expect(g.life[1]).toBe(15);
    expect(g.inZone("battlefield", 0).filter((o) => cards.get(o.cardId)!.types.includes("Land"))).toHaveLength(8);
  });
});

/**
 * S73a — Whelkin (Chris's card, its second text; R-134). {W}{W}{W/U}{W/U}{U}{U} legendary Snail 5/5, vigilance. "When
 * this creature enters or attacks, choose one — • Create two 0/3 white and blue Snail creature tokens. • Untap each
 * creature you control." Rules (the rules of 2026-11-06): 701.26b (to untap), 506.4b (untapping a creature already
 * declared as an attacker does not remove it from combat), 508.1f and 702.20b (attacking taps a creature unless it has
 * vigilance), 111.3–111.4 (a token's characteristics are those its creator gives it; its name is its subtype and "Token").
 */
const WU = ["plains", "plains", "plains", "island", "island", "island"];
describe("S73a — Whelkin (R-134)", () => {
  it("the card and its token as written", () => {
    const p = cards.get("whelkin")!, k = cards.get("snail_0_3_wu")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.supertypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{W}{W}{W/U}{W/U}{U}{U}", ["Creature"], ["Snail"], ["Legendary"], 5, 5, ["vigilance"], "custom"]);
    expect(p.text).toBe("Vigilance\nWhen this creature enters or attacks, choose one —\n• Create two 0/3 white and blue Snail creature tokens.\n• Untap each creature you control.");
    expect([k.name, k.types, k.subtypes, k.colors, k.power, k.toughness]).toEqual(["Snail Token", ["Creature"], ["Snail"], ["W", "U"], 0, 3]);
  });
  it("enters and makes two 0/3 Snails", async () => {
    const g = await play("whelkin", WU, { modes: ["create"] });
    expect(g.offered[0]).toHaveLength(2);
    expect(g.inZone("battlefield", 0).filter((o) => o.cardId === "snail_0_3_wu")).toHaveLength(2);
  });
  it("attacks twice: four Snails after the second trigger, and vigilance leaves Whelkin untapped", async () => {
    const g = await play("whelkin", WU, { modes: ["create", "create"], turns: 3, attackOn: [3] });
    expect(g.inZone("battlefield", 0).filter((o) => o.cardId === "snail_0_3_wu")).toHaveLength(4);
    expect(g.life[1]).toBe(15);
    expect(g.inZone("battlefield", 0).filter((o) => o.cardId === "whelkin").map((o) => o.tapped)).toEqual([false]);
  });
  it("the untap: a creature that attacked beside Whelkin stands up again and still deals its damage (506.4b)", async () => {
    // a Hill Giant of ours (3/3, no vigilance) attacks with Whelkin on turn 3; the attack trigger untaps it
    const g = await play("whelkin", WU, { modes: ["create", "untap"], turns: 3, attackOn: [3], also: "hill_giant", modifiers: [{ type: "permanentOnBattlefield", player: 0, cardId: "hill_giant" }] });
    expect(g.life[1]).toBe(12); // five and three
    expect(g.untappedAfterAttack).toContain("hill_giant");
  });
});

/**
 * S73a — Corontzasol and Abyssalume (Chris's cards; the last two of the five). Rules (the rules of 2026-11-06): 122.1a
 * (a +1/+1 counter adds to power and toughness), 608.2h (the damage reads the creature's power as the effect is
 * applied — counters from an earlier trigger count), 611.2c (a continuous effect from a resolving ability that changes
 * characteristics affects the objects it found as it resolved, and no others), 704.5f (a creature with toughness 0 or
 * less is put into its owner's graveyard).
 */
const RW = ["mountain", "mountain", "mountain", "plains", "plains", "plains"], UB = ["island", "island", "island", "swamp", "swamp", "swamp"];
describe("S73a — Corontzasol", () => {
  it("the card as written", () => {
    const p = cards.get("corontzasol")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.supertypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{R}{R}{R/W}{R/W}{W}{W}", ["Creature"], ["Angel", "Snake"], ["Legendary"], 5, 5, ["flying"], "custom"]);
    expect(p.text).toBe("Flying\nWhen this creature enters or attacks, choose one —\n• Put two +1/+1 counters on it.\n• This creature deals damage equal to its power to target creature.");
  });
  it("enters and deals five to a 6/6: the 6/6 lives", async () => {
    const g = await play("corontzasol", RW, { modes: ["damage"], aim: onObject("rampaging_baloths"), theirs: ["rampaging_baloths"] });
    expect(g.zone("rampaging_baloths", 1)).toEqual(["battlefield"]);
  });
  it("enters and deals five to a 3/3: it dies", async () => {
    const g = await play("corontzasol", RW, { modes: ["damage"], aim: onObject("hill_giant"), theirs: ["hill_giant"] });
    expect(g.zone("hill_giant", 1)).toEqual(["graveyard"]);
  });
  it("the counters feed the damage: two counters on entering, then seven to the 6/6 on the attack (608.2h)", async () => {
    const g = await play("corontzasol", RW, { modes: ["counters", "damage"], aim: onObject("rampaging_baloths"), theirs: ["rampaging_baloths"], turns: 3, attackOn: [3] });
    expect(g.zone("rampaging_baloths", 1)).toEqual(["graveyard"]);
    expect(g.life[1]).toBe(13); // a 7/7 flier, unblocked
  });
  it("\"target creature\" may be itself: with no other creature the damage mode's only target is Corontzasol, and five kills a 5/5", async () => {
    const g = await play("corontzasol", RW, { modes: ["damage"] });
    expect(g.offered[0]).toHaveLength(2); // the counters were on offer; a pilot must not take the damage here
    expect(g.zone("corontzasol", 0).filter((z) => z === "graveyard")).toHaveLength(1);
  });
});

describe("S73a — Abyssalume (R-135)", () => {
  it("the card as written", () => {
    const p = cards.get("abyssalume")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.supertypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{U}{U}{U/B}{U/B}{B}{B}", ["Creature"], ["Serpent"], ["Legendary"], 5, 5, ["menace"], "custom"]);
    expect(p.text).toBe("Menace\nWhen this creature enters or attacks, choose one —\n• Other creatures get -1/-1 until end of turn.\n• Return target nonland permanent to its owner's hand.");
  });
  it("other creatures get -1/-1: both sides' 1/1s die, a 3/3 lives, and Abyssalume is spared", async () => {
    const g = await play("abyssalume", UB, { modes: ["other"], theirs: ["llanowar_elves", "hill_giant"], modifiers: [{ type: "permanentOnBattlefield", player: 0, cardId: "llanowar_elves" }] });
    expect(g.zone("llanowar_elves", 1)).toEqual(["graveyard"]);
    expect(g.zone("llanowar_elves", 0)).toEqual(["graveyard"]);
    expect(g.zone("hill_giant", 1)).toEqual(["battlefield"]);
    expect(g.last.battlefield.filter((o) => o.cardId === "abyssalume").map((o) => [o.power, o.toughness])).toEqual([[5, 5]]);
  });
  it("returns a nonland permanent to its owner's hand", async () => {
    const g = await play("abyssalume", UB, { modes: ["return"], aim: onObject("hill_giant"), theirs: ["hill_giant"] });
    expect(g.zone("hill_giant", 1)).toEqual(["hand"]);
  });
  it("attacks: the bounce clears the one blocker and the attack lands", async () => {
    const g = await play("abyssalume", UB, { modes: ["return", "return"], aim: onObject("hill_giant"), theirs: ["hill_giant", "hill_giant"], turns: 3, attackOn: [3] });
    expect(g.zone("hill_giant", 1)).toEqual(["hand", "hand"]);
    expect(g.life[1]).toBe(15);
  });
});
