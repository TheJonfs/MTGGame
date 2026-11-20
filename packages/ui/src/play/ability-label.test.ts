import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { ActivatedAbilityDef } from "@shandalar/cards";
import type { Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";
import { abilityLabels } from "./ability-label.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const oracle = JSON.parse(readFileSync(join(ROOT, "data/art/real/oracle.json"), "utf8")) as Record<string, { oracle_text: string }>;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const labelsOf = (cardId: string): string[] => {
  const d = pool.get(cardId)!;
  return abilityLabels((d.abilities ?? []).filter((a) => a.kind === "activated").map((a) => ({ ability: a as ActivatedAbilityDef, texts: [d.text, oracle[cardId]?.oracle_text] })));
};

/**
 * Post-S73a (Chris: a Manaba in play beside a Silt Spirit offered "Ability 1" and "Ability 2"; an Arcane Collector's
 * ability read its text). The old label found a line of the card's text by a cost made of mana and {T} only, on the
 * card's own printed abilities only. Every activated ability now reads its own line of rules text or one written from
 * its data, and an ability another permanent grants names the card that grants it.
 */
describe("the label of an activated ability (post-S73a)", () => {
  it("no ability of the pool, printed or granted, is left as a bare number, and no two on one card read the same", () => {
    for (const d of pool.values()) {
      const labels = labelsOf(d.id);
      for (const l of labels) { expect(l, d.id).not.toMatch(/^Ability \d|ability \d|\(no effect\)/); expect(l.length, d.id).toBeGreaterThan(5); }
      expect(new Set(labels).size, d.id).toBe(labels.length);
      for (const a of d.abilities ?? []) if (a.kind === "static") for (const e of a.effects) if (e.type === "grantAbility") {
        const [l] = abilityLabels([{ ability: e.ability, texts: [], grantedBy: { name: d.name, texts: [d.text, oracle[d.id]?.oracle_text] } }]);
        expect(l, d.id).toContain(`(from ${d.name})`);
        expect(l, d.id).not.toMatch(/^Ability \d/);
      }
    }
  });
  it("a cost that is not mana or {T} finds its line: the Manaba's tap-a-Snake, Order Druid's sacrifice, Skirk Prospector's", () => {
    expect(labelsOf("manaba")).toEqual(["Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life."]);
    expect(labelsOf("order_druid")).toEqual(["{G}, {T}, Sacrifice this creature: Search your library for a green creature card, put it onto the battlefield, then shuffle."]);
    expect(labelsOf("skirk_prospector")).toEqual(["Sacrifice a Goblin: Add {R}."]);
  });
  it("a card with no text on its def reads its oracle text, or a written line", () => {
    expect(labelsOf("llanowar_elves")).toEqual(["{T}: Add {G}."]);
    expect(labelsOf("forest")).toEqual(["{T}: Add {G}."]);
  });
  it("two mana abilities printed on one line are told apart; two abilities with one cost each find their own line", () => {
    expect(labelsOf("hearthspire")).toEqual(["{T}: Add {R}.", "{T}: Add {W}.", "{2}{R}{W}, {T}: Hearthspire deals 2 damage to any target. You gain 2 life."]);
    expect(labelsOf("library_of_alexandria")).toEqual(["{T}: Add {C}.", "{T}: Draw a card. Activate only if you have exactly seven cards in hand."]);
  });
  it("keywords with their cost after them: Equip", () => {
    expect(labelsOf("bonesplitter")).toEqual(["Equip {1}"]);
  });
  it("a written line when no text is to hand: the cost, then each effect in a few words", () => {
    const d = pool.get("manaba")!, a = d.abilities!.find((x) => x.kind === "activated") as ActivatedAbilityDef;
    expect(abilityLabels([{ ability: a, texts: [] }])).toEqual(["Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life."]);
    const h = pool.get("hearthspire")!.abilities![2] as ActivatedAbilityDef;
    expect(abilityLabels([{ ability: h, texts: [] }])).toEqual(["{2}{R}{W}, {T}: Deal 2 damage. Gain 2 life."]);
  });

  it("in a match: a Manaba beside a Silt Spirit offers its own ability and the Spirit's mill, each by name", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 5, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "forest", count: 40 }] },
      enemy: { name: "ai", decklist: [{ cardId: "hill_giant", count: 40 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: [perm(0, "manaba"), perm(0, "silt_spirit"), perm(0, "island")],
    } });
    void c.start();
    for (let g = 0; g < 200; g++) {
      await new Promise((r) => setTimeout(r, 0));
      if (c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0) break;
      if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
      else if (c.phase.kind === "priority") c.pass();
    }
    const st = c.game.state, manaba = st.battlefield.find((id) => st.objects[id]!.cardId === "manaba")!;
    c.clickBattlefield(manaba);
    expect(c.phase.kind).toBe("chooseAbility");
    const options = (c.phase as { options: { abilityIndex: number; label: string }[] }).options;
    expect(options.map((o) => o.label)).toEqual([
      "Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life.",
      "{T}: Target player mills X cards, where X is this creature's toughness. (from Silt Spirit)",
    ]);
  });
});
