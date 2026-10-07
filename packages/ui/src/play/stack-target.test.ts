import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));
const inHand = (c: MatchController, cardId: string) => c.game.state.players[0].hand.find((id) => c.game.state.objects[id]!.cardId === cardId)!;

/** Post-S57 (Chris: "the player doesn't have a way to get into a counter war" — a counterspell's legal targets were
 * computed and highlighted by id, but the stack panel drew no highlight and took no click). */
describe("a spell on the stack can be picked as a target", () => {
  it("with two spells on the stack a Counterspell enters targeting, both stack items are legal picks, and clicking one stages the cast at it", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "shock", count: 20 }, { cardId: "counterspell", count: 20 }] },
      enemy: { name: "ai", decklist: [{ cardId: "hill_giant", count: 24 }, { cardId: "mountain", count: 16 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: ["volcanic_island", "volcanic_island", "volcanic_island", "volcanic_island"].map((x) => perm(0, x)),
    } });
    void c.start();
    for (let g = 0; g < 200 && !(c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0); g++) { await tick(); if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); } }
    expect(c.game.state.players[0].hand.filter((id) => c.game.state.objects[id]!.cardId === "shock").length).toBeGreaterThanOrEqual(2);
    // two Shocks at the opponent's face, priority held after each
    for (let n = 0; n < 2; n++) {
      c.clickHand(inHand(c, "shock"));
      if (c.phase.kind === "targeting") c.clickPlayer(1);
      expect(c.phase.kind).toBe("confirmCast");
      c.confirmCast(true);
      for (let g = 0; g < 50 && c.phase.kind !== "priority"; g++) await tick();
      expect(c.game.state.stack).toHaveLength(n + 1);
    }
    const [first, second] = c.game.state.stack.map((s) => s.id);
    c.clickHand(inHand(c, "counterspell"));
    expect(c.phase.kind).toBe("targeting");
    if (c.phase.kind !== "targeting") return;
    expect([...c.phase.highlightObjects].sort()).toEqual([first!, second!].sort()); // what the stack panel now outlines
    c.clickStackTarget(first!); // the one underneath: not the default
    expect(c.phase.kind).toBe("confirmCast");
    if (c.phase.kind !== "confirmCast") return;
    expect((c.phase.action as { targets: unknown[] }).targets).toEqual([{ kind: "stackItem", id: first }]);
    c.confirmCast();
    for (let g = 0; g < 50 && c.game.state.stack.length > 1; g++) { await tick(); if (c.phase.kind === "stackStop") c.continueFromStop(); else if (c.phase.kind === "priority") c.pass(); }
    expect(c.game.state.players[1].life).toBe(18); // one Shock countered, one landed
  });
});
