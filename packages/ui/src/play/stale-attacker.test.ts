import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S65 (Chris's hang, convocation-game-r5-t9: the AI sacrificed two of its attacking Goblin tokens to Siege-Gang
 * Commander in the declare-attackers step; "No such object: obj_187" from the attack pause). The engine leaves a
 * creature that left the battlefield in `combat.attackers` — a token's object no longer exists — and the pause read
 * every id's characteristics. The pause (and the no-block explanation) read only the attackers still there.
 */
describe("an attacker that left the battlefield (post-S65, Chris's report)", () => {
  it("the attack pause names the live attackers and does not throw on a sacrificed token's id", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 7, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "plains", count: 40 }] },
      enemy: { name: "ai", decklist: [{ cardId: "mountain", count: 40 }], difficulty: "master", archetype: "aggro" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 1 },
      modifiers: [perm(1, "goblin_chieftain"), perm(0, "grizzly_bears")],
    } });
    const done = c.start();
    for (let i = 0; i < 400 && !c.game.state.battlefield.some((id) => c.game.state.objects[id]!.cardId === "goblin_chieftain"); i++) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); } // keep the opening hand
    }
    const st = c.game.state;
    const chief = st.battlefield.find((id) => st.objects[id]!.cardId === "goblin_chieftain")!;
    st.activePlayer = 1; st.step = "DECLARE_ATTACKERS"; st.turn = 3;
    st.combat.attackers = [chief, "obj_gone"]; // the second: a sacrificed token's id
    const moment = (c as unknown as { pendingCombatMoment: () => { text: string } | null }).pendingCombatMoment();
    expect(moment?.text).toMatch(/^Opponent attacks with Goblin Chieftain/);
    expect(moment?.text).not.toContain("a creature");
    c.concede(); await done;
  });
});
