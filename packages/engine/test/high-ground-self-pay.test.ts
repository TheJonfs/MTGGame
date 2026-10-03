import { expect, it } from "vitest";
import { TestGame } from "./harness.js";
import { legalActions } from "../src/index.js";
const offered = (bf: string[], land = "obsidian_observatory") => {
  const tg = new TestGame({ name: "hg", setup: { turn: 3, active: 0, step: "MAIN1", players: [{ battlefield: bf, library: ["swamp", "swamp"] }, { library: ["swamp", "swamp"] }] } } as never);
  const obs = tg.findBattlefield(land);
  return legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && (a as { objectId: string }).objectId === obs && (a as { abilityIndex: number }).abilityIndex === 2);
};
it("the Observatory's own tap is not its white", () => {
  const noWhite = ["obsidian_observatory", "mox_sapphire", "mox_emerald", "badlands", "bayou", "bayou"];
  const withShevelport = [...noWhite, "shevelport"];
  expect(offered(noWhite)).toBe(false);
  expect(offered(withShevelport)).toBe(true);
});

it("Tallyflame Court ({2}{U}{R}, {T}: draw) — its own tap is not its blue (Chris's second question, the Sweep's lands)", () => {
  const noBlue = ["tallyflame_court", "badlands", "taiga", "taiga", "mox_ruby"];
  expect(offered(noBlue, "tallyflame_court")).toBe(false); // red aplenty, the Court the only blue: not offered
  expect(offered([...noBlue, "mox_sapphire"], "tallyflame_court")).toBe(true);
  expect(offered([...noBlue, "underground_sea"], "tallyflame_court")).toBe(true);
});
