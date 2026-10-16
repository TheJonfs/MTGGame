import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { ArrayLog, SeededRng } from "@shandalar/core";
import { Game, characteristicsTrace, expandDecklist, type Action, type ActionSource } from "@shandalar/engine";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;

/** S65 (Chris: Baru's token read as a vanilla 6/6 — the trample it gains showed nowhere): the trace behind the play
 * screen's "in play" note — each change to a permanent's printed card, its source and its duration. */
describe("characteristicsTrace", () => {
  it("a Wurm token under Baru: 6/6 from a printed 4/4 (+2/+2 from Baru), trample gained from Baru; Pelakka Wurm keeps its printed trample (not gained)", async () => {
    let seen: ReturnType<typeof characteristicsTrace>[] = [];
    let game: Game | null = null;
    const source: ActionSource = async (req) => {
      if (seen.length === 0 && game) for (const id of game.ctx.state.battlefield) { const c = game.ctx.state.objects[id]!.cardId; if (c === "wurm_4_4" || c === "pelakka_wurm") seen.push(characteristicsTrace(game.ctx, id)); }
      return req.actions.find((a) => a.type === "pass") ?? req.actions[0]!;
    };
    const log = new ArrayLog<Action>();
    game = new Game(cards, [expandDecklist([{ cardId: "forest", count: 60 }]), expandDecklist([{ cardId: "forest", count: 60 }])], new SeededRng(65, log), log, source, { startingLife: 20, handSize: 7, maxTurns: 1, ante: 0, startingPlayer: 0 });
    await game.run([{ type: "permanentOnBattlefield", player: 0, cardId: "baru_wurmspeaker" }, { type: "permanentOnBattlefield", player: 0, cardId: "wurm_4_4" }, { type: "permanentOnBattlefield", player: 0, cardId: "pelakka_wurm" }]);
    const token = seen.find((t) => t.printed.power === 4)!, pelakka = seen.find((t) => t.printed.power === 7)!;
    expect([token.power, token.toughness, token.gained, token.lost]).toEqual([6, 6, ["trample"], []]);
    expect(token.contributions).toEqual(expect.arrayContaining([expect.objectContaining({ what: "pt", sourceCardId: "baru_wurmspeaker", power: 2, toughness: 2, duration: "static" }), expect.objectContaining({ what: "keyword", sourceCardId: "baru_wurmspeaker", keyword: "trample" })]));
    expect([pelakka.power, pelakka.gained]).toEqual([9, []]); // its trample is printed
  });
});
