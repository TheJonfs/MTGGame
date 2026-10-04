import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayToDecision, type MatchSpec } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;

/** Post-S53 (Chris: an AI decision worth replaying, mid-Convocation): the match's "save this game's log" — a snapshot
 * of the game so far — replays to the very board on screen, with the AI on the play (the Convocation's coin). */
describe("a mid-game log snapshot replays (post-S53)", () => {
  it("the snapshot's spec and log rebuild the live board, turn and life — the AI on the play", async () => {
    const deck = [{ cardId: "grizzly_bears", count: 16 }, { cardId: "forest", count: 24 }];
    const c = new MatchController(pool, { humanSeat: 0, seed: 23, aiDelayMs: 0, custom: { human: { name: "me", decklist: deck }, enemy: { name: "ai", decklist: deck, difficulty: "master", archetype: "midrange" }, rules: { startingLife: 20, ante: 0, startingPlayer: 1 }, modifiers: [] } });
    void c.start();
    for (let g = 0; g < 3000 && c.game.state.turn < 7; g++) {
      await new Promise((r) => setTimeout(r, 0));
      const p = c.phase;
      if (p.kind === "priority") { if (p.lands.size) c.clickHand([...p.lands.keys()][0]!); else if (p.castable.size) c.clickHand([...p.castable.keys()][0]!); else c.pass(); }
      else if (p.kind === "confirmCast") c.confirmCast();
      else if (p.kind === "stackStop") c.continueFromStop();
      else if (p.kind === "attackers") c.confirmAttackers();
      else if (p.kind === "blockers") c.confirmBlocks();
      else if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    }
    const snap = JSON.parse(c.logSnapshot("test")) as { spec: MatchSpec; log: Parameters<typeof replayToDecision>[2]; inProgress: boolean };
    expect(snap.inProgress).toBe(true);
    const decklists: [string[], string[]] = [expandDecklist(snap.spec.players[0].decklist), expandDecklist(snap.spec.players[1].decklist)];
    const actions = snap.log.filter((e) => e.t === "ACTION").length;
    const point = await replayToDecision(pool, decklists, snap.log, actions, { startingLife: snap.spec.rules.startingLife, handSize: snap.spec.rules.handSize, maxTurns: snap.spec.rules.maxTurns, ante: 0, startingPlayer: snap.spec.rules.startingPlayer! }, snap.spec.modifiers ?? []);
    const live = c.game.state, re = point.state;
    expect(live.turn).toBeGreaterThanOrEqual(5); // a game well under way …
    expect(live.battlefield.length).toBeGreaterThan(6); // … with a board to rebuild
    expect(re.turn).toBe(live.turn);
    expect(re.players.map((p) => p.life)).toEqual(live.players.map((p) => p.life));
    const board = (st: typeof live) => st.battlefield.map((id) => `${st.objects[id]!.controller}:${st.objects[id]!.cardId}`).sort();
    expect(board(re)).toEqual(board(live));
    c.concede();
  }, 60_000);
});
