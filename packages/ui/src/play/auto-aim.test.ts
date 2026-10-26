import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { MatchController } from "./match-controller.js";
import { autoAimAction } from "./auto-aim.js";
import type { ActionRequest, Modifier } from "@shandalar/engine";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));
const effectsOf = (id: string) => (pool.get(id)!.abilities![0]! as unknown as { effects: never[] }).effects;
const playerTargets = (src: string): ActionRequest => ({
  player: 0, purpose: "chooseTarget", source: { cardId: src, effects: effectsOf(src) },
  actions: [0, 1].map((p) => ({ type: "chooseTargets", targets: [{ kind: "player", player: p }] })) as never,
} as ActionRequest);

/**
 * Post-S69 (Chris: a Massacrats turn asks for each Blood Artist's target): a trigger that only hurts its target
 * player is aimed at the opponent; anything else on the target asks; the toggle off asks (the life move seals the take-back, so the toggle is the way to aim by hand).
 */
describe("auto-aim: drains go at the opponent (post-S69)", () => {
  it("Blood Artist (loses 1; you gain 1) aims at the opponent; Hedron Crab (mill: a reanimator mills itself) asks", () => {
    const a = autoAimAction(playerTargets("blood_artist"), 1) as { targets: { player: number }[] } | null;
    expect(a?.targets[0]!.player).toBe(1);
    expect(autoAimAction(playerTargets("hedron_crab"), 1)).toBeNull();
  });

  /** You Bolt their Bears with a Blood Artist out: the Artist's trigger asks for a player. */
  async function boltTheBears(setup: (c: MatchController) => void): Promise<MatchController> {
    const c = new MatchController(pool, {
      humanSeat: 0, seed: 7, aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "lightning_bolt", count: 20 }, { cardId: "mountain", count: 20 }] },
        enemy: { name: "D", decklist: [{ cardId: "forest", count: 40 }], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        modifiers: [perm(0, "mountain"), perm(0, "blood_artist"), perm(1, "grizzly_bears")],
      },
    });
    setup(c);
    c.start();
    let cast = false;
    for (let guard = 0; guard < 5000; guard++) {
      await tick();
      const p = c.phase;
      const st = c.game.state;
      if (st.players[1].graveyard.some((id) => st.objects[id]?.cardId === "grizzly_bears") && (p.kind !== "waiting")) {
        if (p.kind === "targeting" || c.game.state.players[1].life < 20) break;
      }
      if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); continue; }
      if (p.kind === "confirmCast") { c.confirmCast(); continue; }
      if (p.kind === "targeting" && p.sourceObjectId !== "") { c.clickBattlefield(st.battlefield.find((id) => st.objects[id]!.cardId === "grizzly_bears")!); continue; }
      if (p.kind === "targeting") break;
      if (p.kind === "priority" && !cast && p.castable.size > 0) { cast = true; c.clickHand([...p.castable.keys()][0]!); continue; }
      if (p.kind === "priority") { c.pass(); continue; }
      if (p.kind === "stackStop") { c.continueFromStop(); continue; }
      if (p.kind === "attackers") { c.confirmAttackers(); continue; }
    }
    return c;
  }

  it("on (the default): the trigger never asks — the opponent loses 1, you gain 1", async () => {
    const c = await boltTheBears(() => {});
    expect(c.phase.kind).not.toBe("targeting");
    expect(c.game.state.players[1].life).toBe(19);
    expect(c.game.state.players[0].life).toBe(21);
  });

  it("off: the trigger asks, both players offered", async () => {
    const c = await boltTheBears((c) => { c.autoAimDrains = false; });
    expect(c.phase.kind).toBe("targeting");
    expect(c.phase.kind === "targeting" && [...c.phase.highlightPlayers].sort()).toEqual([0, 1]);
  });
});
