import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, getObject, replayToDecision, type MatchSpec } from "@shandalar/engine";
import { matchSpec, runPairingMatch } from "./fuzz.js";
import type { DeckKey } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * S6 DoD-3 spot-checks: the viewer's reconstruction shows the right board at
 * moments matching the named fixtures (Pacifism fizzle, Siege-Gang sacrifice,
 * Control Magic steal + sickness), located in real fuzz games by seed.
 * Re-baselined in S8: the deck B swap (−Savannah Lions/−Fencing Ace,
 * +2 Cunning Tactician) changed random-game trajectories, so the moments
 * were re-hunted (same behaviors, new seeds/indices).
 */
describe("viewer spot-checks (S6 brief DoD 3)", () => {
  async function reconstruct(seed: number, a: DeckKey, b: DeckKey, index: number) {
    const pool = loadCardPool(CARDS_DIR);
    const spec: MatchSpec = matchSpec(seed, a, b);
    const live = await runPairingMatch(pool.cards, seed, a, b);
    const decklists: [string[], string[]] = [
      expandDecklist(spec.players[0].decklist),
      expandDecklist(spec.players[1].decklist),
    ];
    return { pool, live, point: await replayToDecision(pool.cards, decklists, live.log, index) };
  }

  it("Siege-Gang activation (seed 300 A-B, decision 247): a sacrifice choice among Goblins", async () => {
    const { pool, point } = await reconstruct(300, "A", "B", 247);
    expect(point.request?.purpose).toBe("chooseSacrifice");
    for (const a of point.request!.actions) {
      if (a.type !== "sacrifice") throw new Error("non-sacrifice alternative");
      const def = pool.cards.get(getObject(point.state, a.objectId).cardId)!;
      expect(def.subtypes).toContain("Goblin");
    }
  });

  it("Control Magic steal (seed 301 B-E, decision 215): stolen creature controlled by the thief, summoning-sick", async () => {
    const { pool, point } = await reconstruct(301, "B", "E", 215);
    const state = point.state;
    const stolen = state.battlefield
      .map((id) => state.objects[id]!)
      .find((o) => o.controller !== o.owner);
    expect(stolen, "a stolen permanent exists after Control Magic resolved").toBeDefined();
    expect(pool.cards.get(stolen!.cardId)!.name).toBe("Grizzly Bears");
    expect(stolen!.owner).toBe(1);
    expect(stolen!.controller).toBe(0);
    expect(stolen!.summoningSick).toBe(true); // 302.6 on control change — the S5-1 fixture behavior, live in fuzz
  });

  it("Pacifism fizzle (seed 568 B-D): the FIZZLE event is in the log and Pacifism is in its owner's graveyard after", async () => {
    const { pool, live, point } = await reconstruct(568, "B", "D", 834);
    const fizzle = live.log.find(
      (e) => e.t === "EVENT" && e.name === "FIZZLE" && (e.payload as { cardId: string }).cardId === "pacifism",
    );
    expect(fizzle).toBeDefined();
    const gy = [...point.state.players[0].graveyard, ...point.state.players[1].graveyard].map(
      (id) => pool.cards.get(getObject(point.state, id).cardId)!.id,
    );
    expect(gy).toContain("pacifism");
  });
});
