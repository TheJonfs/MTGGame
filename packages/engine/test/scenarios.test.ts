import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runFixture, TestGame, type FixtureSpec } from "./harness.js";
import {
  attackDeclarations,
  blockDeclarations,
  canBlock,
  characteristics,
  eligibleAttackers,
  eligibleBlockers,
} from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): FixtureSpec {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as FixtureSpec;
}

describe("scenario fixtures (brief §fixtures)", () => {
  it("1. Bolt a 2/1 — dies via SBA, not in the damage code", async () => {
    const tg = await runFixture(fixture("01-bolt-kills-2-1"));
    expect(tg.graveyardCardIds(1)).toContain("goblin_piker");
    expect(tg.graveyardCardIds(0)).toContain("lightning_bolt");
    expect(tg.battlefieldCardIds()).not.toContain("goblin_piker");
  });

  it("2. Bolt a 2/2 with Brute Force in response — survives; pump and damage clear at cleanup", async () => {
    const spec = fixture("02-pump-saves-2-2");
    const tg = await runFixture(spec);
    // After the priority round: ogre alive at 5/5 with 3 damage marked.
    const ogreId = tg.findBattlefield("gray_ogre");
    const chars = characteristics(tg.game.ctx, ogreId);
    expect(chars.power).toBe(5);
    expect(chars.toughness).toBe(5);
    expect(tg.game.state.objects[ogreId]!.damage).toBe(3);
    // End of turn: cleanup expires the pump and clears damage.
    await tg.game.runStep("END");
    await tg.game.runStep("CLEANUP");
    const after = characteristics(tg.game.ctx, ogreId);
    expect(after.power).toBe(2);
    expect(after.toughness).toBe(2);
    expect(tg.game.state.objects[ogreId]!.damage).toBe(0);
  });

  it("3. Counterspell a Bolt — Bolt to graveyard, no damage dealt", async () => {
    const tg = await runFixture(fixture("03-counterspell-bolt"));
    expect(tg.graveyardCardIds(0)).toContain("lightning_bolt");
    expect(tg.graveyardCardIds(1)).toContain("counterspell");
    expect(tg.game.state.players[1].life).toBe(20);
    expect(tg.game.state.stack).toHaveLength(0);
  });

  it("4. Boomerang the creature in response to Pacifism — Pacifism fizzles to graveyard", async () => {
    const tg = await runFixture(fixture("04-boomerang-fizzles-pacifism"));
    expect(tg.handCardIds(1)).toContain("savannah_lions");
    expect(tg.graveyardCardIds(0)).toContain("pacifism");
    expect(tg.battlefieldCardIds()).not.toContain("pacifism");
    const fizzled = tg.log.entries.some((e) => e.t === "EVENT" && e.name === "FIZZLE");
    expect(fizzled).toBe(true);
  });

  it("5. Pacified creature cannot be declared as attacker or blocker", async () => {
    const tg = new TestGame(fixture("05-pacified-cannot-attack-or-block"));
    const ctx = tg.game.ctx;
    const lions = tg.findBattlefield("savannah_lions");
    const chars = characteristics(ctx, lions);
    expect(chars.cantAttack).toBe(true);
    expect(chars.cantBlock).toBe(true);
    expect(eligibleAttackers(ctx)).toEqual([]);
    // Only one legal declaration: attack with nothing.
    expect(attackDeclarations(ctx)).toEqual([{ type: "declareAttackers", attackers: [] }]);
    // And from the other seat it can't block either.
    ctx.state.activePlayer = 1;
    expect(eligibleBlockers(ctx)).toEqual([]);
  });

  it("6. Man-o'-War with no other creature — ETB must target and bounces itself", async () => {
    const tg = await runFixture(fixture("06-man-o-war-self-bounce"));
    expect(tg.battlefieldCardIds()).not.toContain("man_o_war");
    expect(tg.handCardIds(0)).toContain("man_o_war");
    expect(tg.game.state.stack).toHaveLength(0);
  });

  it("7. Serra Angel attacks without tapping and can block next turn", async () => {
    const tg = await runFixture(fixture("07-serra-vigilance"));
    const serra = tg.findBattlefield("serra_angel");
    expect(tg.game.state.objects[serra]!.tapped).toBe(false);
    expect(tg.game.state.players[1].life).toBe(16);
    // Next turn: opponent attacks, Serra is an eligible blocker.
    tg.game.state.activePlayer = 1;
    expect(eligibleBlockers(tg.game.ctx)).toContain(serra);
  });

  it("8. First strike 2/1 vs 2/2 blocker — the 2/2 dies first and deals no damage back", async () => {
    const tg = await runFixture(fixture("08-first-strike"));
    expect(tg.graveyardCardIds(1)).toContain("gray_ogre");
    const soldier = tg.findBattlefield("test_fs_soldier");
    expect(tg.game.state.objects[soldier]!.damage).toBe(0);
  });

  it("9. Flying attacker cannot be blocked by a grounded creature", async () => {
    const tg = await runFixture(fixture("09-flying-unblockable-by-ground"));
    const ctx = tg.game.ctx;
    const drake = tg.findBattlefield("wind_drake");
    const ogre = tg.findBattlefield("gray_ogre");
    expect(canBlock(ctx, ogre, drake)).toBe(false);
    // The only legal block declaration is "no blocks".
    expect(blockDeclarations(ctx)).toEqual([{ type: "declareBlockers", blocks: [] }]);
  });

  it("10. Drawing from an empty library — loss at the next SBA check", async () => {
    const tg = await runFixture(fixture("10-decked-loss"));
    expect(tg.game.state.result).toEqual({ winner: 0, reason: "DECKED" });
  });

  it("synthetic activated ability — {1},T: ping goes on the stack and resolves", async () => {
    const tg = await runFixture(fixture("11-synthetic-activated-ability"));
    expect(tg.game.state.players[1].life).toBe(19);
    const pinger = tg.findBattlefield("test_pinger");
    expect(tg.game.state.objects[pinger]!.tapped).toBe(true);
  });

  it("Bolt the attacker during declare blockers — dies before damage, blocker unharmed", async () => {
    const tg = await runFixture(fixture("13-bolt-attacker-during-blocks"));
    expect(tg.graveyardCardIds(0)).toContain("hill_giant");
    const ogre = tg.findBattlefield("gray_ogre");
    expect(tg.game.state.objects[ogre]!.damage).toBe(0);
    expect(tg.game.state.players[0].life).toBe(20); // blocked: no damage got through
  });

  it("Pump the blocker during declare blockers — blocker survives, attacker dies", async () => {
    const tg = await runFixture(fixture("14-pump-blocker-during-blocks"));
    expect(tg.graveyardCardIds(0)).toContain("hill_giant");
    const ogre = tg.findBattlefield("gray_ogre");
    expect(tg.game.state.objects[ogre]!.damage).toBe(3); // took 3 with 5 toughness
  });

  it("Cloudkin Seer ETB draws a card", async () => {
    const tg = await runFixture(fixture("12-cloudkin-etb-draw"));
    expect(tg.battlefieldCardIds()).toContain("cloudkin_seer");
    expect(tg.handCardIds(0)).toContain("island"); // drew the library top
    expect(tg.game.state.players[0].library).toHaveLength(1);
  });
});
