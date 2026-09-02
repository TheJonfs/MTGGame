import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayToDecision } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";
import { DECKS } from "@shandalar/sim/decks";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");

/**
 * S10 DoD 1 (automated half): a scripted "human" drives the SAME event path
 * the UI's clicks drive — clickHand / clickBattlefield / confirm / dialogs —
 * through complete games against the journeyman AI. This is the play-mode
 * acceptance floor; Chris's real match is the other half.
 */

async function playScripted(seed: number, humanSeat: 0 | 1, humanDeck: "A" | "C" | "D" = "A"): Promise<MatchController & { stackStops: number; manualTaps: number; combatStops: number; searches: number }> {
  const pool = loadCardPool(CARDS_DIR);
  let stackStops = 0;
  let manualTaps = 0;
  let combatStops = 0;
  let searches = 0;
  const c = new MatchController(pool.cards, {
    humanSeat,
    humanDeck,
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
        // S15: take the first matching card when searching (dialog path), else the safe default.
        if (phase.request.purpose === "searchLibrary" && phase.request.actions.length > 1) { searches += 1; c.selectDialog(1); }
        else c.selectDialog(0);
        c.confirmDialog();
        break;
      }
      case "chooseColor":
        c.chooseColor("W");
        break;
    }
  }
  await done;
  return Object.assign(c, { stackStops, manualTaps, combatStops, searches });
}

