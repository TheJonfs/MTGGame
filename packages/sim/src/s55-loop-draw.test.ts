import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { LOOP_DRAW_CAP, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const scripted = (f: (v: GameView, r: ActionRequest) => Action | undefined): Agent => ({ chooseAction: async (v, r) => f(v, r) ?? r.actions.find((a) => a.type === "pass") ?? r.actions[0]! });
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId ?? [...v.graveyardObjects[0], ...v.graveyardObjects[1]].find((g) => g.objectId === id)?.cardId) : undefined);
const tgt = (a: Action) => ((a as { targets?: { kind: string; id?: string; player?: number }[] }).targets ?? [])[0];
const loopDraws = (log: { t: string; name?: string }[]) => log.filter((e) => e.t === "EVENT" && e.name === "LOOP_DRAW").length;
const USHER_LANDS = ["swamp", "swamp", "plains", "mountain", "swamp"];
/** Seat 0 casts an Usher on its first main phase and always returns the other Usher. */
const usherPilot = scripted((v, r) => {
  if (r.purpose === "priority") return v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0 && !v.battlefield.some((b) => b.controller === 0 && b.cardId === "the_usher") ? r.actions.find((a) => a.type === "castSpell" && cardOf(v, a.objectId) === "the_usher") : undefined;
  if (r.actions.some((a) => a.type === "chooseTriggerTargets")) return r.actions.find((a) => cardOf(v, tgt(a)?.id) === "the_usher") ?? r.actions.find((a) => tgt(a)?.kind === "player" && tgt(a)?.player === 1);
  return r.actions[0];
});
const usherSpec = (theirs: string[]): MatchSpec => ({ seed: 55, players: [{ name: "a", decklist: D({ the_usher: 30, swamp: 10 }), agent: "x" }, { name: "b", decklist: D({ grizzly_bears: 30, forest: 10 }), agent: "x" }],
  rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: 0 } as MatchSpec["rules"],
  modifiers: [...USHER_LANDS.map((l) => perm(0, l)), ...theirs.map((x) => perm(1, x)), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 6, who: "you" }] } as Modifier] });

/**
 * S55 Part 1 (R-103; CR 104.4b "…enters a 'loop' of mandatory actions, repeating a sequence of events with no way to
 * stop, the game is a draw"; CR 732.4 "If a loop contains only mandatory actions, the game is a draw" — both verified
 * 2026-10-05). The engine counts: a hundred stack items resolved in one turn, each leaving a position the turn has
 * already seen.
 */
