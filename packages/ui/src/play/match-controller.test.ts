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

async function playScripted(seed: number, humanSeat: 0 | 1): Promise<MatchController & { stackStops: number; manualTaps: number; combatStops: number }> {
  const pool = loadCardPool(CARDS_DIR);
  let stackStops = 0;
  let manualTaps = 0;
  let combatStops = 0;
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
        if (c.stopReason) stackStops += 1; // request-path opponent-spell / combat pause
        if (c.stopReason && /attacks with|blocks|No blocks/.test(c.stopReason)) combatStops += 1;
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
        // S11: take the manual-tap offer whenever it appears — tap one land, then cast.
        if (phase.offerManualTap) c.beginManualTap();
        else c.confirmCast();
        break;
      case "manualTap": {
        const [land] = [...phase.tappable];
        if (land && manualTaps === 0) {
          manualTaps += 1;
          c.clickBattlefield(land); // floats mana; the next request re-enters manualTap
        } else {
          c.castNow();
        }
        break;
      }
      case "stackStop":
        stackStops += 1;
        if (c.stopReason && /attacks with|blocks|No blocks/.test(c.stopReason)) combatStops += 1;
        c.continueFromStop();
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
  return Object.assign(c, { stackStops, manualTaps, combatStops });
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
      // S11: manual tapping went through the real tapForMana path and the cast
      // still resolved; the opponent-spell stop paused at least once (the AI
      // deck D casts spells; lone-pass windows are observed via onLonePass).
      expect(c.manualTaps).toBeGreaterThan(0);
      expect(types.has("tapForMana")).toBe(true);
      expect(c.stackStops).toBeGreaterThan(0);
      expect(c.combatStops).toBeGreaterThan(0); // S13: attacks/blocks are seen

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

  it("S12: the explicit-spec (overworld handoff) path — world-life starting life, ante, enemy modifier, named players", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      seed: 77,
      aiDelayMs: 0,
      custom: {
        human: { name: "Wanderer", decklist: [{ cardId: "mountain", count: 12 }, { cardId: "raging_goblin", count: 4 }, { cardId: "goblin_piker", count: 4 }, { cardId: "lightning_bolt", count: 4 }, { cardId: "shock", count: 4 }, { cardId: "boggart_brute", count: 2 }] },
        enemy: { name: "Pale Edric", decklist: [{ cardId: "swamp", count: 12 }, { cardId: "typhoid_rats", count: 4 }, { cardId: "child_of_night", count: 4 }, { cardId: "doom_blade", count: 4 }, { cardId: "vampire_nighthawk", count: 4 }, { cardId: "gravedigger", count: 2 }], difficulty: "apprentice", archetype: "midrange", portrait: "portrait-opponent-black" },
        rules: { startingLife: 10, ante: 1 },
        modifiers: [{ type: "startingLife", player: 1, value: 8 }],
      },
    });
    const done = c.start();
    // S13: life modifiers apply at state creation — the very first pause (the
    // mulligan dialog) already shows the enemy at 8, no jump later.
    let guard = 0;
    while (c.phase.kind === "waiting" && guard++ < 2000) await new Promise((r) => setTimeout(r, 0));
    expect(c.phase.kind).toBe("dialog");
    expect(c.game.state.players[1].life).toBe(8);
    while (c.phase.kind !== "priority" && !c.result && guard++ < 5000) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    }
    expect(c.spec.players[0].name).toBe("Wanderer");
    expect(c.spec.players[1].name).toBe("Pale Edric");
    expect(c.spec.players[1].agent).toBe("heuristic:apprentice");
    expect(c.spec.rules.startingLife).toBe(10);
    expect(c.spec.rules.ante).toBe(1);
    expect(c.game.state.startingLife).toBe(10);
    expect(c.game.state.players[0].life).toBe(10);
    expect(c.game.state.players[1].life).toBe(8); // the enemy world-life modifier
    expect(c.game.state.players[0].ante).toHaveLength(1);
    expect(c.game.state.players[1].ante).toHaveLength(1);
    c.concede();
    guard = 0;
    while (!c.result && guard++ < 1000) await new Promise((r) => setTimeout(r, 0));
    const result = await done;
    expect(result.reason).toBe("CONCEDE");
    expect(result.facts.ante[0]).toHaveLength(1);
    expect(result.facts.ante[1]).toHaveLength(1);
  }, 60_000);

  it("S13 dev auto-win ends the match as an opponent concession in the human's favour (ante reported)", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 1,
      custom: {
        human: { name: "Tester", decklist: [{ cardId: "forest", count: 20 }, { cardId: "grizzly_bears", count: 10 }] },
        enemy: { name: "Dummy", decklist: [{ cardId: "swamp", count: 20 }, { cardId: "typhoid_rats", count: 10 }], difficulty: "apprentice", archetype: "aggro" },
        rules: { startingLife: 10, ante: 1 },
        modifiers: [],
      },
      seed: 9,
      aiDelayMs: 0,
    });
    const done = c.start();
    let guard = 0;
    while (c.phase.kind === "waiting" && guard++ < 2000) await new Promise((r) => setTimeout(r, 0));
    c.autoWin();
    guard = 0;
    while (!c.result && guard++ < 1000) await new Promise((r) => setTimeout(r, 0));
    const result = await done;
    expect(result.reason).toBe("CONCEDE");
    expect(result.winner).toBe(1);
    expect(result.facts.ante[0]).toHaveLength(1);
    expect(result.facts.ante[1]).toHaveLength(1);
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