describe("play-mode acceptance (headless; S10 DoD 1)", () => {
  it("a scripted human plays complete games vs journeyman through the UI event path, both seats (S15: Growth/Tutor decks; searches through the dialog)", async () => {
    let searchActions = 0;
    for (const [seed, seat, deck] of [
      [11, 0, "C"],
      [12, 1, "D"],
    ] as const) {
      const c = await playScripted(seed, seat, deck);
      searchActions += c.result!.log.filter((e) => e.t === "ACTION" && e.player === seat && ["searchPick", "declineSearch"].includes((e as { action: { type: string } }).action.type)).length;
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
    expect(searchActions).toBeGreaterThan(0); // a Growth/Tutor resolved through the dialog path in at least one game
  }, 120_000);

  it("S15 Lotus line through the play client: cast Lotus, activate → chooseColor → confirm → three mana floating, Lotus in the graveyard", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      seed: 3,
      aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "black_lotus", count: 40 }] },
        enemy: { name: "D", decklist: [...DECKS.D.decklist], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0 },
        modifiers: [],
      },
    });
    c.start();
    let guard = 0;
    while (c.phase.kind !== "priority" && guard++ < 5000) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    }
    const lotusInHand = [...(c.phase as { castable: Map<string, unknown> }).castable.keys()][0]!;
    c.clickHand(lotusInHand);
    if (c.phase.kind === "confirmCast") c.confirmCast();
    guard = 0;
    while (c.phase.kind !== "priority" && guard++ < 5000) await new Promise((r) => setTimeout(r, 0));
    const onBf = c.game.state.battlefield.find((id) => c.game.state.objects[id]!.cardId === "black_lotus")!;
    expect(onBf).toBeTruthy();
    expect((c.phase as { activatable: Map<string, unknown> }).activatable.has(onBf)).toBe(true);
    c.clickBattlefield(onBf);
    expect(c.phase.kind).toBe("chooseColor");
    c.chooseColor("U");
    expect(c.phase.kind).toBe("confirmCast");
    c.confirmCast();
    guard = 0;
    while (c.phase.kind !== "priority" && guard++ < 5000) await new Promise((r) => setTimeout(r, 0));
    expect(c.game.state.players[0].manaPool.U).toBe(3);
    expect(c.game.state.players[0].graveyard.some((id) => c.game.state.objects[id]!.cardId === "black_lotus")).toBe(true);
    c.concede();
    guard = 0;
    while (!c.result && guard++ < 2000) await new Promise((r) => setTimeout(r, 0));
  }, 60_000);

  it("S26 (the S25 r4 watch item, verified live): a cycling LAND with the drop open and mana up offers the play-or-cycle chooser; 'activate' cycles it, 'cast' plays it", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      seed: 5,
      aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "forgotten_cave", count: 40 }] },
        enemy: { name: "D", decklist: [...DECKS.D.decklist], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        modifiers: [{ type: "permanentOnBattlefield", player: 0, cardId: "mountain" }], // the {R} for cycling
      },
    });
    c.start();
    let guard = 0;
    const untilPriority = async () => { guard = 0; while (c.phase.kind !== "priority" && guard++ < 5000) { await new Promise((r) => setTimeout(r, 0)); if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); } } };
    await untilPriority();
    // Skip to MAIN1 (upkeep/draw windows are meaningful because the Cave can cycle there — where only cycling is legal, the click goes straight to it).
    while (c.phase.kind === "priority" && c.game.state.step !== "MAIN1" && guard++ < 50) { c.pass(); await untilPriority(); }
    expect(c.game.state.step).toBe("MAIN1");
    const cave = [...(c.phase as { lands: Map<string, unknown> }).lands.keys()][0]!;
    expect((c.phase as { activatable: Map<string, unknown> }).activatable.has(cave)).toBe(true);
    c.clickHand(cave);
    expect(c.phase.kind).toBe("castOrActivate");
    c.chooseCastOrActivate("activate");
    if (c.phase.kind === "confirmCast") c.confirmCast();
    if ((c.phase as { kind: string }).kind === "manualTap") (c as unknown as { castNow(): void }).castNow();
    await untilPriority();
    expect(c.game.state.players[0].graveyard.some((id) => c.game.state.objects[id]!.cardId === "forgotten_cave")).toBe(true); // cycled
    expect(c.game.state.battlefield.filter((id) => c.game.state.objects[id]!.cardId === "forgotten_cave")).toHaveLength(0);
    // The next Cave: the drop is still open but the Mountain is tapped — only the play is legal → straight to the battlefield.
    const cave2 = [...(c.phase as { lands: Map<string, unknown> }).lands.keys()][0]!;
    c.clickHand(cave2);
    await untilPriority();
    expect(c.game.state.battlefield.filter((id) => c.game.state.objects[id]!.cardId === "forgotten_cave")).toHaveLength(1);
    c.concede();
    guard = 0;
    while (!c.result && guard++ < 2000) await new Promise((r) => setTimeout(r, 0));
  }, 60_000);

  it("S26 r3 (Chris): a trigger's up-to-two targets (the Warden) are picked on the board successively — none, one, or two — with Done and Cancel, never a combination list", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const c = new MatchController(pool.cards, {
      humanSeat: 0,
      seed: 7,
      aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "the_warden", count: 40 }] },
        enemy: { name: "D", decklist: [...DECKS.D.decklist], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        modifiers: [
          { type: "permanentOnBattlefield" as const, player: 0 as const, cardId: "the_warden" },
          { type: "permanentOnBattlefield" as const, player: 1 as const, cardId: "grizzly_bears" },
          { type: "permanentOnBattlefield" as const, player: 1 as const, cardId: "centaur_courser" },
        ],
      },
    });
    c.start();
    let guard = 0;
    const until = async (kind: string) => { guard = 0; while (c.phase.kind !== kind && guard++ < 5000) { await new Promise((r) => setTimeout(r, 0)); if (c.phase.kind === "dialog" && kind !== "dialog") { c.selectDialog(0); c.confirmDialog(); } else if (c.phase.kind === "priority" && kind !== "priority") c.pass(); else if (c.phase.kind === "attackers" && kind !== "attackers") c.confirmAttackers(); else if (c.phase.kind === "blockers" && kind !== "blockers") c.confirmBlocks(); } };
    // The Warden's "tap up to two target creatures" triggers on ATTACK: reach our declare-attackers
    // step with him eligible (turn 3 — he is summoning sick on turn 1), declare him, confirm.
    for (let t = 0; t < 4; t++) {
      await until("attackers");
      if (c.phase.kind === "attackers" && [...c.phase.eligible].some((id) => c.game.state.objects[id]!.cardId === "the_warden")) break;
      if (c.phase.kind === "attackers") c.confirmAttackers();
    }
    expect(c.phase.kind).toBe("attackers");
    const warden = [...(c.phase as { eligible: Set<string> }).eligible].find((id) => c.game.state.objects[id]!.cardId === "the_warden")!;
    c.clickBattlefield(warden);
    c.confirmAttackers();
    // The attack trigger's chooseTarget request arrives as a BOARD targeting phase, not a dialog.
    await until("targeting");
    expect(c.phase.kind).toBe("targeting");
    if (c.phase.kind !== "targeting") return;
    expect(c.phase.fromRequest).toBe(true);
    expect(c.phase.targetsNeeded).toBe(2);
    expect(c.phase.canFinish).toBe(true); // "no targets" is a legal commit
    expect(c.phase.highlightObjects.size).toBeGreaterThanOrEqual(2);
    // Cancel restarts the pick; then choose one, finish with one, confirm.
    c.cancel();
    await until("targeting");
    const [first] = [...(c.phase as { highlightObjects: Set<string> }).highlightObjects].filter((id) => c.game.state.objects[id]!.cardId === "grizzly_bears");
    c.clickBattlefield(first!);
    expect(c.phase.kind).toBe("targeting");
    expect((c.phase as { canFinish: boolean }).canFinish).toBe(true);
    c.finishTargeting();
    expect(c.phase.kind).toBe("confirmCast");
    c.confirmCast();
    await until("priority");
    expect(c.game.state.objects[first!]!.tapped).toBe(true);
    const courser = c.game.state.battlefield.find((id) => c.game.state.objects[id]!.cardId === "centaur_courser")!;
    expect(c.game.state.objects[courser]!.tapped).toBe(false); // only the one we chose
    c.concede();
    guard = 0;
    while (!c.result && guard++ < 2000) await new Promise((r) => setTimeout(r, 0));
  }, 60_000);

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

