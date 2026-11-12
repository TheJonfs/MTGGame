import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S71a (Chris — Command of the Depths, "choose two —"): the six pairs of its modes are its modes, and several share a target
 * shape (draw + −2/−2 and −2/−2 + a Faerie both aim at one creature), so clicking a target could not say which mode. The cast now
 * asks the mode first, by its printed label (CR 700.2a), and the targeting holds only that mode's targets.
 */
describe("a modal spell asks which mode before its targets (post-S71a, Chris — Command of the Depths)", () => {
  it("the six pairs listed; a creature mode targets creatures only; the discard pair a player first; the untargeted pair goes straight to confirm", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "command_of_the_depths", count: 40 }] },
      enemy: { name: "ai", decklist: [{ cardId: "hill_giant", count: 40 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: [perm(0, "island"), perm(0, "swamp"), perm(1, "grizzly_bears"), perm(1, "hill_giant")],
    } });
    void c.start();
    for (let g = 0; g < 200; g++) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0) break;
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
      else if (c.phase.kind === "priority") c.pass();
    }
    const st = c.game.state;
    const cmd = st.players[0].hand.find((id) => st.objects[id]!.cardId === "command_of_the_depths")!;
    c.clickHand(cmd);
    expect(c.phase.kind).toBe("chooseMode");
    const options = (c.phase as { options: { mode: number; label: string }[] }).options;
    expect(options.map((o) => o.label)).toEqual([
      "You draw a card; target creature gets -2/-2 until end of turn",
      "You draw a card; create a 1/1 blue Faerie creature token with flying",
      "You draw a card; target player discards a card",
      "Target creature gets -2/-2 until end of turn; create a 1/1 blue Faerie creature token with flying",
      "Target creature gets -2/-2 until end of turn; target player discards a card",
      "Create a 1/1 blue Faerie creature token with flying; target player discards a card",
    ]);

    c.chooseMode(3); // −2/−2 and a Faerie
    const t = c.phase as { kind: string; highlightObjects: Set<string>; highlightPlayers: Set<number> };
    expect(t.kind).toBe("targeting");
    expect(t.highlightPlayers.size).toBe(0);
    expect([...t.highlightObjects].map((id) => st.objects[id]!.cardId).sort()).toEqual(["grizzly_bears", "hill_giant"]);

    c.cancel(); c.clickHand(cmd); c.chooseMode(4); // −2/−2 and a discard: the player first
    const u = c.phase as { kind: string; highlightObjects: Set<string>; highlightPlayers: Set<number> };
    expect(u.kind).toBe("targeting");
    expect([...u.highlightPlayers].sort()).toEqual([0, 1]);

    c.cancel(); c.clickHand(cmd); c.chooseMode(1); // a draw and a Faerie: no targets
    expect(c.phase.kind).toBe("confirmCast");
    c.concede();
  }, 30_000);
});
