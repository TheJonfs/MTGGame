import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateCard } from "@shandalar/cards";
import { runFixture, type FixtureSpec } from "./harness.js";
import { getObject } from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

describe("S8 — Cunning Tactician (ADR-053; first custom card, first tapTarget user)", () => {
  it("1. tap before declares: the tapped creature cannot block (CR 509.1a), attack connects", async () => {
    const tg = await runFixture(fixture("s8-01-tap-before-declare"));
    const ctx = tg.game.ctx;
    const bears = tg.findBattlefield("grizzly_bears");

    expect(tg.consumed.some((s) => s.do === "activate")).toBe(true);
    expect(getObject(ctx.state, bears).tapped).toBe(true);
    expect(ctx.state.combat.blocks).toHaveLength(0);
    expect(ctx.state.players[1].life).toBe(17); // Hill Giant unblocked
    expect(getObject(ctx.state, bears).damage).toBe(0);
  });

  it("2. tap after declares: the block stands (CR 506.4 removal list doesn't include tapping)", async () => {
    const tg = await runFixture(fixture("s8-02-tap-after-declare"));
    const ctx = tg.game.ctx;
    const giant = tg.findBattlefield("hill_giant");

    expect(tg.consumed.some((s) => s.do === "activate")).toBe(true);
    // Bears (2/2) blocked, got tapped afterward, still both dealt and took combat damage:
    expect(tg.graveyardCardIds(1)).toContain("grizzly_bears"); // died to the 3/3
    expect(getObject(ctx.state, giant).damage).toBe(2); // took the tapped blocker's 2
    expect(ctx.state.players[1].life).toBe(20); // blocked attacker deals nothing to the player
  });

  it("3. vigilance: attacks untapped (CR 702.21b), activates {W},{T} in the same combat, still deals damage", async () => {
    const tg = await runFixture(fixture("s8-03-vigilance-attack-activate"));
    const ctx = tg.game.ctx;
    const tactician = tg.findBattlefield("cunning_tactician");
    const bears = tg.findBattlefield("grizzly_bears");

    expect(tg.consumed.some((s) => s.do === "activate")).toBe(true);
    expect(getObject(ctx.state, bears).tapped).toBe(true); // ability resolved
    expect(getObject(ctx.state, tactician).tapped).toBe(true); // by its own {T} cost, not by attacking
    expect(ctx.state.combat.blocks).toHaveLength(0); // bears couldn't block
    expect(ctx.state.players[1].life).toBe(18); // tapped-after-declare attacker still deals damage
  });

  it("4. ADR-053 text-field validation: required on customs, forbidden on real cards", () => {
    const base = {
      id: "t",
      name: "T",
      shopTier: 1, // ADR-078
      manaCost: "{1}",
      types: ["Creature"],
      power: 1,
      toughness: 1,
    };
    expect(validateCard({ ...base, source: "custom" }).errors.join()).toContain('missing string "text"');
    expect(validateCard({ ...base, source: "custom", text: "" }).errors).toHaveLength(0);
    expect(validateCard({ ...base, source: "real", text: "nope" }).errors.join()).toContain("oracle.json");
    expect(validateCard({ ...base, source: "real" }).errors).toHaveLength(0);
  });
});
