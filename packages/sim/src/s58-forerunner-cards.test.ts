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
const RULES = (maxTurns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 }) as MatchSpec["rules"];
type Final = { objects: Record<string, { cardId: string; zone: string; controller: number; owner: number }> };

/** Seat 0 casts the Forerunner once, when `when` first holds at a priority of its own, picks the mode whose label
 * holds `mode`, and aims at `aim`; seat 1 follows `reply`. Records the modes offered and what seat 0 saw last. */
async function play(opts: { mode: string; when?: (v: GameView) => boolean; aim?: (v: GameView, a: Action) => boolean; theirs?: string[]; theirDeck?: Record<string, number>; modifiers?: Modifier[]; reply?: (v: GameView, r: ActionRequest) => Action | undefined; turns?: number }) {
  let cast = false, castTurn = -1, castStep = ""; const offered: string[] = []; let last: GameView | undefined;
  const me: Agent = { chooseAction: async (v, r) => {
    last = v;
    if (r.purpose === "chooseMode") { for (const a of r.actions) if (a.type === "chooseMode") offered.push(a.label); return r.actions.find((a) => a.type === "chooseMode" && a.label.toLowerCase().includes(opts.mode)) ?? r.actions[0]!; }
    if (r.purpose === "chooseTarget") return r.actions.find((a) => opts.aim?.(v, a)) ?? r.actions[0]!;
    if (r.purpose === "priority" && !cast && (opts.when ?? ((w) => w.activePlayer === 0 && w.step === "MAIN1" && w.stack.length === 0))(v)) {
      const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "reapers_forerunner");
      if (a) { cast = true; castTurn = v.turn; castStep = v.step; return a; }
    }
    return r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
  } };
  const them: Agent = { chooseAction: async (v, r) => opts.reply?.(v, r) ?? r.actions.find((a) => a.type === "pass") ?? r.actions[0]! };
  const spec: MatchSpec = { seed: 5, players: [{ name: "a", decklist: D({ reapers_forerunner: 40, forest: 20 }), agent: "x" }, { name: "b", decklist: D(opts.theirDeck ?? { mountain: 60 }), agent: "x" }], rules: RULES(opts.turns ?? 1),
    modifiers: [perm(0, "forest"), perm(0, "forest"), perm(0, "forest"), ...(opts.theirs ?? []).map((c) => perm(1, c)), ...(opts.modifiers ?? [])] };
  const r = await runMatch(spec, cards, [me, them]);
  const final = JSON.parse(r.finalStateSerialized) as Final;
  const zone = (cardId: string, owner: 0 | 1) => Object.values(final.objects).filter((o) => o.cardId === cardId && o.owner === owner).map((o) => o.zone);
  return { cast, castTurn, castStep, offered, last: last!, final, zone };
}
const onObject = (cardId: string) => (v: GameView, a: Action) => ((a as { targets?: { kind: string; id?: string }[] }).targets ?? []).some((t) => t.kind === "object" && v.battlefield.some((o) => o.id === t.id && o.cardId === cardId));
const onPlayer = (p: 0 | 1) => (_v: GameView, a: Action) => ((a as { targets?: { kind: string; player?: number }[] }).targets ?? []).some((t) => t.kind === "player" && t.player === p);

/**
 * Post-S58 — Reaper's Forerunner (Chris's card; R-106). {1}{G}{G} Creature — Snake 1/1. "Flash, deathtouch. When
 * Reaper's Forerunner enters, choose one — • Reaper's Forerunner fights target creature you don't control. • Exile
 * target player's graveyard. • Create two 1/1 green Snake creature tokens."
 * Rules: 700.2b (the mode of a triggered ability is chosen as it is put on the stack; a mode that cannot be given its
 * target cannot be chosen — 603.3c), 701.14a (a fight: each deals damage equal to its power to the other — the Fight rule is 701.14 in the rules
 * effective 2026-09-25; R-031 cites its older number),
 * 701.14b (if a creature instructed to fight is no longer on the battlefield, no damage is dealt), 702.2b (damage
 * from a deathtouch source is lethal: 704.5h), 608.2b (a spell whose only target has become illegal does not resolve).
 */
