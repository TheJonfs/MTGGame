import { describe, expect, it } from "vitest";
import { COMPACT_QUERY, isCompact } from "./layout-mode.js";

/** Post-S71 (Chris, the iPhone Duo): the compact layout's switch — a forced setting wins; auto follows the window. */
describe("post-S71 — the layout mode", () => {
  it("compact and full force their side whatever the window; auto follows the query", () => {
    expect(isCompact("compact", { matches: false })).toBe(true);
    expect(isCompact("full", { matches: true })).toBe(false);
    expect(isCompact("auto", { matches: true })).toBe(true);
    expect(isCompact("auto", { matches: false })).toBe(false);
    expect(isCompact("auto", null)).toBe(false); // no matchMedia: the full layout
  });
  it("auto's thresholds sit below laptop windows and above the Duo unfolded (890–951 × 543–626)", () => {
    expect(COMPACT_QUERY).toBe("(max-height: 640px), (max-width: 1000px)");
  });
});
