import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const idOf = (v: GameView, cardId: string, controller: 0 | 1) => v.battlefield.find((o) => o.cardId === cardId && o.controller === controller)?.id;
type Final = { players: { life: number; graveyard: string[] }[]; battlefield: string[]; objects: Record<string, { cardId: string; zone: string; controller: number }> };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const onField = (f: Final, cardId: string) => f.battlefield.filter((id) => f.objects[id]!.cardId === cardId).length;
const spec = (mods: Modifier[]): MatchSpec =>
  ({ seed: 63, players: [{ name: "a", decklist: D({ plains: 60 }), agent: "x" }, { name: "b", decklist: D({ mountain: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
/** Seat 0 equips the Collar to `bearer` in its first main phase, then attacks with it alone. */
const equipAndAttack = (bearer: string): Agent => {
  let equipped = false;
  return { chooseAction: async (v, r) => {
    const me = idOf(v, bearer, 0);
    if (r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0 && !equipped) {
      const eq = r.actions.find((a) => a.type === "activateAbility" && a.objectId === idOf(v, "basilisk_collar", 0) && (a.targets[0] as { id?: string } | undefined)?.id === me);
      if (eq) { equipped = true; return eq; }
    }
    const atk = r.actions.find((a) => a.type === "declareAttacker" && a.objectId === me); if (atk) return atk;
    const done = r.actions.find((a) => a.type === "doneDeclaringAttackers"); if (done) return done;
    return pass(r);
  } };
};
/** Seat 1 blocks with `blocker` if it has one, and otherwise passes. */
const blockWith = (blocker: string): Agent => ({ chooseAction: async (_v, r) =>
  r.actions.find((a) => a.type === "declareBlocker" && _v.battlefield.find((o) => o.id === a.blocker)?.cardId === blocker) ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? pass(r) });
const lands = [perm(0, "plains"), perm(0, "plains")];

/**
 * Post-S62 (Chris, for the Elder round) — Basilisk Collar, verified against Scryfall 2026-10-13: first printed in
 * Worldwake, {1} Artifact — Equipment, "Equipped creature has deathtouch and lifelink. Equip {2}". No new words
 * (the Warhammer's grantKeyword scope attached). CR 702.2b: any nonzero damage from a deathtouch source is lethal;
 * 702.7b/510.4: first-strike damage is dealt, and state-based actions checked, before regular damage; 702.15b: lifelink
 * gains on each damage event (702.4b: a double striker deals damage in both steps).
 */
describe("Basilisk Collar", () => {
  it("is valid as printed", () => {
    const d = cards.get("basilisk_collar")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{1}", types: ["Artifact"], subtypes: ["Equipment"], source: "real" });
  });
  it("on a first striker: a blocking Serra Angel dies before it deals damage, the Archer lives, and we gain its 2", async () => {
    const f = fin(await runMatch(spec([...lands, perm(0, "basilisk_collar"), perm(0, "longbow_archer"), perm(1, "serra_angel")]), cards, [equipAndAttack("longbow_archer"), blockWith("serra_angel")]));
    expect([onField(f, "serra_angel"), onField(f, "longbow_archer")]).toEqual([0, 1]);
    expect([f.players[0]!.life, f.players[1]!.life]).toEqual([22, 20]);
  });
  it("on a creature without first strike: it trades with the Angel, and still gains its 2", async () => {
    const f = fin(await runMatch(spec([...lands, perm(0, "basilisk_collar"), perm(0, "grizzly_bears"), perm(1, "serra_angel")]), cards, [equipAndAttack("grizzly_bears"), blockWith("serra_angel")]));
    expect([onField(f, "serra_angel"), onField(f, "grizzly_bears"), onField(f, "basilisk_collar")]).toEqual([0, 0, 1]); // the Collar stays when its bearer dies
    expect(f.players[0]!.life).toBe(22);
  });
  it("on an unblocked double striker: Fencing Ace's two hits each gain 1", async () => {
    const f = fin(await runMatch(spec([...lands, perm(0, "basilisk_collar"), perm(0, "fencing_ace")]), cards, [equipAndAttack("fencing_ace"), blockWith("none")]));
    expect([f.players[0]!.life, f.players[1]!.life]).toEqual([22, 18]);
  });
});
