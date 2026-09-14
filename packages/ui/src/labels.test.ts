import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { initialGameState } from "@shandalar/engine";
import { actionLabel, targetLabel } from "./labels.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/** Deploy playtest r8 (Chris): a Crab trigger's "Opponent" option milled the player — from seat 1 the label
 * named the wrong seat. Player targets are labelled relative to the human's seat. */
describe("labels — player targets are named relative to the human's seat", () => {
  const pool = loadCardPool(CARDS_DIR).cards;
  const state = initialGameState(20);
  const aim = (player: 0 | 1) => ({ type: "chooseTriggerTargets" as const, targets: [{ kind: "player" as const, player }] });
  it("seat 0: player 1 is the Opponent; seat 1: player 1 is You", () => {
    expect(actionLabel(state, pool, aim(1), undefined, 0)).toBe("Trigger targets → Opponent");
    expect(actionLabel(state, pool, aim(1), undefined, 1)).toBe("Trigger targets → You");
    expect(actionLabel(state, pool, aim(0), undefined, 1)).toBe("Trigger targets → Opponent");
    expect(targetLabel(state, pool, { kind: "player", player: 0 }, 1)).toBe("Opponent");
  });
  it("the default keeps the replay viewer's convention (player 0 = You)", () => {
    expect(actionLabel(state, pool, aim(0))).toBe("Trigger targets → You");
  });
});
