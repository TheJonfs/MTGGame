import { describe, expect, it } from "vitest";
import { AudioManager } from "./audio";

/**
 * S23 audio scaffolding — the cue contract (brief Part 3):
 * silent-if-unmapped/unmounted is the DEPLOY'S NATURAL STATE (ADR-083), so the empty mapping
 * must be a total no-op; the "_"-prefixed keys in mapping.json are documentation, not cues;
 * the toggle survives without storage; headless construction (no window/Audio) never throws.
 */
describe("S23 audio scaffolding (cue-first; ADR-083/084)", () => {
  it("an empty mapping resolves every cue to silence and music()/sting() no-op without throwing", () => {
    const a = new AudioManager({});
    expect(a.resolve("music.menu")).toBeNull();
    expect(a.resolve("sting.coin-flip")).toBeNull();
    a.music("music.overworld");
    a.sting("sting.duel-win");
    expect(a.pending()).toBe("music.overworld"); // remembered for the day a mapping arrives
  });

  it("a mapped cue resolves to the /audio mount; underscore keys are documentation, not files", () => {
    const a = new AudioManager({ "music.menu": "menu.ogg", "_comment": "not a cue", "sting.coin-flip": "flip.wav" });
    expect(a.resolve("music.menu")).toBe("/audio/menu.ogg");
    expect(a.resolve("sting.coin-flip")).toBe("/audio/flip.wav");
    expect(a.resolve("music.town")).toBeNull();
  });

  it("the toggle flips and never throws headless (no window, no Audio, no localStorage)", () => {
    const a = new AudioManager({});
    expect(a.isEnabled()).toBe(true); // default on
    a.setEnabled(false);
    expect(a.isEnabled()).toBe(false);
    a.music("music.menu"); // disabled: still remembered, still silent
    expect(a.pending()).toBe("music.menu");
    a.setEnabled(true);
    expect(a.isEnabled()).toBe(true);
  });

  it("subscribers hear toggle changes (the chrome mute mirrors the front page)", () => {
    const a = new AudioManager({});
    let calls = 0;
    const off = a.subscribe(() => (calls += 1));
    a.setEnabled(false);
    a.setEnabled(true);
    expect(calls).toBe(2);
    off();
    a.setEnabled(false);
    expect(calls).toBe(2);
  });
});
