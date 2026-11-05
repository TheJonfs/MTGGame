import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";
import { optionFacts } from "./option-facts.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Post-S71 (Chris: the legend-rule and sacrifice pickers showed two same-named permanents identically — "yours" on a
 * stolen creature too). Each battlefield option now carries owner-against-controller and what tells it apart. */
describe("post-S71 — the picker's facts for a permanent", () => {
  it("a stolen Bear reads 'stolen', our own 'yours'; P/T, tapped, sick, counters and attachments tell them apart", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "swamp", count: 40 }] },
      enemy: { name: "ai", decklist: [{ cardId: "forest", count: 40 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: [perm(0, "grizzly_bears"), perm(1, "grizzly_bears"), perm(1, "llanowar_elves")],
    } });
    void c.start();
    for (let g = 0; g < 200 && !(c.phase.kind === "priority" && c.game.state.step === "MAIN1"); g++) { await tick(); if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); } }
    const s = c.game.state, ctx = c.game.ctx;
    const bears = s.battlefield.filter((id) => s.objects[id]!.cardId === "grizzly_bears");
    const ours = bears.find((id) => s.objects[id]!.owner === 0)!, theirs = bears.find((id) => s.objects[id]!.owner === 1)!;
    const elves = s.battlefield.find((id) => s.objects[id]!.cardId === "llanowar_elves")!;
    // a steal, as Control Magic leaves it (a test of the reader, not of the steal)
    s.objects[theirs]!.controller = 0; s.objects[theirs]!.tapped = true; s.objects[theirs]!.counters["+1/+1"] = 1;
    s.objects[elves]!.controller = 0; s.objects[elves]!.attachedTo = ours; // a stand-in attachment, named under the host
    expect(optionFacts(ctx, ours, 0)?.tag).toBe("you");
    const st = optionFacts(ctx, theirs, 0)!;
    expect(st.tag).toBe("stolen");
    expect(st.facts).toEqual(expect.arrayContaining(["3/3", "tapped", "+1/+1 ×1"]));
    expect(optionFacts(ctx, ours, 0)!.facts).toContain("under Llanowar Elves");
    // from the other seat the same two read "taken from you" and "theirs"
    expect(optionFacts(ctx, theirs, 1)?.tag).toBe("taken");
    expect(optionFacts(ctx, ours, 1)?.tag).toBe("them");
    // not on the battlefield: no facts
    expect(optionFacts(ctx, s.players[0].hand[0]!, 0)).toBeNull();
  });
});
