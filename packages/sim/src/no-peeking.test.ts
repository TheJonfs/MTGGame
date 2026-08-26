import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EventBus, IdGen, NullLog, SeededRng } from "@shandalar/core";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import {
  buildView,
  expandDecklist,
  replayToDecision,
  type EngineCtx,
  type GameState,
  type PlayerId,
} from "@shandalar/engine";
import { HumanAgent, HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { runMatch } from "@shandalar/engine";
import { matchSpec, runPairingMatch } from "./fuzz.js";
import { DECKS, DECK_ARCHETYPES } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

function viewCtx(state: GameState, pool: Map<string, CardDef>): EngineCtx {
  return {
    state,
    defs: {
      def(cardId: string): CardDef {
        const d = pool.get(cardId);
        if (!d) throw new Error(`Unknown cardId ${cardId}`);
        return d;
      },
    },
    ids: new IdGen(),
    bus: new EventBus(),
    log: new NullLog(),
    rng: new SeededRng(0, new NullLog()),
  };
}

/**
 * ADR-048 no-peeking invariant (permanent): a seat's view never contains the
 * other seat's hand object ids or either library's object ids — however the
 * view grows, hidden zones stay hidden. Ground truth comes from replaying
 * real games to sampled decisions and comparing the full state against the
 * serialized view. (request.revealed — Duress — is the sanctioned reveal
 * channel and is not part of the view.)
 */
describe("no-peeking (permanent; ADR-048)", () => {
  it("seat views exclude opponent hand and both libraries, sampled across real games", async () => {
    const pool = loadCardPool(CARDS_DIR);
    let decisionsChecked = 0;
    for (const [a, b, seed] of [
      ["A", "B", 11],
      ["C", "D", 12],
      ["B", "E", 13],
    ] as const) {
      const result = await runPairingMatch(pool.cards, seed, a, b, ["sane", "sane"]);
      const decklists: [string[], string[]] = [
        expandDecklist(DECKS[a].decklist as never),
        expandDecklist(DECKS[b].decklist as never),
      ];
      const total = result.log.filter((e) => e.t === "ACTION").length;
      const sample = [0, 1, 2, ...Array.from({ length: 12 }, (_, i) => Math.floor(((i + 1) * total) / 13))];
      for (const k of [...new Set(sample)].filter((i) => i < total)) {
        const point = await replayToDecision(
          pool.cards,
          decklists,
          result.log,
          k,
          { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
          [],
        );
        const ctx = viewCtx(point.state, pool.cards);
        for (const seat of [0, 1] as PlayerId[]) {
          const view = buildView(ctx, seat);
          const json = JSON.stringify(view);
          const hidden = [
            ...point.state.players[seat === 0 ? 1 : 0].hand,
            ...point.state.players[0].library,
            ...point.state.players[1].library,
          ];
          for (const id of hidden) {
            expect(json.includes(`"${id}"`), `seat ${seat} view leaked ${id} (game ${a}-${b} seed ${seed} @${k})`).toBe(
              false,
            );
          }
          decisionsChecked += 1;
        }
      }
    }
    expect(decisionsChecked).toBeGreaterThan(60);
  });

  it("the live human seam: every view a HumanAgent receives is redacted (S10 Part 0.1)", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const human = new HumanAgent();
    const views: { hand: { objectId: string }[]; opponentHandCount: number }[] = [];
    human.onRequest = (view, request) => {
      views.push(view as never);
      queueMicrotask(() => human.submit(request.actions[0]!));
    };
    const ai = new HeuristicAgent(7, pool.cards, difficultyProfile("journeyman", DECK_ARCHETYPES.D, [...DECKS.A.decklist]));
    const result = await runMatch(matchSpec(99, "A", "D", ["random", "random"]), pool.cards, [human, ai]);
    expect(result.turns).toBeGreaterThan(0);
    expect(views.length).toBeGreaterThan(10);

    // The live human path must serve the same redacted GameView shape the
    // deep replay-based test above verifies id-by-id: hidden zones appear
    // as counts only, and no key of the serialized view carries a zone list
    // beyond own hand / battlefield / stack / graveyards.
    for (const v of views) {
      const json = JSON.stringify(v);
      expect(json).not.toContain('"opponentHand":');
      expect(json).not.toContain('"library":');
      expect(typeof v.opponentHandCount).toBe("number");
      const keys = Object.keys(v).sort();
      // S17: graveyardObjects (public zone, with ids) and the viewer's own manaPool joined the view — both public.
      // S22: pendingEndStepSacrifices (A10 word 3) — public; both players watched the temporary reanimation.
      expect(keys).toEqual([
        "activePlayer", "battlefield", "combat", "graveyardObjects", "graveyards", "hand", "librarySizes",
        "life", "manaPool", "mulliganCount", "opponentHandCount", "pendingEndStepSacrifices", "stack", "startingLife", "step", "turn", "you",
      ]);
    }
  });
});
