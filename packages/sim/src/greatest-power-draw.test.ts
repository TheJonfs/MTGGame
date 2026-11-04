import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const study = cards.get("confession")!; // post-S70: Chris's Confession, {1}{B}, tier 2
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { players: { life: number; hand: string[]; library: string[] }[] };
const rules = { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"];
/** Records what the study card may target, then casts it at the first target named `at` (any, when not given). */
function caster(at?: string) {
  const seen: string[][] = []; let done = false;
  const agent: Agent = { chooseAction: async (v: GameView, r) => {
    const casts = r.actions.filter((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === study.id);
    if (r.purpose === "priority" && casts.length && !done) {
      seen.push(casts.map((c) => v.battlefield.find((o) => o.id === ((c as { targets: { id: string }[] }).targets[0]!).id)!.cardId).sort());
      const pick = casts.find((c) => !at || v.battlefield.find((o) => o.id === ((c as { targets: { id: string }[] }).targets[0]!).id)?.cardId === at);
      if (pick) { done = true; return pick; }
    }
    return pass(r);
  } };
  return { agent, seen };
}
const run = async (mods: Modifier[], agent: Agent) => JSON.parse((await runMatch({ seed: 31, players: [{ name: "a", decklist: [{ cardId: study.id, count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules, modifiers: mods } as MatchSpec, cards, [agent, passer])).finalStateSerialized) as Final;
const mana = [perm(0, "swamp"), perm(0, "swamp")];

/** Post-S70 (R-124, Chris's greatest-power draw, under study): "You lose life equal to the power of target creature with
 * the greatest power among creatures your opponents control, then draw cards equal to its toughness." Topple's template
 * and ruling (2004-10-04: no longer the greatest on resolution, the target is illegal). */
describe("Post-S70 — Confession (R-124)", () => {
  it("only the greatest power may be targeted: the Bear over the Wall; ours never", async () => {
    const c = caster();
    const f = await run([...mana, perm(1, "wall_of_blossoms"), perm(1, "grizzly_bears"), perm(0, "hill_giant")], c.agent);
    expect(c.seen[0]).toEqual(["grizzly_bears"]);
    expect(f.players[0]!.life).toBe(18); // the Bear's 2
    expect(f.players[0]!.library).toHaveLength(60 - 7 - 2); // two drawn (no draw step on the play; cleanup discards past seven)
  });

  it("a tie: either may be targeted; the Wall alone (0/4) costs nothing and draws four", async () => {
    const tie = caster();
    await run([...mana, perm(1, "grizzly_bears"), perm(1, "llanowar_elves"), perm(1, "savannah_lions")], tie.agent);
    expect(tie.seen[0]).toEqual(["grizzly_bears", "savannah_lions"]);
    const wall = caster("wall_of_blossoms");
    const f = await run([...mana, perm(1, "wall_of_blossoms")], wall.agent);
    expect([f.players[0]!.life, f.players[0]!.library.length]).toEqual([20, 60 - 7 - 4]);
  });

  it("no creature of theirs: no cast", async () => {
    const c = caster();
    await run([...mana, perm(0, "grizzly_bears")], c.agent);
    expect(c.seen).toEqual([]);
  });
});