/** S18 Part 5: the three S17 request purposes reach the play client as dialogs with the context the
 * dedicated UI needs (source + actions; the A7 sacrifice also has `lastCast` = the staged cast). */
async function driveTo(c: MatchController, stop: (phase: MatchController["phase"]) => boolean, preferCast: string[], guardMax = 6000): Promise<boolean> {
  let guard = 0;
  while (!c.result && guard++ < guardMax) {
    await new Promise((r) => setTimeout(r, 0));
    const phase = c.phase;
    if (stop(phase)) return true;
    switch (phase.kind) {
      case "priority": {
        const cardOf = (id: string) => c.game.state.objects[id]!.cardId;
        const want = [...phase.castable.keys()].find((id) => preferCast.includes(cardOf(id))) ?? [...phase.activatable.keys()].find((id) => preferCast.includes(cardOf(id)));
        if (phase.lands.size > 0) c.clickHand([...phase.lands.keys()][0]!);
        else if (want && phase.castable.has(want)) c.clickHand(want);
        else if (want) c.clickBattlefield(want);
        else c.pass();
        break;
      }
      case "chooseX": c.chooseX(phase.xs[phase.xs.length - 1]!); break;
      case "targeting": {
        // Prefer the opponent (player 1 from seat 0) for a Grenade; a creature of theirs for a bounce.
        const theirs = [...phase.highlightObjects].find((id) => c.game.state.objects[id]!.controller === 1);
        if (phase.highlightPlayers.has(1)) c.clickPlayer(1);
        else if (theirs) c.clickBattlefield(theirs);
        else if (phase.highlightObjects.size > 0) c.clickBattlefield([...phase.highlightObjects][0]!);
        else c.clickPlayer([...phase.highlightPlayers][0]!);
        break;
      }
      case "confirmCast": c.confirmCast(); break;
      case "manualTap": c.castNow(); break;
      case "stackStop": c.continueFromStop(); break;
      case "attackers": c.confirmAttackers(); break;
      case "blockers": c.confirmBlocks(); break;
      case "dialog": c.selectDialog(0); c.confirmDialog(); break;
      case "chooseColor": c.chooseColor("U"); break;
      default: break;
    }
  }
  return false;
}

function customMatch(pool: Map<string, import("@shandalar/cards").CardDef>, seed: number, decklist: { cardId: string; count: number }[]) {
  return new MatchController(pool, {
    humanSeat: 0, seed, aiDelayMs: 0,
    custom: { human: { name: "You", decklist }, enemy: { name: "C", decklist: [...DECKS.C.decklist], difficulty: "apprentice", archetype: "midrange" }, rules: { startingLife: 20, ante: 0 }, modifiers: [] },
  });
}

