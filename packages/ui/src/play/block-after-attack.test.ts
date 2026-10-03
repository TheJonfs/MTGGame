import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S53 (Chris, the Convocation: "my opponent attacked with a Fencing Ace and I wasn't offered the block, though my
 * Bitterblossom token stood untapped" — twice, and fatal). The cause: confirming an attack with EVERY eligible creature
 * leaves only "done" after the last declaration, which the engine auto-takes (ADR-014) without asking — so the
 * controller's declaration queue was never cleared, and a tapped-out player's next request (the opponent's declare
 * blockers: every priority window between is a lone pass) was answered from it with "done". Reproduced on Chris's own
 * decks (docs/debug_logs) before the fix; this is the board stripped to its cause: no lands (every window a lone pass),
 * two Bears that attack, Bitterblossom's token the only creature left standing.
 */
describe("a block after attacking with everything (post-S53, Chris's report)", () => {
  it("the summoning-sick Faerie Rogue token is offered the block against Fencing Ace, turn after turn", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 11, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "fencing_ace", count: 40 }] }, // nothing castable: no lands
      enemy: { name: "ai", decklist: [{ cardId: "plains", count: 40 }], difficulty: "master", archetype: "aggro" },
      rules: { startingLife: 40, ante: 0, startingPlayer: 0 },
      modifiers: [perm(0, "bitterblossom"), perm(0, "grizzly_bears"), perm(0, "grizzly_bears"), perm(1, "fencing_ace"), { type: "startingLife", player: 1, value: 40 }],
    } });
    const done = c.start();
    const offers: { turn: number; blockers: string[] }[] = [], attacks: number[] = [];
    (c.game.ctx.bus as unknown as { on: (n: string, f: (e: { attackers: string[] }) => void) => void }).on("ATTACKERS_DECLARED", (e) => { if (c.game.state.activePlayer === 1 && e.attackers.length) attacks.push(c.game.state.turn); });
    let guard = 0;
    while (!c.result && guard++ < 6000) {
      await new Promise((r) => setTimeout(r, 0));
      const p = c.phase, st = c.game.state;
      if (st.turn > 6) { c.concede(); break; }
      if (p.kind === "priority") c.pass();
      else if (p.kind === "stackStop") c.continueFromStop();
      else if (p.kind === "attackers") { for (const id of [...p.eligible]) c.clickBattlefield(id); c.confirmAttackers(); } // attack with everything that can
      else if (p.kind === "blockers") { offers.push({ turn: st.turn, blockers: [...p.options.keys()].map((id) => pool.get(st.objects[id]!.cardId)!.name) }); c.confirmBlocks(); }
      else if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    }
    await done;
    expect(attacks.length).toBeGreaterThanOrEqual(2); // the Ace swung on turns two and four (and on)
    for (const t of attacks) expect(offers.find((o) => o.turn === t), `turn ${t}: the block was skipped`).toBeTruthy();
    expect(offers.every((o) => o.blockers.includes("Faerie Rogue Token"))).toBe(true);
  }, 60_000);
});
