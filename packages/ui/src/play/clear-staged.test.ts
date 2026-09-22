import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { MatchController } from "./match-controller.js";
import type { Modifier } from "@shandalar/engine";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S43 (Chris's report: "I'm not sure Clear cancels an attacker"). The click path, end to end: stage an attacker,
 * Clear, Confirm — nothing is declared and the creature stays untapped; stage a block, Clear, Confirm — nothing is
 * declared and combat damage lands on the player. And a staged creature clicked again un-stages itself.
 */
describe("Clear on the declare-attackers and declare-blockers bars (post-S43, Chris's report)", () => {
  it("attackers: stage → Clear → Confirm (0) declares no attacker; stage → click again un-stages; stage → Confirm attacks", async () => {
    const c = new MatchController(pool, {
      humanSeat: 0, seed: 11, aiDelayMs: 0,
      custom: {
        human: { name: "me", decklist: [{ cardId: "grizzly_bears", count: 20 }, { cardId: "forest", count: 20 }] },
        enemy: { name: "ai", decklist: [{ cardId: "wall_of_blossoms", count: 20 }, { cardId: "forest", count: 20 }], difficulty: "journeyman", archetype: "control" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        modifiers: [perm(0, "grizzly_bears"), perm(0, "grizzly_bears"), perm(1, "wall_of_blossoms")],
      },
    });
    const done = c.start();
    const st = () => c.game.state;
    let attackWindows = 0, guard = 0;
    const declared: number[] = [];
    while (!c.result && guard++ < 3000 && attackWindows < 3) {
      await new Promise((r) => setTimeout(r, 0));
      const phase = c.phase;
      switch (phase.kind) {
        case "priority": c.pass(); break;
        case "stackStop": c.continueFromStop(); break;
        case "attackers": {
          attackWindows += 1;
          const [a] = [...phase.eligible];
          expect(a).toBeTruthy();
          if (attackWindows === 1) {
            // Stage, Clear, Confirm: the log must show NO declareAttacker this turn and the bear stays untapped.
            c.clickBattlefield(a!);
            expect(c.phase.kind === "attackers" && c.phase.staged.has(a!)).toBe(true);
            c.clearStaged();
            expect(c.phase.kind === "attackers" && c.phase.staged.size).toBe(0);
            c.confirmAttackers();
          } else if (attackWindows === 2) {
            // Stage, click again (un-stage), Confirm: nothing declared.
            c.clickBattlefield(a!);
            c.clickBattlefield(a!);
            expect(c.phase.kind === "attackers" && c.phase.staged.size).toBe(0);
            c.confirmAttackers();
          } else {
            c.clickBattlefield(a!);
            c.confirmAttackers();
          }
          const turn = st().turn;
          for (let i = 0; i < 50 && c.phase.kind === "waiting"; i++) await new Promise((r) => setTimeout(r, 0));
          declared.push((c.game.ctx.log as unknown as { entries: { t: string; turn: number; action: { type: string } }[] }).entries.filter((e) => e.t === "ACTION" && e.turn === turn && e.action.type === "declareAttacker").length);
          break;
        }
        case "blockers": c.confirmBlocks(); break;
        case "dialog": c.selectDialog(0); c.confirmDialog(); break;
        case "confirmCast": c.confirmCast(); break;
        default: break;
      }
    }
    c.concede();
    await done;
    expect(attackWindows).toBe(3);
    expect(declared).toEqual([0, 0, 1]);
  }, 60_000);

  it("blockers: stage a block → Clear → Confirm (0) declares no block and the attacker's damage lands; stage → Confirm blocks", async () => {
    const c = new MatchController(pool, {
      humanSeat: 0, seed: 12, aiDelayMs: 0,
      custom: {
        human: { name: "me", decklist: [{ cardId: "grizzly_bears", count: 20 }, { cardId: "forest", count: 20 }] },
        enemy: { name: "ai", decklist: [{ cardId: "rumbling_baloth", count: 20 }, { cardId: "forest", count: 20 }], difficulty: "journeyman", archetype: "aggro" },
        rules: { startingLife: 30, ante: 0, startingPlayer: 1 },
        modifiers: [perm(0, "grizzly_bears"), perm(0, "grizzly_bears"), perm(1, "rumbling_baloth"), { type: "startingLife", player: 1, value: 40 }],
      },
    });
    const done = c.start();
    let blockWindows = 0, guard = 0;
    const declared: number[] = [];
    const lifeBefore: number[] = [], lifeAfter: number[] = [];
    while (!c.result && guard++ < 4000 && blockWindows < 2) {
      await new Promise((r) => setTimeout(r, 0));
      const phase = c.phase;
      switch (phase.kind) {
        case "priority": c.pass(); break;
        case "stackStop": c.continueFromStop(); break;
        case "attackers": c.confirmAttackers(); break; // never attack: the bears stay home to block
        case "blockers": {
          blockWindows += 1;
          const [blocker] = [...phase.options.keys()];
          const attacker = blocker ? [...phase.options.get(blocker)!][0] : undefined;
          expect(blocker && attacker).toBeTruthy();
          lifeBefore.push(c.game.state.players[0].life);
          c.clickBattlefield(blocker!);
          c.clickBattlefield(attacker!);
          expect(c.phase.kind === "blockers" && c.phase.stagedPairs.length).toBe(1);
          if (blockWindows === 1) {
            c.clearStaged();
            expect(c.phase.kind === "blockers" && c.phase.stagedPairs.length).toBe(0);
            expect(c.phase.kind === "blockers" && c.phase.pendingBlocker).toBeNull();
          }
          const turn = c.game.state.turn;
          c.confirmBlocks();
          for (let i = 0; i < 50 && c.phase.kind === "waiting"; i++) await new Promise((r) => setTimeout(r, 0));
          declared.push((c.game.ctx.log as unknown as { entries: { t: string; turn: number; action: { type: string } }[] }).entries.filter((e) => e.t === "ACTION" && e.turn === turn && e.action.type === "declareBlocker").length);
          // Let the damage step pass, then read the life.
          for (let i = 0; i < 400 && c.game.state.turn === turn && c.game.state.step !== "END"; i++) {
            await new Promise((r) => setTimeout(r, 0));
            const p = c.phase;
            if (p.kind === "priority") c.pass(); else if (p.kind === "stackStop") c.continueFromStop(); else if (p.kind === "blockers") c.confirmBlocks(); else if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
          }
          lifeAfter.push(c.game.state.players[0].life);
          break;
        }
        case "dialog": c.selectDialog(0); c.confirmDialog(); break;
        case "confirmCast": c.confirmCast(); break;
        default: break;
      }
    }
    c.concede();
    await done;
    expect(blockWindows).toBe(2);
    expect(declared).toEqual([0, 1]);
    expect(lifeAfter[0]).toBe(lifeBefore[0]! - 4); // the Baloth unblocked after Clear: 4 damage
    expect(lifeAfter[1]).toBe(lifeBefore[1]); // blocked: none
  }, 60_000);
});
