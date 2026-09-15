import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCatalog } from "./loader.js";
import { generateWorld, rollTemplate } from "./generate.js";
import { newWorld } from "./state.js";
import { WorldRng } from "./rng.js";
import { defaultKnobs, KNOBS } from "./knobs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));

/** FNV-1a over a string — a compact fingerprint for a long roll sequence. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/**
 * S37 Part 3 (Chris: set the spawn knobs up for a future tuning pass, CHANGE NOTHING): the default
 * spawn distribution is byte-identical to S36's — the same seeds roll the same roamers, at generation
 * and on respawn. The fingerprints below were captured against the S36 tables (TIER_TABLES:
 * civilized [1,1,1,2], approach [2,2,3,1], wild [3,3,2]) BEFORE the knobs existed.
 */
describe("spawn pin (S37): the default mageSpawnWeight / mageSpawnRamp reproduce the S36 tables exactly", () => {
  const knobs = defaultKnobs();
  it("rollTemplate: 400 rolls per ring at three seeds — the same template sequence as S36", () => {
    const out: Record<string, { fp: string; tiers: [number, number, number] }> = {};
    for (const seed of [1, 42, 20260915]) {
      for (const tier of ["civilized", "approach", "wild"] as const) {
        const rng = new WorldRng(seed);
        const ids: string[] = [];
        const tiers: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < 400; i++) {
          const t = rollTemplate(rng, catalog, { tier, color: "W" }, knobs);
          ids.push(t.id);
          tiers[(t.tier - 1) as 0 | 1 | 2] += 1;
        }
        out[`${seed}:${tier}`] = { fp: fnv(ids.join(",")), tiers };
      }
    }
    expect(out).toEqual({"1:civilized":{"fp":"78e78e2d","tiers":[323,77,0]},"1:approach":{"fp":"99f6208d","tiers":[119,214,67]},"1:wild":{"fp":"0ff9219a","tiers":[0,163,237]},"42:civilized":{"fp":"8350066a","tiers":[310,90,0]},"42:approach":{"fp":"52a4200f","tiers":[116,189,95]},"42:wild":{"fp":"84ecea6c","tiers":[0,167,233]},"20260915:civilized":{"fp":"15cd2de1","tiers":[320,80,0]},"20260915:approach":{"fp":"1e39471d","tiers":[121,202,77]},"20260915:wild":{"fp":"6439b3bb","tiers":[0,180,220]}});
  });
  it("world generation and the roamer roster at three seeds — the same catalog ids as S36", () => {
    const out: Record<string, string> = {};
    for (const seed of [1, 42, 20260915]) {
      const g = generateWorld(seed, catalog);
      out[`gen:${seed}`] = fnv(g.opponents.map((o) => o.catalogId).join(","));
      const w = newWorld({ seed, catalog, starter: "white", difficulty: "standard", playerName: "Pin" });
      out[`world:${seed}`] = fnv(w.opponents.map((o) => o.catalogId).join(","));
    }
    expect(out).toEqual({"gen:1":"f7d37a6a","world:1":"f7d37a6a","gen:42":"18791d92","world:42":"18791d92","gen:20260915":"26cdc1d6","world:20260915":"26cdc1d6"});
  });
  it("the knob defaults document today's effective weights (civilized 3:1:0, approach 1:2:1, wild 0:1:2) and no ramp", () => {
    expect(KNOBS.mageSpawnWeight.default).toEqual({ civilized: [3, 1, 0], approach: [1, 2, 1], wild: [0, 1, 2] });
    expect(KNOBS.mageSpawnRamp.default).toBe(1);
  });
});
