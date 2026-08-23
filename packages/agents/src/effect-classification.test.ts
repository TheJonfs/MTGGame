import { describe, expect, it } from "vitest";
import type { Action, GameView } from "@shandalar/engine";
import { classifyEffects, preferSide } from "./effect-classification.js";

function viewWith(battlefield: { id: string; controller: 0 | 1 }[]): GameView {
  return {
    you: 0,
    turn: 3,
    step: "MAIN1",
    activePlayer: 0,
    life: [20, 20],
    startingLife: 20,
    hand: [],
    opponentHandCount: 0,
    librarySizes: [30, 30],
    mulliganCount: 0,
    combat: { attackers: [], blocks: [] },
    battlefield: battlefield.map((o) => ({
      id: o.id,
      cardId: "grizzly_bears",
      controller: o.controller,
      tapped: false,
      damage: 0,
      attachedTo: null,
      power: 2,
      toughness: 2,
      keywords: [],
    })),
    stack: [],
    graveyards: [[], []],
    graveyardObjects: [[], []],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  };
}

describe("rule 8 classification (shared table; S8 brief Part 4.2)", () => {
  it("tapTarget is harmful: trigger/ability targets prefer the opponent's side", () => {
    expect(classifyEffects([{ type: "tapTarget", target: 0 }])).toBe("harmful");

    const view = viewWith([
      { id: "mine", controller: 0 },
      { id: "theirs", controller: 1 },
    ]);
    const variants: Action[] = [
      { type: "chooseTriggerTargets", targets: [{ kind: "object", id: "mine" }] },
      { type: "chooseTriggerTargets", targets: [{ kind: "object", id: "theirs" }] },
    ];
    const preferred = preferSide(view, variants, [{ type: "tapTarget", target: 0 }]);
    expect(preferred).toHaveLength(1);
    expect((preferred[0] as { targets: { id?: string }[] }).targets[0]!.id).toBe("theirs");
  });

  it("falls back to all variants when nothing is on the preferred side", () => {
    const view = viewWith([{ id: "mine", controller: 0 }]);
    const variants: Action[] = [
      { type: "chooseTriggerTargets", targets: [{ kind: "object", id: "mine" }] },
    ];
    expect(preferSide(view, variants, [{ type: "tapTarget", target: 0 }])).toHaveLength(1);
  });
});
