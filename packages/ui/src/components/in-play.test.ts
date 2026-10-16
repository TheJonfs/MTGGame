import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { ArrayLog, SeededRng } from "@shandalar/core";
import { Game, expandDecklist, type Action, type ActionSource } from "@shandalar/engine";
import { inPlayLines } from "./in-play.js";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;

describe("the inspector's in-play note (S65)", () => {
  it("names each change and its source — Baru's +2/+2 and trample on a Wurm token, Rancor on a creature; nothing for a creature as printed", async () => {
    let lines: Record<string, string[]> = {};
    let game: Game | null = null;
    const source: ActionSource = async (req) => {
      if (!Object.keys(lines).length && game) for (const id of game.ctx.state.battlefield) lines[game.ctx.state.objects[id]!.cardId] = inPlayLines(game.ctx, id).map((l) => l.text);
      return req.actions.find((a) => a.type === "pass") ?? req.actions[0]!;
    };
    const log = new ArrayLog<Action>();
    game = new Game(cards, [expandDecklist([{ cardId: "forest", count: 60 }]), expandDecklist([{ cardId: "forest", count: 60 }])], new SeededRng(65, log), log, source, { startingLife: 20, handSize: 7, maxTurns: 1, ante: 0, startingPlayer: 0 });
    await game.run([{ type: "permanentOnBattlefield", player: 0, cardId: "baru_wurmspeaker" }, { type: "permanentOnBattlefield", player: 0, cardId: "wurm_4_4" }, { type: "permanentOnBattlefield", player: 1, cardId: "grizzly_bears" }]);
    expect(lines.wurm_4_4).toEqual(["6/6 (printed 4/4)", "+2/+2 from Baru, Wurmspeaker", "Trample from Baru, Wurmspeaker"]);
    expect(lines.grizzly_bears).toEqual([]);
  });
});
