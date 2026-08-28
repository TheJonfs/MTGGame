import { describe, expect, it } from "vitest";
import { AudioManager } from "./audio.js";

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

  it("S24 r2: {file, volume} entries carry a clamped per-cue volume; bare strings are ×1; sfx() no-ops headless", () => {
    const a = new AudioManager({
      "sfx.cast.B": { file: "sfx/Black.wav", volume: 0.5 },
      "sfx.cast.R": { file: "sfx/Red.wav", volume: 7 }, // clamps to 1
      "sting.news": "Newsflash.flac",
    });
    expect(a.resolve("sfx.cast.B")).toBe("/audio/sfx/Black.wav");
    expect(a.resolveVolume("sfx.cast.B")).toBe(0.5);
    expect(a.resolveVolume("sfx.cast.R")).toBe(1);
    expect(a.resolveVolume("sting.news")).toBe(1);
    expect(a.resolve("sfx.cast.W")).toBeNull(); // unmapped identity: silence
    a.sfx("sfx.cast.B"); // headless: never throws
    expect(a.entries().map((e) => e.cue).sort()).toEqual(["sfx.cast.B", "sfx.cast.R", "sting.news"]);
  });

  it("S24 r3 sequencing: cast rings the TYPE (creature-first priority); entering play rings the WUBRG-sorted COLOUR", async () => {
    const { castTypeSfxCue, enterSfxCue } = await import("./audio.js");
    expect(castTypeSfxCue(["Creature"])).toBe("sfx.cast.creature");
    expect(castTypeSfxCue(["Artifact", "Creature"])).toBe("sfx.cast.creature"); // an artifact creature is a Summon
    expect(castTypeSfxCue(["Artifact", "Enchantment"])).toBe("sfx.cast.artifact"); // the laws' shape
    expect(castTypeSfxCue(["Instant"])).toBe("sfx.cast.instant");
    expect(castTypeSfxCue(["Sorcery"])).toBe("sfx.cast.sorcery");
    expect(castTypeSfxCue(["Land"])).toBeNull(); // a land play is not a cast
    expect(enterSfxCue(["B"], ["Creature"])).toBe("sfx.enter.B");
    expect(enterSfxCue(["U", "W"], ["Creature"])).toBe("sfx.enter.WU"); // sorted, guild-pair-mappable
    expect(enterSfxCue([], ["Artifact"])).toBe("sfx.enter.artifact");
    expect(enterSfxCue([], ["Land"])).toBe("sfx.enter.colorless");
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