describe("S55 — the mandatory-loop draw (R-103)", () => {
  it("the Usher's loop where the drains cancel — our two Ushers' four a death against an opposing Usher and two Blood Artists' four — is a draw at the cap, on the turn it began", async () => {
    const drainUs = scripted((_v, r) => (r.actions.some((a) => a.type === "chooseTriggerTargets") ? r.actions.find((a) => tgt(a)?.kind === "player" && tgt(a)?.player === 0) : r.actions[0]));
    const r = await runMatch(usherSpec(["the_usher", "blood_artist", "blood_artist"]), cards, [usherPilot, drainUs]);
    expect(r.winner).toBeNull();
    expect(r.reason).toBe("DRAW");
    expect(r.turns).toBe(1);
    expect(loopDraws(r.log as never)).toBe(1);
    const ev = (r.log as { t: string; name?: string; payload?: { repeats: number } }[]).find((e) => e.name === "LOOP_DRAW")!;
    expect(ev.payload!.repeats).toBe(LOOP_DRAW_CAP);
    expect(Math.abs(r.finalLife[0] - 20)).toBeLessThanOrEqual(4); // the totals went nowhere
    expect(Math.abs(r.finalLife[1] - 20)).toBeLessThanOrEqual(4);
  });

  it("the Usher's own loop moves a life total every pass: it never trips the rule, and wins — as it does against one opposing Usher (four a death against two)", async () => {
    for (const theirs of [[], ["the_usher"]]) {
      const r = await runMatch(usherSpec(theirs), cards, [usherPilot, scripted(() => undefined)]);
      expect(r.winner, JSON.stringify(theirs)).toBe(0);
      expect(r.reason).toBe("LIFE");
      expect(r.turns).toBe(1);
      expect(loopDraws(r.log as never)).toBe(0);
    }
  });

  it("the Altar's loop (the Usher, a Restoration Angel, an Altar of Dementia) moves a library and a life total every pass: never tripped", async () => {
    const pilot = scripted((v, r) => {
      const angelOut = v.battlefield.some((b) => b.cardId === "restoration_angel");
      if (r.purpose === "priority") {
        const altar = r.actions.find((a) => a.type === "activateAbility" && cardOf(v, a.objectId) === "altar_of_dementia" && tgt(a)?.kind === "player" && tgt(a)?.player === 1);
        if (angelOut && v.stack.length > 0 && altar) return altar;
        if (!angelOut && v.stack.length === 0 && v.step === "MAIN1" && v.activePlayer === 0) return r.actions.find((a) => a.type === "castSpell" && cardOf(v, a.objectId) === "restoration_angel");
        return undefined;
      }
      if (r.actions.some((a) => a.type === "sacrifice")) return r.actions.find((a) => a.type === "sacrifice" && cardOf(v, (a as { objectId: string }).objectId) === "restoration_angel");
      if (r.actions.some((a) => a.type === "acceptOptional")) return r.actions.find((a) => a.type === "acceptOptional");
      if (r.actions.some((a) => a.type === "chooseTriggerTargets")) return r.actions.find((a) => cardOf(v, tgt(a)?.id) === "restoration_angel") ?? r.actions.find((a) => cardOf(v, tgt(a)?.id) === "the_usher");
      return r.actions[0];
    });
    const spec: MatchSpec = { seed: 21, players: [{ name: "a", decklist: D({ restoration_angel: 30, plains: 10 }), agent: "x" }, { name: "b", decklist: D({ grizzly_bears: 30, forest: 10 }), agent: "x" }],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: 0 } as MatchSpec["rules"], modifiers: ["plains", "plains", "plains", "plains", "altar_of_dementia", "the_usher"].map((l) => perm(0, l)) };
    const r = await runMatch(spec, cards, [pilot, scripted(() => undefined)]);
    expect(r.winner).toBe(0);
    expect(r.turns).toBe(1);
    expect(loopDraws(r.log as never)).toBe(0);
  });

  it("a Reassembling Skeleton sacrificed and returned a hundred times by hand in one turn — the mill finding an empty library, so nothing moves but the mana paid — is not a loop: the lands tapped differ each time", async () => {
    let returns = 0;
    const pilot = scripted((v, r) => {
      if (r.purpose === "priority" && v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) {
        const altar = r.actions.find((a) => a.type === "activateAbility" && cardOf(v, a.objectId) === "altar_of_dementia" && tgt(a)?.player === 1);
        if (v.battlefield.some((b) => b.cardId === "reassembling_skeleton") && altar && returns < 100) return altar;
        const back = r.actions.find((a) => a.type === "activateAbility" && cardOf(v, a.objectId) === "reassembling_skeleton");
        if (back && returns < 100) { returns += 1; return back; }
        return undefined;
      }
      if (r.actions.some((a) => a.type === "sacrifice")) return r.actions.find((a) => a.type === "sacrifice" && cardOf(v, (a as { objectId: string }).objectId) === "reassembling_skeleton");
      return r.actions[0];
    });
    const spec: MatchSpec = { seed: 9, players: [{ name: "a", decklist: D({ swamp: 40 }), agent: "x" }, { name: "b", decklist: D({ forest: 40 }), agent: "x" }],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: 0 } as MatchSpec["rules"],
      modifiers: [...Array.from({ length: 204 }, () => perm(0, "swamp")), perm(0, "altar_of_dementia"), perm(0, "reassembling_skeleton"), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 60, who: "opponent" }] } as Modifier] };
    const r = await runMatch(spec, cards, [pilot, scripted(() => undefined)]);
    expect(returns).toBe(100);
    expect(loopDraws(r.log as never)).toBe(0);
    expect(r.reason).toBe("DECKED"); // the game went on: the opponent drew from the library the start emptied
    expect(r.winner).toBe(0);
  });
});
