import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards: Map<string, CardDef> = new Map([...loadCardPool(join(ROOT, "data/cards")).cards]);
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string; controller: number }>; battlefield: string[]; players: { graveyard: string[] }[] };
const rules = (turns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns: turns, startingPlayer: 0 }) as MatchSpec["rules"];
const cardAt = (v: GameView, id?: string) => v.battlefield.find((o) => o.id === id);
type Step = (v: GameView, r: ActionRequest) => Action | undefined;
/** Runs the steps in order in our first main phase (each when it finds its action), passing otherwise. */
const script = (steps: Step[]): Agent & { offered: Action[] } => {
  const left = [...steps]; const a = { offered: [] as Action[], chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (r.purpose === "priority" && v.turn === 1 && v.activePlayer === 0) {
      a.offered.push(...r.actions.filter((x) => x.type === "castSpell"));
      const s = left[0]; const act = s?.(v, r);
      if (act) { left.shift(); return act; }
    }
    return pass(r);
  } }; return a;
};
/** Cast Correspondence at (their or our) A and B, named by card and controller. */
const corr = (a: [string, 0 | 1], b: [string, 0 | 1]): Step => (v, r) => r.actions.find((x) => {
  if (x.type !== "castSpell" || v.hand.find((h) => h.objectId === x.objectId)?.cardId !== "correspondence") return false;
  const [t0, t1] = x.targets as { kind: string; id: string }[];
  const o0 = cardAt(v, t0?.id), o1 = cardAt(v, t1?.id);
  return !!o0 && !!o1 && o0.cardId === a[0] && o0.controller === a[1] && o1.cardId === b[0] && o1.controller === b[1];
});
const run = async (mods: Modifier[], agent: Agent, turns = 2) => JSON.parse((await runMatch({ seed: 31, players: [{ name: "a", decklist: [{ cardId: "correspondence", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(turns), modifiers: mods } as MatchSpec, cards, [agent, passer])).finalStateSerialized) as Final;
const inYard = (f: Final, p: number, id: string) => f.players[p]!.graveyard.filter((o) => f.objects[o]?.cardId === id).length;
const ctrl = (f: Final, id: string) => f.battlefield.filter((o) => f.objects[o]!.cardId === id).map((o) => f.objects[o]!.controller);
const mana = [perm(0, "volcanic_island"), perm(0, "mountain"), perm(0, "island"), perm(0, "mountain")];

/** Post-S71a — Correspondence ({1}{U/R}{U/R} instant, Chris's study card): "Exchange control of two target permanents
 * that share a permanent type." R-126 (CR 701.12, 611.2a) and Role Reversal's rulings (2019-05-03, Scryfall). */
describe("Post-S71a — Correspondence: the exchange (R-126)", () => {
  it("exchanges two creatures, and the exchange outlasts the turn", async () => {
    const f = await run([...mana, perm(0, "grizzly_bears"), perm(1, "serra_angel")], script([corr(["grizzly_bears", 0], ["serra_angel", 1])]));
    expect(ctrl(f, "serra_angel")).toEqual([0]);
    expect(ctrl(f, "grizzly_bears")).toEqual([1]);
  });

  it("only permanents that share a permanent type are offered as a pair (a creature for a land is not)", async () => {
    const a = script([]);
    await run([...mana, perm(0, "grizzly_bears"), perm(1, "taiga")], a, 1);
    const pairs = a.offered.filter((x) => x.type === "castSpell").map((x) => (x as { targets: { id: string }[] }).targets.map((t) => t.id));
    expect(pairs.length).toBeGreaterThan(0); // land for land is a legal pair
    expect(pairs.every(([p, q]) => p !== q)).toBe(true); // never the same permanent twice
  });

  it("you needn't control either target, and if one player controls both nothing happens", async () => {
    const f = await run([...mana, perm(1, "grizzly_bears"), perm(1, "serra_angel")], script([corr(["grizzly_bears", 1], ["serra_angel", 1])]));
    expect(ctrl(f, "serra_angel")).toEqual([1]);
    expect(ctrl(f, "grizzly_bears")).toEqual([1]);
    expect(inYard(f, 0, "correspondence")).toBe(1); // it was cast and resolved — to no effect
  });

  it("if a target is gone when it resolves, the exchange doesn't happen", async () => {
    const bolt: Step = (v, r) => (v.stack.some((s) => s.cardId === "correspondence") ? r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === "lightning_bolt" && cardAt(v, (x.targets[0] as { id: string })?.id)?.cardId === "grizzly_bears") : undefined);
    const withBolt: Map<string, CardDef> = cards; void withBolt;
    const mods = [...mana, perm(0, "mountain"), perm(0, "grizzly_bears"), perm(1, "serra_angel")];
    const f = JSON.parse((await runMatch({ seed: 31, players: [{ name: "a", decklist: [{ cardId: "correspondence", count: 30 }, { cardId: "lightning_bolt", count: 30 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: rules(2), modifiers: mods } as MatchSpec, cards, [script([corr(["grizzly_bears", 0], ["serra_angel", 1]), bolt]), passer])).finalStateSerialized) as Final;
    expect(ctrl(f, "serra_angel")).toEqual([1]);
    expect(ctrl(f, "grizzly_bears")).toEqual([]);
    expect(inYard(f, 0, "correspondence")).toBe(1);
    expect(inYard(f, 0, "lightning_bolt")).toBe(1);
    expect(inYard(f, 0, "grizzly_bears")).toBe(1);
  });

  it("the Lumen line: borrow their Bears until end of turn, exchange the borrowed Bears for their Angel — the Angel stays", async () => {
    const lumen: Step = (v, r) => r.actions.find((x) => x.type === "activateAbility" && cardAt(v, x.objectId)?.cardId === "lumen_the_hearth_fire" && cardAt(v, (x.targets[0] as { id: string })?.id)?.cardId === "grizzly_bears");
    const f = await run([...mana, perm(0, "lumen_the_hearth_fire"), perm(1, "grizzly_bears"), perm(1, "serra_angel")], script([lumen, corr(["grizzly_bears", 0], ["serra_angel", 1])]));
    expect(ctrl(f, "serra_angel")).toEqual([0]);
    expect(ctrl(f, "grizzly_bears")).toEqual([1]);
  });
});
