import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { MatchController } from "./match-controller.js";
import type { Modifier } from "@shandalar/engine";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Post-S43 (Chris's report): Aetherbolt — "Return target permanent to its owner's hand. Aetherbolt deals 3 damage to
 * any target." — two DISTINCT target slots. He clicked the creature to bounce first (the newer one, later on the
 * battlefield) and the creature to damage second; the r9 multiset matcher took the enumerator's first variant with
 * those two targets, which is battlefield order — the newer creature took the damage. The click order IS the slot
 * order now; the multiset match remains for "up to N" range specs (the Warden's test in match-controller.test).
 */
describe("multi-slot targeting keeps the CLICK order (post-S43, Chris's Aetherbolt report)", () => {
  async function toTargeting(): Promise<{ c: MatchController; bears: string; courser: string }> {
    const c = new MatchController(pool, {
      humanSeat: 0, seed: 21, aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "aetherbolt", count: 20 }, { cardId: "island", count: 20 }] },
        enemy: { name: "D", decklist: [{ cardId: "forest", count: 40 }], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        // The Bears enter first (the lower battlefield index), the Courser second (the NEWER permanent).
        modifiers: [perm(0, "island"), perm(0, "island"), perm(0, "island"), perm(0, "mountain"), perm(1, "grizzly_bears"), perm(1, "centaur_courser")],
      },
    });
    c.start();
    let guard = 0;
    while (guard++ < 5000) {
      await tick();
      const p = c.phase;
      if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); continue; }
      if (p.kind === "priority" && p.castable.size > 0) { c.clickHand([...p.castable.keys()][0]!); continue; }
      if (p.kind === "priority") { c.pass(); continue; }
      if (p.kind === "stackStop") { c.continueFromStop(); continue; }
      if (p.kind === "attackers") { c.confirmAttackers(); continue; }
      if (p.kind === "targeting") break;
    }
    expect(c.phase.kind).toBe("targeting");
    const st = c.game.state;
    const bears = st.battlefield.find((id) => st.objects[id]!.cardId === "grizzly_bears")!;
    const courser = st.battlefield.find((id) => st.objects[id]!.cardId === "centaur_courser")!;
    expect(st.battlefield.indexOf(bears)).toBeLessThan(st.battlefield.indexOf(courser));
    return { c, bears, courser };
  }
  const targetsOf = (c: MatchController) => ((c.phase as { action: { targets: { kind: string; id?: string }[] } }).action.targets).map((t) => t.id);

  it("Aetherbolt: the NEWER creature clicked first is the one bounced (slot 0), the older one takes the 3 damage (slot 1) — and the reverse order reverses it", async () => {
    const a = await toTargeting();
    expect(a.c.phase.kind === "targeting" && a.c.phase.slotLabel).toBe("return to its owner's hand (target 1 of 2)");
    a.c.clickBattlefield(a.courser);
    expect(a.c.phase.kind).toBe("targeting");
    expect(a.c.phase.kind === "targeting" && a.c.phase.slotLabel).toBe("3 damage (target 2 of 2)");
    expect(a.c.phase.kind === "targeting" && a.c.phase.highlightObjects.has(a.bears)).toBe(true);
    a.c.clickBattlefield(a.bears);
    expect(a.c.phase.kind).toBe("confirmCast");
    expect(targetsOf(a.c)).toEqual([a.courser, a.bears]); // the click order, not the battlefield order
    a.c.confirmCast();
    let guard = 0;
    while (guard++ < 500 && a.c.game.state.battlefield.includes(a.courser)) { await tick(); const p = a.c.phase; if (p.kind === "priority") a.c.pass(); else if (p.kind === "stackStop") a.c.continueFromStop(); }
    const st = a.c.game.state;
    expect(st.players[1].hand.some((id) => st.objects[id]?.cardId === "centaur_courser")).toBe(true); // bounced
    expect(st.players[1].graveyard.some((id) => st.objects[id]?.cardId === "grizzly_bears")).toBe(true); // 3 damage to a 2/2
    expect(st.battlefield.some((id) => st.objects[id]?.cardId === "grizzly_bears" || st.objects[id]?.cardId === "centaur_courser")).toBe(false);

    const b = await toTargeting();
    b.c.clickBattlefield(b.bears);
    b.c.clickBattlefield(b.courser);
    expect(targetsOf(b.c)).toEqual([b.bears, b.courser]);
  });

  it("Aetherbolt: the same permanent may fill both slots (bounce it, then 3 damage to a player) — the second pick offers the players", async () => {
    const { c, courser } = await toTargeting();
    c.clickBattlefield(courser);
    expect(c.phase.kind === "targeting" && c.phase.highlightPlayers.size).toBe(2);
    c.clickPlayer(1);
    expect(c.phase.kind).toBe("confirmCast");
    expect((c.phase as { action: { targets: unknown[] } }).action.targets).toEqual([{ kind: "object", id: courser }, { kind: "player", player: 1 }]);
  });
});

