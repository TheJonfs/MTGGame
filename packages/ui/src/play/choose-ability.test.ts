import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S53 (Chris: The Reeve — "{1}{U}: target player mills three; {3}{B}{G}: return target creature card from a
 * graveyard" — offered only his own graveyard, and opening the opponent's chose "mill the opponent"). Two abilities'
 * activations went into ONE targeting step (players and graveyard cards together). Now the screen asks which ability,
 * and the targeting holds only that ability's targets.
 */
describe("a permanent with two activated abilities asks which (post-S53, Chris — The Reeve)", () => {
  it("The Reeve: choose the ability; the return targets creature cards in BOTH graveyards and no player; the mill targets the two players", async () => {
    const lands = ["island", "swamp", "swamp", "forest", "forest", "plains"];
    const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "grizzly_bears", count: 40 }] },
      enemy: { name: "ai", decklist: [{ cardId: "hill_giant", count: 40 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: [perm(0, "the_reeve"), ...lands.map((l) => perm(0, l)), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 4, who: "you" }, { type: "mill", count: 4, who: "opponent" }] } as Modifier],
    } });
    void c.start();
    for (let g = 0; g < 200; g++) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0) break; // our main phase: the Reeve can act
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
      else if (c.phase.kind === "priority") c.pass();
    }
    const st = c.game.state;
    const reeve = st.battlefield.find((id) => st.objects[id]!.cardId === "the_reeve")!;
    expect(st.players[0].graveyard.length).toBeGreaterThan(0);
    expect(st.players[1].graveyard.length).toBeGreaterThan(0);

    c.clickBattlefield(reeve);
    expect(c.phase.kind).toBe("chooseAbility");
    const options = (c.phase as { options: { abilityIndex: number; label: string }[] }).options;
    expect(options.map((o) => o.label)).toEqual(["{1}{U}: Target player mills three cards.", "{3}{B}{G}: Return target creature card from a graveyard to the battlefield."]);

    c.chooseAbility(options[1]!.abilityIndex); // the return
    expect(c.phase.kind).toBe("targeting");
    const t = c.phase as { highlightObjects: Set<string>; highlightPlayers: Set<number> };
    expect(t.highlightPlayers.size).toBe(0); // no player to click by mistake
    const owners = new Set([...t.highlightObjects].map((id) => st.objects[id]!.owner));
    expect([...owners].sort()).toEqual([0, 1]); // both graveyards' creatures
    expect([...t.highlightObjects].every((id) => st.objects[id]!.zone === "graveyard")).toBe(true);

    c.cancel();
    c.clickBattlefield(reeve);
    c.chooseAbility(options[0]!.abilityIndex); // the mill
    const m = c.phase as { kind: string; highlightObjects: Set<string>; highlightPlayers: Set<number> };
    expect(m.kind).toBe("targeting");
    expect([...m.highlightPlayers].sort()).toEqual([0, 1]);
    expect(m.highlightObjects.size).toBe(0);
    c.concede();
  }, 30_000);
});
