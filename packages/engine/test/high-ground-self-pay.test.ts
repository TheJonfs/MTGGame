import { expect, it } from "vitest";
import { TestGame } from "./harness.js";
import { legalActions } from "../src/index.js";
const offered = (bf: string[]) => {
  const tg = new TestGame({ name: "hg", setup: { turn: 3, active: 0, step: "MAIN1", players: [{ battlefield: bf, library: ["swamp", "swamp"] }, { library: ["swamp", "swamp"] }] } } as never);
  const obs = tg.findBattlefield("obsidian_observatory");
  return legalActions(tg.game.ctx, 0).some((a) => a.type === "activateAbility" && (a as { objectId: string }).objectId === obs && (a as { abilityIndex: number }).abilityIndex === 2);
};
it("the Observatory's own tap is not its white", () => {
  const noWhite = ["obsidian_observatory", "mox_sapphire", "mox_emerald", "badlands", "bayou", "bayou"];
  const withShevelport = [...noWhite, "shevelport"];
  console.log("no white source:", offered(noWhite), "| with Shevelport:", offered(withShevelport));
  expect(offered(noWhite)).toBe(false);
  expect(offered(withShevelport)).toBe(true);
});
