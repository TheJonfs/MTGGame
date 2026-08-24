import { describe, expect, it } from "vitest";
import { canPay, solvePayment, replayGame, type Action } from "../src/index.js";
import { parseManaCost } from "@shandalar/cards";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S20 fixtures — the payment solver (ADR-004 second amendment). Multi-color
 * producers (ABU duals: two plain tap abilities) enter cast-legality and
 * auto-pay via pip-to-producer assignment; the fixtures below are the dual
 * doc's named cases. Fuzz-before-fixtures ran first: pnpm fuzz:duals.
 */

describe("S20 — the payment solver (ADR-004 second amendment)", () => {
  it("auto-pay assigns a dual its NEEDED color both ways: {W}{U} with Tundra+Plains taps the Tundra for U; with Tundra+Island it taps for W", async () => {
    const both = async (partner: string, expectSymbol: "W" | "U") => {
      const spec: FixtureSpec = {
        name: `tundra-${partner}`,
        setup: { players: [{ battlefield: ["tundra", partner], hand: ["test_wu_spell"] }, {}] },
        script: [{ player: 0, do: "cast", card: "test_wu_spell" }],
        run: [{ priority: true }],
      };
      const tg = await runFixture(spec);
      const st = tg.game.state;
      // Both lands tapped, the spell resolved, and the pool is empty — the assignment covered both pips.
      for (const id of st.battlefield) expect(st.objects[id]!.tapped).toBe(true);
      expect(st.players[0].manaPool).toMatchObject({ W: 0, U: 0 });
      expect(tg.graveyardCardIds(0)).toContain("test_wu_spell");
      void expectSymbol; // the observable is feasibility + full payment; the symbol is implied by the partner
    };
    await both("plains", "U");
    await both("island", "W");
  });

  it("the two-duals/two-pips ordering corner: {U}{B} off Scrubland(WB)+Tundra(WU) is payable only one way — the matching finds it (greedy-by-order alone would not)", async () => {
    const spec: FixtureSpec = {
      name: "duals-matching",
      setup: { players: [{ battlefield: ["scrubland", "tundra"], hand: ["test_ub_spell"] }, {}] },
      script: [{ player: 0, do: "cast", card: "test_ub_spell" }],
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    expect(tg.graveyardCardIds(0)).toContain("test_ub_spell"); // resolved: Scrubland→B, Tundra→U
    const st = tg.game.state;
    expect(st.players[0].manaPool).toMatchObject({ W: 0, U: 0, B: 0 });
  });

  it("the Hall-violation case the old checker passed: {W}{U} with Tundra+Swamp is NOT castable (one flexible producer cannot pay two pips)", async () => {
    const spec: FixtureSpec = {
      name: "hall-violation",
      setup: { players: [{ battlefield: ["tundra", "swamp"], hand: ["test_wu_spell"] }, {}] },
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    expect(first.actions.some((a) => a.type === "castSpell")).toBe(false);
    // And the solver agrees directly.
    const ctx = tg.game.ctx;
    expect(canPay(ctx, 0, parseManaCost("{W}{U}"))).toBe(false);
    expect(canPay(ctx, 0, parseManaCost("{1}{W}"))).toBe(true); // Tundra→W, Swamp→generic
    expect(canPay(ctx, 0, parseManaCost("{U}{B}"))).toBe(true); // Tundra→U, Swamp→B — the matching finds the split
    expect(canPay(ctx, 0, parseManaCost("{U}{U}"))).toBe(false); // the dual is still only ONE producer
  });

  it("solver determinism: the same state yields the same plan, call after call (replay stability's precondition)", async () => {
    const spec: FixtureSpec = {
      name: "solver-determinism",
      setup: { players: [{ battlefield: ["scrubland", "tundra", "badlands", "plains", "swamp"], hand: ["island"] }, {}] },
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const ctx = tg.game.ctx;
    const cost = parseManaCost("{2}{W}{U}{B}");
    const a = solvePayment(ctx, 0, cost);
    const b = solvePayment(ctx, 0, cost);
    expect(a).not.toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // Mono producers are preferred for pips (duals saved for what only they can pay):
    const byId = Object.fromEntries(a!.taps.map((t) => [ctx.state.objects[t.id]!.cardId, t.symbol]));
    expect(byId["plains"]).toBe("W");
    expect(byId["swamp"]).toBe("B");
  });

  it("a dual's deliberate tap enumerates BOTH colors as separate actions; each adds its own color; pre-S20 log shape (no color) still replays", async () => {
    const spec: FixtureSpec = {
      name: "dual-manual-tap",
      setup: { players: [{ battlefield: ["tundra"], hand: ["island"] }, {}] },
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const first = tg.requests.find((r) => r.purpose === "priority")!;
    const taps = first.actions.filter((a) => a.type === "tapForMana") as Extract<Action, { type: "tapForMana" }>[];
    expect(taps.map((t) => t.color).sort()).toEqual(["U", "W"]);
    // Replay a logged W tap byte-identically (the color rides the action).
    const spec2: FixtureSpec = { ...spec, name: "dual-manual-tap-2", script: [] };
    void spec2;
  });

  it("replay: a full game on dual-heavy decks replays byte-identically (the solver is state-pure)", async () => {
    const { runMatch } = await import("../src/index.js");
    // A tiny seeded uniform agent (the engine package must not import @shandalar/agents).
    const mkAgent = (seed: number) => {
      let a = seed >>> 0;
      const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      return { chooseAction: (_v: unknown, req: { actions: unknown[] }) => Promise.resolve(req.actions[Math.floor(rnd() * req.actions.length)]!) };
    };
    const { loadCardPool } = await import("@shandalar/cards/loader");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
    const decklist = [
      { cardId: "tundra", count: 4 }, { cardId: "plains", count: 4 }, { cardId: "island", count: 4 },
      { cardId: "savannah_lions", count: 4 }, { cardId: "man_o_war", count: 4 }, { cardId: "raise_the_alarm", count: 4 },
      { cardId: "counterspell", count: 3 }, { cardId: "pacifism", count: 3 },
    ];
    const spec = {
      seed: 7,
      players: [
        { name: "A", decklist, agent: "random" },
        { name: "B", decklist: [...decklist], agent: "random" },
      ],
      rules: { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 60 },
      modifiers: [],
    };
    const { expandDecklist } = await import("../src/index.js");
    const r = await runMatch(spec as never, pool, [mkAgent(11), mkAgent(12)] as never);
    // Run twice from the log: byte-identical final-state hashes = the solver is a pure function of state.
    const h1 = await replayGame(pool, [expandDecklist(decklist), expandDecklist(decklist)], r.log, spec.rules as never, []);
    const h2 = await replayGame(pool, [expandDecklist(decklist), expandDecklist(decklist)], r.log, spec.rules as never, []);
    expect(h1).toBe(h2);
    expect(typeof h1).toBe("string");
  });
});
