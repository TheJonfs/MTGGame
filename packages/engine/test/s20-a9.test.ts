import { describe, expect, it } from "vitest";
import { runFixture, type FixtureSpec } from "./harness.js";

/**
 * S20 fixtures — A9 `entersChoice` (the shock clause, manifest amendment per
 * ADR-079). The land PLAY asks (a logged action); put-onto-battlefield paths
 * enter tapped choice-free; paying to exactly 0 is legal and lethal.
 * Fuzz-before-fixtures ran first: pnpm fuzz:duals --shocks.
 */

describe("S20 — A9 entersChoice (shocklands)", () => {
  const play = (accept: boolean, life = 20): FixtureSpec => ({
    name: `shock-${accept}-${life}`,
    setup: { players: [{ life, hand: ["hallowed_fountain"] }, {}] },
    script: [
      { player: 0, do: "playLand", card: "hallowed_fountain" },
      { player: 0, do: "optional", accept },
    ],
    run: [{ priority: true }],
  });

  it("pay 2 → enters untapped, life down 2; the request rode the land play", async () => {
    const tg = await runFixture(play(true));
    const st = tg.game.state;
    const land = st.battlefield.map((id) => st.objects[id]!).find((o) => o.cardId === "hallowed_fountain")!;
    expect(land.tapped).toBe(false);
    expect(st.players[0].life).toBe(18);
    expect(tg.requests.some((r) => r.purpose === "entersChoice" && r.source?.cardId === "hallowed_fountain")).toBe(true);
  });

  it("don't pay → enters tapped, life untouched", async () => {
    const tg = await runFixture(play(false));
    const st = tg.game.state;
    const land = st.battlefield.map((id) => st.objects[id]!).find((o) => o.cardId === "hallowed_fountain")!;
    expect(land.tapped).toBe(true);
    expect(st.players[0].life).toBe(20);
  });

  it("at life 2 the pay option is still offered (CR-honest) and paying is lethal — the SBA ends the game", async () => {
    const tg = await runFixture(play(true, 2));
    const st = tg.game.state;
    expect(st.players[0].life).toBe(0);
    expect(st.result?.winner).toBe(1);
  });

  it("at life 1 there is NO choice — the land enters tapped without a request", async () => {
    const spec = play(false, 1);
    spec.script = spec.script!.filter((e) => e.do !== "optional"); // no request → nothing to answer
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const land = st.battlefield.map((id) => st.objects[id]!).find((o) => o.cardId === "hallowed_fountain")!;
    expect(land.tapped).toBe(true);
    expect(st.players[0].life).toBe(1);
    expect(tg.requests.some((r) => r.purpose === "entersChoice")).toBe(false);
  });

  it("PUT onto the battlefield (fixture setup = the put path): a shock placed there starts untapped only if placed so — and createObject/moveObject default it tapped, choice-free", async () => {
    // The harness places battlefield cards via the put path; an entersChoice land arrives tapped.
    const spec: FixtureSpec = {
      name: "shock-put",
      setup: { players: [{ battlefield: ["blood_crypt"], hand: ["swamp"] }, {}] },
      run: [{ priority: true }],
    };
    const tg = await runFixture(spec);
    const st = tg.game.state;
    const land = st.battlefield.map((id) => st.objects[id]!).find((o) => o.cardId === "blood_crypt")!;
    expect(land.tapped).toBe(true);
    expect(tg.requests.some((r) => r.purpose === "entersChoice")).toBe(false);
  });
});
