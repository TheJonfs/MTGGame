import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "./loader.js";
import { parseManaCost, manaValue } from "./mana.js";
import { validateCard } from "./validate.js";
import { EFFECT_TYPES, isManaAbility } from "./types.js";
import { IMPLEMENTED_EFFECT_TYPES } from "./resolvers.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

describe("card pool loading", () => {
  it("loads the full pool (S1–S5 additions + tokens) with no errors or warnings", () => {
    const pool = loadCardPool(CARDS_DIR);
    expect(pool.cards.size).toBe(109); // 20 S1 + 11 S2 + 11 S3 + 16 S4 + 6 S5 + 2 tokens + 1 S8 (Cunning Tactician) + 3 S15 (Growth, Tutor, Lotus) + 2 S16 (Elves, Adept) + 32 S17 (Expansion 1) + 5 tokens (Bear, Bird, Wurm, Zombie, Faerie Rogue)
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
    text: "",
    shopTier: 1, // ADR-078: non-token/basic/prizeOnly defs need a tier
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

  it("every vocabulary word has a resolver as of S17 (untapTarget was the last — Little Bear); the no-resolver warning path stays for future words", () => {
    const staticOnly = new Set(["grantKeyword", "gainControl"]); // interpreted live by characteristics(); no resolver by design
    for (const t of EFFECT_TYPES) if (!staticOnly.has(t)) expect(IMPLEMENTED_EFFECT_TYPES.has(t), t).toBe(true);
    const { errors, warnings } = validateCard({
      ...base,
      types: ["Sorcery"],
      targets: [{ count: 1, predicate: "creature", zone: "battlefield" }],
      spellEffect: [{ type: "untapTarget", target: 0 }],
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
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
