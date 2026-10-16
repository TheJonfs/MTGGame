import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
// A card under study lives outside the pool (data/cards-proposed) until Chris adopts it.
cards.set("foxglove_dose", JSON.parse(readFileSync(join(ROOT, "data/cards-proposed/foxglove_dose.json"), "utf8")));
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { battlefield: string[]; objects: Record<string, { cardId: string; controller: number }> };
const onField = (r: { finalStateSerialized: string }) => { const s = JSON.parse(r.finalStateSerialized) as Final; return s.battlefield.map((id) => `${s.objects[id]!.controller}:${s.objects[id]!.cardId}`); };
const spec = (mods: Modifier[]): MatchSpec =>
  ({ seed: 65, players: [{ name: "a", decklist: D({ foxglove_dose: 60 }), agent: "x" }, { name: "b", decklist: D({ mountain: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
/** Seat 0 casts one Foxglove Dose in its first main phase at the first creature of `cardId` controlled by `who`. */
const doseAt = (cardId: string, who: 0 | 1): Agent => {
  let cast = false;
  return { chooseAction: async (v: GameView, r) => {
    if (!cast && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((x) => x.type === "castSpell" && x.targets.some((t) => t.kind === "object" && v.battlefield.some((b) => b.id === t.id && b.cardId === cardId && b.controller === who)));
      if (a) { cast = true; return a; }
    }
    return pass(r);
  } };
};
const lands = [perm(0, "mountain"), perm(0, "mountain")];
const run = async (target: string, who: 0 | 1, mods: Modifier[]) => onField(await runMatch(spec([...lands, ...mods]), cards, [doseAt(target, who), passer]));

/**
 * Post-S65 — Foxglove Dose (Chris's card, the study's centroid): {1}{R} Instant, "Target creature gets +2/+0 until end
 * of turn. Then if its power is 5 or greater, destroy it." R-112: the `if` clause's `powerAtLeast`, read live after the
 * pump in the same resolution (CR 608.2c — a spell's instructions are followed in order; 613 — the pump is a
 * continuous effect already applied when the check is made).
 */
describe("Foxglove Dose", () => {
  it("is valid", () => {
    const d = cards.get("foxglove_dose")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{1}{R}", types: ["Instant"], source: "custom", shopTier: 2 });
  });
  it("kills a creature of power three (3 + 2 = 5): a Centaur Courser", async () => {
    expect(await run("centaur_courser", 1, [perm(1, "centaur_courser")])).not.toContain("1:centaur_courser");
  });
  it("leaves a creature of power two (2 + 2 = 4), pumped: Grizzly Bears", async () => {
    expect(await run("grizzly_bears", 1, [perm(1, "grizzly_bears")])).toContain("1:grizzly_bears");
  });
  it("reads the live power: Bears under a Glorious Anthem are 3/3, so 5 — destroyed", async () => {
    expect(await run("grizzly_bears", 1, [perm(1, "grizzly_bears"), perm(1, "glorious_anthem")])).not.toContain("1:grizzly_bears");
  });
  it("on our own two-power creature it is a pump, not a kill", async () => {
    expect(await run("grizzly_bears", 0, [perm(0, "grizzly_bears")])).toContain("0:grizzly_bears");
  });
});