describe("a TRIGGER with distinct slots (Drakuseth: 4 damage to one, 3 to up to two others) keeps the click order between slots and any order within the range slot", () => {
  it("first click fills the 4-damage slot; the next two fill the 3-damage slot in either order; the label names each", async () => {
    const c = new MatchController(pool, {
      humanSeat: 0, seed: 23, aiDelayMs: 0,
      custom: {
        human: { name: "You", decklist: [{ cardId: "mountain", count: 40 }] },
        enemy: { name: "D", decklist: [{ cardId: "forest", count: 40 }], difficulty: "journeyman", archetype: "midrange" },
        rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
        modifiers: [perm(0, "drakuseth_maw_of_flames"), perm(1, "grizzly_bears"), perm(1, "centaur_courser"), perm(1, "rumbling_baloth"), { type: "startingLife", player: 1, value: 40 }],
      },
    });
    c.start();
    let guard = 0;
    while (guard++ < 5000) {
      await tick();
      const p = c.phase;
      if (p.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); continue; }
      if (p.kind === "priority") { c.pass(); continue; }
      if (p.kind === "stackStop") { c.continueFromStop(); continue; }
      if (p.kind === "attackers") { for (const id of p.eligible) c.clickBattlefield(id); c.confirmAttackers(); continue; }
      if (p.kind === "targeting") break;
    }
    expect(c.phase.kind).toBe("targeting");
    const st = c.game.state;
    const bears = st.battlefield.find((id) => st.objects[id]!.cardId === "grizzly_bears")!;
    const courser = st.battlefield.find((id) => st.objects[id]!.cardId === "centaur_courser")!;
    const baloth = st.battlefield.find((id) => st.objects[id]!.cardId === "rumbling_baloth")!;
    expect(c.phase.kind === "targeting" && c.phase.slots).toEqual([1, 2]);
    expect(c.phase.kind === "targeting" && c.phase.slotLabel).toBe("4 damage (target 1 of 2)");
    c.clickBattlefield(baloth); // the 4 goes to the Baloth (a 4/4)
    expect(c.phase.kind === "targeting" && c.phase.slotLabel).toBe("3 damage (target 2 of 2)");
    expect(c.phase.kind === "targeting" && c.phase.highlightObjects.has(baloth)).toBe(false); // distinct from the prior
    c.clickBattlefield(courser); // the later permanent first …
    expect(c.phase.kind).toBe("targeting");
    c.clickBattlefield(bears); // … then the earlier: legal (the range slot is any order)
    expect(c.phase.kind).toBe("confirmCast");
    const targets = (c.phase as { action: { targets: { id?: string }[] } }).action.targets.map((t) => t.id);
    expect(targets[0]).toBe(baloth);
    expect(targets.slice(1).sort()).toEqual([bears, courser].sort());
  });
});
