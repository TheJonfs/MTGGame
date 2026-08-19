import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "./loader.js";
import { parseManaCost, manaValue } from "./mana.js";
import { validateCard } from "./validate.js";
import { isManaAbility } from "./types.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

describe("card pool loading", () => {
  it("loads all 20 slice cards with no errors or warnings", () => {
    const pool = loadCardPool(CARDS_DIR);
    expect(pool.cards.size).toBe(20);
    // Slice cards use only implemented vocabulary, so no warnings expected.
    expect(pool.warnings).toEqual([]);
  });

  it("basic lands carry a mana ability", () => {
    const pool = loadCardPool(CARDS_DIR);
    const mountain = pool.cards.get("mountain")!;
    expect(mountain.abilities).toHaveLength(1);
    expect(isManaAbility(mountain.abilities![0]!)).toBe(true);
  });

  it("man_o_war ETB trigger targets a creature", () => {
    const pool = loadCardPool(CARDS_DIR);
    const mow = pool.cards.get("man_o_war")!;
    const trigger = mow.abilities![0]!;
    expect(trigger.kind).toBe("triggered");
    if (trigger.kind === "triggered") {
      expect(trigger.event).toBe("ENTERS_BATTLEFIELD");
      expect(trigger.targets![0]!.predicate).toBe("creature");
      expect(trigger.optional).toBe(false);
    }
  });
});

describe("validateCard rejections", () => {
  const base = {
    id: "test",
    name: "Test",
    source: "custom",
    manaCost: "{1}",
    types: ["Instant"],
    spellEffect: [{ type: "draw", count: 1, who: "you" }],
  };

  it("rejects unknown effect types", () => {
    const { errors } = validateCard({ ...base, spellEffect: [{ type: "transmogrify" }] });
    expect(errors.some((e) => e.includes('unknown effect type "transmogrify"'))).toBe(true);
  });

  it("rejects unknown keywords", () => {
    const { errors } = validateCard({
      ...base,
      types: ["Creature"],
      power: 1,
      toughness: 1,
      keywords: ["banding"],
      spellEffect: undefined,
    });
    expect(errors.some((e) => e.includes('unknown keyword "banding"'))).toBe(true);
  });

  it("rejects missing fields", () => {
    const { errors } = validateCard({ id: "x", source: "real" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects out-of-bounds target indices", () => {
    const { errors } = validateCard({
      ...base,
      targets: [],
      spellEffect: [{ type: "damage", amount: 3, target: 0 }],
    });
    expect(errors.some((e) => e.includes("out of bounds"))).toBe(true);
  });

  it("warns on valid-but-unimplemented vocabulary", () => {
    const { errors, warnings } = validateCard({
      ...base,
      types: ["Sorcery"],
      spellEffect: [{ type: "discard", count: 1, who: "opponent", mode: "random" }],
    });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("no resolver yet"))).toBe(true);
  });
});

describe("mana parsing", () => {
  it("parses X, generic, and colored", () => {
    const cost = parseManaCost("{X}{2}{W}{W}");
    expect(cost.xCount).toBe(1);
    expect(cost.generic).toBe(2);
    expect(cost.colored.W).toBe(2);
    expect(manaValue(cost, 5)).toBe(9);
  });

  it("parses the empty (land) cost", () => {
    expect(manaValue(parseManaCost(""))).toBe(0);
  });

  it("rejects malformed costs", () => {
    expect(() => parseManaCost("{Q}")).toThrow();
    expect(() => parseManaCost("2WW")).toThrow();
  });
});
