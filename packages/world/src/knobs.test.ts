import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DIFFICULTIES, KNOBS, defaultKnobs, resolveKnobs } from "./knobs.js";
import { renderKnobsDoc } from "./knobs-doc.js";

describe("knobs registry (manifest principle 5; S12 Part 1)", () => {
  it("defaults resolve to the registry defaults, by value (no shared references)", () => {
    const a = resolveKnobs();
    const b = defaultKnobs();
    expect(a).toEqual(b);
    a.roamerDensityPer100Cells.wild = 0.99;
    expect(KNOBS.roamerDensityPer100Cells.default.wild).toBe(2.0);
    expect(resolveKnobs().roamerDensityPer100Cells.wild).toBe(2.0);
  });

  it("precedence: world < difficulty < region < dungeon < opponent < event, whole-value per key", () => {
    const v = resolveKnobs({
      difficulty: { anteCount: 2, shopPriceMultiplier: 1.3 },
      region: { anteCount: 1, roamerDensityPer100Cells: { civilized: 0.01, approach: 0.02, wild: 0.03 } },
      opponent: { anteCount: 3 },
      event: { shopPriceMultiplier: 0.5 },
    });
    expect(v.anteCount).toBe(3); // opponent beats region beats difficulty
    expect(v.shopPriceMultiplier).toBe(0.5); // event beats difficulty
    expect(v.roamerDensityPer100Cells).toEqual({ civilized: 0.01, approach: 0.02, wild: 0.03 }); // whole-value replace
    expect(v.lossLifePenalty).toBe(1); // untouched keys keep defaults
    // A lower layer cannot undo a higher one by being present with a different key set.
    expect(resolveKnobs({ dungeon: { anteCount: 2 }, opponent: {} }).anteCount).toBe(2);
  });

  it("unknown knob keys are rejected loudly (authored JSON typos must not be silent)", () => {
    expect(() => resolveKnobs({ region: { anteCounts: 2 } as never })).toThrow(/Unknown knob "anteCounts"/);
  });

  it("difficulty bundles are plain knob sources; standard = defaults", () => {
    expect(resolveKnobs({ difficulty: DIFFICULTIES.standard })).toEqual(defaultKnobs());
    expect(resolveKnobs({ difficulty: DIFFICULTIES.hard }).anteCount).toBe(2);
    expect(resolveKnobs({ difficulty: DIFFICULTIES.easy }).lifeFloor).toBe(10);
  });

  it("docs/knobs.md is in sync with the registry (generated; principle 11)", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/knobs.md");
    expect(readFileSync(path, "utf8")).toBe(renderKnobsDoc());
  });
});
