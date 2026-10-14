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
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
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

  /** Post-S62 (Chris): Wall of Razors — verified against Scryfall 2026-10-14: Stronghold (its only printing), {1}{R}
   * Creature — Wall 4/1, defender, first strike. No new words. CR 702.3b (defender: can't attack); 702.7b and 510.4
   * (first-strike damage first, and a creature it destroys deals no regular damage). */
  it("Wall of Razors: valid as printed; it kills a blocked 4/4 before the 4/4 deals damage, and dies to a 5/5 it cannot kill", async () => {
    const d = cards.get("wall_of_razors")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{1}{R}", types: ["Creature"], subtypes: ["Wall"], power: 4, toughness: 1, keywords: ["defender", "first strike"], source: "real" });
    // seat 1 attacks into our Wall (seat 1 is active: startingPlayer 1)
    const attacker = (cardId: string): Agent => ({ chooseAction: async (v, r) => r.actions.find((a) => a.type === "declareAttacker" && v.battlefield.find((o) => o.id === a.objectId)?.cardId === cardId) ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? pass(r) });
    const blocker: Agent = { chooseAction: async (v, r) => r.actions.find((a) => a.type === "declareBlocker" && v.battlefield.find((o) => o.id === a.blocker)?.cardId === "wall_of_razors") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? pass(r) };
    const run = async (big: string) => fin(await runMatch({ ...spec([perm(0, "wall_of_razors"), perm(1, big)]), rules: { ...spec([]).rules, startingPlayer: 1 } }, cards, [blocker, attacker(big)]));
    const four = await run("rumbling_baloth");
    expect([onField(four, "rumbling_baloth"), onField(four, "wall_of_razors")]).toEqual([0, 1]);
    const five = await run("gallows_djinn");
    expect([onField(five, "gallows_djinn"), onField(five, "wall_of_razors")]).toEqual([1, 0]);
  });
  it("Wall of Razors with the Collar: a first-strike deathtoucher — the 5/5 dies and the Wall lives", async () => {
    const attacker: Agent = { chooseAction: async (v, r) => r.actions.find((a) => a.type === "declareAttacker") ?? r.actions.find((a) => a.type === "doneDeclaringAttackers") ?? pass(r) };
    const blocker: Agent = { chooseAction: async (v, r) => r.actions.find((a) => a.type === "declareBlocker" && v.battlefield.find((o) => o.id === a.blocker)?.cardId === "wall_of_razors") ?? r.actions.find((a) => a.type === "doneDeclaringBlockers") ?? pass(r) };
    // the Collar starts attached: equip on our turn, then pass the turn to the attacker
    let equipped = false;
    const ours: Agent = { chooseAction: async (v, r) => {
      if (!equipped && r.purpose === "priority" && v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) { const eq = r.actions.find((a) => a.type === "activateAbility" && v.battlefield.find((o) => o.id === a.objectId)?.cardId === "basilisk_collar"); if (eq) { equipped = true; return eq; } }
      return blocker.chooseAction(v, r);
    } };
    const f = fin(await runMatch({ ...spec([...lands, perm(0, "basilisk_collar"), perm(0, "wall_of_razors"), perm(1, "gallows_djinn")]), rules: { ...spec([]).rules, maxTurns: 2 } }, cards, [ours, attacker]));
    expect(equipped).toBe(true);
    expect([onField(f, "gallows_djinn"), onField(f, "wall_of_razors")]).toEqual([0, 1]);
    expect(f.players[0]!.life).toBe(24); // lifelink: the Wall's 4
  });

  /** Post-S62 (Chris): Retribution of the Meek — verified against Scryfall 2026-10-14: Visions, {2}{W} Sorcery,
   * "Destroy all creatures with power 4 or greater. They can't be regenerated." (Nothing in the pool regenerates, as
   * for Wrath of God.) R-109: power read as the spell resolves (CR 608.2h) — a Dungrove Elder is as big as its Forests. */
  it("Retribution of the Meek: every creature of power four or more dies, either side; three or less lives; an Elder by its Forests", async () => {
    const d = cards.get("retribution_of_the_meek")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{2}{W}", types: ["Sorcery"], source: "real" });
    let cast = false;
    const caster: Agent = { chooseAction: async (v, r) => { if (!cast && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) { const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === "retribution_of_the_meek"); if (a) { cast = true; return a; } } return pass(r); } };
    const forests = (n: number) => Array.from({ length: n }, () => perm(1, "forest"));
    const board = [perm(0, "plains"), perm(0, "plains"), perm(0, "plains"), perm(0, "serra_angel"), perm(0, "grizzly_bears"), perm(1, "gallows_djinn"), perm(1, "centaur_courser"), perm(1, "dungrove_elder")];
    const run = async (n: number) => fin(await runMatch({ ...spec([...board, ...forests(n)]), players: [{ name: "a", decklist: D({ retribution_of_the_meek: 60 }), agent: "x" }, { name: "b", decklist: D({ forest: 60 }), agent: "x" }] }, cards, [caster, passer]));
    const big = await run(4);
    expect(cast).toBe(true);
    expect(["serra_angel", "grizzly_bears", "gallows_djinn", "centaur_courser", "dungrove_elder"].map((c) => onField(big, c))).toEqual([0, 1, 0, 1, 0]);
    cast = false;
    const small = await run(3); // a 3/3 Elder
    expect(onField(small, "dungrove_elder")).toBe(1);
  });
});
