import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayToDecision } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");

/**
 * S10 DoD 1 (automated half): a scripted "human" drives the SAME event path
 * the UI's clicks drive — clickHand / clickBattlefield / confirm / dialogs —
 * through complete games against the journeyman AI. This is the play-mode
 * acceptance floor; Chris's real match is the other half.
 */

async function playScripted(seed: number, humanSeat: 0 | 1): Promise<MatchController> {
  const pool = loadCardPool(CARDS_DIR);
  const c = new MatchController(pool.cards, {
    humanSeat,
    humanDeck: "A",
    aiDeck: "D",
    difficulty: "journeyman",
    seed,
    aiDelayMs: 0,
  });
  const done = c.start();
  let guard = 0;
  while (!c.result) {
    if (guard++ > 20000) throw new Error(`scripted driver stuck in phase ${c.phase.kind}`);
    await new Promise((r) => setTimeout(r, 0));
    const phase = c.phase;
    switch (phase.kind) {
      case "waiting":
      case "gameOver":
        break;
      case "priority": {
        if (phase.lands.size > 0) c.clickHand([...phase.lands.keys()][0]!);
        else if (phase.castable.size > 0) c.clickHand([...phase.castable.keys()][0]!);
        else if (phase.activatable.size > 0) c.clickBattlefield([...phase.activatable.keys()][0]!);
        else c.pass();
        break;
      }
      case "chooseX":
        c.chooseX(phase.xs[phase.xs.length - 1]!);
        break;
      case "targeting": {
        if (phase.highlightObjects.size > 0) c.clickBattlefield([...phase.highlightObjects][0]!);
        else if (phase.highlightPlayers.size > 0) c.clickPlayer([...phase.highlightPlayers][0]!);
        else throw new Error("targeting with no highlights");
        break;
      }
      case "confirmCast":
        c.confirmCast();
        break;
      case "attackers": {
        for (const id of phase.eligible) c.clickBattlefield(id);
        c.confirmAttackers();
        break;
      }
      case "blockers": {
        const [blocker] = [...phase.options.keys()];
        if (blocker && phase.stagedPairs.length === 0) {
          c.clickBattlefield(blocker);
          const attacker = [...phase.options.get(blocker)!][0]!;
          c.clickBattlefield(attacker);
        }
        c.confirmBlocks();
        break;
      }
      case "dialog": {
        c.selectDialog(0);
        c.confirmDialog();
        break;
      }
    }
  }
  await done;
  return c;
}

describe("play-mode acceptance (headless; S10 DoD 1)", () => {
  it("a scripted human plays complete games vs journeyman through the UI event path, both seats", async () => {
    for (const [seed, seat] of [
      [11, 0],
      [12, 1],
    ] as const) {
      const c = await playScripted(seed, seat);
      const result = c.result!;
      expect(["LIFE", "DECKED", "MAX_TURNS", "DRAW"]).toContain(result.reason);
      expect(result.turns).toBeGreaterThan(3);

      // The human seat actually did things through the click path:
      const humanActions = result.log.filter((e) => e.t === "ACTION" && e.player === seat);
      const types = new Set(humanActions.map((e) => (e as { action: { type: string } }).action.type));
      expect(types.has("playLand")).toBe(true);
      expect(types.has("castSpell") || types.has("activateAbility")).toBe(true);

      // The produced log is a first-class saved game: the viewer can replay it.
      const saved = JSON.parse(c.savedGame()) as {
        format: string;
        spec: { players: { decklist: { cardId: string; count: number }[] }[] };
        log: never[];
      };
      expect(saved.format).toBe("shandalar-log-v1");
      const decklists: [string[], string[]] = [
        expandDecklist(saved.spec.players[0]!.decklist),
        expandDecklist(saved.spec.players[1]!.decklist),
      ];
      const pool = loadCardPool(CARDS_DIR);
      const mid = Math.floor(result.log.filter((e) => e.t === "ACTION").length / 2);
      const point = await replayToDecision(pool.cards, decklists, saved.log, mid);
      expect(point.state.turn).toBeGreaterThan(0);
    }
  }, 120_000);

  it("ADR-059 meaningfulness: X=0-only casts do not make a window meaningful", () => {
    const cast = (x?: number) => ({ type: "castSpell", objectId: "h1", ...(x !== undefined ? { x } : {}) }) as never;
    const none = new Map();
    // Blaze affordable only at X=0: not meaningful.
    expect(MatchController.isMeaningful(new Map([["h1", [cast(0)]]]), none, none)).toBe(false);
    // X=1 also enumerated: meaningful.
    expect(MatchController.isMeaningful(new Map([["h1", [cast(0), cast(1)]]]), none, none)).toBe(true);
    // Non-X spell (no x on the action): meaningful.
    expect(MatchController.isMeaningful(new Map([["h1", [cast()]]]), none, none)).toBe(true);
    // A land or an activation is always meaningful.
    expect(MatchController.isMeaningful(none, new Map([["l1", { type: "playLand", objectId: "l1" } as never]]), none)).toBe(true);
    expect(MatchController.isMeaningful(none, none, new Map([["b1", [{ type: "activateAbility" } as never]]]))).toBe(true);
  });

  it("fast-forward passes every window until the human's next turn or a decision that needs them", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      humanDeck: "A",
      aiDeck: "D",
      difficulty: "journeyman",
      seed: 21,
      aiDelayMs: 0,
    });
    c.start();
    // Reach the first own-turn pause (the MAIN1 anchor).
    let guard = 0;
    while (c.phase.kind !== "priority" && guard++ < 5000) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    }
    expect(c.phase.kind).toBe("priority");
    const armedTurn = c.game.state.turn;
    expect(c.game.state.activePlayer).toBe(0);

    c.fastForwardToMyTurn();
    expect(c.fastForwarding).toBe(true);

    // Record every pause until the next one that isn't "waiting".
    guard = 0;
    while (c.phase.kind === "waiting" && !c.result && guard++ < 10000) {
      await new Promise((r) => setTimeout(r, 0));
    }
    // FF has disarmed by the time anything pauses again…
    expect(c.fastForwarding).toBe(false);
    if (c.phase.kind === "priority") {
      // …and a priority pause only happens back on the human's own next turn.
      expect(c.game.state.activePlayer).toBe(0);
      expect(c.game.state.turn).toBeGreaterThan(armedTurn);
    } else {
      // Otherwise the game genuinely needed the human (block, discard, …).
      expect(["blockers", "dialog", "attackers", "gameOver"]).toContain(c.phase.kind);
    }
    c.concede();
    let drain = 0;
    while (!c.result && drain++ < 1000) await new Promise((r) => setTimeout(r, 0));
  }, 60_000);

  it("concession ends the match with a CONCEDE result and a replayable partial log", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      humanDeck: "B",
      aiDeck: "C",
      difficulty: "journeyman",
      seed: 5,
      aiDelayMs: 0,
    });
    const done = c.start();
    // Let the game reach the first human pause, then concede.
    let guard = 0;
    while (c.phase.kind === "waiting" && guard++ < 1000) await new Promise((r) => setTimeout(r, 0));
    c.concede();
    // Drain any interleaved requests until the engine unwinds.
    guard = 0;
    while (!c.result && guard++ < 1000) await new Promise((r) => setTimeout(r, 0));
    const result = await done;
    expect(result.reason).toBe("CONCEDE");
    expect(result.winner).toBe(1);
  }, 60_000);
});
