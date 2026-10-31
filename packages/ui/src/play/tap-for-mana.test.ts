import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));

async function atMain(modifiers: Modifier[]): Promise<MatchController> {
  const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
    human: { name: "me", decklist: [{ cardId: "grizzly_bears", count: 40 }] },
    enemy: { name: "ai", decklist: [{ cardId: "hill_giant", count: 40 }], difficulty: "master", archetype: "midrange" },
    rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
    modifiers,
  } });
  void c.start();
  for (let g = 0; g < 200; g++) {
    await tick();
    if (c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0) break;
    if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    else if (c.phase.kind === "priority") c.pass();
  }
  expect(c.phase.kind).toBe("priority");
  return c;
}
const find = (c: MatchController, id: string) => { const st = c.game.state; return st.battlefield.find((o) => st.objects[o]!.cardId === id)!; };
const onPriority = async (c: MatchController) => { for (let g = 0; g < 50 && c.phase.kind !== "priority"; g++) await tick(); expect(c.phase.kind).toBe("priority"); };

/**
 * Post-S70 (Chris): the Sapwell Dryad is acceleration only if a land can be tapped BEFORE the cast begins. The engine
 * always offered the tap; the screen took it only in a response window. The rail's "tap for mana" toggle takes it at any
 * priority, so one Forest and the Dryad cast Grizzly Bears ({1}{G}): tap, float, untap, tap, cast.
 */
describe("the rail's tap-for-mana toggle (post-S70, Chris — Sapwell Dryad)", () => {
  it("off: a click on a land does nothing with an empty stack, and the toggle changes the open window", async () => {
    const c = await atMain([perm(0, "forest"), perm(0, "sapwell_dryad")]);
    const forest = find(c, "forest");
    c.clickBattlefield(forest);
    await tick();
    expect(c.game.state.objects[forest]!.tapped).toBeFalsy();
    c.setTapForManaAnytime(true);
    expect(c.phase.kind === "priority" && c.phase.manaTappable.has(forest)).toBe(true);
    c.setTapForManaAnytime(false);
    expect(c.phase.kind === "priority" && c.phase.manaTappable.size).toBe(0);
    c.concede();
  }, 30_000);

  it("on: one Forest and the Dryad make two mana — the float survives the Dryad's ability resolving — and Bears are cast", async () => {
    const c = await atMain([perm(0, "forest"), perm(0, "sapwell_dryad")]);
    const forest = find(c, "forest"), dryad = find(c, "sapwell_dryad"), me = () => c.game.state.players[0];
    const bears = () => [...me().hand].find((id) => c.game.state.objects[id]!.cardId === "grizzly_bears")!;
    c.setTapForManaAnytime(true);
    c.clickBattlefield(forest);
    await onPriority(c);
    expect(me().manaPool.G).toBe(1);
    expect(c.game.state.objects[forest]!.tapped).toBe(true);

    c.clickBattlefield(dryad);
    if (c.phase.kind === "targeting") c.clickBattlefield(forest);
    if (c.phase.kind === "confirmCast") c.confirmCast(false);
    for (let g = 0; g < 50 && c.game.state.objects[forest]!.tapped; g++) { await tick(); if (c.phase.kind === "priority" && c.game.state.stack.length > 0) c.pass(); }
    await onPriority(c);
    expect(c.game.state.step).toBe("MAIN1");
    expect(c.game.state.objects[forest]!.tapped).toBeFalsy();
    expect(me().manaPool.G).toBe(1);

    c.clickBattlefield(forest);
    await onPriority(c);
    expect(me().manaPool.G).toBe(2);
    c.clickHand(bears());
    if (c.phase.kind === "confirmCast") c.confirmCast(false);
    await onPriority(c);
    expect(find(c, "grizzly_bears")).toBeTruthy();
    expect(me().manaPool.G).toBe(0);
    c.concede();
  }, 30_000);

  it("on: a land with an activated ability taps for mana; off, the click still goes to the ability; a tapped land takes back", async () => {
    const c = await atMain([perm(0, "hearthspire"), ...["mountain", "mountain", "mountain", "mountain", "plains", "plains"].map((l) => perm(0, l))]);
    const spire = find(c, "hearthspire");
    c.clickBattlefield(spire);
    expect(c.phase.kind).not.toBe("waiting");
    expect(c.game.state.objects[spire]!.tapped).toBeFalsy();
    expect(c.phase.kind).not.toBe("priority"); // the activation began
    c.cancel();
    await onPriority(c);
    c.setTapForManaAnytime(true);
    c.clickBattlefield(spire);
    expect(c.phase.kind).toBe("chooseTapColor"); // a dual asks which colour
    c.chooseTapColor("R");
    await onPriority(c);
    expect(c.game.state.objects[spire]!.tapped).toBe(true);
    c.clickBattlefield(spire); // the takeback
    await onPriority(c);
    expect(c.game.state.objects[spire]!.tapped).toBeFalsy();
    c.concede();
  }, 30_000);
});