describe("Post-S58 — Reaper's Forerunner (R-106)", () => {
  it("the card as written", () => {
    const p = cards.get("reapers_forerunner")!;
    expect(validateCard(p).errors).toEqual([]);
    expect([p.manaCost, p.types, p.subtypes, p.power, p.toughness, p.keywords, p.source]).toEqual(["{1}{G}{G}", ["Creature"], ["Snake"], 1, 1, ["flash", "deathtouch"], "custom"]);
    expect(p.text).toBe("Flash, deathtouch\nWhen Reaper's Forerunner enters, choose one —\n• Reaper's Forerunner fights target creature you don't control.\n• Exile target player's graveyard.\n• Create two 1/1 green Snake creature tokens.");
  });

  it("the fight: one deathtouch damage kills a 3/3, and its three kill the snake (701.14a, 702.2b)", async () => {
    const g = await play({ mode: "fights", aim: onObject("hill_giant"), theirs: ["hill_giant"] });
    expect(g.cast).toBe(true);
    expect(g.zone("hill_giant", 1)).toContain("graveyard");
    expect(g.zone("reapers_forerunner", 0).filter((z) => z === "graveyard")).toHaveLength(1);
  });

  it("the fight with a creature of no power: the 0/4 dies and the snake stays", async () => {
    const g = await play({ mode: "fights", aim: onObject("wall_of_blossoms"), theirs: ["wall_of_blossoms"] });
    expect(g.zone("wall_of_blossoms", 1)).toContain("graveyard");
    expect(g.zone("reapers_forerunner", 0).filter((z) => z === "battlefield")).toHaveLength(1);
  });

  it("701.14b: the snake killed with its trigger on the stack fights nothing — the 3/3 lives", async () => {
    let bolted = false;
    const g = await play({ mode: "fights", aim: onObject("hill_giant"), theirs: ["hill_giant", "mountain"], theirDeck: { lightning_bolt: 40, mountain: 20 },
      reply: (v, r) => { if (bolted || r.purpose !== "priority" || !v.stack.some((s) => s.kind !== "spell" && s.controller === 0)) return undefined; const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "lightning_bolt" && onObject("reapers_forerunner")(v, x)); if (a) bolted = true; return a; } });
    expect(bolted).toBe(true);
    expect(g.zone("hill_giant", 1)).toEqual(["battlefield"]);
    expect(g.zone("reapers_forerunner", 0).filter((z) => z === "graveyard")).toHaveLength(1);
  });

  it("603.3c: with no creature across the table the fight is not offered; the other two modes are", async () => {
    const g = await play({ mode: "token" });
    expect(g.offered.map((l) => l.split(" ")[0])).toEqual(["Exile", "Create"]);
  });

  it("the tokens: two 1/1 green Snakes beside it", async () => {
    const g = await play({ mode: "token", theirs: ["hill_giant"] });
    expect(g.offered).toHaveLength(3);
    const snakes = g.last.battlefield.filter((o) => o.controller === 0 && o.cardId === "snake_1_1_g");
    expect(snakes.map((s) => [s.power, s.toughness])).toEqual([[1, 1], [1, 1]]);
    expect(g.zone("hill_giant", 1)).toEqual(["battlefield"]);
  });

  it("the graveyard: flashed in with a Zombify on the stack, it exiles the graveyard and the Zombify does nothing (608.2b)", async () => {
    let zombified = false;
    const g = await play({ mode: "graveyard", aim: onPlayer(1), turns: 2, theirs: ["swamp", "swamp", "swamp", "swamp"], theirDeck: { hill_giant: 30, zombify: 30 },
      modifiers: [{ type: "effectAtStart", player: 1, effects: [{ type: "mill", count: 12, who: "you" }] }],
      when: (v) => v.activePlayer === 1 && v.stack.some((s) => s.cardId === "zombify"),
      reply: (v, r) => { if (zombified || r.purpose !== "priority" || v.activePlayer !== 1 || v.step !== "MAIN1" || v.stack.length > 0) return undefined; const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "zombify"); if (a) zombified = true; return a; } });
    expect(zombified).toBe(true);
    expect([g.cast, g.castTurn]).toEqual([true, 2]); // flash: on their turn, in response
    expect(g.zone("hill_giant", 1)).not.toContain("battlefield");
    expect(g.zone("hill_giant", 1)).not.toContain("graveyard");
    expect(g.zone("hill_giant", 1)).toContain("exile");
    expect(Object.values(g.final.objects).filter((o) => o.owner === 1 && o.zone === "graveyard").map((o) => o.cardId)).toEqual(["zombify"]); // the spell itself went there after the exile
  });

  it("the graveyard may be our own (target player)", async () => {
    const g = await play({ mode: "graveyard", aim: onPlayer(0), modifiers: [{ type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 3, who: "you" }] }] });
    expect(g.cast).toBe(true);
    expect(g.last.graveyards[0]).toEqual([]);
  });
});