describe("S18 Part 5: dedicated dialogs for chooseMode / discardCost / A7 sacrifice (controller half)", () => {
  it("Aether Channeler's ETB reaches the client as a chooseMode dialog (labels; the bounce mode only when another nonland permanent exists); confirming picks that mode", async () => {
    const pool = loadCardPool(CARDS_DIR);
    let seen = false;
    for (let seed = 1; seed <= 12 && !seen; seed++) {
      const c = customMatch(pool.cards, seed, [{ cardId: "island", count: 22 }, { cardId: "aether_channeler", count: 18 }]);
      c.start();
      const hit = await driveTo(c, (p) => p.kind === "dialog" && p.request.purpose === "chooseMode", ["aether_channeler"]);
      if (!hit) { c.concede(); await new Promise((r) => setTimeout(r, 5)); continue; }
      seen = true;
      const phase = c.phase as Extract<MatchController["phase"], { kind: "dialog" }>;
      expect(phase.request.source?.cardId).toBe("aether_channeler");
      const labels = phase.request.actions.map((a) => (a.type === "chooseMode" ? a.label : ""));
      expect(labels.some((l) => /Bird/.test(l))).toBe(true);
      expect(labels.some((l) => /Draw a card/.test(l))).toBe(true);
      // With only Islands + the Channeler itself out, "another nonland permanent" has no legal target → that mode is absent.
      const others = c.game.state.battlefield.filter((id) => c.game.state.objects[id]!.controller === 0 && !c.game.state.objects[id]!.cardId.includes("island") && c.game.state.objects[id]!.cardId !== "aether_channeler");
      if (others.length === 0) expect(labels.some((l) => /Return/.test(l))).toBe(false);
      const draw = phase.request.actions.findIndex((a) => a.type === "chooseMode" && /Draw/.test(a.label));
      const handBefore = c.game.state.players[0].hand.length;
      c.selectDialog(draw); c.confirmDialog();
      await driveTo(c, (p) => p.kind === "priority" && c.game.state.stack.length === 0, [], 2000);
      expect(c.game.state.players[0].hand.length).toBeGreaterThanOrEqual(handBefore + 1); // the draw mode resolved (a turn draw may add one more)
      c.concede(); await new Promise((r) => setTimeout(r, 5));
    }
    expect(seen).toBe(true);
  }, 60_000);

  it("Waterfront Bouncer's activation asks for the discard as a discardCost dialog over distinct hand cards (source = the Bouncer)", async () => {
    const pool = loadCardPool(CARDS_DIR);
    let seen = false;
    for (let seed = 1; seed <= 12 && !seen; seed++) {
      const c = customMatch(pool.cards, seed, [{ cardId: "island", count: 20 }, { cardId: "waterfront_bouncer", count: 12 }, { cardId: "wind_drake", count: 8 }]);
      c.start();
      const hit = await driveTo(c, (p) => p.kind === "dialog" && p.request.purpose === "discardCost", ["waterfront_bouncer"]);
      if (!hit) { c.concede(); await new Promise((r) => setTimeout(r, 5)); continue; }
      seen = true;
      const phase = c.phase as Extract<MatchController["phase"], { kind: "dialog" }>;
      expect(phase.request.source?.cardId).toBe("waterfront_bouncer");
      expect(phase.request.actions.length).toBeGreaterThanOrEqual(2);
      for (const a of phase.request.actions) expect(a.type).toBe("discard");
      c.selectDialog(0); c.confirmDialog();
      await driveTo(c, (p) => p.kind === "priority", [], 2000);
      c.concede(); await new Promise((r) => setTimeout(r, 5));
    }
    expect(seen).toBe(true);
  }, 60_000);

  it("Goblin Grenade: targets are staged at cast, then the A7 sacrifice arrives as a chooseSacrifice dialog with the Grenade as source and lastCast = the staged cast (targets visible to the dialog)", async () => {
    const pool = loadCardPool(CARDS_DIR);
    let seen = false;
    for (let seed = 1; seed <= 16 && !seen; seed++) {
      const c = customMatch(pool.cards, seed, [{ cardId: "mountain", count: 18 }, { cardId: "raging_goblin", count: 12 }, { cardId: "goblin_grenade", count: 10 }]);
      c.start();
      const hit = await driveTo(c, (p) => p.kind === "dialog" && p.request.purpose === "chooseSacrifice" && !!p.request.source, ["raging_goblin", "goblin_grenade"]);
      if (!hit) { c.concede(); await new Promise((r) => setTimeout(r, 5)); continue; }
      seen = true;
      const phase = c.phase as Extract<MatchController["phase"], { kind: "dialog" }>;
      expect(phase.request.source?.cardId).toBe("goblin_grenade");
      expect(c.lastCast?.type).toBe("castSpell");
      if (c.lastCast?.type === "castSpell") {
        expect(c.game.state.objects[c.lastCast.objectId]?.cardId).toBe("goblin_grenade");
        expect(c.lastCast.targets).toHaveLength(1);
      }
      expect(phase.request.actions.length).toBeGreaterThanOrEqual(2); // a dialog only when there is a real choice of Goblins
      for (const a of phase.request.actions) expect(a.type).toBe("sacrifice");
      c.selectDialog(0); c.confirmDialog();
      await driveTo(c, (p) => p.kind === "priority", [], 2000);
      c.concede(); await new Promise((r) => setTimeout(r, 5));
    }
    expect(seen).toBe(true);
  }, 90_000);
});
